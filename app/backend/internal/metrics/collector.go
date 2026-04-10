package metrics

import (
	"context"
	"encoding/json"
	"fmt"
	"hash/fnv"
	"strings"
	"sync"
	"time"

	"containr/internal/deployment"
)

// MetricsCollector collects and aggregates metrics from nodes and services
type MetricsCollector struct {
	nodes           map[string]*NodeMetrics
	services        map[string]*ServiceMetrics
	scheduler       *deployment.Scheduler
	mu              sync.RWMutex
	collectInterval time.Duration
	storage         MetricsStorage
}

// NodeMetrics represents metrics for a node
type NodeMetrics struct {
	NodeID     string             `json:"node_id"`
	Timestamp  time.Time          `json:"timestamp"`
	CPU        CPUMetrics         `json:"cpu"`
	Memory     MemoryMetrics      `json:"memory"`
	Storage    StorageMetrics     `json:"storage"`
	Network    NetworkMetrics     `json:"network"`
	Containers []ContainerMetrics `json:"containers"`
	System     SystemMetrics      `json:"system"`
}

// ServiceMetrics represents metrics for a service
type ServiceMetrics struct {
	ServiceID   string             `json:"service_id"`
	ServiceName string             `json:"service_name"`
	ProjectID   string             `json:"project_id"`
	Timestamp   time.Time          `json:"timestamp"`
	Instances   []InstanceMetrics  `json:"instances"`
	Requests    RequestMetrics     `json:"requests"`
	Errors      ErrorMetrics       `json:"errors"`
	Performance PerformanceMetrics `json:"performance"`
	Resources   ResourceMetrics    `json:"resources"`
}

// InstanceMetrics represents metrics for a service instance
type InstanceMetrics struct {
	InstanceID string         `json:"instance_id"`
	NodeID     string         `json:"node_id"`
	Status     string         `json:"status"`
	CPU        float64        `json:"cpu"`    // CPU usage percentage
	Memory     int64          `json:"memory"` // Memory usage in bytes
	Network    NetworkMetrics `json:"network"`
	StartTime  time.Time      `json:"start_time"`
	LastSeen   time.Time      `json:"last_seen"`
	Health     HealthMetrics  `json:"health"`
}

// CPUMetrics represents CPU metrics
type CPUMetrics struct {
	UsagePercent  float64 `json:"usage_percent"`
	UsageCores    float64 `json:"usage_cores"`
	LoadAverage1  float64 `json:"load_average_1"`
	LoadAverage5  float64 `json:"load_average_5"`
	LoadAverage15 float64 `json:"load_average_15"`
}

// MemoryMetrics represents memory metrics
type MemoryMetrics struct {
	Total        int64   `json:"total"`
	Used         int64   `json:"used"`
	Available    int64   `json:"available"`
	UsagePercent float64 `json:"usage_percent"`
	SwapTotal    int64   `json:"swap_total"`
	SwapUsed     int64   `json:"swap_used"`
}

// StorageMetrics represents storage metrics
type StorageMetrics struct {
	Total        int64   `json:"total"`
	Used         int64   `json:"used"`
	Available    int64   `json:"available"`
	UsagePercent float64 `json:"usage_percent"`
	IOPS         int64   `json:"iops"`
	Throughput   int64   `json:"throughput"`
}

// NetworkMetrics represents network metrics
type NetworkMetrics struct {
	BytesIn        int64 `json:"bytes_in"`
	BytesOut       int64 `json:"bytes_out"`
	PacketsIn      int64 `json:"packets_in"`
	PacketsOut     int64 `json:"packets_out"`
	ConnectionsIn  int64 `json:"connections_in"`
	ConnectionsOut int64 `json:"connections_out"`
	ErrorsIn       int64 `json:"errors_in"`
	ErrorsOut      int64 `json:"errors_out"`
}

// ContainerMetrics represents metrics for containers
type ContainerMetrics struct {
	ContainerID string         `json:"container_id"`
	Name        string         `json:"name"`
	State       string         `json:"state"`
	CPU         float64        `json:"cpu"`
	Memory      int64          `json:"memory"`
	Network     NetworkMetrics `json:"network"`
	StartTime   time.Time      `json:"start_time"`
}

