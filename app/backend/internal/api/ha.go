package api

import (
	"fmt"
	"net/http"
	"sort"
	"strings"
	"time"

	"containr/internal/ha"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// HAManager handles high availability API endpoints
type HAManager struct {
	haManager *ha.HighAvailabilityManager
}

// NewHAManager creates a new HA manager handler
func NewHAManager(haManager *ha.HighAvailabilityManager) *HAManager {
	return &HAManager{
		haManager: haManager,
	}
}

// RegisterRoutes registers HA routes
func (h *HAManager) RegisterRoutes(router *gin.RouterGroup) {
	ha := router.Group("/ha")
	{
		ha.GET("/status", h.GetHAStatus)
		ha.POST("/enable", h.EnableHA)
		ha.POST("/disable", h.DisableHA)
		ha.POST("/failover", h.TriggerFailover)

		// Failover policies
		ha.GET("/failover/policies", h.GetFailoverPolicies)
		ha.POST("/failover/policies", h.SetFailoverPolicy)
		ha.GET("/failover/policies/:serviceId", h.GetFailoverPolicy)
		ha.PUT("/failover/policies/:serviceId", h.UpdateFailoverPolicy)
		ha.DELETE("/failover/policies/:serviceId", h.DeleteFailoverPolicy)

		// Health checks
		ha.GET("/health/checks", h.GetHealthChecks)
		ha.POST("/health/checks", h.AddHealthCheck)
		ha.GET("/health/checks/:checkId", h.GetHealthCheck)
		ha.PUT("/health/checks/:checkId", h.UpdateHealthCheck)
		ha.DELETE("/health/checks/:checkId", h.DeleteHealthCheck)
		ha.GET("/health/results", h.GetHealthResults)

		// Alerts
		ha.GET("/alerts/rules", h.GetAlertRules)
		ha.POST("/alerts/rules", h.AddAlertRule)
		ha.GET("/alerts/rules/:ruleId", h.GetAlertRule)
		ha.PUT("/alerts/rules/:ruleId", h.UpdateAlertRule)
		ha.DELETE("/alerts/rules/:ruleId", h.DeleteAlertRule)
		ha.GET("/alerts/active", h.GetActiveAlerts)
		ha.POST("/alerts/:alertId/resolve", h.ResolveAlert)

		// Notifiers
		ha.GET("/notifiers", h.GetNotifiers)
		ha.POST("/notifiers", h.AddNotifier)
		ha.GET("/notifiers/:notifierId", h.GetNotifier)
		ha.DELETE("/notifiers/:notifierId", h.DeleteNotifier)
	}
}

// GetHAStatus returns the overall HA status
func (h *HAManager) GetHAStatus(c *gin.Context) {
	status := h.haManager.GetHealthStatus()

	c.JSON(http.StatusOK, gin.H{
		"status": status,
	})
}

// EnableHA enables the HA manager
func (h *HAManager) EnableHA(c *gin.Context) {
	h.haManager.Enable()

	c.JSON(http.StatusOK, gin.H{
		"message": "High availability manager enabled",
		"enabled": true,
	})
}

// DisableHA disables the HA manager
func (h *HAManager) DisableHA(c *gin.Context) {
	h.haManager.Disable()

	c.JSON(http.StatusOK, gin.H{
		"message": "High availability manager disabled",
		"enabled": false,
	})
}

// TriggerFailover manually triggers a failover
func (h *HAManager) TriggerFailover(c *gin.Context) {
	var request struct {
		Reason string `json:"reason"`
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	reason := request.Reason
	if reason == "" {
		reason = "Manual trigger"
	}

	if err := h.haManager.TriggerFailover(c.Request.Context(), reason); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Failover triggered successfully",
		"reason":  reason,
	})
}

// GetFailoverPolicies returns all failover policies
func (h *HAManager) GetFailoverPolicies(c *gin.Context) {
	policies := h.haManager.GetAllFailoverPolicies()
	serialized := make([]*ha.FailoverPolicy, 0, len(policies))
	for _, policy := range policies {
		serialized = append(serialized, policy)
	}
	sort.Slice(serialized, func(i, j int) bool {
		return serialized[i].ServiceID < serialized[j].ServiceID
	})
	c.JSON(http.StatusOK, gin.H{
		"policies": serialized,
	})
}

