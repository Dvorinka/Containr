package api

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"

	"containr/internal/database"
	"containr/internal/database/sqlcdb"
	"containr/internal/deployment"
)

// agentNodeRunner implements deployment.NodeRunner by dispatching container
// lifecycle commands to a node agent's command queue and waiting for the
// reported result. Remote nodes have no Traefik — domains stay local-only
// until per-node ingress lands.
type agentNodeRunner struct {
	q  *sqlcdb.Queries
	db *database.DB
}

func newAgentNodeRunner(db *database.DB) *agentNodeRunner {
	return &agentNodeRunner{q: sqlcdb.New(db.DB), db: db}
}

// remoteContainerID is deterministic per (agent, service, replica) so redeploys
// update the same inventory row instead of accumulating stale ones.
func remoteContainerID(agentID, serviceID string, replica int) string {
	sum := sha256.Sum256([]byte(agentID + "|" + serviceID + "|" + fmt.Sprint(replica)))
	return fmt.Sprintf("%x-%x-%x-%x-%x", sum[0:4], sum[4:6], sum[6:8], sum[8:10], sum[10:16])
}

func remoteContainerName(serviceID string, replica int) string {
	return fmt.Sprintf("containr-%s-%d", serviceID, replica)
}

func (r *agentNodeRunner) ReconcileOnNode(ctx context.Context, spec deployment.RuntimeSpec) (*deployment.RuntimeState, error) {
	agent, err := r.q.GetAgent(ctx, spec.NodeID)
	if err != nil {
		return nil, fmt.Errorf("node %s not found", spec.NodeID)
	}
	if !agent.Status.Valid || agent.Status.String != "online" {
		return nil, fmt.Errorf("node %s is %s — heartbeats resume scheduling when it reconnects", agent.Name, agent.Status.String)
	}
	return r.reconcileOnAgents(ctx, spec, func(int) string { return spec.NodeID })
}

// ReconcileSpread distributes replicas deterministically across online,
// schedulable agents: replica i lands on agents[i % len(agents)], agents
// sorted by id. Replicas wrap when they outnumber nodes. The local host is
// not a spread target — pin "local" or leave unset for local execution.
func (r *agentNodeRunner) ReconcileSpread(ctx context.Context, spec deployment.RuntimeSpec) (*deployment.RuntimeState, error) {
	agents, err := r.q.ListSchedulableAgents(ctx)
	if err != nil {
		return nil, fmt.Errorf("list schedulable nodes: %w", err)
	}
	if len(agents) == 0 {
		return nil, fmt.Errorf("no online schedulable nodes — connect an agent or unset spread")
	}
	return r.reconcileOnAgents(ctx, spec, func(i int) string {
		return agents[i%len(agents)].ID
	})
}

// RemoteRuntimeState reads the service's remote replicas from inventory.
// Rows only carry the last dispatched state — the agent doesn't stream
// container events — so "running" means "last create succeeded".
func (r *agentNodeRunner) RemoteRuntimeState(ctx context.Context, serviceID string) (*deployment.RuntimeState, error) {
	rows, err := r.q.ListServiceContainers(ctx, serviceID)
	if err != nil {
		return nil, err
	}
	state := &deployment.RuntimeState{Status: "stopped"}
	running := 0
	for _, row := range rows {
		var status struct {
			State string `json:"state"`
		}
		unmarshalRaw(row.Status, &status)
		if status.State == "" || status.State == "removed" {
			continue
		}
		replica := -1
		if idx, err := strconv.Atoi(strings.TrimPrefix(row.Name, fmt.Sprintf("containr-%s-", serviceID))); err == nil {
			replica = idx
		}
		state.Containers = append(state.Containers, deployment.RuntimeContainer{
			ID: row.ID, Name: row.Name, State: status.State, Replica: replica,
		})
		if status.State == "running" {
			running++
		}
	}
	if running > 0 {
		state.Status = "running"
	}
	return state, nil
}

