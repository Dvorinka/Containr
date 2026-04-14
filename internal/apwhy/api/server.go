package api

import (
	"context"
	"database/sql"
	"embed"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"mime"
	"net/http"
	"net/url"
	"os"
	"path"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"apwhy/internal/analytics"
	"apwhy/internal/auth"
	"apwhy/internal/config"
	"apwhy/internal/gateway"
	"apwhy/internal/storage"
)

//go:embed static/*
var staticFS embed.FS

type Server struct {
	Store       *storage.Store
	Cfg         config.Config
	Umami       *analytics.Client
	proxyClient *http.Client

	rpmMu    sync.Mutex
	rpmUsage map[string]rpmWindow

	loginMu       sync.Mutex
	loginAttempts map[string]loginWindow
}

type rpmWindow struct {
	WindowStart time.Time
	Count       int
}

type loginWindow struct {
	WindowStart time.Time
	Count       int
}

type authContext struct {
	UserID             string
	Email              string
	Enabled            bool
	ForcePasswordReset bool
	Roles              []string
	Permissions        map[string]bool
	SessionID          string
}

func NewServer(store *storage.Store, cfg config.Config) *Server {
	return &Server{
		Store: store,
		Cfg:   cfg,
		Umami: analytics.NewClient(cfg.UmamiBaseURL, cfg.UmamiAPIKey, cfg.UmamiWebsiteID),
		proxyClient: &http.Client{
			Timeout: cfg.DefaultServiceTimeout,
		},
		rpmUsage:      map[string]rpmWindow{},
		loginAttempts: map[string]loginWindow{},
	}
}

func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc("GET /health", s.handleHealth)

	mux.HandleFunc("GET /api/v1/bootstrap/status", s.handleBootstrapStatus)
	mux.HandleFunc("POST /api/v1/bootstrap/register-owner", s.handleBootstrapRegisterOwner)

	mux.HandleFunc("POST /api/v1/auth/login", s.handleAuthLogin)
	mux.HandleFunc("POST /api/v1/auth/logout", s.handleAuthLogout)
	mux.HandleFunc("POST /api/v1/auth/refresh", s.handleAuthRefresh)
	mux.HandleFunc("GET /api/v1/auth/me", s.withAuth("", true, s.handleAuthMe))
	mux.HandleFunc("POST /api/v1/auth/reset-password", s.withAuth("", true, s.handleAuthResetPassword))

	mux.HandleFunc("GET /api/v1/users", s.withAuth("users.read", false, s.handleUsersList))
	mux.HandleFunc("POST /api/v1/users", s.withAuth("users.write", false, s.handleUsersCreate))
	mux.HandleFunc("PATCH /api/v1/users/{id}", s.withAuth("users.write", false, s.handleUsersPatch))

	mux.HandleFunc("GET /api/v1/roles", s.withAuth("roles.read", false, s.handleRolesList))
	mux.HandleFunc("POST /api/v1/roles", s.withAuth("roles.write", false, s.handleRolesCreate))
	mux.HandleFunc("PATCH /api/v1/roles/{id}", s.withAuth("roles.write", false, s.handleRolesPatch))
	mux.HandleFunc("GET /api/v1/permissions", s.withAuth("roles.read", false, s.handlePermissionsList))

	mux.HandleFunc("GET /api/v1/services", s.withAuth("services.read", false, s.handleServicesList))
	mux.HandleFunc("POST /api/v1/services", s.withAuth("services.write", false, s.handleServicesCreate))
	mux.HandleFunc("PATCH /api/v1/services/{id}", s.withAuth("services.write", false, s.handleServicesPatch))
	mux.HandleFunc("POST /api/v1/services/{id}/validate", s.withAuth("services.write", false, s.handleServicesValidate))

	mux.HandleFunc("GET /api/v1/databases", s.withAuth("databases.read", false, s.handleDatabasesList))
	mux.HandleFunc("POST /api/v1/databases", s.withAuth("databases.write", false, s.handleDatabasesCreate))
	mux.HandleFunc("PATCH /api/v1/databases/{id}", s.withAuth("databases.write", false, s.handleDatabasesPatch))
	mux.HandleFunc("POST /api/v1/databases/{id}/validate", s.withAuth("databases.write", false, s.handleDatabasesValidate))

	mux.HandleFunc("GET /api/v1/keys", s.withAuth("keys.read", false, s.handleKeysList))
	mux.HandleFunc("POST /api/v1/keys", s.withAuth("keys.write", false, s.handleKeysCreate))
	mux.HandleFunc("PATCH /api/v1/keys/{id}", s.withAuth("keys.write", false, s.handleKeysPatch))

	mux.HandleFunc("GET /api/v1/analytics/ops", s.withAuth("analytics.read", false, s.handleAnalyticsOps))
	mux.HandleFunc("GET /api/v1/analytics/traffic", s.withAuth("analytics.read", false, s.handleAnalyticsTraffic))
	mux.HandleFunc("POST /api/v1/analytics/events", s.withAuth("", true, s.handleAnalyticsEvents))

	mux.HandleFunc("/", s.handleGatewayOrUI)

	return s.withSecurityHeaders(s.withLogging(mux))
}

func (s *Server) withSecurityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")
		next.ServeHTTP(w, r)
	})
}

func (s *Server) withLogging(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		next.ServeHTTP(w, r)
		_ = s.logMetric("http_request", 1, map[string]any{
			"method": r.Method,
			"path":   r.URL.Path,
			"ms":     time.Since(start).Milliseconds(),
		})
	})
}

func (s *Server) withAuth(requiredPermission string, allowForceReset bool, handler func(http.ResponseWriter, *http.Request, *authContext)) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx, err := s.resolveAuth(r)
		if err != nil {
			writeError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Authentication required")
			return
		}
		if !ctx.Enabled {
			writeError(w, http.StatusForbidden, "USER_DISABLED", "User account is disabled")
			return
		}
		if ctx.ForcePasswordReset && !allowForceReset {
			writeError(w, http.StatusPreconditionRequired, "PASSWORD_RESET_REQUIRED", "Password reset required")
			return
		}
		if requiredPermission != "" && !ctx.Permissions[requiredPermission] {
			writeError(w, http.StatusForbidden, "FORBIDDEN", "Insufficient permissions")
			return
		}
		handler(w, r, ctx)
	}
}

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"ok": true,
		"data": map[string]any{
			"status":      "ok",
			"name":        "APwhy",
			"database":    "sqlite",
			"generatedAt": time.Now().UTC().Format(time.RFC3339),
		},
	})
}

func (s *Server) handleBootstrapStatus(w http.ResponseWriter, r *http.Request) {
	hasUsers := s.hasUsers(r.Context())
	writeJSON(w, http.StatusOK, map[string]any{
		"ok": true,
		"data": map[string]any{
			"hasUsers":         hasUsers,
			"registrationOpen": !hasUsers,
		},
	})
}

func (s *Server) handleBootstrapRegisterOwner(w http.ResponseWriter, r *http.Request) {
	if s.hasUsers(r.Context()) {
		writeError(w, http.StatusForbidden, "BOOTSTRAP_CLOSED", "Owner registration is closed")
		return
	}

	var input struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := decodeJSON(r.Body, &input); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_BODY", err.Error())
		return
	}

	input.Email = strings.ToLower(strings.TrimSpace(input.Email))
	if input.Email == "" || !strings.Contains(input.Email, "@") {
		writeError(w, http.StatusBadRequest, "INVALID_EMAIL", "Valid email is required")
		return
	}

	hash, err := auth.HashPassword(input.Password)
	if err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_PASSWORD", err.Error())
		return
	}

	now := storage.NowISO()
	userID, _ := auth.RandomID("usr")

	tx, err := s.Store.DB.BeginTx(r.Context(), nil)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "DB_ERROR", "Failed to start transaction")
		return
	}
	defer tx.Rollback()

	_, err = tx.ExecContext(r.Context(), `
		INSERT INTO users (id, email, password_hash, enabled, force_password_reset, created_at, updated_at)
		VALUES (?, ?, ?, 1, 0, ?, ?)
	`, userID, input.Email, hash, now, now)
	if err != nil {
		writeError(w, http.StatusBadRequest, "USER_CREATE_FAILED", "Email already exists")
		return
	}

	ownerRoleID := ""
	if err := tx.QueryRowContext(r.Context(), `SELECT id FROM roles WHERE slug = 'owner'`).Scan(&ownerRoleID); err != nil {
		writeError(w, http.StatusInternalServerError, "ROLE_MISSING", "Owner role not found")
		return
	}

	_, err = tx.ExecContext(r.Context(), `INSERT INTO user_roles (user_id, role_id, created_at) VALUES (?, ?, ?)`, userID, ownerRoleID, now)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "ROLE_ASSIGN_FAILED", "Failed to assign owner role")
		return
	}

	if err := tx.Commit(); err != nil {
		writeError(w, http.StatusInternalServerError, "DB_ERROR", "Failed to commit owner registration")
		return
	}

	s.audit(r.Context(), userID, "owner.registered", "user", userID, map[string]any{"email": input.Email})

	writeJSON(w, http.StatusCreated, map[string]any{
		"ok": true,
		"data": map[string]any{
			"id":    userID,
			"email": input.Email,
			"roles": []string{"owner"},
		},
	})
}

func (s *Server) handleAuthLogin(w http.ResponseWriter, r *http.Request) {
	var input struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := decodeJSON(r.Body, &input); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_BODY", err.Error())
		return
	}

	email := strings.ToLower(strings.TrimSpace(input.Email))
	if email == "" || input.Password == "" {
		writeError(w, http.StatusBadRequest, "INVALID_CREDENTIALS", "Email and password are required")
		return
	}

	if s.isLoginRateLimited(r, email) {
		writeError(w, http.StatusTooManyRequests, "LOGIN_RATE_LIMITED", "Too many login attempts")
		return
	}

	var user struct {
		ID                 string
		Email              string
		PasswordHash       string
		Enabled            int
		ForcePasswordReset int
	}
	err := s.Store.DB.QueryRowContext(r.Context(), `
		SELECT id, email, password_hash, enabled, force_password_reset
		FROM users
		WHERE email = ?
	`, email).Scan(&user.ID, &user.Email, &user.PasswordHash, &user.Enabled, &user.ForcePasswordReset)
	if err != nil {
		s.markLoginAttempt(r, email)
		writeError(w, http.StatusUnauthorized, "INVALID_CREDENTIALS", "Invalid credentials")
		return
	}
	if user.Enabled != 1 {
		writeError(w, http.StatusForbidden, "USER_DISABLED", "User account is disabled")
		return
	}

	ok, err := auth.VerifyPassword(user.PasswordHash, input.Password)
	if err != nil || !ok {
		s.markLoginAttempt(r, email)
		writeError(w, http.StatusUnauthorized, "INVALID_CREDENTIALS", "Invalid credentials")
		return
	}

	s.clearLoginAttempts(r, email)

	sessionID, accessToken, refreshToken, err := s.createSession(r.Context(), user.ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "SESSION_CREATE_FAILED", "Failed to create login session")
		return
	}

	now := storage.NowISO()
	_, _ = s.Store.DB.ExecContext(r.Context(), `UPDATE users SET last_login_at = ?, updated_at = ? WHERE id = ?`, now, now, user.ID)
	_ = sessionID

	s.setAuthCookies(w, accessToken, refreshToken)

	ctx, _ := s.resolveAuthFromTokenHash(r.Context(), auth.HashToken(accessToken))
	if ctx == nil {
		writeError(w, http.StatusInternalServerError, "SESSION_RESOLVE_FAILED", "Failed to load user profile")
		return
	}

	s.audit(r.Context(), user.ID, "auth.login", "session", sessionID, map[string]any{"email": user.Email})

	writeJSON(w, http.StatusOK, map[string]any{
		"ok": true,
		"data": map[string]any{
			"user": map[string]any{
				"id":                 ctx.UserID,
				"email":              ctx.Email,
				"roles":              ctx.Roles,
				"permissions":        keysOfMap(ctx.Permissions),
				"forcePasswordReset": ctx.ForcePasswordReset,
			},
		},
	})
}

