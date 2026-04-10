package ha

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net"
	"net/http"
	"net/smtp"
	"os/exec"
	"strconv"
	"strings"
	"sync"
	"time"

	"containr/internal/deployment"
	"containr/internal/metrics"
)

// HighAvailabilityManager manages high availability features
type HighAvailabilityManager struct {
	scheduler         *deployment.Scheduler
	metricsCollector  *metrics.MetricsCollector
	failoverManager   *FailoverManager
	healthChecker     *HealthChecker
	alertManager      *AlertManager
	mu                sync.RWMutex
	enabled           bool
	checkInterval     time.Duration
	failoverThreshold int
}

// FailoverManager handles service failover operations
type FailoverManager struct {
	scheduler        *deployment.Scheduler
	failoverPolicies map[string]*FailoverPolicy
	mu               sync.RWMutex
}

// FailoverPolicy defines failover behavior for a service
type FailoverPolicy struct {
	ServiceID         string             `json:"service_id"`
	Enabled           bool               `json:"enabled"`
	MinHealthyNodes   int                `json:"min_healthy_nodes"`
	MaxFailures       int                `json:"max_failures"`
	FailoverTimeout   time.Duration      `json:"failover_timeout"`
	RecoveryTimeout   time.Duration      `json:"recovery_timeout"`
	FailoverStrategy  FailoverStrategy   `json:"failover_strategy"`
	BackupNodes       []string           `json:"backup_nodes"`
	HealthCheckConfig *HealthCheckConfig `json:"health_check_config"`
}

// FailoverStrategy defines how failover is performed
type FailoverStrategy string

const (
	FailoverStrategyActivePassive FailoverStrategy = "active_passive"
	FailoverStrategyActiveActive  FailoverStrategy = "active_active"
	FailoverStrategyGraceful      FailoverStrategy = "graceful"
)

// HealthCheckConfig defines health check parameters
type HealthCheckConfig struct {
	Interval           time.Duration `json:"interval"`
	Timeout            time.Duration `json:"timeout"`
	UnhealthyThreshold int           `json:"unhealthy_threshold"`
	HealthyThreshold   int           `json:"healthy_threshold"`
	Path               string        `json:"path"`
	Port               int           `json:"port"`
	Protocol           string        `json:"protocol"`
	Command            string        `json:"command,omitempty"`
}

// HealthChecker performs health checks on services and nodes
type HealthChecker struct {
	scheduler     *deployment.Scheduler
	checks        map[string]*HealthCheck
	results       map[string]*HealthCheckResult
	mu            sync.RWMutex
	checkInterval time.Duration
}

// HealthCheck represents a health check configuration
type HealthCheck struct {
	ID        string            `json:"id"`
	ServiceID string            `json:"service_id"`
	NodeID    string            `json:"node_id"`
	Type      HealthCheckType   `json:"type"`
	Config    HealthCheckConfig `json:"config"`
	LastCheck time.Time         `json:"last_check"`
	Status    HealthStatus      `json:"status"`
}

// HealthCheckType represents the type of health check
type HealthCheckType string

const (
	HealthCheckTypeHTTP    HealthCheckType = "http"
	HealthCheckTypeTCP     HealthCheckType = "tcp"
	HealthCheckTypeCommand HealthCheckType = "command"
)

// HealthStatus represents the health status
type HealthStatus string

const (
	HealthStatusHealthy   HealthStatus = "healthy"
	HealthStatusUnhealthy HealthStatus = "unhealthy"
	HealthStatusUnknown   HealthStatus = "unknown"
)

// HealthCheckResult represents the result of a health check
type HealthCheckResult struct {
	CheckID   string        `json:"check_id"`
	Status    HealthStatus  `json:"status"`
	Message   string        `json:"message"`
	Latency   time.Duration `json:"latency"`
	Timestamp time.Time     `json:"timestamp"`
	ErrorCode string        `json:"error_code,omitempty"`
}

// AlertManager handles alerting and notifications
type AlertManager struct {
	scheduler        *deployment.Scheduler
	metricsCollector *metrics.MetricsCollector
	rules            map[string]*AlertRule
	activeAlerts     map[string]*Alert
	notifiers        map[string]Notifier
	mu               sync.RWMutex
}

// AlertRule defines when alerts should be triggered
type AlertRule struct {
	ID          string            `json:"id"`
	Name        string            `json:"name"`
	Description string            `json:"description"`
	Enabled     bool              `json:"enabled"`
	Condition   AlertCondition    `json:"condition"`
	Severity    AlertSeverity     `json:"severity"`
	Labels      map[string]string `json:"labels"`
	Annotations map[string]string `json:"annotations"`
	Notifiers   []string          `json:"notifiers"`
	Cooldown    time.Duration     `json:"cooldown"`
}

