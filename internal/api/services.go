package api

import (
	"containr/internal/database"
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
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time `json:"updated_at" db:"updated_at"`
}

// CreateServiceRequest represents a request to create a service
type CreateServiceRequest struct {
	ProjectID   uuid.UUID `json:"project_id" binding:"required"`
	Name        string    `json:"name" binding:"required,min=1,max=255"`
	Type        string    `json:"type" binding:"required,oneof=web worker database cron"`
	Image       string    `json:"image"`
	Command     string    `json:"command"`
	Environment string    `json:"environment" binding:"required,oneof=production preview development"`
	GitRepo     string    `json:"git_repo"`
	GitBranch   string    `json:"git_branch"`
	BuildPath   string    `json:"build_path"`
	CPU         string    `json:"cpu"`
	Memory      string    `json:"memory"`
}

// UpdateServiceRequest represents a request to update a service
type UpdateServiceRequest struct {
	Name        string `json:"name" binding:"omitempty,min=1,max=255"`
	Type        string `json:"type" binding:"omitempty,oneof=web worker database cron"`
	Image       string `json:"image"`
	Command     string `json:"command"`
	Environment string `json:"environment" binding:"omitempty,oneof=production preview development"`
	GitRepo     string `json:"git_repo"`
	GitBranch   string `json:"git_branch"`
	BuildPath   string `json:"build_path"`
	CPU         string `json:"cpu"`
	Memory      string `json:"memory"`
}

// handleGetServices retrieves all services for a project
func handleGetServices(c *gin.Context) {
	db, exists := c.Get("db")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database connection not available"})
		return
	}

	projectIDStr := c.Param("project_id")
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

	// Get services for the project
	rows, err := db.(*database.DB).Query(
		`SELECT id, project_id, name, type, status, image, command, environment, 
				git_repo, git_branch, build_path, cpu, memory, created_at, updated_at 
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
			&service.CreatedAt, &service.UpdatedAt,
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to scan service"})
			return
		}
		services = append(services, service)
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

	var req CreateServiceRequest
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

	// Check if project exists and user has access
	var project Project
	err := db.(*database.DB).QueryRow(
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
		ID:          uuid.New(),
		ProjectID:   req.ProjectID,
		Name:        req.Name,
		Type:        req.Type,
		Status:      "stopped", // Initial status
		Image:       req.Image,
		Command:     req.Command,
		Environment: req.Environment,
		GitRepo:     req.GitRepo,
		GitBranch:   req.GitBranch,
		BuildPath:   req.BuildPath,
		CPU:         req.CPU,
		Memory:      req.Memory,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	// Set default values if not provided
	if service.CPU == "" {
		service.CPU = "0.5"
	}
	if service.Memory == "" {
		service.Memory = "512Mi"
	}

	// Insert service into database
	_, err = db.(*database.DB).Exec(
		`INSERT INTO services 
			(id, project_id, name, type, status, image, command, environment, 
				 git_repo, git_branch, build_path, cpu, memory, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
		service.ID, service.ProjectID, service.Name, service.Type, service.Status,
		service.Image, service.Command, service.Environment, service.GitRepo,
		service.GitBranch, service.BuildPath, service.CPU, service.Memory,
		service.CreatedAt, service.UpdatedAt,
	)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create service"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"service": service})
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

	// Get user ID from JWT token
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	// Get service with project ownership check
	var service Service
	err = db.(*database.DB).QueryRow(
		`SELECT s.id, s.project_id, s.name, s.type, s.status, s.image, s.command, 
				s.environment, s.git_repo, s.git_branch, s.build_path, s.cpu, s.memory, 
				s.created_at, s.updated_at
			FROM services s
			JOIN projects p ON s.project_id = p.id
			WHERE s.id = $1 AND p.owner_id = $2`,
		serviceID, userID,
	).Scan(
		&service.ID, &service.ProjectID, &service.Name, &service.Type, &service.Status,
		&service.Image, &service.Command, &service.Environment, &service.GitRepo,
		&service.GitBranch, &service.BuildPath, &service.CPU, &service.Memory,
		&service.CreatedAt, &service.UpdatedAt,
	)

	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Service not found"})
		return
	}

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
		`SELECT s.id, s.project_id, s.name, s.type, s.status, s.image, s.command, 
				s.environment, s.git_repo, s.git_branch, s.build_path, s.cpu, s.memory, 
				s.created_at, s.updated_at
			FROM services s
			JOIN projects p ON s.project_id = p.id
			WHERE s.id = $1 AND p.owner_id = $2`,
		serviceID, userID,
	).Scan(
		&existingService.ID, &existingService.ProjectID, &existingService.Name, &existingService.Type,
		&existingService.Status, &existingService.Image, &existingService.Command,
		&existingService.Environment, &existingService.GitRepo, &existingService.GitBranch,
		&existingService.BuildPath, &existingService.CPU, &existingService.Memory,
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

	existingService.UpdatedAt = time.Now()

	// Update service in database
	_, err = db.(*database.DB).Exec(
		`UPDATE services 
			SET name = $1, type = $2, image = $3, command = $4, environment = $5,
				git_repo = $6, git_branch = $7, build_path = $8, cpu = $9, memory = $10, updated_at = $11
			WHERE id = $12`,
		existingService.Name, existingService.Type, existingService.Image, existingService.Command,
		existingService.Environment, existingService.GitRepo, existingService.GitBranch,
		existingService.BuildPath, existingService.CPU, existingService.Memory,
		existingService.UpdatedAt, existingService.ID,
	)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update service"})
		return
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
	if projectOwnerID != userID.(string) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
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
