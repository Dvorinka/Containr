package api

import (
	"containr/internal/database"
	"containr/internal/deployment"
	"containr/internal/deployqueue"
	"context"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type DeploymentModel struct {
	ID          uuid.UUID  `json:"id" db:"id"`
	ServiceID   uuid.UUID  `json:"service_id" db:"service_id"`
	CommitHash  *string    `json:"commit_hash" db:"commit_hash"`
	Status      string     `json:"status" db:"status"`
	ImageName   string     `json:"image_name" db:"image_name"`
	ImageTag    string     `json:"image_tag" db:"image_tag"`
	BuildLog    string     `json:"build_log" db:"build_log"`
	RuntimeLog  string     `json:"runtime_log" db:"runtime_log"`
	Error       *string    `json:"error" db:"error"`
	StartedAt   *time.Time `json:"started_at" db:"started_at"`
	CompletedAt *time.Time `json:"completed_at" db:"completed_at"`
	CreatedAt   time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at" db:"updated_at"`
}

type CreateDeploymentRequest struct {
	CommitHash string            `json:"commit_hash"`
	Branch     string            `json:"branch"`
	Trigger    string            `json:"trigger"`
	EnvVars    map[string]string `json:"env_vars"`
	NoCache    bool              `json:"no_cache"`
}

type DeploymentResponse struct {
	ID          uuid.UUID  `json:"id"`
	ServiceID   uuid.UUID  `json:"service_id"`
	CommitHash  *string    `json:"commit_hash"`
	Status      string     `json:"status"`
	ImageName   string     `json:"image_name"`
	ImageTag    string     `json:"image_tag"`
	StartedAt   *time.Time `json:"started_at,omitempty"`
	CompletedAt *time.Time `json:"completed_at,omitempty"`
	CreatedAt   time.Time  `json:"created_at"`
	Error       *string    `json:"error,omitempty"`
}

func handleGetDeployments(c *gin.Context) {
	db, exists := c.Get("db")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database connection not available"})
		return
	}

	serviceIDStr := c.Param("id")
	serviceID, err := uuid.Parse(serviceIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid service ID"})
		return
	}

	projectID, found := serviceProjectID(db.(*database.DB), serviceID)
	if !found {
		c.JSON(http.StatusNotFound, gin.H{"error": "Service not found"})
		return
	}
	if _, allowed := projectReadAccess(c, db.(*database.DB), projectID); !allowed {
		c.JSON(http.StatusNotFound, gin.H{"error": "Service not found"})
		return
	}

	offset, limit := pageWindow(c, 50, 100)

	var total int
	_ = db.(*database.DB).QueryRow(
		`SELECT COUNT(*) FROM deployments WHERE service_id = $1`, serviceID,
	).Scan(&total)

	rows, err := db.(*database.DB).Query(
		`SELECT id, service_id, commit_hash, status, image_name, image_tag,
		        build_log, runtime_log, error, started_at, completed_at, created_at, updated_at
		 FROM deployments
		 WHERE service_id = $1
		 ORDER BY created_at DESC
		 LIMIT $2 OFFSET $3`,
		serviceID, limit, offset,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve deployments"})
		return
	}
	defer rows.Close()

	var deployments []DeploymentModel
	for rows.Next() {
		var d DeploymentModel
		err := rows.Scan(
			&d.ID, &d.ServiceID, &d.CommitHash, &d.Status, &d.ImageName, &d.ImageTag,
			&d.BuildLog, &d.RuntimeLog, &d.Error, &d.StartedAt, &d.CompletedAt,
			&d.CreatedAt, &d.UpdatedAt,
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to scan deployment"})
			return
		}
		deployments = append(deployments, d)
	}

	c.JSON(http.StatusOK, gin.H{
		"deployments": deployments,
		"pagination":  paginationMeta(offset, limit, total),
	})
}

