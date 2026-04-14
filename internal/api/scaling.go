package api

import (
	"net/http"
	"strconv"
	"time"

	"containr/internal/scaling"

	"github.com/gin-gonic/gin"
)

// ScalingHandler handles scaling-related API endpoints
type ScalingHandler struct {
	autoScaler *scaling.AutoScaler
}

// NewScalingHandler creates a new scaling handler
func NewScalingHandler(autoScaler *scaling.AutoScaler) *ScalingHandler {
	return &ScalingHandler{
		autoScaler: autoScaler,
	}
}

// RegisterRoutes registers scaling routes
func (h *ScalingHandler) RegisterRoutes(router *gin.RouterGroup) {
	scaling := router.Group("/scaling")
	{
		scaling.GET("/policies", h.GetScalingPolicies)
		scaling.POST("/policies", h.SetScalingPolicy)
		scaling.GET("/policies/:serviceId", h.GetScalingPolicy)
		scaling.PUT("/policies/:serviceId", h.UpdateScalingPolicy)
		scaling.DELETE("/policies/:serviceId", h.DeleteScalingPolicy)

		scaling.GET("/services", h.GetServiceStates)
		scaling.GET("/services/:serviceId", h.GetServiceState)
		scaling.GET("/services/:serviceId/history", h.GetScalingHistory)

		scaling.POST("/services/:serviceId/scale", h.ManualScale)

		scaling.GET("/status", h.GetScalingStatus)
		scaling.POST("/enable", h.EnableAutoScaler)
		scaling.POST("/disable", h.DisableAutoScaler)

		scaling.GET("/metrics", h.GetScalingMetrics)
		scaling.GET("/events", h.GetScalingEvents)
	}
}

// GetScalingPolicies returns all scaling policies
func (h *ScalingHandler) GetScalingPolicies(c *gin.Context) {
	states := h.autoScaler.GetAllServiceStates()

	policies := make([]*scaling.ScalingPolicy, 0)
	for _, state := range states {
		if state.Policy != nil {
			policies = append(policies, state.Policy)
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"policies": policies,
		"count":    len(policies),
	})
}

// SetScalingPolicy creates or updates a scaling policy
func (h *ScalingHandler) SetScalingPolicy(c *gin.Context) {
	var policy scaling.ScalingPolicy
	if err := c.ShouldBindJSON(&policy); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.autoScaler.SetScalingPolicy(&policy); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Scaling policy set successfully",
		"policy":  policy,
	})
}

// GetScalingPolicy returns a specific scaling policy
func (h *ScalingHandler) GetScalingPolicy(c *gin.Context) {
	serviceID := c.Param("serviceId")

	policy, err := h.autoScaler.GetScalingPolicy(serviceID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"policy": policy,
	})
}

// UpdateScalingPolicy updates an existing scaling policy
func (h *ScalingHandler) UpdateScalingPolicy(c *gin.Context) {
	serviceID := c.Param("serviceId")

	var policy scaling.ScalingPolicy
	if err := c.ShouldBindJSON(&policy); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Ensure the service ID matches
	policy.ServiceID = serviceID

	if err := h.autoScaler.SetScalingPolicy(&policy); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Scaling policy updated successfully",
		"policy":  policy,
	})
}

// DeleteScalingPolicy removes a scaling policy
func (h *ScalingHandler) DeleteScalingPolicy(c *gin.Context) {
	serviceID := c.Param("serviceId")

	// Set policy to disabled instead of deleting
	policy, err := h.autoScaler.GetScalingPolicy(serviceID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	policy.Enabled = false
	if err := h.autoScaler.SetScalingPolicy(policy); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Scaling policy disabled successfully",
	})
}

// GetServiceStates returns all service scaling states
func (h *ScalingHandler) GetServiceStates(c *gin.Context) {
	states := h.autoScaler.GetAllServiceStates()

	c.JSON(http.StatusOK, gin.H{
		"services": states,
		"count":    len(states),
	})
}

// GetServiceState returns a specific service's scaling state
func (h *ScalingHandler) GetServiceState(c *gin.Context) {
	serviceID := c.Param("serviceId")

	state, err := h.autoScaler.GetServiceState(serviceID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"state": state,
	})
}

