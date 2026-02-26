package api

import (
	"containr/internal/database"
	"containr/internal/deployment"
	"context"
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

	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	var ownerCheck string
	err = db.(*database.DB).QueryRow(
		`SELECT p.owner_id FROM services s 
		 JOIN projects p ON s.project_id = p.id 
		 WHERE s.id = $1`,
		serviceID,
	).Scan(&ownerCheck)

	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Service not found"})
		return
	}

	if ownerCheck != userID.(string) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	rows, err := db.(*database.DB).Query(
		`SELECT id, service_id, commit_hash, status, image_name, image_tag, 
		        build_log, runtime_log, error, started_at, completed_at, created_at, updated_at
		 FROM deployments 
		 WHERE service_id = $1 
		 ORDER BY created_at DESC 
		 LIMIT 50`,
		serviceID,
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

	c.JSON(http.StatusOK, gin.H{"deployments": deployments})
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
		        s.created_at, s.updated_at, p.owner_id
		 FROM services s
		 JOIN projects p ON s.project_id = p.id
		 WHERE s.id = $1`,
		serviceID,
	).Scan(
		&service.ID, &service.ProjectID, &service.Name, &service.Type, &service.Status,
		&service.Image, &service.Command, &service.Environment, &service.GitRepo,
		&service.GitBranch, &service.BuildPath, &service.CPU, &service.Memory,
		&service.CreatedAt, &service.UpdatedAt, &projectOwner,
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
		 (id, service_id, commit_hash, status, image_name, image_tag, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
		d.ID, d.ServiceID, d.CommitHash, d.Status, d.ImageName, d.ImageTag, d.CreatedAt, d.UpdatedAt,
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
		go runDeploymentAndSync(context.Background(), db.(*database.DB), engineInstance, &d, service, req, userID.(string))
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
	ctx, cancel := context.WithTimeout(parentCtx, 30*time.Minute)
	defer cancel()

	sourcePath := strings.TrimSpace(service.BuildPath)
	if sourcePath == "" {
		sourcePath = "."
	}

	deployReq := &deployment.DeploymentRequest{
		ProjectID:   service.ProjectID.String(),
		ServiceID:   service.ID.String(),
		Environment: service.Environment,
		Config: deployment.ServiceConfig{
			Name:        service.Name,
			Image:       service.Image,
			Environment: req.EnvVars,
			Replicas:    1,
		},
		BuildConfig: &deployment.BuildConfig{
			BuildType:  "nixpacks",
			SourcePath: sourcePath,
			Branch:     req.Branch,
			Commit:     req.CommitHash,
		},
		Trigger: deployment.TriggerConfig{
			Type:      req.Trigger,
			Source:    "api",
			User:      userID,
			Timestamp: time.Now(),
		},
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
			timeoutErr := "Deployment timed out before completion"
			_, _ = db.Exec(
				`UPDATE deployments
				 SET status = 'failed', error = $1, completed_at = $2, updated_at = $2
				 WHERE id = $3`,
				timeoutErr, failedAt, dbDeployment.ID,
			)
			_, _ = db.Exec(
				`UPDATE services SET status = 'failed', updated_at = $1 WHERE id = $2`,
				failedAt, service.ID,
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
				return
			case "failed":
				_, _ = db.Exec(
					`UPDATE services SET status = 'failed', updated_at = $1 WHERE id = $2`,
					time.Now(), service.ID,
				)
				return
			}
		}
	}
}

func mapEngineStatusToDBStatus(status string) string {
	switch status {
	case "running":
		return "deployed"
	case "cancelled":
		return "failed"
	default:
		return status
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

	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	var d DeploymentModel
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
		&d.ID, &d.ServiceID, &d.CommitHash, &d.Status, &d.ImageName, &d.ImageTag,
		&d.BuildLog, &d.RuntimeLog, &d.Error, &d.StartedAt, &d.CompletedAt,
		&d.CreatedAt, &d.UpdatedAt, &ownerCheck,
	)

	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Deployment not found"})
		return
	}

	if ownerCheck != userID.(string) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
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

	if ownerCheck != userID.(string) {
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
		 (id, service_id, commit_hash, status, image_name, image_tag, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
		rollback.ID, rollback.ServiceID, rollback.CommitHash, rollback.Status,
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

	go func() {
		time.Sleep(2 * time.Second)
		db.(*database.DB).Exec(
			`UPDATE deployments SET status = 'deployed', completed_at = $1, updated_at = $1 WHERE id = $2`,
			time.Now(), rollbackID,
		)
		db.(*database.DB).Exec(
			`UPDATE services SET status = 'running', updated_at = $1 WHERE id = $2`,
			time.Now(), serviceID,
		)
	}()

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
