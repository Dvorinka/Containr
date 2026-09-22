package api

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"net/http"
	"os"
	"strings"
	"time"

	"containr/internal/database"
	"containr/internal/database/sqlcdb"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/sqlc-dev/pqtype"
)

// NodeAgent represents a container orchestration agent
type NodeAgent struct {
	ID            string                 `json:"id"`
	Name          string                 `json:"name"`
	Hostname      string                 `json:"hostname"`
	IPAddress     string                 `json:"ip_address"`
	Port          int                    `json:"port"`
	Status        string                 `json:"status"`
	Version       string                 `json:"version"`
	Capabilities  AgentCapabilities      `json:"capabilities"`
	Resources     NodeResources          `json:"resources"`
	LastHeartbeat time.Time              `json:"last_heartbeat"`
	CreatedAt     time.Time              `json:"created_at"`
	UpdatedAt     time.Time              `json:"updated_at"`
	Metadata      map[string]interface{} `json:"metadata"`
}

// AgentCapabilities defines what the agent can do
type AgentCapabilities struct {
	ContainerRuntimes      []string `json:"container_runtimes"`
	SupportedArchitectures []string `json:"supported_architectures"`
	MaxContainers          int      `json:"max_containers"`
	StorageDriver          string   `json:"storage_driver"`
	NetworkPlugins         []string `json:"network_plugins"`
	Features               []string `json:"features"`
}

// NodeResources represents the agent's available resources
type NodeResources struct {
	CPU     CPUResources     `json:"cpu"`
	Memory  MemoryResources  `json:"memory"`
	Storage StorageResources `json:"storage"`
	Network NetworkResources `json:"network"`
}

type CPUResources struct {
	Cores      int     `json:"cores"`
	Allocation float64 `json:"allocation"` // percentage
	Usage      float64 `json:"usage"`      // current usage percentage
}

type MemoryResources struct {
	Total     int `json:"total"`
	Allocated int `json:"allocated"`
	Used      int `json:"used"`
	Available int `json:"available"`
}

type StorageResources struct {
	Total     int `json:"total"`
	Allocated int `json:"allocated"`
	Used      int `json:"used"`
	Available int `json:"available"`
}

type NetworkResources struct {
	Interfaces []NetworkInterface `json:"interfaces"`
	Bandwidth  BandwidthInfo      `json:"bandwidth"`
}

type NetworkInterface struct {
	Name       string `json:"name"`
	IPAddress  string `json:"ip_address"`
	MACAddress string `json:"mac_address"`
	Speed      int    `json:"speed"`
	Status     string `json:"status"`
}

type BandwidthInfo struct {
	Inbound  int `json:"inbound"`  // bytes per second
	Outbound int `json:"outbound"` // bytes per second
}

// ContainerInstance represents a container running on an agent
type ContainerInstance struct {
	ID            string             `json:"id"`
	Name          string             `json:"name"`
	Image         string             `json:"image"`
	ProjectID     string             `json:"project_id"`
	ServiceID     string             `json:"service_id"`
	NodeAgentID   string             `json:"node_agent_id"`
	Status        ContainerStatus    `json:"status"`
	Resources     ContainerResources `json:"resources"`
	Ports         []PortMapping      `json:"ports"`
	Environment   map[string]string  `json:"environment"`
	Volumes       []VolumeMount      `json:"volumes"`
	Networks      []string           `json:"networks"`
	RestartPolicy RestartPolicy      `json:"restart_policy"`
	HealthCheck   *HealthCheck       `json:"health_check"`
	CreatedAt     time.Time          `json:"created_at"`
	StartedAt     *time.Time         `json:"started_at"`
	UpdatedAt     time.Time          `json:"updated_at"`
}

type ContainerStatus struct {
	State      string     `json:"state"`
	Health     string     `json:"health"`
	ExitCode   *int       `json:"exit_code"`
	Error      *string    `json:"error"`
	StartedAt  *time.Time `json:"started_at"`
	FinishedAt *time.Time `json:"finished_at"`
}

type ContainerResources struct {
	CPULimit          int  `json:"cpu_limit"`
	CPUReservation    int  `json:"cpu_reservation"`
	MemoryLimit       int  `json:"memory_limit"`
	MemoryReservation int  `json:"memory_reservation"`
	DiskLimit         *int `json:"disk_limit"`
}

type PortMapping struct {
	ContainerPort int    `json:"container_port"`
	HostPort      *int   `json:"host_port"`
	Protocol      string `json:"protocol"`
	Published     bool   `json:"published"`
}

type VolumeMount struct {
	Name     string `json:"name"`
	Source   string `json:"source"`
	Target   string `json:"target"`
	Type     string `json:"type"`
	ReadOnly bool   `json:"read_only"`
}

type RestartPolicy struct {
	Name              string `json:"name"`
	MaximumRetryCount *int   `json:"maximum_retry_count"`
}

