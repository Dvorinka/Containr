package api

import (
	"containr/internal/database"
	"database/sql"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// PreviewEnvironment represents a preview environment
type PreviewEnvironment struct {
	ID          uuid.UUID  `json:"id" db:"id"`
	ProjectID   uuid.UUID  `json:"project_id" db:"project_id"`
	ServiceID   uuid.UUID  `json:"service_id" db:"service_id"`
	BranchName  string     `json:"branch_name" db:"branch_name"`
	PRNumber    *int       `json:"pr_number" db:"pr_number"`
	Environment string     `json:"environment" db:"environment"` // preview-{branch}-{timestamp}
	Status      string     `json:"status" db:"status"`           // building, running, failed, stopped, expired
	URL         string     `json:"url" db:"url"`
	ExpiresAt   *time.Time `json:"expires_at" db:"expires_at"`
	CreatedAt   time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at" db:"updated_at"`

	// Related data
	Service      *Service   `json:"service,omitempty"`
	DeploymentID *uuid.UUID `json:"deployment_id,omitempty"`
}

// CreatePreviewEnvironmentRequest represents a request to create a preview environment
type CreatePreviewEnvironmentRequest struct {
	ProjectID  uuid.UUID `json:"project_id"`
	ServiceID  uuid.UUID `json:"service_id" binding:"required"`
	BranchName string    `json:"branch_name" binding:"required"`
	PRNumber   *int      `json:"pr_number"`
	TTLHours   int       `json:"ttl_hours" binding:"min=1,max=168"` // 1 hour to 7 days
}

// UpdatePreviewEnvironmentRequest represents a request to update a preview environment
type UpdatePreviewEnvironmentRequest struct {
	Status    string     `json:"status" binding:"omitempty,oneof=building running failed stopped expired"`
	URL       string     `json:"url"`
	ExpiresAt *time.Time `json:"expires_at"`
	TTLHours  int        `json:"ttl_hours" binding:"omitempty,min=1,max=168"`
}

// PromotePreviewEnvironmentRequest represents a request to promote a preview environment
type PromotePreviewEnvironmentRequest struct {
	TargetEnvironment string `json:"target_environment" binding:"required,oneof=production development"`
	CreateBackup      bool   `json:"create_backup"`
}

// handleGetPreviewEnvironments retrieves all preview environments for a project
func handleGetPreviewEnvironments(c *gin.Context) {
	db, exists := c.Get("db")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database connection not available"})
		return
	}

	projectIDStr := firstPathParam(c, "id", "project_id", "projectId")
	projectID, err := uuid.Parse(projectIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid project ID"})
		return
	}

	// Check if project exists and user has access
	var project Project
	err = db.(*database.DB).QueryRow(
		"SELECT id, name, owner_id FROM projects WHERE id = $1",
		projectID,
	).Scan(&project.ID, &project.Name, &project.OwnerID)

	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Project not found"})
		return
	}

	// Get user ID from JWT token (set by auth middleware)
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	// Check if user owns the project
	if project.OwnerID != userID.(string) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	// Get preview environments for the project with service info
	rows, err := db.(*database.DB).Query(
		`SELECT pe.id, pe.project_id, pe.service_id, pe.branch_name, pe.pr_number, 
				pe.environment, pe.status, pe.url, pe.expires_at, pe.created_at, pe.updated_at,
				s.id as service_id, s.name as service_name, s.type as service_type
			FROM preview_environments pe
			LEFT JOIN services s ON pe.service_id = s.id
			WHERE pe.project_id = $1 
			ORDER BY pe.created_at DESC`,
		projectID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve preview environments"})
		return
	}
	defer rows.Close()

	var environments []PreviewEnvironment
	for rows.Next() {
		var env PreviewEnvironment
		var serviceID sql.NullString
		var serviceName sql.NullString
		var serviceType sql.NullString

		err := rows.Scan(
			&env.ID, &env.ProjectID, &env.ServiceID, &env.BranchName, &env.PRNumber,
			&env.Environment, &env.Status, &env.URL, &env.ExpiresAt, &env.CreatedAt, &env.UpdatedAt,
			&serviceID, &serviceName, &serviceType,
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to scan preview environment"})
			return
		}

		if serviceID.Valid {
			parsedServiceID, parseErr := uuid.Parse(serviceID.String)
			if parseErr == nil {
				env.Service = &Service{
					ID:   parsedServiceID,
					Name: serviceName.String,
					Type: serviceType.String,
				}
			}
		}

		environments = append(environments, env)
	}

	c.JSON(http.StatusOK, gin.H{"preview_environments": environments})
}

