package api

import (
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"net/http"
	"strings"
	"time"

	"containr/internal/database"
	sqlcdb "containr/internal/database/sqlcdb"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// Personal access tokens let the CLI, MCP server, and third-party agents
// authenticate without a browser session. The raw token (cnp_…) is
// returned exactly once at creation; only its sha256 hash persists.

var userTokenScopes = map[string]bool{"read": true, "write": true, "admin": true}

func generateUserToken() (token string, prefix string, hash string, err error) {
	buf := make([]byte, 24)
	if _, err = rand.Read(buf); err != nil {
		return "", "", "", err
	}
	token = "cnp_" + hex.EncodeToString(buf)
	prefix = token[:12] // cnp_ + 8 hex chars, enough to identify in a list
	sum := sha256.Sum256([]byte(token))
	return token, prefix, hex.EncodeToString(sum[:]), nil
}

func userTokenJSON(t sqlcdb.UserToken) gin.H {
	row := gin.H{
		"id":         t.ID.String(),
		"name":       t.Name,
		"key_prefix": t.KeyPrefix,
		"scope":      t.Scope,
	}
	if t.CreatedAt.Valid {
		row["created_at"] = t.CreatedAt.Time
	}
	if t.LastUsedAt.Valid {
		row["last_used_at"] = t.LastUsedAt.Time
	}
	if t.ExpiresAt.Valid {
		row["expires_at"] = t.ExpiresAt.Time
	}
	return row
}

func handleCreateUserToken(c *gin.Context) {
	userID, ok := requireAuthenticatedUserID(c)
	if !ok {
		return
	}
	db := c.MustGet("db").(*database.DB)
	queries := sqlcdb.New(db.DB)

	var req struct {
		Name          string `json:"name"`
		Scope         string `json:"scope"`
		ExpiresInDays int    `json:"expires_in_days"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "name is required", "code": "VALIDATION"})
		return
	}
	if req.Scope == "" {
		req.Scope = "write"
	}
	if !userTokenScopes[req.Scope] {
		c.JSON(http.StatusBadRequest, gin.H{"error": "scope must be one of: read, write, admin", "code": "VALIDATION"})
		return
	}
	// A token can never outrank its owner: non-admin users cannot mint
	// admin-scope tokens even for themselves.
	if req.Scope == "admin" && !c.GetBool("is_admin") {
		c.JSON(http.StatusForbidden, gin.H{"error": "admin scope requires a platform admin account", "code": "FORBIDDEN"})
		return
	}
	if req.ExpiresInDays < 0 || req.ExpiresInDays > 3650 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "expires_in_days must be between 0 (never) and 3650", "code": "VALIDATION"})
		return
	}

	token, prefix, hash, err := generateUserToken()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token", "code": "INTERNAL"})
		return
	}

	ownerUUID, err := uuid.Parse(userID)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user context", "code": "INVALID_TOKEN"})
		return
	}

	expiresAt := sql.NullTime{}
	if req.ExpiresInDays > 0 {
		expiresAt = sql.NullTime{Time: time.Now().Add(time.Duration(req.ExpiresInDays) * 24 * time.Hour), Valid: true}
	}

	row, err := queries.CreateUserToken(c.Request.Context(), sqlcdb.CreateUserTokenParams{
		UserID:    ownerUUID,
		Name:      req.Name,
		KeyPrefix: prefix,
		TokenHash: hash,
		Scope:     req.Scope,
		ExpiresAt: expiresAt,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to store token", "code": "INTERNAL"})
		return
	}

	LogAudit(userID, "user_token", row.ID.String(), "create", map[string]interface{}{"name": req.Name, "scope": req.Scope})

	payload := userTokenJSON(row)
	payload["token"] = token
	c.JSON(http.StatusCreated, payload)
}

func handleListUserTokens(c *gin.Context) {
	userID, ok := requireAuthenticatedUserID(c)
	if !ok {
		return
	}
	db := c.MustGet("db").(*database.DB)
	queries := sqlcdb.New(db.DB)

	ownerUUID, err := uuid.Parse(userID)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user context", "code": "INVALID_TOKEN"})
		return
	}

	rows, err := queries.ListUserTokens(c.Request.Context(), ownerUUID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch tokens", "code": "INTERNAL"})
		return
	}

	out := make([]gin.H, 0, len(rows))
	for _, t := range rows {
		out = append(out, userTokenJSON(t))
	}
	c.JSON(http.StatusOK, gin.H{"tokens": out})
}

func handleDeleteUserToken(c *gin.Context) {
	userID, ok := requireAuthenticatedUserID(c)
	if !ok {
		return
	}
	db := c.MustGet("db").(*database.DB)
	queries := sqlcdb.New(db.DB)

	ownerUUID, err := uuid.Parse(userID)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user context", "code": "INVALID_TOKEN"})
		return
	}
	tokenUUID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid token ID", "code": "VALIDATION"})
		return
	}

	affected, err := queries.RevokeUserToken(c.Request.Context(), sqlcdb.RevokeUserTokenParams{
		ID:     tokenUUID,
		UserID: ownerUUID,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to revoke token", "code": "INTERNAL"})
		return
	}
	if affected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Token not found", "code": "NOT_FOUND"})
		return
	}

	LogAudit(userID, "user_token", tokenUUID.String(), "revoke", nil)
	c.JSON(http.StatusOK, gin.H{"message": "Token revoked"})
}
