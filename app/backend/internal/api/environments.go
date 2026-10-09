package api

// Project environments — the named lanes services deploy into
// (production/development/preview are seeded; custom names allowed).

import (
	"context"
	"net/http"
	"regexp"
	"strings"
	"time"

	"containr/internal/database"
	"containr/internal/database/sqlcdb"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

var envNamePattern = regexp.MustCompile(`^[a-z0-9]([a-z0-9-]{0,48}[a-z0-9])?$`)

type environmentDTO struct {
	ID           uuid.UUID `json:"id"`
	Name         string    `json:"name"`
	ProjectID    uuid.UUID `json:"project_id"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
	ServiceCount int64     `json:"service_count"`
}

func toEnvironmentDTO(id uuid.UUID, name string, projectID uuid.UUID, created, updated time.Time, count int64) environmentDTO {
	return environmentDTO{ID: id, Name: name, ProjectID: projectID, CreatedAt: created, UpdatedAt: updated, ServiceCount: count}
}

// handleListEnvironments returns the project's environments with live
// service counts — the data behind the env switcher.
func handleListEnvironments(c *gin.Context) {
	db := c.MustGet("db").(*database.DB)
	projectID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		respondError(c, http.StatusBadRequest, "VALIDATION", "Invalid project ID")
		return
	}
	if exists, allowed := projectReadAccess(c, db, projectID); !exists || !allowed {
		respondError(c, http.StatusNotFound, "NOT_FOUND", "Project not found")
		return
	}
	rows, err := sqlcdb.New(db.DB).ListProjectEnvironments(context.Background(), projectID)
	if err != nil {
		respondError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to list environments")
		return
	}
	envs := make([]environmentDTO, 0, len(rows))
	for _, r := range rows {
		envs = append(envs, toEnvironmentDTO(r.ID, r.Name, r.ProjectID, r.CreatedAt.Time, r.UpdatedAt.Time, r.ServiceCount))
	}
	c.JSON(http.StatusOK, gin.H{"environments": envs})
}

// handleCreateEnvironment adds a named environment lane to the project.
func handleCreateEnvironment(c *gin.Context) {
	db := c.MustGet("db").(*database.DB)
	projectID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		respondError(c, http.StatusBadRequest, "VALIDATION", "Invalid project ID")
		return
	}
	userID, exists := c.Get("user_id")
	if !exists || !ownsProject(db, projectID, userID.(string), contextIsAdmin(c)) {
		respondError(c, http.StatusForbidden, "FORBIDDEN", "Access denied")
		return
	}
	var req struct {
		Name string `json:"name" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, http.StatusBadRequest, "VALIDATION", "name is required")
		return
	}
	name := strings.ToLower(strings.TrimSpace(req.Name))
	if !envNamePattern.MatchString(name) {
		respondError(c, http.StatusBadRequest, "VALIDATION", "Name must be lowercase alphanumeric with dashes, 1-50 chars")
		return
	}
	q := sqlcdb.New(db.DB)
	if _, err := q.GetProjectEnvironmentByName(context.Background(), sqlcdb.GetProjectEnvironmentByNameParams{
		ProjectID: projectID, Name: name,
	}); err == nil {
		respondError(c, http.StatusConflict, "CONFLICT", "Environment already exists")
		return
	}
	if err := q.InsertProjectEnvironment(context.Background(), sqlcdb.InsertProjectEnvironmentParams{
		Name: name, ProjectID: projectID,
	}); err != nil {
		respondError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to create environment")
		return
	}
	env, _ := q.GetProjectEnvironmentByName(context.Background(), sqlcdb.GetProjectEnvironmentByNameParams{
		ProjectID: projectID, Name: name,
	})
	LogAuditWithRequest(c, "project", projectID.String(), "environment.create", map[string]interface{}{"name": name})
	c.JSON(http.StatusCreated, gin.H{"environment": toEnvironmentDTO(env.ID, env.Name, env.ProjectID, env.CreatedAt.Time, env.UpdatedAt.Time, 0)})
}

// handleDeleteEnvironment removes an environment that holds no services.
func handleDeleteEnvironment(c *gin.Context) {
	db := c.MustGet("db").(*database.DB)
	envID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		respondError(c, http.StatusBadRequest, "VALIDATION", "Invalid environment ID")
		return
	}
	userID, exists := c.Get("user_id")
	if !exists {
		respondError(c, http.StatusUnauthorized, "UNAUTHORIZED", "User not authenticated")
		return
	}
	var projectID uuid.UUID
	if err := db.QueryRow(`SELECT project_id FROM environments WHERE id = $1`, envID).Scan(&projectID); err != nil {
		respondError(c, http.StatusNotFound, "NOT_FOUND", "Environment not found")
		return
	}
	if !ownsProject(db, projectID, userID.(string), contextIsAdmin(c)) {
		respondError(c, http.StatusForbidden, "FORBIDDEN", "Access denied")
		return
	}
	q := sqlcdb.New(db.DB)
	if n, err := q.CountEnvironmentServices(context.Background(), envID); err == nil && n > 0 {
		respondError(c, http.StatusConflict, "CONFLICT", "Environment still contains services — move them first")
		return
	}
	if err := q.DeleteProjectEnvironment(context.Background(), sqlcdb.DeleteProjectEnvironmentParams{
		ID: envID, ProjectID: projectID,
	}); err != nil {
		respondError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to delete environment")
		return
	}
	LogAuditWithRequest(c, "project", projectID.String(), "environment.delete", map[string]interface{}{"environment_id": envID.String()})
	c.JSON(http.StatusOK, gin.H{"message": "Environment deleted"})
}
