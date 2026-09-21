package deployment

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"sort"
	"strings"
	"time"

	"containr/internal/docker"

	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/filters"
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
	ProjectID     string
	ServiceID     string
	Name          string // DNS alias on the project network
	Image         string
	Command       []string
	Env           map[string]string // already resolved
	Replicas      int
	Port          int32  // container port to expose publicly; 0 = none
	Domain        string // public hostname routed via Traefik; empty = none
	HealthPath    string // http path probed on Port for container healthcheck
	RestartPolicy string
	MemoryBytes   int64
	NanoCPUs      int64
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
	Status     string             `json:"status"` // running, degraded, stopped
}

func projectNetworkName(projectID string) string {
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
	name := projectNetworkName(projectID)

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
// otherwise only the replica delta is applied.
func (de *DeploymentEngine) ReconcileService(ctx context.Context, spec RuntimeSpec) (*RuntimeState, error) {
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
		endpoints[edgeNet] = &network.EndpointSettings{}
		labels["traefik.enable"] = "true"
		labels["traefik.docker.network"] = edgeNet
		labels["traefik.http.routers.svc-"+spec.ServiceID[:8]+".rule"] = "Host(`" + spec.Domain + "`)"
		labels["traefik.http.routers.svc-"+spec.ServiceID[:8]+".entrypoints"] = "web"
		labels["traefik.http.services.svc-"+spec.ServiceID[:8]+".loadbalancer.server.port"] = fmt.Sprintf("%d", spec.Port)
	}

	cfg := docker.ContainerConfig{
		Name:          fmt.Sprintf("%s%d", serviceNamePrefix(spec.ServiceID), index),
		Image:         spec.Image,
		Cmd:           spec.Command,
		Env:           env,
		Labels:        labels,
		RestartPolicy: spec.RestartPolicy,
		Memory:        spec.MemoryBytes,
		NanoCPUs:      spec.NanoCPUs,
		Networks:      endpoints,
	}

	if spec.Port > 0 {
		port := nat.Port(fmt.Sprintf("%d/tcp", spec.Port))
		cfg.ExposedPorts = nat.PortSet{port: struct{}{}}
		if spec.Domain == "" {
			// No edge router: publish an ephemeral host port for direct access.
			cfg.PortBindings = nat.PortMap{port: []nat.PortBinding{{HostIP: "0.0.0.0", HostPort: ""}}}
		}
		if spec.HealthPath != "" {
			cfg.Healthcheck = &container.HealthConfig{
				Test:        []string{"CMD-SHELL", fmt.Sprintf("wget -q -O /dev/null http://127.0.0.1:%d%s || exit 1", spec.Port, spec.HealthPath)},
				Interval:    30 * time.Second,
				Timeout:     5 * time.Second,
				Retries:     3,
				StartPeriod: 10 * time.Second,
			}
		}
	}

	id, err := de.dockerClient.CreateContainer(ctx, cfg)
	if err != nil {
		return "", err
	}
	if err := de.dockerClient.StartContainer(ctx, id); err != nil {
		return "", fmt.Errorf("start: %w", err)
	}
	return id, nil
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
	return de.dockerClient.RemoveNetwork(ctx, projectNetworkName(projectID))
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
	}{spec.Image, spec.Name, spec.Domain, spec.HealthPath, spec.RestartPolicy,
		spec.Command, spec.Env, spec.Port, spec.MemoryBytes, spec.NanoCPUs})
	sum := sha256.Sum256(payload)
	return hex.EncodeToString(sum[:8])
}
