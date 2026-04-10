package metrics

import (
	"context"
	"database/sql"
	"fmt"
	"sync"
	"time"

	_ "github.com/lib/pq"
)

// PostgreSQLMetricsStorage implements MetricsStorage using PostgreSQL
type PostgreSQLMetricsStorage struct {
	db *sql.DB
}

// NewPostgreSQLMetricsStorage creates a new PostgreSQL metrics storage
func NewPostgreSQLMetricsStorage(db *sql.DB) *PostgreSQLMetricsStorage {
	return &PostgreSQLMetricsStorage{db: db}
}

// StoreNodeMetrics stores node metrics in the database
func (s *PostgreSQLMetricsStorage) StoreNodeMetrics(ctx context.Context, metrics *NodeMetrics) error {
	query := `
		INSERT INTO node_metrics (
			node_id, timestamp, cpu_usage, cpu_cores, load_avg_1, load_avg_5, load_avg_15,
			memory_total, memory_used, memory_available, memory_usage_percent,
			storage_total, storage_used, storage_available, storage_usage_percent,
			network_bytes_in, network_bytes_out, network_packets_in, network_packets_out,
			network_connections_in, network_connections_out, network_errors_in, network_errors_out,
			uptime, processes, os, kernel, architecture
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28)
		ON CONFLICT (node_id, timestamp) DO UPDATE SET
			cpu_usage = EXCLUDED.cpu_usage,
			cpu_cores = EXCLUDED.cpu_cores,
			load_avg_1 = EXCLUDED.load_avg_1,
			load_avg_5 = EXCLUDED.load_avg_5,
			load_avg_15 = EXCLUDED.load_avg_15,
			memory_total = EXCLUDED.memory_total,
			memory_used = EXCLUDED.memory_used,
			memory_available = EXCLUDED.memory_available,
			memory_usage_percent = EXCLUDED.memory_usage_percent,
			storage_total = EXCLUDED.storage_total,
			storage_used = EXCLUDED.storage_used,
			storage_available = EXCLUDED.storage_available,
			storage_usage_percent = EXCLUDED.storage_usage_percent,
			network_bytes_in = EXCLUDED.network_bytes_in,
			network_bytes_out = EXCLUDED.network_bytes_out,
			network_packets_in = EXCLUDED.network_packets_in,
			network_packets_out = EXCLUDED.network_packets_out,
			network_connections_in = EXCLUDED.network_connections_in,
			network_connections_out = EXCLUDED.network_connections_out,
			network_errors_in = EXCLUDED.network_errors_in,
			network_errors_out = EXCLUDED.network_errors_out,
			uptime = EXCLUDED.uptime,
			processes = EXCLUDED.processes,
			os = EXCLUDED.os,
			kernel = EXCLUDED.kernel,
			architecture = EXCLUDED.architecture
	`

	_, err := s.db.ExecContext(ctx, query,
		metrics.NodeID, metrics.Timestamp, metrics.CPU.UsagePercent, metrics.CPU.UsageCores,
		metrics.CPU.LoadAverage1, metrics.CPU.LoadAverage5, metrics.CPU.LoadAverage15,
		metrics.Memory.Total, metrics.Memory.Used, metrics.Memory.Available, metrics.Memory.UsagePercent,
		metrics.Storage.Total, metrics.Storage.Used, metrics.Storage.Available, metrics.Storage.UsagePercent,
		metrics.Network.BytesIn, metrics.Network.BytesOut, metrics.Network.PacketsIn, metrics.Network.PacketsOut,
		metrics.Network.ConnectionsIn, metrics.Network.ConnectionsOut, metrics.Network.ErrorsIn, metrics.Network.ErrorsOut,
		metrics.System.Uptime, metrics.System.Processes, metrics.System.OS, metrics.System.Kernel, metrics.System.Architecture,
	)

	if err != nil {
		return fmt.Errorf("failed to store node metrics: %w", err)
	}

	// Store container metrics
	for _, container := range metrics.Containers {
		if err := s.storeContainerMetrics(ctx, metrics.NodeID, metrics.Timestamp, container); err != nil {
			return fmt.Errorf("failed to store container metrics: %w", err)
		}
	}

	return nil
}

