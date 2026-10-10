package api

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"containr/internal/config"
	"containr/internal/database"
	"containr/internal/database/sqlcdb"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

// ---------------------------------------------------------------------------
// Admin account bootstrap
// ---------------------------------------------------------------------------

// EnsureAdminAccount provisions the platform owner account from
// ADMIN_EMAIL/ADMIN_PASSWORD (optional ADMIN_NAME). It is idempotent: existing
// users are simply promoted to admin. Both the local users row (legacy JWT
// login) and the Better Auth account (cookie sessions) are created so either
// sign-in path works. Failures are logged, never fatal — the platform must
// boot even when auth is misconfigured.
func EnsureAdminAccount(ctx context.Context, db *database.DB, cfg *config.Config) {
	email := strings.ToLower(strings.TrimSpace(cfg.AdminEmail))
	password := cfg.AdminPassword
	if email == "" || password == "" {
		return
	}
	if db == nil || db.DB == nil {
		log.Println("Admin bootstrap skipped: database unavailable")
		return
	}
	name := strings.TrimSpace(cfg.AdminName)
	if name == "" {
		name = "Platform Admin"
	}

	// Local users row (owns resources, is_admin flag, legacy login hash).
	hashed, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		log.Printf("Admin bootstrap failed: %v", err)
		return
	}

	if _, err := sqlcdb.New(db.DB).UpsertAdminUser(ctx, sqlcdb.UpsertAdminUserParams{
		Email:        email,
		PasswordHash: string(hashed),
		Name:         name,
	}); err != nil {
		log.Printf("Admin bootstrap failed to upsert user %s: %v", email, err)
		return
	}

	// Better Auth account (cookie-session sign-in). Duplicate sign-up returns
	// an error which we treat as "already provisioned".
	if err := ensureBetterAuthUser(ctx, name, email, password); err != nil {
		if errors.Is(err, errBetterAuthUserExists) {
			log.Printf("Admin account %s already exists in auth service; ensured admin flag", email)
		} else {
			log.Printf("Warning: admin bootstrap could not create auth user for %s: %v", email, err)
		}
		return
	}
	log.Printf("Admin account provisioned: %s", email)
}

// ensureBetterAuthUser calls the Better Auth sign-up endpoint directly. Unlike
// createBetterAuthUser it runs outside a request context.
func ensureBetterAuthUser(ctx context.Context, name, email, password string) error {
	endpoint, err := betterAuthSignUpURL()
	if err != nil {
		return err
	}

	body, err := json.Marshal(gin.H{"name": name, "email": email, "password": password})
	if err != nil {
		return err
	}

	request, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return err
	}
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Accept", "application/json")
	if token := strings.TrimSpace(os.Getenv("BETTER_AUTH_INTERNAL_TOKEN")); token != "" {
		request.Header.Set("X-Containr-Auth-Internal", token)
	}

	response, err := (&http.Client{Timeout: 10 * time.Second}).Do(request)
	if err != nil {
		return err
	}
	defer response.Body.Close()

	if response.StatusCode >= http.StatusOK && response.StatusCode < http.StatusMultipleChoices {
		return nil
	}

	var payload map[string]interface{}
	_ = json.NewDecoder(response.Body).Decode(&payload)
	message := ""
	if raw, ok := payload["message"].(string); ok {
		message = strings.ToLower(raw)
	} else if raw, ok := payload["error"].(string); ok {
		message = strings.ToLower(raw)
	}
	if strings.Contains(message, "exist") || strings.Contains(message, "already") {
		return errBetterAuthUserExists
	}
	if message == "" {
		message = http.StatusText(response.StatusCode)
	}
	return errors.New(message)
}

// ---------------------------------------------------------------------------
// Admin API
// ---------------------------------------------------------------------------

type adminUserRow struct {
	ID        string `json:"id"`
	Email     string `json:"email"`
	Name      string `json:"name"`
	AvatarURL string `json:"avatar_url"`
	IsAdmin   bool   `json:"is_admin"`
	CreatedAt string `json:"created_at"`
}

func handleAdminOverview(c *gin.Context) {
	db := c.MustGet("db").(*database.DB)
	queries := sqlcdb.New(db.DB)
	ctx := c.Request.Context()

	count := func(query string) int {
		var n int
		if err := db.QueryRowContext(ctx, query).Scan(&n); err != nil {
			return 0
		}
		return n
	}

	pendingRows, err := queries.ListPendingProjects(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list pending projects"})
		return
	}
	pending := make([]Project, 0, len(pendingRows))
	for _, row := range pendingRows {
		pending = append(pending, mapSQLCProject(row))
	}

	c.JSON(http.StatusOK, gin.H{
		"stats": gin.H{
			"users":             count(`SELECT COUNT(*) FROM users`),
			"projects":          count(`SELECT COUNT(*) FROM projects`),
			"pending_projects":  count(`SELECT COUNT(*) FROM projects WHERE is_approved = false`),
			"services":          count(`SELECT COUNT(*) FROM services`),
			"running_services":  count(`SELECT COUNT(*) FROM services WHERE status = 'running'`),
			"databases":         count(`SELECT COUNT(*) FROM database_services`),
			"agents":            count(`SELECT COUNT(*) FROM node_agents`),
			"templates":         count(`SELECT COUNT(*) FROM service_templates`),
			"user_templates":    count(`SELECT COUNT(*) FROM service_templates WHERE is_official = false`),
			"cron_jobs":         count(`SELECT COUNT(*) FROM cron_jobs`),
			"deployments_total": count(`SELECT COUNT(*) FROM deployments`),
		},
		"pending_projects": pending,
	})
}