type HealthCheck struct {
	Test        []string `json:"test"`
	Interval    int      `json:"interval"`
	Timeout     int      `json:"timeout"`
	Retries     int      `json:"retries"`
	StartPeriod int      `json:"start_period"`
}

// AgentCommand represents a command sent to an agent
type AgentCommand struct {
	ID          string                 `json:"id"`
	Type        string                 `json:"type"`
	NodeAgentID string                 `json:"node_agent_id"`
	ContainerID *string                `json:"container_id"`
	Payload     map[string]interface{} `json:"payload"`
	Status      string                 `json:"status"`
	Result      *string                `json:"result"`
	Error       *string                `json:"error"`
	CreatedAt   time.Time              `json:"created_at"`
	UpdatedAt   time.Time              `json:"updated_at"`
	CompletedAt *time.Time             `json:"completed_at"`
}

// AgentHeartbeat represents a heartbeat message from an agent
type AgentHeartbeat struct {
	NodeAgentID    string        `json:"node_agent_id"`
	AuthToken      string        `json:"auth_token,omitempty"`
	Timestamp      time.Time     `json:"timestamp"`
	Status         string        `json:"status"`
	Resources      NodeResources `json:"resources"`
	ContainerCount int           `json:"container_count"`
	SystemLoad     SystemLoad    `json:"system_load"`
	Uptime         int64         `json:"uptime"`
	Version        string        `json:"version"`
}

type SystemLoad struct {
	Load1M  float64 `json:"load_1m"`
	Load5M  float64 `json:"load_5m"`
	Load15M float64 `json:"load_15m"`
}

// NodeAgentHandler handles agent-related endpoints
type NodeAgentHandler struct {
	q *sqlcdb.Queries
}

func NewNodeAgentHandler(db *database.DB) *NodeAgentHandler {
	return &NodeAgentHandler{q: sqlcdb.New(db.DB)}
}

// --- row <-> API type conversion helpers ---

func rawJSON(v interface{}) pqtype.NullRawMessage {
	if v == nil {
		return pqtype.NullRawMessage{}
	}
	b, err := json.Marshal(v)
	if err != nil {
		return pqtype.NullRawMessage{}
	}
	return pqtype.NullRawMessage{RawMessage: b, Valid: true}
}

func unmarshalRaw(raw pqtype.NullRawMessage, dst interface{}) {
	if raw.Valid && len(raw.RawMessage) > 0 {
		_ = json.Unmarshal(raw.RawMessage, dst)
	}
}

func agentFromRow(row sqlcdb.NodeAgent) NodeAgent {
	agent := NodeAgent{
		ID:        row.ID,
		Name:      row.Name,
		Hostname:  row.Hostname,
		IPAddress: row.IpAddress,
		Port:      int(row.Port),
		Status:    row.Status.String,
		Version:   row.Version.String,
		Metadata:  map[string]interface{}{},
	}
	if row.LastHeartbeat.Valid {
		agent.LastHeartbeat = row.LastHeartbeat.Time
	}
	if row.CreatedAt.Valid {
		agent.CreatedAt = row.CreatedAt.Time
	}
	if row.UpdatedAt.Valid {
		agent.UpdatedAt = row.UpdatedAt.Time
	}
	unmarshalRaw(row.Capabilities, &agent.Capabilities)
	unmarshalRaw(row.Resources, &agent.Resources)
	unmarshalRaw(row.Metadata, &agent.Metadata)
	return agent
}

func containerFromRow(row sqlcdb.ContainerInstance) ContainerInstance {
	container := ContainerInstance{
		ID:          row.ID,
		Name:        row.Name,
		Image:       row.Image,
		ProjectID:   row.ProjectID,
		ServiceID:   row.ServiceID,
		NodeAgentID: row.NodeAgentID,
	}
	if row.CreatedAt.Valid {
		container.CreatedAt = row.CreatedAt.Time
	}
	if row.UpdatedAt.Valid {
		container.UpdatedAt = row.UpdatedAt.Time
	}
	if row.StartedAt.Valid {
		t := row.StartedAt.Time
		container.StartedAt = &t
	}
	unmarshalRaw(row.Status, &container.Status)
	unmarshalRaw(row.Resources, &container.Resources)
	unmarshalRaw(row.Ports, &container.Ports)
	unmarshalRaw(row.Environment, &container.Environment)
	unmarshalRaw(row.Volumes, &container.Volumes)
	unmarshalRaw(row.Networks, &container.Networks)
	unmarshalRaw(row.RestartPolicy, &container.RestartPolicy)
	if row.HealthCheck.Valid {
		var hc HealthCheck
		if err := json.Unmarshal(row.HealthCheck.RawMessage, &hc); err == nil {
			container.HealthCheck = &hc
		}
	}
	return container
}

