package api

import (
	"context"
	"database/sql"
	"net/http"
	"strings"
	"time"

	"containr/internal/database"
	"containr/internal/database/sqlcdb"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type CloneServiceRequest struct {
	Name        string    `json:"name"`
	ProjectID   uuid.UUID `json:"project_id"` // empty = clone within the same project
	Environment string    `json:"environment" binding:"omitempty,oneof=production preview development"`
}

// handleCloneService duplicates a service's full configuration — image/git
// source, volumes, domains, access gates, builder settings, and variables —
// into the same or another project. Containers are not cloned; the copy
// starts stopped until its first deploy.
func handleCloneService(c *gin.Context) {
	db, exists := c.Get("db")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database connection not available"})
		return
	}
	userID, _ := c.Get("user_id")

	var req CloneServiceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error(), "code": "VALIDATION"})
		return
	}

	source, ok := loadOwnedService(c, db.(*database.DB))
	if !ok {
		return
	}

	targetProjectID := source.ProjectID
	if req.ProjectID != uuid.Nil {
		targetProjectID = req.ProjectID
	}
	if !ownsProject(db.(*database.DB), targetProjectID, userID.(string), contextIsAdmin(c)) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied to target project", "code": "FORBIDDEN"})
		return
	}

	name := strings.TrimSpace(req.Name)
	if name == "" {
		name = source.Name + "-copy"
	}
	count, _ := sqlcdb.New(db.(*database.DB).DB).CountServicesByName(
		c.Request.Context(), sqlcdb.CountServicesByNameParams{ProjectID: targetProjectID, Name: name})
	if count > 0 {
		c.JSON(http.StatusConflict, gin.H{"error": "Service name already exists in target project", "code": "CONFLICT"})
		return
	}

	environment := source.Environment
	if req.Environment != "" {
		environment = req.Environment
	}

	newID, err := cloneServiceRow(db.(*database.DB), source.ID, targetProjectID, name, environment)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to clone service"})
		return
	}

	LogAuditWithRequest(c, "service", source.ID.String(), "service.clone", map[string]interface{}{"cloned_to": newID.String(), "name": name})
	c.JSON(http.StatusCreated, gin.H{"service_id": newID, "name": name, "message": "Service cloned"})
}

// cloneServiceRow copies a service's full configuration — source, build
// settings, volumes, access gates, domains, and variables — under a new id
// in the target project. The clone starts stopped. An empty environment
// inherits the source's. Used by the clone endpoint and preview
// environments, which additionally override git_branch and domains.
func cloneServiceRow(db *database.DB, sourceID uuid.UUID, targetProjectID uuid.UUID, name, environment string) (uuid.UUID, error) {
	ctx := context.Background()
	q := sqlcdb.New(db.DB)

	sourceEnv, err := q.GetServiceEnvironment(ctx, sourceID)
	if err != nil {
		return uuid.Nil, err
	}
	if environment == "" {
		environment = sourceEnv
	}
	if environment == "" {
		environment = "production"
	}
	environmentID, err := getProjectEnvironmentID(db, targetProjectID, environment)
	if err != nil {
		return uuid.Nil, err
	}

	maintenance, basicAuth := serviceAccess(db, sourceID)
	newID := uuid.New()
	now := time.Now()

	err = q.CloneServiceRow(ctx, sqlcdb.CloneServiceRowParams{
		ID:              newID,
		ProjectID:       targetProjectID,
		Name:            name,
		EnvironmentID:   environmentID,
		Environment:     sql.NullString{String: environment, Valid: true},
		MaintenanceMode: maintenance,
		BasicAuthUsers:  basicAuth,
		CreatedAt:       sql.NullTime{Time: now, Valid: true},
		ID_2:            sourceID,
	})
	if err != nil {
		return uuid.Nil, err
	}

	if err := q.CloneServiceDomains(ctx, sqlcdb.CloneServiceDomainsParams{
		ServiceID: newID, ServiceID_2: sourceID}); err != nil {
		_ = q.DeleteServiceByID(ctx, newID)
		return uuid.Nil, err
	}
	// Variable values are copied as stored — ciphertext stays ciphertext.
	if err := q.CloneServiceVariables(ctx, sqlcdb.CloneServiceVariablesParams{
		ServiceID: newID, ServiceID_2: sourceID}); err != nil {
		_ = q.DeleteServiceByID(ctx, newID)
		return uuid.Nil, err
	}
	return newID, nil
}

type MoveServiceRequest struct {
	ProjectID uuid.UUID `json:"project_id" binding:"required"`
}

// handleMoveService re-parents a service to another project owned by the
// caller. Variables, domains, and volumes follow via the service id;
// running containers keep running (they join the new project's network on
// the next deploy).
func handleMoveService(c *gin.Context) {
	db, exists := c.Get("db")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database connection not available"})
		return
	}
	userID, _ := c.Get("user_id")
	serviceID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid service ID", "code": "VALIDATION"})
		return
	}

	var req MoveServiceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error(), "code": "VALIDATION"})
		return
	}

	service, ok := loadOwnedService(c, db.(*database.DB))
	if !ok {
		return
	}
	if req.ProjectID == service.ProjectID {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Service is already in that project", "code": "VALIDATION"})
		return
	}
	if !ownsProject(db.(*database.DB), req.ProjectID, userID.(string), contextIsAdmin(c)) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied to target project", "code": "FORBIDDEN"})
		return
	}

	count, _ := sqlcdb.New(db.(*database.DB).DB).CountServicesByName(
		c.Request.Context(), sqlcdb.CountServicesByNameParams{ProjectID: req.ProjectID, Name: service.Name})
	if count > 0 {
		c.JSON(http.StatusConflict, gin.H{"error": "A service with this name already exists in the target project", "code": "CONFLICT"})
		return
	}

	envName := service.Environment
	if envName == "" {
		envName = "production"
	}
	environmentID, err := getProjectEnvironmentID(db.(*database.DB), req.ProjectID, envName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to resolve target environment"})
		return
	}

	n, err := sqlcdb.New(db.(*database.DB).DB).MoveServiceProject(
		c.Request.Context(), sqlcdb.MoveServiceProjectParams{
			ProjectID:     req.ProjectID,
			EnvironmentID: environmentID,
			UpdatedAt:     sql.NullTime{Time: time.Now(), Valid: true},
			ID:            serviceID,
		})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to move service"})
		return
	}
	if n == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Service not found", "code": "NOT_FOUND"})
		return
	}

	LogAuditWithRequest(c, "service", serviceID.String(), "service.move", map[string]interface{}{"to_project": req.ProjectID.String()})
	c.JSON(http.StatusOK, gin.H{"message": "Service moved", "project_id": req.ProjectID})
}

// ownsProject is true when the user owns the project or is an admin.
func ownsProject(db *database.DB, projectID uuid.UUID, userID string, isAdmin bool) bool {
	if isAdmin {
		return true
	}
	uid, err := uuid.Parse(userID)
	if err != nil {
		return false
	}
	owner, err := sqlcdb.New(db.DB).GetProjectOwner(context.Background(), projectID)
	return err == nil && owner == uid
}