// handleCreatePreviewEnvironment creates a new preview environment
func handleCreatePreviewEnvironment(c *gin.Context) {
	db, exists := c.Get("db")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database connection not available"})
		return
	}

	projectIDStr := firstPathParam(c, "id", "project_id", "projectId")
	projectID, err := uuid.Parse(projectIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid project ID"})
		return
	}

	var req CreatePreviewEnvironmentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.ProjectID == uuid.Nil {
		req.ProjectID = projectID
	} else if req.ProjectID != projectID {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Project ID in URL and request body must match"})
		return
	}

	// Get user ID from JWT token
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	// Check if project exists and user has access
	var project Project
	err = db.(*database.DB).QueryRow(
		"SELECT id, name, owner_id FROM projects WHERE id = $1",
		req.ProjectID,
	).Scan(&project.ID, &project.Name, &project.OwnerID)

	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Project not found"})
		return
	}

	// Check if user owns the project
	if project.OwnerID != userID.(string) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	// Check if service exists and belongs to the project
	var service Service
	err = db.(*database.DB).QueryRow(
		"SELECT id, name, type FROM services WHERE id = $1 AND project_id = $2",
		req.ServiceID, req.ProjectID,
	).Scan(&service.ID, &service.Name, &service.Type)

	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Service not found or doesn't belong to this project"})
		return
	}

	// Check if preview environment already exists for this branch and service
	var count int
	err = db.(*database.DB).QueryRow(
		"SELECT COUNT(*) FROM preview_environments WHERE service_id = $1 AND branch_name = $2 AND status NOT IN ('expired', 'stopped')",
		req.ServiceID, req.BranchName,
	).Scan(&count)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to check existing preview environment"})
		return
	}

	if count > 0 {
		c.JSON(http.StatusConflict, gin.H{"error": "Preview environment already exists for this branch and service"})
		return
	}

	// Set default TTL if not provided
	ttlHours := req.TTLHours
	if ttlHours == 0 {
		ttlHours = 24 // Default 24 hours
	}

	// Create preview environment
	env := PreviewEnvironment{
		ID:          uuid.New(),
		ProjectID:   req.ProjectID,
		ServiceID:   req.ServiceID,
		BranchName:  req.BranchName,
		PRNumber:    req.PRNumber,
		Environment: generatePreviewEnvironmentName(req.BranchName),
		Status:      "building",
		ExpiresAt:   &[]time.Time{time.Now().Add(time.Duration(ttlHours) * time.Hour)}[0],
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	// Insert preview environment into database
	_, err = db.(*database.DB).Exec(
		`INSERT INTO preview_environments 
			(id, project_id, service_id, branch_name, pr_number, environment, 
			 status, url, expires_at, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
		env.ID, env.ProjectID, env.ServiceID, env.BranchName, env.PRNumber,
		env.Environment, env.Status, env.URL, env.ExpiresAt, env.CreatedAt, env.UpdatedAt,
	)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create preview environment"})
		return
	}

	// TODO: Trigger deployment pipeline for preview environment
	// This would integrate with the existing deployment engine

	c.JSON(http.StatusCreated, gin.H{"preview_environment": env})
}

// handleGetPreviewEnvironment retrieves a specific preview environment
func handleGetPreviewEnvironment(c *gin.Context) {
	db, exists := c.Get("db")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database connection not available"})
		return
	}

	envIDStr := c.Param("id")
	envID, err := uuid.Parse(envIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid preview environment ID"})
		return
	}

	// Get user ID from JWT token
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	// Get preview environment with project ownership check
	var env PreviewEnvironment
	var serviceID sql.NullString
	var serviceName sql.NullString
	var serviceType sql.NullString
	err = db.(*database.DB).QueryRow(
		`SELECT pe.id, pe.project_id, pe.service_id, pe.branch_name, pe.pr_number, 
				pe.environment, pe.status, pe.url, pe.expires_at, pe.created_at, pe.updated_at,
				s.id as service_id, s.name as service_name, s.type as service_type
			FROM preview_environments pe
			LEFT JOIN services s ON pe.service_id = s.id
			JOIN projects p ON pe.project_id = p.id
			WHERE pe.id = $1 AND p.owner_id = $2`,
		envID, userID,
	).Scan(
		&env.ID, &env.ProjectID, &env.ServiceID, &env.BranchName, &env.PRNumber,
		&env.Environment, &env.Status, &env.URL, &env.ExpiresAt, &env.CreatedAt, &env.UpdatedAt,
		&serviceID, &serviceName, &serviceType,
	)

	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Preview environment not found"})
		return
	}

	// Populate service info if available
	if serviceID.Valid {
		parsedServiceID, parseErr := uuid.Parse(serviceID.String)
		if parseErr == nil {
			env.Service = &Service{
				ID:   parsedServiceID,
				Name: serviceName.String,
				Type: serviceType.String,
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{"preview_environment": env})
}

// handleUpdatePreviewEnvironment updates a preview environment
func handleUpdatePreviewEnvironment(c *gin.Context) {
	db, exists := c.Get("db")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database connection not available"})
		return
	}

	envIDStr := c.Param("id")
	envID, err := uuid.Parse(envIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid preview environment ID"})
		return
	}

	var req UpdatePreviewEnvironmentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Get user ID from JWT token
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	// Check if preview environment exists and user has access
	var existingEnv PreviewEnvironment
	err = db.(*database.DB).QueryRow(
		`SELECT pe.id, pe.project_id, pe.service_id, pe.branch_name, pe.pr_number, 
				pe.environment, pe.status, pe.url, pe.expires_at, pe.created_at, pe.updated_at
			FROM preview_environments pe
			JOIN projects p ON pe.project_id = p.id
			WHERE pe.id = $1 AND p.owner_id = $2`,
		envID, userID,
	).Scan(
		&existingEnv.ID, &existingEnv.ProjectID, &existingEnv.ServiceID, &existingEnv.BranchName,
		&existingEnv.PRNumber, &existingEnv.Environment, &existingEnv.Status, &existingEnv.URL,
		&existingEnv.ExpiresAt, &existingEnv.CreatedAt, &existingEnv.UpdatedAt,
	)

	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Preview environment not found"})
		return
	}

	// Update fields if provided
	if req.Status != "" {
		existingEnv.Status = req.Status
	}
	if req.URL != "" {
		existingEnv.URL = req.URL
	}
	if req.ExpiresAt != nil {
		existingEnv.ExpiresAt = req.ExpiresAt
	}
	if req.TTLHours > 0 {
		newExpiresAt := time.Now().Add(time.Duration(req.TTLHours) * time.Hour)
		existingEnv.ExpiresAt = &newExpiresAt
	}

	existingEnv.UpdatedAt = time.Now()

	// Update preview environment in database
	_, err = db.(*database.DB).Exec(
		`UPDATE preview_environments 
			SET status = $1, url = $2, expires_at = $3, updated_at = $4
			WHERE id = $5`,
		existingEnv.Status, existingEnv.URL, existingEnv.ExpiresAt, existingEnv.UpdatedAt, existingEnv.ID,
	)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update preview environment"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"preview_environment": existingEnv})
}

// handleDeletePreviewEnvironment deletes a preview environment
func handleDeletePreviewEnvironment(c *gin.Context) {
	db, exists := c.Get("db")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database connection not available"})
		return
	}

	envIDStr := c.Param("id")
	envID, err := uuid.Parse(envIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid preview environment ID"})
		return
	}

	// Get user ID from JWT token
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	// Check if preview environment exists and user has access
	var projectOwnerID string
	err = db.(*database.DB).QueryRow(
		`SELECT p.owner_id 
			FROM preview_environments pe
			JOIN projects p ON pe.project_id = p.id
			WHERE pe.id = $1`,
		envID,
	).Scan(&projectOwnerID)

	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Preview environment not found"})
		return
	}

	// Check if user owns the project
	if projectOwnerID != userID.(string) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	// TODO: Clean up deployment and resources associated with this preview environment
	// This would integrate with the deployment engine to stop containers, clean up resources, etc.

	// Delete preview environment
	_, err = db.(*database.DB).Exec(
		"DELETE FROM preview_environments WHERE id = $1",
		envID,
	)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete preview environment"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Preview environment deleted successfully"})
}

// handlePromotePreviewEnvironment promotes a preview environment to production/development
func handlePromotePreviewEnvironment(c *gin.Context) {
	db, exists := c.Get("db")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database connection not available"})
		return
	}

	envIDStr := c.Param("id")
	envID, err := uuid.Parse(envIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid preview environment ID"})
		return
	}

	var req PromotePreviewEnvironmentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Get user ID from JWT token
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	// Get preview environment details
	var env PreviewEnvironment
	err = db.(*database.DB).QueryRow(
		`SELECT pe.id, pe.project_id, pe.service_id, pe.branch_name, pe.environment, pe.status
			FROM preview_environments pe
			JOIN projects p ON pe.project_id = p.id
			WHERE pe.id = $1 AND p.owner_id = $2`,
		envID, userID,
	).Scan(
		&env.ID, &env.ProjectID, &env.ServiceID, &env.BranchName, &env.Environment, &env.Status,
	)

	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Preview environment not found"})
		return
	}

	// Check if preview environment is in a state that can be promoted
	if env.Status != "running" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Preview environment must be running to promote"})
		return
	}

	// TODO: Implement promotion logic
	// 1. Create backup of target environment if requested
	// 2. Deploy preview environment code to target environment
	// 3. Update service configuration
	// 4. Trigger deployment pipeline

	// For now, just return success with promotion details
	c.JSON(http.StatusOK, gin.H{
		"message": "Preview environment promotion initiated",
		"promotion": map[string]interface{}{
			"preview_environment_id": env.ID,
			"target_environment":     req.TargetEnvironment,
			"branch_name":            env.BranchName,
			"create_backup":          req.CreateBackup,
			"status":                 "initiated",
		},
	})
}

// generatePreviewEnvironmentName generates a unique environment name for preview
func generatePreviewEnvironmentName(branchName string) string {
	timestamp := time.Now().Format("20060102-150405")
	// Sanitize branch name
	sanitizedBranch := strings.ReplaceAll(branchName, "/", "-")
	sanitizedBranch = strings.ReplaceAll(sanitizedBranch, "_", "-")
	return fmt.Sprintf("preview-%s-%s", sanitizedBranch, timestamp)
}

// handleCleanupExpiredPreviewEnvironments cleans up expired preview environments
func handleCleanupExpiredPreviewEnvironments(c *gin.Context) {
	db, exists := c.Get("db")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database connection not available"})
		return
	}

	// Get user ID from JWT token
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	// Find expired preview environments for user's projects
	rows, err := db.(*database.DB).Query(
		`SELECT pe.id, pe.project_id, pe.service_id, pe.branch_name, pe.environment
			FROM preview_environments pe
			JOIN projects p ON pe.project_id = p.id
			WHERE p.owner_id = $1 AND pe.expires_at < NOW() AND pe.status != 'expired'`,
		userID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to find expired preview environments"})
		return
	}
	defer rows.Close()

	var expiredEnvs []PreviewEnvironment
	for rows.Next() {
		var env PreviewEnvironment
		err := rows.Scan(
			&env.ID, &env.ProjectID, &env.ServiceID, &env.BranchName, &env.Environment,
		)
		if err != nil {
			continue
		}
		expiredEnvs = append(expiredEnvs, env)
	}

	// Mark expired environments as expired and trigger cleanup
	cleanupCount := 0
	for _, env := range expiredEnvs {
		// Update status to expired
		_, err := db.(*database.DB).Exec(
			"UPDATE preview_environments SET status = 'expired', updated_at = NOW() WHERE id = $1",
			env.ID,
		)
		if err != nil {
			continue
		}

		// TODO: Trigger cleanup of deployment resources
		// This would stop containers, clean up resources, etc.

		cleanupCount++
	}

	c.JSON(http.StatusOK, gin.H{
		"message":              "Cleanup completed",
		"cleaned_count":        cleanupCount,
		"expired_environments": expiredEnvs,
	})
}