// StoreServiceMetrics stores service metrics in the database
func (s *PostgreSQLMetricsStorage) StoreServiceMetrics(ctx context.Context, metrics *ServiceMetrics) error {
	query := `
		INSERT INTO service_metrics (
			service_id, service_name, project_id, timestamp,
			requests_total, requests_success, requests_errors, requests_avg_latency,
			requests_p95_latency, requests_p99_latency, requests_throughput,
			errors_total, errors_rate, performance_response_time, performance_throughput,
			performance_concurrency, performance_saturation, performance_utilization,
			resource_cpu_usage, resource_memory_usage, resource_storage_usage,
			resource_network_usage, resource_score
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
		ON CONFLICT (service_id, timestamp) DO UPDATE SET
			requests_total = EXCLUDED.requests_total,
			requests_success = EXCLUDED.requests_success,
			requests_errors = EXCLUDED.requests_errors,
			requests_avg_latency = EXCLUDED.requests_avg_latency,
			requests_p95_latency = EXCLUDED.requests_p95_latency,
			requests_p99_latency = EXCLUDED.requests_p99_latency,
			requests_throughput = EXCLUDED.requests_throughput,
			errors_total = EXCLUDED.errors_total,
			errors_rate = EXCLUDED.errors_rate,
			performance_response_time = EXCLUDED.performance_response_time,
			performance_throughput = EXCLUDED.performance_throughput,
			performance_concurrency = EXCLUDED.performance_concurrency,
			performance_saturation = EXCLUDED.performance_saturation,
			performance_utilization = EXCLUDED.performance_utilization,
			resource_cpu_usage = EXCLUDED.resource_cpu_usage,
			resource_memory_usage = EXCLUDED.resource_memory_usage,
			resource_storage_usage = EXCLUDED.resource_storage_usage,
			resource_network_usage = EXCLUDED.resource_network_usage,
			resource_score = EXCLUDED.resource_score
	`

	_, err := s.db.ExecContext(ctx, query,
		metrics.ServiceID, metrics.ServiceName, metrics.ProjectID, metrics.Timestamp,
		metrics.Requests.Total, metrics.Requests.Success, metrics.Requests.Errors,
		metrics.Requests.AvgLatency, metrics.Requests.P95Latency, metrics.Requests.P99Latency,
		metrics.Requests.Throughput, metrics.Errors.Total, metrics.Errors.Rate,
		metrics.Performance.ResponseTime, metrics.Performance.Throughput,
		metrics.Performance.Concurrency, metrics.Performance.Saturation, metrics.Performance.Utilization,
		metrics.Resources.CPUUsage, metrics.Resources.MemoryUsage, metrics.Resources.StorageUsage,
		metrics.Resources.NetworkUsage, metrics.Resources.ResourceScore,
	)

	if err != nil {
		return fmt.Errorf("failed to store service metrics: %w", err)
	}

	// Store instance metrics
	for _, instance := range metrics.Instances {
		if err := s.storeInstanceMetrics(ctx, metrics.ServiceID, metrics.Timestamp, instance); err != nil {
			return fmt.Errorf("failed to store instance metrics: %w", err)
		}
	}

	return nil
}

