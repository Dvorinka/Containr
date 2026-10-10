package api

import (
	"context"
	"database/sql"
	"fmt"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"

	"containr/internal/database"
	"containr/internal/database/sqlcdb"
	"containr/internal/deployment"
	"containr/internal/deployqueue"
	"containr/internal/secrets"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// remoteAgentsForService lists every agent holding inventory rows for the
// service — covers pinned placements, spread replicas, and leftovers from a
// since-cleared pin.
func remoteAgentsForService(ctx context.Context, db *database.DB, serviceID uuid.UUID) []string {
	ids, err := sqlcdb.New(db.DB).ListNodeAgentsForService(ctx, serviceID.String())
	if err != nil {
		return nil
	}
	out := make([]string, 0, len(ids))
	for _, id := range ids {
		if id != "" {
			out = append(out, id)
		}
	}
	return out
}

// serviceLifecycle routes a start/stop/restart action to every agent holding
// the service's replicas, then to the local Docker engine. Both run — a
// service can't be pinned and local at once, but stale containers from a
// cleared pin shouldn't survive a stop.
func serviceLifecycle(ctx context.Context, db *database.DB, engine *deployment.DeploymentEngine, serviceID uuid.UUID, action string) error {
	for _, agentID := range remoteAgentsForService(ctx, db, serviceID) {
		if err := engine.ControlServiceOnNode(ctx, serviceID.String(), agentID, action); err != nil {
			return err
		}
	}
	switch action {
	case "start":
		return engine.StartService(ctx, serviceID.String())
	case "stop":
		return engine.StopService(ctx, serviceID.String())
	case "restart":
		if err := engine.StopService(ctx, serviceID.String()); err != nil {
			return err
		}
		return engine.StartService(ctx, serviceID.String())
	}
	return fmt.Errorf("unsupported lifecycle action %q", action)
}

// removeServiceRuntime tears down replicas wherever they run — remote nodes
// (pinned or spread) and the local Docker host.
func removeServiceRuntime(ctx context.Context, db *database.DB, engine *deployment.DeploymentEngine, serviceID uuid.UUID) {
	for _, agentID := range remoteAgentsForService(ctx, db, serviceID) {
		_ = engine.RemoveServiceContainersOnNode(ctx, serviceID.String(), agentID)
	}
	_ = engine.RemoveServiceContainers(ctx, serviceID.String())
}

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
		NodeID:        serviceNodeID(db, service.ID),
		Spread:        serviceSpread(db, service.ID),
		PlacementTags: servicePlacementTags(db, service.ID),
	}
	// Best effort: reuse the host port from the last live deployment so the
	// public URL survives restarts. Column exists post-migration; older DBs
	// silently get ephemeral ports.
	if p, err := sqlcdb.New(db.DB).GetServicePublishedPort(context.Background(), service.ID); err == nil {
		spec.PublishedPort = p
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
	spec.MemoryReserve = parseMemoryLimit(service.MemoryReserve)
	spec.CPUShares = parseCPUReserveShares(service.CPUReserve)
	if service.Builder == "static" && spec.Port == 0 {
		// The static builder's image is nginx; expose its default port so
		// Traefik has something to route to without extra config.
		spec.Port = 80
	}
	spec.Volumes = loadServiceVolumes(db, service.ID)
	spec.Domains = serviceDomainNames(db, service.ID, service.Domain)
	spec.Maintenance, spec.BasicAuthUsers = serviceAccess(db, service.ID)
	spec.TraefikLabels = serviceTraefikLabels(db, service.ID)
	if spec.Maintenance {
		spec.MaintenanceURL = maintenanceURL(db)
	}
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
	q := sqlcdb.New(db.DB)
	vars, err := q.ListServiceVariableValues(context.Background(), service.ID)
	if err != nil {
		return nil, err
	}

	env := map[string]string{}
	for _, v := range vars {
		env[v.Key] = secrets.Decrypt(v.Value)
	}

	refServices, err := q.ListProjectServiceRefs(context.Background(), service.ProjectID)
	if err != nil {
		return nil, err
	}

	byName := map[string]uuid.UUID{}
	for _, s := range refServices {
		byName[strings.ToLower(s.Name)] = s.ID
	}

	resolve := func(serviceName, key string) (string, bool) {
		if strings.EqualFold(serviceName, "shared") {
			return resolveSharedVar(db, service.ProjectID, key)
		}
		id, ok := byName[strings.ToLower(serviceName)]
		if !ok {
			return "", false
		}
		switch strings.ToUpper(key) {
		case "HOST":
			return serviceName, true
		case "PORT":
			if port, err := q.GetServicePort(context.Background(), id); err == nil && port > 0 {
				return strconv.Itoa(int(port)), true
			}
			return "", false
		}
		value, err := q.GetServiceVariableValue(context.Background(), sqlcdb.GetServiceVariableValueParams{
			ServiceID: id,
			Key:       key,
		})
		if err != nil {
			return "", false
		}
		return secrets.Decrypt(value), true
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

// parseCPUReserveShares maps a cpu fraction to Docker's relative share
// weight: 1024 shares ≈ one CPU.
func parseCPUReserveShares(cpu string) int64 {
	v, err := strconv.ParseFloat(strings.TrimSpace(cpu), 64)
	if err != nil || v <= 0 {
		return 0
	}
	return int64(v * 1024)
}

// validateCPUSpec and validateMemorySpec reject values that silently parse
// to zero — a typo like "512mb" must fail loudly instead of dropping the limit.
func validateCPUSpec(v string) error {
	if s := strings.TrimSpace(v); s != "" && parseCPULimit(s) <= 0 {
		return fmt.Errorf("must be a positive cpu fraction (e.g. 0.5, 2)")
	}
	return nil
}

func validateMemorySpec(v string) error {
	if s := strings.TrimSpace(v); s != "" && parseMemoryLimit(s) <= 0 {
		return fmt.Errorf("must be bytes with unit (e.g. 256Mi, 1g)")
	}
	return nil
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

// setServiceStatusNow writes the stored status with a fresh updated_at.
func setServiceStatusNow(db *database.DB, id uuid.UUID, status string) {
	_ = sqlcdb.New(db.DB).SetServiceStatus(context.Background(), sqlcdb.SetServiceStatusParams{
		Status:    sql.NullString{String: status, Valid: true},
		UpdatedAt: sql.NullTime{Time: time.Now(), Valid: true},
		ID:        id,
	})
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

// serviceFromRuntimeRow maps the sqlc runtime row (with legacy-column
// fallbacks applied in SQL) onto the API Service model.
func serviceFromRuntimeRow(r sqlcdb.GetServiceRuntimeWithOwnerRow) Service {
	return Service{
		ID: r.ID, ProjectID: r.ProjectID, Name: r.Name, Type: r.Type,
		Status: r.Status, Image: r.Image, Command: r.Command,
		Environment: r.Environment, GitRepo: r.GitRepo, GitBranch: r.GitBranch,
		BuildPath: r.BuildPath, CPU: r.Cpu, Memory: r.Memory,
		Replicas: int(r.Replicas), Port: int(r.Port), Domain: r.Domain,
		HealthCheckPath: r.HealthcheckPath, RestartPolicy: r.RestartPolicy,
		Builder: r.Builder, CPUReserve: r.CpuReserve,
		MemoryReserve: r.MemoryReserve, StaticBuildCmd: r.StaticBuildCmd,
		StaticDir: r.StaticDir, CreatedAt: r.CreatedAt.Time, UpdatedAt: r.UpdatedAt.Time,
	}
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

	row, err := sqlcdb.New(db.DB).GetServiceRuntimeWithOwner(context.Background(), serviceID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Service not found"})
		return Service{}, false
	}
	if row.OwnerID.String() != userID.(string) && !isAdminUser(db, userID.(string)) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return Service{}, false
	}
	return serviceFromRuntimeRow(row), true
}

// loadReadableService loads a service when the caller may read its project:
// approved projects are public, unapproved ones need owner/member/admin.
func loadReadableService(c *gin.Context, db *database.DB) (Service, bool) {
	serviceID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid service ID"})
		return Service{}, false
	}

	row, err := sqlcdb.New(db.DB).GetServiceRuntimeWithOwner(context.Background(), serviceID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Service not found"})
		return Service{}, false
	}
	service := serviceFromRuntimeRow(row)
	if _, allowed := projectReadAccess(c, db, service.ProjectID); !allowed {
		c.JSON(http.StatusNotFound, gin.H{"error": "Service not found"})
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
	service, ok := loadReadableService(c, db)
	if !ok {
		return
	}
	state, err := engine.RuntimeState(c.Request.Context(), service.ID.String(), service.Replicas)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	mergeRemoteRuntime(c.Request.Context(), engine, service.ID.String(), state)
	engine.ProbeServiceHealth(c.Request.Context(), state, service.ProjectID.String(), service.Name, service.Port, service.HealthCheckPath)
	persistPublishedPort(db, service.ID, state.Ports)
	if host := requestHostname(c); host != "" {
		for i, u := range state.URLs {
			state.URLs[i] = rewriteLoopbackURL(u, host)
		}
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
		persistPublishedPort(db, service.ID, state.Ports)
	}
	setServiceStatusNow(db, service.ID, status)
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
	if err := serviceLifecycle(c.Request.Context(), db, engine, service.ID, "start"); err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}
	setServiceStatusNow(db, service.ID, "running")
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
	if err := serviceLifecycle(c.Request.Context(), db, engine, service.ID, "stop"); err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}
	setServiceStatusNow(db, service.ID, "stopped")
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
	if err := serviceLifecycle(ctx, db, engine, service.ID, "restart"); err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}
	setServiceStatusNow(db, service.ID, "running")
	c.JSON(http.StatusOK, gin.H{"status": "running"})
}