// reconcileOnAgents creates the service's replicas on the agents chosen by
// targetFor and retires stale replicas on any agent — including leftovers
// from a previous pin or a different spread assignment.
func (r *agentNodeRunner) reconcileOnAgents(ctx context.Context, spec deployment.RuntimeSpec, targetFor func(replica int) string) (*deployment.RuntimeState, error) {
	if len(spec.Domains) > 0 || spec.Domain != "" {
		return nil, fmt.Errorf("domains are routed by the local Traefik — remove the service's domains or run it on the local node")
	}

	replicas := spec.Replicas
	if replicas < 1 {
		replicas = 1
	}

	prefix := fmt.Sprintf("containr-%s-", spec.ServiceID)
	existing, _ := r.q.ListServiceContainers(ctx, spec.ServiceID)
	for _, row := range existing {
		if !strings.HasPrefix(row.Name, prefix) {
			continue
		}
		replica, err := strconv.Atoi(strings.TrimPrefix(row.Name, prefix))
		keep := err == nil && replica < replicas && row.NodeAgentID == targetFor(replica)
		if keep {
			continue
		}
		if cmdErr := r.enqueueAndWait(ctx, row.NodeAgentID, "", "remove_container",
			map[string]interface{}{"container_name": row.Name}); cmdErr != nil {
			return nil, fmt.Errorf("remove stale replica %s on node %s: %w", row.Name, row.NodeAgentID, cmdErr)
		}
		_ = r.q.UpdateContainerStatus(ctx, sqlcdb.UpdateContainerStatusParams{
			ID:     row.ID,
			Status: rawJSON(map[string]interface{}{"state": "removed"}),
		})
	}

	state := &deployment.RuntimeState{Desired: replicas, Status: "running"}
	for i := 0; i < replicas; i++ {
		agentID := targetFor(i)
		name := remoteContainerName(spec.ServiceID, i)
		containerID := remoteContainerID(agentID, spec.ServiceID, i)
		container, env, ports, volumes, restart := r.replicaPayload(spec, agentID, i, name)

		_ = r.q.UpsertServiceContainer(ctx, sqlcdb.UpsertServiceContainerParams{
			ID:            containerID,
			Name:          name,
			Image:         spec.Image,
			ProjectID:     spec.ProjectID,
			ServiceID:     spec.ServiceID,
			NodeAgentID:   agentID,
			Status:        rawJSON(map[string]interface{}{"state": "created", "health": "none"}),
			Resources:     rawJSON(map[string]interface{}{"memory": spec.MemoryBytes, "cpus": float64(spec.NanoCPUs) / 1e9}),
			Ports:         rawJSON(ports),
			Environment:   rawJSON(env),
			Volumes:       rawJSON(volumes),
			Networks:      rawJSON([]string{}),
			RestartPolicy: rawJSON(map[string]interface{}{"name": restart}),
			HealthCheck:   rawJSON(map[string]interface{}{"path": spec.HealthPath}),
		})

		if err := r.enqueueAndWait(ctx, agentID, containerID, "create_container",
			map[string]interface{}{"container": container}); err != nil {
			return nil, fmt.Errorf("replica %d on node %s: %w", i, agentID, err)
		}
		_ = r.q.UpdateContainerStatus(ctx, sqlcdb.UpdateContainerStatusParams{
			ID:     containerID,
			Status: rawJSON(map[string]interface{}{"state": "running", "health": "none"}),
		})
		state.Containers = append(state.Containers, deployment.RuntimeContainer{
			ID: containerID, Name: name, State: "running", Replica: i,
		})
	}
	return state, nil
}

// replicaPayload builds the agent create_container payload for one replica.
func (r *agentNodeRunner) replicaPayload(spec deployment.RuntimeSpec, agentID string, i int, name string) (map[string]interface{}, map[string]interface{}, []interface{}, []interface{}, string) {
	ports := []interface{}{}
	if spec.Port > 0 {
		hostPort := spec.PublishedPort // 0 → ephemeral on the node
		if i > 0 {
			hostPort = 0 // only replica 0 claims the preferred host port
		}
		ports = append(ports, map[string]interface{}{
			"published":      true,
			"host_port":      hostPort,
			"container_port": spec.Port,
			"protocol":       "tcp",
		})
	}
	volumes := make([]interface{}, 0, len(spec.Volumes))
	for _, v := range spec.Volumes {
		volumes = append(volumes, map[string]interface{}{
			"source": v.Source, "target": v.Destination, "read_only": v.ReadOnly,
		})
	}
	env := map[string]interface{}{}
	for k, v := range spec.Env {
		env[k] = v
	}
	restart := spec.RestartPolicy
	if restart == "" {
		restart = "unless-stopped"
	}
	cmd := make([]interface{}, 0, len(spec.Command))
	for _, arg := range spec.Command {
		cmd = append(cmd, arg)
	}
	return map[string]interface{}{
		"name":           name,
		"image":          spec.Image,
		"command":        cmd,
		"environment":    env,
		"registry":       r.pullCredentials(spec.ProjectID, spec.Image),
		"ports":          ports,
		"volumes":        volumes,
		"restart_policy": restart,
		"memory":         spec.MemoryBytes,
		"cpus":           float64(spec.NanoCPUs) / 1e9,
		"labels": map[string]interface{}{
			"containr.managed": "true",
			"containr.project": spec.ProjectID,
			"containr.service": spec.ServiceID,
			"containr.replica": fmt.Sprint(i),
			"containr.node":    agentID,
		},
	}, env, ports, volumes, restart
}