// GetNodeMetrics retrieves node metrics from the database
func (s *PostgreSQLMetricsStorage) GetNodeMetrics(ctx context.Context, nodeID string, from, to time.Time) ([]*NodeMetrics, error) {
	query := `
		SELECT node_id, timestamp, cpu_usage, cpu_cores, load_avg_1, load_avg_5, load_avg_15,
			   memory_total, memory_used, memory_available, memory_usage_percent,
			   storage_total, storage_used, storage_available, storage_usage_percent,
			   network_bytes_in, network_bytes_out, network_packets_in, network_packets_out,
			   network_connections_in, network_connections_out, network_errors_in, network_errors_out,
			   uptime, processes, os, kernel, architecture
		FROM node_metrics
		WHERE node_id = $1 AND timestamp BETWEEN $2 AND $3
		ORDER BY timestamp ASC
	`

	rows, err := s.db.QueryContext(ctx, query, nodeID, from, to)
	if err != nil {
		return nil, fmt.Errorf("failed to query node metrics: %w", err)
	}
	defer rows.Close()

	var metrics []*NodeMetrics
	for rows.Next() {
		var m NodeMetrics
		err := rows.Scan(
			&m.NodeID, &m.Timestamp, &m.CPU.UsagePercent, &m.CPU.UsageCores,
			&m.CPU.LoadAverage1, &m.CPU.LoadAverage5, &m.CPU.LoadAverage15,
			&m.Memory.Total, &m.Memory.Used, &m.Memory.Available, &m.Memory.UsagePercent,
			&m.Storage.Total, &m.Storage.Used, &m.Storage.Available, &m.Storage.UsagePercent,
			&m.Network.BytesIn, &m.Network.BytesOut, &m.Network.PacketsIn, &m.Network.PacketsOut,
			&m.Network.ConnectionsIn, &m.Network.ConnectionsOut, &m.Network.ErrorsIn, &m.Network.ErrorsOut,
			&m.System.Uptime, &m.System.Processes, &m.System.OS, &m.System.Kernel, &m.System.Architecture,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan node metrics: %w", err)
		}

		// Get container metrics for this timestamp
		containers, err := s.getContainerMetrics(ctx, nodeID, m.Timestamp)
		if err != nil {
			return nil, fmt.Errorf("failed to get container metrics: %w", err)
		}
		m.Containers = containers

		metrics = append(metrics, &m)
	}

	return metrics, nil
}

// GetServiceMetrics retrieves service metrics from the database
func (s *PostgreSQLMetricsStorage) GetServiceMetrics(ctx context.Context, serviceID string, from, to time.Time) ([]*ServiceMetrics, error) {
	query := `
		SELECT service_id, service_name, project_id, timestamp,
			   requests_total, requests_success, requests_errors, requests_avg_latency,
			   requests_p95_latency, requests_p99_latency, requests_throughput,
			   errors_total, errors_rate, performance_response_time, performance_throughput,
			   performance_concurrency, performance_saturation, performance_utilization,
			   resource_cpu_usage, resource_memory_usage, resource_storage_usage,
			   resource_network_usage, resource_score
		FROM service_metrics
		WHERE service_id = $1 AND timestamp BETWEEN $2 AND $3
		ORDER BY timestamp ASC
	`

	rows, err := s.db.QueryContext(ctx, query, serviceID, from, to)
	if err != nil {
		return nil, fmt.Errorf("failed to query service metrics: %w", err)
	}
	defer rows.Close()

	var metrics []*ServiceMetrics
	for rows.Next() {
		var m ServiceMetrics
		err := rows.Scan(
			&m.ServiceID, &m.ServiceName, &m.ProjectID, &m.Timestamp,
			&m.Requests.Total, &m.Requests.Success, &m.Requests.Errors,
			&m.Requests.AvgLatency, &m.Requests.P95Latency, &m.Requests.P99Latency,
			&m.Requests.Throughput, &m.Errors.Total, &m.Errors.Rate,
			&m.Performance.ResponseTime, &m.Performance.Throughput,
			&m.Performance.Concurrency, &m.Performance.Saturation, &m.Performance.Utilization,
			&m.Resources.CPUUsage, &m.Resources.MemoryUsage, &m.Resources.StorageUsage,
			&m.Resources.NetworkUsage, &m.Resources.ResourceScore,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan service metrics: %w", err)
		}

		// Get instance metrics for this timestamp
		instances, err := s.getInstanceMetrics(ctx, serviceID, m.Timestamp)
		if err != nil {
			return nil, fmt.Errorf("failed to get instance metrics: %w", err)
		}
		m.Instances = instances

		metrics = append(metrics, &m)
	}

	return metrics, nil
}

