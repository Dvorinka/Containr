package api

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"sort"
	"strings"
	"sync"
	"time"

	"containr/internal/database"
	"containr/internal/database/sqlcdb"
	"containr/internal/deployment"
	"containr/internal/docker"

	"github.com/docker/docker/api/types/filters"
	"github.com/docker/docker/api/types/network"
	"github.com/docker/docker/api/types/registry"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// Sleep mode: services with sleep_enabled are scaled to zero after
// sleep_idle_minutes without inbound traffic. Idleness is measured as
// NetworkIO byte deltas across the service's containers — we have no
// per-request layer in front of Traefik, so counters are the signal.
//
// When a service sleeps its containers are removed and a tiny busybox
// "wake" container takes over the same Traefik host rule at a higher
// priority: it serves a reloading "waking" page and pings the unauthenticated
// internal wake endpoint, which reconciles the service back to running.
// Wake containers carry a dedicated label (not the service label) so
// RuntimeState and reconcile never count them as replicas; the sweeper
// prunes them once the workload is running again.

const (
	wakeImage         = "busybox:1.36"
	wakeLabel         = "containr.wake"
	wakeForLabel      = "containr.wake-for"
	wakeSweepInterval = 30 * time.Second
)

type sleepTracker struct {
	mu       sync.Mutex
	activity map[uuid.UUID]sleepActivity
}

type sleepActivity struct {
	bytes     uint64
	idleSince time.Time
}

var tracker = &sleepTracker{activity: make(map[uuid.UUID]sleepActivity)}

// StartSleepSweeper polls enabled services and scales idle ones to zero.
func StartSleepSweeper(ctx context.Context, db *database.DB, dc *docker.Client, engine *deployment.DeploymentEngine, apiPort int) {
	if db == nil || dc == nil || engine == nil {
		return
	}
	go func() {
		ticker := time.NewTicker(wakeSweepInterval)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				sweepSleeping(ctx, db, dc, engine, apiPort)
				pruneWakeContainers(ctx, db, dc, engine)
			}
		}
	}()
	log.Printf("sleep sweeper: running (interval %s)", wakeSweepInterval)
}

type sleepCandidate struct {
	ID          uuid.UUID
	ProjectID   uuid.UUID
	Name        string
	Status      string
	IdleMinutes int
}

func sweepSleeping(ctx context.Context, db *database.DB, dc *docker.Client, engine *deployment.DeploymentEngine, apiPort int) {
	rows, err := db.QueryContext(ctx,
		`SELECT id, project_id, name, COALESCE(status,''), COALESCE(sleep_idle_minutes,15)
		 FROM services WHERE sleep_enabled AND COALESCE(status,'') IN ('running','deployed','degraded','starting')`)
	if err != nil {
		return
	}
	var candidates []sleepCandidate
	for rows.Next() {
		var s sleepCandidate
		if err := rows.Scan(&s.ID, &s.ProjectID, &s.Name, &s.Status, &s.IdleMinutes); err == nil {
			candidates = append(candidates, s)
		}
	}
	rows.Close()

	q := sqlcdb.New(db.DB)
	for _, svc := range candidates {
		// Remote replicas live in inventory, not the local docker host —
		// idleness comes from heartbeat-reported net counters instead.
		if remote := remoteLiveContainers(ctx, q, svc.ID.String()); len(remote) > 0 {
			var total uint64
			for _, row := range remote {
				total += rowNetBytes(row)
			}
			if markIdle(svc.ID, total, time.Duration(svc.IdleMinutes)*time.Minute) {
				putToSleepRemote(ctx, db, q, svc, apiPort)
			}
			continue
		}
		containers, err := engine.ListServiceContainers(ctx, svc.ID.String())
		if err != nil || len(containers) == 0 {
			continue
		}
		// Ignore wake containers — they're the placeholder, not the workload.
		workload := containers[:0]
		for _, c := range containers {
			if c.Labels[wakeLabel] != "true" {
				workload = append(workload, c)
			}
		}
		if len(workload) == 0 {
			continue
		}
		var total uint64
		for _, c := range workload {
			total += containerNetBytes(ctx, dc, c.ID)
		}
		if markIdle(svc.ID, total, time.Duration(svc.IdleMinutes)*time.Minute) {
			putToSleep(ctx, db, dc, engine, svc, apiPort)
		}
	}
}

