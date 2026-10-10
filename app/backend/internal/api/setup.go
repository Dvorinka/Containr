package api

// First-run setup wizard state. GET /setup/status is public so the web
// shell can redirect fresh installs before a session exists; the flag
// lives in app_settings so it survives restarts.

import (
	"context"
	"net/http"
	"strings"

	"containr/internal/database"
	"containr/internal/database/sqlcdb"

	"github.com/gin-gonic/gin"
)

const settingSetupCompleted = "setup_completed"

// setupComplete resolves the flag. Installs that predate the wizard
// (users + projects already exist) auto-complete — nobody who has been
// running Containr for months should get a welcome screen.
func setupComplete(db *database.DB, hasUsers bool) bool {
	if strings.EqualFold(settingValue(db, settingSetupCompleted, "", ""), "true") {
		return true
	}
	if !hasUsers {
		return false
	}
	if projects, err := sqlcdb.New(db.DB).CountProjects(context.Background()); err == nil && projects > 0 {
		return true
	}
	return false
}

// GET /api/v1/setup/status — public: fresh installs hit it before any
// session exists.
func handleSetupStatus(c *gin.Context) {
	db, ok := c.MustGet("db").(*database.DB)
	if !ok {
		respondError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Database connection not available")
		return
	}
	count, err := countLocalUsers(db)
	if err != nil {
		respondError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to inspect setup state")
		return
	}
	hasUsers := count > 0
	completed := setupComplete(db, hasUsers)
	tunnelToken, _ := resolvedTunnelToken(db)
	c.JSON(http.StatusOK, gin.H{
		"has_users":       hasUsers,
		"setup_completed": completed,
		"needs_setup":     !completed,
		"has_github_app":  githubAppConfigured(db),
		"has_tunnel":      tunnelToken != "",
		"signup_enabled":  signupEnabled(db),
	})
}

// POST /api/v1/setup/complete — marks the wizard done. Open to any
// authenticated user: the first account is the owner, and the flag only
// suppresses a banner.
func handleSetupComplete(c *gin.Context) {
	if _, ok := requireAuthenticatedUserID(c); !ok {
		return
	}
	db, ok := c.MustGet("db").(*database.DB)
	if !ok {
		respondError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Database connection not available")
		return
	}
	if err := setSetting(db, settingSetupCompleted, "true", false); err != nil {
		respondError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to save setup state")
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Setup completed"})
}
