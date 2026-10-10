package metrics

import (
	"context"
	"database/sql"
	"fmt"
	"strconv"
	"sync"
	"time"

	"containr/internal/database/sqlcdb"

	_ "github.com/lib/pq"
)

// PostgreSQLMetricsStorage implements MetricsStorage using PostgreSQL
// through sqlc-generated queries (sqlc/queries/metrics.sql).
//
// Per-container node metrics are deliberately not persisted: the
// container_metrics table belongs to the container_instances model and
// has no place for the node/container samples collected here. Node and
// service/instance rows map cleanly, so those are stored.
type PostgreSQLMetricsStorage struct {
	q *sqlcdb.Queries
}

// NewPostgreSQLMetricsStorage creates a new PostgreSQL metrics storage
func NewPostgreSQLMetricsStorage(db *sql.DB) *PostgreSQLMetricsStorage {
	return &PostgreSQLMetricsStorage{q: sqlcdb.New(db)}
}

func numStr(v float64) sql.NullString {
	return sql.NullString{String: strconv.FormatFloat(v, 'f', -1, 64), Valid: true}
}

func int64N(v int64) sql.NullInt64 {
	return sql.NullInt64{Int64: v, Valid: true}
}

func int32N(v int64) sql.NullInt32 {
	return sql.NullInt32{Int32: int32(v), Valid: true}
}

func strN(v string) sql.NullString {
	return sql.NullString{String: v, Valid: v != ""}
}

func timeN(t time.Time) sql.NullTime {
	return sql.NullTime{Time: t, Valid: !t.IsZero()}
}

func f64v(n sql.NullString) float64 {
	f, _ := strconv.ParseFloat(n.String, 64)
	return f
}

func i64v(n sql.NullInt64) int64 { return n.Int64 }

func i32v(n sql.NullInt32) int64 { return int64(n.Int32) }

// StoreNodeMetrics stores node metrics in the database
func (s *PostgreSQLMetricsStorage) StoreNodeMetrics(ctx context.Context, metrics *NodeMetrics) error {
	err := s.q.UpsertNodeMetrics(ctx, sqlcdb.UpsertNodeMetricsParams{
		NodeID:                metrics.NodeID,
		Timestamp:             metrics.Timestamp,
		CpuUsage:              numStr(metrics.CPU.UsagePercent),
		CpuCores:              numStr(metrics.CPU.UsageCores),
		LoadAvg1:              numStr(metrics.CPU.LoadAverage1),
		LoadAvg5:              numStr(metrics.CPU.LoadAverage5),
		LoadAvg15:             numStr(metrics.CPU.LoadAverage15),
		MemoryTotal:           int64N(metrics.Memory.Total),
		MemoryUsed:            int64N(metrics.Memory.Used),
		MemoryAvailable:       int64N(metrics.Memory.Available),
		MemoryUsagePercent:    numStr(metrics.Memory.UsagePercent),
		StorageTotal:          int64N(metrics.Storage.Total),
		StorageUsed:           int64N(metrics.Storage.Used),
		StorageAvailable:      int64N(metrics.Storage.Available),
		StorageUsagePercent:   numStr(metrics.Storage.UsagePercent),
		NetworkBytesIn:        int64N(metrics.Network.BytesIn),
		NetworkBytesOut:       int64N(metrics.Network.BytesOut),
		NetworkPacketsIn:      int64N(metrics.Network.PacketsIn),
		NetworkPacketsOut:     int64N(metrics.Network.PacketsOut),
		NetworkConnectionsIn:  int32N(metrics.Network.ConnectionsIn),
		NetworkConnectionsOut: int32N(metrics.Network.ConnectionsOut),
		NetworkErrorsIn:       int64N(metrics.Network.ErrorsIn),
		NetworkErrorsOut:      int64N(metrics.Network.ErrorsOut),
		// INTERVAL param — Postgres casts the bigint as seconds.
		Uptime:       int64N(int64(metrics.System.Uptime.Seconds())),
		Processes:    sql.NullInt32{Int32: int32(metrics.System.Processes), Valid: true},
		Os:           strN(metrics.System.OS),
		Kernel:       strN(metrics.System.Kernel),
		Architecture: strN(metrics.System.Architecture),
	})
	if err != nil {
		return fmt.Errorf("failed to store node metrics: %w", err)
	}
	return nil
}

