package api

import (
	"containr/internal/database"
	"containr/internal/deployment"
	"context"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// Service represents a service in the system
type Service struct {
	ID          uuid.UUID `json:"id" db:"id"`
	ProjectID   uuid.UUID `json:"project_id" db:"project_id"`
	Name        string    `json:"name" db:"name"`
	Type        string    `json:"type" db:"type"`     // web, worker, database, etc.
	Status      string    `json:"status" db:"status"` // building, running, failed, stopped
	Image       string    `json:"image" db:"image"`
	Command     string    `json:"command" db:"command"`
	Environment string    `json:"environment" db:"environment"` // production, preview, development
	GitRepo     string    `json:"git_repo" db:"git_repo"`
	GitBranch   string    `json:"git_branch" db:"git_branch"`
	BuildPath   string    `json:"build_path" db:"build_path"`
	CPU         string    `json:"cpu" db:"cpu"`
	Memory      string    `json:"memory" db:"memory"`
	// Runtime spec
	Replicas        int       `json:"replicas" db:"replicas"`
	Port            int       `json:"port" db:"port"`                         // container port to expose
	Domain          string    `json:"domain" db:"domain"`                     // public hostname via Traefik
	HealthCheckPath string    `json:"healthcheck_path" db:"healthcheck_path"` // probed on Port
	RestartPolicy   string    `json:"restart_policy" db:"restart_policy"`
	PublicURL       string    `json:"public_url,omitempty" db:"-"` // computed at read time
	CreatedAt       time.Time `json:"created_at" db:"created_at"`
	UpdatedAt       time.Time `json:"updated_at" db:"updated_at"`
}

// CreateServiceRequest represents a request to create a service
type CreateServiceRequest struct {
	ProjectID       uuid.UUID `json:"project_id"`
	Name            string    `json:"name" binding:"required,min=1,max=255"`
	Type            string    `json:"type" binding:"required,oneof=web worker database cron"`
	Image           string    `json:"image"`
	Command         string    `json:"command"`
	Environment     string    `json:"environment" binding:"required,oneof=production preview development"`
	GitRepo         string    `json:"git_repo"`
	GitBranch       string    `json:"git_branch"`
	BuildPath       string    `json:"build_path"`
	CPU             string    `json:"cpu"`
	Memory          string    `json:"memory"`
	Replicas        int       `json:"replicas"`
	Port            int       `json:"port"`
	Domain          string    `json:"domain"`
	HealthCheckPath string    `json:"healthcheck_path"`
	RestartPolicy   string    `json:"restart_policy"`
}

// UpdateServiceRequest represents a request to update a service
type UpdateServiceRequest struct {
	Name            string  `json:"name" binding:"omitempty,min=1,max=255"`
	Type            string  `json:"type" binding:"omitempty,oneof=web worker database cron"`
	Image           string  `json:"image"`
	Command         string  `json:"command"`
	Environment     string  `json:"environment" binding:"omitempty,oneof=production preview development"`
	GitRepo         string  `json:"git_repo"`
	GitBranch       string  `json:"git_branch"`
	BuildPath       string  `json:"build_path"`
	CPU             string  `json:"cpu"`
	Memory          string  `json:"memory"`
	Replicas        *int    `json:"replicas"`
	Port            *int    `json:"port"`
	Domain          *string `json:"domain"`
	HealthCheckPath *string `json:"healthcheck_path"`
	RestartPolicy   string  `json:"restart_policy"`
}

// handleGetServices retrieves all services for a project
func handleGetServices(c *gin.Context) {
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
	if !projectExists {
		c.JSON(http.StatusNotFound, gin.H{"error": "Project not found"})
		return
	}
	if !allowed {
		c.JSON(http.StatusNotFound, gin.H{"error": "Project not found"})
		return
	}

	// Get services for the project
	rows, err := db.(*database.DB).Query(
		`SELECT id, project_id, name,
				COALESCE(type, service_type, ''),
				COALESCE(status, ''),
				COALESCE(image, image_name, ''),
				COALESCE(command, start_command, ''),
				COALESCE(environment, ''),
				COALESCE(git_repo, source_url, ''),
				COALESCE(git_branch, ''),
				COALESCE(build_path, ''),
				COALESCE(cpu, ''),
				COALESCE(memory, ''),
				COALESCE(replicas, 1), COALESCE(port, 0),
				COALESCE(domain, ''), COALESCE(healthcheck_path, ''),
				COALESCE(restart_policy, 'unless-stopped'),
				created_at, updated_at 
			FROM services 
			WHERE project_id = $1 
			ORDER BY created_at DESC`,
		projectID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve services"})
		return
	}
	defer rows.Close()

	var services []Service
	for rows.Next() {
		var service Service
		err := rows.Scan(
			&service.ID, &service.ProjectID, &service.Name, &service.Type, &service.Status,
			&service.Image, &service.Command, &service.Environment, &service.GitRepo,
			&service.GitBranch, &service.BuildPath, &service.CPU, &service.Memory,
			&service.Replicas, &service.Port, &service.Domain, &service.HealthCheckPath,
			&service.RestartPolicy, &service.CreatedAt, &service.UpdatedAt,
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to scan service"})
			return
		}
		services = append(services, service)
	}

	// Reconcile stored status with live container state (no-op without Docker).
	for i := range services {
		liveServiceStatus(c, db.(*database.DB), &services[i])
	}

	c.JSON(http.StatusOK, gin.H{"services": services})
}

// handleCreateService creates a new service
func handleCreateService(c *gin.Context) {
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

	var req CreateServiceRequest
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

	// Check if service name already exists in the project
	var count int
	err = db.(*database.DB).QueryRow(
		"SELECT COUNT(*) FROM services WHERE project_id = $1 AND name = $2",
		req.ProjectID, req.Name,
	).Scan(&count)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to check service name"})
		return
	}

	if count > 0 {
		c.JSON(http.StatusConflict, gin.H{"error": "Service name already exists in this project"})
		return
	}

	// Create new service
	service := Service{
		ID:              uuid.New(),
		ProjectID:       req.ProjectID,
		Name:            req.Name,
		Type:            req.Type,
		Status:          "stopped", // Initial status
		Image:           req.Image,
		Command:         req.Command,
		Environment:     req.Environment,
		GitRepo:         req.GitRepo,
		GitBranch:       req.GitBranch,
		BuildPath:       req.BuildPath,
		CPU:             req.CPU,
		Memory:          req.Memory,
		Replicas:        req.Replicas,
		Port:            req.Port,
		Domain:          req.Domain,
		HealthCheckPath: req.HealthCheckPath,
		RestartPolicy:   req.RestartPolicy,
		CreatedAt:       time.Now(),
		UpdatedAt:       time.Now(),
	}

	// Set default values if not provided
	if service.CPU == "" {
		service.CPU = "0.5"
	}
	if service.Memory == "" {
		service.Memory = "512Mi"
	}
	if service.Replicas < 1 {
		service.Replicas = 1
	}
	if service.RestartPolicy == "" {
		service.RestartPolicy = "unless-stopped"
	}

	environmentID, err := getProjectEnvironmentID(db.(*database.DB), service.ProjectID, service.Environment)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to resolve service environment"})
		return
	}

	sourceType := inferServiceSourceType(service)

	// Insert service into database
	_, err = db.(*database.DB).Exec(
		`INSERT INTO services
			(id, project_id, name, environment_id, service_type, source_type, source_url, image_name,
				 build_command, start_command, type, status, image, command, environment,
				 git_repo, git_branch, build_path, cpu, memory, replicas, port, domain,
				 healthcheck_path, restart_policy, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27)`,
		service.ID, service.ProjectID, service.Name, environmentID, service.Type,
		sourceType, firstNonEmpty(service.GitRepo, service.Image), service.Image,
		"", service.Command, service.Type, service.Status, service.Image, service.Command,
		service.Environment, service.GitRepo, service.GitBranch, service.BuildPath, service.CPU, service.Memory,
		service.Replicas, service.Port, service.Domain, service.HealthCheckPath, service.RestartPolicy,
		service.CreatedAt, service.UpdatedAt,
	)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create service"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"service": service})
}