// handleServiceRedeploy re-applies the current spec: pulls the image for
// image-sourced services and reconciles containers (env, ports, replicas).
// Runs through the per-service deploy queue so it never overlaps a build.
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
		var err error
		image, err = sqlcdb.New(db.DB).GetLastDeployedImage(context.Background(), service.ID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "No deployable image yet — run a deployment first"})
			return
		}
	}
	service.Image = image

	finished := make(chan struct{})
	var recErr error
	var state *deployment.RuntimeState
	getDeployQueue(c).Enqueue(service.ID, deployqueue.Job{Run: func(jctx context.Context) {
		defer close(finished)
		state, recErr = reconcileServiceJob(jctx, db, engine, service)
	}})

	select {
	case <-finished:
		if recErr != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": recErr.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"runtime": state})
	case <-c.Request.Context().Done():
		c.JSON(http.StatusAccepted, gin.H{"status": "queued"})
	}
}

// reconcileServiceJob is the shared queue-job body for redeploy paths:
// build the spec from current DB state, reconcile containers, persist the
// resulting status and published port.
func reconcileServiceJob(ctx context.Context, db *database.DB, engine *deployment.DeploymentEngine, service Service) (*deployment.RuntimeState, error) {
	spec, err := serviceRuntimeSpec(db, service)
	if err != nil {
		return nil, err
	}
	state, err := engine.ReconcileService(ctx, spec)
	if err != nil {
		return nil, err
	}
	if state != nil {
		persistPublishedPort(db, service.ID, state.Ports)
		status := "stopped"
		if state.Status != "" {
			status = state.Status
		}
		setServiceStatusNow(db, service.ID, status)
	}
	return state, nil
}

