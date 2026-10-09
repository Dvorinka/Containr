package deployment

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"

	"containr/internal/docker"

	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/filters"
	"github.com/docker/docker/api/types/mount"
	"github.com/docker/docker/api/types/network"
	"github.com/docker/go-connections/nat"
)

// Container labels used to associate runtime containers with services.
const (
	LabelManaged    = "containr.managed"
	LabelProject    = "containr.project"
	LabelService    = "containr.service"
	LabelReplica    = "containr.replica"
	LabelSpecHash   = "containr.spec-hash"
	LabelDeployment = "containr.deployment"
)

// RuntimeSpec is everything needed to run a service's containers.
type RuntimeSpec struct {
	ProjectID      string
	ServiceID      string
	Name           string // DNS alias on the project network
	Image          string
	Command        []string
	Env            map[string]string // already resolved
	Replicas       int
	Port           int32  // container port to expose publicly; 0 = none
	PublishedPort  int32  // preferred host port for replica 0; 0 = pick ephemeral
	Domain         string // public hostname routed via Traefik; empty = none
	HealthPath     string // http path probed on Port for container healthcheck
	RestartPolicy  string
	MemoryBytes    int64
	MemoryReserve  int64 // soft reservation; scheduler hint, not a hard cap
	NanoCPUs       int64
	CPUShares      int64         // relative weight (1024 ≈ 1 cpu), not a cap
	Volumes        []VolumeMount // applied to every replica
	Domains        []string      // all public hostnames; Domain is the default
	Maintenance    bool          // redirect traffic to MaintenanceURL
	MaintenanceURL string        // absolute URL; empty = serve empty response
	BasicAuthUsers string        // htpasswd-format user:hash pairs, comma-separated
	// NodeID pins the service to a node agent; "" runs on the local host.
	NodeID string
	// Spread distributes replicas across all online, schedulable agents
	// instead of a single node. Mutually exclusive with NodeID.
	Spread bool
	// PlacementTags restricts auto/spread candidates to agents carrying
	// every listed tag. An explicit NodeID pin bypasses tag filtering.
	PlacementTags []string
}

// RuntimeContainer describes one live replica.
type RuntimeContainer struct {
	ID      string `json:"id"`
	Name    string `json:"name"`
	State   string `json:"state"` // running, exited, ...
	Replica int    `json:"replica"`
}

// RuntimeState is the live view of a service's containers.
type RuntimeState struct {
	Desired    int                `json:"desired"`
	Containers []RuntimeContainer `json:"containers"`
	URLs       []string           `json:"urls"`
	Ports      []uint16           `json:"ports"`
	Health     string             `json:"health,omitempty"` // healthy, unhealthy, unreachable
	Status     string             `json:"status"`           // running, degraded, stopped
}

// ProjectNetworkName is the deterministic docker network every service in a
// project joins — containr-proj-<first 12 hex chars of the project uuid>.
func ProjectNetworkName(projectID string) string {
	short := strings.ReplaceAll(projectID, "-", "")
	if len(short) > 12 {
		short = short[:12]
	}
	return "containr-proj-" + short
}

func serviceNamePrefix(serviceID string) string {
	return fmt.Sprintf("containr-%s-", serviceID)
}

// EnsureProjectNetwork creates the per-project bridge network if missing.
// Containers on it resolve each other by service name (private networking).
func (de *DeploymentEngine) EnsureProjectNetwork(ctx context.Context, projectID string) (string, error) {
	name := ProjectNetworkName(projectID)

	networks, err := de.dockerClient.ListNetworks(ctx)
	if err != nil {
		return "", err
	}
	for _, n := range networks {
		if n.Name == name {
			return name, nil
		}
	}

	_, err = de.dockerClient.CreateNetwork(ctx, docker.NetworkConfig{
		Name:   name,
		Driver: "bridge",
		Labels: map[string]string{
			LabelManaged: "true",
			LabelProject: projectID,
		},
	})
	if err != nil {
		// Concurrent reconciles race on create; re-resolve before failing.
		networks, lerr := de.dockerClient.ListNetworks(ctx)
		if lerr == nil {
			for _, n := range networks {
				if n.Name == name {
					return name, nil
				}
			}
		}
		return "", fmt.Errorf("create project network: %w", err)
	}
	return name, nil
}