func (s *Server) handleAuthLogout(w http.ResponseWriter, r *http.Request) {
	accessCookie, _ := r.Cookie(s.Cfg.SessionAccessCookie)
	refreshCookie, _ := r.Cookie(s.Cfg.SessionRefreshCookie)

	now := storage.NowISO()
	if accessCookie != nil {
		_, _ = s.Store.DB.ExecContext(r.Context(), `
			UPDATE sessions SET revoked_at = ?, updated_at = ? WHERE access_token_hash = ?
		`, now, now, auth.HashToken(accessCookie.Value))
	}
	if refreshCookie != nil {
		_, _ = s.Store.DB.ExecContext(r.Context(), `
			UPDATE sessions SET revoked_at = ?, updated_at = ? WHERE refresh_token_hash = ?
		`, now, now, auth.HashToken(refreshCookie.Value))
	}

	s.clearAuthCookies(w)
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (s *Server) handleAuthRefresh(w http.ResponseWriter, r *http.Request) {
	refreshCookie, err := r.Cookie(s.Cfg.SessionRefreshCookie)
	if err != nil || strings.TrimSpace(refreshCookie.Value) == "" {
		writeError(w, http.StatusUnauthorized, "REFRESH_MISSING", "Refresh token is missing")
		return
	}

	refreshHash := auth.HashToken(refreshCookie.Value)

	var session struct {
		ID        string
		UserID    string
		ExpiresAt string
		RevokedAt sql.NullString
	}
	err = s.Store.DB.QueryRowContext(r.Context(), `
		SELECT id, user_id, refresh_expires_at, revoked_at
		FROM sessions
		WHERE refresh_token_hash = ?
	`, refreshHash).Scan(&session.ID, &session.UserID, &session.ExpiresAt, &session.RevokedAt)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "INVALID_REFRESH", "Refresh token is invalid")
		return
	}
	if session.RevokedAt.Valid {
		writeError(w, http.StatusUnauthorized, "INVALID_REFRESH", "Refresh token is revoked")
		return
	}
	expiresAt, _ := time.Parse(time.RFC3339, session.ExpiresAt)
	if time.Now().After(expiresAt) {
		writeError(w, http.StatusUnauthorized, "REFRESH_EXPIRED", "Refresh token has expired")
		return
	}

	accessToken, _ := auth.RandomToken(32)
	newRefreshToken, _ := auth.RandomToken(48)
	accessHash := auth.HashToken(accessToken)
	refreshHashNew := auth.HashToken(newRefreshToken)

	accessExp := time.Now().Add(s.Cfg.AccessTokenTTL).UTC().Format(time.RFC3339)
	refreshExp := time.Now().Add(s.Cfg.RefreshTokenTTL).UTC().Format(time.RFC3339)

	_, err = s.Store.DB.ExecContext(r.Context(), `
		UPDATE sessions
		SET access_token_hash = ?, refresh_token_hash = ?, access_expires_at = ?, refresh_expires_at = ?, updated_at = ?
		WHERE id = ?
	`, accessHash, refreshHashNew, accessExp, refreshExp, storage.NowISO(), session.ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "REFRESH_FAILED", "Failed to refresh session")
		return
	}

	s.setAuthCookies(w, accessToken, newRefreshToken)
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (s *Server) handleAuthMe(w http.ResponseWriter, r *http.Request, ctx *authContext) {
	writeJSON(w, http.StatusOK, map[string]any{
		"ok": true,
		"data": map[string]any{
			"id":                 ctx.UserID,
			"email":              ctx.Email,
			"roles":              ctx.Roles,
			"permissions":        keysOfMap(ctx.Permissions),
			"forcePasswordReset": ctx.ForcePasswordReset,
		},
	})
}

func (s *Server) handleAuthResetPassword(w http.ResponseWriter, r *http.Request, ctx *authContext) {
	var input struct {
		NewPassword string `json:"newPassword"`
	}
	if err := decodeJSON(r.Body, &input); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_BODY", err.Error())
		return
	}
	hash, err := auth.HashPassword(input.NewPassword)
	if err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_PASSWORD", err.Error())
		return
	}

	now := storage.NowISO()
	_, err = s.Store.DB.ExecContext(r.Context(), `
		UPDATE users SET password_hash = ?, force_password_reset = 0, updated_at = ? WHERE id = ?
	`, hash, now, ctx.UserID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "PASSWORD_UPDATE_FAILED", "Failed to update password")
		return
	}

	s.audit(r.Context(), ctx.UserID, "auth.reset_password", "user", ctx.UserID, nil)
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (s *Server) handleUsersList(w http.ResponseWriter, r *http.Request, ctx *authContext) {
	rows, err := s.Store.DB.QueryContext(r.Context(), `
		SELECT u.id, u.email, u.enabled, u.force_password_reset, u.created_at, u.updated_at,
			COALESCE(GROUP_CONCAT(r.slug), '') AS role_slugs
		FROM users u
		LEFT JOIN user_roles ur ON ur.user_id = u.id
		LEFT JOIN roles r ON r.id = ur.role_id
		GROUP BY u.id
		ORDER BY u.created_at DESC
	`)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "DB_ERROR", "Failed to list users")
		return
	}
	defer rows.Close()

	items := make([]map[string]any, 0)
	for rows.Next() {
		var id, email, createdAt, updatedAt, roleSlugs string
		var enabled, forceReset int
		if err := rows.Scan(&id, &email, &enabled, &forceReset, &createdAt, &updatedAt, &roleSlugs); err != nil {
			continue
		}
		roles := []string{}
		if strings.TrimSpace(roleSlugs) != "" {
			roles = strings.Split(roleSlugs, ",")
		}
		items = append(items, map[string]any{
			"id":                 id,
			"email":              email,
			"enabled":            enabled == 1,
			"forcePasswordReset": forceReset == 1,
			"roles":              roles,
			"createdAt":          createdAt,
			"updatedAt":          updatedAt,
		})
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "data": items})
	_ = ctx
}

func (s *Server) handleUsersCreate(w http.ResponseWriter, r *http.Request, ctx *authContext) {
	var input struct {
		Email     string   `json:"email"`
		RoleIDs   []string `json:"roleIds"`
		RoleSlugs []string `json:"roleSlugs"`
	}
	if err := decodeJSON(r.Body, &input); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_BODY", err.Error())
		return
	}
	email := strings.ToLower(strings.TrimSpace(input.Email))
	if email == "" || !strings.Contains(email, "@") {
		writeError(w, http.StatusBadRequest, "INVALID_EMAIL", "Valid email is required")
		return
	}

	roleIDs, err := s.resolveRoleIDs(r.Context(), input.RoleIDs, input.RoleSlugs)
	if err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_ROLE", err.Error())
		return
	}
	if len(roleIDs) == 0 {
		viewerID, err := s.roleIDBySlug(r.Context(), "viewer")
		if err == nil {
			roleIDs = []string{viewerID}
		}
	}

	tempPassword, _ := auth.RandomPassword(16)
	passwordHash, err := auth.HashPassword(tempPassword)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "PASSWORD_ERROR", "Failed to generate temporary password")
		return
	}

	inviteToken, _ := auth.RandomToken(32)
	inviteHash := auth.HashToken(inviteToken)
	now := storage.NowISO()
	expiresAt := time.Now().Add(72 * time.Hour).UTC().Format(time.RFC3339)

	userID, _ := auth.RandomID("usr")
	inviteID, _ := auth.RandomID("inv")

	tx, err := s.Store.DB.BeginTx(r.Context(), nil)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "DB_ERROR", "Failed to start transaction")
		return
	}
	defer tx.Rollback()

	_, err = tx.ExecContext(r.Context(), `
		INSERT INTO users (id, email, password_hash, enabled, force_password_reset, created_at, updated_at)
		VALUES (?, ?, ?, 1, 1, ?, ?)
	`, userID, email, passwordHash, now, now)
	if err != nil {
		writeError(w, http.StatusBadRequest, "USER_CREATE_FAILED", "Email already exists")
		return
	}

	for _, roleID := range roleIDs {
		_, err = tx.ExecContext(r.Context(), `INSERT INTO user_roles (user_id, role_id, created_at) VALUES (?, ?, ?)`, userID, roleID, now)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "ROLE_ASSIGN_FAILED", "Failed to assign roles")
			return
		}
	}

	_, err = tx.ExecContext(r.Context(), `
		INSERT INTO invites (id, user_id, email, token_hash, expires_at, created_by, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?)
	`, inviteID, userID, email, inviteHash, expiresAt, ctx.UserID, now)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "INVITE_FAILED", "Failed to create invite")
		return
	}

	if err := tx.Commit(); err != nil {
		writeError(w, http.StatusInternalServerError, "DB_ERROR", "Failed to commit user creation")
		return
	}

	s.audit(r.Context(), ctx.UserID, "users.create", "user", userID, map[string]any{"email": email, "roleCount": len(roleIDs)})

	writeJSON(w, http.StatusCreated, map[string]any{
		"ok": true,
		"data": map[string]any{
			"id":            userID,
			"email":         email,
			"inviteToken":   inviteToken,
			"temporaryPass": tempPassword,
			"expiresAt":     expiresAt,
		},
	})
}

func (s *Server) handleUsersPatch(w http.ResponseWriter, r *http.Request, ctx *authContext) {
	id := r.PathValue("id")
	if id == "" {
		writeError(w, http.StatusBadRequest, "INVALID_ID", "User ID is required")
		return
	}

	var input struct {
		Enabled       *bool    `json:"enabled"`
		RoleIDs       []string `json:"roleIds"`
		RoleSlugs     []string `json:"roleSlugs"`
		ResetPassword bool     `json:"resetPassword"`
	}
	if err := decodeJSON(r.Body, &input); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_BODY", err.Error())
		return
	}

	now := storage.NowISO()
	tx, err := s.Store.DB.BeginTx(r.Context(), nil)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "DB_ERROR", "Failed to start transaction")
		return
	}
	defer tx.Rollback()

	if input.Enabled != nil {
		_, err = tx.ExecContext(r.Context(), `UPDATE users SET enabled = ?, updated_at = ? WHERE id = ?`, boolToInt(*input.Enabled), now, id)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "USER_UPDATE_FAILED", "Failed to update user")
			return
		}
	}

	if len(input.RoleIDs) > 0 || len(input.RoleSlugs) > 0 {
		roleIDs, err := s.resolveRoleIDs(r.Context(), input.RoleIDs, input.RoleSlugs)
		if err != nil {
			writeError(w, http.StatusBadRequest, "INVALID_ROLE", err.Error())
			return
		}
		_, err = tx.ExecContext(r.Context(), `DELETE FROM user_roles WHERE user_id = ?`, id)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "ROLE_UPDATE_FAILED", "Failed to update user roles")
			return
		}
		for _, roleID := range roleIDs {
			_, err = tx.ExecContext(r.Context(), `INSERT INTO user_roles (user_id, role_id, created_at) VALUES (?, ?, ?)`, id, roleID, now)
			if err != nil {
				writeError(w, http.StatusInternalServerError, "ROLE_UPDATE_FAILED", "Failed to assign role")
				return
			}
		}
	}

	response := map[string]any{}
	if input.ResetPassword {
		tempPassword, _ := auth.RandomPassword(16)
		hash, err := auth.HashPassword(tempPassword)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "PASSWORD_ERROR", "Failed to generate password")
			return
		}
		_, err = tx.ExecContext(r.Context(), `
			UPDATE users SET password_hash = ?, force_password_reset = 1, updated_at = ? WHERE id = ?
		`, hash, now, id)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "PASSWORD_RESET_FAILED", "Failed to reset password")
			return
		}
		response["temporaryPass"] = tempPassword
	}

	if err := tx.Commit(); err != nil {
		writeError(w, http.StatusInternalServerError, "DB_ERROR", "Failed to commit user patch")
		return
	}

	s.audit(r.Context(), ctx.UserID, "users.patch", "user", id, input)
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "data": response})
}