// SetFailoverPolicy creates or updates a failover policy
func (h *HAManager) SetFailoverPolicy(c *gin.Context) {
	var policy ha.FailoverPolicy
	if err := c.ShouldBindJSON(&policy); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.haManager.SetFailoverPolicy(&policy); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Failover policy set successfully",
		"policy":  policy,
	})
}

// GetFailoverPolicy returns a specific failover policy
func (h *HAManager) GetFailoverPolicy(c *gin.Context) {
	serviceID := c.Param("serviceId")

	policy, err := h.haManager.GetFailoverPolicy(serviceID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"policy": policy,
	})
}

// UpdateFailoverPolicy updates an existing failover policy
func (h *HAManager) UpdateFailoverPolicy(c *gin.Context) {
	serviceID := c.Param("serviceId")

	var policy ha.FailoverPolicy
	if err := c.ShouldBindJSON(&policy); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Ensure the service ID matches
	policy.ServiceID = serviceID

	if err := h.haManager.SetFailoverPolicy(&policy); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Failover policy updated successfully",
		"policy":  policy,
	})
}

// DeleteFailoverPolicy removes a failover policy
func (h *HAManager) DeleteFailoverPolicy(c *gin.Context) {
	serviceID := c.Param("serviceId")

	// Set policy to disabled instead of deleting
	policy, err := h.haManager.GetFailoverPolicy(serviceID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	policy.Enabled = false
	if err := h.haManager.SetFailoverPolicy(policy); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Failover policy disabled successfully",
	})
}

// GetHealthChecks returns all health checks
func (h *HAManager) GetHealthChecks(c *gin.Context) {
	checks := h.haManager.GetAllHealthChecks()
	serialized := make([]*ha.HealthCheck, 0, len(checks))
	for _, check := range checks {
		serialized = append(serialized, check)
	}
	sort.Slice(serialized, func(i, j int) bool {
		return serialized[i].ID < serialized[j].ID
	})
	c.JSON(http.StatusOK, gin.H{"checks": serialized})
}

// AddHealthCheck adds a new health check
func (h *HAManager) AddHealthCheck(c *gin.Context) {
	var check ha.HealthCheck
	if err := c.ShouldBindJSON(&check); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	check.ID = strings.TrimSpace(check.ID)
	if check.ID == "" {
		check.ID = uuid.NewString()
	}
	check.ServiceID = strings.TrimSpace(check.ServiceID)
	if check.ServiceID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "service_id is required"})
		return
	}
	if check.Status == "" {
		check.Status = ha.HealthStatusUnknown
	}
	check.LastCheck = time.Now().UTC()

	h.haManager.AddHealthCheck(&check)
	c.JSON(http.StatusCreated, gin.H{
		"message": "Health check created successfully",
		"check":   check,
	})
}

// GetHealthCheck returns a specific health check
func (h *HAManager) GetHealthCheck(c *gin.Context) {
	checkID := strings.TrimSpace(c.Param("checkId"))
	check, exists := h.haManager.GetHealthCheck(checkID)
	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "Health check not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"check": check})
}

// UpdateHealthCheck updates an existing health check
func (h *HAManager) UpdateHealthCheck(c *gin.Context) {
	checkID := strings.TrimSpace(c.Param("checkId"))

	var check ha.HealthCheck
	if err := c.ShouldBindJSON(&check); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	check.ID = checkID
	check.ServiceID = strings.TrimSpace(check.ServiceID)
	if check.ServiceID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "service_id is required"})
		return
	}
	check.LastCheck = time.Now().UTC()
	if check.Status == "" {
		check.Status = ha.HealthStatusUnknown
	}

	h.haManager.AddHealthCheck(&check)
	c.JSON(http.StatusOK, gin.H{
		"message": "Health check updated successfully",
		"check":   check,
	})
}

// DeleteHealthCheck removes a health check
func (h *HAManager) DeleteHealthCheck(c *gin.Context) {
	checkID := strings.TrimSpace(c.Param("checkId"))
	h.haManager.RemoveHealthCheck(checkID)
	c.JSON(http.StatusOK, gin.H{"message": "Health check deleted successfully"})
}