// traefikNetworkName finds the shared edge network (the infra stack's
// containr-network where Traefik listens) if it exists.
func (de *DeploymentEngine) traefikNetworkName(ctx context.Context) string {
	networks, err := de.dockerClient.ListNetworks(ctx)
	if err != nil {
		return ""
	}
	for _, n := range networks {
		if n.Name == "containr-network" {
			return n.Name
		}
	}
	return ""
}

// ListServiceContainers returns containers managed for a service.
func (de *DeploymentEngine) ListServiceContainers(ctx context.Context, serviceID string) ([]container.Summary, error) {
	return de.dockerClient.ListContainersFiltered(ctx, filters.NewArgs(
		filters.Arg("label", LabelService+"="+serviceID),
	), true)
}

// ReconcileService brings live containers in line with the spec. When the
// spec hash changed (image/env/ports/etc.) all replicas are recreated;
// otherwise only the replica delta is applied. A pinned NodeID routes the
// whole reconcile to that agent's command queue instead of local Docker.
func (de *DeploymentEngine) ReconcileService(ctx context.Context, spec RuntimeSpec) (*RuntimeState, error) {
	if spec.Spread && spec.NodeID == "" {
		if de.nodeRunner == nil {
			return nil, fmt.Errorf("service has spread placement but remote dispatch is unavailable")
		}
		return de.nodeRunner.ReconcileSpread(ctx, spec)
	}
	if spec.NodeID != "" {
		if de.nodeRunner == nil {
			return nil, fmt.Errorf("service is pinned to node %s but remote dispatch is unavailable", spec.NodeID)
		}
		return de.nodeRunner.ReconcileOnNode(ctx, spec)
	}
	// Placement tags without a pin/spread resolve to the least-loaded
	// matching agent on every reconcile — soft affinity, re-evaluated.
	if len(spec.PlacementTags) > 0 {
		if de.nodeRunner == nil {
			return nil, fmt.Errorf("service has placement tags but remote dispatch is unavailable")
		}
		return de.nodeRunner.ReconcileAuto(ctx, spec)
	}
	if spec.Replicas < 1 {
		spec.Replicas = 1
	}

	networkName, err := de.EnsureProjectNetwork(ctx, spec.ProjectID)
	if err != nil {
		return nil, err
	}

	edgeNetwork := ""
	if spec.Domain != "" {
		edgeNetwork = de.traefikNetworkName(ctx)
	}

	hash := specHash(spec)
	existing, err := de.ListServiceContainers(ctx, spec.ServiceID)
	if err != nil {
		return nil, err
	}
	// Deterministic order: scale-down removes the highest replica indices.
	sort.Slice(existing, func(i, j int) bool {
		return replicaIndex(existing[i]) < replicaIndex(existing[j])
	})

	drifted := false
	for _, c := range existing {
		if c.Labels[LabelSpecHash] != hash {
			drifted = true
			break
		}
	}

	if drifted {
		for _, c := range existing {
			_ = de.dockerClient.RemoveContainer(ctx, c.ID, true)
		}
		existing = nil
	}

	for i := len(existing); i > spec.Replicas; i-- {
		victim := existing[i-1]
		_ = de.dockerClient.StopContainer(ctx, victim.ID, nil)
		_ = de.dockerClient.RemoveContainer(ctx, victim.ID, true)
		existing = existing[:i-1]
	}

	for i := len(existing); i < spec.Replicas; i++ {
		if _, err := de.createReplica(ctx, spec, networkName, edgeNetwork, i, hash); err != nil {
			return nil, fmt.Errorf("create replica %d: %w", i, err)
		}
	}

	for _, c := range existing {
		if c.State != "running" {
			_ = de.dockerClient.StartContainer(ctx, c.ID)
		}
	}

	return de.RuntimeState(ctx, spec.ServiceID, spec.Replicas)
}

