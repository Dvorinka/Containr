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

// previewRowShape is the common column set the generated preview rows
// carry — ListPreviewEnvironmentsForProjectRow and GetPreviewEnvironmentRow
// share it.
type previewRowShape struct {
	ID               uuid.UUID
	ProjectID        uuid.UUID
	ServiceID        uuid.UUID
	PreviewServiceID uuid.NullUUID
	BranchName       string
	PrNumber         sql.NullInt32
	Environment      string
	Status           string
	Url              sql.NullString
	ExpiresAt        time.Time
	CreatedAt        sql.NullTime
	UpdatedAt        sql.NullTime
	SvcID            uuid.NullUUID
	ServiceName      sql.NullString
	ServiceType      sql.NullString
}

func previewFromRow(r previewRowShape) PreviewEnvironment {
	env := PreviewEnvironment{
		ID:          r.ID,
		ProjectID:   r.ProjectID,
		ServiceID:   r.ServiceID,
		BranchName:  r.BranchName,
		Environment: r.Environment,
		Status:      r.Status,
		URL:         r.Url.String,
		CreatedAt:   r.CreatedAt.Time,
		UpdatedAt:   r.UpdatedAt.Time,
	}
	if r.PreviewServiceID.Valid {
		id := r.PreviewServiceID.UUID
		env.PreviewServiceID = &id
	}
	if r.PrNumber.Valid {
		n := int(r.PrNumber.Int32)
		env.PRNumber = &n
	}
	if !r.ExpiresAt.IsZero() {
		t := r.ExpiresAt
		env.ExpiresAt = &t
	}
	if r.SvcID.Valid {
		env.Service = &Service{
			ID:   r.SvcID.UUID,
			Name: r.ServiceName.String,
			Type: r.ServiceType.String,
		}
	}
	return env
}