func (s *Server) handleRolesList(w http.ResponseWriter, r *http.Request, ctx *authContext) {
	rows, err := s.Store.DB.QueryContext(r.Context(), `
		SELECT r.id, r.name, r.slug, r.description, r.is_system, r.enabled,
			COALESCE(GROUP_CONCAT(p.code), '') AS permission_codes,
			r.created_at, r.updated_at
		FROM roles r
		LEFT JOIN role_permissions rp ON rp.role_id = r.id
		LEFT JOIN permissions p ON p.id = rp.permission_id
		GROUP BY r.id
		ORDER BY r.created_at ASC
	`)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "DB_ERROR", "Failed to list roles")
		return
	}
	defer rows.Close()

	roles := []map[string]any{}
	for rows.Next() {
		var id, name, slug, description, permissionCodes, createdAt, updatedAt string
		var isSystem, enabled int
		if err := rows.Scan(&id, &name, &slug, &description, &isSystem, &enabled, &permissionCodes, &createdAt, &updatedAt); err != nil {
			continue
		}
		codes := []string{}
		if strings.TrimSpace(permissionCodes) != "" {
			codes = strings.Split(permissionCodes, ",")
			sort.Strings(codes)
		}
		roles = append(roles, map[string]any{
			"id":              id,
			"name":            name,
			"slug":            slug,
			"description":     description,
			"isSystem":        isSystem == 1,
			"enabled":         enabled == 1,
			"permissionCodes": codes,
			"createdAt":       createdAt,
			"updatedAt":       updatedAt,
		})
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "data": roles})
	_ = ctx
}

func (s *Server) handleRolesCreate(w http.ResponseWriter, r *http.Request, ctx *authContext) {
	var input struct {
		Name            string   `json:"name"`
		Slug            string   `json:"slug"`
		Description     string   `json:"description"`
		PermissionCodes []string `json:"permissionCodes"`
	}
	if err := decodeJSON(r.Body, &input); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_BODY", err.Error())
		return
	}

	name := strings.TrimSpace(input.Name)
	if name == "" {
		writeError(w, http.StatusBadRequest, "INVALID_NAME", "Role name is required")
		return
	}
	slug := slugify(firstNonEmpty(input.Slug, input.Name), "role")
	id, _ := auth.RandomID("role")
	now := storage.NowISO()

	tx, err := s.Store.DB.BeginTx(r.Context(), nil)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "DB_ERROR", "Failed to start transaction")
		return
	}
	defer tx.Rollback()

	_, err = tx.ExecContext(r.Context(), `
		INSERT INTO roles (id, name, slug, description, is_system, enabled, created_at, updated_at)
		VALUES (?, ?, ?, ?, 0, 1, ?, ?)
	`, id, name, slug, strings.TrimSpace(input.Description), now, now)
	if err != nil {
		writeError(w, http.StatusBadRequest, "ROLE_CREATE_FAILED", "Role slug already exists")
		return
	}

	if err := s.replaceRolePermissionsTx(r.Context(), tx, id, input.PermissionCodes); err != nil {
		writeError(w, http.StatusBadRequest, "PERMISSION_UPDATE_FAILED", err.Error())
		return
	}

	if err := tx.Commit(); err != nil {
		writeError(w, http.StatusInternalServerError, "DB_ERROR", "Failed to commit role creation")
		return
	}

	s.audit(r.Context(), ctx.UserID, "roles.create", "role", id, input)
	writeJSON(w, http.StatusCreated, map[string]any{"ok": true, "data": map[string]any{"id": id, "slug": slug}})
}

func (s *Server) handleRolesPatch(w http.ResponseWriter, r *http.Request, ctx *authContext) {
	id := r.PathValue("id")
	if id == "" {
		writeError(w, http.StatusBadRequest, "INVALID_ID", "Role ID is required")
		return
	}

	var input struct {
		Name            *string  `json:"name"`
		Description     *string  `json:"description"`
		Enabled         *bool    `json:"enabled"`
		PermissionCodes []string `json:"permissionCodes"`
	}
	if err := decodeJSON(r.Body, &input); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_BODY", err.Error())
		return
	}

	isSystem := 0
	if err := s.Store.DB.QueryRowContext(r.Context(), `SELECT is_system FROM roles WHERE id = ?`, id).Scan(&isSystem); err != nil {
		writeError(w, http.StatusNotFound, "ROLE_NOT_FOUND", "Role not found")
		return
	}

	now := storage.NowISO()
	tx, err := s.Store.DB.BeginTx(r.Context(), nil)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "DB_ERROR", "Failed to start transaction")
		return
	}
	defer tx.Rollback()

	if input.Name != nil {
		_, err = tx.ExecContext(r.Context(), `UPDATE roles SET name = ?, updated_at = ? WHERE id = ?`, strings.TrimSpace(*input.Name), now, id)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "ROLE_UPDATE_FAILED", "Failed to update role name")
			return
		}
	}
	if input.Description != nil {
		_, err = tx.ExecContext(r.Context(), `UPDATE roles SET description = ?, updated_at = ? WHERE id = ?`, strings.TrimSpace(*input.Description), now, id)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "ROLE_UPDATE_FAILED", "Failed to update role description")
			return
		}
	}
	if input.Enabled != nil {
		_, err = tx.ExecContext(r.Context(), `UPDATE roles SET enabled = ?, updated_at = ? WHERE id = ?`, boolToInt(*input.Enabled), now, id)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "ROLE_UPDATE_FAILED", "Failed to update role status")
			return
		}
	}

	if input.PermissionCodes != nil {
		if isSystem == 1 {
			writeError(w, http.StatusBadRequest, "SYSTEM_ROLE_LOCKED", "System role permissions are locked")
			return
		}
		if err := s.replaceRolePermissionsTx(r.Context(), tx, id, input.PermissionCodes); err != nil {
			writeError(w, http.StatusBadRequest, "PERMISSION_UPDATE_FAILED", err.Error())
			return
		}
	}

	if err := tx.Commit(); err != nil {
		writeError(w, http.StatusInternalServerError, "DB_ERROR", "Failed to commit role patch")
		return
	}

	s.audit(r.Context(), ctx.UserID, "roles.patch", "role", id, input)
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (s *Server) handlePermissionsList(w http.ResponseWriter, r *http.Request, ctx *authContext) {
	rows, err := s.Store.DB.QueryContext(r.Context(), `SELECT id, code, name, description FROM permissions ORDER BY code ASC`)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "DB_ERROR", "Failed to list permissions")
		return
	}
	defer rows.Close()

	items := []map[string]any{}
	for rows.Next() {
		var id, code, name, description string
		if err := rows.Scan(&id, &code, &name, &description); err != nil {
			continue
		}
		items = append(items, map[string]any{"id": id, "code": code, "name": name, "description": description})
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "data": items})
	_ = ctx
}

func (s *Server) handleServicesList(w http.ResponseWriter, r *http.Request, ctx *authContext) {
	rows, err := s.Store.DB.QueryContext(r.Context(), `SELECT id, name, slug, upstream_url, route_prefix, health_path, upstream_auth_header, upstream_auth_value, internal_token, enabled, rpm_limit, monthly_quota, request_timeout_ms, last_validation_at, last_validation_status, last_validation_message, created_at, updated_at FROM services ORDER BY created_at DESC`)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "DB_ERROR", "Failed to list services")
		return
	}
	defer rows.Close()
	items := []map[string]any{}
	for rows.Next() {
		item, err := scanService(rows)
		if err == nil {
			items = append(items, item)
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "data": items})
	_ = ctx
}

func (s *Server) handleServicesCreate(w http.ResponseWriter, r *http.Request, ctx *authContext) {
	var input serviceInput
	if err := decodeJSON(r.Body, &input); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_BODY", err.Error())
		return
	}
	if strings.TrimSpace(input.Name) == "" {
		writeError(w, http.StatusBadRequest, "INVALID_NAME", "Service name is required")
		return
	}
	if strings.TrimSpace(input.UpstreamURL) == "" {
		writeError(w, http.StatusBadRequest, "INVALID_UPSTREAM", "Service upstream URL is required")
		return
	}
	routePrefix := normalizePathPrefix(input.RoutePrefix, "/"+slugify(input.Name, "service"))
	if routePrefix == "/" && !s.Cfg.AllowRootRoutePrefix {
		writeError(w, http.StatusBadRequest, "ROOT_ROUTE_DISABLED", "Route prefix '/' is disabled")
		return
	}
	if strings.HasPrefix(routePrefix, "/api/") {
		writeError(w, http.StatusBadRequest, "ROUTE_CONFLICT", "Route prefix conflicts with internal API")
		return
	}

	now := storage.NowISO()
	id, _ := auth.RandomID("svc")
	slug := slugify(firstNonEmpty(input.Slug, input.Name), "service")

	_, err := s.Store.DB.ExecContext(r.Context(), `
		INSERT INTO services (
			id, name, slug, upstream_url, route_prefix, health_path,
			upstream_auth_header, upstream_auth_value, internal_token,
			enabled, rpm_limit, monthly_quota, request_timeout_ms,
			created_at, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`,
		id,
		strings.TrimSpace(input.Name),
		slug,
		strings.TrimSpace(input.UpstreamURL),
		routePrefix,
		normalizePathPrefix(input.HealthPath, "/health"),
		nullIfEmpty(input.UpstreamAuthHeader),
		nullIfEmpty(input.UpstreamAuthValue),
		nullIfEmpty(input.InternalToken),
		boolToInt(defaultBool(input.Enabled, true)),
		nullInt(input.RPMLimit),
		nullInt(input.MonthlyQuota),
		nullInt(input.RequestTimeoutMS),
		now,
		now,
	)
	if err != nil {
		writeError(w, http.StatusBadRequest, "SERVICE_CREATE_FAILED", "Service slug or route already exists")
		return
	}

	s.audit(r.Context(), ctx.UserID, "services.create", "service", id, input)
	writeJSON(w, http.StatusCreated, map[string]any{"ok": true, "data": map[string]any{"id": id, "slug": slug}})
}

func (s *Server) handleServicesPatch(w http.ResponseWriter, r *http.Request, ctx *authContext) {
	id := r.PathValue("id")
	if id == "" {
		writeError(w, http.StatusBadRequest, "INVALID_ID", "Service ID is required")
		return
	}

	current, err := s.getServiceByID(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusNotFound, "SERVICE_NOT_FOUND", "Service not found")
		return
	}

	var patch serviceInput
	if err := decodeJSON(r.Body, &patch); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_BODY", err.Error())
		return
	}

	name := firstNonEmpty(patch.Name, asString(current["name"]))
	routePrefix := normalizePathPrefix(firstNonEmpty(patch.RoutePrefix, asString(current["routePrefix"])), "/")
	if routePrefix == "/" && !s.Cfg.AllowRootRoutePrefix {
		writeError(w, http.StatusBadRequest, "ROOT_ROUTE_DISABLED", "Route prefix '/' is disabled")
		return
	}

	_, err = s.Store.DB.ExecContext(r.Context(), `
		UPDATE services SET
		name = ?, slug = ?, upstream_url = ?, route_prefix = ?, health_path = ?,
		upstream_auth_header = ?, upstream_auth_value = ?, internal_token = ?, enabled = ?,
		rpm_limit = ?, monthly_quota = ?, request_timeout_ms = ?, updated_at = ?
		WHERE id = ?
	`,
		name,
		slugify(firstNonEmpty(patch.Slug, asString(current["slug"])), "service"),
		firstNonEmpty(patch.UpstreamURL, asString(current["upstreamUrl"])),
		routePrefix,
		normalizePathPrefix(firstNonEmpty(patch.HealthPath, asString(current["healthPath"])), "/health"),
		nullIfEmpty(firstNonEmpty(patch.UpstreamAuthHeader, asString(current["upstreamAuthHeader"]))),
		nullIfEmpty(firstNonEmpty(patch.UpstreamAuthValue, asString(current["upstreamAuthValue"]))),
		nullIfEmpty(firstNonEmpty(patch.InternalToken, asString(current["internalToken"]))),
		boolToInt(defaultBool(patch.Enabled, asBool(current["enabled"]))),
		nullInt(patch.RPMLimitOr(current["rpmLimit"])),
		nullInt(patch.MonthlyQuotaOr(current["monthlyQuota"])),
		nullInt(patch.TimeoutOr(current["requestTimeoutMs"])),
		storage.NowISO(),
		id,
	)
	if err != nil {
		writeError(w, http.StatusBadRequest, "SERVICE_UPDATE_FAILED", "Failed to update service")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
	_ = ctx
}