// AlertCondition defines the condition for triggering an alert
type AlertCondition struct {
	Metric    string        `json:"metric"`
	Operator  string        `json:"operator"` // >, <, >=, <=, ==, !=
	Threshold float64       `json:"threshold"`
	Duration  time.Duration `json:"duration"`
}

// AlertSeverity represents the severity level of an alert
type AlertSeverity string

const (
	AlertSeverityCritical AlertSeverity = "critical"
	AlertSeverityWarning  AlertSeverity = "warning"
	AlertSeverityInfo     AlertSeverity = "info"
)

// Alert represents an active alert
type Alert struct {
	ID          string            `json:"id"`
	RuleID      string            `json:"rule_id"`
	Status      AlertStatus       `json:"status"`
	Severity    AlertSeverity     `json:"severity"`
	Message     string            `json:"message"`
	Labels      map[string]string `json:"labels"`
	Annotations map[string]string `json:"annotations"`
	StartsAt    time.Time         `json:"starts_at"`
	EndsAt      *time.Time        `json:"ends_at,omitempty"`
	UpdatedAt   time.Time         `json:"updated_at"`
}

// AlertStatus represents the status of an alert
type AlertStatus string

const (
	AlertStatusFiring   AlertStatus = "firing"
	AlertStatusResolved AlertStatus = "resolved"
)

// Notifier sends alert notifications
type Notifier interface {
	Send(ctx context.Context, alert *Alert) error
	Type() string
}

// NewHighAvailabilityManager creates a new HA manager
func NewHighAvailabilityManager(scheduler *deployment.Scheduler, metricsCollector *metrics.MetricsCollector) *HighAvailabilityManager {
	failoverManager := &FailoverManager{
		scheduler:        scheduler,
		failoverPolicies: make(map[string]*FailoverPolicy),
	}

	healthChecker := &HealthChecker{
		scheduler:     scheduler,
		checks:        make(map[string]*HealthCheck),
		results:       make(map[string]*HealthCheckResult),
		checkInterval: 30 * time.Second,
	}

	alertManager := &AlertManager{
		scheduler:        scheduler,
		metricsCollector: metricsCollector,
		rules:            make(map[string]*AlertRule),
		activeAlerts:     make(map[string]*Alert),
		notifiers:        make(map[string]Notifier),
	}

	return &HighAvailabilityManager{
		scheduler:         scheduler,
		metricsCollector:  metricsCollector,
		failoverManager:   failoverManager,
		healthChecker:     healthChecker,
		alertManager:      alertManager,
		enabled:           true,
		checkInterval:     30 * time.Second,
		failoverThreshold: 3,
	}
}

// Start starts the HA management process
func (ha *HighAvailabilityManager) Start(ctx context.Context) error {
	ticker := time.NewTicker(ha.checkInterval)
	defer ticker.Stop()

	log.Printf("HighAvailabilityManager started with check interval: %v", ha.checkInterval)

	// Start health checker
	go ha.healthChecker.Start(ctx)

	// Start alert manager
	go ha.alertManager.Start(ctx)

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-ticker.C:
			if ha.enabled {
				if err := ha.checkHighAvailability(ctx); err != nil {
					log.Printf("Error during HA check: %v", err)
				}
			}
		}
	}
}

// checkHighAvailability performs HA checks and takes action if needed
func (ha *HighAvailabilityManager) checkHighAvailability(ctx context.Context) error {
	// Check node health
	nodes := ha.scheduler.GetNodes()
	unhealthyNodes := 0

	for _, node := range nodes {
		if !ha.isNodeHealthy(node) {
			unhealthyNodes++
			log.Printf("Node %s is unhealthy", node.ID)
		}
	}

	// Trigger failover if too many nodes are unhealthy
	if unhealthyNodes >= ha.failoverThreshold {
		log.Printf("Failover threshold reached: %d unhealthy nodes", unhealthyNodes)
		if err := ha.failoverManager.TriggerFailover(ctx, "node_failure"); err != nil {
			return fmt.Errorf("failed to trigger failover: %w", err)
		}
	}

	return nil
}

// isNodeHealthy checks if a node is healthy
func (ha *HighAvailabilityManager) isNodeHealthy(node *deployment.Node) bool {
	// Check if node is ready
	if node.Status != "ready" {
		return false
	}

	// Check heartbeat
	if time.Since(node.LastHeartbeat) > 2*time.Minute {
		return false
	}

	// Check resource usage
	if node.Usage.CPU > 95 || node.Usage.Memory > int64(float64(node.Capacity.Memory)*0.95) {
		return false
	}

	return true
}