// enqueueServiceRedeploy resolves a deployable image (service.Image, else
// the last successful deployment's tag) and queues a reconcile. Returns
// false when no image is available or the engine is missing.
func enqueueServiceRedeploy(c *gin.Context, db *database.DB, service Service) bool {
	engineValue, exists := c.Get("deployment_engine")
	if !exists || engineValue == nil {
		return false
	}
	engine, ok := engineValue.(*deployment.DeploymentEngine)
	if !ok {
		return false
	}
	image := service.Image
	if image == "" {
		var err error
		image, err = sqlcdb.New(db.DB).GetLastDeployedImage(context.Background(), service.ID)
		if err != nil {
			return false
		}
	}
	service.Image = image
	getDeployQueue(c).Enqueue(service.ID, deployqueue.Job{Run: func(jctx context.Context) {
		_, _ = reconcileServiceJob(jctx, db, engine, service)
	}})
	return true
}

// mergeRemoteRuntime folds inventory-backed remote replica state into a
// local runtime view so pinned and spread services report their containers.
// Remote rows carry deterministic UUIDs, local ones Docker IDs — no overlap.
func mergeRemoteRuntime(ctx context.Context, engine *deployment.DeploymentEngine, serviceID string, state *deployment.RuntimeState) {
	remote, err := engine.RemoteRuntimeState(ctx, serviceID)
	if err != nil || remote == nil {
		return
	}
	running := 0
	for _, c := range state.Containers {
		if c.State == "running" {
			running++
		}
	}
	for _, rc := range remote.Containers {
		state.Containers = append(state.Containers, rc)
		if rc.State == "running" {
			running++
		}
	}
	switch {
	case len(state.Containers) == 0:
	case running == 0:
		state.Status = "stopped"
	case running < state.Desired:
		state.Status = "degraded"
	default:
		state.Status = "running"
	}
}