func (s *Server) handleServicesValidate(w http.ResponseWriter, r *http.Request, ctx *authContext) {
	id := r.PathValue("id")
	service, err := s.getServiceByID(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusNotFound, "SERVICE_NOT_FOUND", "Service not found")
		return
	}

	timeoutMS := intFromAny(service["requestTimeoutMs"], int(s.Cfg.DefaultServiceTimeout.Milliseconds()))
	client := &http.Client{Timeout: time.Duration(timeoutMS) * time.Millisecond}
	target := strings.TrimRight(asString(service["upstreamUrl"]), "/") + normalizePathPrefix(asString(service["healthPath"]), "/health")

	req, _ := http.NewRequestWithContext(r.Context(), http.MethodGet, target, nil)
	if header := asString(service["upstreamAuthHeader"]); header != "" {
		req.Header.Set(header, asString(service["upstreamAuthValue"]))
	}
	if token := asString(service["internalToken"]); token != "" {
		req.Header.Set(s.Cfg.ServiceTokenHeader, token)
	}
	res, err := client.Do(req)
	status := 0
	message := ""
	ok := false
	if err != nil {
		status = http.StatusBadGateway
		message = err.Error()
	} else {
		defer res.Body.Close()
		status = res.StatusCode
		message = fmt.Sprintf("HTTP %d", res.StatusCode)
		ok = res.StatusCode >= 200 && res.StatusCode < 300
	}

	validationStatus := "failed"
	if ok {
		validationStatus = "healthy"
	}

	_, _ = s.Store.DB.ExecContext(r.Context(), `
		UPDATE services
		SET last_validation_at = ?, last_validation_status = ?, last_validation_message = ?, updated_at = ?
		WHERE id = ?
	`, storage.NowISO(), validationStatus, message, storage.NowISO(), id)

	if !ok {
		s.logIncident(r.Context(), sql.NullString{String: id, Valid: true}, sql.NullString{}, "SERVICE_VALIDATION_FAILED", message, "medium", sql.NullInt64{Int64: int64(status), Valid: true})
	}

	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "validation": map[string]any{"ok": ok, "status": status, "message": message}})
	_ = ctx
}

func (s *Server) handleDatabasesList(w http.ResponseWriter, r *http.Request, ctx *authContext) {
	rows, err := s.Store.DB.QueryContext(r.Context(), `
		SELECT id, name, slug, provider, connection_url, enabled, last_validation_at, last_validation_status, last_validation_message, created_at, updated_at
		FROM database_connections
		ORDER BY created_at DESC
	`)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "DB_ERROR", "Failed to list database connections")
		return
	}
	defer rows.Close()

	items := []map[string]any{}
	for rows.Next() {
		var id, name, slug, provider, connURL, createdAt, updatedAt string
		var enabled int
		var lastAt, lastStatus, lastMessage sql.NullString
		if err := rows.Scan(&id, &name, &slug, &provider, &connURL, &enabled, &lastAt, &lastStatus, &lastMessage, &createdAt, &updatedAt); err != nil {
			continue
		}
		items = append(items, map[string]any{
			"id":                    id,
			"name":                  name,
			"slug":                  slug,
			"provider":              provider,
			"target":                extractDatabaseTarget(provider, connURL),
			"maskedConnectionUrl":   maskDatabaseURL(provider, connURL),
			"enabled":               enabled == 1,
			"lastValidationAt":      nullString(lastAt),
			"lastValidationStatus":  nullString(lastStatus),
			"lastValidationMessage": nullString(lastMessage),
			"createdAt":             createdAt,
			"updatedAt":             updatedAt,
		})
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "data": items})
	_ = ctx
}

func (s *Server) handleDatabasesCreate(w http.ResponseWriter, r *http.Request, ctx *authContext) {
	var input struct {
		Name          string `json:"name"`
		Slug          string `json:"slug"`
		Provider      string `json:"provider"`
		ConnectionURL string `json:"connectionUrl"`
		Enabled       *bool  `json:"enabled"`
	}
	if err := decodeJSON(r.Body, &input); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_BODY", err.Error())
		return
	}

	provider := normalizeProvider(input.Provider)
	if provider == "" {
		writeError(w, http.StatusBadRequest, "INVALID_PROVIDER", "Provider must be sqlite, postgres, or mysql")
		return
	}
	if strings.TrimSpace(input.ConnectionURL) == "" {
		writeError(w, http.StatusBadRequest, "INVALID_CONNECTION", "Connection URL is required")
		return
	}

	now := storage.NowISO()
	id, _ := auth.RandomID("dbc")
	slug := slugify(firstNonEmpty(input.Slug, input.Name+"-"+provider), "database")

	_, err := s.Store.DB.ExecContext(r.Context(), `
		INSERT INTO database_connections (id, name, slug, provider, connection_url, enabled, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
	`, id, strings.TrimSpace(input.Name), slug, provider, strings.TrimSpace(input.ConnectionURL), boolToInt(defaultBool(input.Enabled, true)), now, now)
	if err != nil {
		writeError(w, http.StatusBadRequest, "DATABASE_CREATE_FAILED", "Database connection slug already exists")
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"ok": true, "data": map[string]any{"id": id, "slug": slug}})
	_ = ctx
}

func (s *Server) handleDatabasesPatch(w http.ResponseWriter, r *http.Request, ctx *authContext) {
	id := r.PathValue("id")
	if id == "" {
		writeError(w, http.StatusBadRequest, "INVALID_ID", "Database connection ID is required")
		return
	}

	var input struct {
		Name          *string `json:"name"`
		Slug          *string `json:"slug"`
		Provider      *string `json:"provider"`
		ConnectionURL *string `json:"connectionUrl"`
		Enabled       *bool   `json:"enabled"`
	}
	if err := decodeJSON(r.Body, &input); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_BODY", err.Error())
		return
	}

	current, err := s.getDatabaseByID(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusNotFound, "DATABASE_NOT_FOUND", "Database connection not found")
		return
	}

	provider := asString(current["provider"])
	if input.Provider != nil {
		norm := normalizeProvider(*input.Provider)
		if norm == "" {
			writeError(w, http.StatusBadRequest, "INVALID_PROVIDER", "Provider must be sqlite, postgres, or mysql")
			return
		}
		provider = norm
	}

	_, err = s.Store.DB.ExecContext(r.Context(), `
		UPDATE database_connections
		SET name = ?, slug = ?, provider = ?, connection_url = ?, enabled = ?, updated_at = ?
		WHERE id = ?
	`,
		firstNonEmptyPtr(input.Name, asString(current["name"])),
		slugify(firstNonEmptyPtr(input.Slug, asString(current["slug"])), "database"),
		provider,
		firstNonEmptyPtr(input.ConnectionURL, asString(current["connectionUrl"])),
		boolToInt(defaultBool(input.Enabled, asBool(current["enabled"]))),
		storage.NowISO(),
		id,
	)
	if err != nil {
		writeError(w, http.StatusBadRequest, "DATABASE_UPDATE_FAILED", "Failed to update database connection")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
	_ = ctx
}

func (s *Server) handleDatabasesValidate(w http.ResponseWriter, r *http.Request, ctx *authContext) {
	id := r.PathValue("id")
	database, err := s.getDatabaseByID(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusNotFound, "DATABASE_NOT_FOUND", "Database connection not found")
		return
	}

	provider := asString(database["provider"])
	connectionURL := asString(database["connectionUrl"])
	ok, status, message := s.validateDatabaseConnection(r.Context(), provider, connectionURL)
	state := "failed"
	if ok {
		state = "healthy"
	}
	_, _ = s.Store.DB.ExecContext(r.Context(), `
		UPDATE database_connections
		SET last_validation_at = ?, last_validation_status = ?, last_validation_message = ?, updated_at = ?
		WHERE id = ?
	`, storage.NowISO(), state, message, storage.NowISO(), id)

	if !ok {
		s.logIncident(r.Context(), sql.NullString{}, sql.NullString{}, "DATABASE_VALIDATION_FAILED", message, "medium", sql.NullInt64{Int64: int64(status), Valid: true})
	}

	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "validation": map[string]any{"ok": ok, "status": status, "message": message}})
	_ = ctx
}

func (s *Server) handleKeysList(w http.ResponseWriter, r *http.Request, ctx *authContext) {
	rows, err := s.Store.DB.QueryContext(r.Context(), `
		SELECT id, name, key_prefix, plan, allowed_service_ids, enabled, rpm_limit, monthly_quota, created_at, updated_at, last_used_at
		FROM api_keys
		ORDER BY created_at DESC
	`)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "DB_ERROR", "Failed to list API keys")
		return
	}
	defer rows.Close()

	items := []map[string]any{}
	for rows.Next() {
		var id, name, keyPrefix, plan, allowed, createdAt, updatedAt string
		var enabled int
		var rpm, monthly sql.NullInt64
		var lastUsed sql.NullString
		if err := rows.Scan(&id, &name, &keyPrefix, &plan, &allowed, &enabled, &rpm, &monthly, &createdAt, &updatedAt, &lastUsed); err != nil {
			continue
		}
		allowedServices := []string{}
		_ = json.Unmarshal([]byte(allowed), &allowedServices)
		items = append(items, map[string]any{
			"id":                id,
			"name":              name,
			"keyPrefix":         keyPrefix,
			"plan":              plan,
			"allowedServiceIds": allowedServices,
			"enabled":           enabled == 1,
			"rpmLimit":          nullIntValue(rpm),
			"monthlyQuota":      nullIntValue(monthly),
			"createdAt":         createdAt,
			"updatedAt":         updatedAt,
			"lastUsedAt":        nullString(lastUsed),
		})
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "data": items})
	_ = ctx
}

func (s *Server) handleKeysCreate(w http.ResponseWriter, r *http.Request, ctx *authContext) {
	var input struct {
		Name              string   `json:"name"`
		Plan              string   `json:"plan"`
		AllowedServiceIDs []string `json:"allowedServiceIds"`
		RPMLimit          *int     `json:"rpmLimit"`
		MonthlyQuota      *int     `json:"monthlyQuota"`
		Enabled           *bool    `json:"enabled"`
	}
	if err := decodeJSON(r.Body, &input); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_BODY", err.Error())
		return
	}
	name := strings.TrimSpace(input.Name)
	if name == "" {
		writeError(w, http.StatusBadRequest, "INVALID_NAME", "API key name is required")
		return
	}
	plan := strings.ToLower(strings.TrimSpace(firstNonEmpty(input.Plan, "pro")))
	rpmLimit, monthlyQuota := s.planDefaults(plan)
	if input.RPMLimit != nil {
		rpmLimit = input.RPMLimit
	}
	if input.MonthlyQuota != nil {
		monthlyQuota = input.MonthlyQuota
	}

	rawKey, _ := auth.RandomToken(28)
	rawKey = "apy_" + rawKey
	keyHash := auth.HashToken(rawKey)
	id, _ := auth.RandomID("key")
	now := storage.NowISO()

	_, err := s.Store.DB.ExecContext(r.Context(), `
		INSERT INTO api_keys (id, name, key_hash, key_prefix, plan, allowed_service_ids, enabled, rpm_limit, monthly_quota, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`,
		id,
		name,
		keyHash,
		rawKey[:12],
		plan,
		mustJSON(input.AllowedServiceIDs),
		boolToInt(defaultBool(input.Enabled, true)),
		nullInt(rpmLimit),
		nullInt(monthlyQuota),
		now,
		now,
	)
	if err != nil {
		writeError(w, http.StatusBadRequest, "KEY_CREATE_FAILED", "Failed to create API key")
		return
	}

	writeJSON(w, http.StatusCreated, map[string]any{
		"ok": true,
		"data": map[string]any{
			"key":  rawKey,
			"item": map[string]any{"id": id, "name": name, "plan": plan},
		},
	})
	_ = ctx
}