func commandFromRow(row sqlcdb.AgentCommand) AgentCommand {
	cmd := AgentCommand{
		ID:          row.ID,
		Type:        row.Type,
		NodeAgentID: row.NodeAgentID,
		Status:      row.Status.String,
	}
	if row.ContainerID.Valid {
		cmd.ContainerID = &row.ContainerID.String
	}
	if row.Result.Valid {
		cmd.Result = &row.Result.String
	}
	if row.Error.Valid {
		cmd.Error = &row.Error.String
	}
	if row.CreatedAt.Valid {
		cmd.CreatedAt = row.CreatedAt.Time
	}
	if row.UpdatedAt.Valid {
		cmd.UpdatedAt = row.UpdatedAt.Time
	}
	if row.CompletedAt.Valid {
		t := row.CompletedAt.Time
		cmd.CompletedAt = &t
	}
	unmarshalRaw(row.Payload, &cmd.Payload)
	return cmd
}

// --- handlers ---

// RegisterAgent handles agent registration
func (h *NodeAgentHandler) RegisterAgent(c *gin.Context) {
	var req struct {
		Name         string            `json:"name" binding:"required"`
		Hostname     string            `json:"hostname" binding:"required"`
		IPAddress    string            `json:"ip_address" binding:"required"`
		Port         int               `json:"port" binding:"required"`
		Capabilities AgentCapabilities `json:"capabilities" binding:"required"`
		AuthToken    string            `json:"auth_token"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	authToken := firstNonEmpty(req.AuthToken, agentAuthTokenFromRequest(c))
	if !h.isValidAgentAuthToken(c.Request.Context(), authToken) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid auth token"})
		return
	}

	ctx := c.Request.Context()

	// Re-registering an existing host updates it in place.
	if existing, err := h.q.GetAgentByHostAndIP(ctx, sqlcdb.GetAgentByHostAndIPParams{
		Hostname:  req.Hostname,
		IpAddress: req.IPAddress,
	}); err == nil {
		updated, err := h.q.UpdateAgent(ctx, sqlcdb.UpdateAgentParams{
			ID:            existing.ID,
			Name:          req.Name,
			Hostname:      existing.Hostname,
			IpAddress:     existing.IpAddress,
			Port:          int32(req.Port),
			Status:        sql.NullString{String: "connecting", Valid: true},
			Version:       existing.Version,
			Capabilities:  rawJSON(req.Capabilities),
			Resources:     existing.Resources,
			LastHeartbeat: sql.NullTime{Time: time.Now(), Valid: true},
			Metadata:      existing.Metadata,
		})
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update agent"})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"agent_id":   updated.ID,
			"auth_token": authToken,
			"status":     "updated",
		})
		return
	}

	agentID := uuid.New().String()
	resources := NodeResources{
		CPU: CPUResources{Cores: 4},
		Memory: MemoryResources{
			Total:     8 * 1024 * 1024 * 1024, // 8GB
			Available: 8 * 1024 * 1024 * 1024,
		},
		Storage: StorageResources{
			Total:     100 * 1024 * 1024 * 1024, // 100GB
			Available: 100 * 1024 * 1024 * 1024,
		},
		Network: NetworkResources{
			Interfaces: []NetworkInterface{
				{
					Name:       "eth0",
					IPAddress:  req.IPAddress,
					MACAddress: "00:00:00:00:00:00",
					Speed:      1000,
					Status:     "up",
				},
			},
		},
	}

	_, err := h.q.CreateAgent(ctx, sqlcdb.CreateAgentParams{
		ID:            agentID,
		Name:          req.Name,
		Hostname:      req.Hostname,
		IpAddress:     req.IPAddress,
		Port:          int32(req.Port),
		Status:        sql.NullString{String: "connecting", Valid: true},
		Version:       sql.NullString{},
		Capabilities:  rawJSON(req.Capabilities),
		Resources:     rawJSON(resources),
		LastHeartbeat: sql.NullTime{Time: time.Now(), Valid: true},
		Metadata:      rawJSON(map[string]interface{}{}),
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create agent"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"agent_id":   agentID,
		"auth_token": authToken,
		"status":     "registered",
	})
}

// GetAgents returns all registered agents
func (h *NodeAgentHandler) GetAgents(c *gin.Context) {
	rows, err := h.q.ListAgents(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch agents"})
		return
	}

	agents := make([]NodeAgent, 0, len(rows))
	for _, row := range rows {
		agents = append(agents, agentFromRow(row))
	}

	c.JSON(http.StatusOK, gin.H{"agents": agents})
}

// GetAgent returns a specific agent
func (h *NodeAgentHandler) GetAgent(c *gin.Context) {
	row, err := h.q.GetAgent(c.Request.Context(), c.Param("id"))
	if err != nil {
		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "Agent not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch agent"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"agent": agentFromRow(row)})
}

// UpdateAgent updates an agent's information
func (h *NodeAgentHandler) UpdateAgent(c *gin.Context) {
	id := c.Param("id")
	ctx := c.Request.Context()

	row, err := h.q.GetAgent(ctx, id)
	if err != nil {
		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "Agent not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch agent"})
		return
	}

	var updates map[string]interface{}
	if err := c.ShouldBindJSON(&updates); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	agent := agentFromRow(row)
	applyAgentUpdates(&agent, updates)

	updated, err := h.q.UpdateAgent(ctx, sqlcdb.UpdateAgentParams{
		ID:            agent.ID,
		Name:          agent.Name,
		Hostname:      agent.Hostname,
		IpAddress:     agent.IPAddress,
		Port:          int32(agent.Port),
		Status:        sql.NullString{String: agent.Status, Valid: agent.Status != ""},
		Version:       sql.NullString{String: agent.Version, Valid: agent.Version != ""},
		Capabilities:  rawJSON(agent.Capabilities),
		Resources:     rawJSON(agent.Resources),
		LastHeartbeat: sql.NullTime{Time: agent.LastHeartbeat, Valid: !agent.LastHeartbeat.IsZero()},
		Metadata:      rawJSON(agent.Metadata),
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update agent"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"agent": agentFromRow(updated)})
}

// applyAgentUpdates merges whitelisted keys from an arbitrary update map.
func applyAgentUpdates(agent *NodeAgent, updates map[string]interface{}) {
	remarshal := func(key string, dst interface{}) {
		if v, ok := updates[key]; ok {
			if b, err := json.Marshal(v); err == nil {
				_ = json.Unmarshal(b, dst)
			}
		}
	}
	remarshal("name", &agent.Name)
	remarshal("hostname", &agent.Hostname)
	remarshal("ip_address", &agent.IPAddress)
	remarshal("port", &agent.Port)
	remarshal("status", &agent.Status)
	remarshal("version", &agent.Version)
	remarshal("capabilities", &agent.Capabilities)
	remarshal("resources", &agent.Resources)
	remarshal("metadata", &agent.Metadata)
}

// DeleteAgent removes an agent
func (h *NodeAgentHandler) DeleteAgent(c *gin.Context) {
	if err := h.q.DeleteAgent(c.Request.Context(), c.Param("id")); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete agent"})
		return
	}

	c.Status(http.StatusNoContent)
}

// SendHeartbeat handles heartbeat messages from agents
func (h *NodeAgentHandler) SendHeartbeat(c *gin.Context) {
	var heartbeat AgentHeartbeat
	if err := c.ShouldBindJSON(&heartbeat); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	authToken := firstNonEmpty(heartbeat.AuthToken, agentAuthTokenFromRequest(c))
	if !h.isValidAgentAuthToken(c.Request.Context(), authToken) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid auth token"})
		return
	}
	if heartbeat.Timestamp.IsZero() {
		heartbeat.Timestamp = time.Now()
	}

	ctx := c.Request.Context()
	if _, err := h.q.GetAgent(ctx, heartbeat.NodeAgentID); err != nil {
		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "Agent not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch agent"})
		return
	}

	if err := h.q.UpdateAgentHeartbeat(ctx, sqlcdb.UpdateAgentHeartbeatParams{
		ID:            heartbeat.NodeAgentID,
		Status:        sql.NullString{String: heartbeat.Status, Valid: heartbeat.Status != ""},
		Resources:     rawJSON(heartbeat.Resources),
		LastHeartbeat: sql.NullTime{Time: heartbeat.Timestamp, Valid: true},
	}); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update agent"})
		return
	}

	err := h.q.InsertAgentHeartbeat(ctx, sqlcdb.InsertAgentHeartbeatParams{
		ID:             uuid.New().String(),
		NodeAgentID:    heartbeat.NodeAgentID,
		Timestamp:      heartbeat.Timestamp,
		Status:         heartbeat.Status,
		Resources:      rawJSON(heartbeat.Resources).RawMessage,
		ContainerCount: int32(heartbeat.ContainerCount),
		SystemLoad:     rawJSON(heartbeat.SystemLoad).RawMessage,
		Uptime:         heartbeat.Uptime,
		Version:        heartbeat.Version,
	})
	if err != nil && !isMissingTableError(err) {
		// Keep heartbeat endpoint available even if history table is not yet migrated.
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to persist heartbeat"})
		return
	}

	c.Status(http.StatusOK)
}

// GetPendingCommandsForAgent exposes queued commands to token-authenticated node agents.
func (h *NodeAgentHandler) GetPendingCommandsForAgent(c *gin.Context) {
	if !h.isValidAgentAuthToken(c.Request.Context(), agentAuthTokenFromRequest(c)) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid auth token"})
		return
	}

	rows, err := h.q.ListPendingCommands(c.Request.Context(), c.Param("id"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch commands"})
		return
	}

	commands := make([]AgentCommand, 0, len(rows))
	for _, row := range rows {
		commands = append(commands, commandFromRow(row))
	}

	c.JSON(http.StatusOK, gin.H{"commands": commands})
}

// CompleteCommand lets a node agent report command completion or failure.
func (h *NodeAgentHandler) CompleteCommand(c *gin.Context) {
	if !h.isValidAgentAuthToken(c.Request.Context(), agentAuthTokenFromRequest(c)) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid auth token"})
		return
	}

	agentID := c.Param("id")
	commandID := c.Param("commandId")
	var req struct {
		Status string `json:"status" binding:"required"`
		Result string `json:"result"`
		Error  string `json:"error"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if req.Status != "completed" && req.Status != "failed" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "status must be completed or failed"})
		return
	}

	ctx := c.Request.Context()
	command, err := h.q.CompleteCommand(ctx, sqlcdb.CompleteCommandParams{
		ID:          commandID,
		NodeAgentID: agentID,
		Status:      sql.NullString{String: req.Status, Valid: true},
		Result:      sql.NullString{String: req.Result, Valid: req.Result != ""},
		Error:       sql.NullString{String: req.Error, Valid: req.Error != ""},
	})
	if err != nil {
		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "Command not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update command"})
		return
	}

	out := commandFromRow(command)
	if out.ContainerID != nil {
		h.updateContainerStatusAfterCommand(ctx, out)
	}

	c.JSON(http.StatusOK, gin.H{"command": out})
}