// GetScalingHistory returns scaling history for a service
func (h *ScalingHandler) GetScalingHistory(c *gin.Context) {
	serviceID := c.Param("serviceId")

	// TODO: Implement scaling history retrieval from database
	// For now, return mock data
	history := []map[string]interface{}{
		{
			"timestamp": time.Now().Add(-2 * time.Hour),
			"action":    "scale_up",
			"from":      2,
			"to":        3,
			"reason":    "CPU usage above target",
		},
		{
			"timestamp": time.Now().Add(-1 * time.Hour),
			"action":    "scale_down",
			"from":      3,
			"to":        2,
			"reason":    "CPU usage below target",
		},
	}

	c.JSON(http.StatusOK, gin.H{
		"service_id": serviceID,
		"history":    history,
		"count":      len(history),
	})
}

// ManualScale performs manual scaling of a service
func (h *ScalingHandler) ManualScale(c *gin.Context) {
	serviceID := c.Param("serviceId")

	var request struct {
		Replicas int    `json:"replicas" binding:"required,min=1,max=20"`
		Reason   string `json:"reason"`
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// TODO: Implement manual scaling
	// This would bypass the auto-scaler and directly scale the service

	c.JSON(http.StatusAccepted, gin.H{
		"message":    "Manual scaling initiated",
		"service_id": serviceID,
		"replicas":   request.Replicas,
		"reason":     request.Reason,
	})
}

// GetScalingStatus returns the overall status of the auto-scaler
func (h *ScalingHandler) GetScalingStatus(c *gin.Context) {
	summary := h.autoScaler.GetScalingSummary()

	c.JSON(http.StatusOK, gin.H{
		"status":  "active",
		"summary": summary,
		"enabled": h.autoScaler.IsEnabled(),
	})
}

// EnableAutoScaler enables the auto-scaler
func (h *ScalingHandler) EnableAutoScaler(c *gin.Context) {
	h.autoScaler.Enable()

	c.JSON(http.StatusOK, gin.H{
		"message": "Auto-scaler enabled",
		"enabled": true,
	})
}

// DisableAutoScaler disables the auto-scaler
func (h *ScalingHandler) DisableAutoScaler(c *gin.Context) {
	h.autoScaler.Disable()

	c.JSON(http.StatusOK, gin.H{
		"message": "Auto-scaler disabled",
		"enabled": false,
	})
}

// GetScalingMetrics returns scaling-related metrics
func (h *ScalingHandler) GetScalingMetrics(c *gin.Context) {
	summary := h.autoScaler.GetScalingSummary()

	// Add additional metrics
	metrics := map[string]interface{}{
		"total_services":         summary["total_services"],
		"enabled_services":       summary["enabled_services"],
		"total_replicas":         summary["total_replicas"],
		"services_scaling_up":    summary["scaling_up"],
		"services_scaling_down":  summary["scaling_down"],
		"auto_scaler_enabled":    summary["enabled"],
		"check_interval_seconds": summary["check_interval"],
		"timestamp":              time.Now(),
	}

	c.JSON(http.StatusOK, gin.H{
		"metrics": metrics,
	})
}

// GetScalingEvents returns recent scaling events
func (h *ScalingHandler) GetScalingEvents(c *gin.Context) {
	// Parse query parameters
	limitStr := c.DefaultQuery("limit", "50")
	limit, err := strconv.Atoi(limitStr)
	if err != nil || limit <= 0 {
		limit = 50
	}

	// TODO: Implement scaling events retrieval from database
	// For now, return mock data
	events := []map[string]interface{}{
		{
			"id":          "evt_1",
			"service_id":  "web-service",
			"action":      "scale_up",
			"from":        2,
			"to":          3,
			"reason":      "CPU usage (85%) above target (70%)",
			"timestamp":   time.Now().Add(-30 * time.Minute),
			"cost_impact": 0.01,
		},
		{
			"id":          "evt_2",
			"service_id":  "api-service",
			"action":      "scale_down",
			"from":        5,
			"to":          3,
			"reason":      "Low request rate (10/s)",
			"timestamp":   time.Now().Add(-1 * time.Hour),
			"cost_impact": -0.02,
		},
	}

	// Limit results
	if len(events) > limit {
		events = events[:limit]
	}

	c.JSON(http.StatusOK, gin.H{
		"events": events,
		"count":  len(events),
		"limit":  limit,
	})
}

// ScalingPolicyTemplate represents a template for creating scaling policies
type ScalingPolicyTemplate struct {
	Name        string                `json:"name"`
	Description string                `json:"description"`
	Template    scaling.ScalingPolicy `json:"template"`
}

// GetScalingPolicyTemplates returns predefined scaling policy templates
func (h *ScalingHandler) GetScalingPolicyTemplates(c *gin.Context) {
	templates := []ScalingPolicyTemplate{
		{
			Name:        "Web Application",
			Description: "Standard scaling policy for web applications",
			Template: scaling.ScalingPolicy{
				MinReplicas:       2,
				MaxReplicas:       10,
				TargetCPU:         70.0,
				TargetMemory:      80.0,
				ScaleUpCooldown:   3 * time.Minute,
				ScaleDownCooldown: 5 * time.Minute,
				ScaleUpStep:       1,
				ScaleDownStep:     1,
				Metrics:           []string{"cpu", "memory", "requests_per_second"},
				Enabled:           true,
				CostOptimization: &scaling.CostOptimization{
					MaxCostPerHour:   1.0,
					PreferEfficiency: true,
					IdleTimeout:      10 * time.Minute,
				},
			},
		},
		{
			Name:        "API Service",
			Description: "Aggressive scaling for API services",
			Template: scaling.ScalingPolicy{
				MinReplicas:       1,
				MaxReplicas:       20,
				TargetCPU:         60.0,
				TargetMemory:      75.0,
				ScaleUpCooldown:   1 * time.Minute,
				ScaleDownCooldown: 3 * time.Minute,
				ScaleUpStep:       2,
				ScaleDownStep:     1,
				Metrics:           []string{"cpu", "memory", "requests_per_second", "error_rate"},
				Enabled:           true,
				CostOptimization: &scaling.CostOptimization{
					MaxCostPerHour:   2.0,
					PreferEfficiency: false,
					IdleTimeout:      5 * time.Minute,
				},
			},
		},
		{
			Name:        "Background Worker",
			Description: "Conservative scaling for background workers",
			Template: scaling.ScalingPolicy{
				MinReplicas:       1,
				MaxReplicas:       5,
				TargetCPU:         80.0,
				TargetMemory:      85.0,
				ScaleUpCooldown:   5 * time.Minute,
				ScaleDownCooldown: 10 * time.Minute,
				ScaleUpStep:       1,
				ScaleDownStep:     1,
				Metrics:           []string{"cpu", "memory"},
				Enabled:           true,
				CostOptimization: &scaling.CostOptimization{
					MaxCostPerHour:   0.5,
					PreferEfficiency: true,
					IdleTimeout:      15 * time.Minute,
				},
			},
		},
	}

	c.JSON(http.StatusOK, gin.H{
		"templates": templates,
		"count":     len(templates),
	})
}

// ValidateScalingPolicy validates a scaling policy
func (h *ScalingHandler) ValidateScalingPolicy(c *gin.Context) {
	var policy scaling.ScalingPolicy
	if err := c.ShouldBindJSON(&policy); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	errors := []string{}
	warnings := []string{}

	// Validate policy
	if policy.MinReplicas < 1 {
		errors = append(errors, "min_replicas must be at least 1")
	}
	if policy.MaxReplicas < policy.MinReplicas {
		errors = append(errors, "max_replicas must be greater than or equal to min_replicas")
	}
	if policy.TargetCPU <= 0 || policy.TargetCPU > 100 {
		errors = append(errors, "target_cpu must be between 0 and 100")
	}
	if policy.TargetMemory <= 0 || policy.TargetMemory > 100 {
		errors = append(errors, "target_memory must be between 0 and 100")
	}
	if policy.ScaleUpStep < 1 {
		errors = append(errors, "scale_up_step must be at least 1")
	}
	if policy.ScaleDownStep < 1 {
		errors = append(errors, "scale_down_step must be at least 1")
	}

	// Warnings
	if policy.MaxReplicas > 20 {
		warnings = append(warnings, "max_replicas greater than 20 may be costly")
	}
	if policy.ScaleUpCooldown < 1*time.Minute {
		warnings = append(warnings, "scale_up_cooldown less than 1 minute may cause thrashing")
	}
	if policy.ScaleDownCooldown < 2*time.Minute {
		warnings = append(warnings, "scale_down_cooldown less than 2 minutes may cause thrashing")
	}

	valid := len(errors) == 0

	c.JSON(http.StatusOK, gin.H{
		"valid":    valid,
		"errors":   errors,
		"warnings": warnings,
	})
}