func getProjectEnvironmentID(db *database.DB, projectID uuid.UUID, environment string) (uuid.UUID, error) {
	var environmentID uuid.UUID
	err := db.QueryRow(
		"SELECT id FROM environments WHERE project_id = $1 AND name = $2",
		projectID,
		environment,
	).Scan(&environmentID)
	return environmentID, err
}

func inferServiceSourceType(service Service) string {
	if service.GitRepo != "" {
		return "github"
	}
	if service.Image != "" {
		return "image"
	}
	return "dockerfile"
}

// handleGetService retrieves a specific service
func handleGetService(c *gin.Context) {
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

	// Get service — public when its project is approved, otherwise
	// owner/member/admin only.
	userID := optionalUserUUID(c)
	var service Service
	err = db.(*database.DB).QueryRow(
		`SELECT s.id, s.project_id, s.name,
				COALESCE(s.type, s.service_type, ''),
				COALESCE(s.status, ''),
				COALESCE(s.image, s.image_name, ''),
				COALESCE(s.command, s.start_command, ''),
				COALESCE(s.environment, ''),
				COALESCE(s.git_repo, s.source_url, ''),
				COALESCE(s.git_branch, ''),
				COALESCE(s.build_path, ''),
				COALESCE(s.cpu, ''),
				COALESCE(s.memory, ''),
				COALESCE(s.replicas, 1), COALESCE(s.port, 0),
				COALESCE(s.domain, ''), COALESCE(s.healthcheck_path, ''),
				COALESCE(s.restart_policy, 'unless-stopped'),
				s.created_at, s.updated_at
			FROM services s
			JOIN projects p ON s.project_id = p.id
			WHERE s.id = $1 AND (p.is_approved OR p.owner_id = $2 OR $3::bool
				OR EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = $2))`,
		serviceID, userID, contextIsAdmin(c),
	).Scan(
		&service.ID, &service.ProjectID, &service.Name, &service.Type, &service.Status,
		&service.Image, &service.Command, &service.Environment, &service.GitRepo,
		&service.GitBranch, &service.BuildPath, &service.CPU, &service.Memory,
		&service.Replicas, &service.Port, &service.Domain, &service.HealthCheckPath,
		&service.RestartPolicy, &service.CreatedAt, &service.UpdatedAt,
	)

	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Service not found"})
		return
	}

	liveServiceStatus(c, db.(*database.DB), &service)
	c.JSON(http.StatusOK, gin.H{"service": service})
}

