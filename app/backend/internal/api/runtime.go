package api

import (
	"context"
	"fmt"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"

	"containr/internal/database"
	"containr/internal/deployment"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// serviceRuntimeSpec builds the container spec for a service: stored env vars
// merged with ${{Service.KEY}} references resolved across the project.
func serviceRuntimeSpec(db *database.DB, service Service) (deployment.RuntimeSpec, error) {
	env, err := resolveServiceEnv(db, service)
	if err != nil {
		return deployment.RuntimeSpec{}, err
	}

	spec := deployment.RuntimeSpec{
		ProjectID:     service.ProjectID.String(),
		ServiceID:     service.ID.String(),
		Name:          service.Name,
		Image:         service.Image,
		Env:           env,
		Replicas:      service.Replicas,
		Port:          int32(service.Port),
		Domain:        service.Domain,
		HealthPath:    service.HealthCheckPath,
		RestartPolicy: service.RestartPolicy,
	}
	if cmd := strings.TrimSpace(service.Command); cmd != "" {
		spec.Command = strings.Fields(cmd)
	}
	if spec.Replicas < 1 {
		spec.Replicas = 1
	}
	if spec.RestartPolicy == "" {
		spec.RestartPolicy = "unless-stopped"
	}
	spec.NanoCPUs = parseCPULimit(service.CPU)
	spec.MemoryBytes = parseMemoryLimit(service.Memory)
	if spec.Port > 0 {
		env["PORT"] = strconv.Itoa(service.Port)
	}
	return spec, nil
}

var refVarPattern = regexp.MustCompile(`\$\{\{\s*([A-Za-z0-9_-]+)\.([A-Za-z_][A-Za-z0-9_]*)\s*\}\}`)

// resolveServiceEnv loads the service's variables (real values, including
// secrets) and expands ${{service.KEY}} references. KEY may be a variable on
// the referenced service, or the builtins HOST (service name alias) and PORT.
func resolveServiceEnv(db *database.DB, service Service) (map[string]string, error) {
	rows, err := db.Query(
		`SELECT key, value FROM environment_variables WHERE service_id = $1`,
		service.ID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	env := map[string]string{}
	for rows.Next() {
		var k, v string
		if err := rows.Scan(&k, &v); err != nil {
			return nil, err
		}
		env[k] = v
	}

	var refServices []struct{ ID, Name string }
	svcRows, err := db.Query(
		`SELECT id, name FROM services WHERE project_id = $1`,
		service.ProjectID,
	)
	if err != nil {
		return nil, err
	}
	defer svcRows.Close()
	for svcRows.Next() {
		var s struct{ ID, Name string }
		if err := svcRows.Scan(&s.ID, &s.Name); err != nil {
			return nil, err
		}
		refServices = append(refServices, s)
	}

	byName := map[string]string{}
	for _, s := range refServices {
		byName[strings.ToLower(s.Name)] = s.ID
	}

	resolve := func(serviceName, key string) (string, bool) {
		id, ok := byName[strings.ToLower(serviceName)]
		if !ok {
			return "", false
		}
		switch strings.ToUpper(key) {
		case "HOST":
			return serviceName, true
		case "PORT":
			var port int
			if err := db.QueryRow(`SELECT COALESCE(port, 0) FROM services WHERE id = $1`, id).Scan(&port); err == nil && port > 0 {
				return strconv.Itoa(port), true
			}
			return "", false
		}
		var value string
		err := db.QueryRow(
			`SELECT value FROM environment_variables WHERE service_id = $1 AND key = $2`,
			id, key,
		).Scan(&value)
		if err != nil {
			return "", false
		}
		return value, true
	}

	for k, v := range env {
		env[k] = refVarPattern.ReplaceAllStringFunc(v, func(match string) string {
			parts := refVarPattern.FindStringSubmatch(match)
			if len(parts) != 3 {
				return match
			}
			if resolved, ok := resolve(parts[1], parts[2]); ok {
				return resolved
			}
			return match
		})
	}
	return env, nil
}

func parseCPULimit(cpu string) int64 {
	v, err := strconv.ParseFloat(strings.TrimSpace(cpu), 64)
	if err != nil || v <= 0 {
		return 0
	}
	return int64(v * 1e9)
}

var memUnits = map[string]int64{"k": 1e3, "m": 1e6, "g": 1e9, "ki": 1 << 10, "mi": 1 << 20, "gi": 1 << 30}

func parseMemoryLimit(mem string) int64 {
	s := strings.ToLower(strings.TrimSpace(mem))
	for suffix, mult := range memUnits {
		if strings.HasSuffix(s, suffix) {
			if v, err := strconv.ParseFloat(strings.TrimSuffix(s, suffix), 64); err == nil {
				return int64(v * float64(mult))
			}
		}
	}
	if v, err := strconv.ParseInt(s, 10, 64); err == nil {
		return v
	}
	return 0
}

func getRuntimeEngine(c *gin.Context) (*deployment.DeploymentEngine, *database.DB, bool) {
	dbValue, exists := c.Get("db")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database connection not available"})
		return nil, nil, false
	}
	engineValue, exists := c.Get("deployment_engine")
	if !exists || engineValue == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Deployment engine unavailable. Docker may not be configured on this server."})
		return nil, nil, false
	}
	return engineValue.(*deployment.DeploymentEngine), dbValue.(*database.DB), true
}