func (h *NodeAgentHandler) updateContainerStatusAfterCommand(ctx context.Context, command AgentCommand) {
	row, err := h.q.GetContainer(ctx, *command.ContainerID)
	if err != nil {
		return
	}

	container := containerFromRow(row)

	if command.Status == "failed" {
		errorMessage := ""
		if command.Error != nil {
			errorMessage = *command.Error
		}
		container.Status.State = "error"
		container.Status.Error = &errorMessage
		_ = h.q.UpdateContainerStatus(ctx, sqlcdb.UpdateContainerStatusParams{
			ID:     container.ID,
			Status: rawJSON(container.Status),
		})
		return
	}

	now := time.Now()
	switch command.Type {
	case "create_container", "start_container", "restart_container":
		container.Status.State = "running"
		container.Status.Health = "unknown"
		container.Status.StartedAt = &now
		container.Status.Error = nil
	case "stop_container":
		container.Status.State = "stopped"
		container.Status.FinishedAt = &now
	case "remove_container":
		container.Status.State = "removed"
		container.Status.FinishedAt = &now
	}
	_ = h.q.UpdateContainerStatus(ctx, sqlcdb.UpdateContainerStatusParams{
		ID:     container.ID,
		Status: rawJSON(container.Status),
	})
}

// GetAgentContainers returns containers running on a specific agent
func (h *NodeAgentHandler) GetAgentContainers(c *gin.Context) {
	rows, err := h.q.ListContainersForAgent(c.Request.Context(), c.Param("id"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch containers"})
		return
	}

	containers := make([]ContainerInstance, 0, len(rows))
	for _, row := range rows {
		containers = append(containers, containerFromRow(row))
	}

	c.JSON(http.StatusOK, gin.H{"containers": containers})
}

// CreateContainer creates a new container on an agent
func (h *NodeAgentHandler) CreateContainer(c *gin.Context) {
	agentID := c.Param("id")

	var req struct {
		Name          string             `json:"name" binding:"required"`
		Image         string             `json:"image" binding:"required"`
		ProjectID     string             `json:"project_id" binding:"required"`
		ServiceID     string             `json:"service_id" binding:"required"`
		Resources     ContainerResources `json:"resources" binding:"required"`
		Ports         []PortMapping      `json:"ports"`
		Environment   map[string]string  `json:"environment"`
		Volumes       []VolumeMount      `json:"volumes"`
		Networks      []string           `json:"networks"`
		RestartPolicy RestartPolicy      `json:"restart_policy"`
		HealthCheck   *HealthCheck       `json:"health_check"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx := c.Request.Context()

	// Verify agent exists
	if _, err := h.q.GetAgent(ctx, agentID); err != nil {
		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "Agent not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch agent"})
		return
	}

	containerID := uuid.New().String()
	container := ContainerInstance{
		ID:            containerID,
		Name:          req.Name,
		Image:         req.Image,
		ProjectID:     req.ProjectID,
		ServiceID:     req.ServiceID,
		NodeAgentID:   agentID,
		Status:        ContainerStatus{State: "created", Health: "none"},
		Resources:     req.Resources,
		Ports:         req.Ports,
		Environment:   req.Environment,
		Volumes:       req.Volumes,
		Networks:      req.Networks,
		RestartPolicy: req.RestartPolicy,
		HealthCheck:   req.HealthCheck,
		CreatedAt:     time.Now(),
		UpdatedAt:     time.Now(),
	}

	_, err := h.q.CreateContainer(ctx, sqlcdb.CreateContainerParams{
		ID:            container.ID,
		Name:          container.Name,
		Image:         container.Image,
		ProjectID:     container.ProjectID,
		ServiceID:     container.ServiceID,
		NodeAgentID:   container.NodeAgentID,
		Status:        rawJSON(container.Status),
		Resources:     rawJSON(container.Resources),
		Ports:         rawJSON(container.Ports),
		Environment:   rawJSON(container.Environment),
		Volumes:       rawJSON(container.Volumes),
		Networks:      rawJSON(container.Networks),
		RestartPolicy: rawJSON(container.RestartPolicy),
		HealthCheck:   rawJSON(container.HealthCheck),
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create container"})
		return
	}

	// Create command to start container on agent
	_, err = h.q.CreateCommand(ctx, sqlcdb.CreateCommandParams{
		ID:          uuid.New().String(),
		Type:        "create_container",
		NodeAgentID: agentID,
		ContainerID: sql.NullString{String: container.ID, Valid: true},
		Payload:     rawJSON(map[string]interface{}{"container": container}),
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create container command"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"container": container})
}

// ExecuteCommand executes a command on an agent
func (h *NodeAgentHandler) ExecuteCommand(c *gin.Context) {
	agentID := c.Param("id")

	var req struct {
		Type    string                 `json:"type" binding:"required"`
		Payload map[string]interface{} `json:"payload"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	command, err := h.q.CreateCommand(c.Request.Context(), sqlcdb.CreateCommandParams{
		ID:          uuid.New().String(),
		Type:        req.Type,
		NodeAgentID: agentID,
		Payload:     rawJSON(req.Payload),
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create command"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"command": commandFromRow(command)})
}

// GetAgentCommands returns commands for an agent
func (h *NodeAgentHandler) GetAgentCommands(c *gin.Context) {
	rows, err := h.q.ListCommandsForAgent(c.Request.Context(), c.Param("id"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch commands"})
		return
	}

	commands := make([]AgentCommand, 0, len(rows))
	for _, row := range rows {
		commands = append(commands, commandFromRow(row))
	}

	c.JSON(http.StatusOK, gin.H{"commands": commands})
}

// GetCommandStatus returns the status of a specific command
func (h *NodeAgentHandler) GetCommandStatus(c *gin.Context) {
	command, err := h.q.GetCommandForAgent(c.Request.Context(), sqlcdb.GetCommandForAgentParams{
		ID:          c.Param("commandId"),
		NodeAgentID: c.Param("id"),
	})
	if err != nil {
		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "Command not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch command"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"command": commandFromRow(command)})
}

// ContainerAction handles container lifecycle actions
func (h *NodeAgentHandler) ContainerAction(c *gin.Context) {
	agentID := c.Param("id")
	containerID := c.Param("containerId")
	action := c.Param("action")
	if action == "" && c.Request.Method == http.MethodDelete {
		action = "remove"
	}

	// Validate action
	validActions := map[string]bool{
		"start":   true,
		"stop":    true,
		"restart": true,
		"remove":  true,
	}
	if !validActions[action] {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid action"})
		return
	}

	ctx := c.Request.Context()

	// Verify container exists
	containerRow, err := h.q.GetContainerForAgent(ctx, sqlcdb.GetContainerForAgentParams{
		ID:          containerID,
		NodeAgentID: agentID,
	})
	if err != nil {
		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "Container not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch container"})
		return
	}

	// Create command for the action
	_, err = h.q.CreateCommand(ctx, sqlcdb.CreateCommandParams{
		ID:          uuid.New().String(),
		Type:        fmt.Sprintf("%s_container", action),
		NodeAgentID: agentID,
		ContainerID: sql.NullString{String: containerRow.ID, Valid: true},
		Payload: rawJSON(map[string]interface{}{
			"container_id":   containerID,
			"container_name": containerRow.Name,
			"docker_name":    containerRow.Name,
		}),
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create command"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": fmt.Sprintf("Container %s action initiated", action)})
}

// GetAgentMetrics returns metrics for an agent
func (h *NodeAgentHandler) GetAgentMetrics(c *gin.Context) {
	agentID := c.Param("id")
	timeRange := c.Query("time_range")
	if timeRange == "" {
		timeRange = "1h" // default to 1 hour
	}

	// Parse time range
	duration, err := time.ParseDuration(timeRange)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid time range"})
		return
	}

	if duration <= 0 || duration > 30*24*time.Hour {
		c.JSON(http.StatusBadRequest, gin.H{"error": "time_range must be between 1s and 720h"})
		return
	}

	ctx := c.Request.Context()
	agentRow, err := h.q.GetAgent(ctx, agentID)
	if err != nil {
		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "Agent not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch agent"})
		return
	}
	agent := agentFromRow(agentRow)

	from := time.Now().Add(-duration)
	records, queryErr := h.q.ListAgentHeartbeatsSince(ctx, sqlcdb.ListAgentHeartbeatsSinceParams{
		NodeAgentID: agentID,
		Timestamp:   from,
	})
	if queryErr != nil && !isMissingTableError(queryErr) {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch agent metrics"})
		return
	}

	metrics := make([]map[string]interface{}, 0, len(records))
	for _, record := range records {
		var resources NodeResources
		var load SystemLoad
		_ = json.Unmarshal(record.Resources, &resources)
		_ = json.Unmarshal(record.SystemLoad, &load)
		metrics = append(metrics, buildMetricPoint(record.Timestamp, resources, load, int(record.ContainerCount)))
	}

	if len(metrics) == 0 {
		// Fallback to current snapshot when no historical records exist.
		metrics = append(metrics, buildMetricPoint(
			nonZeroTime(agent.LastHeartbeat, time.Now()),
			agent.Resources,
			SystemLoad{},
			0,
		))
	}

	c.JSON(http.StatusOK, gin.H{"metrics": metrics})
}