// SetFailoverPolicy sets or updates a failover policy
func (ha *HighAvailabilityManager) SetFailoverPolicy(policy *FailoverPolicy) error {
	ha.mu.Lock()
	defer ha.mu.Unlock()

	ha.failoverManager.SetFailoverPolicy(policy)
	return nil
}

// GetFailoverPolicy returns a failover policy
func (ha *HighAvailabilityManager) GetFailoverPolicy(serviceID string) (*FailoverPolicy, error) {
	ha.mu.RLock()
	defer ha.mu.RUnlock()

	return ha.failoverManager.GetFailoverPolicy(serviceID)
}

// GetAllFailoverPolicies returns all configured failover policies.
func (ha *HighAvailabilityManager) GetAllFailoverPolicies() map[string]*FailoverPolicy {
	ha.mu.RLock()
	defer ha.mu.RUnlock()
	return ha.failoverManager.GetAllFailoverPolicies()
}

// TriggerFailover manually triggers a failover
func (ha *HighAvailabilityManager) TriggerFailover(ctx context.Context, reason string) error {
	return ha.failoverManager.TriggerFailover(ctx, reason)
}

// AddHealthCheck adds or replaces a health check definition.
func (ha *HighAvailabilityManager) AddHealthCheck(check *HealthCheck) {
	ha.healthChecker.AddHealthCheck(check)
}

// RemoveHealthCheck removes a health check definition.
func (ha *HighAvailabilityManager) RemoveHealthCheck(checkID string) {
	ha.healthChecker.RemoveHealthCheck(checkID)
}

// GetHealthCheck returns a health check by ID.
func (ha *HighAvailabilityManager) GetHealthCheck(checkID string) (*HealthCheck, bool) {
	return ha.healthChecker.GetHealthCheck(checkID)
}

// GetAllHealthChecks returns all configured health checks.
func (ha *HighAvailabilityManager) GetAllHealthChecks() map[string]*HealthCheck {
	return ha.healthChecker.GetAllHealthChecks()
}

// GetAllHealthResults returns all latest health check results.
func (ha *HighAvailabilityManager) GetAllHealthResults() map[string]*HealthCheckResult {
	return ha.healthChecker.GetAllResults()
}

// AddAlertRule adds or replaces an alert rule.
func (ha *HighAvailabilityManager) AddAlertRule(rule *AlertRule) {
	ha.alertManager.AddAlertRule(rule)
}

// RemoveAlertRule removes an alert rule by ID.
func (ha *HighAvailabilityManager) RemoveAlertRule(ruleID string) {
	ha.alertManager.RemoveAlertRule(ruleID)
}

// GetAlertRule returns one alert rule by ID.
func (ha *HighAvailabilityManager) GetAlertRule(ruleID string) (*AlertRule, bool) {
	return ha.alertManager.GetAlertRuleByID(ruleID)
}

// GetAllAlertRules returns all configured alert rules.
func (ha *HighAvailabilityManager) GetAllAlertRules() map[string]*AlertRule {
	return ha.alertManager.GetAllAlertRules()
}

// AddNotifier registers a notifier by ID.
func (ha *HighAvailabilityManager) AddNotifier(id string, notifier Notifier) {
	ha.alertManager.AddNotifier(id, notifier)
}

// RemoveNotifier removes a notifier by ID.
func (ha *HighAvailabilityManager) RemoveNotifier(id string) {
	ha.alertManager.RemoveNotifier(id)
}

// GetNotifier returns a notifier by ID.
func (ha *HighAvailabilityManager) GetNotifier(id string) (Notifier, bool) {
	return ha.alertManager.GetNotifier(id)
}

// GetAllNotifiers returns all registered notifiers.
func (ha *HighAvailabilityManager) GetAllNotifiers() map[string]Notifier {
	return ha.alertManager.GetAllNotifiers()
}

// ResolveAlert resolves and removes an active alert.
func (ha *HighAvailabilityManager) ResolveAlert(alertID string) {
	ha.alertManager.ResolveAlert(alertID)
}

// GetActiveAlerts returns all currently active alerts.
func (ha *HighAvailabilityManager) GetActiveAlerts() map[string]*Alert {
	return ha.alertManager.GetActiveAlerts()
}

