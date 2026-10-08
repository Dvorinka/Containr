package api

import (
	"containr/internal/database"
	"containr/internal/deployment"
	"containr/internal/deployqueue"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
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
	Replicas        int             `json:"replicas" db:"replicas"`
	Port            int             `json:"port" db:"port"`                         // container port to expose
	Domain          string          `json:"domain" db:"domain"`                     // public hostname via Traefik
	HealthCheckPath string          `json:"healthcheck_path" db:"healthcheck_path"` // probed on Port
	RestartPolicy   string          `json:"restart_policy" db:"restart_policy"`
	PublicURL       string          `json:"public_url,omitempty" db:"-"` // computed at read time
	Volumes         []ServiceVolume `json:"volumes" db:"-"`              // loaded lazily — stored as JSONB
	Domains         []ServiceDomain `json:"domains,omitempty" db:"-"`
	MaintenanceMode bool            `json:"maintenance_mode" db:"-"`
	BasicAuth       []string        `json:"basic_auth,omitempty" db:"-"` // usernames only, never hashes
	Builder         string          `json:"builder" db:"builder"`        // auto|railpack|nixpacks|dockerfile|static
	CPUReserve      string          `json:"cpu_reserve,omitempty" db:"cpu_reserve"`
	MemoryReserve   string          `json:"memory_reserve,omitempty" db:"memory_reserve"`
	StaticBuildCmd  string          `json:"static_build_cmd,omitempty" db:"static_build_cmd"`
	StaticDir       string          `json:"static_dir,omitempty" db:"static_dir"`
	CreatedAt       time.Time       `json:"created_at" db:"created_at"`
	UpdatedAt       time.Time       `json:"updated_at" db:"updated_at"`
}

// ServiceVolume is a volume/bind mount applied to every replica.
type ServiceVolume struct {
	Type     string `json:"type"`   // volume | bind (empty = volume)
	Source   string `json:"source"` // volume name or host path
	Target   string `json:"target"` // container path (absolute)
	ReadOnly bool   `json:"read_only"`
}

// loadServiceVolumes reads the JSONB column; absent/invalid data degrades
// to no mounts rather than failing the request.
func loadServiceVolumes(db *database.DB, serviceID uuid.UUID) []deployment.VolumeMount {
	var raw []byte
	if err := db.QueryRow(`SELECT volumes FROM services WHERE id = $1`, serviceID).Scan(&raw); err != nil {
		return nil
	}
	var stored []ServiceVolume
	if err := json.Unmarshal(raw, &stored); err != nil {
		return nil
	}
	out := make([]deployment.VolumeMount, 0, len(stored))
	for _, v := range stored {
		out = append(out, deployment.VolumeMount{
			Type:        v.Type,
			Source:      v.Source,
			Destination: v.Target,
			ReadOnly:    v.ReadOnly,
		})
	}
	return out
}

// validateServiceVolumes enforces the mount contract — bad paths fail
// fast at write time instead of surfacing as docker create errors later.
func validateServiceVolumes(vols []ServiceVolume) error {
	for i, v := range vols {
		if v.Type == "" {
			v.Type = "volume"
		}
		if v.Type != "volume" && v.Type != "bind" {
			return fmt.Errorf("volumes[%d].type must be volume or bind", i)
		}
		if strings.TrimSpace(v.Source) == "" {
			return fmt.Errorf("volumes[%d].source is required", i)
		}
		if !strings.HasPrefix(v.Target, "/") {
			return fmt.Errorf("volumes[%d].target must be an absolute container path", i)
		}
	}
	return nil
}

// CreateServiceRequest represents a request to create a service
type CreateServiceRequest struct {
	ProjectID       uuid.UUID       `json:"project_id"`
	Name            string          `json:"name" binding:"required,min=1,max=255"`
	Type            string          `json:"type" binding:"required,oneof=web worker database cron"`
	Image           string          `json:"image"`
	Command         string          `json:"command"`
	Environment     string          `json:"environment" binding:"required,oneof=production preview development"`
	GitRepo         string          `json:"git_repo"`
	GitBranch       string          `json:"git_branch"`
	BuildPath       string          `json:"build_path"`
	CPU             string          `json:"cpu"`
	Memory          string          `json:"memory"`
	Replicas        int             `json:"replicas"`
	Port            int             `json:"port"`
	Domain          string          `json:"domain"`
	HealthCheckPath string          `json:"healthcheck_path"`
	RestartPolicy   string          `json:"restart_policy"`
	Volumes         []ServiceVolume `json:"volumes"`
	MaintenanceMode bool            `json:"maintenance_mode"`
	BasicAuth       []BasicAuthCred `json:"basic_auth"`
	Builder         string          `json:"builder" binding:"omitempty,oneof=auto railpack nixpacks dockerfile static"`
	CPUReserve      string          `json:"cpu_reserve"`
	MemoryReserve   string          `json:"memory_reserve"`
	StaticBuildCmd  string          `json:"static_build_cmd"`
	StaticDir       string          `json:"static_dir"`
}