// GetHealthResults returns all health check results
func (h *HAManager) GetHealthResults(c *gin.Context) {
	results := h.haManager.GetAllHealthResults()
	serialized := make([]*ha.HealthCheckResult, 0, len(results))
	for _, result := range results {
		serialized = append(serialized, result)
	}
	sort.Slice(serialized, func(i, j int) bool {
		return serialized[i].Timestamp.After(serialized[j].Timestamp)
	})
	c.JSON(http.StatusOK, gin.H{"results": serialized})
}

// GetAlertRules returns all alert rules
func (h *HAManager) GetAlertRules(c *gin.Context) {
	rules := h.haManager.GetAllAlertRules()
	serialized := make([]*ha.AlertRule, 0, len(rules))
	for _, rule := range rules {
		serialized = append(serialized, rule)
	}
	sort.Slice(serialized, func(i, j int) bool {
		return serialized[i].ID < serialized[j].ID
	})
	c.JSON(http.StatusOK, gin.H{"rules": serialized})
}

// AddAlertRule adds a new alert rule
func (h *HAManager) AddAlertRule(c *gin.Context) {
	var rule ha.AlertRule
	if err := c.ShouldBindJSON(&rule); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	rule.ID = strings.TrimSpace(rule.ID)
	if rule.ID == "" {
		rule.ID = uuid.NewString()
	}
	if strings.TrimSpace(rule.Name) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "name is required"})
		return
	}
	if rule.Severity == "" {
		rule.Severity = ha.AlertSeverityWarning
	}
	if rule.Condition.Operator == "" {
		rule.Condition.Operator = ">"
	}
	if rule.Condition.Metric == "" {
		rule.Condition.Metric = "cpu_usage"
	}
	rule.Enabled = true

	h.haManager.AddAlertRule(&rule)
	c.JSON(http.StatusCreated, gin.H{
		"message": "Alert rule created successfully",
		"rule":    rule,
	})
}

// GetAlertRule returns a specific alert rule
func (h *HAManager) GetAlertRule(c *gin.Context) {
	ruleID := strings.TrimSpace(c.Param("ruleId"))
	rule, exists := h.haManager.GetAlertRule(ruleID)
	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "Alert rule not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"rule": rule})
}

// UpdateAlertRule updates an existing alert rule
func (h *HAManager) UpdateAlertRule(c *gin.Context) {
	ruleID := strings.TrimSpace(c.Param("ruleId"))

	var rule ha.AlertRule
	if err := c.ShouldBindJSON(&rule); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	rule.ID = ruleID
	if strings.TrimSpace(rule.Name) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "name is required"})
		return
	}
	if rule.Severity == "" {
		rule.Severity = ha.AlertSeverityWarning
	}
	if rule.Condition.Operator == "" {
		rule.Condition.Operator = ">"
	}
	if rule.Condition.Metric == "" {
		rule.Condition.Metric = "cpu_usage"
	}

	h.haManager.AddAlertRule(&rule)
	c.JSON(http.StatusOK, gin.H{
		"message": "Alert rule updated successfully",
		"rule":    rule,
	})
}

// DeleteAlertRule removes an alert rule
func (h *HAManager) DeleteAlertRule(c *gin.Context) {
	ruleID := strings.TrimSpace(c.Param("ruleId"))
	h.haManager.RemoveAlertRule(ruleID)
	c.JSON(http.StatusOK, gin.H{"message": "Alert rule deleted successfully"})
}

// GetActiveAlerts returns all active alerts
func (h *HAManager) GetActiveAlerts(c *gin.Context) {
	alerts := h.haManager.GetActiveAlerts()
	serialized := make([]*ha.Alert, 0, len(alerts))
	for _, alert := range alerts {
		serialized = append(serialized, alert)
	}
	sort.Slice(serialized, func(i, j int) bool {
		return serialized[i].StartsAt.After(serialized[j].StartsAt)
	})
	c.JSON(http.StatusOK, gin.H{"alerts": serialized})
}

// ResolveAlert resolves an alert
func (h *HAManager) ResolveAlert(c *gin.Context) {
	alertID := strings.TrimSpace(c.Param("alertId"))
	if alertID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "alert_id is required"})
		return
	}

	h.haManager.ResolveAlert(alertID)
	c.JSON(http.StatusOK, gin.H{"message": "Alert resolved"})
}

