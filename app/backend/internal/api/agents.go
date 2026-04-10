package api

import (
	"crypto/subtle"
	"fmt"
	"math"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// NodeAgent represents a container orchestration agent
type NodeAgent struct {
	ID            string                 `json:"id" gorm:"primaryKey"`
	Name          string                 `json:"name" gorm:"not null"`
	Hostname      string                 `json:"hostname" gorm:"not null"`
	IPAddress     string                 `json:"ip_address" gorm:"not null"`
	Port          int                    `json:"port" gorm:"not null"`
	Status        string                 `json:"status" gorm:"default:'offline'"`
	Version       string                 `json:"version"`
	Capabilities  AgentCapabilities      `json:"capabilities" gorm:"serializer:json"`
	Resources     NodeResources          `json:"resources" gorm:"serializer:json"`
	LastHeartbeat time.Time              `json:"last_heartbeat"`
	CreatedAt     time.Time              `json:"created_at"`
	UpdatedAt     time.Time              `json:"updated_at"`
	Metadata      map[string]interface{} `json:"metadata" gorm:"serializer:json"`
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
	ID            string             `json:"id" gorm:"primaryKey"`
	Name          string             `json:"name" gorm:"not null"`
	Image         string             `json:"image" gorm:"not null"`
	ProjectID     string             `json:"project_id" gorm:"not null"`
	ServiceID     string             `json:"service_id" gorm:"not null"`
	NodeAgentID   string             `json:"node_agent_id" gorm:"not null"`
	Status        ContainerStatus    `json:"status" gorm:"serializer:json"`
	Resources     ContainerResources `json:"resources" gorm:"serializer:json"`
	Ports         []PortMapping      `json:"ports" gorm:"serializer:json"`
	Environment   map[string]string  `json:"environment" gorm:"serializer:json"`
	Volumes       []VolumeMount      `json:"volumes" gorm:"serializer:json"`
	Networks      []string           `json:"networks" gorm:"serializer:json"`
	RestartPolicy RestartPolicy      `json:"restart_policy" gorm:"serializer:json"`
	HealthCheck   *HealthCheck       `json:"health_check" gorm:"serializer:json"`
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
	ID          string                 `json:"id" gorm:"primaryKey"`
	Type        string                 `json:"type" gorm:"not null"`
	NodeAgentID string                 `json:"node_agent_id" gorm:"not null"`
	ContainerID *string                `json:"container_id"`
	Payload     map[string]interface{} `json:"payload" gorm:"serializer:json"`
	Status      string                 `json:"status" gorm:"default:'pending'"`
	Result      *string                `json:"result"`
	Error       *string                `json:"error"`
	CreatedAt   time.Time              `json:"created_at"`
	UpdatedAt   time.Time              `json:"updated_at"`
	CompletedAt *time.Time             `json:"completed_at"`
}

// AgentHeartbeat represents a heartbeat message from an agent
type AgentHeartbeat struct {
	NodeAgentID    string        `json:"node_agent_id"`
	Timestamp      time.Time     `json:"timestamp"`
	Status         string        `json:"status"`
	Resources      NodeResources `json:"resources"`
	ContainerCount int           `json:"container_count"`
	SystemLoad     SystemLoad    `json:"system_load"`
	Uptime         int64         `json:"uptime"`
	Version        string        `json:"version"`
}

type AgentHeartbeatRecord struct {
	ID             string        `json:"id" gorm:"primaryKey"`
	NodeAgentID    string        `json:"node_agent_id" gorm:"index;not null"`
	Timestamp      time.Time     `json:"timestamp" gorm:"index;not null"`
	Status         string        `json:"status"`
	Resources      NodeResources `json:"resources" gorm:"serializer:json"`
	ContainerCount int           `json:"container_count"`
	SystemLoad     SystemLoad    `json:"system_load" gorm:"serializer:json"`
	Uptime         int64         `json:"uptime"`
	Version        string        `json:"version"`
	CreatedAt      time.Time     `json:"created_at"`
}

type SystemLoad struct {
	Load1M  float64 `json:"load_1m"`
	Load5M  float64 `json:"load_5m"`
	Load15M float64 `json:"load_15m"`
}

// NodeAgentHandler handles agent-related endpoints
type NodeAgentHandler struct {
	db *gorm.DB
}

func NewNodeAgentHandler(db *gorm.DB) *NodeAgentHandler {
	return &NodeAgentHandler{db: db}
}

// RegisterAgent handles agent registration
func (h *NodeAgentHandler) RegisterAgent(c *gin.Context) {
	var req struct {
		Name         string            `json:"name" binding:"required"`
		Hostname     string            `json:"hostname" binding:"required"`
		IPAddress    string            `json:"ip_address" binding:"required"`
		Port         int               `json:"port" binding:"required"`
		Capabilities AgentCapabilities `json:"capabilities" binding:"required"`
		AuthToken    string            `json:"auth_token" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if !isValidAgentAuthToken(req.AuthToken) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid auth token"})
		return
	}

	// Check if agent already exists
	var existingAgent NodeAgent
	if err := h.db.Where("hostname = ? AND ip_address = ?", req.Hostname, req.IPAddress).First(&existingAgent).Error; err == nil {
		// Update existing agent
		existingAgent.Name = req.Name
		existingAgent.Port = req.Port
		existingAgent.Capabilities = req.Capabilities
		existingAgent.Status = "connecting"
		existingAgent.LastHeartbeat = time.Now()

		if err := h.db.Save(&existingAgent).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update agent"})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"agent_id":   existingAgent.ID,
			"auth_token": req.AuthToken,
			"status":     "updated",
		})
		return
	}

	// Create new agent
	agent := NodeAgent{
		ID:           uuid.New().String(),
		Name:         req.Name,
		Hostname:     req.Hostname,
		IPAddress:    req.IPAddress,
		Port:         req.Port,
		Status:       "connecting",
		Capabilities: req.Capabilities,
		Resources: NodeResources{
			CPU: CPUResources{
				Cores:      4,
				Allocation: 0,
				Usage:      0,
			},
			Memory: MemoryResources{
				Total:     8 * 1024 * 1024 * 1024, // 8GB
				Allocated: 0,
				Used:      0,
				Available: 8 * 1024 * 1024 * 1024,
			},
			Storage: StorageResources{
				Total:     100 * 1024 * 1024 * 1024, // 100GB
				Allocated: 0,
				Used:      0,
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
				Bandwidth: BandwidthInfo{
					Inbound:  0,
					Outbound: 0,
				},
			},
		},
		LastHeartbeat: time.Now(),
		CreatedAt:     time.Now(),
		UpdatedAt:     time.Now(),
		Metadata:      make(map[string]interface{}),
	}

	if err := h.db.Create(&agent).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create agent"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"agent_id":   agent.ID,
		"auth_token": req.AuthToken,
		"status":     "registered",
	})
}

// GetAgents returns all registered agents
func (h *NodeAgentHandler) GetAgents(c *gin.Context) {
	var agents []NodeAgent
	if err := h.db.Find(&agents).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch agents"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"agents": agents})
}

// GetAgent returns a specific agent
func (h *NodeAgentHandler) GetAgent(c *gin.Context) {
	id := c.Param("id")

	var agent NodeAgent
	if err := h.db.First(&agent, "id = ?", id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Agent not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch agent"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"agent": agent})
}

// UpdateAgent updates an agent's information
func (h *NodeAgentHandler) UpdateAgent(c *gin.Context) {
	id := c.Param("id")

	var agent NodeAgent
	if err := h.db.First(&agent, "id = ?", id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
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

	if err := h.db.Model(&agent).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update agent"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"agent": agent})
}

// DeleteAgent removes an agent
func (h *NodeAgentHandler) DeleteAgent(c *gin.Context) {
	id := c.Param("id")

	if err := h.db.Delete(&NodeAgent{}, "id = ?", id).Error; err != nil {
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
	if heartbeat.Timestamp.IsZero() {
		heartbeat.Timestamp = time.Now()
	}

	var agent NodeAgent
	if err := h.db.First(&agent, "id = ?", heartbeat.NodeAgentID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Agent not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch agent"})
		return
	}

	// Update agent status and resources
	agent.Status = heartbeat.Status
	agent.Resources = heartbeat.Resources
	agent.LastHeartbeat = heartbeat.Timestamp
	agent.UpdatedAt = time.Now()

	if err := h.db.Save(&agent).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update agent"})
		return
	}

	record := AgentHeartbeatRecord{
		ID:             uuid.New().String(),
		NodeAgentID:    heartbeat.NodeAgentID,
		Timestamp:      heartbeat.Timestamp,
		Status:         heartbeat.Status,
		Resources:      heartbeat.Resources,
		ContainerCount: heartbeat.ContainerCount,
		SystemLoad:     heartbeat.SystemLoad,
		Uptime:         heartbeat.Uptime,
		Version:        heartbeat.Version,
		CreatedAt:      time.Now(),
	}
	if err := h.db.Create(&record).Error; err != nil {
		// Keep heartbeat endpoint available even if history table is not yet migrated.
		if !isMissingTableError(err) {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to persist heartbeat"})
			return
		}
	}

	c.Status(http.StatusOK)
}

// GetAgentContainers returns containers running on a specific agent
func (h *NodeAgentHandler) GetAgentContainers(c *gin.Context) {
	agentID := c.Param("id")

	var containers []ContainerInstance
	if err := h.db.Where("node_agent_id = ?", agentID).Find(&containers).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch containers"})
		return
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

	// Verify agent exists
	var agent NodeAgent
	if err := h.db.First(&agent, "id = ?", agentID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Agent not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch agent"})
		return
	}

	container := ContainerInstance{
		ID:          uuid.New().String(),
		Name:        req.Name,
		Image:       req.Image,
		ProjectID:   req.ProjectID,
		ServiceID:   req.ServiceID,
		NodeAgentID: agentID,
		Status: ContainerStatus{
			State:  "created",
			Health: "none",
		},
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

	if err := h.db.Create(&container).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create container"})
		return
	}

	// Create command to start container on agent
	command := AgentCommand{
		ID:          uuid.New().String(),
		Type:        "create_container",
		NodeAgentID: agentID,
		ContainerID: &container.ID,
		Payload: map[string]interface{}{
			"container": container,
		},
		Status:    "pending",
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	if err := h.db.Create(&command).Error; err != nil {
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

	command := AgentCommand{
		ID:          uuid.New().String(),
		Type:        req.Type,
		NodeAgentID: agentID,
		Payload:     req.Payload,
		Status:      "pending",
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	if err := h.db.Create(&command).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create command"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"command": command})
}

// GetAgentCommands returns commands for an agent
func (h *NodeAgentHandler) GetAgentCommands(c *gin.Context) {
	agentID := c.Param("id")

	var commands []AgentCommand
	if err := h.db.Where("node_agent_id = ?", agentID).Order("created_at DESC").Find(&commands).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch commands"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"commands": commands})
}

// GetCommandStatus returns the status of a specific command
func (h *NodeAgentHandler) GetCommandStatus(c *gin.Context) {
	agentID := c.Param("id")
	commandID := c.Param("commandId")

	var command AgentCommand
	if err := h.db.First(&command, "id = ? AND node_agent_id = ?", commandID, agentID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Command not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch command"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"command": command})
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

	// Verify container exists
	var container ContainerInstance
	if err := h.db.First(&container, "id = ? AND node_agent_id = ?", containerID, agentID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Container not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch container"})
		return
	}

	// Create command for the action
	command := AgentCommand{
		ID:          uuid.New().String(),
		Type:        fmt.Sprintf("%s_container", action),
		NodeAgentID: agentID,
		ContainerID: &container.ID,
		Payload: map[string]interface{}{
			"container_id": containerID,
		},
		Status:    "pending",
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	if err := h.db.Create(&command).Error; err != nil {
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

	var agent NodeAgent
	if err := h.db.First(&agent, "id = ?", agentID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Agent not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch agent"})
		return
	}

	from := time.Now().Add(-duration)
	var records []AgentHeartbeatRecord
	queryErr := h.db.
		Where("node_agent_id = ? AND timestamp >= ?", agentID, from).
		Order("timestamp ASC").
		Find(&records).Error
	if queryErr != nil && !isMissingTableError(queryErr) {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch agent metrics"})
		return
	}

	metrics := make([]map[string]interface{}, 0, len(records))
	for _, record := range records {
		metrics = append(metrics, buildMetricPoint(record.Timestamp, record.Resources, record.SystemLoad, record.ContainerCount))
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
	candidates := configuredAgentAuthTokens()
	if len(candidates) == 0 {
		return false
	}

	token = strings.TrimSpace(token)
	if token == "" {
		return false
	}

	for _, candidate := range candidates {
		if subtle.ConstantTimeCompare([]byte(token), []byte(candidate)) == 1 {
			return true
		}
	}
	return false
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

// SetupRoutes registers the agent routes
func (h *NodeAgentHandler) SetupRoutes(router *gin.RouterGroup) {
	agents := router.Group("/agents")
	{
		agents.POST("/register", h.RegisterAgent)
		agents.GET("", h.GetAgents)
		agents.GET("/:id", h.GetAgent)
		agents.PUT("/:id", h.UpdateAgent)
		agents.DELETE("/:id", h.DeleteAgent)
		agents.POST("/heartbeat", h.SendHeartbeat)

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