func buildMetricPoint(ts time.Time, resources NodeResources, load SystemLoad, containerCount int) map[string]interface{} {
	memLimit := maxInt(resources.Memory.Total, 1)
	memUsagePercent := math.Min(100, (float64(resources.Memory.Used)/float64(memLimit))*100)
	cpuUsage := resources.CPU.Usage
	if cpuUsage < 0 {
		cpuUsage = 0
	}

	return map[string]interface{}{
		"timestamp": ts.Format(time.RFC3339),
		"cpu": map[string]interface{}{
			"usage":         cpuUsage,
			"usage_percent": cpuUsage,
			"cores":         resources.CPU.Cores,
		},
		"memory": map[string]interface{}{
			"usage":         resources.Memory.Used,
			"usage_percent": memUsagePercent,
			"limit":         resources.Memory.Total,
			"available":     resources.Memory.Available,
		},
		"system_load": map[string]interface{}{
			"load_1m":  load.Load1M,
			"load_5m":  load.Load5M,
			"load_15m": load.Load15M,
		},
		"container_count": containerCount,
	}
}

func isValidAgentAuthToken(token string) bool {
	token = strings.TrimSpace(token)
	if token == "" {
		return false
	}

	for _, candidate := range configuredAgentAuthTokens() {
		if subtle.ConstantTimeCompare([]byte(token), []byte(candidate)) == 1 {
			return true
		}
	}
	return false
}