func loadOwnedService(c *gin.Context, db *database.DB) (Service, bool) {
	serviceID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid service ID"})
		return Service{}, false
	}
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return Service{}, false
	}

	var service Service
	var owner string
	err = db.QueryRow(
		`SELECT s.id, s.project_id, s.name,
		        COALESCE(s.type, s.service_type, ''), COALESCE(s.status, ''),
		        COALESCE(s.image, s.image_name, ''), COALESCE(s.command, s.start_command, ''),
		        COALESCE(s.environment, ''), COALESCE(s.git_repo, s.source_url, ''),
		        COALESCE(s.git_branch, ''), COALESCE(s.build_path, ''),
		        COALESCE(s.cpu, ''), COALESCE(s.memory, ''),
		        COALESCE(s.replicas, 1), COALESCE(s.port, 0),
		        COALESCE(s.domain, ''), COALESCE(s.healthcheck_path, ''),
		        COALESCE(s.restart_policy, 'unless-stopped'),
		        s.created_at, s.updated_at, p.owner_id
		 FROM services s JOIN projects p ON s.project_id = p.id
		 WHERE s.id = $1`,
		serviceID,
	).Scan(
		&service.ID, &service.ProjectID, &service.Name, &service.Type, &service.Status,
		&service.Image, &service.Command, &service.Environment, &service.GitRepo,
		&service.GitBranch, &service.BuildPath, &service.CPU, &service.Memory,
		&service.Replicas, &service.Port, &service.Domain, &service.HealthCheckPath,
		&service.RestartPolicy, &service.CreatedAt, &service.UpdatedAt, &owner,
	)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Service not found"})
		return Service{}, false
	}
	if owner != userID.(string) && !isAdminUser(db, userID.(string)) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return Service{}, false
	}
	return service, true
}

// handleServiceRuntime returns live container state for a service.
func handleGetServiceRuntime(c *gin.Context) {
	engine, db, ok := getRuntimeEngine(c)
	if !ok {
		return
	}
	service, ok := loadOwnedService(c, db)
	if !ok {
		return
	}
	state, err := engine.RuntimeState(c.Request.Context(), service.ID.String(), service.Replicas)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"runtime": state})
}

func reconcileNow(c *gin.Context, engine *deployment.DeploymentEngine, db *database.DB, service Service) bool {
	spec, err := serviceRuntimeSpec(db, service)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return false
	}
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()
	state, err := engine.ReconcileService(ctx, spec)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return false
	}
	status := "stopped"
	if state != nil {
		status = state.Status
	}
	_, _ = db.Exec(`UPDATE services SET status = $1, updated_at = $2 WHERE id = $3`, status, time.Now(), service.ID)
	c.JSON(http.StatusOK, gin.H{"runtime": state})
	return true
}

// handleServiceStart starts all stopped replicas.
func handleServiceStart(c *gin.Context) {
	engine, db, ok := getRuntimeEngine(c)
	if !ok {
		return
	}
	service, ok := loadOwnedService(c, db)
	if !ok {
		return
	}
	if err := engine.StartService(c.Request.Context(), service.ID.String()); err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}
	_, _ = db.Exec(`UPDATE services SET status = 'running', updated_at = $1 WHERE id = $2`, time.Now(), service.ID)
	c.JSON(http.StatusOK, gin.H{"status": "running"})
}

// handleServiceStop stops all replicas without removing them.
func handleServiceStop(c *gin.Context) {
	engine, db, ok := getRuntimeEngine(c)
	if !ok {
		return
	}
	service, ok := loadOwnedService(c, db)
	if !ok {
		return
	}
	if err := engine.StopService(c.Request.Context(), service.ID.String()); err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}
	_, _ = db.Exec(`UPDATE services SET status = 'stopped', updated_at = $1 WHERE id = $2`, time.Now(), service.ID)
	c.JSON(http.StatusOK, gin.H{"status": "stopped"})
}

// handleServiceRestart restarts all replicas.
func handleServiceRestart(c *gin.Context) {
	engine, db, ok := getRuntimeEngine(c)
	if !ok {
		return
	}
	service, ok := loadOwnedService(c, db)
	if !ok {
		return
	}
	ctx := c.Request.Context()
	if err := engine.StopService(ctx, service.ID.String()); err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}
	if err := engine.StartService(ctx, service.ID.String()); err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}
	_, _ = db.Exec(`UPDATE services SET status = 'running', updated_at = $1 WHERE id = $2`, time.Now(), service.ID)
	c.JSON(http.StatusOK, gin.H{"status": "running"})
}