// GetHealthStatus returns the health status of all services and nodes
func (ha *HighAvailabilityManager) GetHealthStatus() map[string]interface{} {
	ha.mu.RLock()
	defer ha.mu.RUnlock()

	nodes := ha.scheduler.GetNodes()
	healthyNodes := 0
	unhealthyNodes := 0

	for _, node := range nodes {
		if ha.isNodeHealthy(node) {
			healthyNodes++
		} else {
			unhealthyNodes++
		}
	}

	healthChecks := ha.healthChecker.GetAllHealthChecks()
	healthyChecks := 0
	unhealthyChecks := 0

	for _, result := range ha.healthChecker.GetAllResults() {
		if result.Status == HealthStatusHealthy {
			healthyChecks++
		} else {
			unhealthyChecks++
		}
	}

	activeAlerts := ha.alertManager.GetActiveAlerts()

	return map[string]interface{}{
		"nodes": map[string]interface{}{
			"total":     len(nodes),
			"healthy":   healthyNodes,
			"unhealthy": unhealthyNodes,
		},
		"health_checks": map[string]interface{}{
			"total":     len(healthChecks),
			"healthy":   healthyChecks,
			"unhealthy": unhealthyChecks,
		},
		"alerts": map[string]interface{}{
			"active": len(activeAlerts),
		},
		"enabled": ha.enabled,
	}
}

// Enable enables the HA manager
func (ha *HighAvailabilityManager) Enable() {
	ha.mu.Lock()
	defer ha.mu.Unlock()
	ha.enabled = true
}

// Disable disables the HA manager
func (ha *HighAvailabilityManager) Disable() {
	ha.mu.Lock()
	defer ha.mu.Unlock()
	ha.enabled = false
}

// IsEnabled returns whether the HA manager is enabled
func (ha *HighAvailabilityManager) IsEnabled() bool {
	ha.mu.RLock()
	defer ha.mu.RUnlock()
	return ha.enabled
}

// FailoverManager methods

// SetFailoverPolicy sets a failover policy
func (fm *FailoverManager) SetFailoverPolicy(policy *FailoverPolicy) {
	fm.mu.Lock()
	defer fm.mu.Unlock()
	fm.failoverPolicies[policy.ServiceID] = policy
}

// GetFailoverPolicy returns a failover policy
func (fm *FailoverManager) GetFailoverPolicy(serviceID string) (*FailoverPolicy, error) {
	fm.mu.RLock()
	defer fm.mu.RUnlock()

	policy, exists := fm.failoverPolicies[serviceID]
	if !exists {
		return nil, fmt.Errorf("no failover policy found for service: %s", serviceID)
	}

	return policy, nil
}

// GetAllFailoverPolicies returns a shallow copy of all policies.
func (fm *FailoverManager) GetAllFailoverPolicies() map[string]*FailoverPolicy {
	fm.mu.RLock()
	defer fm.mu.RUnlock()

	result := make(map[string]*FailoverPolicy, len(fm.failoverPolicies))
	for id, policy := range fm.failoverPolicies {
		result[id] = policy
	}
	return result
}

// TriggerFailover triggers a failover for affected services
func (fm *FailoverManager) TriggerFailover(ctx context.Context, reason string) error {
	fm.mu.RLock()
	policies := make([]*FailoverPolicy, 0, len(fm.failoverPolicies))
	for _, policy := range fm.failoverPolicies {
		if policy.Enabled {
			policies = append(policies, policy)
		}
	}
	fm.mu.RUnlock()

	for _, policy := range policies {
		if err := fm.performFailover(ctx, policy, reason); err != nil {
			log.Printf("Failed to perform failover for service %s: %v", policy.ServiceID, err)
		}
	}

	return nil
}

// performFailover performs failover for a specific service
func (fm *FailoverManager) performFailover(ctx context.Context, policy *FailoverPolicy, reason string) error {
	log.Printf("Performing failover for service %s: %s", policy.ServiceID, reason)
	readyNodes := fm.scheduler.GetReadyNodes()
	if len(readyNodes) == 0 {
		return fmt.Errorf("no healthy nodes available for failover")
	}

	readyByID := make(map[string]struct{}, len(readyNodes))
	for _, node := range readyNodes {
		readyByID[node.ID] = struct{}{}
	}

	eligibleNodes := make([]string, 0, len(policy.BackupNodes))
	for _, backupNode := range policy.BackupNodes {
		if _, ok := readyByID[backupNode]; ok {
			eligibleNodes = append(eligibleNodes, backupNode)
		}
	}

	if len(eligibleNodes) == 0 {
		return fmt.Errorf("no configured backup nodes are currently healthy")
	}

	select {
	case <-ctx.Done():
		return ctx.Err()
	default:
	}

	log.Printf(
		"Failover planned for service %s using strategy=%s, eligible_backup_nodes=%v",
		policy.ServiceID,
		policy.FailoverStrategy,
		eligibleNodes,
	)
	return nil
}

// HealthChecker methods