// pullCredentials resolves the project owner's registry auth for the image
// host so private images pull on remote nodes. Empty map → anonymous pull.
func (r *agentNodeRunner) pullCredentials(projectID, imageRef string) map[string]interface{} {
	var ownerID string
	if err := r.db.QueryRow(
		`SELECT owner_id FROM projects WHERE id = $1`, projectID,
	).Scan(&ownerID); err != nil {
		return map[string]interface{}{}
	}
	auth := registryAuthFor(r.db, ownerID, imageRef)
	if auth.Username == "" {
		return map[string]interface{}{}
	}
	return map[string]interface{}{
		"server":   auth.ServerAddress,
		"username": auth.Username,
		"password": auth.Password,
	}
}

// ControlService fans a lifecycle action out to every replica row the
// service has on the agent. Actions map onto the agent's container commands;
// "remove" also tombstones the inventory row.
func (r *agentNodeRunner) ControlService(ctx context.Context, serviceID, agentID, action string) error {
	cmdType := map[string]string{
		"start":   "start_container",
		"stop":    "stop_container",
		"restart": "restart_container",
		"remove":  "remove_container",
	}[action]
	if cmdType == "" {
		return fmt.Errorf("unsupported action %q", action)
	}
	rows, err := r.q.ListContainersForAgent(ctx, agentID)
	if err != nil {
		return err
	}
	removed := map[string]interface{}{"state": "removed"}
	for _, row := range rows {
		if row.ServiceID != serviceID {
			continue
		}
		if err := r.enqueueAndWait(ctx, agentID, row.ID, cmdType,
			map[string]interface{}{"container_name": row.Name}); err != nil {
			return fmt.Errorf("%s %s on node: %w", action, row.Name, err)
		}
		if action == "remove" {
			_ = r.q.UpdateContainerStatus(ctx, sqlcdb.UpdateContainerStatusParams{
				ID: row.ID, Status: rawJSON(removed)})
		}
	}
	return nil
}

// RemoveService tears down every replica of the service on the agent and
// clears the inventory rows.
func (r *agentNodeRunner) RemoveService(ctx context.Context, serviceID, agentID string) error {
	if err := r.ControlService(ctx, serviceID, agentID, "remove"); err != nil {
		return err
	}
	return r.q.DeleteServiceContainersOnAgent(ctx, sqlcdb.DeleteServiceContainersOnAgentParams{
		NodeAgentID: agentID,
		ServiceID:   serviceID,
	})
}

// enqueueAndWait pushes a command to the agent's queue and polls for the
// reported result. Agents poll on their own interval (≥5s), so this blocks —
// it runs inside the deploy queue worker, never on a request path.
func (r *agentNodeRunner) enqueueAndWait(ctx context.Context, agentID, containerID, cmdType string, payload map[string]interface{}) error {
	var cid sql.NullString
	if containerID != "" {
		cid = sql.NullString{String: containerID, Valid: true}
	}
	cmd, err := r.q.CreateCommand(ctx, sqlcdb.CreateCommandParams{
		ID:          uuid.New().String(),
		Type:        cmdType,
		NodeAgentID: agentID,
		ContainerID: cid,
		Payload:     rawJSON(payload),
	})
	if err != nil {
		return err
	}

	deadline := time.Now().Add(8 * time.Minute) // image pulls on a cold node
	for {
		row, err := r.q.GetCommandForAgent(ctx, sqlcdb.GetCommandForAgentParams{
			ID:          cmd.ID,
			NodeAgentID: agentID,
		})
		if err == nil {
			switch row.Status.String {
			case "completed":
				return nil
			case "failed":
				if row.Error.Valid && row.Error.String != "" {
					return fmt.Errorf("agent: %s", row.Error.String)
				}
				return fmt.Errorf("agent reported failure")
			}
		}
		if time.Now().After(deadline) {
			return fmt.Errorf("command %s timed out waiting for the agent", cmdType)
		}
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(2 * time.Second):
		}
	}
}

// resolveNodePin validates or resolves a node_id request value. "auto" picks
// the least-loaded online agent; "" / "local" clears the pin.
func resolveNodePin(ctx context.Context, db *database.DB, requested string) (string, error) {
	requested = strings.TrimSpace(requested)
	if requested == "" || requested == "local" {
		return "", nil
	}
	q := sqlcdb.New(db.DB)
	if requested == "auto" {
		id, err := q.PickLeastLoadedAgent(ctx)
		if err != nil {
			return "", fmt.Errorf("no online nodes available")
		}
		return id, nil
	}
	agent, err := q.GetAgent(ctx, requested)
	if err != nil {
		return "", fmt.Errorf("node not found")
	}
	if !agent.Schedulable {
		return "", fmt.Errorf("node %s is cordoned — uncordon it before pinning", agent.Name)
	}
	return requested, nil
}