// remoteLiveContainers returns inventory rows whose replicas are alive on
// node agents — the signal that idleness must be measured remotely.
func remoteLiveContainers(ctx context.Context, q *sqlcdb.Queries, serviceID string) []sqlcdb.ListServiceContainersRow {
	rows, err := q.ListServiceContainers(ctx, serviceID)
	if err != nil {
		return nil
	}
	live := rows[:0]
	for _, row := range rows {
		var st struct {
			State string `json:"state"`
		}
		if err := json.Unmarshal(row.Status.RawMessage, &st); err == nil &&
			st.State != "" && st.State != "removed" && st.State != "sleeping" {
			live = append(live, row)
		}
	}
	return live
}

// rowNetBytes reads the cumulative rx+tx the agent reported at its last
// heartbeat — 0 for rows written before the counter existed.
func rowNetBytes(row sqlcdb.ListServiceContainersRow) uint64 {
	var res struct {
		NetBytes uint64 `json:"net_bytes"`
	}
	_ = json.Unmarshal(row.Resources.RawMessage, &res)
	return res.NetBytes
}

// putToSleepRemote removes the service's remote replicas via their agents,
// marks the service sleeping, and repoints the domain route at the wake
// endpoint so inbound traffic brings it back.
func putToSleepRemote(ctx context.Context, db *database.DB, q *sqlcdb.Queries, svc sleepCandidate, apiPort int) {
	runner := newAgentNodeRunner(db)
	for _, agentID := range remoteAgentsForService(ctx, db, svc.ID) {
		if err := runner.ControlService(ctx, svc.ID.String(), agentID, "remove"); err != nil {
			log.Printf("sleep: remote remove on %s failed: %v", agentID, err)
			continue
		}
		_ = q.DeleteServiceContainersOnAgent(ctx, sqlcdb.DeleteServiceContainersOnAgentParams{
			NodeAgentID: agentID,
			ServiceID:   svc.ID.String(),
		})
	}
	tracker.mu.Lock()
	delete(tracker.activity, svc.ID)
	tracker.mu.Unlock()
	_, _ = db.Exec(`UPDATE services SET status = 'sleeping', updated_at = $1 WHERE id = $2`, time.Now(), svc.ID)
	log.Printf("sleep: %s (%s) remote replicas removed after idle timeout", svc.Name, svc.ID)

	var domain string
	_ = db.QueryRow(`SELECT COALESCE(domain,'') FROM services WHERE id = $1`, svc.ID).Scan(&domain)
	domains := serviceDomainNames(db, svc.ID, domain)
	if len(domains) > 0 {
		writeWakeIngress(svc.ID.String(), domains, apiPort)
	}
}

// markIdle returns true when the network counter stopped growing past the
// timeout. First sighting only sets the baseline — no idle without history.
func markIdle(id uuid.UUID, bytes uint64, timeout time.Duration) bool {
	tracker.mu.Lock()
	defer tracker.mu.Unlock()
	a := tracker.activity[id]
	if bytes != a.bytes || a.idleSince.IsZero() {
		tracker.activity[id] = sleepActivity{bytes: bytes, idleSince: time.Now()}
		return false
	}
	return time.Since(a.idleSince) >= timeout
}

func containerNetBytes(ctx context.Context, dc *docker.Client, id string) uint64 {
	stats, err := dc.GetContainerStats(ctx, id, false)
	if err != nil || stats == nil {
		return 0
	}
	defer stats.Body.Close()
	var snap struct {
		Networks map[string]struct {
			RxBytes uint64 `json:"rx_bytes"`
			TxBytes uint64 `json:"tx_bytes"`
		} `json:"networks"`
	}
	if err := json.NewDecoder(stats.Body).Decode(&snap); err != nil {
		return 0
	}
	var total uint64
	for _, n := range snap.Networks {
		total += n.RxBytes + n.TxBytes
	}
	return total
}