// StoreServiceMetrics stores service metrics in the database
func (s *PostgreSQLMetricsStorage) StoreServiceMetrics(ctx context.Context, metrics *ServiceMetrics) error {
	err := s.q.UpsertServiceMetrics(ctx, sqlcdb.UpsertServiceMetricsParams{
		ServiceID:               metrics.ServiceID,
		ServiceName:             metrics.ServiceName,
		ProjectID:               metrics.ProjectID,
		Timestamp:               metrics.Timestamp,
		RequestsTotal:           int64N(metrics.Requests.Total),
		RequestsSuccess:         int64N(metrics.Requests.Success),
		RequestsErrors:          int64N(metrics.Requests.Errors),
		RequestsAvgLatency:      numStr(metrics.Requests.AvgLatency),
		RequestsP95Latency:      numStr(metrics.Requests.P95Latency),
		RequestsP99Latency:      numStr(metrics.Requests.P99Latency),
		RequestsThroughput:      numStr(metrics.Requests.Throughput),
		ErrorsTotal:             int64N(metrics.Errors.Total),
		ErrorsRate:              numStr(metrics.Errors.Rate),
		PerformanceResponseTime: numStr(metrics.Performance.ResponseTime),
		PerformanceThroughput:   numStr(metrics.Performance.Throughput),
		PerformanceConcurrency:  int64N(metrics.Performance.Concurrency),
		PerformanceSaturation:   numStr(metrics.Performance.Saturation),
		PerformanceUtilization:  numStr(metrics.Performance.Utilization),
		ResourceCpuUsage:        numStr(metrics.Resources.CPUUsage),
		ResourceMemoryUsage:     int64N(metrics.Resources.MemoryUsage),
		ResourceStorageUsage:    int64N(metrics.Resources.StorageUsage),
		ResourceNetworkUsage:    int64N(metrics.Resources.NetworkUsage),
		ResourceScore:           numStr(metrics.Resources.ResourceScore),
	})
	if err != nil {
		return fmt.Errorf("failed to store service metrics: %w", err)
	}

	// The service row must land first — instance_metrics references
	// service_metrics(service_id, timestamp).
	for _, instance := range metrics.Instances {
		if err := s.storeInstanceMetrics(ctx, metrics.ServiceID, metrics.Timestamp, instance); err != nil {
			return fmt.Errorf("failed to store instance metrics: %w", err)
		}
	}
	return nil
}

