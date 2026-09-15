package api

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"containr/internal/database"
	"containr/internal/docker"

	containertypes "github.com/docker/docker/api/types/container"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// ServiceMetricsResponse is the aggregated live telemetry for a service,
// sourced from Docker container stats for containers named
// containr-<serviceID>-<deploymentID>-<index>.
type ServiceMetricsResponse struct {
	ServiceID        string                   `json:"service_id"`
	Status           string                   `json:"status"` // ok, no_containers, docker_unavailable
	Instances        []ServiceInstanceMetrics `json:"instances"`
	CPUPercent       float64                  `json:"cpu_percent"`
	MemoryUsageBytes uint64                   `json:"memory_usage_bytes"`
	MemoryLimitBytes uint64                   `json:"memory_limit_bytes"`
	NetworkRxBytes   uint64                   `json:"network_rx_bytes"`
	NetworkTxBytes   uint64                   `json:"network_tx_bytes"`
	CollectedAt      time.Time                `json:"collected_at"`
}

// ServiceInstanceMetrics holds live stats for one running container.
type ServiceInstanceMetrics struct {
	ContainerID      string    `json:"container_id"`
	Name             string    `json:"name"`
	State            string    `json:"state"`
	CPUPercent       float64   `json:"cpu_percent"`
	MemoryUsageBytes uint64    `json:"memory_usage_bytes"`
	MemoryLimitBytes uint64    `json:"memory_limit_bytes"`
	NetworkRxBytes   uint64    `json:"network_rx_bytes"`
	NetworkTxBytes   uint64    `json:"network_tx_bytes"`
	StartedAt        time.Time `json:"started_at"`
}

// handleGetServiceMetrics returns real resource usage for the service's
// Docker containers. Empty result when the service has never deployed.
func handleGetServiceMetrics(c *gin.Context) {
	dbValue, exists := c.Get("db")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database connection not available"})
		return
	}
	db := dbValue.(*database.DB)

	serviceID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid service ID"})
		return
	}

	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	var ownerID string
	var status string
	err = db.QueryRow(
		`SELECT p.owner_id, COALESCE(s.status, '')
		 FROM services s JOIN projects p ON s.project_id = p.id
		 WHERE s.id = $1`,
		serviceID,
	).Scan(&ownerID, &status)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Service not found"})
		return
	}
	if ownerID != userID.(string) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	response := ServiceMetricsResponse{
		ServiceID:   serviceID.String(),
		Status:      "ok",
		Instances:   []ServiceInstanceMetrics{},
		CollectedAt: time.Now(),
	}

	dockerValue, exists := c.Get("docker_client")
	if !exists || dockerValue == nil {
		response.Status = "docker_unavailable"
		c.JSON(http.StatusOK, gin.H{"metrics": response})
		return
	}
	dockerClient := dockerValue.(*docker.Client)

	ctx, cancel := context.WithTimeout(c.Request.Context(), 15*time.Second)
	defer cancel()

	containers, err := dockerClient.ListContainers(ctx, false)
	if err != nil {
		response.Status = "docker_unavailable"
		c.JSON(http.StatusOK, gin.H{"metrics": response})
		return
	}

	namePrefix := fmt.Sprintf("containr-%s-", serviceID.String())
	matched := 0
	for _, ctr := range containers {
		name := ""
		for _, n := range ctr.Names {
			name = strings.TrimPrefix(n, "/")
			if strings.HasPrefix(name, namePrefix) {
				break
			}
			name = ""
		}
		if name == "" {
			continue
		}
		matched++

		instance := ServiceInstanceMetrics{
			ContainerID: ctr.ID,
			Name:        name,
			State:       ctr.State,
		}

		if info, err := dockerClient.GetContainer(ctx, ctr.ID); err == nil {
			if info.State != nil && info.State.StartedAt != "" {
				if parsed, perr := time.Parse(time.RFC3339Nano, info.State.StartedAt); perr == nil {
					instance.StartedAt = parsed
				}
			}
		}

		if ctr.State == "running" {
			if stats, err := readContainerStats(ctx, dockerClient, ctr.ID); err == nil {
				instance.CPUPercent = stats.cpuPercent
				instance.MemoryUsageBytes = stats.memoryUsage
				instance.MemoryLimitBytes = stats.memoryLimit
				instance.NetworkRxBytes = stats.networkRx
				instance.NetworkTxBytes = stats.networkTx
			}
		}

		response.Instances = append(response.Instances, instance)
		response.CPUPercent += instance.CPUPercent
		response.MemoryUsageBytes += instance.MemoryUsageBytes
		response.MemoryLimitBytes += instance.MemoryLimitBytes
		response.NetworkRxBytes += instance.NetworkRxBytes
		response.NetworkTxBytes += instance.NetworkTxBytes
	}

	if matched == 0 {
		response.Status = "no_containers"
	}

	c.JSON(http.StatusOK, gin.H{"metrics": response})
}

type containerStatsSnapshot struct {
	cpuPercent  float64
	memoryUsage uint64
	memoryLimit uint64
	networkRx   uint64
	networkTx   uint64
}

func readContainerStats(ctx context.Context, client *docker.Client, containerID string) (*containerStatsSnapshot, error) {
	reader, err := client.GetContainerStats(ctx, containerID, false)
	if err != nil {
		return nil, err
	}
	defer reader.Body.Close()

	var stats containertypes.StatsResponse
	if err := json.NewDecoder(reader.Body).Decode(&stats); err != nil {
		return nil, err
	}

	snapshot := &containerStatsSnapshot{
		memoryUsage: stats.MemoryStats.Usage,
		memoryLimit: stats.MemoryStats.Limit,
	}

	cpuDelta := float64(stats.CPUStats.CPUUsage.TotalUsage) - float64(stats.PreCPUStats.CPUUsage.TotalUsage)
	systemDelta := float64(stats.CPUStats.SystemUsage) - float64(stats.PreCPUStats.SystemUsage)
	onlineCPUs := float64(stats.CPUStats.OnlineCPUs)
	if onlineCPUs == 0 {
		onlineCPUs = float64(len(stats.CPUStats.CPUUsage.PercpuUsage))
	}
	if cpuDelta > 0 && systemDelta > 0 && onlineCPUs > 0 {
		snapshot.cpuPercent = (cpuDelta / systemDelta) * onlineCPUs * 100
	}

	for _, net := range stats.Networks {
		snapshot.networkRx += net.RxBytes
		snapshot.networkTx += net.TxBytes
	}

	return snapshot, nil
}