// handleUpdateService updates a service
func handleUpdateService(c *gin.Context) {
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

	var req UpdateServiceRequest
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

	// Check if service exists and user has access
	var existingService Service
	err = db.(*database.DB).QueryRow(
		`SELECT s.id, s.project_id, s.name,
				COALESCE(s.type, s.service_type, ''),
				COALESCE(s.status, ''),
				COALESCE(s.image, s.image_name, ''),
				COALESCE(s.command, s.start_command, ''),
				COALESCE(s.environment, ''),
				COALESCE(s.git_repo, s.source_url, ''),
				COALESCE(s.git_branch, ''),
				COALESCE(s.build_path, ''),
				COALESCE(s.cpu, ''),
				COALESCE(s.memory, ''),
				COALESCE(s.replicas, 1), COALESCE(s.port, 0),
				COALESCE(s.domain, ''), COALESCE(s.healthcheck_path, ''),
				COALESCE(s.restart_policy, 'unless-stopped'),
				s.created_at, s.updated_at
			FROM services s
			JOIN projects p ON s.project_id = p.id
			WHERE s.id = $1 AND (p.owner_id = $2 OR $3::bool)`,
		serviceID, userID, contextIsAdmin(c),
	).Scan(
		&existingService.ID, &existingService.ProjectID, &existingService.Name, &existingService.Type,
		&existingService.Status, &existingService.Image, &existingService.Command,
		&existingService.Environment, &existingService.GitRepo, &existingService.GitBranch,
		&existingService.BuildPath, &existingService.CPU, &existingService.Memory,
		&existingService.Replicas, &existingService.Port, &existingService.Domain,
		&existingService.HealthCheckPath, &existingService.RestartPolicy,
		&existingService.CreatedAt, &existingService.UpdatedAt,
	)

	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Service not found"})
		return
	}

	// Update fields if provided
	if req.Name != "" {
		existingService.Name = req.Name
	}
	if req.Type != "" {
		existingService.Type = req.Type
	}
	if req.Image != "" {
		existingService.Image = req.Image
	}
	if req.Command != "" {
		existingService.Command = req.Command
	}
	if req.Environment != "" {
		existingService.Environment = req.Environment
	}
	if req.GitRepo != "" {
		existingService.GitRepo = req.GitRepo
	}
	if req.GitBranch != "" {
		existingService.GitBranch = req.GitBranch
	}
	if req.BuildPath != "" {
		existingService.BuildPath = req.BuildPath
	}
	if req.CPU != "" {
		existingService.CPU = req.CPU
	}
	if req.Memory != "" {
		existingService.Memory = req.Memory
	}
	if req.Replicas != nil {
		existingService.Replicas = *req.Replicas
	}
	if req.Port != nil {
		existingService.Port = *req.Port
	}
	if req.Domain != nil {
		existingService.Domain = *req.Domain
	}
	if req.HealthCheckPath != nil {
		existingService.HealthCheckPath = *req.HealthCheckPath
	}
	if req.RestartPolicy != "" {
		existingService.RestartPolicy = req.RestartPolicy
	}

	existingService.UpdatedAt = time.Now()

	// Update service in database
	_, err = db.(*database.DB).Exec(
		`UPDATE services
			SET name = $1, type = $2, image = $3, command = $4, environment = $5,
				git_repo = $6, git_branch = $7, build_path = $8, cpu = $9, memory = $10,
				replicas = $11, port = $12, domain = $13, healthcheck_path = $14,
				restart_policy = $15, updated_at = $16
			WHERE id = $17`,
		existingService.Name, existingService.Type, existingService.Image, existingService.Command,
		existingService.Environment, existingService.GitRepo, existingService.GitBranch,
		existingService.BuildPath, existingService.CPU, existingService.Memory,
		existingService.Replicas, existingService.Port, existingService.Domain,
		existingService.HealthCheckPath, existingService.RestartPolicy,
		existingService.UpdatedAt, existingService.ID,
	)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update service"})
		return
	}

	// A replica change applies immediately when the service has live
	// containers; other spec fields take effect on the next deploy.
	if req.Replicas != nil && existingService.Status == "running" {
		if engineValue, exists := c.Get("deployment_engine"); exists && engineValue != nil {
			engine := engineValue.(*deployment.DeploymentEngine)
			serviceCopy := existingService
			go func() {
				spec, err := serviceRuntimeSpec(db.(*database.DB), serviceCopy)
				if err != nil {
					return
				}
				ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
				defer cancel()
				_, _ = engine.ReconcileService(ctx, spec)
			}()
		}
	}

	c.JSON(http.StatusOK, gin.H{"service": existingService})
}

// handleDeleteService deletes a service
func handleDeleteService(c *gin.Context) {
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

	// Get user ID from JWT token
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	// Check if service exists and user has access
	var projectOwnerID string
	err = db.(*database.DB).QueryRow(
		`SELECT p.owner_id 
			FROM services s
			JOIN projects p ON s.project_id = p.id
			WHERE s.id = $1`,
		serviceID,
	).Scan(&projectOwnerID)

	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Service not found"})
		return
	}

	// Check if user owns the project
	if projectOwnerID != userID.(string) && !isAdminUser(db.(*database.DB), userID.(string)) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	// Remove runtime containers before dropping the row.
	if engineValue, exists := c.Get("deployment_engine"); exists && engineValue != nil {
		if engine, ok := engineValue.(*deployment.DeploymentEngine); ok {
			_ = engine.RemoveServiceContainers(c.Request.Context(), serviceID.String())
		}
	}

	// Delete service (cascade will handle related records)
	_, err = db.(*database.DB).Exec(
		"DELETE FROM services WHERE id = $1",
		serviceID,
	)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete service"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Service deleted successfully"})
}