// isValidAgentAuthTokenDB accepts env-configured shared tokens or a
// DB-issued onboarding token (matched by sha256 hash, never stored raw).
func (h *NodeAgentHandler) isValidAgentAuthToken(ctx context.Context, token string) bool {
	if isValidAgentAuthToken(token) {
		return true
	}

	token = strings.TrimSpace(token)
	if token == "" {
		return false
	}
	sum := sha256.Sum256([]byte(token))
	hash := hex.EncodeToString(sum[:])
	if _, err := h.q.GetActiveAgentAuthTokenByHash(ctx, hash); err != nil {
		return false
	}
	_ = h.q.TouchAgentAuthToken(ctx, hash)
	return true
}

func generateAgentAuthToken() (token string, hash string, err error) {
	buf := make([]byte, 24)
	if _, err = rand.Read(buf); err != nil {
		return "", "", err
	}
	token = "cagt_" + hex.EncodeToString(buf)
	sum := sha256.Sum256([]byte(token))
	return token, hex.EncodeToString(sum[:]), nil
}

func agentAuthTokenFromRequest(c *gin.Context) string {
	if token := strings.TrimSpace(c.GetHeader("X-Containr-Agent-Token")); token != "" {
		return token
	}
	if authHeader := strings.TrimSpace(c.GetHeader("Authorization")); authHeader != "" {
		const bearerPrefix = "Bearer "
		if strings.HasPrefix(authHeader, bearerPrefix) {
			return strings.TrimSpace(strings.TrimPrefix(authHeader, bearerPrefix))
		}
	}
	return strings.TrimSpace(c.Query("auth_token"))
}

