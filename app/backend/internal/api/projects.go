package api

import (
	"containr/internal/database"
	"containr/internal/database/sqlcdb"
	"database/sql"
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type Project struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	OwnerID     string `json:"owner_id"`
	CreatedAt   string `json:"created_at"`
	UpdatedAt   string `json:"updated_at"`
}

type ProjectStats struct {
	ServiceCount    int     `json:"service_count"`
	DeploymentCount int     `json:"deployment_count"`
	RunningServices int     `json:"running_services"`
	LastDeployment  *string `json:"last_deployment"`
}

type ProjectWithStats struct {
	Project
	Stats ProjectStats `json:"stats"`
}

type CreateProjectRequest struct {
	Name        string `json:"name" binding:"required,min=2"`
	Description string `json:"description"`
}

type UpdateProjectRequest struct {
	Name        *string `json:"name,omitempty"`
	Description *string `json:"description,omitempty"`
}

func handleGetProjects(c *gin.Context) {
	userID, ok := requireAuthenticatedUserUUID(c)
	if !ok {
		return
	}

	db := c.MustGet("db").(*database.DB)
	queries := sqlcdb.New(db.DB)

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))
	search := strings.TrimSpace(c.DefaultQuery("search", ""))

	if page < 1 {
		page = 1
	}
	if limit > 100 || limit < 1 {
		limit = 10
	}
	offset := (page - 1) * limit

	searchParam := sql.NullString{}
	if search != "" {
		searchParam = sql.NullString{String: search, Valid: true}
	}

	rows, err := queries.ListProjectsWithStatsByUser(c.Request.Context(), sqlcdb.ListProjectsWithStatsByUserParams{
		UserID:      userID,
		Search:      searchParam,
		LimitCount:  int32(limit),
		OffsetCount: int32(offset),
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database query error"})
		return
	}

	projects := make([]ProjectWithStats, 0, len(rows))
	for _, row := range rows {
		projects = append(projects, mapProjectWithStatsRow(row))
	}

	total, err := queries.CountProjectsByUser(c.Request.Context(), sqlcdb.CountProjectsByUserParams{
		UserID: userID,
		Search: searchParam,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database count error"})
		return
	}

	totalCount := int(total)
	c.JSON(http.StatusOK, gin.H{
		"projects": projects,
		"pagination": gin.H{
			"page":  page,
			"limit": limit,
			"total": totalCount,
			"pages": (totalCount + limit - 1) / limit,
		},
	})
}

func handleCreateProject(c *gin.Context) {
	userID, ok := requireAuthenticatedUserUUID(c)
	if !ok {
		return
	}

	db := c.MustGet("db").(*database.DB)
	queries := sqlcdb.New(db.DB)
	ctx := c.Request.Context()

	var req CreateProjectRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	req.Name = strings.TrimSpace(req.Name)
	if len(req.Name) < 2 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "name must be at least 2 characters"})
		return
	}

	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create project"})
		return
	}
	defer tx.Rollback()

	txQueries := queries.WithTx(tx)
	projectRow, err := txQueries.CreateProject(ctx, sqlcdb.CreateProjectParams{
		Name:        req.Name,
		Description: nullableText(strings.TrimSpace(req.Description)),
		OwnerID:     userID,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create project"})
		return
	}

	environments := []string{"production", "preview", "development"}
	for _, env := range environments {
		err = txQueries.InsertProjectEnvironment(ctx, sqlcdb.InsertProjectEnvironmentParams{
			Name:      env,
			ProjectID: projectRow.ID,
		})
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create environments"})
			return
		}
	}

	if err := tx.Commit(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create project"})
		return
	}

	c.JSON(http.StatusCreated, mapSQLCProject(projectRow))
}

