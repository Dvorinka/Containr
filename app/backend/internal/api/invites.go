package api

import (
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"errors"
	"net/http"
	"strings"
	"time"

	"containr/internal/database"
	"containr/internal/database/sqlcdb"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

// Team invites: an admin creates a single-use link; the invitee registers
// through it even while public signup is closed. Tokens are random 32-byte
// values shared once — only their sha256 hash is stored.

type inviteJSON struct {
	ID        string     `json:"id"`
	Email     *string    `json:"email,omitempty"`
	ExpiresAt time.Time  `json:"expires_at"`
	UsedAt    *time.Time `json:"used_at,omitempty"`
	CreatedAt *time.Time `json:"created_at,omitempty"`
}

func toInviteJSON(i sqlcdb.UserInvite) inviteJSON {
	out := inviteJSON{ID: i.ID.String(), ExpiresAt: i.ExpiresAt}
	if i.Email.Valid && i.Email.String != "" {
		out.Email = &i.Email.String
	}
	if i.UsedAt.Valid {
		out.UsedAt = &i.UsedAt.Time
	}
	if i.CreatedAt.Valid {
		out.CreatedAt = &i.CreatedAt.Time
	}
	return out
}

func inviteTokenHash(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

func generateInviteToken() (string, error) {
	buf := make([]byte, 32)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return hex.EncodeToString(buf), nil
}

// POST /admin/invites — {email?, expires_in_hours?} → {invite, token, url}
func handleAdminCreateInvite(c *gin.Context) {
	var req struct {
		Email          string `json:"email"`
		ExpiresInHours *int   `json:"expires_in_hours"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, http.StatusBadRequest, "INVALID_BODY", "invalid request body")
		return
	}
	ttl := 24 * 7
	if req.ExpiresInHours != nil {
		if *req.ExpiresInHours < 1 || *req.ExpiresInHours > 24*90 {
			respondError(c, http.StatusBadRequest, "VALIDATION", "expires_in_hours must be 1–2160")
			return
		}
		ttl = *req.ExpiresInHours
	}
	token, err := generateInviteToken()
	if err != nil {
		respondError(c, http.StatusInternalServerError, "INTERNAL", "failed to generate token")
		return
	}
	userID, _ := requireAuthenticatedUserUUID(c)
	params := sqlcdb.CreateUserInviteParams{
		TokenHash: inviteTokenHash(token),
		CreatedBy: uuid.NullUUID{UUID: userID, Valid: true},
		ExpiresAt: time.Now().UTC().Add(time.Duration(ttl) * time.Hour),
	}
	if email := strings.ToLower(strings.TrimSpace(req.Email)); email != "" {
		params.Email = sql.NullString{String: email, Valid: true}
	}
	db := c.MustGet("db").(*database.DB)
	invite, err := sqlcdb.New(db.DB).CreateUserInvite(c.Request.Context(), params)
	if err != nil {
		respondError(c, http.StatusInternalServerError, "INTERNAL", "failed to create invite")
		return
	}
	c.JSON(http.StatusCreated, gin.H{
		"invite": toInviteJSON(invite),
		"token":  token,
		"url":    "/auth/accept-invite?token=" + token,
	})
}

// GET /admin/invites
func handleAdminListInvites(c *gin.Context) {
	db := c.MustGet("db").(*database.DB)
	invites, err := sqlcdb.New(db.DB).ListUserInvites(c.Request.Context())
	if err != nil {
		respondError(c, http.StatusInternalServerError, "INTERNAL", "failed to list invites")
		return
	}
	out := make([]inviteJSON, 0, len(invites))
	for _, i := range invites {
		out = append(out, toInviteJSON(i))
	}
	c.JSON(http.StatusOK, gin.H{"invites": out})
}

// DELETE /admin/invites/:id — revoke an unused invite.
func handleAdminDeleteInvite(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		respondError(c, http.StatusBadRequest, "INVALID_ID", "invalid invite id")
		return
	}
	db := c.MustGet("db").(*database.DB)
	if err := sqlcdb.New(db.DB).DeleteUserInvite(c.Request.Context(), id); err != nil {
		respondError(c, http.StatusInternalServerError, "INTERNAL", "failed to delete invite")
		return
	}
	c.Status(http.StatusNoContent)
}

// GET /auth/invites/:token — public. Lets the accept page validate the link
// and pre-fill a bound email before the user commits to registering.
func handleGetInvite(c *gin.Context) {
	db := c.MustGet("db").(*database.DB)
	invite, err := sqlcdb.New(db.DB).GetUserInviteByTokenHash(c.Request.Context(), inviteTokenHash(c.Param("token")))
	if err != nil {
		respondError(c, http.StatusNotFound, "NOT_FOUND", "invite not found")
		return
	}
	expired := time.Now().After(invite.ExpiresAt)
	var email *string
	if invite.Email.Valid && invite.Email.String != "" {
		email = &invite.Email.String
	}
	c.JSON(http.StatusOK, gin.H{
		"valid":      !invite.UsedAt.Valid && !expired,
		"used":       invite.UsedAt.Valid,
		"expired":    expired,
		"email":      email,
		"expires_at": invite.ExpiresAt,
	})
}

// POST /auth/accept-invite — {token, name, email, password}
func handleAcceptInvite(c *gin.Context) {
	var req struct {
		Token    string `json:"token" binding:"required"`
		Name     string `json:"name" binding:"required"`
		Email    string `json:"email" binding:"required"`
		Password string `json:"password" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, http.StatusBadRequest, "INVALID_BODY", "token, name, email and password are required")
		return
	}
	if len(req.Password) < 8 {
		respondError(c, http.StatusBadRequest, "VALIDATION", "password must be at least 8 characters")
		return
	}
	req.Email = strings.ToLower(strings.TrimSpace(req.Email))

	db := c.MustGet("db").(*database.DB)
	q := sqlcdb.New(db.DB)
	invite, err := q.GetUserInviteByTokenHash(c.Request.Context(), inviteTokenHash(req.Token))
	if err != nil {
		respondError(c, http.StatusNotFound, "NOT_FOUND", "invite not found")
		return
	}
	if invite.UsedAt.Valid {
		respondError(c, http.StatusGone, "INVITE_USED", "invite already used")
		return
	}
	if time.Now().After(invite.ExpiresAt) {
		respondError(c, http.StatusGone, "INVITE_EXPIRED", "invite expired")
		return
	}
	if invite.Email.Valid && invite.Email.String != "" && invite.Email.String != req.Email {
		respondError(c, http.StatusForbidden, "INVITE_EMAIL_MISMATCH", "invite is bound to a different email")
		return
	}

	existing, err := q.CountUsersByEmail(c.Request.Context(), req.Email)
	if err != nil {
		respondError(c, http.StatusInternalServerError, "INTERNAL", "database error")
		return
	}
	if existing > 0 {
		respondError(c, http.StatusConflict, "CONFLICT", "user already exists")
		return
	}

	if err := createBetterAuthUser(c, strings.TrimSpace(req.Name), req.Email, req.Password); err != nil && !errors.Is(err, errBetterAuthUserExists) {
		respondError(c, http.StatusInternalServerError, "INTERNAL", err.Error())
		return
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		respondError(c, http.StatusInternalServerError, "INTERNAL", "failed to hash password")
		return
	}

	row, err := q.InsertUser(c.Request.Context(), sqlcdb.InsertUserParams{
		Email:        req.Email,
		PasswordHash: string(hashedPassword),
		Name:         strings.TrimSpace(req.Name),
	})
	if err != nil {
		respondError(c, http.StatusConflict, "CONFLICT", "user already exists")
		return
	}
	user := User{
		ID:        row.ID.String(),
		Email:     row.Email,
		Name:      row.Name,
		AvatarURL: row.AvatarUrl,
		IsAdmin:   row.IsAdmin,
		CreatedAt: row.CreatedAt.Time.String(),
	}

	userUUID, _ := uuid.Parse(user.ID)
	if err := q.MarkUserInviteUsed(c.Request.Context(), sqlcdb.MarkUserInviteUsedParams{
		ID:     invite.ID,
		UsedBy: uuid.NullUUID{UUID: userUUID, Valid: userUUID != uuid.Nil},
	}); err != nil {
		respondError(c, http.StatusInternalServerError, "INTERNAL", "failed to consume invite")
		return
	}

	jwtSecret := c.MustGet("jwt_secret").(string)
	token, err := generateJWT(user.ID, user.Email, jwtSecret)
	if err != nil {
		respondError(c, http.StatusInternalServerError, "INTERNAL", "failed to generate token")
		return
	}
	c.JSON(http.StatusCreated, AuthResponse{Token: token, User: user})
}