func configuredAgentAuthTokens() []string {
	candidateCSV := strings.TrimSpace(os.Getenv("CONTAINR_AGENT_AUTH_TOKENS"))
	if candidateCSV != "" {
		parts := strings.Split(candidateCSV, ",")
		out := make([]string, 0, len(parts))
		for _, part := range parts {
			if trimmed := strings.TrimSpace(part); trimmed != "" {
				out = append(out, trimmed)
			}
		}
		if len(out) > 0 {
			return out
		}
	}

	if single := strings.TrimSpace(os.Getenv("CONTAINR_AGENT_AUTH_TOKEN")); single != "" {
		return []string{single}
	}

	if strings.EqualFold(strings.TrimSpace(os.Getenv("ENVIRONMENT")), "production") {
		return nil
	}

	// Development fallback for local installs with no explicit secret configured.
	return []string{"valid-token"}
}

func isMissingTableError(err error) bool {
	if err == nil {
		return false
	}
	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "does not exist") && strings.Contains(msg, "agent_heartbeats")
}

func nonZeroTime(primary, fallback time.Time) time.Time {
	if primary.IsZero() {
		return fallback
	}
	return primary
}

func maxInt(a, b int) int {
	if a > b {
		return a
	}
	return b
}

// --- onboarding token management ---