func handleGetProject(c *gin.Context) {
	userID, ok := requireAuthenticatedUserUUID(c)
	if !ok {
		return
	}

	db := c.MustGet("db").(*database.DB)
	queries := sqlcdb.New(db.DB)

	projectID, ok := parseProjectIDParam(c)
	if !ok {
		return
	}

	projectRow, err := queries.GetProjectByIDForUser(c.Request.Context(), sqlcdb.GetProjectByIDForUserParams{
		ProjectID: projectID,
		UserID:    userID,
	})
	if errors.Is(err, sql.ErrNoRows) {
		c.JSON(http.StatusNotFound, gin.H{"error": "Project not found"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}

	c.JSON(http.StatusOK, mapSQLCProject(projectRow))
}

func handleUpdateProject(c *gin.Context) {
	userID, ok := requireAuthenticatedUserUUID(c)
	if !ok {
		return
	}

	db := c.MustGet("db").(*database.DB)
	queries := sqlcdb.New(db.DB)

	projectID, ok := parseProjectIDParam(c)
	if !ok {
		return
	}

	role, err := queries.GetProjectRoleForUser(c.Request.Context(), sqlcdb.GetProjectRoleForUserParams{
		ProjectID: projectID,
		UserID:    userID,
	})
	if errors.Is(err, sql.ErrNoRows) || role == "" || role == "viewer" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Insufficient permissions"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}

	var req UpdateProjectRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.Name == nil && req.Description == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No fields to update"})
		return
	}

	nameParam := sql.NullString{}
	if req.Name != nil {
		trimmedName := strings.TrimSpace(*req.Name)
		if len(trimmedName) < 2 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "name must be at least 2 characters"})
			return
		}
		nameParam = sql.NullString{String: trimmedName, Valid: true}
	}

	descriptionParam := sql.NullString{}
	if req.Description != nil {
		descriptionParam = sql.NullString{String: strings.TrimSpace(*req.Description), Valid: true}
	}

	updatedRows, err := queries.UpdateProjectByID(c.Request.Context(), sqlcdb.UpdateProjectByIDParams{
		Name:        nameParam,
		Description: descriptionParam,
		ProjectID:   projectID,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update project"})
		return
	}
	if updatedRows == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Project not found"})
		return
	}

	projectRow, err := queries.GetProjectByIDForUser(c.Request.Context(), sqlcdb.GetProjectByIDForUserParams{
		ProjectID: projectID,
		UserID:    userID,
	})
	if errors.Is(err, sql.ErrNoRows) {
		c.JSON(http.StatusNotFound, gin.H{"error": "Project not found"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}

	c.JSON(http.StatusOK, mapSQLCProject(projectRow))
}

func handleDeleteProject(c *gin.Context) {
	userID, ok := requireAuthenticatedUserUUID(c)
	if !ok {
		return
	}

	db := c.MustGet("db").(*database.DB)
	queries := sqlcdb.New(db.DB)

	projectID, ok := parseProjectIDParam(c)
	if !ok {
		return
	}

	ownerID, err := queries.GetProjectOwnerByID(c.Request.Context(), projectID)
	if errors.Is(err, sql.ErrNoRows) {
		c.JSON(http.StatusNotFound, gin.H{"error": "Project not found"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}

	if ownerID != userID {
		c.JSON(http.StatusForbidden, gin.H{"error": "Only project owners can delete projects"})
		return
	}

	deletedRows, err := queries.DeleteProjectByID(c.Request.Context(), projectID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete project"})
		return
	}
	if deletedRows == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Project not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Project deleted successfully"})
}

func requireAuthenticatedUserUUID(c *gin.Context) (uuid.UUID, bool) {
	userID, ok := requireAuthenticatedUserID(c)
	if !ok {
		return uuid.Nil, false
	}

	parsedUserID, err := uuid.Parse(userID)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user context"})
		return uuid.Nil, false
	}

	return parsedUserID, true
}

func parseProjectIDParam(c *gin.Context) (uuid.UUID, bool) {
	projectID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid project ID"})
		return uuid.Nil, false
	}
	return projectID, true
}

func mapProjectWithStatsRow(row sqlcdb.ListProjectsWithStatsByUserRow) ProjectWithStats {
	result := ProjectWithStats{
		Project: mapProjectFields(row.ID, row.Name, row.Description, row.OwnerID, row.CreatedAt, row.UpdatedAt),
		Stats: ProjectStats{
			ServiceCount:    int(row.ServiceCount),
			DeploymentCount: int(row.DeploymentCount),
			RunningServices: int(row.RunningServices),
			LastDeployment:  nullableTimestampStringPtr(row.LastDeployment),
		},
	}
	return result
}

func mapSQLCProject(project sqlcdb.Project) Project {
	return mapProjectFields(project.ID, project.Name, project.Description, project.OwnerID, project.CreatedAt, project.UpdatedAt)
}

func mapProjectFields(id uuid.UUID, name string, description sql.NullString, ownerID uuid.UUID, createdAt, updatedAt sql.NullTime) Project {
	return Project{
		ID:          id.String(),
		Name:        name,
		Description: nullableStringValue(description),
		OwnerID:     ownerID.String(),
		CreatedAt:   nullableTimestampString(createdAt),
		UpdatedAt:   nullableTimestampString(updatedAt),
	}
}

func nullableText(value string) sql.NullString {
	if value == "" {
		return sql.NullString{}
	}
	return sql.NullString{String: value, Valid: true}
}

func nullableStringValue(value sql.NullString) string {
	if value.Valid {
		return value.String
	}
	return ""
}

func nullableTimestampString(value sql.NullTime) string {
	if value.Valid {
		return value.Time.Format(time.RFC3339)
	}
	return ""
}

func nullableTimestampStringPtr(value sql.NullTime) *string {
	if value.Valid {
		formatted := value.Time.Format(time.RFC3339)
		return &formatted
	}
	return nil
}