// putToSleep removes the workload containers, marks the service sleeping,
// and installs the wake placeholder when the service has a public domain.
func putToSleep(ctx context.Context, db *database.DB, dc *docker.Client, engine *deployment.DeploymentEngine, svc sleepCandidate, apiPort int) {
	containers, err := engine.ListServiceContainers(ctx, svc.ID.String())
	if err != nil {
		return
	}
	for _, c := range containers {
		if c.Labels[wakeLabel] == "true" {
			continue
		}
		_ = dc.StopContainer(ctx, c.ID, nil)
		_ = dc.RemoveContainer(ctx, c.ID, true)
	}
	tracker.mu.Lock()
	delete(tracker.activity, svc.ID)
	tracker.mu.Unlock()
	_, _ = db.Exec(`UPDATE services SET status = 'sleeping', updated_at = $1 WHERE id = $2`, time.Now(), svc.ID)
	log.Printf("sleep: %s (%s) scaled to zero after idle timeout", svc.Name, svc.ID)

	var domain string
	_ = db.QueryRow(`SELECT COALESCE(domain,'') FROM services WHERE id = $1`, svc.ID).Scan(&domain)
	domains := serviceDomainNames(db, svc.ID, domain)
	if len(domains) == 0 {
		return
	}
	if err := spawnWakeContainer(ctx, db, dc, engine, svc, domains, apiPort); err != nil {
		log.Printf("sleep: wake placeholder for %s failed: %v", svc.Name, err)
	}
}

// spawnWakeContainer runs a busybox httpd holding the service's Traefik
// host rule at higher priority. On boot it calls the wake endpoint, then
// keeps serving a reloading page until the next reconcile removes it.
func spawnWakeContainer(ctx context.Context, db *database.DB, dc *docker.Client, engine *deployment.DeploymentEngine, svc sleepCandidate, domains []string, apiPort int) error {
	edgeNet := ""
	for _, n := range networkList(ctx, dc) {
		if n == "containr-network" {
			edgeNet = n
		}
	}
	if edgeNet == "" {
		return fmt.Errorf("no edge network")
	}
	router := "svc-" + svc.ID.String()[:8]
	sort.Strings(domains)
	rules := make([]string, 0, len(domains))
	for _, d := range domains {
		rules = append(rules, "Host(`"+d+"`)")
	}
	labels := map[string]string{
		deployment.LabelManaged:  "true",
		deployment.LabelProject:  svc.ProjectID.String(),
		wakeForLabel:             svc.ID.String(),
		wakeLabel:                "true",
		"traefik.enable":         "true",
		"traefik.docker.network": edgeNet,
		"traefik.http.routers." + router + ".rule":                      strings.Join(rules, " || "),
		"traefik.http.routers." + router + ".entrypoints":               "web",
		"traefik.http.routers." + router + ".priority":                  "100",
		"traefik.http.services." + router + ".loadbalancer.server.port": "80",
	}

	wakeURL := wakeEndpointURL(ctx, dc, apiPort, svc.ID, edgeNet)
	page := `<!doctype html><html><head><meta http-equiv="refresh" content="4"><title>Waking up</title>` +
		`<style>body{font-family:system-ui,sans-serif;background:#0b0d12;color:#dde2ea;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}` +
		`.card{text-align:center;max-width:34rem;padding:2rem}h1{font-size:1.25rem;font-weight:600}p{color:#98a2b3}</style></head>` +
		`<body><div class="card"><h1>Service is waking up</h1><p>This Containr service was sleeping and is resuming now. The page reloads automatically.</p></div></body></html>`
	// httpd without -f daemonizes, so the sequence is: write page, start
	// httpd, fire the wake callback, then hold PID1 on sleep infinity.
	cmd := fmt.Sprintf(
		`mkdir -p /www && printf '%%s' '%s' > /www/index.html && `+
			`httpd -p 80 -h /www && `+
			`(sleep 2; wget -q -O /dev/null --timeout=20 '%s' 2>/dev/null || true) && `+
			`sleep infinity`,
		strings.ReplaceAll(page, "'", "'\\''"), wakeURL)

	endpoints := map[string]*network.EndpointSettings{edgeNet: {}}
	if ownNet := dc.OwnNetworkName(ctx); ownNet != "" && ownNet != edgeNet {
		endpoints[ownNet] = &network.EndpointSettings{}
	}

	// Pull is best-effort — the image almost always sits in cache.
	_ = dc.PullImageWait(ctx, wakeImage, registry.AuthConfig{})

	// A previous placeholder may linger as Exited — clear the name first.
	name := fmt.Sprintf("containr-wake-%s", svc.ID.String()[:8])
	if stale, err := dc.ListContainersFiltered(ctx, filters.NewArgs(
		filters.Arg("name", "^/"+name+"$"),
	), true); err == nil {
		for _, s := range stale {
			_ = dc.RemoveContainer(ctx, s.ID, true)
		}
	}

	id, err := dc.CreateContainer(ctx, docker.ContainerConfig{
		Name:     name,
		Image:    wakeImage,
		Cmd:      []string{"sh", "-c", cmd},
		Labels:   labels,
		Networks: endpoints,
	})
	if err != nil {
		return err
	}
	return dc.StartContainer(ctx, id)
}