// GetAggregatedMetrics retrieves aggregated metrics based on a query
func (s *PostgreSQLMetricsStorage) GetAggregatedMetrics(ctx context.Context, query MetricsQuery) (*AggregatedMetrics, error) {
	// This is a simplified implementation
	// In a real system, you'd build dynamic SQL based on the query

	var timeSeries []TimeSeriesPoint
	var summary map[string]MetricSummary

	switch query.Type {
	case "node":
		// Aggregate node metrics
		nodeQuery := `
			SELECT 
				time_bucket($1, timestamp) AS bucket,
				AVG(cpu_usage) as avg_cpu,
				AVG(memory_usage_percent) as avg_memory,
				AVG(storage_usage_percent) as avg_storage
			FROM node_metrics
			WHERE node_id = $2 AND timestamp BETWEEN $3 AND $4
			GROUP BY bucket
			ORDER BY bucket ASC
		`

		rows, err := s.db.QueryContext(ctx, nodeQuery, query.Interval, query.ID, query.From, query.To)
		if err != nil {
			return nil, fmt.Errorf("failed to query aggregated node metrics: %w", err)
		}
		defer rows.Close()

		for rows.Next() {
			var bucket time.Time
			var avgCPU, avgMemory, avgStorage float64
			if err := rows.Scan(&bucket, &avgCPU, &avgMemory, &avgStorage); err != nil {
				return nil, fmt.Errorf("failed to scan aggregated metrics: %w", err)
			}

			point := TimeSeriesPoint{
				Timestamp: bucket,
				Values: map[string]float64{
					"cpu_usage":     avgCPU,
					"memory_usage":  avgMemory,
					"storage_usage": avgStorage,
				},
			}
			timeSeries = append(timeSeries, point)
		}

		// Calculate summary statistics
		summary = map[string]MetricSummary{
			"cpu_usage":     calculateSummary(timeSeries, "cpu_usage"),
			"memory_usage":  calculateSummary(timeSeries, "memory_usage"),
			"storage_usage": calculateSummary(timeSeries, "storage_usage"),
		}
	}

	return &AggregatedMetrics{
		Query:      query,
		TimeSeries: timeSeries,
		Summary:    summary,
	}, nil
}

// Helper methods

func (s *PostgreSQLMetricsStorage) storeContainerMetrics(ctx context.Context, nodeID string, timestamp time.Time, container ContainerMetrics) error {
	query := `
		INSERT INTO container_metrics (
			node_id, timestamp, container_id, name, state, cpu, memory,
			network_bytes_in, network_bytes_out, network_packets_in, network_packets_out, start_time
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
		ON CONFLICT (node_id, timestamp, container_id) DO UPDATE SET
			name = EXCLUDED.name,
			state = EXCLUDED.state,
			cpu = EXCLUDED.cpu,
			memory = EXCLUDED.memory,
			network_bytes_in = EXCLUDED.network_bytes_in,
			network_bytes_out = EXCLUDED.network_bytes_out,
			network_packets_in = EXCLUDED.network_packets_in,
			network_packets_out = EXCLUDED.network_packets_out,
			start_time = EXCLUDED.start_time
	`

	_, err := s.db.ExecContext(ctx, query,
		nodeID, timestamp, container.ContainerID, container.Name, container.State,
		container.CPU, container.Memory, container.Network.BytesIn, container.Network.BytesOut,
		container.Network.PacketsIn, container.Network.PacketsOut, container.StartTime,
	)

	return err
}