// persistPublishedPort records the host port Docker actually bound so later
// redeploys can reuse it. Idempotent — only writes when the value changed.
func persistPublishedPort(db *database.DB, serviceID uuid.UUID, ports []uint16) {
	if len(ports) == 0 {
		return
	}
	_ = sqlcdb.New(db.DB).SetServicePublishedPort(context.Background(), sqlcdb.SetServicePublishedPortParams{
		PublishedPort: int32(ports[0]),
		ID:            serviceID,
	})
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
	if err != nil || state == nil {
		return
	}
	mergeRemoteRuntime(ctx, engine, service.ID.String(), state)
	if len(state.Containers) == 0 {
		return
	}
	if state.Status != service.Status {
		service.Status = state.Status
		setServiceStatusNow(db, service.ID, state.Status)
	}
	persistPublishedPort(db, service.ID, state.Ports)
	if service.Domain != "" {
		service.PublicURL = "https://" + service.Domain
	} else if auto := serviceAutoDomains(db, service.ID); len(auto) > 0 {
		service.PublicURL = "https://" + auto[0]
	} else if len(state.URLs) > 0 {
		service.PublicURL = rewriteLoopbackURL(state.URLs[0], requestHostname(c))
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

	q := sqlcdb.New(db.DB)
	sid, err := uuid.Parse(serviceID)
	if err != nil {
		return err
	}
	row, err := q.GetServiceRuntimeWithOwner(context.Background(), sid)
	if err != nil {
		return err
	}
	service := serviceFromRuntimeRow(row)
	if service.Image == "" {
		image, err := q.GetLastDeployedImage(context.Background(), service.ID)
		if err != nil {
			return fmt.Errorf("no deployed image to scale")
		}
		service.Image = image
	}

	spec, err := serviceRuntimeSpec(db, service)
	if err != nil {
		return err
	}
	spec.Replicas = replicas

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()
	state, err := engine.ReconcileService(ctx, spec)
	if err != nil {
		return err
	}
	if state != nil {
		persistPublishedPort(db, service.ID, state.Ports)
	}
	_ = q.SetServiceReplicas(context.Background(), sqlcdb.SetServiceReplicasParams{
		Replicas:  int32(replicas),
		UpdatedAt: sql.NullTime{Time: time.Now(), Valid: true},
		ID:        service.ID,
	})
	return nil
}

// handleServiceEnvCheck reports environment problems without exposing
// values: empty vars, ${{service.KEY}} refs that fail to resolve, and
// secrets whose ciphertext can't be decrypted (key rotation).
func handleServiceEnvCheck(c *gin.Context) {
	dbVal, exists := c.Get("db")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database connection not available"})
		return
	}
	db := dbVal.(*database.DB)
	service, ok := loadReadableService(c, db)
	if !ok {
		return
	}

	q := sqlcdb.New(db.DB)
	vars, err := q.ListServiceVariablesWithSecret(context.Background(), service.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	var unresolved, empty, unreadable []string
	var raw []struct{ key, val string }
	for _, v := range vars {
		decrypted := secrets.Decrypt(v.Value)
		if v.IsSecret && secrets.IsEncrypted(v.Value) && decrypted == v.Value {
			// Ciphertext failed to decrypt — Decrypt returns the input.
			unreadable = append(unreadable, v.Key)
			continue
		}
		if strings.TrimSpace(decrypted) == "" {
			empty = append(empty, v.Key)
		}
		raw = append(raw, struct{ key, val string }{v.Key, decrypted})
	}

	// Project siblings for ${{name.KEY}} resolution.
	siblingIDs := map[string]uuid.UUID{}
	if refs, err := q.ListProjectServiceRefs(context.Background(), service.ProjectID); err == nil {
		for _, s := range refs {
			siblingIDs[strings.ToLower(s.Name)] = s.ID
		}
	}

	resolvable := func(serviceName, key string) bool {
		id, ok := siblingIDs[strings.ToLower(serviceName)]
		if !ok {
			return false
		}
		if strings.EqualFold(key, "HOST") {
			return true
		}
		if strings.EqualFold(key, "PORT") {
			port, err := q.GetServicePort(context.Background(), id)
			return err == nil && port > 0
		}
		_, err := q.GetServiceVariableValue(context.Background(), sqlcdb.GetServiceVariableValueParams{
			ServiceID: id,
			Key:       key,
		})
		return err == nil
	}

	for _, kv := range raw {
		for _, match := range refVarPattern.FindAllStringSubmatch(kv.val, -1) {
			if len(match) == 3 && !resolvable(match[1], match[2]) {
				unresolved = append(unresolved, fmt.Sprintf("%s → %s", kv.key, match[0]))
			}
		}
	}

	if unresolved == nil {
		unresolved = []string{}
	}
	if empty == nil {
		empty = []string{}
	}
	if unreadable == nil {
		unreadable = []string{}
	}
	okResult := len(unresolved) == 0 && len(empty) == 0 && len(unreadable) == 0
	c.JSON(http.StatusOK, gin.H{
		"ok":         okResult,
		"unresolved": unresolved,
		"empty":      empty,
		"unreadable": unreadable,
	})
}