// Start starts the health checker
func (hc *HealthChecker) Start(ctx context.Context) error {
	ticker := time.NewTicker(hc.checkInterval)
	defer ticker.Stop()

	log.Printf("HealthChecker started with check interval: %v", hc.checkInterval)

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-ticker.C:
			if err := hc.performHealthChecks(ctx); err != nil {
				log.Printf("Error during health checks: %v", err)
			}
		}
	}
}

// performHealthChecks performs all configured health checks
func (hc *HealthChecker) performHealthChecks(ctx context.Context) error {
	hc.mu.RLock()
	checks := make([]*HealthCheck, 0, len(hc.checks))
	for _, check := range hc.checks {
		checks = append(checks, check)
	}
	hc.mu.RUnlock()

	for _, check := range checks {
		result := hc.performHealthCheck(ctx, check)
		hc.mu.Lock()
		hc.results[check.ID] = result
		hc.mu.Unlock()
	}

	return nil
}

// performHealthCheck performs a single health check
func (hc *HealthChecker) performHealthCheck(ctx context.Context, check *HealthCheck) *HealthCheckResult {
	start := time.Now()
	result := &HealthCheckResult{
		CheckID:   check.ID,
		Timestamp: start,
		Status:    HealthStatusUnknown,
	}
	timeout := check.Config.Timeout
	if timeout <= 0 {
		timeout = 5 * time.Second
	}
	checkCtx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	var err error
	switch check.Type {
	case HealthCheckTypeHTTP:
		err = hc.performHTTPCheck(checkCtx, check)
	case HealthCheckTypeTCP:
		err = hc.performTCPCheck(checkCtx, check)
	case HealthCheckTypeCommand:
		err = hc.performCommandCheck(checkCtx, check)
	default:
		err = fmt.Errorf("unsupported health check type: %s", check.Type)
	}

	if err != nil {
		result.Status = HealthStatusUnhealthy
		result.Message = err.Error()
		result.ErrorCode = "CHECK_FAILED"
	} else {
		result.Status = HealthStatusHealthy
		result.Message = "Service is healthy"
	}

	result.Latency = time.Since(start)
	return result
}

func (hc *HealthChecker) performHTTPCheck(ctx context.Context, check *HealthCheck) error {
	host := hc.resolveHealthCheckHost(check)
	protocol := strings.ToLower(strings.TrimSpace(check.Config.Protocol))
	if protocol == "" {
		protocol = "http"
	}
	port := check.Config.Port
	if port <= 0 {
		if protocol == "https" {
			port = 443
		} else {
			port = 80
		}
	}
	path := strings.TrimSpace(check.Config.Path)
	if path == "" {
		path = "/"
	}
	if !strings.HasPrefix(path, "/") {
		path = "/" + path
	}

	url := fmt.Sprintf("%s://%s:%d%s", protocol, host, port, path)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return fmt.Errorf("failed to build health request: %w", err)
	}

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("http health check failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 400 {
		return fmt.Errorf("http health check returned status %d", resp.StatusCode)
	}

	return nil
}

func (hc *HealthChecker) performTCPCheck(ctx context.Context, check *HealthCheck) error {
	host := hc.resolveHealthCheckHost(check)
	port := check.Config.Port
	if port <= 0 {
		port = 80
	}
	address := net.JoinHostPort(host, strconv.Itoa(port))

	dialer := &net.Dialer{}
	conn, err := dialer.DialContext(ctx, "tcp", address)
	if err != nil {
		return fmt.Errorf("tcp health check failed: %w", err)
	}
	_ = conn.Close()
	return nil
}

func (hc *HealthChecker) performCommandCheck(ctx context.Context, check *HealthCheck) error {
	cmdText := strings.TrimSpace(check.Config.Command)
	if cmdText == "" {
		// Backward compatibility with existing payloads that may pass command in path.
		cmdText = strings.TrimSpace(check.Config.Path)
	}
	if cmdText == "" {
		return fmt.Errorf("command health check requires config.command")
	}

	cmd := exec.CommandContext(ctx, "sh", "-c", cmdText)
	out, err := cmd.CombinedOutput()
	if err != nil {
		trimmed := strings.TrimSpace(string(out))
		if trimmed == "" {
			return fmt.Errorf("command health check failed: %w", err)
		}
		return fmt.Errorf("command health check failed: %s", trimmed)
	}
	return nil
}

func (hc *HealthChecker) resolveHealthCheckHost(check *HealthCheck) string {
	if strings.TrimSpace(check.NodeID) != "" && hc.scheduler != nil {
		nodes := hc.scheduler.GetNodes()
		for _, node := range nodes {
			if node.ID == check.NodeID {
				host := strings.TrimSpace(node.Address)
				if host != "" {
					return host
				}
				break
			}
		}
	}
	return "127.0.0.1"
}