func (s *Server) handleKeysPatch(w http.ResponseWriter, r *http.Request, ctx *authContext) {
	id := r.PathValue("id")
	if id == "" {
		writeError(w, http.StatusBadRequest, "INVALID_ID", "API key ID is required")
		return
	}
	var input struct {
		Name              *string  `json:"name"`
		Plan              *string  `json:"plan"`
		AllowedServiceIDs []string `json:"allowedServiceIds"`
		RPMLimit          *int     `json:"rpmLimit"`
		MonthlyQuota      *int     `json:"monthlyQuota"`
		Enabled           *bool    `json:"enabled"`
	}
	if err := decodeJSON(r.Body, &input); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_BODY", err.Error())
		return
	}

	current := struct {
		Name    string
		Plan    string
		Allowed string
		Enabled int
		RPM     sql.NullInt64
		Monthly sql.NullInt64
	}{}
	err := s.Store.DB.QueryRowContext(r.Context(), `
		SELECT name, plan, allowed_service_ids, enabled, rpm_limit, monthly_quota
		FROM api_keys WHERE id = ?
	`, id).Scan(&current.Name, &current.Plan, &current.Allowed, &current.Enabled, &current.RPM, &current.Monthly)
	if err != nil {
		writeError(w, http.StatusNotFound, "KEY_NOT_FOUND", "API key not found")
		return
	}

	plan := current.Plan
	if input.Plan != nil {
		plan = strings.ToLower(strings.TrimSpace(*input.Plan))
	}

	allowed := current.Allowed
	if input.AllowedServiceIDs != nil {
		allowed = mustJSON(input.AllowedServiceIDs)
	}

	_, err = s.Store.DB.ExecContext(r.Context(), `
		UPDATE api_keys
		SET name = ?, plan = ?, allowed_service_ids = ?, enabled = ?, rpm_limit = ?, monthly_quota = ?, updated_at = ?
		WHERE id = ?
	`,
		firstNonEmptyPtr(input.Name, current.Name),
		plan,
		allowed,
		boolToInt(defaultBool(input.Enabled, current.Enabled == 1)),
		nullInt(coalesceIntPtr(input.RPMLimit, nullIntValue(current.RPM))),
		nullInt(coalesceIntPtr(input.MonthlyQuota, nullIntValue(current.Monthly))),
		storage.NowISO(),
		id,
	)
	if err != nil {
		writeError(w, http.StatusBadRequest, "KEY_UPDATE_FAILED", "Failed to update API key")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
	_ = ctx
}

func (s *Server) handleAnalyticsOps(w http.ResponseWriter, r *http.Request, ctx *authContext) {
	counts := map[string]int{}
	for _, table := range []string{"users", "services", "database_connections", "api_keys"} {
		var count int
		_ = s.Store.DB.QueryRowContext(r.Context(), `SELECT COUNT(*) FROM `+table).Scan(&count)
		counts[table] = count
	}

	period := time.Now().UTC().Format("2006-01")
	var monthlyRequests int
	_ = s.Store.DB.QueryRowContext(r.Context(), `SELECT COALESCE(SUM(request_count), 0) FROM usage_counters WHERE period_month = ?`, period).Scan(&monthlyRequests)

	severityRows, _ := s.Store.DB.QueryContext(r.Context(), `
		SELECT severity, COUNT(*) FROM incident_events
		WHERE occurred_at >= datetime('now', '-24 hours')
		GROUP BY severity
	`)
	incidentsBySeverity := map[string]int{}
	if severityRows != nil {
		defer severityRows.Close()
		for severityRows.Next() {
			var severity string
			var count int
			if err := severityRows.Scan(&severity, &count); err == nil {
				incidentsBySeverity[severity] = count
			}
		}
	}

	healthRows, _ := s.Store.DB.QueryContext(r.Context(), `
		SELECT COALESCE(last_validation_status, 'unknown') AS status, COUNT(*)
		FROM services
		GROUP BY status
	`)
	healthCounts := map[string]int{}
	if healthRows != nil {
		defer healthRows.Close()
		for healthRows.Next() {
			var status string
			var count int
			if err := healthRows.Scan(&status, &count); err == nil {
				healthCounts[status] = count
			}
		}
	}

	tsRows, _ := s.Store.DB.QueryContext(r.Context(), `
		SELECT strftime('%Y-%m-%dT%H:00:00Z', occurred_at) AS bucket, COUNT(*)
		FROM metrics_timeseries
		WHERE metric = 'request_total' AND occurred_at >= datetime('now', '-24 hours')
		GROUP BY bucket
		ORDER BY bucket ASC
	`)
	hourly := []map[string]any{}
	if tsRows != nil {
		defer tsRows.Close()
		for tsRows.Next() {
			var bucket string
			var count int
			if err := tsRows.Scan(&bucket, &count); err == nil {
				hourly = append(hourly, map[string]any{"bucket": bucket, "value": count})
			}
		}
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"ok": true,
		"data": map[string]any{
			"counts": map[string]any{
				"users":     counts["users"],
				"services":  counts["services"],
				"databases": counts["database_connections"],
				"keys":      counts["api_keys"],
			},
			"requests": map[string]any{
				"period": period,
				"total":  monthlyRequests,
				"hourly": hourly,
			},
			"incidentsBySeverity": incidentsBySeverity,
			"serviceHealth":       healthCounts,
		},
	})
	_ = ctx
}

func (s *Server) handleAnalyticsTraffic(w http.ResponseWriter, r *http.Request, ctx *authContext) {
	from := time.Now().Add(-7 * 24 * time.Hour)
	to := time.Now()
	if value := strings.TrimSpace(r.URL.Query().Get("from")); value != "" {
		if parsed, err := time.Parse(time.RFC3339, value); err == nil {
			from = parsed
		}
	}
	if value := strings.TrimSpace(r.URL.Query().Get("to")); value != "" {
		if parsed, err := time.Parse(time.RFC3339, value); err == nil {
			to = parsed
		}
	}

	traffic, err := s.Umami.FetchTraffic(r.Context(), from, to)
	if err == nil {
		_, _ = s.Store.DB.ExecContext(r.Context(), `
			INSERT INTO umami_sync_cache (cache_key, payload_json, updated_at)
			VALUES ('traffic', ?, ?)
			ON CONFLICT(cache_key) DO UPDATE SET payload_json = excluded.payload_json, updated_at = excluded.updated_at
		`, mustJSON(traffic), storage.NowISO())
	} else {
		var payload string
		_ = s.Store.DB.QueryRowContext(r.Context(), `SELECT payload_json FROM umami_sync_cache WHERE cache_key = 'traffic'`).Scan(&payload)
		if payload != "" {
			_ = json.Unmarshal([]byte(payload), &traffic)
		}
		if traffic == nil {
			traffic = map[string]any{"enabled": false, "error": err.Error()}
		}
	}

	eventRows, _ := s.Store.DB.QueryContext(r.Context(), `
		SELECT COALESCE(json_extract(labels_json, '$.path'), 'unknown') AS path, COUNT(*)
		FROM metrics_timeseries
		WHERE metric = 'client_event' AND occurred_at >= datetime('now', '-7 days')
		GROUP BY path
		ORDER BY COUNT(*) DESC
		LIMIT 20
	`)
	events := []map[string]any{}
	if eventRows != nil {
		defer eventRows.Close()
		for eventRows.Next() {
			var page string
			var count int
			if err := eventRows.Scan(&page, &count); err == nil {
				events = append(events, map[string]any{"path": page, "count": count})
			}
		}
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"ok": true,
		"data": map[string]any{
			"umami":        traffic,
			"clientEvents": events,
		},
	})
	_ = ctx
}

func (s *Server) handleAnalyticsEvents(w http.ResponseWriter, r *http.Request, ctx *authContext) {
	var input struct {
		Event string         `json:"event"`
		Path  string         `json:"path"`
		Meta  map[string]any `json:"meta"`
	}
	if err := decodeJSON(r.Body, &input); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_BODY", err.Error())
		return
	}
	labels := map[string]any{
		"event": firstNonEmpty(input.Event, "event"),
		"path":  firstNonEmpty(input.Path, "unknown"),
		"meta":  input.Meta,
	}
	_ = s.logMetric("client_event", 1, labels)
	writeJSON(w, http.StatusCreated, map[string]any{"ok": true})
	_ = ctx
}

func (s *Server) handleGatewayOrUI(w http.ResponseWriter, r *http.Request) {
	if strings.HasPrefix(r.URL.Path, "/api/") {
		writeError(w, http.StatusNotFound, "NOT_FOUND", "Route not found")
		return
	}

	uiBasePath := normalizePathPrefix(s.Cfg.DashboardUIBasePath, "/")
	uiRequestPath, uiPathMatched := webPathForRequest(r.URL.Path, uiBasePath)
	if uiBasePath != "/" && uiPathMatched {
		s.serveWeb(w, uiRequestPath)
		return
	}

	service, ok := s.matchService(r.Context(), r.URL.Path)
	if ok {
		s.handleProxy(w, r, service)
		return
	}

	if uiBasePath == "/" {
		s.serveWeb(w, uiRequestPath)
		return
	}

	writeError(w, http.StatusNotFound, "NOT_FOUND", "Route not found")
}

func (s *Server) serveWeb(w http.ResponseWriter, requestPath string) {
	sub, err := fs.Sub(staticFS, "static")
	if err != nil {
		writeError(w, http.StatusNotFound, "FRONTEND_NOT_BUILT", "Frontend build is not available")
		return
	}

	reqPath := strings.TrimPrefix(path.Clean("/"+strings.TrimSpace(requestPath)), "/")
	if reqPath == "." {
		reqPath = ""
	}
	if reqPath == "" {
		reqPath = "index.html"
	}
	if _, err := fs.Stat(sub, reqPath); err != nil {
		reqPath = "index.html"
	}

	data, err := fs.ReadFile(sub, reqPath)
	if err != nil {
		writeError(w, http.StatusNotFound, "FRONTEND_NOT_BUILT", "Frontend build is not available")
		return
	}

	if contentType := mime.TypeByExtension(path.Ext(reqPath)); contentType != "" {
		w.Header().Set("Content-Type", contentType)
	}
	_, _ = w.Write(data)
}