// UpdateServiceRequest represents a request to update a service
type UpdateServiceRequest struct {
	Name            string           `json:"name" binding:"omitempty,min=1,max=255"`
	Type            string           `json:"type" binding:"omitempty,oneof=web worker database cron"`
	Image           string           `json:"image"`
	Command         string           `json:"command"`
	Environment     string           `json:"environment" binding:"omitempty,oneof=production preview development"`
	GitRepo         string           `json:"git_repo"`
	GitBranch       string           `json:"git_branch"`
	BuildPath       string           `json:"build_path"`
	CPU             string           `json:"cpu"`
	Memory          string           `json:"memory"`
	Replicas        *int             `json:"replicas"`
	Port            *int             `json:"port"`
	Domain          *string          `json:"domain"`
	HealthCheckPath *string          `json:"healthcheck_path"`
	RestartPolicy   string           `json:"restart_policy"`
	Volumes         *[]ServiceVolume `json:"volumes"`
	MaintenanceMode *bool            `json:"maintenance_mode"`
	BasicAuth       *[]BasicAuthCred `json:"basic_auth"`
	Builder         string           `json:"builder" binding:"omitempty,oneof=auto railpack nixpacks dockerfile static"`
	CPUReserve      *string          `json:"cpu_reserve"`
	MemoryReserve   *string          `json:"memory_reserve"`
	StaticBuildCmd  *string          `json:"static_build_cmd"`
	StaticDir       *string          `json:"static_dir"`
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
				COALESCE(builder, 'auto'), COALESCE(cpu_reserve, ''),
				COALESCE(memory_reserve, ''), COALESCE(static_build_cmd, ''),
				COALESCE(static_dir, ''),
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
			&service.RestartPolicy, &service.Builder, &service.CPUReserve,
			&service.MemoryReserve, &service.StaticBuildCmd, &service.StaticDir,
			&service.CreatedAt, &service.UpdatedAt,
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

	// Set default values if not provided; app_settings.default_cpu /
	// default_memory override the hardcoded fallbacks.
	if service.CPU == "" {
		service.CPU = firstNonEmpty(settingValue(db.(*database.DB), "default_cpu", "", ""), "0.5")
	}
	if service.Memory == "" {
		service.Memory = firstNonEmpty(settingValue(db.(*database.DB), "default_memory", "", ""), "512Mi")
	}
	if req.Builder == "" {
		service.Builder = "auto"
	} else {
		service.Builder = req.Builder
	}
	service.CPUReserve = req.CPUReserve
	service.MemoryReserve = req.MemoryReserve
	service.StaticBuildCmd = req.StaticBuildCmd
	service.StaticDir = req.StaticDir
	if service.Builder == "static" && service.StaticDir == "" {
		service.StaticDir = "dist"
	}
	for label, check := range map[string]func(string) error{
		"cpu": validateCPUSpec, "cpu_reserve": validateCPUSpec,
		"memory": validateMemorySpec, "memory_reserve": validateMemorySpec,
	} {
		v := map[string]string{
			"cpu": service.CPU, "cpu_reserve": service.CPUReserve,
			"memory": service.Memory, "memory_reserve": service.MemoryReserve,
		}[label]
		if err := check(v); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("invalid %s: %s", label, err.Error()), "code": "VALIDATION"})
			return
		}
	}
	if service.Replicas < 1 {
		service.Replicas = 1
	}
	if service.RestartPolicy == "" {
		service.RestartPolicy = "unless-stopped"
	}
	if err := validateServiceVolumes(req.Volumes); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error(), "code": "VALIDATION"})
		return
	}
	service.Volumes = req.Volumes
	volumesJSON, _ := json.Marshal(req.Volumes)
	if len(req.Volumes) == 0 {
		volumesJSON = []byte("[]")
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
				 healthcheck_path, restart_policy, volumes,
				 builder, cpu_reserve, memory_reserve, static_build_cmd, static_dir,
				 created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26,
					$27, $28, $29, $30, $31, $32, $33)`,
		service.ID, service.ProjectID, service.Name, environmentID, service.Type,
		sourceType, firstNonEmpty(service.GitRepo, service.Image), service.Image,
		"", service.Command, service.Type, service.Status, service.Image, service.Command,
		service.Environment, service.GitRepo, service.GitBranch, service.BuildPath, service.CPU, service.Memory,
		service.Replicas, service.Port, service.Domain, service.HealthCheckPath, service.RestartPolicy,
		volumesJSON, service.Builder, service.CPUReserve, service.MemoryReserve,
		service.StaticBuildCmd, service.StaticDir, service.CreatedAt, service.UpdatedAt,
	)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create service"})
		return
	}

	// Domains live in service_domains; services.domain is the derived default.
	if req.Domain != "" && validHostname(strings.ToLower(req.Domain)) {
		_, _ = db.(*database.DB).Exec(
			`INSERT INTO service_domains (service_id, domain, is_default) VALUES ($1, $2, true)
			 ON CONFLICT (service_id, domain) DO UPDATE SET is_default = true`,
			service.ID, strings.ToLower(req.Domain))
	}
	if req.MaintenanceMode || len(req.BasicAuth) > 0 {
		basicAuthUsers := ""
		if encoded, encErr := encodeBasicAuth(req.BasicAuth); encErr == nil {
			basicAuthUsers = encoded
		}
		_, _ = db.(*database.DB).Exec(
			`UPDATE services SET maintenance_mode = $1, basic_auth_users = $2 WHERE id = $3`,
			req.MaintenanceMode, basicAuthUsers, service.ID)
		service.MaintenanceMode = req.MaintenanceMode
		service.BasicAuth = basicAuthUsernames(basicAuthUsers)
	}
	service.Domains = loadServiceDomains(db.(*database.DB), service.ID)

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
				COALESCE(s.builder, 'auto'), COALESCE(s.cpu_reserve, ''),
				COALESCE(s.memory_reserve, ''), COALESCE(s.static_build_cmd, ''),
				COALESCE(s.static_dir, ''),
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
		&service.RestartPolicy, &service.Builder, &service.CPUReserve,
		&service.MemoryReserve, &service.StaticBuildCmd, &service.StaticDir,
		&service.CreatedAt, &service.UpdatedAt,
	)

	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Service not found"})
		return
	}

	liveServiceStatus(c, db.(*database.DB), &service)
	for _, v := range loadServiceVolumes(db.(*database.DB), service.ID) {
		service.Volumes = append(service.Volumes, ServiceVolume{
			Type: v.Type, Source: v.Source, Target: v.Destination, ReadOnly: v.ReadOnly,
		})
	}
	service.Domains = loadServiceDomains(db.(*database.DB), service.ID)
	maintenance, basicAuth := serviceAccess(db.(*database.DB), service.ID)
	service.MaintenanceMode = maintenance
	service.BasicAuth = basicAuthUsernames(basicAuth)
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
				COALESCE(s.builder, 'auto'), COALESCE(s.cpu_reserve, ''),
				COALESCE(s.memory_reserve, ''), COALESCE(s.static_build_cmd, ''),
				COALESCE(s.static_dir, ''),
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
		&existingService.Builder, &existingService.CPUReserve,
		&existingService.MemoryReserve, &existingService.StaticBuildCmd,
		&existingService.StaticDir,
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
	if req.Builder != "" {
		existingService.Builder = req.Builder
	}
	if req.CPUReserve != nil {
		existingService.CPUReserve = *req.CPUReserve
	}
	if req.MemoryReserve != nil {
		existingService.MemoryReserve = *req.MemoryReserve
	}
	if req.StaticBuildCmd != nil {
		existingService.StaticBuildCmd = *req.StaticBuildCmd
	}
	if req.StaticDir != nil {
		existingService.StaticDir = *req.StaticDir
	}
	if existingService.Builder == "static" && existingService.StaticDir == "" {
		existingService.StaticDir = "dist"
	}
	for label, check := range map[string]func(string) error{
		"cpu": validateCPUSpec, "cpu_reserve": validateCPUSpec,
		"memory": validateMemorySpec, "memory_reserve": validateMemorySpec,
	} {
		v := map[string]string{
			"cpu": existingService.CPU, "cpu_reserve": existingService.CPUReserve,
			"memory": existingService.Memory, "memory_reserve": existingService.MemoryReserve,
		}[label]
		if err := check(v); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("invalid %s: %s", label, err.Error()), "code": "VALIDATION"})
			return
		}
	}
	// lib/pq sends a nil []byte as an empty bytea literal rather than NULL,
	// so the COALESCE fallback needs an untyped nil when volumes aren't sent.
	var volumesArg interface{}
	if req.Volumes != nil {
		if err := validateServiceVolumes(*req.Volumes); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error(), "code": "VALIDATION"})
			return
		}
		existingService.Volumes = *req.Volumes
		volumesJSON, _ := json.Marshal(*req.Volumes)
		volumesArg = volumesJSON
	}

	existingService.UpdatedAt = time.Now()

	// Update service in database
	_, err = db.(*database.DB).Exec(
		`UPDATE services
			SET name = $1, type = $2, image = $3, command = $4, environment = $5,
				git_repo = $6, git_branch = $7, build_path = $8, cpu = $9, memory = $10,
				replicas = $11, port = $12, domain = $13, healthcheck_path = $14,
				restart_policy = $15, volumes = COALESCE($17::jsonb, volumes), updated_at = $16,
				builder = $19, cpu_reserve = $20, memory_reserve = $21,
				static_build_cmd = $22, static_dir = $23
			WHERE id = $18`,
		existingService.Name, existingService.Type, existingService.Image, existingService.Command,
		existingService.Environment, existingService.GitRepo, existingService.GitBranch,
		existingService.BuildPath, existingService.CPU, existingService.Memory,
		existingService.Replicas, existingService.Port, existingService.Domain,
		existingService.HealthCheckPath, existingService.RestartPolicy,
		existingService.UpdatedAt, volumesArg, existingService.ID,
		existingService.Builder, existingService.CPUReserve, existingService.MemoryReserve,
		existingService.StaticBuildCmd, existingService.StaticDir,
	)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update service"})
		return
	}

	// Domain writes route through service_domains — services.domain is the
	// derived default and gets rewritten by syncDefaultDomain.
	if req.Domain != nil {
		domain := strings.ToLower(strings.TrimSpace(*req.Domain))
		if domain == "" {
			_, _ = db.(*database.DB).Exec(`DELETE FROM service_domains WHERE service_id = $1`, serviceID)
		} else if validHostname(domain) {
			_, _ = db.(*database.DB).Exec(`UPDATE service_domains SET is_default = false WHERE service_id = $1`, serviceID)
			_, _ = db.(*database.DB).Exec(
				`INSERT INTO service_domains (service_id, domain, is_default) VALUES ($1, $2, true)
				 ON CONFLICT (service_id, domain) DO UPDATE SET is_default = true`,
				serviceID, domain)
		} else {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid hostname", "code": "VALIDATION"})
			return
		}
		syncDefaultDomain(db.(*database.DB), serviceID)
		_ = db.(*database.DB).QueryRow(`SELECT domain FROM services WHERE id = $1`, serviceID).Scan(&existingService.Domain)
	}

	if req.MaintenanceMode != nil || req.BasicAuth != nil {
		maintenance, basicAuth := serviceAccess(db.(*database.DB), serviceID)
		if req.MaintenanceMode != nil {
			maintenance = *req.MaintenanceMode
		}
		if req.BasicAuth != nil {
			encoded, encErr := encodeBasicAuth(*req.BasicAuth)
			if encErr != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to encode basic auth", "code": "INTERNAL"})
				return
			}
			basicAuth = encoded
		}
		_, _ = db.(*database.DB).Exec(
			`UPDATE services SET maintenance_mode = $1, basic_auth_users = $2 WHERE id = $3`,
			maintenance, basicAuth, serviceID)
		existingService.MaintenanceMode = maintenance
	}
	existingService.Domains = loadServiceDomains(db.(*database.DB), serviceID)
	_, storedAuth := serviceAccess(db.(*database.DB), serviceID)
	existingService.BasicAuth = basicAuthUsernames(storedAuth)

	// A replica change applies immediately when the service has live
	// containers; other spec fields take effect on the next deploy.
	// Runs through the deploy queue so it can't overlap a build.
	if req.Replicas != nil && existingService.Status == "running" {
		if engineValue, exists := c.Get("deployment_engine"); exists && engineValue != nil {
			engine := engineValue.(*deployment.DeploymentEngine)
			serviceCopy := existingService
			dbCopy := db.(*database.DB)
			getDeployQueue(c).Enqueue(serviceCopy.ID, deployqueue.Job{Run: func(jctx context.Context) {
				spec, err := serviceRuntimeSpec(dbCopy, serviceCopy)
				if err != nil {
					return
				}
				if state, err := engine.ReconcileService(jctx, spec); err == nil && state != nil {
					persistPublishedPort(dbCopy, serviceCopy.ID, state.Ports)
				}
			}})
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