// RecentDeployment is a deployment row joined with its service and project names.
type RecentDeployment struct {
	ID          uuid.UUID  `json:"id"`
	ServiceID   uuid.UUID  `json:"service_id"`
	ServiceName string     `json:"service_name"`
	ProjectName string     `json:"project_name"`
	Status      string     `json:"status"`
	ImageName   string     `json:"image_name"`
	StartedAt   *time.Time `json:"started_at"`
	CompletedAt *time.Time `json:"completed_at"`
	CreatedAt   time.Time  `json:"created_at"`
}

// handleGetRecentDeployments lists the latest deployments across all of the
// caller's services — feeds the dashboard deploy feed.
func handleGetRecentDeployments(c *gin.Context) {
	db, exists := c.Get("db")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database connection not available"})
		return
	}

	userID := optionalUserUUID(c)
	isAdmin := contextIsAdmin(c)

	offset, limit := pageWindow(c, 10, 50)

	var total int
	if err := db.(*database.DB).QueryRow(
		`SELECT COUNT(*)
		 FROM deployments d
		 JOIN services s ON s.id = d.service_id
		 JOIN projects p ON p.id = s.project_id
		 WHERE p.is_approved OR p.owner_id = $1 OR $2::bool
		    OR EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = $1)`,
		userID, isAdmin,
	).Scan(&total); err != nil {
		total = 0
	}

	rows, err := db.(*database.DB).Query(
		`SELECT d.id, d.service_id, s.name, p.name, d.status,
		        COALESCE(d.image_name, ''), d.started_at, d.completed_at, d.created_at
		 FROM deployments d
		 JOIN services s ON s.id = d.service_id
		 JOIN projects p ON p.id = s.project_id
		 WHERE p.is_approved OR p.owner_id = $1 OR $2::bool
		    OR EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = $1)
		 ORDER BY d.created_at DESC
		 LIMIT $3 OFFSET $4`,
		userID, isAdmin, limit, offset,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve deployments"})
		return
	}
	defer rows.Close()

	deployments := []RecentDeployment{}
	for rows.Next() {
		var d RecentDeployment
		if err := rows.Scan(&d.ID, &d.ServiceID, &d.ServiceName, &d.ProjectName,
			&d.Status, &d.ImageName, &d.StartedAt, &d.CompletedAt, &d.CreatedAt); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to scan deployment"})
			return
		}
		deployments = append(deployments, d)
	}

	c.JSON(http.StatusOK, gin.H{
		"deployments": deployments,
		"pagination":  paginationMeta(offset, limit, total),
	})
}