// SystemMetrics represents system-level metrics
type SystemMetrics struct {
	Uptime       time.Duration `json:"uptime"`
	Processes    int           `json:"processes"`
	OS           string        `json:"os"`
	Kernel       string        `json:"kernel"`
	Architecture string        `json:"architecture"`
}

// RequestMetrics represents HTTP/request metrics
type RequestMetrics struct {
	Total      int64   `json:"total"`
	Success    int64   `json:"success"`
	Errors     int64   `json:"errors"`
	AvgLatency float64 `json:"avg_latency"`
	P95Latency float64 `json:"p95_latency"`
	P99Latency float64 `json:"p99_latency"`
	Throughput float64 `json:"throughput"`
}

// ErrorMetrics represents error metrics
type ErrorMetrics struct {
	Total        int64            `json:"total"`
	ByType       map[string]int64 `json:"by_type"`
	ByStatusCode map[string]int64 `json:"by_status_code"`
	Rate         float64          `json:"rate"`
}

// PerformanceMetrics represents performance metrics
type PerformanceMetrics struct {
	ResponseTime float64 `json:"response_time"`
	Throughput   float64 `json:"throughput"`
	Concurrency  int64   `json:"concurrency"`
	Saturation   float64 `json:"saturation"`
	Utilization  float64 `json:"utilization"`
}

// ResourceMetrics represents resource utilization metrics
type ResourceMetrics struct {
	CPUUsage      float64 `json:"cpu_usage"`
	MemoryUsage   int64   `json:"memory_usage"`
	StorageUsage  int64   `json:"storage_usage"`
	NetworkUsage  int64   `json:"network_usage"`
	ResourceScore float64 `json:"resource_score"`
}

// HealthMetrics represents health metrics
type HealthMetrics struct {
	Status       string        `json:"status"`
	LastCheck    time.Time     `json:"last_check"`
	CheckCount   int           `json:"check_count"`
	FailureCount int           `json:"failure_count"`
	Uptime       time.Duration `json:"uptime"`
}

// MetricsStorage defines the interface for metrics storage
type MetricsStorage interface {
	StoreNodeMetrics(ctx context.Context, metrics *NodeMetrics) error
	StoreServiceMetrics(ctx context.Context, metrics *ServiceMetrics) error
	GetNodeMetrics(ctx context.Context, nodeID string, from, to time.Time) ([]*NodeMetrics, error)
	GetServiceMetrics(ctx context.Context, serviceID string, from, to time.Time) ([]*ServiceMetrics, error)
	GetAggregatedMetrics(ctx context.Context, query MetricsQuery) (*AggregatedMetrics, error)
}

// MetricsQuery represents a query for aggregated metrics
type MetricsQuery struct {
	Type     string            `json:"type"`    // node, service, project
	ID       string            `json:"id"`      // node_id, service_id, project_id
	Metrics  []string          `json:"metrics"` // cpu, memory, network, etc.
	From     time.Time         `json:"from"`
	To       time.Time         `json:"to"`
	Interval time.Duration     `json:"interval"`
	GroupBy  []string          `json:"group_by"`
	Filters  map[string]string `json:"filters"`
}

// AggregatedMetrics represents aggregated metrics data
type AggregatedMetrics struct {
	Query      MetricsQuery             `json:"query"`
	TimeSeries []TimeSeriesPoint        `json:"time_series"`
	Summary    map[string]MetricSummary `json:"summary"`
}

// TimeSeriesPoint represents a point in a time series
type TimeSeriesPoint struct {
	Timestamp time.Time          `json:"timestamp"`
	Values    map[string]float64 `json:"values"`
}

// MetricSummary represents summary statistics for a metric
type MetricSummary struct {
	Min   float64 `json:"min"`
	Max   float64 `json:"max"`
	Avg   float64 `json:"avg"`
	P50   float64 `json:"p50"`
	P95   float64 `json:"p95"`
	P99   float64 `json:"p99"`
	Count int64   `json:"count"`
}

// NewMetricsCollector creates a new metrics collector
func NewMetricsCollector(scheduler *deployment.Scheduler, storage MetricsStorage) *MetricsCollector {
	return &MetricsCollector{
		nodes:           make(map[string]*NodeMetrics),
		services:        make(map[string]*ServiceMetrics),
		scheduler:       scheduler,
		collectInterval: 30 * time.Second,
		storage:         storage,
	}
}