func (s *PostgreSQLMetricsStorage) storeInstanceMetrics(ctx context.Context, serviceID string, timestamp time.Time, instance InstanceMetrics) error {
	query := `
		INSERT INTO instance_metrics (
			service_id, timestamp, instance_id, node_id, status, cpu, memory,
			network_bytes_in, network_bytes_out, network_packets_in, network_packets_out,
			network_connections_in, network_connections_out, network_errors_in, network_errors_out,
			start_time, last_seen, health_status, health_last_check, health_check_count, health_failure_count
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
		ON CONFLICT (service_id, timestamp, instance_id) DO UPDATE SET
			node_id = EXCLUDED.node_id,
			status = EXCLUDED.status,
			cpu = EXCLUDED.cpu,
			memory = EXCLUDED.memory,
			network_bytes_in = EXCLUDED.network_bytes_in,
			network_bytes_out = EXCLUDED.network_bytes_out,
			network_packets_in = EXCLUDED.network_packets_in,
			network_packets_out = EXCLUDED.network_packets_out,
			network_connections_in = EXCLUDED.network_connections_in,
			network_connections_out = EXCLUDED.network_connections_out,
			network_errors_in = EXCLUDED.network_errors_in,
			network_errors_out = EXCLUDED.network_errors_out,
			start_time = EXCLUDED.start_time,
			last_seen = EXCLUDED.last_seen,
			health_status = EXCLUDED.health_status,
			health_last_check = EXCLUDED.health_last_check,
			health_check_count = EXCLUDED.health_check_count,
			health_failure_count = EXCLUDED.health_failure_count
	`

	_, err := s.db.ExecContext(ctx, query,
		serviceID, timestamp, instance.InstanceID, instance.NodeID, instance.Status,
		instance.CPU, instance.Memory, instance.Network.BytesIn, instance.Network.BytesOut,
		instance.Network.PacketsIn, instance.Network.PacketsOut, instance.Network.ConnectionsIn,
		instance.Network.ConnectionsOut, instance.Network.ErrorsIn, instance.Network.ErrorsOut,
		instance.StartTime, instance.LastSeen, instance.Health.Status, instance.Health.LastCheck,
		instance.Health.CheckCount, instance.Health.FailureCount,
	)

	return err
}

func (s *PostgreSQLMetricsStorage) getContainerMetrics(ctx context.Context, nodeID string, timestamp time.Time) ([]ContainerMetrics, error) {
	query := `
		SELECT container_id, name, state, cpu, memory,
			   network_bytes_in, network_bytes_out, network_packets_in, network_packets_out, start_time
		FROM container_metrics
		WHERE node_id = $1 AND timestamp = $2
	`

	rows, err := s.db.QueryContext(ctx, query, nodeID, timestamp)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var containers []ContainerMetrics
	for rows.Next() {
		var c ContainerMetrics
		err := rows.Scan(
			&c.ContainerID, &c.Name, &c.State, &c.CPU, &c.Memory,
			&c.Network.BytesIn, &c.Network.BytesOut, &c.Network.PacketsIn, &c.Network.PacketsOut, &c.StartTime,
		)
		if err != nil {
			return nil, err
		}
		containers = append(containers, c)
	}

	return containers, nil
}

func (s *PostgreSQLMetricsStorage) getInstanceMetrics(ctx context.Context, serviceID string, timestamp time.Time) ([]InstanceMetrics, error) {
	query := `
		SELECT instance_id, node_id, status, cpu, memory,
			   network_bytes_in, network_bytes_out, network_packets_in, network_packets_out,
			   network_connections_in, network_connections_out, network_errors_in, network_errors_out,
			   start_time, last_seen, health_status, health_last_check, health_check_count, health_failure_count
		FROM instance_metrics
		WHERE service_id = $1 AND timestamp = $2
	`

	rows, err := s.db.QueryContext(ctx, query, serviceID, timestamp)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var instances []InstanceMetrics
	for rows.Next() {
		var i InstanceMetrics
		err := rows.Scan(
			&i.InstanceID, &i.NodeID, &i.Status, &i.CPU, &i.Memory,
			&i.Network.BytesIn, &i.Network.BytesOut, &i.Network.PacketsIn, &i.Network.PacketsOut,
			&i.Network.ConnectionsIn, &i.Network.ConnectionsOut, &i.Network.ErrorsIn, &i.Network.ErrorsOut,
			&i.StartTime, &i.LastSeen, &i.Health.Status, &i.Health.LastCheck, &i.Health.CheckCount, &i.Health.FailureCount,
		)
		if err != nil {
			return nil, err
		}
		instances = append(instances, i)
	}

	return instances, nil
}