func (s *Server) handleProxy(w http.ResponseWriter, r *http.Request, service map[string]any) {
	secret := strings.TrimSpace(r.Header.Get(s.Cfg.APIKeyHeader))
	if secret == "" {
		writeError(w, http.StatusUnauthorized, "API_KEY_MISSING", fmt.Sprintf("Missing API key header '%s'", s.Cfg.APIKeyHeader))
		return
	}

	apiKey, err := s.getAPIKeyBySecret(r.Context(), secret)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "API_KEY_INVALID", "Invalid API key")
		_ = s.logIncident(r.Context(), nullStringValue(service["id"]), sql.NullString{}, "API_KEY_INVALID", "Invalid API key", "medium", sql.NullInt64{Int64: 401, Valid: true})
		return
	}
	if !asBool(apiKey["enabled"]) {
		writeError(w, http.StatusForbidden, "API_KEY_DISABLED", "API key is disabled")
		return
	}
	if !asBool(service["enabled"]) {
		writeError(w, http.StatusServiceUnavailable, "SERVICE_DISABLED", "Service is disabled")
		return
	}

	if !serviceAllowed(apiKey, asString(service["id"]), asString(service["slug"]), asString(service["routePrefix"])) {
		writeError(w, http.StatusForbidden, "SERVICE_SCOPE_DENIED", "API key is not allowed for this service")
		_ = s.logIncident(r.Context(), nullStringValue(service["id"]), nullStringValue(apiKey["id"]), "SERVICE_SCOPE_DENIED", "API key attempted unauthorized service access", "medium", sql.NullInt64{Int64: 403, Valid: true})
		return
	}

	period := time.Now().UTC().Format("2006-01")
	serviceLimitRPM := nullIntValueFromAny(service["rpmLimit"])
	keyLimitRPM := nullIntValueFromAny(apiKey["rpmLimit"])
	serviceLimitMonthly := nullIntValueFromAny(service["monthlyQuota"])
	keyLimitMonthly := nullIntValueFromAny(apiKey["monthlyQuota"])

	effectiveRPM := minPositive(serviceLimitRPM, keyLimitRPM)
	effectiveMonthly := minPositive(serviceLimitMonthly, keyLimitMonthly)

	if effectiveMonthly != nil {
		used := s.usageCount(r.Context(), asString(apiKey["id"]), asString(service["id"]), period)
		if used >= *effectiveMonthly {
			writeError(w, http.StatusTooManyRequests, "MONTHLY_QUOTA_EXCEEDED", "Monthly quota exceeded")
			_ = s.logIncident(r.Context(), nullStringValue(service["id"]), nullStringValue(apiKey["id"]), "MONTHLY_QUOTA_EXCEEDED", "Monthly quota exceeded", "high", sql.NullInt64{Int64: 429, Valid: true})
			return
		}
	}

	if effectiveRPM != nil {
		if ok, retryAfter := s.allowRPM(asString(apiKey["id"])+":"+asString(service["id"]), *effectiveRPM); !ok {
			w.Header().Set("Retry-After", strconv.Itoa(retryAfter))
			writeError(w, http.StatusTooManyRequests, "RATE_LIMIT_EXCEEDED", "Rate limit exceeded")
			_ = s.logIncident(r.Context(), nullStringValue(service["id"]), nullStringValue(apiKey["id"]), "RATE_LIMIT_EXCEEDED", "Rate limit exceeded", "medium", sql.NullInt64{Int64: 429, Valid: true})
			return
		}
	}

	targetURL, err := gateway.BuildTargetURL(asString(service["upstreamUrl"]), asString(service["routePrefix"]), r.URL.Path, r.URL.RawQuery)
	if err != nil {
		writeError(w, http.StatusBadGateway, "UPSTREAM_INVALID", "Invalid upstream URL")
		return
	}

	headers := map[string]string{}
	if upstreamHeader := asString(service["upstreamAuthHeader"]); upstreamHeader != "" {
		headers[upstreamHeader] = asString(service["upstreamAuthValue"])
	}
	if token := asString(service["internalToken"]); token != "" {
		headers[s.Cfg.ServiceTokenHeader] = token
	}

	r.Header.Del(s.Cfg.APIKeyHeader)

	timeout := time.Duration(intFromAny(service["requestTimeoutMs"], int(s.Cfg.DefaultServiceTimeout.Milliseconds()))) * time.Millisecond
	client := &http.Client{Timeout: timeout}

	statusCode, _, proxyErr := gateway.ProxyRequest(client, w, r, targetURL, headers)
	if proxyErr != nil {
		status := http.StatusBadGateway
		if errors.Is(proxyErr, context.DeadlineExceeded) || strings.Contains(strings.ToLower(proxyErr.Error()), "timeout") {
			status = http.StatusGatewayTimeout
		}
		writeError(w, status, "UPSTREAM_ERROR", proxyErr.Error())
		_ = s.logIncident(r.Context(), nullStringValue(service["id"]), nullStringValue(apiKey["id"]), "UPSTREAM_ERROR", proxyErr.Error(), "high", sql.NullInt64{Int64: int64(status), Valid: true})
		return
	}

	s.incrementUsage(r.Context(), asString(apiKey["id"]), asString(service["id"]), period)
	_, _ = s.Store.DB.ExecContext(r.Context(), `UPDATE api_keys SET last_used_at = ?, updated_at = ? WHERE id = ?`, storage.NowISO(), storage.NowISO(), asString(apiKey["id"]))
	_ = s.logMetric("request_total", 1, map[string]any{"service": asString(service["slug"]), "status": statusCode})

	if statusCode >= 500 {
		_ = s.logIncident(r.Context(), nullStringValue(service["id"]), nullStringValue(apiKey["id"]), "UPSTREAM_SERVER_ERROR", fmt.Sprintf("Upstream returned %d", statusCode), "high", sql.NullInt64{Int64: int64(statusCode), Valid: true})
	}
}

func (s *Server) resolveAuth(r *http.Request) (*authContext, error) {
	accessCookie, err := r.Cookie(s.Cfg.SessionAccessCookie)
	if err != nil || strings.TrimSpace(accessCookie.Value) == "" {
		return nil, errors.New("access cookie missing")
	}
	return s.resolveAuthFromTokenHash(r.Context(), auth.HashToken(accessCookie.Value))
}

func (s *Server) resolveAuthFromTokenHash(ctx context.Context, accessTokenHash string) (*authContext, error) {
	var user struct {
		ID                 string
		Email              string
		Enabled            int
		ForcePasswordReset int
		SessionID          string
	}
	err := s.Store.DB.QueryRowContext(ctx, `
		SELECT u.id, u.email, u.enabled, u.force_password_reset, sess.id
		FROM sessions sess
		JOIN users u ON u.id = sess.user_id
		WHERE sess.access_token_hash = ?
		  AND sess.revoked_at IS NULL
		  AND sess.access_expires_at > ?
	`, accessTokenHash, storage.NowISO()).Scan(&user.ID, &user.Email, &user.Enabled, &user.ForcePasswordReset, &user.SessionID)
	if err != nil {
		return nil, err
	}

	roles, permissions, err := s.userAccess(ctx, user.ID)
	if err != nil {
		return nil, err
	}

	return &authContext{
		UserID:             user.ID,
		Email:              user.Email,
		Enabled:            user.Enabled == 1,
		ForcePasswordReset: user.ForcePasswordReset == 1,
		Roles:              roles,
		Permissions:        permissions,
		SessionID:          user.SessionID,
	}, nil
}

func (s *Server) userAccess(ctx context.Context, userID string) ([]string, map[string]bool, error) {
	roles := []string{}
	roleRows, err := s.Store.DB.QueryContext(ctx, `
		SELECT r.slug
		FROM user_roles ur
		JOIN roles r ON r.id = ur.role_id
		WHERE ur.user_id = ? AND r.enabled = 1
	`, userID)
	if err != nil {
		return nil, nil, err
	}
	for roleRows.Next() {
		var slug string
		if err := roleRows.Scan(&slug); err == nil {
			roles = append(roles, slug)
		}
	}
	roleRows.Close()

	permissions := map[string]bool{}
	permRows, err := s.Store.DB.QueryContext(ctx, `
		SELECT DISTINCT p.code
		FROM user_roles ur
		JOIN role_permissions rp ON rp.role_id = ur.role_id
		JOIN permissions p ON p.id = rp.permission_id
		JOIN roles r ON r.id = ur.role_id
		WHERE ur.user_id = ? AND r.enabled = 1
	`, userID)
	if err != nil {
		return roles, permissions, err
	}
	for permRows.Next() {
		var code string
		if err := permRows.Scan(&code); err == nil {
			permissions[code] = true
		}
	}
	permRows.Close()

	return roles, permissions, nil
}

func (s *Server) createSession(ctx context.Context, userID string) (string, string, string, error) {
	sessionID, _ := auth.RandomID("ses")
	accessToken, _ := auth.RandomToken(32)
	refreshToken, _ := auth.RandomToken(48)
	accessHash := auth.HashToken(accessToken)
	refreshHash := auth.HashToken(refreshToken)

	now := storage.NowISO()
	accessExp := time.Now().Add(s.Cfg.AccessTokenTTL).UTC().Format(time.RFC3339)
	refreshExp := time.Now().Add(s.Cfg.RefreshTokenTTL).UTC().Format(time.RFC3339)

	_, err := s.Store.DB.ExecContext(ctx, `
		INSERT INTO sessions (id, user_id, access_token_hash, refresh_token_hash, access_expires_at, refresh_expires_at, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
	`, sessionID, userID, accessHash, refreshHash, accessExp, refreshExp, now, now)
	if err != nil {
		return "", "", "", err
	}

	return sessionID, accessToken, refreshToken, nil
}

func (s *Server) setAuthCookies(w http.ResponseWriter, accessToken, refreshToken string) {
	accessCookie := &http.Cookie{
		Name:     s.Cfg.SessionAccessCookie,
		Value:    accessToken,
		Path:     "/",
		HttpOnly: true,
		Secure:   s.Cfg.CookieSecure,
		SameSite: http.SameSiteLaxMode,
		Expires:  time.Now().Add(s.Cfg.AccessTokenTTL),
	}
	if s.Cfg.CookieDomain != "" {
		accessCookie.Domain = s.Cfg.CookieDomain
	}

	refreshCookie := &http.Cookie{
		Name:     s.Cfg.SessionRefreshCookie,
		Value:    refreshToken,
		Path:     "/",
		HttpOnly: true,
		Secure:   s.Cfg.CookieSecure,
		SameSite: http.SameSiteLaxMode,
		Expires:  time.Now().Add(s.Cfg.RefreshTokenTTL),
	}
	if s.Cfg.CookieDomain != "" {
		refreshCookie.Domain = s.Cfg.CookieDomain
	}

	http.SetCookie(w, accessCookie)
	http.SetCookie(w, refreshCookie)
}

func (s *Server) clearAuthCookies(w http.ResponseWriter) {
	expired := time.Unix(0, 0)
	for _, cookieName := range []string{s.Cfg.SessionAccessCookie, s.Cfg.SessionRefreshCookie} {
		cookie := &http.Cookie{
			Name:     cookieName,
			Value:    "",
			Path:     "/",
			HttpOnly: true,
			Secure:   s.Cfg.CookieSecure,
			SameSite: http.SameSiteLaxMode,
			Expires:  expired,
			MaxAge:   -1,
		}
		if s.Cfg.CookieDomain != "" {
			cookie.Domain = s.Cfg.CookieDomain
		}
		http.SetCookie(w, cookie)
	}
}

func (s *Server) hasUsers(ctx context.Context) bool {
	var count int
	_ = s.Store.DB.QueryRowContext(ctx, `SELECT COUNT(*) FROM users`).Scan(&count)
	return count > 0
}

func (s *Server) isLoginRateLimited(r *http.Request, email string) bool {
	key := r.RemoteAddr + ":" + email
	s.loginMu.Lock()
	defer s.loginMu.Unlock()
	entry := s.loginAttempts[key]
	now := time.Now()
	if now.Sub(entry.WindowStart) > 15*time.Minute {
		entry = loginWindow{WindowStart: now, Count: 0}
	}
	return entry.Count >= 10
}

func (s *Server) markLoginAttempt(r *http.Request, email string) {
	key := r.RemoteAddr + ":" + email
	s.loginMu.Lock()
	defer s.loginMu.Unlock()
	entry := s.loginAttempts[key]
	now := time.Now()
	if now.Sub(entry.WindowStart) > 15*time.Minute {
		entry = loginWindow{WindowStart: now, Count: 0}
	}
	entry.Count++
	s.loginAttempts[key] = entry
}

func (s *Server) clearLoginAttempts(r *http.Request, email string) {
	key := r.RemoteAddr + ":" + email
	s.loginMu.Lock()
	defer s.loginMu.Unlock()
	delete(s.loginAttempts, key)
}