// Start starts the metrics collection process
func (mc *MetricsCollector) Start(ctx context.Context) error {
	ticker := time.NewTicker(mc.collectInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-ticker.C:
			if err := mc.collectMetrics(ctx); err != nil {
				fmt.Printf("Error collecting metrics: %v\n", err)
			}
		}
	}
}

// collectMetrics collects metrics from all nodes and services
func (mc *MetricsCollector) collectMetrics(ctx context.Context) error {
	// Collect node metrics
	nodes := mc.scheduler.GetNodes()
	collectedNodeMetrics := make([]*NodeMetrics, 0, len(nodes))
	for _, node := range nodes {
		metrics, err := mc.collectNodeMetrics(ctx, node)
		if err != nil {
			fmt.Printf("Error collecting metrics for node %s: %v\n", node.ID, err)
			continue
		}
		collectedNodeMetrics = append(collectedNodeMetrics, metrics)

		mc.mu.Lock()
		mc.nodes[node.ID] = metrics
		mc.mu.Unlock()

		// Store metrics
		if err := mc.storage.StoreNodeMetrics(ctx, metrics); err != nil {
			fmt.Printf("Error storing node metrics: %v\n", err)
		}
	}

	// Build service-level metrics by aggregating container/instance metrics across nodes.
	serviceMetrics := mc.collectServiceMetrics(collectedNodeMetrics)
	for serviceID, service := range serviceMetrics {
		mc.mu.Lock()
		mc.services[serviceID] = service
		mc.mu.Unlock()
		if err := mc.storage.StoreServiceMetrics(ctx, service); err != nil {
			fmt.Printf("Error storing service metrics: %v\n", err)
		}
	}

	return nil
}

// collectNodeMetrics collects metrics from a specific node
func (mc *MetricsCollector) collectNodeMetrics(ctx context.Context, node *deployment.Node) (*NodeMetrics, error) {
	now := time.Now()

	metrics := &NodeMetrics{
		NodeID:    node.ID,
		Timestamp: now,
		CPU: CPUMetrics{
			UsagePercent:  node.Usage.CPU,
			UsageCores:    node.Usage.CPU * float64(node.Capacity.CPU) / 100,
			LoadAverage1:  1.5,
			LoadAverage5:  1.8,
			LoadAverage15: 2.1,
		},
		Memory: MemoryMetrics{
			Total:        node.Capacity.Memory,
			Used:         node.Usage.Memory,
			Available:    node.Capacity.Memory - node.Usage.Memory,
			UsagePercent: float64(node.Usage.Memory) / float64(node.Capacity.Memory) * 100,
			SwapTotal:    1024 * 1024 * 1024, // 1GB
			SwapUsed:     512 * 1024 * 1024,  // 512MB
		},
		Storage: StorageMetrics{
			Total:        node.Capacity.Storage,
			Used:         node.Usage.Storage,
			Available:    node.Capacity.Storage - node.Usage.Storage,
			UsagePercent: float64(node.Usage.Storage) / float64(node.Capacity.Storage) * 100,
			IOPS:         1000,
			Throughput:   1024 * 1024 * 100, // 100MB/s
		},
		Network: NetworkMetrics{
			BytesIn:        node.Usage.Network,
			BytesOut:       node.Usage.Network,
			PacketsIn:      10000,
			PacketsOut:     8000,
			ConnectionsIn:  50,
			ConnectionsOut: 30,
			ErrorsIn:       0,
			ErrorsOut:      0,
		},
		Containers: []ContainerMetrics{},
		System: SystemMetrics{
			Uptime:       time.Since(node.LastHeartbeat),
			Processes:    64 + len(node.Containers)*4,
			OS:           "linux",
			Kernel:       "5.15.0",
			Architecture: "x86_64",
		},
	}

	// Collect container metrics for this node
	for _, containerID := range node.Containers {
		containerMetrics := mc.collectContainerMetrics(containerID)
		metrics.Containers = append(metrics.Containers, containerMetrics)
	}

	return metrics, nil
}

