package api

import (
	"containr/internal/database"
	"context"
	"database/sql"
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
	Name        string `json:"name,omitempty"`
	Description string `json:"description,omitempty"`
}

func handleGetProjects(c *gin.Context) {
	userID := c.MustGet("user_id").(string)
	db := c.MustGet("db").(*database.DB)

	// Get pagination parameters
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))
	search := c.DefaultQuery("search", "")

	// Validate and limit pagination
	if page < 1 {
		page = 1
	}
	if limit > 100 || limit < 1 {
		limit = 10
	}
	offset := (page - 1) * limit

	// Use the optimized view for better performance
	var query string
	var args []interface{}

	if search != "" {
		// Search query with pattern matching
		query = `
			SELECT id, name, description, owner_id, created_at, updated_at
			FROM project_stats
			WHERE (owner_id = $1 OR id IN (
				SELECT DISTINCT project_id FROM project_members WHERE user_id = $1
			)) AND (name ILIKE $2 OR description ILIKE $2)
			ORDER BY updated_at DESC
			LIMIT $3 OFFSET $4
		`
		args = []interface{}{userID, "%" + search + "%", limit, offset}
	} else {
		// Optimized query using the view
		query = `
			SELECT id, name, description, owner_id, created_at, updated_at
			FROM project_stats
			WHERE owner_id = $1 OR id IN (
				SELECT DISTINCT project_id FROM project_members WHERE user_id = $1
			)
			ORDER BY updated_at DESC
			LIMIT $2 OFFSET $3
		`
		args = []interface{}{userID, limit, offset}
	}

	// Execute query with timeout context
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	rows, err := db.QueryContext(ctx, query, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database query error"})
		return
	}
	defer rows.Close()

	var projects []ProjectWithStats
	for rows.Next() {
		var project ProjectWithStats
		if err := rows.Scan(&project.ID, &project.Name, &project.Description, &project.OwnerID, &project.CreatedAt, &project.UpdatedAt); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Database scan error"})
			return
		}
		projects = append(projects, project)
	}

	// Get total count with optimized query
	var totalQuery string
	var totalArgs []interface{}

	if search != "" {
		totalQuery = `
			SELECT COUNT(DISTINCT id)
			FROM project_stats
			WHERE (owner_id = $1 OR id IN (
				SELECT DISTINCT project_id FROM project_members WHERE user_id = $1
			)) AND (name ILIKE $2 OR description ILIKE $2)
		`
		totalArgs = []interface{}{userID, "%" + search + "%"}
	} else {
		totalQuery = `
			SELECT COUNT(DISTINCT id)
			FROM project_stats
			WHERE owner_id = $1 OR id IN (
				SELECT DISTINCT project_id FROM project_members WHERE user_id = $1
			)
		`
		totalArgs = []interface{}{userID}
	}

	var total int
	err = db.QueryRowContext(ctx, totalQuery, totalArgs...).Scan(&total)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database count error"})
		return
	}

	// Batch fetch stats for all projects
	if len(projects) > 0 {
		projectIDs := make([]string, len(projects))
		for i, p := range projects {
			projectIDs[i] = p.ID
		}

		statsMap := getBatchProjectStats(ctx, db, projectIDs)

		for i := range projects {
			if stats, exists := statsMap[projects[i].ID]; exists {
				projects[i].Stats = stats
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"projects": projects,
		"pagination": gin.H{
			"page":  page,
			"limit": limit,
			"total": total,
			"pages": (total + limit - 1) / limit,
		},
	})
}

// getBatchProjectStats fetches stats for multiple projects efficiently
func getBatchProjectStats(ctx context.Context, db *database.DB, projectIDs []string) map[string]ProjectStats {
	if len(projectIDs) == 0 {
		return make(map[string]ProjectStats)
	}

	// Create placeholders for IN clause
	placeholders := make([]string, len(projectIDs))
	args := make([]interface{}, len(projectIDs))
	for i, id := range projectIDs {
		placeholders[i] = "$" + strconv.Itoa(i+1)
		args[i] = id
	}

	query := `
		SELECT 
			project_id,
			COUNT(DISTINCT id) as service_count,
			COUNT(DISTINCT deployment_id) as deployment_count,
			COUNT(DISTINCT CASE WHEN status = 'running' THEN id END) as running_services,
			MAX(last_deployment) as last_deployment
		FROM (
			SELECT 
				s.project_id,
				s.id,
				d.id as deployment_id,
				s.status,
				d.created_at as last_deployment
			FROM services s
			LEFT JOIN deployments d ON s.id = d.service_id
			WHERE s.project_id IN (` + strings.Join(placeholders, ",") + `)
		) sub
		GROUP BY project_id
	`

	rows, err := db.QueryContext(ctx, query, args...)
	if err != nil {
		return make(map[string]ProjectStats)
	}
	defer rows.Close()

	statsMap := make(map[string]ProjectStats)
	for rows.Next() {
		var projectID string
		var stats ProjectStats
		var lastDeployment sql.NullTime

		err := rows.Scan(&projectID, &stats.ServiceCount, &stats.DeploymentCount, &stats.RunningServices, &lastDeployment)
		if err != nil {
			continue
		}

		if lastDeployment.Valid {
			deploymentStr := lastDeployment.Time.Format(time.RFC3339)
			stats.LastDeployment = &deploymentStr
		}

		statsMap[projectID] = stats
	}

	return statsMap
}