func (de *DeploymentEngine) createReplica(ctx context.Context, spec RuntimeSpec, projectNet, edgeNet string, index int, hash string) (string, error) {
	env := make([]string, 0, len(spec.Env))
	for k, v := range spec.Env {
		env = append(env, k+"="+v)
	}
	sort.Strings(env)

	labels := map[string]string{
		LabelManaged:  "true",
		LabelProject:  spec.ProjectID,
		LabelService:  spec.ServiceID,
		LabelReplica:  fmt.Sprintf("%d", index),
		LabelSpecHash: hash,
	}

	endpoints := map[string]*network.EndpointSettings{
		projectNet: {Aliases: []string{spec.Name}},
	}
	if edgeNet != "" {
		router := "svc-" + spec.ServiceID[:8]
		domains := spec.Domains
		if len(domains) == 0 && spec.Domain != "" {
			domains = []string{spec.Domain}
		}
		sort.Strings(domains)
		rules := make([]string, 0, len(domains))
		for _, d := range domains {
			rules = append(rules, "Host(`"+d+"`)")
		}
		endpoints[edgeNet] = &network.EndpointSettings{}
		labels["traefik.enable"] = "true"
		labels["traefik.docker.network"] = edgeNet
		labels["traefik.http.routers."+router+".rule"] = strings.Join(rules, " || ")
		labels["traefik.http.routers."+router+".entrypoints"] = "web"
		labels["traefik.http.services."+router+".loadbalancer.server.port"] = fmt.Sprintf("%d", spec.Port)

		var middlewares []string
		if spec.Maintenance {
			if spec.MaintenanceURL != "" {
				mw := router + "-maint"
				labels["traefik.http.middlewares."+mw+".redirectregex.regex"] = "^https?://[^/]+/.*"
				labels["traefik.http.middlewares."+mw+".redirectregex.replacement"] = spec.MaintenanceURL
				labels["traefik.http.middlewares."+mw+".redirectregex.permanent"] = "false"
				middlewares = append(middlewares, mw)
			} else {
				// No redirect target configured — take the site offline with
				// empty responses instead of leaking traffic to the app.
				labels["traefik.http.routers."+router+".service"] = "noop@internal"
			}
		}
		if spec.BasicAuthUsers != "" {
			mw := router + "-auth"
			labels["traefik.http.middlewares."+mw+".basicauth.users"] = spec.BasicAuthUsers
			middlewares = append(middlewares, mw)
		}
		if len(middlewares) > 0 {
			labels["traefik.http.routers."+router+".middlewares"] = strings.Join(middlewares, ",")
		}
	}

	cfg := docker.ContainerConfig{
		Name:              fmt.Sprintf("%s%d", serviceNamePrefix(spec.ServiceID), index),
		Image:             spec.Image,
		Cmd:               spec.Command,
		Env:               env,
		Labels:            labels,
		RestartPolicy:     spec.RestartPolicy,
		Memory:            spec.MemoryBytes,
		MemoryReservation: spec.MemoryReserve,
		NanoCPUs:          spec.NanoCPUs,
		CPUShares:         spec.CPUShares,
		Networks:          endpoints,
	}

	for _, v := range spec.Volumes {
		mountType := mount.TypeVolume
		if v.Type == "bind" {
			mountType = mount.TypeBind
		}
		cfg.Mounts = append(cfg.Mounts, mount.Mount{
			Type:     mountType,
			Source:   v.Source,
			Target:   v.Destination,
			ReadOnly: v.ReadOnly,
		})
	}

	var wantPort nat.Port
	if spec.Port > 0 {
		wantPort = nat.Port(fmt.Sprintf("%d/tcp", spec.Port))
		cfg.ExposedPorts = nat.PortSet{wantPort: struct{}{}}
	}

	// tryBind creates and starts a container publishing wantPort on hostPort
	// ("" = ephemeral). A requested port is verified after start: Docker
	// Desktop accepts a conflicting binding at create/start but publishes
	// nothing, which would leave the service running with no endpoint.
	tryBind := func(hostPort string) (string, error) {
		if spec.Port > 0 {
			cfg.PortBindings = nat.PortMap{wantPort: []nat.PortBinding{{HostIP: "0.0.0.0", HostPort: hostPort}}}
		}
		id, err := de.dockerClient.CreateContainer(ctx, cfg)
		if err != nil {
			return "", err
		}
		if err := de.dockerClient.StartContainer(ctx, id); err != nil {
			_ = de.dockerClient.RemoveContainer(ctx, id, true)
			return "", fmt.Errorf("start: %w", err)
		}
		if hostPort != "" {
			info, err := de.dockerClient.GetContainer(ctx, id)
			if err != nil {
				_ = de.dockerClient.RemoveContainer(ctx, id, true)
				return "", fmt.Errorf("inspect: %w", err)
			}
			if info.NetworkSettings == nil || len(info.NetworkSettings.Ports[wantPort]) == 0 {
				_ = de.dockerClient.RemoveContainer(ctx, id, true)
				return "", errPortNotBound
			}
		}
		return id, nil
	}

	preferred := ""
	if index == 0 && spec.PublishedPort > 0 {
		preferred = strconv.Itoa(int(spec.PublishedPort))
	}
	id, err := tryBind(preferred)
	if err != nil && preferred != "" && (isPortConflict(err) || errors.Is(err, errPortNotBound)) {
		// Stored port got taken since last deploy — fall back to ephemeral; the
		// new assignment is persisted on the next runtime read.
		id, err = tryBind("")
	}
	if err != nil {
		return "", err
	}
	return id, nil
}