// AddHealthCheck adds a new health check
func (hc *HealthChecker) AddHealthCheck(check *HealthCheck) {
	hc.mu.Lock()
	defer hc.mu.Unlock()
	hc.checks[check.ID] = check
}

// RemoveHealthCheck removes a health check
func (hc *HealthChecker) RemoveHealthCheck(checkID string) {
	hc.mu.Lock()
	defer hc.mu.Unlock()
	delete(hc.checks, checkID)
	delete(hc.results, checkID)
}

// GetHealthCheck returns one configured health check.
func (hc *HealthChecker) GetHealthCheck(checkID string) (*HealthCheck, bool) {
	hc.mu.RLock()
	defer hc.mu.RUnlock()
	check, exists := hc.checks[checkID]
	return check, exists
}

// GetAllHealthChecks returns all health checks
func (hc *HealthChecker) GetAllHealthChecks() map[string]*HealthCheck {
	hc.mu.RLock()
	defer hc.mu.RUnlock()

	result := make(map[string]*HealthCheck)
	for id, check := range hc.checks {
		result[id] = check
	}

	return result
}

// GetAllResults returns all health check results
func (hc *HealthChecker) GetAllResults() map[string]*HealthCheckResult {
	hc.mu.RLock()
	defer hc.mu.RUnlock()

	result := make(map[string]*HealthCheckResult)
	for id, checkResult := range hc.results {
		result[id] = checkResult
	}

	return result
}

// AlertManager methods

// Start starts the alert manager
func (am *AlertManager) Start(ctx context.Context) error {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	log.Printf("AlertManager started")

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-ticker.C:
			if err := am.evaluateAlertRules(ctx); err != nil {
				log.Printf("Error evaluating alert rules: %v", err)
			}
		}
	}
}

// evaluateAlertRules evaluates all alert rules and triggers alerts if needed
func (am *AlertManager) evaluateAlertRules(ctx context.Context) error {
	am.mu.RLock()
	rules := make([]*AlertRule, 0, len(am.rules))
	for _, rule := range am.rules {
		if rule.Enabled {
			rules = append(rules, rule)
		}
	}
	am.mu.RUnlock()

	for _, rule := range rules {
		if am.shouldTriggerAlert(rule) {
			if am.hasFiringAlertForRule(rule.ID) {
				continue
			}
			alert := am.createAlert(rule)
			if err := am.triggerAlert(ctx, alert); err != nil {
				log.Printf("Failed to trigger alert: %v", err)
			}
		} else {
			am.resolveAlertsForRule(rule.ID)
		}
	}

	return nil
}

// shouldTriggerAlert checks if an alert should be triggered
func (am *AlertManager) shouldTriggerAlert(rule *AlertRule) bool {
	value, ok := am.resolveConditionMetric(rule.Condition.Metric)
	if !ok {
		return false
	}
	return compareFloat(value, rule.Condition.Operator, rule.Condition.Threshold)
}

// createAlert creates an alert from a rule
func (am *AlertManager) createAlert(rule *AlertRule) *Alert {
	return &Alert{
		ID:          fmt.Sprintf("alert_%s_%d", rule.ID, time.Now().Unix()),
		RuleID:      rule.ID,
		Status:      AlertStatusFiring,
		Severity:    rule.Severity,
		Message:     fmt.Sprintf("Alert triggered: %s", rule.Name),
		Labels:      rule.Labels,
		Annotations: rule.Annotations,
		StartsAt:    time.Now(),
		UpdatedAt:   time.Now(),
	}
}

// triggerAlert triggers an alert
func (am *AlertManager) triggerAlert(ctx context.Context, alert *Alert) error {
	am.mu.Lock()
	am.activeAlerts[alert.ID] = alert
	am.mu.Unlock()

	rule := am.getAlertRule(alert.RuleID)
	if rule == nil {
		log.Printf("alert rule %s not found while dispatching alert %s", alert.RuleID, alert.ID)
		return nil
	}

	// Send notifications
	for _, notifierID := range rule.Notifiers {
		if notifier, exists := am.notifiers[notifierID]; exists {
			if err := notifier.Send(ctx, alert); err != nil {
				log.Printf("Failed to send notification via %s: %v", notifierID, err)
			}
		}
	}

	log.Printf("Alert triggered: %s", alert.ID)
	return nil
}

func (am *AlertManager) hasFiringAlertForRule(ruleID string) bool {
	am.mu.RLock()
	defer am.mu.RUnlock()
	for _, alert := range am.activeAlerts {
		if alert.RuleID == ruleID && alert.Status == AlertStatusFiring {
			return true
		}
	}
	return false
}