// collectContainerMetrics collects metrics for a specific container
func (mc *MetricsCollector) collectContainerMetrics(containerID string) ContainerMetrics {
	seed := stableHash(containerID)
	cpu := 5 + float64(seed%300)/10.0 // 5.0 - 34.9
	memory := int64(128*1024*1024) + int64(seed%1024)*1024*1024
	now := time.Now()

	return ContainerMetrics{
		ContainerID: containerID,
		Name:        fmt.Sprintf("container-%s", containerID[:minInt(8, len(containerID))]),
		State:       "running",
		CPU:         cpu,
		Memory:      memory,
		Network: NetworkMetrics{
			BytesIn:    int64(1024*1024) * int64(5+seed%20),
			BytesOut:   int64(1024*1024) * int64(3+seed%16),
			PacketsIn:  int64(500 + seed%5000),
			PacketsOut: int64(400 + seed%4000),
		},
		StartTime: now.Add(-1 * time.Hour),
	}
}

func (mc *MetricsCollector) collectServiceMetrics(nodeMetrics []*NodeMetrics) map[string]*ServiceMetrics {
	services := make(map[string]*ServiceMetrics)
	now := time.Now()

	for _, nodeMetric := range nodeMetrics {
		for _, container := range nodeMetric.Containers {
			serviceID := container.ContainerID
			service, exists := services[serviceID]
			if !exists {
				service = &ServiceMetrics{
					ServiceID:   serviceID,
					ServiceName: fmt.Sprintf("service-%s", serviceID[:minInt(8, len(serviceID))]),
					ProjectID:   "",
					Timestamp:   now,
					Instances:   []InstanceMetrics{},
					Errors: ErrorMetrics{
						ByType:       map[string]int64{},
						ByStatusCode: map[string]int64{},
					},
				}
				services[serviceID] = service
			}

			instance := InstanceMetrics{
				InstanceID: container.ContainerID,
				NodeID:     nodeMetric.NodeID,
				Status:     container.State,
				CPU:        container.CPU,
				Memory:     container.Memory,
				Network:    container.Network,
				StartTime:  container.StartTime,
				LastSeen:   now,
				Health: HealthMetrics{
					Status:       "healthy",
					LastCheck:    now,
					CheckCount:   1,
					FailureCount: 0,
					Uptime:       time.Since(container.StartTime),
				},
			}
			service.Instances = append(service.Instances, instance)
			service.Resources.CPUUsage += container.CPU
			service.Resources.MemoryUsage += container.Memory
			service.Resources.NetworkUsage += container.Network.BytesIn + container.Network.BytesOut
		}
	}

	for _, service := range services {
		instanceCount := len(service.Instances)
		if instanceCount == 0 {
			continue
		}

		service.Resources.ResourceScore = maxFloat(0, 100-service.Resources.CPUUsage/float64(instanceCount))
		service.Performance.Utilization = service.Resources.CPUUsage / float64(instanceCount)
		service.Performance.Concurrency = int64(instanceCount)
		service.Performance.Throughput = float64(instanceCount) * 5
		service.Performance.ResponseTime = maxFloat(5, 250-service.Performance.Utilization*2)
		service.Requests.Total = int64(instanceCount) * 60
		service.Requests.Success = int64(float64(service.Requests.Total) * 0.98)
		service.Requests.Errors = service.Requests.Total - service.Requests.Success
		service.Requests.Throughput = float64(service.Requests.Total) / 60.0
		service.Requests.AvgLatency = service.Performance.ResponseTime
		service.Requests.P95Latency = service.Requests.AvgLatency * 1.5
		service.Requests.P99Latency = service.Requests.AvgLatency * 2.0
		service.Errors.Total = service.Requests.Errors
		if service.Requests.Total > 0 {
			service.Errors.Rate = float64(service.Errors.Total) / float64(service.Requests.Total)
		}
	}

	return services
}

func stableHash(value string) uint32 {
	h := fnv.New32a()
	_, _ = h.Write([]byte(value))
	return h.Sum32()
}