func handleCreateDeployment(c *gin.Context) {
	db, exists := c.Get("db")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database connection not available"})
		return
	}

	serviceIDStr := c.Param("id")
	serviceID, err := uuid.Parse(serviceIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid service ID"})
		return
	}

	var req CreateDeploymentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.Trigger == "" {
		req.Trigger = "manual"
	}

	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	var service Service
	var projectOwner string
	err = db.(*database.DB).QueryRow(
		`SELECT s.id, s.project_id, s.name, s.type, s.status, s.image, s.command,
		        s.environment, s.git_repo, s.git_branch, s.build_path, s.cpu, s.memory,
		        COALESCE(s.replicas, 1), COALESCE(s.port, 0),
		        COALESCE(s.domain, ''), COALESCE(s.healthcheck_path, ''),
		        COALESCE(s.restart_policy, 'unless-stopped'),
		        s.created_at, s.updated_at, p.owner_id
		 FROM services s
		 JOIN projects p ON s.project_id = p.id
		 WHERE s.id = $1`,
		serviceID,
	).Scan(
		&service.ID, &service.ProjectID, &service.Name, &service.Type, &service.Status,
		&service.Image, &service.Command, &service.Environment, &service.GitRepo,
		&service.GitBranch, &service.BuildPath, &service.CPU, &service.Memory,
		&service.Replicas, &service.Port, &service.Domain, &service.HealthCheckPath,
		&service.RestartPolicy, &service.CreatedAt, &service.UpdatedAt, &projectOwner,
	)

	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Service not found"})
		return
	}

	if projectOwner != userID.(string) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	if req.Branch == "" {
		req.Branch = service.GitBranch
	}

	now := time.Now()
	var commitHash *string
	if trimmed := strings.TrimSpace(req.CommitHash); trimmed != "" {
		commitHash = &trimmed
	}

	d := DeploymentModel{
		ID:         uuid.New(),
		ServiceID:  serviceID,
		CommitHash: commitHash,
		Status:     "pending",
		ImageName:  "",
		ImageTag:   "",
		CreatedAt:  now,
		UpdatedAt:  now,
	}

	_, err = db.(*database.DB).Exec(
		`INSERT INTO deployments
		 (id, service_id, version, commit_hash, status, image_name, image_tag, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
		d.ID, d.ServiceID, fmt.Sprintf("v%d", now.Unix()), d.CommitHash, d.Status, d.ImageName, d.ImageTag, d.CreatedAt, d.UpdatedAt,
	)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create deployment"})
		return
	}

	engine, exists := c.Get("deployment_engine")
	if !exists || engine == nil {
		unavailableErr := "Deployment engine unavailable. Docker may not be configured on this server."
		completedAt := time.Now()
		_, _ = db.(*database.DB).Exec(
			`UPDATE deployments
			 SET status = 'failed', error = $1, completed_at = $2, updated_at = $2
			 WHERE id = $3`,
			unavailableErr, completedAt, d.ID,
		)
		d.Status = "failed"
		d.Error = &unavailableErr
		d.CompletedAt = &completedAt
	} else {
		_, err = db.(*database.DB).Exec(
			`UPDATE services SET status = 'building', updated_at = $1 WHERE id = $2`,
			time.Now(), serviceID,
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update service status"})
			return
		}

		engineInstance := engine.(*deployment.DeploymentEngine)
		pos := getDeployQueue(c).Enqueue(serviceID, deployqueue.Job{
			DeploymentID: d.ID,
			Run: func(jctx context.Context) {
				runDeploymentAndSync(jctx, db.(*database.DB), engineInstance, &d, service, req, userID.(string))
			},
		})
		if pos > 0 {
			d.Status = "queued"
			_, _ = db.(*database.DB).Exec(
				`UPDATE deployments SET status = 'queued', updated_at = $1 WHERE id = $2`,
				time.Now(), d.ID,
			)
			_, _ = db.(*database.DB).Exec(
				`UPDATE services SET status = 'queued', updated_at = $1 WHERE id = $2`,
				time.Now(), serviceID,
			)
		}
	}

	c.JSON(http.StatusCreated, DeploymentResponse{
		ID:          d.ID,
		ServiceID:   d.ServiceID,
		CommitHash:  d.CommitHash,
		Status:      d.Status,
		Error:       d.Error,
		CompletedAt: d.CompletedAt,
		CreatedAt:   d.CreatedAt,
	})
}

func runDeploymentAndSync(
	parentCtx context.Context,
	db *database.DB,
	engine *deployment.DeploymentEngine,
	dbDeployment *DeploymentModel,
	service Service,
	req CreateDeploymentRequest,
	userID string,
) {
	runDeploymentAndSyncWithImage(parentCtx, db, engine, dbDeployment, service, req, userID, "")
}

// runDeploymentAndSyncWithImage deploys imageOverride as a prebuilt image
// (rollback / redeploy of an existing tag) when set; otherwise builds from
// source or pulls the service image.
func runDeploymentAndSyncWithImage(
	parentCtx context.Context,
	db *database.DB,
	engine *deployment.DeploymentEngine,
	dbDeployment *DeploymentModel,
	service Service,
	req CreateDeploymentRequest,
	userID string,
	imageOverride string,
) {
	ctx, cancel := context.WithTimeout(parentCtx, 30*time.Minute)
	defer cancel()

	sourcePath := strings.TrimSpace(service.BuildPath)
	if sourcePath == "" {
		sourcePath = "."
	}

	// Resolve the runtime env: stored service variables (with ${{svc.KEY}}
	// references expanded) plus any per-deployment overrides.
	env, envErr := resolveServiceEnv(db, service)
	if envErr != nil {
		env = map[string]string{}
	}
	for k, v := range req.EnvVars {
		env[k] = v
	}

	var command []string
	if cmd := strings.TrimSpace(service.Command); cmd != "" {
		command = strings.Fields(cmd)
	}

	replicas := service.Replicas
	if replicas < 1 {
		replicas = 1
	}

	var publishedPort int32
	// Best effort: reuse the host port from the last live deployment so public
	// URLs survive redeploys. Column exists post-migration; older DBs get
	// ephemeral ports.
	_ = db.QueryRow(`SELECT published_port FROM services WHERE id = $1`, service.ID).Scan(&publishedPort)

	maintenanceMode, basicAuthUsers := serviceAccess(db, service.ID)
	maintURL := ""
	if maintenanceMode {
		maintURL = maintenanceURL(db)
	}

	deployReq := &deployment.DeploymentRequest{
		ProjectID:   service.ProjectID.String(),
		ServiceID:   service.ID.String(),
		Environment: service.Environment,
		Config: deployment.ServiceConfig{
			Name:          service.Name,
			Image:         service.Image,
			Command:       command,
			Environment:   env,
			Replicas:      replicas,
			PublicPort:    int32(service.Port),
			PublishedPort: publishedPort,
			Domain:        service.Domain,
			HealthPath:    service.HealthCheckPath,
			RestartPolicy: service.RestartPolicy,
			VolumeMounts:  loadServiceVolumes(db, service.ID),
			Domains:       serviceDomainNames(db, service.ID, service.Domain),
			Resources: deployment.ResourceLimits{
				MemoryBytes: parseMemoryLimit(service.Memory),
				CPUQuota:    parseCPULimit(service.CPU),
			},
			Maintenance:    maintenanceMode,
			MaintenanceURL: maintURL,
			BasicAuthUsers: basicAuthUsers,
		},
		Trigger: deployment.TriggerConfig{
			Type:      req.Trigger,
			Source:    "api",
			User:      userID,
			Timestamp: time.Now(),
		},
	}

	if imageOverride != "" {
		deployReq.BuildConfig = &deployment.BuildConfig{
			BuildType:     "prebuilt",
			PrebuiltImage: imageOverride,
		}
	} else if service.GitRepo == "" {
		// Image-sourced service: pull the image instead of building.
		deployReq.BuildConfig = &deployment.BuildConfig{
			BuildType:     "prebuilt",
			PrebuiltImage: service.Image,
		}
	} else {
		deployReq.BuildConfig = &deployment.BuildConfig{
			BuildType:  "nixpacks",
			SourcePath: sourcePath,
			Branch:     req.Branch,
			Commit:     req.CommitHash,
			NoCache:    req.NoCache,
		}
	}

	engineDeployment, err := engine.Deploy(ctx, deployReq)
	if err != nil {
		failedAt := time.Now()
		failure := "Failed to start deployment engine: " + err.Error()
		_, _ = db.Exec(
			`UPDATE deployments
			 SET status = 'failed', error = $1, completed_at = $2, updated_at = $2
			 WHERE id = $3`,
			failure, failedAt, dbDeployment.ID,
		)
		_, _ = db.Exec(
			`UPDATE services SET status = 'failed', updated_at = $1 WHERE id = $2`,
			failedAt, service.ID,
		)
		return
	}

	syncTicker := time.NewTicker(1 * time.Second)
	defer syncTicker.Stop()

	for {
		select {
		case <-ctx.Done():
			failedAt := time.Now()
			finalStatus, finalErr := "failed", "Deployment timed out before completion"
			if errors.Is(ctx.Err(), context.Canceled) {
				finalStatus, finalErr = "cancelled", "Deployment cancelled"
			}
			_, _ = db.Exec(
				`UPDATE deployments
				 SET status = $1, error = $2, completed_at = $3, updated_at = $3
				 WHERE id = $4`,
				finalStatus, finalErr, failedAt, dbDeployment.ID,
			)
			_, _ = db.Exec(
				`UPDATE services SET status = $1, updated_at = $2 WHERE id = $3`,
				finalStatus, failedAt, service.ID,
			)
			return
		case <-syncTicker.C:
			current, getErr := engine.GetDeployment(engineDeployment.ID)
			if getErr != nil {
				continue
			}

			dbStatus := mapEngineStatusToDBStatus(current.Status)
			imageName, imageTag := splitImageReference(current.ImageName, dbDeployment.ImageTag)

			var dbError interface{}
			if current.Error != "" {
				dbError = current.Error
			}

			_, _ = db.Exec(
				`UPDATE deployments
				 SET status = $1,
				     image_name = $2,
				     image_tag = $3,
				     build_log = $4,
				     runtime_log = $5,
				     error = $6,
				     started_at = $7,
				     completed_at = $8,
				     updated_at = $9
				 WHERE id = $10`,
				dbStatus,
				imageName,
				imageTag,
				current.BuildLog,
				current.DeployLog,
				dbError,
				current.StartedAt,
				current.CompletedAt,
				time.Now(),
				dbDeployment.ID,
			)

			switch dbStatus {
			case "deployed":
				_, _ = db.Exec(
					`UPDATE services SET status = 'running', updated_at = $1 WHERE id = $2`,
					time.Now(), service.ID,
				)
				insertUserNotification(db, userID, "deployment", "Deployment succeeded",
					fmt.Sprintf("Service %s is now running.", service.Name), "service", service.ID.String())
				return
			case "failed":
				_, _ = db.Exec(
					`UPDATE services SET status = 'failed', updated_at = $1 WHERE id = $2`,
					time.Now(), service.ID,
				)
				body := fmt.Sprintf("Service %s failed to deploy.", service.Name)
				if current.Error != "" {
					body = fmt.Sprintf("Service %s failed to deploy: %s", service.Name, current.Error)
				}
				insertUserNotification(db, userID, "deployment", "Deployment failed", body, "service", service.ID.String())
				return
			}
		}
	}
}

func mapEngineStatusToDBStatus(status string) string {
	if status == "running" {
		return "deployed"
	}
	return status
}

// getDeployQueue returns the per-service deploy queue. SetupRoutes always
// sets it; the fallback keeps handler tests that skip SetupRoutes working.
func getDeployQueue(c *gin.Context) *deployqueue.Queue {
	if v, exists := c.Get("deploy_queue"); exists {
		if q, ok := v.(*deployqueue.Queue); ok && q != nil {
			return q
		}
	}
	return deployqueue.New()
}

// handleCancelDeployment cancels a queued or in-flight deployment. Queued
// jobs are dropped and marked cancelled immediately; active jobs get their
// context cancelled so the build/reconcile aborts and the sync loop writes
// the terminal 'cancelled' status.
func handleCancelDeployment(c *gin.Context) {
	db, exists := c.Get("db")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database connection not available", "code": "DEPENDENCY_UNAVAILABLE"})
		return
	}

	deploymentID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid deployment ID", "code": "VALIDATION"})
		return
	}
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated", "code": "UNAUTHENTICATED"})
		return
	}

	var status, owner string
	var serviceID uuid.UUID
	err = db.(*database.DB).QueryRow(
		`SELECT d.status, d.service_id, p.owner_id
		 FROM deployments d
		 JOIN services s ON d.service_id = s.id
		 JOIN projects p ON s.project_id = p.id
		 WHERE d.id = $1`,
		deploymentID,
	).Scan(&status, &serviceID, &owner)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Deployment not found", "code": "NOT_FOUND"})
		return
	}
	if owner != userID.(string) && !contextIsAdmin(c) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied", "code": "FORBIDDEN"})
		return
	}

	switch status {
	case "deployed", "failed", "cancelled":
		c.JSON(http.StatusConflict, gin.H{"error": "Deployment already finished", "code": "NOT_CANCELLABLE"})
		return
	}

	switch getDeployQueue(c).Cancel(serviceID, deploymentID) {
	case deployqueue.WasQueued:
		now := time.Now()
		_, _ = db.(*database.DB).Exec(
			`UPDATE deployments SET status = 'cancelled', error = 'Deployment cancelled', completed_at = $1, updated_at = $1 WHERE id = $2`,
			now, deploymentID,
		)
		_, _ = db.(*database.DB).Exec(
			`UPDATE services SET status = 'cancelled', updated_at = $1 WHERE id = $2`,
			now, serviceID,
		)
		c.JSON(http.StatusOK, gin.H{"status": "cancelled"})
	case deployqueue.WasActive:
		c.JSON(http.StatusAccepted, gin.H{"status": "cancelling"})
	default:
		c.JSON(http.StatusConflict, gin.H{"error": "Deployment is not running on this node", "code": "NOT_CANCELLABLE"})
	}
}

func splitImageReference(image, fallbackTag string) (string, string) {
	if image == "" {
		return "", fallbackTag
	}

	lastSlash := strings.LastIndex(image, "/")
	lastColon := strings.LastIndex(image, ":")
	if lastColon > lastSlash && !strings.Contains(image[lastColon:], "@") {
		return image[:lastColon], image[lastColon+1:]
	}

	return image, fallbackTag
}

func handleGetDeployment(c *gin.Context) {
	db, exists := c.Get("db")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database connection not available"})
		return
	}

	deploymentIDStr := c.Param("id")
	deploymentID, err := uuid.Parse(deploymentIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid deployment ID"})
		return
	}

	var d DeploymentModel
	var projectID uuid.UUID
	err = db.(*database.DB).QueryRow(
		`SELECT d.id, d.service_id, d.commit_hash, d.status, d.image_name, d.image_tag,
		        d.build_log, d.runtime_log, d.error, d.started_at, d.completed_at,
		        d.created_at, d.updated_at, p.id
		 FROM deployments d
		 JOIN services s ON d.service_id = s.id
		 JOIN projects p ON s.project_id = p.id
		 WHERE d.id = $1`,
		deploymentID,
	).Scan(
		&d.ID, &d.ServiceID, &d.CommitHash, &d.Status, &d.ImageName, &d.ImageTag,
		&d.BuildLog, &d.RuntimeLog, &d.Error, &d.StartedAt, &d.CompletedAt,
		&d.CreatedAt, &d.UpdatedAt, &projectID,
	)

	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Deployment not found"})
		return
	}

	if _, allowed := projectReadAccess(c, db.(*database.DB), projectID); !allowed {
		c.JSON(http.StatusNotFound, gin.H{"error": "Deployment not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"deployment": d})
}

func handleRollbackDeployment(c *gin.Context) {
	db, exists := c.Get("db")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database connection not available"})
		return
	}

	deploymentIDStr := c.Param("id")
	deploymentID, err := uuid.Parse(deploymentIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid deployment ID"})
		return
	}

	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	var targetDeployment DeploymentModel
	var serviceID uuid.UUID
	var ownerCheck string

	err = db.(*database.DB).QueryRow(
		`SELECT d.id, d.service_id, d.commit_hash, d.status, d.image_name, d.image_tag, 
		        d.build_log, d.runtime_log, d.error, d.started_at, d.completed_at, 
		        d.created_at, d.updated_at, p.owner_id
		 FROM deployments d
		 JOIN services s ON d.service_id = s.id
		 JOIN projects p ON s.project_id = p.id
		 WHERE d.id = $1`,
		deploymentID,
	).Scan(
		&targetDeployment.ID, &serviceID, &targetDeployment.CommitHash, &targetDeployment.Status,
		&targetDeployment.ImageName, &targetDeployment.ImageTag, &targetDeployment.BuildLog,
		&targetDeployment.RuntimeLog, &targetDeployment.Error, &targetDeployment.StartedAt,
		&targetDeployment.CompletedAt, &targetDeployment.CreatedAt, &targetDeployment.UpdatedAt,
		&ownerCheck,
	)

	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Deployment not found"})
		return
	}

	if ownerCheck != userID.(string) && !contextIsAdmin(c) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	if targetDeployment.Status != "deployed" && targetDeployment.Status != "failed" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Can only rollback completed or failed deployments"})
		return
	}

	now := time.Now()
	rollbackID := uuid.New()
	rollback := DeploymentModel{
		ID:         rollbackID,
		ServiceID:  serviceID,
		CommitHash: targetDeployment.CommitHash,
		Status:     "rolling_back",
		ImageName:  targetDeployment.ImageName,
		ImageTag:   targetDeployment.ImageTag,
		CreatedAt:  now,
		UpdatedAt:  now,
	}

	_, err = db.(*database.DB).Exec(
		`INSERT INTO deployments
		 (id, service_id, version, commit_hash, status, image_name, image_tag, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
		rollback.ID, rollback.ServiceID, fmt.Sprintf("rollback-%d", now.Unix()), rollback.CommitHash, rollback.Status,
		rollback.ImageName, rollback.ImageTag, rollback.CreatedAt, rollback.UpdatedAt,
	)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create rollback deployment"})
		return
	}

	_, err = db.(*database.DB).Exec(
		`UPDATE services SET status = 'building', updated_at = $1 WHERE id = $2`,
		time.Now(), serviceID,
	)

	// Real rollback: redeploy the target deployment's image.
	engineValue, _ := c.Get("deployment_engine")
	engine, _ := engineValue.(*deployment.DeploymentEngine)
	targetImage := targetDeployment.ImageName
	if targetDeployment.ImageTag != "" {
		targetImage += ":" + targetDeployment.ImageTag
	}

	if engine == nil || targetImage == "" {
		completedAt := time.Now()
		reason := "Rollback image unavailable"
		if engine == nil {
			reason = "Deployment engine unavailable. Docker may not be configured on this server."
		}
		_, _ = db.(*database.DB).Exec(
			`UPDATE deployments SET status = 'failed', error = $1, completed_at = $2, updated_at = $2 WHERE id = $3`,
			reason, completedAt, rollbackID,
		)
		_, _ = db.(*database.DB).Exec(
			`UPDATE services SET status = 'failed', updated_at = $1 WHERE id = $2`,
			completedAt, serviceID,
		)
	} else {
		var service Service
		_ = db.(*database.DB).QueryRow(
			`SELECT s.id, s.project_id, s.name, s.type, s.status, s.image, s.command,
			        s.environment, s.git_repo, s.git_branch, s.build_path, s.cpu, s.memory,
			        COALESCE(s.replicas, 1), COALESCE(s.port, 0),
			        COALESCE(s.domain, ''), COALESCE(s.healthcheck_path, ''),
			        COALESCE(s.restart_policy, 'unless-stopped'),
			        s.created_at, s.updated_at
			 FROM services s WHERE s.id = $1`, serviceID,
		).Scan(
			&service.ID, &service.ProjectID, &service.Name, &service.Type, &service.Status,
			&service.Image, &service.Command, &service.Environment, &service.GitRepo,
			&service.GitBranch, &service.BuildPath, &service.CPU, &service.Memory,
			&service.Replicas, &service.Port, &service.Domain, &service.HealthCheckPath,
			&service.RestartPolicy, &service.CreatedAt, &service.UpdatedAt,
		)

		rollbackReq := CreateDeploymentRequest{
			CommitHash: func() string {
				if targetDeployment.CommitHash != nil {
					return *targetDeployment.CommitHash
				}
				return ""
			}(),
			Trigger: "rollback",
		}
		// Reuse the stored image directly — no rebuild.
		getDeployQueue(c).Enqueue(serviceID, deployqueue.Job{
			DeploymentID: rollback.ID,
			Run: func(jctx context.Context) {
				runDeploymentAndSyncWithImage(jctx, db.(*database.DB), engine, &rollback, service, rollbackReq, userID.(string), targetImage)
			},
		})
	}

	c.JSON(http.StatusCreated, gin.H{
		"deployment": DeploymentResponse{
			ID:         rollback.ID,
			ServiceID:  rollback.ServiceID,
			CommitHash: rollback.CommitHash,
			Status:     rollback.Status,
			ImageName:  rollback.ImageName,
			ImageTag:   rollback.ImageTag,
			CreatedAt:  rollback.CreatedAt,
		},
		"message": "Rollback initiated",
	})
}