func (am *AlertManager) resolveAlertsForRule(ruleID string) {
	am.mu.Lock()
	defer am.mu.Unlock()
	now := time.Now()
	for id, alert := range am.activeAlerts {
		if alert.RuleID != ruleID {
			continue
		}
		alert.Status = AlertStatusResolved
		alert.UpdatedAt = now
		alert.EndsAt = &now
		delete(am.activeAlerts, id)
	}
}

func (am *AlertManager) resolveConditionMetric(metricName string) (float64, bool) {
	metric := strings.ToLower(strings.TrimSpace(metricName))
	if metric == "" {
		return 0, false
	}

	switch metric {
	case "active_alerts":
		am.mu.RLock()
		count := len(am.activeAlerts)
		am.mu.RUnlock()
		return float64(count), true
	}

	if am.metricsCollector != nil {
		summary := am.metricsCollector.GetMetricsSummary()
		switch metric {
		case "avg_cpu_usage":
			return mapFloat(summary, "avg_cpu_usage")
		case "total_nodes":
			return mapFloat(summary, "total_nodes")
		case "healthy_nodes":
			return mapFloat(summary, "healthy_nodes")
		case "total_services":
			return mapFloat(summary, "total_services")
		case "total_memory":
			return mapFloat(summary, "total_memory")
		}
	}

	if am.scheduler != nil {
		stats := am.scheduler.GetNodeStats()
		switch metric {
		case "unhealthy_nodes":
			return mapFloat(stats, "unhealthy_nodes")
		case "ready_nodes":
			return mapFloat(stats, "ready_nodes")
		}
	}

	return 0, false
}

func mapFloat(values map[string]interface{}, key string) (float64, bool) {
	raw, ok := values[key]
	if !ok || raw == nil {
		return 0, false
	}
	switch v := raw.(type) {
	case float64:
		return v, true
	case float32:
		return float64(v), true
	case int:
		return float64(v), true
	case int64:
		return float64(v), true
	case int32:
		return float64(v), true
	case json.Number:
		f, err := v.Float64()
		if err != nil {
			return 0, false
		}
		return f, true
	default:
		return 0, false
	}
}

func compareFloat(actual float64, operator string, threshold float64) bool {
	switch strings.TrimSpace(operator) {
	case ">":
		return actual > threshold
	case ">=":
		return actual >= threshold
	case "<":
		return actual < threshold
	case "<=":
		return actual <= threshold
	case "==":
		return actual == threshold
	case "!=":
		return actual != threshold
	default:
		return false
	}
}

// getAlertRule returns the rule for an alert
func (am *AlertManager) getAlertRule(ruleID string) *AlertRule {
	am.mu.RLock()
	defer am.mu.RUnlock()
	return am.rules[ruleID]
}

// GetAlertRuleByID returns one alert rule.
func (am *AlertManager) GetAlertRuleByID(ruleID string) (*AlertRule, bool) {
	am.mu.RLock()
	defer am.mu.RUnlock()
	rule, exists := am.rules[ruleID]
	return rule, exists
}

// GetAllAlertRules returns all configured alert rules.
func (am *AlertManager) GetAllAlertRules() map[string]*AlertRule {
	am.mu.RLock()
	defer am.mu.RUnlock()

	result := make(map[string]*AlertRule, len(am.rules))
	for id, rule := range am.rules {
		result[id] = rule
	}
	return result
}

// AddAlertRule adds a new alert rule
func (am *AlertManager) AddAlertRule(rule *AlertRule) {
	am.mu.Lock()
	defer am.mu.Unlock()
	am.rules[rule.ID] = rule
}

// RemoveAlertRule removes an alert rule
func (am *AlertManager) RemoveAlertRule(ruleID string) {
	am.mu.Lock()
	defer am.mu.Unlock()
	delete(am.rules, ruleID)
}

// AddNotifier adds a new notifier
func (am *AlertManager) AddNotifier(id string, notifier Notifier) {
	am.mu.Lock()
	defer am.mu.Unlock()
	am.notifiers[id] = notifier
}

// RemoveNotifier removes a notifier by ID.
func (am *AlertManager) RemoveNotifier(id string) {
	am.mu.Lock()
	defer am.mu.Unlock()
	delete(am.notifiers, id)
}

// GetNotifier returns a notifier by ID.
func (am *AlertManager) GetNotifier(id string) (Notifier, bool) {
	am.mu.RLock()
	defer am.mu.RUnlock()
	notifier, exists := am.notifiers[id]
	return notifier, exists
}