// handleServiceRedeploy re-applies the current spec: pulls the image for
// image-sourced services and reconciles containers (env, ports, replicas).
func handleServiceRedeploy(c *gin.Context) {
	engine, db, ok := getRuntimeEngine(c)
	if !ok {
		return
	}
	service, ok := loadOwnedService(c, db)
	if !ok {
		return
	}

	image := service.Image
	if image == "" {
		// Git-sourced service: reuse the last successful deployment image.
		err := db.QueryRow(
			`SELECT image_name || ':' || image_tag FROM deployments
			 WHERE service_id = $1 AND status = 'deployed' AND image_name <> ''
			 ORDER BY created_at DESC LIMIT 1`,
			service.ID,
		).Scan(&image)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "No deployable image yet — run a deployment first"})
			return
		}
	}
	service.Image = image
	reconcileNow(c, engine, db, service)
}

// liveServiceStatus reconciles the stored status with real container state.
// No-op when Docker is unavailable — the stored status is returned as-is.
func liveServiceStatus(c *gin.Context, db *database.DB, service *Service) {
	engineValue, exists := c.Get("deployment_engine")
	if !exists || engineValue == nil {
		return
	}
	engine := engineValue.(*deployment.DeploymentEngine)
	ctx, cancel := context.WithTimeout(c.Request.Context(), 3*time.Second)
	defer cancel()
	state, err := engine.RuntimeState(ctx, service.ID.String(), service.Replicas)
	if err != nil || state == nil || len(state.Containers) == 0 {
		return
	}
	if state.Status != service.Status {
		service.Status = state.Status
		_, _ = db.Exec(`UPDATE services SET status = $1, updated_at = $2 WHERE id = $3`, state.Status, time.Now(), service.ID)
	}
	if len(state.URLs) > 0 && service.Domain == "" {
		service.PublicURL = state.URLs[0]
	}
}

// runtimeScaleService adjusts replica count both in bookkeeping and reality.
func runtimeScaleService(c *gin.Context, serviceID string, replicas int) error {
	dbValue, _ := c.Get("db")
	engineValue, _ := c.Get("deployment_engine")
	db, _ := dbValue.(*database.DB)
	engine, _ := engineValue.(*deployment.DeploymentEngine)
	if db == nil || engine == nil {
		return fmt.Errorf("runtime unavailable")
	}

	var service Service
	var owner string
	err := db.QueryRow(
		`SELECT s.id, s.project_id, s.name,
		        COALESCE(s.type, s.service_type, ''), COALESCE(s.status, ''),
		        COALESCE(s.image, s.image_name, ''), COALESCE(s.command, s.start_command, ''),
		        COALESCE(s.environment, ''), COALESCE(s.git_repo, s.source_url, ''),
		        COALESCE(s.git_branch, ''), COALESCE(s.build_path, ''),
		        COALESCE(s.cpu, ''), COALESCE(s.memory, ''),
		        COALESCE(s.replicas, 1), COALESCE(s.port, 0),
		        COALESCE(s.domain, ''), COALESCE(s.healthcheck_path, ''),
		        COALESCE(s.restart_policy, 'unless-stopped'),
		        s.created_at, s.updated_at, p.owner_id
		 FROM services s JOIN projects p ON s.project_id = p.id
		 WHERE s.id = $1`, serviceID,
	).Scan(
		&service.ID, &service.ProjectID, &service.Name, &service.Type, &service.Status,
		&service.Image, &service.Command, &service.Environment, &service.GitRepo,
		&service.GitBranch, &service.BuildPath, &service.CPU, &service.Memory,
		&service.Replicas, &service.Port, &service.Domain, &service.HealthCheckPath,
		&service.RestartPolicy, &service.CreatedAt, &service.UpdatedAt, &owner,
	)
	if err != nil {
		return err
	}
	if service.Image == "" {
		if err := db.QueryRow(
			`SELECT image_name || ':' || image_tag FROM deployments
			 WHERE service_id = $1 AND status = 'deployed' AND image_name <> ''
			 ORDER BY created_at DESC LIMIT 1`, service.ID,
		).Scan(&service.Image); err != nil {
			return fmt.Errorf("no deployed image to scale")
		}
	}

	spec, err := serviceRuntimeSpec(db, service)
	if err != nil {
		return err
	}
	spec.Replicas = replicas

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()
	if _, err := engine.ReconcileService(ctx, spec); err != nil {
		return err
	}
	_, _ = db.Exec(`UPDATE services SET replicas = $1, updated_at = $2 WHERE id = $3`, replicas, time.Now(), service.ID)
	return nil
}
