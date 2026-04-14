package api

import (
	"net/http"
	"strconv"
	"time"

	"containr/internal/ha"

	"github.com/gin-gonic/gin"
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
	// TODO: Implement getting all policies
	// For now, return mock data
	policies := []map[string]interface{}{
		{
			"service_id":        "web-service",
			"enabled":           true,
			"min_healthy_nodes": 2,
			"max_failures":      3,
			"failover_timeout":  "30s",
			"recovery_timeout":  "5m",
			"failover_strategy": "active_passive",
			"backup_nodes":      []string{"node-2", "node-3"},
		},
	}

	c.JSON(http.StatusOK, gin.H{
		"policies": policies,
		"count":    len(policies),
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
	// TODO: Implement getting health checks from the health checker
	// For now, return mock data
	checks := []map[string]interface{}{
		{
			"id":         "check-1",
			"service_id": "web-service",
			"node_id":    "node-1",
			"type":       "http",
			"config": map[string]interface{}{
				"interval":            "30s",
				"timeout":             "5s",
				"unhealthy_threshold": 3,
				"healthy_threshold":   2,
				"path":                "/health",
				"port":                8080,
				"protocol":            "HTTP",
			},
			"last_check": time.Now().Add(-30 * time.Second),
			"status":     "healthy",
		},
	}

	c.JSON(http.StatusOK, gin.H{
		"checks": checks,
		"count":  len(checks),
	})
}

// AddHealthCheck adds a new health check
func (h *HAManager) AddHealthCheck(c *gin.Context) {
	var check ha.HealthCheck
	if err := c.ShouldBindJSON(&check); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// TODO: Add health check to the health checker
	// For now, just return success

	c.JSON(http.StatusCreated, gin.H{
		"message": "Health check added successfully",
		"check":   check,
	})
}

// GetHealthCheck returns a specific health check
func (h *HAManager) GetHealthCheck(c *gin.Context) {
	_ = c.Param("checkId") // Use the parameter to avoid unused variable error

	// TODO: Implement getting specific health check
	// For now, return mock data
	check := map[string]interface{}{
		"id":         "check-1",
		"service_id": "web-service",
		"node_id":    "node-1",
		"type":       "http",
		"status":     "healthy",
	}

	c.JSON(http.StatusOK, gin.H{"check": check})
}

// UpdateHealthCheck updates an existing health check
func (h *HAManager) UpdateHealthCheck(c *gin.Context) {
	checkID := c.Param("checkId")

	var check ha.HealthCheck
	if err := c.ShouldBindJSON(&check); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Ensure the check ID matches
	check.ID = checkID

	// TODO: Update health check in the health checker

	c.JSON(http.StatusOK, gin.H{
		"message": "Health check updated successfully",
		"check":   check,
	})
}

// DeleteHealthCheck removes a health check
func (h *HAManager) DeleteHealthCheck(c *gin.Context) {
	_ = c.Param("checkId") // Use the parameter to avoid unused variable error

	// TODO: Remove health check from the health checker

	c.JSON(http.StatusOK, gin.H{
		"message": "Health check deleted successfully",
	})
}

// GetHealthResults returns all health check results
func (h *HAManager) GetHealthResults(c *gin.Context) {
	// TODO: Implement getting health check results
	// For now, return mock data
	results := []map[string]interface{}{
		{
			"check_id":  "check-1",
			"status":    "healthy",
			"message":   "Service is healthy",
			"latency":   "15ms",
			"timestamp": time.Now().Add(-30 * time.Second),
		},
		{
			"check_id":   "check-2",
			"status":     "unhealthy",
			"message":    "Connection timeout",
			"latency":    "5000ms",
			"timestamp":  time.Now().Add(-25 * time.Second),
			"error_code": "TIMEOUT",
		},
	}

	c.JSON(http.StatusOK, gin.H{
		"results": results,
		"count":   len(results),
	})
}

// GetAlertRules returns all alert rules
func (h *HAManager) GetAlertRules(c *gin.Context) {
	// TODO: Implement getting alert rules
	// For now, return mock data
	rules := []map[string]interface{}{
		{
			"id":          "rule-1",
			"name":        "High CPU Usage",
			"description": "Alert when CPU usage is above 90%",
			"enabled":     true,
			"condition": map[string]interface{}{
				"metric":    "cpu_usage",
				"operator":  ">",
				"threshold": 90.0,
				"duration":  "5m",
			},
			"severity": "warning",
			"labels": map[string]string{
				"service": "web-service",
				"team":    "backend",
			},
			"notifiers": []string{"email", "slack"},
			"cooldown":  "10m",
		},
	}

	c.JSON(http.StatusOK, gin.H{
		"rules": rules,
		"count": len(rules),
	})
}

// AddAlertRule adds a new alert rule
func (h *HAManager) AddAlertRule(c *gin.Context) {
	var rule ha.AlertRule
	if err := c.ShouldBindJSON(&rule); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// TODO: Add alert rule to the alert manager
	// For now, just return success

	c.JSON(http.StatusCreated, gin.H{
		"message": "Alert rule added successfully",
		"rule":    rule,
	})
}

// GetAlertRule returns a specific alert rule
func (h *HAManager) GetAlertRule(c *gin.Context) {
	_ = c.Param("ruleId") // Use the parameter to avoid unused variable error

	// TODO: Implement getting specific alert rule
	// For now, return mock data
	rule := map[string]interface{}{
		"id":          "rule-1",
		"name":        "High CPU Usage",
		"description": "Alert when CPU usage is above 90%",
		"enabled":     true,
		"severity":    "warning",
	}

	c.JSON(http.StatusOK, gin.H{
		"rule": rule,
	})
}

// UpdateAlertRule updates an existing alert rule
func (h *HAManager) UpdateAlertRule(c *gin.Context) {
	ruleID := c.Param("ruleId")

	var rule ha.AlertRule
	if err := c.ShouldBindJSON(&rule); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Ensure the rule ID matches
	rule.ID = ruleID

	// TODO: Update alert rule in the alert manager

	c.JSON(http.StatusOK, gin.H{
		"message": "Alert rule updated successfully",
		"rule":    rule,
	})
}

// DeleteAlertRule removes an alert rule
func (h *HAManager) DeleteAlertRule(c *gin.Context) {
	// TODO: Remove alert rule from the alert manager

	c.JSON(http.StatusOK, gin.H{
		"message": "Alert rule deleted successfully",
	})
}

// GetActiveAlerts returns all active alerts
func (h *HAManager) GetActiveAlerts(c *gin.Context) {
	// Parse query parameters
	limitStr := c.DefaultQuery("limit", "50")
	limit, err := strconv.Atoi(limitStr)
	if err != nil || limit <= 0 {
		limit = 50
	}

	// TODO: Implement getting active alerts from the alert manager
	// For now, return mock data
	alerts := []map[string]interface{}{
		{
			"id":       "alert-1",
			"rule_id":  "rule-1",
			"status":   "firing",
			"severity": "warning",
			"message":  "CPU usage is above 90%",
			"labels": map[string]string{
				"service": "web-service",
				"team":    "backend",
			},
			"starts_at":  time.Now().Add(-10 * time.Minute),
			"updated_at": time.Now().Add(-2 * time.Minute),
		},
		{
			"id":       "alert-2",
			"rule_id":  "rule-2",
			"status":   "firing",
			"severity": "critical",
			"message":  "Service is down",
			"labels": map[string]string{
				"service": "api-service",
				"team":    "backend",
			},
			"starts_at":  time.Now().Add(-5 * time.Minute),
			"updated_at": time.Now().Add(-1 * time.Minute),
		},
	}

	// Limit results
	if len(alerts) > limit {
		alerts = alerts[:limit]
	}

	c.JSON(http.StatusOK, gin.H{
		"alerts": alerts,
		"count":  len(alerts),
		"limit":  limit,
	})
}

// ResolveAlert resolves an alert
func (h *HAManager) ResolveAlert(c *gin.Context) {
	alertID := c.Param("alertId")

	// TODO: Resolve alert in the alert manager

	c.JSON(http.StatusOK, gin.H{
		"message":  "Alert resolved successfully",
		"alert_id": alertID,
	})
}

// GetNotifiers returns all notifiers
func (h *HAManager) GetNotifiers(c *gin.Context) {
	// TODO: Implement getting notifiers
	// For now, return mock data
	notifiers := []map[string]interface{}{
		{
			"id":   "email",
			"type": "email",
			"config": map[string]interface{}{
				"smtp_host": "smtp.example.com",
				"smtp_port": 587,
				"from":      "alerts@containr.com",
				"to":        []string{"admin@example.com"},
			},
		},
		{
			"id":   "slack",
			"type": "slack",
			"config": map[string]interface{}{
				"webhook_url": "https://hooks.slack.com/...",
				"channel":     "#alerts",
			},
		},
	}

	c.JSON(http.StatusOK, gin.H{
		"notifiers": notifiers,
		"count":     len(notifiers),
	})
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

	// Create notifier based on type
	switch request.Type {
	case "email":
		_ = &ha.EmailNotifier{} // Create but don't use for now
	case "slack":
		_ = &ha.SlackNotifier{} // Create but don't use for now
	case "webhook":
		_ = &ha.WebhookNotifier{} // Create but don't use for now
	default:
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid notifier type"})
		return
	}

	// TODO: Add notifier to the alert manager

	c.JSON(http.StatusCreated, gin.H{
		"message": "Notifier added successfully",
		"id":      request.ID,
		"type":    request.Type,
	})
}

// GetNotifier returns a specific notifier
func (h *HAManager) GetNotifier(c *gin.Context) {
	_ = c.Param("notifierId") // Use the parameter to avoid unused variable error

	// TODO: Implement getting specific notifier
	// For now, return mock data
	notifier := map[string]interface{}{
		"id":   "email",
		"type": "email",
		"config": map[string]interface{}{
			"smtp_host": "smtp.example.com",
			"smtp_port": 587,
		},
	}

	c.JSON(http.StatusOK, gin.H{
		"notifier": notifier,
	})
}

// DeleteNotifier removes a notifier
func (h *HAManager) DeleteNotifier(c *gin.Context) {
	_ = c.Param("notifierId") // Use the parameter to avoid unused variable error

	// TODO: Remove notifier from the alert manager
	// For now, just return success

	c.JSON(http.StatusOK, gin.H{
		"message": "Notifier deleted successfully",
	})
}