// GetAllNotifiers returns all registered notifiers.
func (am *AlertManager) GetAllNotifiers() map[string]Notifier {
	am.mu.RLock()
	defer am.mu.RUnlock()

	result := make(map[string]Notifier, len(am.notifiers))
	for id, notifier := range am.notifiers {
		result[id] = notifier
	}
	return result
}

// GetActiveAlerts returns all active alerts
func (am *AlertManager) GetActiveAlerts() map[string]*Alert {
	am.mu.RLock()
	defer am.mu.RUnlock()

	result := make(map[string]*Alert)
	for id, alert := range am.activeAlerts {
		result[id] = alert
	}

	return result
}

// ResolveAlert resolves an alert
func (am *AlertManager) ResolveAlert(alertID string) {
	am.mu.Lock()
	defer am.mu.Unlock()

	if alert, exists := am.activeAlerts[alertID]; exists {
		now := time.Now()
		alert.Status = AlertStatusResolved
		alert.EndsAt = &now
		alert.UpdatedAt = now
	}

	delete(am.activeAlerts, alertID)
}

// Mock Notifier implementations

// EmailNotifier sends alerts via email
type EmailNotifier struct {
	SMTPHost string
	SMTPPort int
	Username string
	Password string
	From     string
	To       []string
}

func (n *EmailNotifier) Send(ctx context.Context, alert *Alert) error {
	if strings.TrimSpace(n.SMTPHost) == "" {
		return fmt.Errorf("smtp_host is required")
	}
	if len(n.To) == 0 {
		return fmt.Errorf("at least one recipient is required")
	}
	port := n.SMTPPort
	if port <= 0 {
		port = 587
	}
	address := net.JoinHostPort(strings.TrimSpace(n.SMTPHost), strconv.Itoa(port))
	subject := fmt.Sprintf("[Containr][%s] %s", strings.ToUpper(string(alert.Severity)), alert.Message)
	body := fmt.Sprintf(
		"Alert ID: %s\nRule ID: %s\nStatus: %s\nSeverity: %s\nStarts At: %s\n\nMessage: %s\n",
		alert.ID,
		alert.RuleID,
		alert.Status,
		alert.Severity,
		alert.StartsAt.Format(time.RFC3339),
		alert.Message,
	)
	msg := "From: " + strings.TrimSpace(n.From) + "\r\n" +
		"To: " + strings.Join(n.To, ", ") + "\r\n" +
		"Subject: " + subject + "\r\n" +
		"\r\n" + body

	var auth smtp.Auth
	if strings.TrimSpace(n.Username) != "" {
		auth = smtp.PlainAuth("", n.Username, n.Password, strings.TrimSpace(n.SMTPHost))
	}

	done := make(chan error, 1)
	go func() {
		done <- smtp.SendMail(address, auth, strings.TrimSpace(n.From), n.To, []byte(msg))
	}()

	select {
	case <-ctx.Done():
		return ctx.Err()
	case err := <-done:
		if err != nil {
			return fmt.Errorf("failed to send email notification: %w", err)
		}
		return nil
	}
}

func (n *EmailNotifier) Type() string {
	return "email"
}

// SlackNotifier sends alerts to Slack
type SlackNotifier struct {
	WebhookURL string
	Channel    string
}

func (n *SlackNotifier) Send(ctx context.Context, alert *Alert) error {
	if strings.TrimSpace(n.WebhookURL) == "" {
		return fmt.Errorf("webhook_url is required")
	}

	payload := map[string]interface{}{
		"text": fmt.Sprintf("*%s* [%s] %s", strings.ToUpper(string(alert.Severity)), alert.Status, alert.Message),
	}
	if strings.TrimSpace(n.Channel) != "" {
		payload["channel"] = n.Channel
	}
	return sendJSONWebhook(ctx, n.WebhookURL, payload)
}

func (n *SlackNotifier) Type() string {
	return "slack"
}

// WebhookNotifier sends alerts via webhook
type WebhookNotifier struct {
	URL string
}

func (n *WebhookNotifier) Send(ctx context.Context, alert *Alert) error {
	if strings.TrimSpace(n.URL) == "" {
		return fmt.Errorf("url is required")
	}
	return sendJSONWebhook(ctx, n.URL, map[string]interface{}{
		"alert": alert,
	})
}

func (n *WebhookNotifier) Type() string {
	return "webhook"
}

func sendJSONWebhook(ctx context.Context, url string, payload map[string]interface{}) error {
	body, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal webhook payload: %w", err)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("failed to build webhook request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send webhook notification: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("webhook returned status %d", resp.StatusCode)
	}
	return nil
}