func (s *Server) resolveRoleIDs(ctx context.Context, roleIDs []string, roleSlugs []string) ([]string, error) {
	resolved := []string{}
	if len(roleIDs) > 0 {
		for _, roleID := range roleIDs {
			id := strings.TrimSpace(roleID)
			if id == "" {
				continue
			}
			var exists int
			if err := s.Store.DB.QueryRowContext(ctx, `SELECT COUNT(*) FROM roles WHERE id = ?`, id).Scan(&exists); err != nil || exists == 0 {
				return nil, fmt.Errorf("role %s not found", id)
			}
			resolved = append(resolved, id)
		}
		return uniqueStrings(resolved), nil
	}
	for _, slug := range roleSlugs {
		id, err := s.roleIDBySlug(ctx, slug)
		if err != nil {
			return nil, err
		}
		resolved = append(resolved, id)
	}
	return uniqueStrings(resolved), nil
}

func (s *Server) roleIDBySlug(ctx context.Context, slug string) (string, error) {
	id := ""
	err := s.Store.DB.QueryRowContext(ctx, `SELECT id FROM roles WHERE slug = ?`, strings.ToLower(strings.TrimSpace(slug))).Scan(&id)
	if err != nil {
		return "", fmt.Errorf("role %s not found", slug)
	}
	return id, nil
}

func (s *Server) replaceRolePermissionsTx(ctx context.Context, tx *sql.Tx, roleID string, permissionCodes []string) error {
	if _, err := tx.ExecContext(ctx, `DELETE FROM role_permissions WHERE role_id = ?`, roleID); err != nil {
		return err
	}
	now := storage.NowISO()
	for _, code := range permissionCodes {
		permCode := strings.TrimSpace(code)
		if permCode == "" {
			continue
		}
		permID := ""
		if err := tx.QueryRowContext(ctx, `SELECT id FROM permissions WHERE code = ?`, permCode).Scan(&permID); err != nil {
			return fmt.Errorf("permission not found: %s", permCode)
		}
		if _, err := tx.ExecContext(ctx, `INSERT INTO role_permissions (role_id, permission_id, created_at) VALUES (?, ?, ?)`, roleID, permID, now); err != nil {
			return err
		}
	}
	return nil
}

func (s *Server) getServiceByID(ctx context.Context, id string) (map[string]any, error) {
	row := s.Store.DB.QueryRowContext(ctx, `
		SELECT id, name, slug, upstream_url, route_prefix, health_path, upstream_auth_header, upstream_auth_value, internal_token, enabled, rpm_limit, monthly_quota, request_timeout_ms, last_validation_at, last_validation_status, last_validation_message, created_at, updated_at
		FROM services WHERE id = ?
	`, id)
	return scanServiceRow(row)
}

