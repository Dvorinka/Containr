package api

import (
	"context"
	"net/http"

	"containr/internal/database"
	"containr/internal/database/sqlcdb"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func requireAuthenticatedUserID(c *gin.Context) (string, bool) {
	userIDValue, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return "", false
	}

	userID, ok := userIDValue.(string)
	if !ok || userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user context"})
		return "", false
	}

	return userID, true
}

// optionalUserID returns the resolved user id or "" for anonymous callers on
// OptionalAuth routes. Never writes a response.
func optionalUserID(c *gin.Context) string {
	userIDValue, exists := c.Get("user_id")
	if !exists {
		return ""
	}
	userID, _ := userIDValue.(string)
	return userID
}

// optionalUserUUID is the uuid variant of optionalUserID; anonymous callers
// get uuid.Nil, which matches no owner_id and therefore only sees approved
// public resources.
func optionalUserUUID(c *gin.Context) uuid.UUID {
	userID := optionalUserID(c)
	parsed, err := uuid.Parse(userID)
	if err != nil {
		return uuid.Nil
	}
	return parsed
}

// contextIsAdmin reports whether the resolved caller is a platform admin.
func contextIsAdmin(c *gin.Context) bool {
	return c.GetBool("is_admin")
}

// projectReadAccess reports (exists, allowedToRead). Approved projects are
// public; unapproved ones are visible to the owner, project members, and
// platform admins only.
func projectReadAccess(c *gin.Context, db *database.DB, projectID uuid.UUID) (bool, bool) {
	q := sqlcdb.New(db.DB)
	row, err := q.GetProjectReadAccess(context.Background(), projectID)
	if err != nil {
		return false, false
	}
	isApproved, ownerID := row.IsApproved, row.OwnerID
	if isApproved || contextIsAdmin(c) {
		return true, true
	}
	userID := optionalUserID(c)
	if userID == "" {
		return true, false
	}
	if ownerID == userID {
		return true, true
	}
	userUUID, _ := uuid.Parse(userID)
	if member, err := q.ProjectMemberExists(context.Background(), sqlcdb.ProjectMemberExistsParams{
		ProjectID: projectID,
		UserID:    userUUID,
	}); err == nil && member {
		return true, true
	}
	return true, false
}

// projectManageAccess reports (exists, allowedToOperate). Unlike
// projectReadAccess, approval does NOT grant access — only the owner,
// project members, and platform admins may reach secret-adjacent data
// such as variables and runtime logs.
func projectManageAccess(c *gin.Context, db *database.DB, projectID uuid.UUID) (bool, bool) {
	q := sqlcdb.New(db.DB)
	ownerID, err := q.GetProjectOwnerText(context.Background(), projectID)
	if err != nil {
		return false, false
	}
	if contextIsAdmin(c) {
		return true, true
	}
	userID := optionalUserID(c)
	if userID == "" {
		return true, false
	}
	if ownerID == userID {
		return true, true
	}
	userUUID, _ := uuid.Parse(userID)
	if member, err := q.ProjectMemberExists(context.Background(), sqlcdb.ProjectMemberExistsParams{
		ProjectID: projectID,
		UserID:    userUUID,
	}); err == nil && member {
		return true, true
	}
	return true, false
}

// serviceProjectID resolves the project that owns a service.
func serviceProjectID(db *database.DB, serviceID uuid.UUID) (uuid.UUID, bool) {
	projectID, err := sqlcdb.New(db.DB).GetServiceProjectID(context.Background(), serviceID)
	if err != nil {
		return uuid.Nil, false
	}
	return projectID, true
}