func handleAdminListUsers(c *gin.Context) {
	db := c.MustGet("db").(*database.DB)

	rows, err := sqlcdb.New(db.DB).ListAdminUsers(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list users"})
		return
	}

	users := make([]adminUserRow, 0, len(rows))
	for _, r := range rows {
		users = append(users, adminUserRow{
			ID: r.ID.String(), Email: r.Email, Name: r.Name,
			AvatarURL: r.AvatarUrl, IsAdmin: r.IsAdmin, CreatedAt: r.CreatedAt,
		})
	}
	c.JSON(http.StatusOK, gin.H{"users": users})
}

func handleAdminSetUserAdmin(c *gin.Context) {
	db := c.MustGet("db").(*database.DB)
	targetID := strings.TrimSpace(c.Param("id"))
	if _, err := uuid.Parse(targetID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	var req struct {
		IsAdmin bool `json:"is_admin"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	callerID := optionalUserID(c)
	if callerID == targetID && !req.IsAdmin {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot revoke your own admin access"})
		return
	}

	targetUUID, _ := uuid.Parse(targetID)
	n, err := sqlcdb.New(db.DB).SetUserAdmin(c.Request.Context(), sqlcdb.SetUserAdminParams{
		IsAdmin: req.IsAdmin,
		ID:      targetUUID,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update user"})
		return
	}
	if n == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	LogAudit(callerID, "user", targetID, "set_admin", map[string]interface{}{"is_admin": req.IsAdmin})
	c.JSON(http.StatusOK, gin.H{"message": "User updated"})
}

// POST /admin/users/:id/impersonate — mints a 15-minute bearer token acting
// as the target user. Admin-only; admin accounts cannot be impersonated
// (would blur audit attribution). Every use is audit-logged at mint time;
// token carries `impersonated_by` for downstream attribution.
func handleAdminImpersonateUser(c *gin.Context) {
	db := c.MustGet("db").(*database.DB)
	targetID := strings.TrimSpace(c.Param("id"))
	if _, err := uuid.Parse(targetID); err != nil {
		respondError(c, http.StatusBadRequest, "INVALID_ID", "invalid user id")
		return
	}

	userUUID, _ := uuid.Parse(targetID)
	info, err := sqlcdb.New(db.DB).GetAdminUserInfo(c.Request.Context(), userUUID)
	if err != nil {
		respondError(c, http.StatusNotFound, "NOT_FOUND", "user not found")
		return
	}
	email, name, isAdmin := info.Email, info.Name, info.IsAdmin
	if isAdmin {
		respondError(c, http.StatusForbidden, "FORBIDDEN", "admin accounts cannot be impersonated")
		return
	}
	actorID := optionalUserID(c)
	if actorID == targetID {
		respondError(c, http.StatusBadRequest, "VALIDATION", "cannot impersonate yourself")
		return
	}

	expiresAt := time.Now().UTC().Add(15 * time.Minute)
	jwtSecret := c.MustGet("jwt_secret").(string)
	token, err := generateImpersonationJWT(targetID, email, actorID, jwtSecret, expiresAt)
	if err != nil {
		respondError(c, http.StatusInternalServerError, "INTERNAL", "failed to generate token")
		return
	}

	LogAuditWithRequest(c, "user", targetID, "impersonate", map[string]interface{}{
		"actor_id":     actorID,
		"target_email": email,
		"expires_at":   expiresAt.Format(time.RFC3339),
	})
	c.JSON(http.StatusOK, gin.H{
		"token":      token,
		"expires_at": expiresAt.Format(time.RFC3339),
		"user":       gin.H{"id": targetID, "email": email, "name": name},
	})
}

func handleAdminSetProjectApproval(c *gin.Context) {
	db := c.MustGet("db").(*database.DB)
	queries := sqlcdb.New(db.DB)

	projectID, ok := parseProjectIDParam(c)
	if !ok {
		return
	}

	var req struct {
		IsApproved bool `json:"is_approved"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	rows, err := queries.SetProjectApproved(c.Request.Context(), sqlcdb.SetProjectApprovedParams{
		IsApproved: req.IsApproved,
		ProjectID:  projectID,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update project"})
		return
	}
	if rows == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Project not found"})
		return
	}

	action := "unapprove"
	if req.IsApproved {
		action = "approve"
	}
	LogAudit(optionalUserID(c), "project", projectID.String(), action, nil)

	row, err := queries.GetProjectByIDForUser(c.Request.Context(), sqlcdb.GetProjectByIDForUserParams{
		ProjectID: projectID,
		UserID:    optionalUserUUID(c),
		IsAdmin:   true,
	})
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "Project updated"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"project": mapSQLCProject(row)})
}