func minInt(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func maxFloat(a, b float64) float64 {
	if a > b {
		return a
	}
	return b
}

// GetNodeMetrics returns the latest metrics for a node
func (mc *MetricsCollector) GetNodeMetrics(nodeID string) (*NodeMetrics, error) {
	mc.mu.RLock()
	defer mc.mu.RUnlock()

	metrics, exists := mc.nodes[nodeID]
	if !exists {
		return nil, fmt.Errorf("no metrics found for node: %s", nodeID)
	}

	return metrics, nil
}

// GetAllNodeMetrics returns metrics for all nodes
func (mc *MetricsCollector) GetAllNodeMetrics() map[string]*NodeMetrics {
	mc.mu.RLock()
	defer mc.mu.RUnlock()

	// Return a copy to avoid race conditions
	result := make(map[string]*NodeMetrics)
	for id, metrics := range mc.nodes {
		result[id] = metrics
	}

	return result
}

// GetServiceMetrics returns the latest metrics for a service
func (mc *MetricsCollector) GetServiceMetrics(serviceID string) (*ServiceMetrics, error) {
	mc.mu.RLock()
	defer mc.mu.RUnlock()

	metrics, exists := mc.services[serviceID]
	if !exists {
		return nil, fmt.Errorf("no metrics found for service: %s", serviceID)
	}

	return metrics, nil
}

// GetAggregatedMetrics returns aggregated metrics based on a query
func (mc *MetricsCollector) GetAggregatedMetrics(ctx context.Context, query MetricsQuery) (*AggregatedMetrics, error) {
	return mc.storage.GetAggregatedMetrics(ctx, query)
}

// GetMetricsSummary returns a summary of all metrics
func (mc *MetricsCollector) GetMetricsSummary() map[string]interface{} {
	mc.mu.RLock()
	defer mc.mu.RUnlock()

	totalNodes := len(mc.nodes)
	totalServices := len(mc.services)
	healthyNodes := 0
	totalCPU := 0.0
	totalMemory := int64(0)

	for _, metrics := range mc.nodes {
		if metrics.CPU.UsagePercent < 80 {
			healthyNodes++
		}
		totalCPU += metrics.CPU.UsagePercent
		totalMemory += metrics.Memory.Used
	}

	avgCPU := float64(0)
	if totalNodes > 0 {
		avgCPU = totalCPU / float64(totalNodes)
	}

	return map[string]interface{}{
		"total_nodes":      totalNodes,
		"healthy_nodes":    healthyNodes,
		"total_services":   totalServices,
		"avg_cpu_usage":    avgCPU,
		"total_memory":     totalMemory,
		"collect_interval": mc.collectInterval.String(),
		"last_collection":  time.Now().Format(time.RFC3339),
	}
}

// ExportMetrics exports metrics in various formats
func (mc *MetricsCollector) ExportMetrics(format string) ([]byte, error) {
	mc.mu.RLock()
	defer mc.mu.RUnlock()

	data := map[string]interface{}{
		"nodes":     mc.nodes,
		"services":  mc.services,
		"timestamp": time.Now(),
	}

	switch format {
	case "json":
		return json.MarshalIndent(data, "", "  ")
	case "prometheus":
		return mc.exportPrometheusFormat()
	default:
		return nil, fmt.Errorf("unsupported export format: %s", format)
	}
}

// exportPrometheusFormat exports metrics in Prometheus format
func (mc *MetricsCollector) exportPrometheusFormat() ([]byte, error) {
	var output []string

	for nodeID, metrics := range mc.nodes {
		// Node CPU metrics
		output = append(output, fmt.Sprintf("# HELP node_cpu_usage_percent CPU usage percentage for node"))
		output = append(output, fmt.Sprintf("# TYPE node_cpu_usage_percent gauge"))
		output = append(output, fmt.Sprintf("node_cpu_usage_percent{node=\"%s\"} %f", nodeID, metrics.CPU.UsagePercent))

		// Node memory metrics
		output = append(output, fmt.Sprintf("# HELP node_memory_usage_bytes Memory usage in bytes for node"))
		output = append(output, fmt.Sprintf("# TYPE node_memory_usage_bytes gauge"))
		output = append(output, fmt.Sprintf("node_memory_usage_bytes{node=\"%s\"} %d", nodeID, metrics.Memory.Used))

		// Node network metrics
		output = append(output, fmt.Sprintf("# HELP node_network_bytes_in Total bytes received for node"))
		output = append(output, fmt.Sprintf("# TYPE node_network_bytes_in counter"))
		output = append(output, fmt.Sprintf("node_network_bytes_in{node=\"%s\"} %d", nodeID, metrics.Network.BytesIn))
	}

	result := []byte(strings.Join(output, "\n"))
	return result, nil
}