func (s *Server) getDatabaseByID(ctx context.Context, id string) (map[string]any, error) {
	var item struct {
		ID, Name, Slug, Provider, ConnectionURL, CreatedAt, UpdatedAt string
		Enabled                                                       int
		LastAt, LastStatus, LastMessage                               sql.NullString
	}
	err := s.Store.DB.QueryRowContext(ctx, `
		SELECT id, name, slug, provider, connection_url, enabled, last_validation_at, last_validation_status, last_validation_message, created_at, updated_at
		FROM database_connections
		WHERE id = ?
	`, id).Scan(&item.ID, &item.Name, &item.Slug, &item.Provider, &item.ConnectionURL, &item.Enabled, &item.LastAt, &item.LastStatus, &item.LastMessage, &item.CreatedAt, &item.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return map[string]any{
		"id":                    item.ID,
		"name":                  item.Name,
		"slug":                  item.Slug,
		"provider":              item.Provider,
		"connectionUrl":         item.ConnectionURL,
		"target":                extractDatabaseTarget(item.Provider, item.ConnectionURL),
		"maskedConnectionUrl":   maskDatabaseURL(item.Provider, item.ConnectionURL),
		"enabled":               item.Enabled == 1,
		"lastValidationAt":      nullString(item.LastAt),
		"lastValidationStatus":  nullString(item.LastStatus),
		"lastValidationMessage": nullString(item.LastMessage),
		"createdAt":             item.CreatedAt,
		"updatedAt":             item.UpdatedAt,
	}, nil
}

func (s *Server) validateDatabaseConnection(ctx context.Context, provider, connectionURL string) (bool, int, string) {
	provider = normalizeProvider(provider)
	if provider == "" {
		return false, http.StatusBadRequest, "Unsupported database provider"
	}

	timeoutCtx, cancel := context.WithTimeout(ctx, s.Cfg.DefaultServiceTimeout)
	defer cancel()

	sqlDriver := ""
	driverConn := connectionURL
	switch provider {
	case "sqlite":
		sqlDriver = "sqlite"
		if !strings.HasPrefix(driverConn, "file:") && driverConn != ":memory:" {
			if abs, err := pathAbs(driverConn); err == nil {
				driverConn = "file:" + abs
			}
		}
	case "postgres":
		sqlDriver = "pgx"
	case "mysql":
		sqlDriver = "mysql"
	}

	db, err := sql.Open(sqlDriver, driverConn)
	if err != nil {
		return false, http.StatusBadGateway, err.Error()
	}
	defer db.Close()

	db.SetConnMaxLifetime(2 * time.Minute)
	db.SetMaxOpenConns(1)
	db.SetMaxIdleConns(1)

	if err := db.PingContext(timeoutCtx); err != nil {
		return false, http.StatusBadGateway, err.Error()
	}
	return true, http.StatusOK, fmt.Sprintf("%s connection validated", strings.Title(provider))
}

func (s *Server) getAPIKeyBySecret(ctx context.Context, secret string) (map[string]any, error) {
	hash := auth.HashToken(secret)
	var item struct {
		ID, Name, KeyPrefix, Plan, AllowedServiceIDs, CreatedAt, UpdatedAt string
		Enabled                                                            int
		RPMLimit, MonthlyQuota                                             sql.NullInt64
	}
	err := s.Store.DB.QueryRowContext(ctx, `
		SELECT id, name, key_prefix, plan, allowed_service_ids, enabled, rpm_limit, monthly_quota, created_at, updated_at
		FROM api_keys
		WHERE key_hash = ?
	`, hash).Scan(&item.ID, &item.Name, &item.KeyPrefix, &item.Plan, &item.AllowedServiceIDs, &item.Enabled, &item.RPMLimit, &item.MonthlyQuota, &item.CreatedAt, &item.UpdatedAt)
	if err != nil {
		return nil, err
	}
	allowed := []string{}
	_ = json.Unmarshal([]byte(item.AllowedServiceIDs), &allowed)
	return map[string]any{
		"id":                item.ID,
		"name":              item.Name,
		"keyPrefix":         item.KeyPrefix,
		"plan":              item.Plan,
		"allowedServiceIds": allowed,
		"enabled":           item.Enabled == 1,
		"rpmLimit":          nullIntValue(item.RPMLimit),
		"monthlyQuota":      nullIntValue(item.MonthlyQuota),
	}, nil
}

func (s *Server) planDefaults(plan string) (*int, *int) {
	p := strings.ToLower(strings.TrimSpace(plan))
	switch p {
	case "free":
		return intPtr(s.Cfg.FreeRPM), intPtr(s.Cfg.FreeMonthlyQuota)
	case "business":
		return intPtr(s.Cfg.BusinessRPM), intPtr(s.Cfg.BusinessMonthlyQuota)
	case "enterprise":
		return nil, nil
	default:
		return intPtr(s.Cfg.ProRPM), intPtr(s.Cfg.ProMonthlyQuota)
	}
}

func (s *Server) matchService(ctx context.Context, requestPath string) (map[string]any, bool) {
	rows, err := s.Store.DB.QueryContext(ctx, `
		SELECT id, name, slug, upstream_url, route_prefix, health_path, upstream_auth_header, upstream_auth_value, internal_token, enabled, rpm_limit, monthly_quota, request_timeout_ms, last_validation_at, last_validation_status, last_validation_message, created_at, updated_at
		FROM services
		WHERE enabled = 1
		ORDER BY LENGTH(route_prefix) DESC, route_prefix DESC
	`)
	if err != nil {
		return nil, false
	}
	defer rows.Close()

	for rows.Next() {
		item, err := scanService(rows)
		if err != nil {
			continue
		}
		prefix := asString(item["routePrefix"])
		if prefix == "/" || requestPath == prefix || strings.HasPrefix(requestPath, prefix+"/") {
			return item, true
		}
	}
	return nil, false
}

func (s *Server) usageCount(ctx context.Context, apiKeyID, serviceID, period string) int {
	var count int
	_ = s.Store.DB.QueryRowContext(ctx, `
		SELECT COALESCE(request_count, 0)
		FROM usage_counters
		WHERE api_key_id = ? AND service_id = ? AND period_month = ?
	`, apiKeyID, serviceID, period).Scan(&count)
	return count
}

func (s *Server) incrementUsage(ctx context.Context, apiKeyID, serviceID, period string) {
	_, _ = s.Store.DB.ExecContext(ctx, `
		INSERT INTO usage_counters (api_key_id, service_id, period_month, request_count, updated_at)
		VALUES (?, ?, ?, 1, ?)
		ON CONFLICT(api_key_id, service_id, period_month)
		DO UPDATE SET request_count = request_count + 1, updated_at = excluded.updated_at
	`, apiKeyID, serviceID, period, storage.NowISO())
}

func (s *Server) allowRPM(bucket string, limit int) (bool, int) {
	if limit <= 0 {
		return true, 0
	}
	now := time.Now().UTC()
	windowStart := now.Truncate(time.Minute)
	key := bucket + ":" + windowStart.Format(time.RFC3339)

	s.rpmMu.Lock()
	defer s.rpmMu.Unlock()

	for k, v := range s.rpmUsage {
		if now.Sub(v.WindowStart) > 2*time.Minute {
			delete(s.rpmUsage, k)
		}
	}

	entry := s.rpmUsage[key]
	if entry.WindowStart.IsZero() {
		entry.WindowStart = windowStart
	}
	if entry.Count >= limit {
		retry := int(windowStart.Add(time.Minute).Sub(now).Seconds())
		if retry < 1 {
			retry = 1
		}
		return false, retry
	}
	entry.Count++
	s.rpmUsage[key] = entry
	return true, 0
}

func (s *Server) logIncident(ctx context.Context, serviceID, apiKeyID sql.NullString, code, message, severity string, httpStatus sql.NullInt64) error {
	_, err := s.Store.DB.ExecContext(ctx, `
		INSERT INTO incident_events (service_id, api_key_id, code, message, severity, http_status, count, occurred_at)
		VALUES (?, ?, ?, ?, ?, ?, 1, ?)
	`, serviceID, apiKeyID, code, message, severity, httpStatus, storage.NowISO())
	return err
}

func (s *Server) logMetric(metric string, value float64, labels map[string]any) error {
	_, err := s.Store.DB.Exec(`
		INSERT INTO metrics_timeseries (metric, value, labels_json, occurred_at)
		VALUES (?, ?, ?, ?)
	`, metric, value, mustJSON(labels), storage.NowISO())
	return err
}

func (s *Server) audit(ctx context.Context, actorUserID, action, targetType, targetID string, payload any) {
	_, _ = s.Store.DB.ExecContext(ctx, `
		INSERT INTO audit_log (actor_user_id, action, target_type, target_id, payload_json, occurred_at)
		VALUES (?, ?, ?, ?, ?, ?)
	`, nullIfEmpty(actorUserID), action, nullIfEmpty(targetType), nullIfEmpty(targetID), mustJSON(payload), storage.NowISO())
}

func scanService(rows *sql.Rows) (map[string]any, error) {
	var id, name, slug, upstreamURL, routePrefix, healthPath, createdAt, updatedAt string
	var upstreamAuthHeader, upstreamAuthValue, internalToken, lastValidationAt, lastValidationStatus, lastValidationMessage sql.NullString
	var enabled int
	var rpmLimit, monthlyQuota, requestTimeoutMS sql.NullInt64
	if err := rows.Scan(
		&id, &name, &slug, &upstreamURL, &routePrefix, &healthPath, &upstreamAuthHeader, &upstreamAuthValue, &internalToken,
		&enabled, &rpmLimit, &monthlyQuota, &requestTimeoutMS,
		&lastValidationAt, &lastValidationStatus, &lastValidationMessage,
		&createdAt, &updatedAt,
	); err != nil {
		return nil, err
	}
	return map[string]any{
		"id":                    id,
		"name":                  name,
		"slug":                  slug,
		"upstreamUrl":           upstreamURL,
		"routePrefix":           routePrefix,
		"healthPath":            healthPath,
		"upstreamAuthHeader":    nullString(upstreamAuthHeader),
		"upstreamAuthValue":     nullString(upstreamAuthValue),
		"internalToken":         nullString(internalToken),
		"enabled":               enabled == 1,
		"rpmLimit":              nullIntValue(rpmLimit),
		"monthlyQuota":          nullIntValue(monthlyQuota),
		"requestTimeoutMs":      nullIntValue(requestTimeoutMS),
		"lastValidationAt":      nullString(upstreamOr(lastValidationAt, sql.NullString{})),
		"lastValidationStatus":  nullString(lastValidationStatus),
		"lastValidationMessage": nullString(lastValidationMessage),
		"createdAt":             createdAt,
		"updatedAt":             updatedAt,
	}, nil
}

func scanServiceRow(row *sql.Row) (map[string]any, error) {
	var id, name, slug, upstreamURL, routePrefix, healthPath, createdAt, updatedAt string
	var upstreamAuthHeader, upstreamAuthValue, internalToken, lastValidationAt, lastValidationStatus, lastValidationMessage sql.NullString
	var enabled int
	var rpmLimit, monthlyQuota, requestTimeoutMS sql.NullInt64
	if err := row.Scan(
		&id, &name, &slug, &upstreamURL, &routePrefix, &healthPath, &upstreamAuthHeader, &upstreamAuthValue, &internalToken,
		&enabled, &rpmLimit, &monthlyQuota, &requestTimeoutMS,
		&lastValidationAt, &lastValidationStatus, &lastValidationMessage,
		&createdAt, &updatedAt,
	); err != nil {
		return nil, err
	}
	return map[string]any{
		"id":                    id,
		"name":                  name,
		"slug":                  slug,
		"upstreamUrl":           upstreamURL,
		"routePrefix":           routePrefix,
		"healthPath":            healthPath,
		"upstreamAuthHeader":    nullString(upstreamAuthHeader),
		"upstreamAuthValue":     nullString(upstreamAuthValue),
		"internalToken":         nullString(internalToken),
		"enabled":               enabled == 1,
		"rpmLimit":              nullIntValue(rpmLimit),
		"monthlyQuota":          nullIntValue(monthlyQuota),
		"requestTimeoutMs":      nullIntValue(requestTimeoutMS),
		"lastValidationAt":      nullString(lastValidationAt),
		"lastValidationStatus":  nullString(lastValidationStatus),
		"lastValidationMessage": nullString(lastValidationMessage),
		"createdAt":             createdAt,
		"updatedAt":             updatedAt,
	}, nil
}

func serviceAllowed(apiKey map[string]any, serviceID, slug, prefix string) bool {
	allowed, ok := apiKey["allowedServiceIds"].([]string)
	if !ok || len(allowed) == 0 {
		return true
	}
	for _, candidate := range allowed {
		if candidate == serviceID || candidate == slug || candidate == prefix {
			return true
		}
	}
	return false
}

func writeJSON(w http.ResponseWriter, status int, payload map[string]any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func writeError(w http.ResponseWriter, status int, code, message string) {
	writeJSON(w, status, map[string]any{
		"ok": false,
		"error": map[string]any{
			"code":    code,
			"message": message,
		},
	})
}

func decodeJSON(body io.Reader, target any) error {
	decoder := json.NewDecoder(io.LimitReader(body, 1<<20))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(target); err != nil {
		return err
	}
	return nil
}

func mustJSON(value any) string {
	bytes, _ := json.Marshal(value)
	return string(bytes)
}

func boolToInt(value bool) int {
	if value {
		return 1
	}
	return 0
}

func intPtr(value int) *int {
	v := value
	return &v
}

func nullInt(value *int) any {
	if value == nil || *value <= 0 {
		return nil
	}
	return *value
}

func nullIntValue(value sql.NullInt64) *int {
	if !value.Valid {
		return nil
	}
	v := int(value.Int64)
	return &v
}

func nullIntValueFromAny(value any) *int {
	if value == nil {
		return nil
	}
	switch typed := value.(type) {
	case *int:
		return typed
	case int:
		v := typed
		return &v
	case int64:
		v := int(typed)
		return &v
	case float64:
		v := int(typed)
		return &v
	default:
		return nil
	}
}

func nullString(value sql.NullString) any {
	if !value.Valid {
		return nil
	}
	return value.String
}

func nullStringValue(value any) sql.NullString {
	if value == nil {
		return sql.NullString{}
	}
	text := fmt.Sprintf("%v", value)
	if strings.TrimSpace(text) == "" {
		return sql.NullString{}
	}
	return sql.NullString{String: text, Valid: true}
}

func nullIfEmpty(value string) any {
	v := strings.TrimSpace(value)
	if v == "" {
		return nil
	}
	return v
}

func coalesceIntPtr(value *int, fallback *int) *int {
	if value != nil {
		return value
	}
	return fallback
}

func normalizePathPrefix(value, fallback string) string {
	v := strings.TrimSpace(value)
	if v == "" {
		v = fallback
	}
	if !strings.HasPrefix(v, "/") {
		v = "/" + v
	}
	if len(v) > 1 && strings.HasSuffix(v, "/") {
		v = strings.TrimSuffix(v, "/")
	}
	return v
}

func slugify(value, fallback string) string {
	v := strings.ToLower(strings.TrimSpace(value))
	if v == "" {
		v = fallback
	}
	out := strings.Builder{}
	lastDash := false
	for _, r := range v {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') {
			out.WriteRune(r)
			lastDash = false
			continue
		}
		if !lastDash {
			out.WriteRune('-')
			lastDash = true
		}
	}
	result := strings.Trim(out.String(), "-")
	if result == "" {
		return fallback
	}
	return result
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}

func firstNonEmptyPtr(value *string, fallback string) string {
	if value != nil {
		if strings.TrimSpace(*value) == "" {
			return fallback
		}
		return strings.TrimSpace(*value)
	}
	return fallback
}

func defaultBool(value *bool, fallback bool) bool {
	if value == nil {
		return fallback
	}
	return *value
}

func asString(value any) string {
	if value == nil {
		return ""
	}
	if v, ok := value.(string); ok {
		return v
	}
	return fmt.Sprintf("%v", value)
}

func asBool(value any) bool {
	if value == nil {
		return false
	}
	switch v := value.(type) {
	case bool:
		return v
	case int:
		return v == 1
	case int64:
		return v == 1
	case float64:
		return int(v) == 1
	default:
		return false
	}
}

func intFromAny(value any, fallback int) int {
	if value == nil {
		return fallback
	}
	switch v := value.(type) {
	case int:
		return v
	case int64:
		return int(v)
	case float64:
		return int(v)
	case *int:
		if v == nil {
			return fallback
		}
		return *v
	default:
		return fallback
	}
}

func minPositive(a, b *int) *int {
	if a == nil && b == nil {
		return nil
	}
	if a == nil {
		return b
	}
	if b == nil {
		return a
	}
	if *a < *b {
		return a
	}
	return b
}

func keysOfMap(values map[string]bool) []string {
	keys := make([]string, 0, len(values))
	for key, enabled := range values {
		if enabled {
			keys = append(keys, key)
		}
	}
	sort.Strings(keys)
	return keys
}

func uniqueStrings(values []string) []string {
	seen := map[string]bool{}
	output := []string{}
	for _, value := range values {
		v := strings.TrimSpace(value)
		if v == "" || seen[v] {
			continue
		}
		seen[v] = true
		output = append(output, v)
	}
	return output
}

func normalizeProvider(value string) string {
	v := strings.ToLower(strings.TrimSpace(value))
	switch v {
	case "sqlite", "sqlite3", "file":
		return "sqlite"
	case "postgres", "postgresql", "pg":
		return "postgres"
	case "mysql", "mariadb":
		return "mysql"
	default:
		return ""
	}
}

func maskDatabaseURL(provider, raw string) string {
	if normalizeProvider(provider) == "sqlite" {
		return raw
	}
	u, err := netUrlParse(raw)
	if err != nil {
		if len(raw) <= 8 {
			return "***"
		}
		return raw[:4] + "***" + raw[len(raw)-2:]
	}
	if u.User != nil {
		username := u.User.Username()
		password, hasPassword := u.User.Password()
		if username != "" {
			if len(username) > 2 {
				username = username[:2] + "***"
			} else {
				username = "***"
			}
		}
		if hasPassword && password != "" {
			u.User = url.UserPassword(username, "***")
		} else {
			u.User = url.User(username)
		}
	}
	q := u.Query()
	for _, key := range []string{"password", "pass", "pwd", "token", "secret"} {
		if q.Has(key) {
			q.Set(key, "***")
		}
	}
	u.RawQuery = q.Encode()
	return u.String()
}

func extractDatabaseTarget(provider, raw string) string {
	if normalizeProvider(provider) == "sqlite" {
		return raw
	}
	u, err := netUrlParse(raw)
	if err != nil {
		return "-"
	}
	name := strings.TrimPrefix(u.Path, "/")
	if name == "" {
		name = "-"
	}
	return name
}

func pathAbs(value string) (string, error) {
	if strings.HasPrefix(value, "file:") {
		return strings.TrimPrefix(value, "file:"), nil
	}
	if filepath.IsAbs(value) {
		return value, nil
	}
	wd, err := os.Getwd()
	if err != nil {
		return "", err
	}
	return filepath.Join(wd, value), nil
}

func netUrlParse(value string) (*url.URL, error) {
	return url.Parse(value)
}

func webPathForRequest(requestPath string, uiBasePath string) (string, bool) {
	reqPath := path.Clean("/" + strings.TrimSpace(requestPath))
	if reqPath == "." {
		reqPath = "/"
	}

	base := normalizePathPrefix(uiBasePath, "/")
	if base == "/" {
		return strings.TrimPrefix(reqPath, "/"), true
	}

	if reqPath == base {
		return "", true
	}

	prefix := base + "/"
	if strings.HasPrefix(reqPath, prefix) {
		return strings.TrimPrefix(reqPath, prefix), true
	}

	return "", false
}

func upstreamOr(a, b sql.NullString) sql.NullString {
	if a.Valid {
		return a
	}
	return b
}

type serviceInput struct {
	Name               string `json:"name"`
	Slug               string `json:"slug"`
	UpstreamURL        string `json:"upstreamUrl"`
	RoutePrefix        string `json:"routePrefix"`
	HealthPath         string `json:"healthPath"`
	UpstreamAuthHeader string `json:"upstreamAuthHeader"`
	UpstreamAuthValue  string `json:"upstreamAuthValue"`
	InternalToken      string `json:"internalToken"`
	Enabled            *bool  `json:"enabled"`
	RPMLimit           *int   `json:"rpmLimit"`
	MonthlyQuota       *int   `json:"monthlyQuota"`
	RequestTimeoutMS   *int   `json:"requestTimeoutMs"`
}

func (s serviceInput) RPMLimitOr(value any) *int {
	if s.RPMLimit != nil {
		return s.RPMLimit
	}
	return nullIntValueFromAny(value)
}

func (s serviceInput) MonthlyQuotaOr(value any) *int {
	if s.MonthlyQuota != nil {
		return s.MonthlyQuota
	}
	return nullIntValueFromAny(value)
}

func (s serviceInput) TimeoutOr(value any) *int {
	if s.RequestTimeoutMS != nil {
		return s.RequestTimeoutMS
	}
	return nullIntValueFromAny(value)
}
