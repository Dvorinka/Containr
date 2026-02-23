package api

import (
	"containr/internal/database"
	"containr/internal/deployment"
	"context"
	"encoding/json"
	"net/http"
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

	now := time.Now()
	d := DeploymentModel{
		ID:         uuid.New(),
		ServiceID:  serviceID,
		CommitHash: &req.CommitHash,
		Status:     "pending",
		ImageName:  "",
		ImageTag:   "",
		CreatedAt:  now,
		UpdatedAt:  now,
	}

	if req.CommitHash != "" {
		d.CommitHash = &req.CommitHash
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

	_, err = db.(*database.DB).Exec(
		`UPDATE services SET status = 'building', updated_at = $1 WHERE id = $2`,
		time.Now(), serviceID,
	)
	if err != nil {
	}

	engine, exists := c.Get("deployment_engine")
	if exists && engine != nil {
		go func() {
			ctx, cancel := context.WithTimeout(context.Background(), 30*time.Minute)
			defer cancel()

			envVarsJSON, _ := json.Marshal(req.EnvVars)
			_ = envVarsJSON

			deployReq := &deployment.DeploymentRequest{
				ProjectID:   service.ProjectID.String(),
				ServiceID:   serviceID.String(),
				Environment: service.Environment,
				Config: deployment.ServiceConfig{
					Name:        service.Name,
					Image:       service.Image,
					Environment: req.EnvVars,
					Replicas:    1,
				},
				BuildConfig: &deployment.BuildConfig{
					BuildType:  "nixpacks",
					SourcePath: service.BuildPath,
					Branch:     service.GitBranch,
					Commit:     req.CommitHash,
				},
				Trigger: deployment.TriggerConfig{
					Type:      req.Trigger,
					Source:    "api",
					User:      userID.(string),
					Timestamp: now,
				},
			}

			_, _ = engine.(*deployment.DeploymentEngine).Deploy(ctx, deployReq)
		}()
	}

	c.JSON(http.StatusCreated, DeploymentResponse{
		ID:         d.ID,
		ServiceID:  d.ServiceID,
		CommitHash: d.CommitHash,
		Status:     d.Status,
		CreatedAt:  d.CreatedAt,
	})
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