func handleCreateProject(c *gin.Context) {
	userID := c.MustGet("user_id").(string)
	db := c.MustGet("db").(*database.DB)

	var req CreateProjectRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var project Project
	err := db.QueryRow(`
		INSERT INTO projects (name, description, owner_id) 
		VALUES ($1, $2, $3) 
		RETURNING id, name, description, owner_id, created_at, updated_at
	`, req.Name, req.Description, userID).Scan(&project.ID, &project.Name, &project.Description, &project.OwnerID, &project.CreatedAt, &project.UpdatedAt)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create project"})
		return
	}

	// Create default environments
	environments := []string{"production", "preview", "development"}
	for _, env := range environments {
		_, err = db.Exec(`
			INSERT INTO environments (name, project_id) 
			VALUES ($1, $2)
		`, env, project.ID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create environments"})
			return
		}
	}

	c.JSON(http.StatusCreated, project)
}

func handleGetProject(c *gin.Context) {
	userID := c.MustGet("user_id").(string)
	db := c.MustGet("db").(*database.DB)
	projectID := c.Param("id")

	// Validate UUID
	if _, err := uuid.Parse(projectID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid project ID"})
		return
	}

	var project Project
	err := db.QueryRow(`
		SELECT p.id, p.name, p.description, p.owner_id, p.created_at, p.updated_at
		FROM projects p
		WHERE p.id = $1 AND (p.owner_id = $2 OR EXISTS (
			SELECT 1 FROM project_members pm 
			WHERE pm.project_id = p.id AND pm.user_id = $2
		))
	`, projectID, userID).Scan(&project.ID, &project.Name, &project.Description, &project.OwnerID, &project.CreatedAt, &project.UpdatedAt)

	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "Project not found"})
		return
	} else if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}

	c.JSON(http.StatusOK, project)
}

func handleUpdateProject(c *gin.Context) {
	userID := c.MustGet("user_id").(string)
	db := c.MustGet("db").(*database.DB)
	projectID := c.Param("id")

	// Validate UUID
	if _, err := uuid.Parse(projectID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid project ID"})
		return
	}

	// Check if user is owner or admin
	var role string
	err := db.QueryRow(`
		SELECT CASE 
			WHEN p.owner_id = $1 THEN 'owner'
			ELSE pm.role
		END as role
		FROM projects p
		LEFT JOIN project_members pm ON p.id = pm.project_id AND pm.user_id = $1
		WHERE p.id = $2
	`, userID, projectID).Scan(&role)

	if err == sql.ErrNoRows || role == "" || role == "viewer" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Insufficient permissions"})
		return
	} else if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}

	var req UpdateProjectRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	_, err = db.Exec(`
		UPDATE projects 
		SET name = COALESCE($1, name), description = COALESCE($2, description)
		WHERE id = $3
	`, req.Name, req.Description, projectID)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update project"})
		return
	}

	// Return updated project
	handleGetProject(c)
}

func handleDeleteProject(c *gin.Context) {
	userID := c.MustGet("user_id").(string)
	db := c.MustGet("db").(*database.DB)
	projectID := c.Param("id")

	// Validate UUID
	if _, err := uuid.Parse(projectID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid project ID"})
		return
	}

	// Check if user is owner
	var ownerID string
	err := db.QueryRow("SELECT owner_id FROM projects WHERE id = $1", projectID).Scan(&ownerID)

	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "Project not found"})
		return
	} else if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}

	if ownerID != userID {
		c.JSON(http.StatusForbidden, gin.H{"error": "Only project owners can delete projects"})
		return
	}

	// Delete project (cascading deletes will handle related records)
	_, err = db.Exec("DELETE FROM projects WHERE id = $1", projectID)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete project"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Project deleted successfully"})
}