// GetNodeMetrics retrieves node metrics from the database
func (s *PostgreSQLMetricsStorage) GetNodeMetrics(ctx context.Context, nodeID string, from, to time.Time) ([]*NodeMetrics, error) {
	rows, err := s.q.ListNodeMetrics(ctx, sqlcdb.ListNodeMetricsParams{
		NodeID:      nodeID,
		Timestamp:   from,
		Timestamp_2: to,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to query node metrics: %w", err)
	}

	var metrics []*NodeMetrics
	for _, r := range rows {
		metrics = append(metrics, &NodeMetrics{
			NodeID:    r.NodeID,
			Timestamp: r.Timestamp,
			CPU: CPUMetrics{
				UsagePercent:  f64v(r.CpuUsage),
				UsageCores:    f64v(r.CpuCores),
				LoadAverage1:  f64v(r.LoadAvg1),
				LoadAverage5:  f64v(r.LoadAvg5),
				LoadAverage15: f64v(r.LoadAvg15),
			},
			Memory: MemoryMetrics{
				Total:        i64v(r.MemoryTotal),
				Used:         i64v(r.MemoryUsed),
				Available:    i64v(r.MemoryAvailable),
				UsagePercent: f64v(r.MemoryUsagePercent),
			},
			Storage: StorageMetrics{
				Total:        i64v(r.StorageTotal),
				Used:         i64v(r.StorageUsed),
				Available:    i64v(r.StorageAvailable),
				UsagePercent: f64v(r.StorageUsagePercent),
			},
			Network: NetworkMetrics{
				BytesIn:        i64v(r.NetworkBytesIn),
				BytesOut:       i64v(r.NetworkBytesOut),
				PacketsIn:      i64v(r.NetworkPacketsIn),
				PacketsOut:     i64v(r.NetworkPacketsOut),
				ConnectionsIn:  i32v(r.NetworkConnectionsIn),
				ConnectionsOut: i32v(r.NetworkConnectionsOut),
				ErrorsIn:       i64v(r.NetworkErrorsIn),
				ErrorsOut:      i64v(r.NetworkErrorsOut),
			},
			System: SystemMetrics{
				Uptime:       time.Duration(r.UptimeSeconds) * time.Second,
				Processes:    int(r.Processes.Int32),
				OS:           r.Os.String,
				Kernel:       r.Kernel.String,
				Architecture: r.Architecture.String,
			},
		})
	}
	return metrics, nil
}

// GetServiceMetrics retrieves service metrics from the database
func (s *PostgreSQLMetricsStorage) GetServiceMetrics(ctx context.Context, serviceID string, from, to time.Time) ([]*ServiceMetrics, error) {
	rows, err := s.q.ListServiceMetrics(ctx, sqlcdb.ListServiceMetricsParams{
		ServiceID:   serviceID,
		Timestamp:   from,
		Timestamp_2: to,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to query service metrics: %w", err)
	}

	var metrics []*ServiceMetrics
	for _, r := range rows {
		m := &ServiceMetrics{
			ServiceID:   r.ServiceID,
			ServiceName: r.ServiceName,
			ProjectID:   r.ProjectID,
			Timestamp:   r.Timestamp,
			Requests: RequestMetrics{
				Total:      i64v(r.RequestsTotal),
				Success:    i64v(r.RequestsSuccess),
				Errors:     i64v(r.RequestsErrors),
				AvgLatency: f64v(r.RequestsAvgLatency),
				P95Latency: f64v(r.RequestsP95Latency),
				P99Latency: f64v(r.RequestsP99Latency),
				Throughput: f64v(r.RequestsThroughput),
			},
			Errors: ErrorMetrics{
				Total: i64v(r.ErrorsTotal),
				Rate:  f64v(r.ErrorsRate),
			},
			Performance: PerformanceMetrics{
				ResponseTime: f64v(r.PerformanceResponseTime),
				Throughput:   f64v(r.PerformanceThroughput),
				Concurrency:  i64v(r.PerformanceConcurrency),
				Saturation:   f64v(r.PerformanceSaturation),
				Utilization:  f64v(r.PerformanceUtilization),
			},
			Resources: ResourceMetrics{
				CPUUsage:      f64v(r.ResourceCpuUsage),
				MemoryUsage:   i64v(r.ResourceMemoryUsage),
				StorageUsage:  i64v(r.ResourceStorageUsage),
				NetworkUsage:  i64v(r.ResourceNetworkUsage),
				ResourceScore: f64v(r.ResourceScore),
			},
		}

		instances, err := s.getInstanceMetrics(ctx, serviceID, r.Timestamp)
		if err != nil {
			return nil, fmt.Errorf("failed to get instance metrics: %w", err)
		}
		m.Instances = instances
		metrics = append(metrics, m)
	}
	return metrics, nil
}

// GetAggregatedMetrics retrieves aggregated metrics based on a query.
// Bucketing uses date_bin (PostgreSQL 14+) — no TimescaleDB needed.
func (s *PostgreSQLMetricsStorage) GetAggregatedMetrics(ctx context.Context, query MetricsQuery) (*AggregatedMetrics, error) {
	var timeSeries []TimeSeriesPoint
	var summary map[string]MetricSummary

	switch query.Type {
	case "node":
		seconds := int64(query.Interval.Seconds())
		if seconds <= 0 {
			seconds = 300
		}
		rows, err := s.q.AggregateNodeMetrics(ctx, sqlcdb.AggregateNodeMetricsParams{
			Column1:     seconds,
			NodeID:      query.ID,
			Timestamp:   query.From,
			Timestamp_2: query.To,
		})
		if err != nil {
			return nil, fmt.Errorf("failed to query aggregated node metrics: %w", err)
		}
		for _, r := range rows {
			bucket, _ := r.Bucket.(time.Time)
			timeSeries = append(timeSeries, TimeSeriesPoint{
				Timestamp: bucket,
				Values: map[string]float64{
					"cpu_usage":     r.AvgCpu,
					"memory_usage":  r.AvgMemory,
					"storage_usage": r.AvgStorage,
				},
			})
		}
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

func (s *PostgreSQLMetricsStorage) storeInstanceMetrics(ctx context.Context, serviceID string, timestamp time.Time, instance InstanceMetrics) error {
	return s.q.UpsertInstanceMetrics(ctx, sqlcdb.UpsertInstanceMetricsParams{
		ServiceID:             serviceID,
		Timestamp:             timestamp,
		InstanceID:            instance.InstanceID,
		NodeID:                strN(instance.NodeID),
		Status:                strN(instance.Status),
		Cpu:                   numStr(instance.CPU),
		Memory:                int64N(instance.Memory),
		NetworkBytesIn:        int64N(instance.Network.BytesIn),
		NetworkBytesOut:       int64N(instance.Network.BytesOut),
		NetworkPacketsIn:      int64N(instance.Network.PacketsIn),
		NetworkPacketsOut:     int64N(instance.Network.PacketsOut),
		NetworkConnectionsIn:  int32N(instance.Network.ConnectionsIn),
		NetworkConnectionsOut: int32N(instance.Network.ConnectionsOut),
		NetworkErrorsIn:       int64N(instance.Network.ErrorsIn),
		NetworkErrorsOut:      int64N(instance.Network.ErrorsOut),
		StartTime:             timeN(instance.StartTime),
		LastSeen:              timeN(instance.LastSeen),
		HealthStatus:          strN(instance.Health.Status),
		HealthLastCheck:       timeN(instance.Health.LastCheck),
		HealthCheckCount:      sql.NullInt32{Int32: int32(instance.Health.CheckCount), Valid: true},
		HealthFailureCount:    sql.NullInt32{Int32: int32(instance.Health.FailureCount), Valid: true},
	})
}

func (s *PostgreSQLMetricsStorage) getInstanceMetrics(ctx context.Context, serviceID string, timestamp time.Time) ([]InstanceMetrics, error) {
	rows, err := s.q.ListInstanceMetrics(ctx, sqlcdb.ListInstanceMetricsParams{
		ServiceID: serviceID,
		Timestamp: timestamp,
	})
	if err != nil {
		return nil, err
	}

	var instances []InstanceMetrics
	for _, r := range rows {
		instances = append(instances, InstanceMetrics{
			InstanceID: r.InstanceID,
			NodeID:     r.NodeID.String,
			Status:     r.Status.String,
			CPU:        f64v(r.Cpu),
			Memory:     i64v(r.Memory),
			Network: NetworkMetrics{
				BytesIn:        i64v(r.NetworkBytesIn),
				BytesOut:       i64v(r.NetworkBytesOut),
				PacketsIn:      i64v(r.NetworkPacketsIn),
				PacketsOut:     i64v(r.NetworkPacketsOut),
				ConnectionsIn:  i32v(r.NetworkConnectionsIn),
				ConnectionsOut: i32v(r.NetworkConnectionsOut),
				ErrorsIn:       i64v(r.NetworkErrorsIn),
				ErrorsOut:      i64v(r.NetworkErrorsOut),
			},
			StartTime: r.StartTime.Time,
			LastSeen:  r.LastSeen.Time,
			Health: HealthMetrics{
				Status:       r.HealthStatus.String,
				LastCheck:    r.HealthLastCheck.Time,
				CheckCount:   int(r.HealthCheckCount.Int32),
				FailureCount: int(r.HealthFailureCount.Int32),
			},
		})
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
	s.mu.RLock()
	defer s.mu.RUnlock()

	return &AggregatedMetrics{
		Query:      query,
		TimeSeries: []TimeSeriesPoint{},
		Summary:    map[string]MetricSummary{},
	}, nil
}
