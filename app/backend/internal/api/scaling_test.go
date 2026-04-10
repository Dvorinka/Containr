package api

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"containr/internal/deployment"
	"containr/internal/metrics"
	"containr/internal/scaling"

	"github.com/gin-gonic/gin"
)

func setupScalingTestRouter(t *testing.T) *gin.Engine {
	t.Helper()

	scheduler := deployment.NewScheduler()
	if err := scheduler.RegisterNode(&deployment.Node{
		ID:      "node-test-1",
		Name:    "node-test-1",
		Address: "127.0.0.1",
		Status:  "ready",
		Capacity: deployment.ResourceCapacity{
			CPU:     4,
			Memory:  4 * 1024 * 1024 * 1024,
			Storage: 100 * 1024 * 1024 * 1024,
			Network: 1000,
		},
	}); err != nil {
		t.Fatalf("failed to register test node: %v", err)
	}

	metricsStorage := metrics.NewInMemoryMetricsStorage()
	metricsCollector := metrics.NewMetricsCollector(scheduler, metricsStorage)
	autoScaler := scaling.NewAutoScaler(scheduler, metricsCollector)

	if err := autoScaler.SetScalingPolicy(&scaling.ScalingPolicy{
		ServiceID:   "service-1",
		MinReplicas: 1,
		MaxReplicas: 10,
		Enabled:     true,
	}); err != nil {
		t.Fatalf("failed to set scaling policy: %v", err)
	}

	gin.SetMode(gin.TestMode)
	router := gin.New()
	handler := NewScalingHandler(autoScaler)
	handler.RegisterRoutes(router.Group("/api/v1"))
	return router
}

func TestScalingHistoryReturnsHistoryPayload(t *testing.T) {
	router := setupScalingTestRouter(t)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/scaling/services/service-1/history", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, rec.Code)
	}

	var body map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if body["service_id"] != "service-1" {
		t.Fatalf("expected service_id service-1, got %v", body["service_id"])
	}
	if body["count"] != float64(0) {
		t.Fatalf("expected count 0, got %v", body["count"])
	}
}

func TestManualScaleUpdatesServiceState(t *testing.T) {
	router := setupScalingTestRouter(t)

	payload := []byte(`{"replicas":3,"reason":"ops override"}`)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/scaling/services/service-1/scale", bytes.NewReader(payload))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, rec.Code)
	}

	var body map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	event, ok := body["event"].(map[string]any)
	if !ok {
		t.Fatalf("expected event payload, got %v", body["event"])
	}
	if event["action"] != "manual_scale_up" {
		t.Fatalf("expected action manual_scale_up, got %v", event["action"])
	}

	state, ok := body["state"].(map[string]any)
	if !ok {
		t.Fatalf("expected state payload, got %v", body["state"])
	}
	if state["CurrentReplicas"] != float64(3) {
		t.Fatalf("expected current replicas 3, got %v", state["CurrentReplicas"])
	}
}

func TestScalingEventsReturnsRecentEvents(t *testing.T) {
	router := setupScalingTestRouter(t)

	scalePayload := []byte(`{"replicas":2,"reason":"ops override"}`)
	scaleReq := httptest.NewRequest(http.MethodPost, "/api/v1/scaling/services/service-1/scale", bytes.NewReader(scalePayload))
	scaleReq.Header.Set("Content-Type", "application/json")
	scaleRec := httptest.NewRecorder()
	router.ServeHTTP(scaleRec, scaleReq)
	if scaleRec.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, scaleRec.Code)
	}

	req := httptest.NewRequest(http.MethodGet, "/api/v1/scaling/events?limit=5", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, rec.Code)
	}

	var body map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if body["count"] != float64(1) {
		t.Fatalf("expected count 1, got %v", body["count"])
	}
	events, ok := body["events"].([]any)
	if !ok || len(events) != 1 {
		t.Fatalf("expected one event, got %v", body["events"])
	}
}