func networkList(ctx context.Context, dc *docker.Client) []string {
	networks, err := dc.ListNetworks(ctx)
	if err != nil {
		return nil
	}
	names := make([]string, 0, len(networks))
	for _, n := range networks {
		names = append(names, n.Name)
	}
	return names
}

// wakeEndpointURL builds the internal URL the wake container calls. The
// edge network's gateway reaches the host's published API port; when the
// API itself is containerized its own name resolves on the shared network.
func wakeEndpointURL(ctx context.Context, dc *docker.Client, apiPort int, serviceID uuid.UUID, edgeNet string) string {
	if dc.OwnNetworkName(ctx) != "" {
		if self, err := dc.GetContainer(ctx, selfID()); err == nil {
			name := strings.TrimPrefix(self.Name, "/")
			if name != "" {
				return fmt.Sprintf("http://%s:%d/api/v1/internal/wake/%s", name, apiPort, serviceID)
			}
		}
	}
	if gw := networkGateway(ctx, dc, edgeNet); gw != "" {
		return fmt.Sprintf("http://%s:%d/api/v1/internal/wake/%s", gw, apiPort, serviceID)
	}
	if probe := dc.HostProbeHost(ctx); probe != "" {
		return fmt.Sprintf("http://%s:%d/api/v1/internal/wake/%s", probe, apiPort, serviceID)
	}
	return fmt.Sprintf("http://127.0.0.1:%d/api/v1/internal/wake/%s", apiPort, serviceID)
}

func networkGateway(ctx context.Context, dc *docker.Client, name string) string {
	// ListNetworks does not populate IPAM config — inspect is required.
	return dc.NetworkGateway(ctx, name)
}

func selfID() string {
	// Inside a container the hostname is the short container ID.
	if hn, err := os.Hostname(); err == nil {
		return hn
	}
	return ""
}

// pruneWakeContainers removes wake placeholders whose service is healthy
// again — belt & braces over the reconcile drift sweep.
func pruneWakeContainers(ctx context.Context, db *database.DB, dc *docker.Client, engine *deployment.DeploymentEngine) {
	containers, err := dc.ListContainersFiltered(ctx, filters.NewArgs(filters.Arg("label", wakeLabel+"=true")), true)
	if err != nil {
		return
	}
	for _, c := range containers {
		svcID := c.Labels[wakeForLabel]
		if svcID == "" {
			continue
		}
		running, _ := engine.ListServiceContainers(ctx, svcID)
		live := 0
		for _, r := range running {
			if r.State == "running" {
				live++
			}
		}
		var status string
		_ = db.QueryRow(`SELECT COALESCE(status,'') FROM services WHERE id = $1`, svcID).Scan(&status)
		if live > 0 || status == "stopped" || status == "" {
			_ = dc.RemoveContainer(ctx, c.ID, true)
		}
	}
}

// handleServiceWake is the unauthenticated internal endpoint the wake
// container hits. It reconciles the service back to running. Waking is
// idempotent and non-destructive, so no token is required; the endpoint
// never mutates configuration.
func handleServiceWake(c *gin.Context) {
	code, body := triggerServiceWake(c)
	if code != 0 {
		c.JSON(code, body)
	}
}

// handleServiceWakePage is the remote ingress wake target — Traefik routes
// a sleeping remote service's domain here via the file provider. Every hit
// (re)triggers the wake reconcile and returns a reloading page.
func handleServiceWakePage(c *gin.Context) {
	triggerServiceWake(c)
	c.Header("Content-Type", "text/html; charset=utf-8")
	c.String(http.StatusOK, wakePageHTML)
}

