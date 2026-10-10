package metrics

import (
	"context"
	"database/sql"
	"os"
	"testing"
	"time"
)

// Live round-trip against a real Postgres — set METRICS_TEST_DSN (or
// DATABASE_URL) to enable. Skipped by default so unit runs stay hermetic.
func testDSN(t *testing.T) *sql.DB {
	t.Helper()
	dsn := os.Getenv("METRICS_TEST_DSN")
	if dsn == "" {
		dsn = os.Getenv("DATABASE_URL")
	}
	if dsn == "" {
		t.Skip("METRICS_TEST_DSN not set")
	}
	db, err := sql.Open("postgres", dsn)
	if err != nil {
		t.Fatalf("open: %v", err)
	}
	if err := db.PingContext(context.Background()); err != nil {
		t.Fatalf("ping: %v", err)
	}
	t.Cleanup(func() { db.Close() })
	return db
}

func TestPostgresStorageRoundTrip(t *testing.T) {
	db := testDSN(t)
	s := NewPostgreSQLMetricsStorage(db)
	ctx := context.Background()

	ts := time.Now().UTC().Truncate(time.Second)
	nodeID := "test-node-" + ts.Format("150405")
	svcID := "test-svc-" + ts.Format("150405")

	// Clean slate + teardown
	db.ExecContext(ctx, `DELETE FROM instance_metrics WHERE service_id = $1`, svcID)
	db.ExecContext(ctx, `DELETE FROM service_metrics WHERE service_id = $1`, svcID)
	db.ExecContext(ctx, `DELETE FROM node_metrics WHERE node_id = $1`, nodeID)
	t.Cleanup(func() {
		db.ExecContext(ctx, `DELETE FROM instance_metrics WHERE service_id = $1`, svcID)
		db.ExecContext(ctx, `DELETE FROM service_metrics WHERE service_id = $1`, svcID)
		db.ExecContext(ctx, `DELETE FROM node_metrics WHERE node_id = $1`, nodeID)
	})

	node := &NodeMetrics{
		NodeID:    nodeID,
		Timestamp: ts,
		CPU:       CPUMetrics{UsagePercent: 42.5, UsageCores: 1.7, LoadAverage1: 0.5, LoadAverage5: 0.4, LoadAverage15: 0.3},
		Memory:    MemoryMetrics{Total: 16 << 30, Used: 8 << 30, Available: 8 << 30, UsagePercent: 50.0},
		Storage:   StorageMetrics{Total: 100 << 30, Used: 40 << 30, Available: 60 << 30, UsagePercent: 40.0},
		Network:   NetworkMetrics{BytesIn: 1000, BytesOut: 2000, PacketsIn: 10, PacketsOut: 20, ConnectionsIn: 3, ConnectionsOut: 4, ErrorsIn: 0, ErrorsOut: 1},
		System:    SystemMetrics{Uptime: 3600 * time.Second, Processes: 120, OS: "linux", Kernel: "6.8", Architecture: "amd64"},
	}
	if err := s.StoreNodeMetrics(ctx, node); err != nil {
		t.Fatalf("store node: %v", err)
	}
	// Upsert idempotent on the same key.
	if err := s.StoreNodeMetrics(ctx, node); err != nil {
		t.Fatalf("store node (repeat): %v", err)
	}

	svc := &ServiceMetrics{
		ServiceID:   svcID,
		ServiceName: "svc",
		ProjectID:   "proj",
		Timestamp:   ts,
		Requests:    RequestMetrics{Total: 100, Success: 95, Errors: 5, AvgLatency: 12.5, P95Latency: 80, P99Latency: 120, Throughput: 3.3},
		Errors:      ErrorMetrics{Total: 5, Rate: 0.05},
		Performance: PerformanceMetrics{ResponseTime: 12.5, Throughput: 3.3, Concurrency: 2, Saturation: 0.4, Utilization: 0.55},
		Resources:   ResourceMetrics{CPUUsage: 42.5, MemoryUsage: 512 << 20, StorageUsage: 1 << 30, NetworkUsage: 3000, ResourceScore: 0.7},
		Instances: []InstanceMetrics{{
			InstanceID: "inst-1",
			NodeID:     nodeID,
			Status:     "running",
			CPU:        42.5,
			Memory:     512 << 20,
			Network:    NetworkMetrics{BytesIn: 1000, BytesOut: 2000},
			StartTime:  ts.Add(-time.Hour),
			LastSeen:   ts,
			Health:     HealthMetrics{Status: "healthy", LastCheck: ts, CheckCount: 10, FailureCount: 0},
		}},
	}
	if err := s.StoreServiceMetrics(ctx, svc); err != nil {
		t.Fatalf("store service: %v", err)
	}

	from, to := ts.Add(-time.Minute), ts.Add(time.Minute)
	gotNodes, err := s.GetNodeMetrics(ctx, nodeID, from, to)
	if err != nil {
		t.Fatalf("get nodes: %v", err)
	}
	if len(gotNodes) != 1 {
		t.Fatalf("want 1 node row, got %d", len(gotNodes))
	}
	if got := gotNodes[0]; got.CPU.UsagePercent != 42.5 || got.System.Processes != 120 || got.System.Uptime != time.Hour {
		t.Errorf("node round-trip mismatch: %+v", got)
	}

	gotSvcs, err := s.GetServiceMetrics(ctx, svcID, from, to)
	if err != nil {
		t.Fatalf("get services: %v", err)
	}
	if len(gotSvcs) != 1 {
		t.Fatalf("want 1 service row, got %d", len(gotSvcs))
	}
	if gotSvcs[0].Requests.P99Latency != 120 {
		t.Errorf("p99 mismatch: %v", gotSvcs[0].Requests.P99Latency)
	}
	if len(gotSvcs[0].Instances) != 1 || gotSvcs[0].Instances[0].Health.Status != "healthy" {
		t.Errorf("instance join mismatch: %+v", gotSvcs[0].Instances)
	}

	agg, err := s.GetAggregatedMetrics(ctx, MetricsQuery{Type: "node", ID: nodeID, From: from, To: to, Interval: 5 * time.Minute})
	if err != nil {
		t.Fatalf("aggregate: %v", err)
	}
	if len(agg.TimeSeries) != 1 || agg.TimeSeries[0].Values["cpu_usage"] != 42.5 {
		t.Errorf("aggregate mismatch: %+v", agg.TimeSeries)
	}
	if agg.Summary["cpu_usage"].Avg != 42.5 {
		t.Errorf("summary mismatch: %+v", agg.Summary)
	}
}
