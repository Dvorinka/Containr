package ha

import (
	"context"
	"net"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strconv"
	"testing"
	"time"

	"containr/internal/deployment"
)

func TestHealthCheckerHTTPCheck(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/health" {
			http.NotFound(w, r)
			return
		}
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	parsed, err := url.Parse(server.URL)
	if err != nil {
		t.Fatalf("failed to parse test server url: %v", err)
	}
	port := parsed.Port()
	if port == "" {
		t.Fatal("expected http test server to expose a port")
	}

	hc := &HealthChecker{}
	check := &HealthCheck{
		ID:   "check-http",
		Type: HealthCheckTypeHTTP,
		Config: HealthCheckConfig{
			Protocol: "http",
			Port:     mustAtoi(t, port),
			Path:     "/health",
			Timeout:  2 * time.Second,
		},
	}

	result := hc.performHealthCheck(context.Background(), check)
	if result.Status != HealthStatusHealthy {
		t.Fatalf("expected healthy status, got %s (%s)", result.Status, result.Message)
	}
}

func TestHealthCheckerTCPCheck(t *testing.T) {
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("failed to listen on tcp socket: %v", err)
	}
	defer ln.Close()

	port := ln.Addr().(*net.TCPAddr).Port

	hc := &HealthChecker{}
	check := &HealthCheck{
		ID:   "check-tcp",
		Type: HealthCheckTypeTCP,
		Config: HealthCheckConfig{
			Port:    port,
			Timeout: 2 * time.Second,
		},
	}

	result := hc.performHealthCheck(context.Background(), check)
	if result.Status != HealthStatusHealthy {
		t.Fatalf("expected healthy status, got %s (%s)", result.Status, result.Message)
	}
}

func TestHealthCheckerCommandCheck(t *testing.T) {
	hc := &HealthChecker{}

	okCheck := &HealthCheck{
		ID:   "check-cmd-ok",
		Type: HealthCheckTypeCommand,
		Config: HealthCheckConfig{
			Command: "exit 0",
			Timeout: 2 * time.Second,
		},
	}
	okResult := hc.performHealthCheck(context.Background(), okCheck)
	if okResult.Status != HealthStatusHealthy {
		t.Fatalf("expected healthy status for command check, got %s (%s)", okResult.Status, okResult.Message)
	}

	failCheck := &HealthCheck{
		ID:   "check-cmd-fail",
		Type: HealthCheckTypeCommand,
		Config: HealthCheckConfig{
			Command: "exit 1",
			Timeout: 2 * time.Second,
		},
	}
	failResult := hc.performHealthCheck(context.Background(), failCheck)
	if failResult.Status != HealthStatusUnhealthy {
		t.Fatalf("expected unhealthy status for failing command check, got %s", failResult.Status)
	}
}

func TestWebhookAndSlackNotifierSend(t *testing.T) {
	requests := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requests++
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	alert := &Alert{
		ID:        "alert-1",
		RuleID:    "rule-1",
		Status:    AlertStatusFiring,
		Severity:  AlertSeverityWarning,
		Message:   "cpu high",
		StartsAt:  time.Now(),
		UpdatedAt: time.Now(),
	}

	webhook := &WebhookNotifier{URL: server.URL}
	if err := webhook.Send(context.Background(), alert); err != nil {
		t.Fatalf("webhook notifier send failed: %v", err)
	}

	slack := &SlackNotifier{WebhookURL: server.URL, Channel: "#ops"}
	if err := slack.Send(context.Background(), alert); err != nil {
		t.Fatalf("slack notifier send failed: %v", err)
	}

	if requests != 2 {
		t.Fatalf("expected 2 webhook requests, got %d", requests)
	}
}

func TestAlertManagerEvaluatesUnhealthyNodesMetric(t *testing.T) {
	scheduler := deployment.NewScheduler()
	if err := scheduler.RegisterNode(&deployment.Node{ID: "node-1", Name: "node-1", Status: "ready"}); err != nil {
		t.Fatalf("failed to register node-1: %v", err)
	}
	if err := scheduler.RegisterNode(&deployment.Node{ID: "node-2", Name: "node-2", Status: "ready"}); err != nil {
		t.Fatalf("failed to register node-2: %v", err)
	}

	nodes := scheduler.GetNodes()
	if len(nodes) != 2 {
		t.Fatalf("expected 2 nodes, got %d", len(nodes))
	}
	nodes[1].LastHeartbeat = time.Now().Add(-2 * time.Minute)

	am := &AlertManager{
		scheduler:        scheduler,
		rules:            map[string]*AlertRule{},
		activeAlerts:     map[string]*Alert{},
		notifiers:        map[string]Notifier{},
		metricsCollector: nil,
	}

	rule := &AlertRule{
		ID:      "rule-1",
		Enabled: true,
		Condition: AlertCondition{
			Metric:    "unhealthy_nodes",
			Operator:  ">",
			Threshold: 0,
		},
	}

	if !am.shouldTriggerAlert(rule) {
		t.Fatalf("expected rule to trigger when unhealthy_nodes > 0")
	}
}

func TestEmailNotifierValidatesRequiredFields(t *testing.T) {
	notifier := &EmailNotifier{}
	alert := &Alert{Message: "test"}
	if err := notifier.Send(context.Background(), alert); err == nil {
		t.Fatal("expected email notifier to reject missing smtp_host")
	}
}

func TestCompareFloat(t *testing.T) {
	if !compareFloat(5, ">", 1) {
		t.Fatal("expected 5 > 1")
	}
	if !compareFloat(5, ">=", 5) {
		t.Fatal("expected 5 >= 5")
	}
	if !compareFloat(1, "<", 2) {
		t.Fatal("expected 1 < 2")
	}
	if !compareFloat(2, "<=", 2) {
		t.Fatal("expected 2 <= 2")
	}
	if !compareFloat(3, "==", 3) {
		t.Fatal("expected 3 == 3")
	}
	if !compareFloat(3, "!=", 4) {
		t.Fatal("expected 3 != 4")
	}
	if compareFloat(3, "invalid", 4) {
		t.Fatal("expected invalid operator to return false")
	}
}

func mustAtoi(t *testing.T, raw string) int {
	t.Helper()
	v, err := strconv.Atoi(raw)
	if err != nil {
		t.Fatalf("failed to convert %q to int: %v", raw, err)
	}
	return v
}