func prNumberSQL(n *int) sql.NullInt32 {
	if n == nil {
		return sql.NullInt32{}
	}
	return sql.NullInt32{Int32: int32(*n), Valid: true}
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
	rows, err := sqlcdb.New(db.(*database.DB).DB).ListPreviewEnvironmentsForProject(c.Request.Context(), projectID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve preview environments"})
		return
	}

	environments := make([]PreviewEnvironment, 0, len(rows))
	for _, r := range rows {
		environments = append(environments, previewFromRow(previewRowShape{
			ID: r.ID, ProjectID: r.ProjectID, ServiceID: r.ServiceID,
			PreviewServiceID: r.PreviewServiceID, BranchName: r.BranchName,
			PrNumber: r.PrNumber, Environment: r.Environment, Status: r.Status,
			Url: r.Url, ExpiresAt: r.ExpiresAt, CreatedAt: r.CreatedAt, UpdatedAt: r.UpdatedAt,
			SvcID: r.SvcID, ServiceName: r.ServiceName, ServiceType: r.ServiceType,
		}))
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

	ctx := c.Request.Context()
	q := sqlcdb.New(db.(*database.DB).DB)

	// Check if project exists and user has access
	project, err := q.GetProjectBrief(ctx, req.ProjectID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Project not found"})
		return
	}

	// Check if user owns the project
	if project.OwnerID.String() != userID.(string) && !contextIsAdmin(c) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	// Check if service exists and belongs to the project
	service, err := q.GetServiceTypeBrief(ctx, sqlcdb.GetServiceTypeBriefParams{
		ID: req.ServiceID, ProjectID: req.ProjectID})
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Service not found or doesn't belong to this project"})
		return
	}

	// Check if preview environment already exists for this branch and service
	count, err := q.CountActivePreviewsForBranch(ctx, sqlcdb.CountActivePreviewsForBranchParams{
		ServiceID: req.ServiceID, BranchName: req.BranchName})
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
	if err := q.UpdateServicePreviewBranch(ctx, sqlcdb.UpdateServicePreviewBranchParams{
		GitBranch: sql.NullString{String: req.BranchName, Valid: true}, ID: cloneID}); err != nil {
		_ = q.DeleteServiceByID(ctx, cloneID)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to configure preview service"})
		return
	}
	// Cloned service_domains would collide with the parent's Traefik
	// router — previews get their own hostname or none.
	if err := q.DeleteAllServiceDomains(ctx, cloneID); err != nil {
		_ = q.DeleteServiceByID(ctx, cloneID)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to configure preview domains"})
		return
	}
	previewHost := resolvePreviewHost(db.(*database.DB), cloneID, envName)
	if previewHost != "" {
		_ = q.CreatePreviewDomain(ctx, sqlcdb.CreatePreviewDomainParams{
			ServiceID: cloneID, Domain: previewHost})
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

	err = q.CreatePreviewEnvironment(ctx, sqlcdb.CreatePreviewEnvironmentParams{
		ID:               env.ID,
		ProjectID:        env.ProjectID,
		ServiceID:        env.ServiceID,
		PreviewServiceID: uuid.NullUUID{UUID: cloneID, Valid: true},
		BranchName:       env.BranchName,
		PrNumber:         prNumberSQL(env.PRNumber),
		Environment:      env.Environment,
		Status:           env.Status,
		Url:              sql.NullString{String: env.URL, Valid: env.URL != ""},
		ExpiresAt:        *env.ExpiresAt,
		CreatedAt:        sql.NullTime{Time: env.CreatedAt, Valid: true},
		UpdatedAt:        sql.NullTime{Time: env.UpdatedAt, Valid: true},
	})
	if err != nil {
		_ = q.DeleteServiceByID(ctx, cloneID)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create preview environment"})
		return
	}

	deploymentID := uuid.New()
	err = q.InsertPendingDeployment(ctx, sqlcdb.InsertPendingDeploymentParams{
		ID:         deploymentID,
		ServiceID:  cloneID,
		Version:    "preview-" + env.Environment,
		CommitHash: sql.NullString{String: req.BranchName, Valid: true},
	})
	if err != nil {
		_ = q.DeletePreviewEnvironment(ctx, env.ID)
		_ = q.DeleteServiceByID(ctx, cloneID)
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
	r, err := sqlcdb.New(db.(*database.DB).DB).GetPreviewEnvironment(
		c.Request.Context(), sqlcdb.GetPreviewEnvironmentParams{
			ID: envID, OwnerID: userID, Column3: contextIsAdmin(c)})
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Preview environment not found"})
		return
	}
	env := previewFromRow(previewRowShape{
		ID: r.ID, ProjectID: r.ProjectID, ServiceID: r.ServiceID,
		PreviewServiceID: r.PreviewServiceID, BranchName: r.BranchName,
		PrNumber: r.PrNumber, Environment: r.Environment, Status: r.Status,
		Url: r.Url, ExpiresAt: r.ExpiresAt, CreatedAt: r.CreatedAt, UpdatedAt: r.UpdatedAt,
		SvcID: r.SvcID, ServiceName: r.ServiceName, ServiceType: r.ServiceType,
	})
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
	uid, _ := uuid.Parse(fmt.Sprint(userID))
	q := sqlcdb.New(db.(*database.DB).DB)
	r, err := q.GetPreviewEnvironmentForWrite(
		c.Request.Context(), sqlcdb.GetPreviewEnvironmentForWriteParams{
			ID: envID, OwnerID: uid, Column3: contextIsAdmin(c)})
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Preview environment not found"})
		return
	}
	existingEnv := previewFromRow(previewRowShape{
		ID: r.ID, ProjectID: r.ProjectID, ServiceID: r.ServiceID,
		BranchName: r.BranchName, PrNumber: r.PrNumber, Environment: r.Environment,
		Status: r.Status, Url: r.Url, ExpiresAt: r.ExpiresAt,
		CreatedAt: r.CreatedAt, UpdatedAt: r.UpdatedAt,
	})

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
	expiresAt := time.Time{}
	if existingEnv.ExpiresAt != nil {
		expiresAt = *existingEnv.ExpiresAt
	}
	err = q.UpdatePreviewEnvironment(c.Request.Context(), sqlcdb.UpdatePreviewEnvironmentParams{
		Status:    existingEnv.Status,
		Url:       sql.NullString{String: existingEnv.URL, Valid: existingEnv.URL != ""},
		ExpiresAt: expiresAt,
		UpdatedAt: sql.NullTime{Time: existingEnv.UpdatedAt, Valid: true},
		ID:        existingEnv.ID,
	})

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

	ctx := c.Request.Context()
	q := sqlcdb.New(db.(*database.DB).DB)

	// Check if preview environment exists and user has access
	projectOwnerID, err := q.GetPreviewEnvironmentOwner(ctx, envID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Preview environment not found"})
		return
	}

	// Check if user owns the project
	if projectOwnerID.String() != userID.(string) && !contextIsAdmin(c) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	// Tear down the clone's runtime and row — the preview is the clone.
	if cloneID, err := q.GetPreviewServiceID(ctx, envID); err == nil && cloneID.Valid {
		if engineValue, exists := c.Get("deployment_engine"); exists && engineValue != nil {
			if engine, ok := engineValue.(*deployment.DeploymentEngine); ok {
				removeServiceRuntime(ctx, db.(*database.DB), engine, cloneID.UUID)
			}
		}
		_ = q.DeleteServiceByID(ctx, cloneID.UUID)
	}

	// Delete preview environment
	err = q.DeletePreviewEnvironment(ctx, envID)

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

	ctx := c.Request.Context()
	q := sqlcdb.New(db.(*database.DB).DB)

	// Get preview environment details
	uid, _ := uuid.Parse(fmt.Sprint(userID))
	r, err := q.GetPreviewEnvironmentForPromote(
		ctx, sqlcdb.GetPreviewEnvironmentForPromoteParams{
			ID: envID, OwnerID: uid, Column3: contextIsAdmin(c)})
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Preview environment not found"})
		return
	}
	env := PreviewEnvironment{
		ID:          r.ID,
		ProjectID:   r.ProjectID,
		ServiceID:   r.ServiceID,
		BranchName:  r.BranchName,
		Environment: r.Environment,
		Status:      r.Status,
	}
	if r.PreviewServiceID.Valid {
		id := r.PreviewServiceID.UUID
		env.PreviewServiceID = &id
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
	err = q.InsertPendingDeployment(ctx, sqlcdb.InsertPendingDeploymentParams{
		ID:         deploymentID,
		ServiceID:  env.ServiceID,
		Version:    promotionVersion,
		CommitHash: sql.NullString{String: env.BranchName, Valid: true},
	})
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
				removeServiceRuntime(ctx, db.(*database.DB), engine, *env.PreviewServiceID)
			}
		}
		_ = q.DeleteServiceByID(ctx, *env.PreviewServiceID)
	}

	if err := q.MarkPreviewEnvironmentStatus(ctx, sqlcdb.MarkPreviewEnvironmentStatusParams{
		Status: "stopped", ID: env.ID}); err != nil {
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

	ctx := c.Request.Context()
	q := sqlcdb.New(db.(*database.DB).DB)
	uid, _ := uuid.Parse(fmt.Sprint(userID))

	// Find expired preview environments for user's projects
	rows, err := q.ListExpiredPreviewsForUser(ctx, sqlcdb.ListExpiredPreviewsForUserParams{
		OwnerID: uid, Column2: contextIsAdmin(c)})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to find expired preview environments"})
		return
	}

	expiredEnvs := make([]PreviewEnvironment, 0, len(rows))
	for _, r := range rows {
		env := PreviewEnvironment{
			ID: r.ID, ProjectID: r.ProjectID, ServiceID: r.ServiceID,
			BranchName: r.BranchName, Environment: r.Environment,
		}
		if r.PreviewServiceID.Valid {
			id := r.PreviewServiceID.UUID
			env.PreviewServiceID = &id
		}
		expiredEnvs = append(expiredEnvs, env)
	}

	// Mark expired environments as expired and tear down their clones
	cleanupCount := 0
	for _, env := range expiredEnvs {
		if err := q.MarkPreviewEnvironmentStatus(ctx, sqlcdb.MarkPreviewEnvironmentStatusParams{
			Status: "expired", ID: env.ID}); err != nil {
			continue
		}
		if env.PreviewServiceID != nil {
			if engineValue, exists := c.Get("deployment_engine"); exists && engineValue != nil {
				if engine, ok := engineValue.(*deployment.DeploymentEngine); ok {
					removeServiceRuntime(ctx, db.(*database.DB), engine, *env.PreviewServiceID)
				}
			}
			_ = q.DeleteServiceByID(ctx, *env.PreviewServiceID)
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
	q := sqlcdb.New(db.DB)
	ctx := context.Background()
	brief, err := q.GetServicePlacementBrief(ctx, cloneID)
	if err != nil {
		return ""
	}
	nodeID, spread := brief.NodeID, brief.Spread
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
func serviceForDeployFromRow(r sqlcdb.GetServiceForDeployRow) Service {
	return Service{
		ID: r.ID, ProjectID: r.ProjectID, Name: r.Name, Type: r.Type.String,
		Status: r.Status.String, Image: r.Image.String, Command: r.Command.String,
		Environment: r.Environment.String, GitRepo: r.GitRepo.String,
		GitBranch: r.GitBranch.String, BuildPath: r.BuildPath.String,
		CPU: r.Cpu.String, Memory: r.Memory.String,
		Replicas: int(r.Replicas), Port: int(r.Port), Domain: r.Domain,
		HealthCheckPath: r.HealthcheckPath, RestartPolicy: r.RestartPolicy,
		Builder: r.Builder, CPUReserve: r.CpuReserve, MemoryReserve: r.MemoryReserve,
		StaticBuildCmd: r.StaticBuildCmd, StaticDir: r.StaticDir,
		CreatedAt: r.CreatedAt.Time, UpdatedAt: r.UpdatedAt.Time,
	}
}

func loadServiceForDeploy(db *database.DB, serviceID uuid.UUID) (Service, error) {
	r, err := sqlcdb.New(db.DB).GetServiceForDeploy(context.Background(), serviceID)
	if err != nil {
		return Service{}, err
	}
	return serviceForDeployFromRow(r), nil
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
	q := sqlcdb.New(db.DB)
	rows, err := q.ListSweepablePreviews(ctx)
	if err != nil {
		return
	}
	var ids []uuid.UUID
	for _, r := range rows {
		ids = append(ids, r.ID)
		if r.PreviewServiceID.Valid {
			removeServiceRuntime(ctx, db, engine, r.PreviewServiceID.UUID)
			_ = q.DeleteServiceByID(ctx, r.PreviewServiceID.UUID)
		}
	}
	for _, id := range ids {
		_ = q.MarkPreviewEnvironmentStatus(ctx, sqlcdb.MarkPreviewEnvironmentStatusParams{
			Status: "expired", ID: id})
	}
}

// syncPreviewStatuses folds the clone's live service status into the
// preview row so list/detail endpoints reflect the real deploy state.
func syncPreviewStatuses(ctx context.Context, db *database.DB) {
	_ = sqlcdb.New(db.DB).SyncPreviewStatuses(ctx)
}