// GetNotifiers returns all notifiers
func (h *HAManager) GetNotifiers(c *gin.Context) {
	notifiers := h.haManager.GetAllNotifiers()
	type notifierSummary struct {
		ID   string `json:"id"`
		Type string `json:"type"`
	}
	summaries := make([]notifierSummary, 0, len(notifiers))
	for id, notifier := range notifiers {
		summaries = append(summaries, notifierSummary{
			ID:   id,
			Type: notifier.Type(),
		})
	}
	sort.Slice(summaries, func(i, j int) bool { return summaries[i].ID < summaries[j].ID })
	c.JSON(http.StatusOK, gin.H{"notifiers": summaries})
}

// AddNotifier adds a new notifier
func (h *HAManager) AddNotifier(c *gin.Context) {
	var request struct {
		ID     string                 `json:"id"`
		Type   string                 `json:"type"`
		Config map[string]interface{} `json:"config"`
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	notifierID := strings.TrimSpace(request.ID)
	if notifierID == "" {
		notifierID = uuid.NewString()
	}

	typ := strings.ToLower(strings.TrimSpace(request.Type))
	var notifier ha.Notifier
	switch typ {
	case "email":
		notifier = &ha.EmailNotifier{
			SMTPHost: stringConfig(request.Config, "smtp_host", ""),
			SMTPPort: intConfig(request.Config, "smtp_port", 587),
			Username: stringConfig(request.Config, "username", ""),
			Password: stringConfig(request.Config, "password", ""),
			From:     stringConfig(request.Config, "from", ""),
			To:       splitCSV(stringConfig(request.Config, "to", "")),
		}
	case "slack":
		notifier = &ha.SlackNotifier{
			WebhookURL: stringConfig(request.Config, "webhook_url", ""),
			Channel:    stringConfig(request.Config, "channel", ""),
		}
	case "webhook":
		notifier = &ha.WebhookNotifier{
			URL: stringConfig(request.Config, "url", ""),
		}
	default:
		c.JSON(http.StatusBadRequest, gin.H{"error": "unsupported notifier type"})
		return
	}

	h.haManager.AddNotifier(notifierID, notifier)
	c.JSON(http.StatusCreated, gin.H{
		"message": "Notifier added successfully",
		"notifier": gin.H{
			"id":   notifierID,
			"type": notifier.Type(),
		},
	})
}

// GetNotifier returns a specific notifier
func (h *HAManager) GetNotifier(c *gin.Context) {
	notifierID := strings.TrimSpace(c.Param("notifierId"))
	notifier, exists := h.haManager.GetNotifier(notifierID)
	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "Notifier not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"notifier": gin.H{
			"id":   notifierID,
			"type": notifier.Type(),
		},
	})
}

// DeleteNotifier removes a notifier
func (h *HAManager) DeleteNotifier(c *gin.Context) {
	notifierID := strings.TrimSpace(c.Param("notifierId"))
	h.haManager.RemoveNotifier(notifierID)
	c.JSON(http.StatusOK, gin.H{"message": "Notifier deleted successfully"})
}

func stringConfig(config map[string]interface{}, key, fallback string) string {
	if config == nil {
		return fallback
	}
	raw, exists := config[key]
	if !exists || raw == nil {
		return fallback
	}
	return strings.TrimSpace(fmt.Sprintf("%v", raw))
}

func intConfig(config map[string]interface{}, key string, fallback int) int {
	if config == nil {
		return fallback
	}
	raw, exists := config[key]
	if !exists || raw == nil {
		return fallback
	}
	switch value := raw.(type) {
	case int:
		return value
	case int8:
		return int(value)
	case int16:
		return int(value)
	case int32:
		return int(value)
	case int64:
		return int(value)
	case float32:
		return int(value)
	case float64:
		return int(value)
	default:
		return fallback
	}
}

func splitCSV(value string) []string {
	value = strings.TrimSpace(value)
	if value == "" {
		return nil
	}
	parts := strings.Split(value, ",")
	out := make([]string, 0, len(parts))
	for _, part := range parts {
		trimmed := strings.TrimSpace(part)
		if trimmed != "" {
			out = append(out, trimmed)
		}
	}
	return out
}