func calculateSummary(timeSeries []TimeSeriesPoint, metricName string) MetricSummary {
	if len(timeSeries) == 0 {
		return MetricSummary{}
	}

	var values []float64
	for _, point := range timeSeries {
		if val, exists := point.Values[metricName]; exists {
			values = append(values, val)
		}
	}

	if len(values) == 0 {
		return MetricSummary{}
	}

	// Simple calculation - in production, use proper statistics
	min := values[0]
	max := values[0]
	sum := 0.0

	for _, val := range values {
		if val < min {
			min = val
		}
		if val > max {
			max = val
		}
		sum += val
	}

	avg := sum / float64(len(values))

	return MetricSummary{
		Min:   min,
		Max:   max,
		Avg:   avg,
		Count: int64(len(values)),
		// P50, P95, P99 would require sorting and percentile calculation
		P50: avg,
		P95: avg,
		P99: avg,
	}
}

// InMemoryMetricsStorage provides an in-memory implementation for testing
type InMemoryMetricsStorage struct {
	nodeMetrics    map[string][]*NodeMetrics
	serviceMetrics map[string][]*ServiceMetrics
	mu             sync.RWMutex
}

// NewInMemoryMetricsStorage creates a new in-memory metrics storage
func NewInMemoryMetricsStorage() *InMemoryMetricsStorage {
	return &InMemoryMetricsStorage{
		nodeMetrics:    make(map[string][]*NodeMetrics),
		serviceMetrics: make(map[string][]*ServiceMetrics),
	}
}

func (s *InMemoryMetricsStorage) StoreNodeMetrics(ctx context.Context, metrics *NodeMetrics) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.nodeMetrics[metrics.NodeID] = append(s.nodeMetrics[metrics.NodeID], metrics)
	return nil
}

func (s *InMemoryMetricsStorage) StoreServiceMetrics(ctx context.Context, metrics *ServiceMetrics) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.serviceMetrics[metrics.ServiceID] = append(s.serviceMetrics[metrics.ServiceID], metrics)
	return nil
}

func (s *InMemoryMetricsStorage) GetNodeMetrics(ctx context.Context, nodeID string, from, to time.Time) ([]*NodeMetrics, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	metrics := s.nodeMetrics[nodeID]
	var result []*NodeMetrics
	for _, m := range metrics {
		if m.Timestamp.After(from) && m.Timestamp.Before(to) {
			result = append(result, m)
		}
	}
	return result, nil
}

func (s *InMemoryMetricsStorage) GetServiceMetrics(ctx context.Context, serviceID string, from, to time.Time) ([]*ServiceMetrics, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	metrics := s.serviceMetrics[serviceID]
	var result []*ServiceMetrics
	for _, m := range metrics {
		if m.Timestamp.After(from) && m.Timestamp.Before(to) {
			result = append(result, m)
		}
	}
	return result, nil
}

func (s *InMemoryMetricsStorage) GetAggregatedMetrics(ctx context.Context, query MetricsQuery) (*AggregatedMetrics, error) {
	// Simplified implementation
	return &AggregatedMetrics{
		Query:      query,
		TimeSeries: []TimeSeriesPoint{},
		Summary:    map[string]MetricSummary{},
	}, nil
}