// errPortNotBound marks a container that started but failed to publish the
// requested host port (seen on Docker Desktop, which reports success while
// vpnkit drops a conflicting binding).
var errPortNotBound = errors.New("requested host port not bound")

// isPortConflict reports whether a container create failed because the
// requested host port was already bound.
func isPortConflict(err error) bool {
	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "port is already allocated") ||
		strings.Contains(msg, "address already in use") ||
		strings.Contains(msg, "cannot assign requested address")
}

// RuntimeState reads live container state for a service.
func (de *DeploymentEngine) RuntimeState(ctx context.Context, serviceID string, desired int) (*RuntimeState, error) {
	containers, err := de.ListServiceContainers(ctx, serviceID)
	if err != nil {
		return nil, err
	}

	state := &RuntimeState{Desired: desired, Status: "stopped"}
	running := 0
	for _, c := range containers {
		rc := RuntimeContainer{ID: c.ID, Name: strings.TrimPrefix(c.Names[0], "/"), State: c.State, Replica: replicaIndex(c)}
		state.Containers = append(state.Containers, rc)
		if c.State == "running" {
			running++
		}
		for _, p := range c.Ports {
			if p.PublicPort != 0 {
				state.URLs = append(state.URLs, fmt.Sprintf("http://localhost:%d", p.PublicPort))
				state.Ports = append(state.Ports, p.PublicPort)
			}
		}
	}
	sort.Slice(state.Containers, func(i, j int) bool { return state.Containers[i].Replica < state.Containers[j].Replica })
	sort.Strings(state.URLs)

	switch {
	case running == 0:
		state.Status = "stopped"
	case running < desired:
		state.Status = "degraded"
	default:
		state.Status = "running"
	}
	return state, nil
}