func agentAuthTokenJSON(t sqlcdb.AgentAuthToken) gin.H {
	row := gin.H{
		"id":      t.ID,
		"label":   t.Label,
		"revoked": t.RevokedAt.Valid,
	}
	if t.CreatedAt.Valid {
		row["created_at"] = t.CreatedAt.Time
	}
	if t.LastUsedAt.Valid {
		row["last_used_at"] = t.LastUsedAt.Time
	}
	if t.RevokedAt.Valid {
		row["revoked_at"] = t.RevokedAt.Time
	}
	return row
}

// CreateAgentToken issues a new onboarding token. The raw token is returned
// once and never stored — only its sha256 hash persists.
func (h *NodeAgentHandler) CreateAgentToken(c *gin.Context) {
	var req struct {
		Label string `json:"label"`
	}
	_ = c.ShouldBindJSON(&req)

	token, hash, err := generateAgentAuthToken()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token"})
		return
	}

	row, err := h.q.CreateAgentAuthToken(c.Request.Context(), sqlcdb.CreateAgentAuthTokenParams{
		TokenHash: hash,
		Label:     strings.TrimSpace(req.Label),
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to store token"})
		return
	}

	payload := agentAuthTokenJSON(row)
	payload["token"] = token
	c.JSON(http.StatusCreated, payload)
}

// ListAgentTokens returns issued onboarding tokens (metadata only, never hashes).
func (h *NodeAgentHandler) ListAgentTokens(c *gin.Context) {
	rows, err := h.q.ListAgentAuthTokens(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch tokens"})
		return
	}

	tokens := make([]gin.H, 0, len(rows))
	for _, row := range rows {
		tokens = append(tokens, agentAuthTokenJSON(row))
	}
	c.JSON(http.StatusOK, gin.H{"tokens": tokens})
}

// RevokeAgentToken marks an onboarding token as revoked; agents presenting it
// are rejected from then on.
func (h *NodeAgentHandler) RevokeAgentToken(c *gin.Context) {
	id, err := uuid.Parse(strings.TrimSpace(c.Param("id")))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid token id"})
		return
	}

	row, err := h.q.RevokeAgentAuthToken(c.Request.Context(), id)
	if err != nil {
		status := http.StatusInternalServerError
		if errors.Is(err, sql.ErrNoRows) {
			status = http.StatusNotFound
		}
		c.JSON(status, gin.H{"error": "Token not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "revoked", "id": row.ID})
}

// SetupPublicRoutes registers token-authenticated agent ingestion routes.
func (h *NodeAgentHandler) SetupPublicRoutes(router *gin.RouterGroup) {
	agents := router.Group("/agents")
	{
		agents.POST("/register", h.RegisterAgent)
		agents.POST("/heartbeat", h.SendHeartbeat)
		agents.GET("/:id/commands", h.GetPendingCommandsForAgent)
		agents.POST("/:id/commands/:commandId/result", h.CompleteCommand)
	}
}

// SetupAdminRoutes registers dashboard/control agent routes. Command
// history and container details can leak sensitive output, so these stay
// admin-only rather than joining the public read group.
func (h *NodeAgentHandler) SetupAdminRoutes(router *gin.RouterGroup) {
	tokens := router.Group("/agent-tokens")
	{
		tokens.POST("", h.CreateAgentToken)
		tokens.GET("", h.ListAgentTokens)
		tokens.DELETE("/:id", h.RevokeAgentToken)
	}

	agents := router.Group("/agents")
	{
		agents.GET("", h.GetAgents)
		agents.GET("/:id", h.GetAgent)
		agents.PUT("/:id", h.UpdateAgent)
		agents.DELETE("/:id", h.DeleteAgent)

		agents.GET("/:id/containers", h.GetAgentContainers)
		agents.POST("/:id/containers", h.CreateContainer)
		agents.POST("/:id/containers/:containerId/start", h.ContainerAction)
		agents.POST("/:id/containers/:containerId/stop", h.ContainerAction)
		agents.POST("/:id/containers/:containerId/restart", h.ContainerAction)
		agents.DELETE("/:id/containers/:containerId", h.ContainerAction)

		agents.GET("/:id/metrics", h.GetAgentMetrics)
		agents.POST("/:id/commands", h.ExecuteCommand)
		agents.GET("/:id/commands", h.GetAgentCommands)
		agents.GET("/:id/commands/:commandId", h.GetCommandStatus)
	}
}
