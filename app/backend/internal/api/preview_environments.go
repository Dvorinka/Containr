package api

import (
	"containr/internal/database"
	"containr/internal/database/sqlcdb"
	"containr/internal/deployment"
	"containr/internal/deployqueue"
	"context"
	"database/sql"
	"encoding/json"
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

	// PreviewServiceID is the cloned service this preview actually deploys;
	// its status is the source of truth while the preview is active.
	PreviewServiceID *uuid.UUID `json:"preview_service_id,omitempty" db:"preview_service_id"`

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

	// Approved projects are public; unapproved ones need owner/member/admin.
	projectExists, allowed := projectReadAccess(c, db.(*database.DB), projectID)
	if !projectExists || !allowed {
		c.JSON(http.StatusNotFound, gin.H{"error": "Project not found"})
		return
	}

	// Get preview environments for the project with service info
	rows, err := db.(*database.DB).Query(
		`SELECT pe.id, pe.project_id, pe.service_id, pe.preview_service_id, pe.branch_name, pe.pr_number,
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
			&env.ID, &env.ProjectID, &env.ServiceID, &env.PreviewServiceID, &env.BranchName, &env.PRNumber,
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
	if project.OwnerID != userID.(string) && !contextIsAdmin(c) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	// Check if service exists and belongs to the project
	var service Service
	err = db.(*database.DB).QueryRow(
		"SELECT id, name, COALESCE(type, service_type, '') FROM services WHERE id = $1 AND project_id = $2",
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

	// A preview is a real service: clone the source, pin it to the
	// requested branch, swap its domains for a preview hostname, and run a
	// normal deployment through the queue. Expiry sweeps the clone away.
	envName := generatePreviewEnvironmentName(req.BranchName)
	cloneName := previewServiceName(service.Name, req.BranchName)
	cloneID, err := cloneServiceRow(db.(*database.DB), req.ServiceID, req.ProjectID, cloneName, "")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to clone service for preview"})
		return
	}

	// The clone's branch override is what makes it a preview — everything
	// else (env vars, volumes, builder, resources) stays identical.
	if _, err := db.(*database.DB).Exec(
		`UPDATE services SET git_branch = $1, domain = '', updated_at = NOW() WHERE id = $2`,
		req.BranchName, cloneID,
	); err != nil {
		_, _ = db.(*database.DB).Exec(`DELETE FROM services WHERE id = $1`, cloneID)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to configure preview service"})
		return
	}
	// Cloned service_domains would collide with the parent's Traefik
	// router — previews get their own hostname or none.
	if _, err := db.(*database.DB).Exec(
		`DELETE FROM service_domains WHERE service_id = $1`, cloneID,
	); err != nil {
		_, _ = db.(*database.DB).Exec(`DELETE FROM services WHERE id = $1`, cloneID)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to configure preview domains"})
		return
	}
	previewHost := resolvePreviewHost(db.(*database.DB), cloneID, envName)
	if previewHost != "" {
		_, _ = db.(*database.DB).Exec(
			`INSERT INTO service_domains (service_id, domain, is_default, cert_type) VALUES ($1, $2, true, 'tls')`,
			cloneID, previewHost,
		)
	}

	expiresAt := time.Now().Add(time.Duration(ttlHours) * time.Hour)
	env := PreviewEnvironment{
		ID:          uuid.New(),
		ProjectID:   req.ProjectID,
		ServiceID:   req.ServiceID,
		BranchName:  req.BranchName,
		PRNumber:    req.PRNumber,
		Environment: envName,
		Status:      "building",
		ExpiresAt:   &expiresAt,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}
	if previewHost != "" {
		env.URL = "https://" + previewHost
	}

	_, err = db.(*database.DB).Exec(
		`INSERT INTO preview_environments
			(id, project_id, service_id, preview_service_id, branch_name, pr_number, environment,
			 status, url, expires_at, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
		env.ID, env.ProjectID, env.ServiceID, cloneID, env.BranchName, env.PRNumber,
		env.Environment, env.Status, env.URL, env.ExpiresAt, env.CreatedAt, env.UpdatedAt,
	)
	if err != nil {
		_, _ = db.(*database.DB).Exec(`DELETE FROM services WHERE id = $1`, cloneID)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create preview environment"})
		return
	}

	deploymentID := uuid.New()
	_, err = db.(*database.DB).Exec(
		`INSERT INTO deployments
			(id, service_id, version, commit_hash, status, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, 'pending', NOW(), NOW())`,
		deploymentID, cloneID, "preview-"+env.Environment, req.BranchName,
	)
	if err != nil {
		_, _ = db.(*database.DB).Exec(`DELETE FROM preview_environments WHERE id = $1`, env.ID)
		_, _ = db.(*database.DB).Exec(`DELETE FROM services WHERE id = $1`, cloneID)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to provision preview deployment"})
		return
	}
	env.DeploymentID = &deploymentID

	if engineValue, exists := c.Get("deployment_engine"); exists && engineValue != nil {
		if engine, ok := engineValue.(*deployment.DeploymentEngine); ok {
			cloneService, loadErr := loadServiceForDeploy(db.(*database.DB), cloneID)
			if loadErr == nil {
				engineInstance := engine
				d := DeploymentModel{ID: deploymentID, ServiceID: cloneID, Status: "pending", CreatedAt: time.Now(), UpdatedAt: time.Now()}
				getDeployQueue(c).Enqueue(cloneID, deployqueue.Job{
					DeploymentID: deploymentID,
					Run: func(jctx context.Context) {
						runDeploymentAndSync(jctx, db.(*database.DB), engineInstance, &d, cloneService, CreateDeploymentRequest{Branch: req.BranchName, Trigger: "preview"}, userID.(string))
					},
				})
			}
		}
	}

	LogAuditWithRequest(c, "service", req.ServiceID.String(), "preview.create", map[string]interface{}{
		"preview_environment_id": env.ID.String(),
		"preview_service_id":     cloneID.String(),
		"branch":                 req.BranchName,
	})
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

	// Public when the parent project is approved; otherwise owner/member/admin.
	userID := optionalUserUUID(c)
	var env PreviewEnvironment
	var serviceID sql.NullString
	var serviceName sql.NullString
	var serviceType sql.NullString
	err = db.(*database.DB).QueryRow(
		`SELECT pe.id, pe.project_id, pe.service_id, pe.preview_service_id, pe.branch_name, pe.pr_number,
				pe.environment, pe.status, pe.url, pe.expires_at, pe.created_at, pe.updated_at,
				s.id as service_id, s.name as service_name, s.type as service_type
			FROM preview_environments pe
			LEFT JOIN services s ON pe.service_id = s.id
			JOIN projects p ON pe.project_id = p.id
			WHERE pe.id = $1 AND (p.is_approved OR p.owner_id = $2 OR $3::bool
				OR EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = $2))`,
		envID, userID, contextIsAdmin(c),
	).Scan(
		&env.ID, &env.ProjectID, &env.ServiceID, &env.PreviewServiceID, &env.BranchName, &env.PRNumber,
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
			WHERE pe.id = $1 AND (p.owner_id = $2 OR $3::bool)`,
		envID, userID, contextIsAdmin(c),
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
	if projectOwnerID != userID.(string) && !contextIsAdmin(c) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	// Tear down the clone's runtime and row — the preview is the clone.
	var cloneID *uuid.UUID
	_ = db.(*database.DB).QueryRow(
		`SELECT preview_service_id FROM preview_environments WHERE id = $1`, envID,
	).Scan(&cloneID)
	if cloneID != nil {
		if engineValue, exists := c.Get("deployment_engine"); exists && engineValue != nil {
			if engine, ok := engineValue.(*deployment.DeploymentEngine); ok {
				removeServiceRuntime(c.Request.Context(), db.(*database.DB), engine, *cloneID)
			}
		}
		_, _ = db.(*database.DB).Exec(`DELETE FROM services WHERE id = $1`, *cloneID)
	}

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
		`SELECT pe.id, pe.project_id, pe.service_id, pe.preview_service_id, pe.branch_name, pe.environment, pe.status
			FROM preview_environments pe
			JOIN projects p ON pe.project_id = p.id
			WHERE pe.id = $1 AND (p.owner_id = $2 OR $3::bool)`,
		envID, userID, contextIsAdmin(c),
	).Scan(
		&env.ID, &env.ProjectID, &env.ServiceID, &env.PreviewServiceID, &env.BranchName, &env.Environment, &env.Status,
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

	// Promote is a real redeploy: the source service builds the preview's
	// branch onto its own deployment track.
	deploymentID := uuid.New()
	promotionVersion := fmt.Sprintf("promote-%s-%d", strings.ReplaceAll(env.BranchName, "/", "-"), time.Now().Unix())
	_, err = db.(*database.DB).Exec(
		`INSERT INTO deployments (id, service_id, version, commit_hash, status, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, 'pending', NOW(), NOW())`,
		deploymentID, env.ServiceID, promotionVersion, env.BranchName,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create promotion deployment"})
		return
	}

	sourceService, loadErr := loadServiceForDeploy(db.(*database.DB), env.ServiceID)
	if loadErr != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load promotion target service"})
		return
	}
	if engineValue, exists := c.Get("deployment_engine"); exists && engineValue != nil {
		if engine, ok := engineValue.(*deployment.DeploymentEngine); ok {
			engineInstance := engine
			d := DeploymentModel{ID: deploymentID, ServiceID: env.ServiceID, Status: "pending", CreatedAt: time.Now(), UpdatedAt: time.Now()}
			getDeployQueue(c).Enqueue(env.ServiceID, deployqueue.Job{
				DeploymentID: deploymentID,
				Run: func(jctx context.Context) {
					runDeploymentAndSync(jctx, db.(*database.DB), engineInstance, &d, sourceService, CreateDeploymentRequest{Branch: env.BranchName, Trigger: "promote"}, userID.(string))
				},
			})
		}
	}

	// Promotion retires the preview — the clone's containers and row go.
	if env.PreviewServiceID != nil {
		if engineValue, exists := c.Get("deployment_engine"); exists && engineValue != nil {
			if engine, ok := engineValue.(*deployment.DeploymentEngine); ok {
				removeServiceRuntime(c.Request.Context(), db.(*database.DB), engine, *env.PreviewServiceID)
			}
		}
		_, _ = db.(*database.DB).Exec(`DELETE FROM services WHERE id = $1`, *env.PreviewServiceID)
	}

	if _, err := db.(*database.DB).Exec(
		`UPDATE preview_environments
		 SET status = 'stopped', updated_at = NOW()
		 WHERE id = $1`,
		env.ID,
	); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update preview environment status"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Preview environment promoted successfully",
		"promotion": map[string]interface{}{
			"preview_environment_id": env.ID,
			"target_environment":     req.TargetEnvironment,
			"branch_name":            env.BranchName,
			"create_backup":          req.CreateBackup,
			"deployment_id":          deploymentID,
			"status":                 "queued",
			"preview_status":         "stopped",
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
		`SELECT pe.id, pe.project_id, pe.service_id, pe.preview_service_id, pe.branch_name, pe.environment
			FROM preview_environments pe
			JOIN projects p ON pe.project_id = p.id
			WHERE (p.owner_id = $1 OR $2::bool) AND pe.expires_at < NOW() AND pe.status != 'expired'`,
		userID, contextIsAdmin(c),
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
			&env.ID, &env.ProjectID, &env.ServiceID, &env.PreviewServiceID, &env.BranchName, &env.Environment,
		)
		if err != nil {
			continue
		}
		expiredEnvs = append(expiredEnvs, env)
	}

	// Mark expired environments as expired and tear down their clones
	cleanupCount := 0
	for _, env := range expiredEnvs {
		_, err := db.(*database.DB).Exec(
			"UPDATE preview_environments SET status = 'expired', updated_at = NOW() WHERE id = $1",
			env.ID,
		)
		if err != nil {
			continue
		}
		if env.PreviewServiceID != nil {
			if engineValue, exists := c.Get("deployment_engine"); exists && engineValue != nil {
				if engine, ok := engineValue.(*deployment.DeploymentEngine); ok {
					removeServiceRuntime(c.Request.Context(), db.(*database.DB), engine, *env.PreviewServiceID)
				}
			}
			_, _ = db.(*database.DB).Exec(`DELETE FROM services WHERE id = $1`, *env.PreviewServiceID)
		}
		cleanupCount++
	}

	c.JSON(http.StatusOK, gin.H{
		"message":              "Cleanup completed",
		"cleaned_count":        cleanupCount,
		"expired_environments": expiredEnvs,
	})
}

// previewServiceName builds the clone's service name — deterministic enough
// to spot in lists, short enough for dnsLabel-derived hostnames.
func previewServiceName(serviceName, branch string) string {
	label := dnsLabel(serviceName + "-" + branch)
	if label == "" {
		return "preview-" + uuid.NewString()[:8]
	}
	return label + "-preview"
}

// resolvePreviewHost picks a preview hostname under the clone's node default
// domain — same source as serviceAutoDomains. Returns "" when no node
// carries a default domain; the preview still runs, reachable internally.
func resolvePreviewHost(db *database.DB, cloneID uuid.UUID, envName string) string {
	label := dnsLabel(envName)
	if label == "" {
		return ""
	}
	var nodeID sql.NullString
	var spread bool
	if err := db.QueryRow(
		`SELECT node_id, COALESCE(spread, false) FROM services WHERE id = $1`, cloneID,
	).Scan(&nodeID, &spread); err != nil {
		return ""
	}
	q := sqlcdb.New(db.DB)
	ctx := context.Background()
	var base string
	switch {
	case nodeID.Valid && nodeID.String != "":
		if a, err := q.GetAgent(ctx, nodeID.String); err == nil {
			base = a.DefaultDomain
		}
	case spread:
		if bases, err := q.ListSchedulableAgentDomains(ctx, json.RawMessage(tagsJSON(servicePlacementTags(db, cloneID)))); err == nil && len(bases) > 0 {
			base = bases[0]
		}
	default:
		// Local preview: borrow the first node default domain if any —
		// still better than no hostname for a Traefik-fronted local host.
		if bases, err := q.ListSchedulableAgentDomains(ctx, json.RawMessage("[]")); err == nil && len(bases) > 0 {
			base = bases[0]
		}
	}
	if base == "" {
		return ""
	}
	return label + "." + base
}

// loadServiceForDeploy hydrates the Service fields runDeploymentAndSync
// needs — mirrors the loader in handleDeployService.
func loadServiceForDeploy(db *database.DB, serviceID uuid.UUID) (Service, error) {
	var service Service
	err := db.QueryRow(
		`SELECT s.id, s.project_id, s.name, s.type, s.status, s.image, s.command,
		        s.environment, s.git_repo, s.git_branch, s.build_path, s.cpu, s.memory,
		        COALESCE(s.replicas, 1), COALESCE(s.port, 0),
		        COALESCE(s.domain, ''), COALESCE(s.healthcheck_path, ''),
		        COALESCE(s.restart_policy, 'unless-stopped'),
		        COALESCE(s.builder, 'auto'), COALESCE(s.cpu_reserve, ''),
		        COALESCE(s.memory_reserve, ''), COALESCE(s.static_build_cmd, ''),
		        COALESCE(s.static_dir, ''),
		        s.created_at, s.updated_at
		 FROM services s
		 WHERE s.id = $1`,
		serviceID,
	).Scan(
		&service.ID, &service.ProjectID, &service.Name, &service.Type, &service.Status,
		&service.Image, &service.Command, &service.Environment, &service.GitRepo,
		&service.GitBranch, &service.BuildPath, &service.CPU, &service.Memory,
		&service.Replicas, &service.Port, &service.Domain, &service.HealthCheckPath,
		&service.RestartPolicy, &service.Builder, &service.CPUReserve,
		&service.MemoryReserve, &service.StaticBuildCmd, &service.StaticDir,
		&service.CreatedAt, &service.UpdatedAt,
	)
	return service, err
}

// StartPreviewSweeper expires preview environments past their TTL — tears
// down each clone's runtime and row, marks the preview expired.
func StartPreviewSweeper(ctx context.Context, db *database.DB, engine *deployment.DeploymentEngine) {
	if db == nil || engine == nil {
		return
	}
	go func() {
		ticker := time.NewTicker(time.Minute)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				sweepExpiredPreviews(ctx, db, engine)
				syncPreviewStatuses(ctx, db)
			}
		}
	}()
}

// sweepExpiredPreviews retires previews whose TTL elapsed.
func sweepExpiredPreviews(ctx context.Context, db *database.DB, engine *deployment.DeploymentEngine) {
	rows, err := db.QueryContext(ctx,
		`SELECT id, preview_service_id FROM preview_environments
		 WHERE expires_at < NOW() AND status NOT IN ('expired', 'stopped')`)
	if err != nil {
		return
	}
	var ids []uuid.UUID
	var clones []uuid.UUID
	for rows.Next() {
		var id uuid.UUID
		var cloneID *uuid.UUID
		if err := rows.Scan(&id, &cloneID); err == nil {
			ids = append(ids, id)
			if cloneID != nil {
				clones = append(clones, *cloneID)
			}
		}
	}
	rows.Close()
	for _, cloneID := range clones {
		removeServiceRuntime(ctx, db, engine, cloneID)
		_, _ = db.ExecContext(ctx, `DELETE FROM services WHERE id = $1`, cloneID)
	}
	for _, id := range ids {
		_, _ = db.ExecContext(ctx,
			`UPDATE preview_environments SET status = 'expired', updated_at = NOW() WHERE id = $1`, id)
	}
}

// syncPreviewStatuses folds the clone's live service status into the
// preview row so list/detail endpoints reflect the real deploy state.
func syncPreviewStatuses(ctx context.Context, db *database.DB) {
	_, _ = db.ExecContext(ctx, `
		UPDATE preview_environments pe
		SET status = derived.st, updated_at = NOW()
		FROM (
			SELECT pe2.id,
				CASE
					WHEN s.status IN ('running', 'deployed') THEN 'running'
					WHEN s.status IN ('failed', 'error') THEN 'failed'
					WHEN s.status IN ('building', 'deploying', 'queued', 'pending', 'cloning') THEN 'building'
					ELSE pe2.status
				END AS st
			FROM preview_environments pe2
			JOIN services s ON pe2.preview_service_id = s.id
		) derived
		WHERE pe.id = derived.id
		  AND pe.status IN ('building', 'running', 'failed')
		  AND pe.status <> derived.st
	`)
}