// ProbeServiceHealth performs an HTTP GET on healthPath and records the
// outcome on state.Health. When the backend runs containerized it first
// attaches to the service's project network and probes the service by DNS
// name — this works for every image (no shell or wget required inside the
// container) and checks the service itself, not the published edge. A
// host-run backend falls back to probing the published host port.
func (de *DeploymentEngine) ProbeServiceHealth(ctx context.Context, state *RuntimeState, projectID, serviceName string, port int, healthPath string) {
	if state == nil {
		return
	}
	state.Health = ""
	if healthPath == "" || port <= 0 {
		return
	}
	if !strings.HasPrefix(healthPath, "/") {
		healthPath = "/" + healthPath
	}

	probeURL := ""
	if networkName := ProjectNetworkName(projectID); networkName != "" {
		if err := de.dockerClient.ConnectSelfToNetwork(ctx, networkName); err == nil {
			probeURL = fmt.Sprintf("http://%s:%d%s", serviceName, port, healthPath)
		}
	}
	if probeURL == "" && len(state.Ports) > 0 {
		probeURL = fmt.Sprintf("http://%s:%d%s", de.dockerClient.HostProbeHost(ctx), state.Ports[0], healthPath)
	}
	if probeURL == "" {
		return
	}

	reqCtx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(reqCtx, http.MethodGet, probeURL, nil)
	if err != nil {
		state.Health = "unreachable"
		return
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		state.Health = "unreachable"
		return
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 200 && resp.StatusCode < 400 {
		state.Health = "healthy"
		return
	}
	state.Health = "unhealthy"
}

// StopService stops (but keeps) all replicas of a service.
func (de *DeploymentEngine) StopService(ctx context.Context, serviceID string) error {
	containers, err := de.ListServiceContainers(ctx, serviceID)
	if err != nil {
		return err
	}
	for _, c := range containers {
		if c.State == "running" {
			if err := de.dockerClient.StopContainer(ctx, c.ID, nil); err != nil {
				return err
			}
		}
	}
	return nil
}

// StartService starts all stopped replicas.
func (de *DeploymentEngine) StartService(ctx context.Context, serviceID string) error {
	containers, err := de.ListServiceContainers(ctx, serviceID)
	if err != nil {
		return err
	}
	for _, c := range containers {
		if c.State != "running" {
			if err := de.dockerClient.StartContainer(ctx, c.ID); err != nil {
				return err
			}
		}
	}
	return nil
}

// RemoveServiceContainers deletes every replica of a service.
func (de *DeploymentEngine) RemoveServiceContainers(ctx context.Context, serviceID string) error {
	containers, err := de.ListServiceContainers(ctx, serviceID)
	if err != nil {
		return err
	}
	for _, c := range containers {
		_ = de.dockerClient.RemoveContainer(ctx, c.ID, true)
	}
	return nil
}

// ControlServiceOnNode fans a lifecycle action out to the service's replicas
// on a remote node agent. Callers resolve the pin; nil runner means the
// platform was booted without node support.
func (de *DeploymentEngine) ControlServiceOnNode(ctx context.Context, serviceID, nodeID, action string) error {
	if de.nodeRunner == nil {
		return fmt.Errorf("remote node control is not configured")
	}
	return de.nodeRunner.ControlService(ctx, serviceID, nodeID, action)
}

// RemoveServiceContainersOnNode tears down the service's replicas on a remote
// node agent.
func (de *DeploymentEngine) RemoveServiceContainersOnNode(ctx context.Context, serviceID, nodeID string) error {
	if de.nodeRunner == nil {
		return fmt.Errorf("remote node control is not configured")
	}
	return de.nodeRunner.RemoveService(ctx, serviceID, nodeID)
}

// RemoteRuntimeState exposes inventory-backed remote container state; nil
// runner means no node support was wired at boot.
func (de *DeploymentEngine) RemoteRuntimeState(ctx context.Context, serviceID string) (*RuntimeState, error) {
	if de.nodeRunner == nil {
		return nil, nil
	}
	return de.nodeRunner.RemoteRuntimeState(ctx, serviceID)
}

// RemoveProjectContainers deletes every managed container in a project.
func (de *DeploymentEngine) RemoveProjectContainers(ctx context.Context, projectID string) error {
	containers, err := de.dockerClient.ListContainersFiltered(ctx, filters.NewArgs(
		filters.Arg("label", LabelProject+"="+projectID),
	), true)
	if err != nil {
		return err
	}
	for _, c := range containers {
		_ = de.dockerClient.RemoveContainer(ctx, c.ID, true)
	}
	return nil
}

// RemoveProjectNetwork removes the per-project bridge network if present.
func (de *DeploymentEngine) RemoveProjectNetwork(ctx context.Context, projectID string) error {
	return de.dockerClient.RemoveNetwork(ctx, ProjectNetworkName(projectID))
}

func replicaIndex(c container.Summary) int {
	replica := 0
	fmt.Sscanf(c.Labels[LabelReplica], "%d", &replica)
	return replica
}

func specHash(spec RuntimeSpec) string {
	payload, _ := json.Marshal(struct {
		Image, Name, Domain, HealthPath, RestartPolicy string
		Command                                        []string
		Env                                            map[string]string
		Port                                           int32
		MemoryBytes, NanoCPUs                          int64
		MemoryReserve, CPUShares                       int64
		Volumes                                        []VolumeMount
		Domains                                        []string
		Maintenance                                    bool
		BasicAuth                                      string
	}{spec.Image, spec.Name, spec.Domain, spec.HealthPath, spec.RestartPolicy,
		spec.Command, spec.Env, spec.Port, spec.MemoryBytes, spec.NanoCPUs,
		spec.MemoryReserve, spec.CPUShares, spec.Volumes,
		spec.Domains, spec.Maintenance, spec.BasicAuthUsers})
	sum := sha256.Sum256(payload)
	return hex.EncodeToString(sum[:8])
}