const wakePageHTML = `<!doctype html><html><head><meta http-equiv="refresh" content="4"><title>Waking up</title>` +
	`<style>body{font-family:system-ui,sans-serif;background:#0b0d12;color:#dde2ea;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}` +
	`.card{text-align:center;max-width:34rem;padding:2rem}h1{font-size:1.25rem;font-weight:600}p{color:#98a2b3}</style></head>` +
	`<body><div class="card"><h1>Service is waking up</h1><p>This Containr service was sleeping and is resuming now. The page reloads automatically.</p></div></body></html>`

// triggerServiceWake loads the service and reconciles it back to running
// in the background. Returns (0, nil) when a response was already written
// by an embedded handler path, else the JSON status to send.
func triggerServiceWake(c *gin.Context) (int, gin.H) {
	dbVal, _ := c.Get("db")
	db := dbVal.(*database.DB)
	engineVal, _ := c.Get("deployment_engine")
	engine, _ := engineVal.(*deployment.DeploymentEngine)
	if engine == nil {
		return http.StatusServiceUnavailable, gin.H{"error": "deployment engine unavailable"}
	}
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return http.StatusBadRequest, gin.H{"error": "invalid service id"}
	}
	var service Service
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
		        COALESCE(s.builder, 'auto'), COALESCE(s.cpu_reserve, ''),
		        COALESCE(s.memory_reserve, ''), COALESCE(s.static_build_cmd, ''),
		        COALESCE(s.static_dir, ''),
		        s.created_at, s.updated_at
		 FROM services s WHERE s.id = $1`, id,
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
		return http.StatusNotFound, gin.H{"error": "service not found"}
	}
	if service.Status == "running" || service.Status == "deployed" {
		return http.StatusOK, gin.H{"status": service.Status}
	}
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 3*time.Minute)
		defer cancel()
		spec, err := serviceRuntimeSpec(db, service)
		if err != nil {
			return
		}
		state, err := engine.ReconcileService(ctx, spec)
		if err != nil {
			_, _ = db.Exec(`UPDATE services SET status = 'failed', updated_at = $1 WHERE id = $2`, time.Now(), service.ID)
			return
		}
		status := "running"
		if state != nil {
			status = state.Status
			persistPublishedPort(db, service.ID, state.Ports)
		}
		_, _ = db.Exec(`UPDATE services SET status = $1, updated_at = $2 WHERE id = $3`, status, time.Now(), service.ID)
	}()
	return http.StatusAccepted, gin.H{"status": "waking"}
}

// handleServiceSleep puts a service to sleep immediately (owner+ only).
func handleServiceSleep(c *gin.Context) {
	dbVal, _ := c.Get("db")
	db := dbVal.(*database.DB)
	engineVal, _ := c.Get("deployment_engine")
	engine, _ := engineVal.(*deployment.DeploymentEngine)
	dcVal, _ := c.Get("docker_client")
	dc, _ := dcVal.(*docker.Client)
	if engine == nil || dc == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "deployment engine unavailable"})
		return
	}
	service, ok := loadOwnedService(c, db)
	if !ok {
		return
	}
	var port int
	_ = db.QueryRow(`SELECT COALESCE(port,0) FROM services WHERE id = $1`, service.ID).Scan(&port)
	svc := sleepCandidate{
		ID:        service.ID,
		ProjectID: service.ProjectID,
		Name:      service.Name,
		Status:    service.Status,
	}
	q := sqlcdb.New(db.DB)
	if len(remoteLiveContainers(c.Request.Context(), q, service.ID.String())) > 0 {
		go putToSleepRemote(context.Background(), db, q, svc, apiPortFromContext(c))
	} else {
		go putToSleep(context.Background(), db, dc, engine, svc, apiPortFromContext(c))
	}
	c.JSON(http.StatusAccepted, gin.H{"status": "sleeping"})
}

// handleServiceWakeNow wakes a sleeping service on demand (owner+ only).
func handleServiceWakeNow(c *gin.Context) {
	if _, ok := loadOwnedService(c, c.MustGet("db").(*database.DB)); !ok {
		return
	}
	handleServiceWake(c)
}

// apiPortFromContext pulls the configured HTTP port for the wake callback URL.
func apiPortFromContext(c *gin.Context) int {
	if v, exists := c.Get("api_port"); exists {
		if p, ok := v.(int); ok {
			return p
		}
	}
	return 8080
}
