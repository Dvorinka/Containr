package scaling

import (
	"context"
	"fmt"
	"log"
	"math"
	"sync"
	"time"

	"containr/internal/deployment"
	"containr/internal/metrics"
)

// AutoScaler manages automatic scaling of services
type AutoScaler struct {
	scheduler       *deployment.Scheduler
	metricsCollector *metrics.MetricsCollector
	policies        map[string]*ScalingPolicy
	services        map[string]*ServiceScalingState
	mu              sync.RWMutex
	checkInterval   time.Duration
	cooldownPeriod  time.Duration
	enabled         bool
}

// ScalingPolicy defines how a service should scale
type ScalingPolicy struct {
	ServiceID       string            `json:"service_id"`
	MinReplicas     int               `json:"min_replicas"`
	MaxReplicas     int               `json:"max_replicas"`
	TargetCPU       float64           `json:"target_cpu"`        // Target CPU utilization percentage
	TargetMemory    float64           `json:"target_memory"`     // Target memory utilization percentage
	ScaleUpCooldown time.Duration     `json:"scale_up_cooldown"`
	ScaleDownCooldown time.Duration   `json:"scale_down_cooldown"`
	ScaleUpStep     int               `json:"scale_up_step"`     // How many replicas to add when scaling up
	ScaleDownStep   int               `json:"scale_down_step"`   // How many replicas to remove when scaling down
	Metrics         []string          `json:"metrics"`           // Which metrics to consider
	Thresholds      map[string]float64 `json:"thresholds"`      // Custom thresholds for metrics
	Enabled         bool              `json:"enabled"`
	CostOptimization *CostOptimization `json:"cost_optimization"`
}

// CostOptimization defines cost-related scaling parameters
type CostOptimization struct {
	MaxCostPerHour   float64 `json:"max_cost_per_hour"`
	PreferEfficiency bool    `json:"prefer_efficiency"`
	IdleTimeout      time.Duration `json:"idle_timeout"`
}

// ServiceScalingState tracks the current scaling state of a service
type ServiceScalingState struct {
	ServiceID        string
	CurrentReplicas  int
	DesiredReplicas  int
	LastScaleAction  time.Time
	LastScaleDirection string // "up" or "down"
	ScaleUpCooldown  time.Time
	ScaleDownCooldown time.Time
	MetricsHistory   []MetricsSnapshot
	Policy           *ScalingPolicy
}

// MetricsSnapshot captures metrics at a point in time
type MetricsSnapshot struct {
	Timestamp time.Time
	CPU       float64
	Memory    float64
	Requests  float64
	Errors    float64
}

// ScaleEvent represents a scaling action
type ScaleEvent struct {
	ServiceID      string    `json:"service_id"`
	Action         string    `json:"action"`         // "scale_up" or "scale_down"
	FromReplicas   int       `json:"from_replicas"`
	ToReplicas     int       `json:"to_replicas"`
	Reason         string    `json:"reason"`
	Timestamp      time.Time `json:"timestamp"`
	Metrics        map[string]float64 `json:"metrics"`
	CostImpact     float64   `json:"cost_impact"`
}

// ScalingDecision contains the decision made by the autoscaler
type ScalingDecision struct {
	ShouldScale     bool      `json:"should_scale"`
	Action          string    `json:"action"`
	CurrentReplicas int       `json:"current_replicas"`
	DesiredReplicas int       `json:"desired_replicas"`
	Reason          string    `json:"reason"`
	Metrics         map[string]float64 `json:"metrics"`
	CostEstimate    float64   `json:"cost_estimate"`
}

// NewAutoScaler creates a new auto-scaler
func NewAutoScaler(scheduler *deployment.Scheduler, metricsCollector *metrics.MetricsCollector) *AutoScaler {
	return &AutoScaler{
		scheduler:        scheduler,
		metricsCollector: metricsCollector,
		policies:         make(map[string]*ScalingPolicy),
		services:         make(map[string]*ServiceScalingState),
		checkInterval:    30 * time.Second,
		cooldownPeriod:   5 * time.Minute,
		enabled:          true,
	}
}

// Start begins the auto-scaling process
func (as *AutoScaler) Start(ctx context.Context) error {
	ticker := time.NewTicker(as.checkInterval)
	defer ticker.Stop()

	log.Printf("AutoScaler started with check interval: %v", as.checkInterval)

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-ticker.C:
			if as.enabled {
				if err := as.checkAndScale(ctx); err != nil {
					log.Printf("Error during auto-scaling check: %v", err)
				}
			}
		}
	}
}

// checkAndScale evaluates all services and scales if necessary
func (as *AutoScaler) checkAndScale(ctx context.Context) error {
	as.mu.RLock()
	servicesToCheck := make([]*ServiceScalingState, 0, len(as.services))
	for _, state := range as.services {
		if state.Policy != nil && state.Policy.Enabled {
			servicesToCheck = append(servicesToCheck, state)
		}
	}
	as.mu.RUnlock()

	for _, state := range servicesToCheck {
		decision, err := as.evaluateScaling(ctx, state)
		if err != nil {
			log.Printf("Error evaluating scaling for service %s: %v", state.ServiceID, err)
			continue
		}

		if decision.ShouldScale {
			if err := as.executeScaling(ctx, state, decision); err != nil {
				log.Printf("Error executing scaling for service %s: %v", state.ServiceID, err)
			}
		}
	}

	return nil
}

// evaluateScaling determines if a service needs to scale
func (as *AutoScaler) evaluateScaling(ctx context.Context, state *ServiceScalingState) (*ScalingDecision, error) {
	policy := state.Policy
	now := time.Now()

	// Check cooldowns
	if now.Before(state.ScaleUpCooldown) && now.Before(state.ScaleDownCooldown) {
		return &ScalingDecision{
			ShouldScale:     false,
			CurrentReplicas: state.CurrentReplicas,
			DesiredReplicas: state.CurrentReplicas,
			Reason:          "In cooldown period",
		}, nil
	}

	// Get current metrics
	metrics, err := as.getServiceMetrics(ctx, state.ServiceID)
	if err != nil {
		return nil, fmt.Errorf("failed to get service metrics: %w", err)
	}

	// Calculate desired replicas based on metrics
	desiredReplicas := as.calculateDesiredReplicas(state, metrics, policy)

	// Ensure within bounds
	if desiredReplicas < policy.MinReplicas {
		desiredReplicas = policy.MinReplicas
	}
	if desiredReplicas > policy.MaxReplicas {
		desiredReplicas = policy.MaxReplicas
	}

	// Check if scaling is needed
	if desiredReplicas == state.CurrentReplicas {
		return &ScalingDecision{
			ShouldScale:     false,
			CurrentReplicas: state.CurrentReplicas,
			DesiredReplicas: desiredReplicas,
			Reason:          "No scaling needed",
			Metrics:         metrics,
		}, nil
	}

	// Determine action and check cooldowns
	action := "scale_down"
	if desiredReplicas > state.CurrentReplicas {
		action = "scale_up"
		if now.Before(state.ScaleUpCooldown) {
			return &ScalingDecision{
				ShouldScale:     false,
				CurrentReplicas: state.CurrentReplicas,
				DesiredReplicas: desiredReplicas,
				Reason:          "Scale up cooldown active",
				Metrics:         metrics,
			}, nil
		}
	} else {
		if now.Before(state.ScaleDownCooldown) {
			return &ScalingDecision{
				ShouldScale:     false,
				CurrentReplicas: state.CurrentReplicas,
				DesiredReplicas: desiredReplicas,
				Reason:          "Scale down cooldown active",
				Metrics:         metrics,
			}, nil
		}
	}

	// Apply scaling steps
	if action == "scale_up" {
		maxStep := policy.ScaleUpStep
		if maxStep <= 0 {
			maxStep = 1
		}
		if desiredReplicas-state.CurrentReplicas > maxStep {
			desiredReplicas = state.CurrentReplicas + maxStep
		}
	} else {
		maxStep := policy.ScaleDownStep
		if maxStep <= 0 {
			maxStep = 1
		}
		if state.CurrentReplicas-desiredReplicas > maxStep {
			desiredReplicas = state.CurrentReplicas - maxStep
		}
	}

	// Cost optimization check
	if policy.CostOptimization != nil {
		costEstimate := as.estimateScalingCost(state, desiredReplicas)
		if costEstimate > policy.CostOptimization.MaxCostPerHour {
			return &ScalingDecision{
				ShouldScale:     false,
				CurrentReplicas: state.CurrentReplicas,
				DesiredReplicas: state.CurrentReplicas,
				Reason:          fmt.Sprintf("Cost estimate %.2f exceeds maximum %.2f", costEstimate, policy.CostOptimization.MaxCostPerHour),
				Metrics:         metrics,
				CostEstimate:    costEstimate,
			}, nil
		}
	}

	reason := as.generateScalingReason(state, metrics, desiredReplicas)

	return &ScalingDecision{
		ShouldScale:     true,
		Action:          action,
		CurrentReplicas: state.CurrentReplicas,
		DesiredReplicas: desiredReplicas,
		Reason:          reason,
		Metrics:         metrics,
		CostEstimate:    as.estimateScalingCost(state, desiredReplicas),
	}, nil
}

// calculateDesiredReplicas calculates the desired number of replicas based on metrics
func (as *AutoScaler) calculateDesiredReplicas(state *ServiceScalingState, metrics map[string]float64, policy *ScalingPolicy) int {
	currentReplicas := state.CurrentReplicas
	desiredReplicas := currentReplicas

	// CPU-based scaling
	if cpuUsage, ok := metrics["cpu"]; ok && policy.TargetCPU > 0 {
		cpuRatio := cpuUsage / policy.TargetCPU
		if cpuRatio > 1.2 { // Scale up if CPU is 20% above target
			desiredReplicas = int(math.Ceil(float64(currentReplicas) * cpuRatio))
		} else if cpuRatio < 0.8 { // Scale down if CPU is 20% below target
			desiredReplicas = int(math.Floor(float64(currentReplicas) * cpuRatio))
		}
	}

	// Memory-based scaling
	if memoryUsage, ok := metrics["memory"]; ok && policy.TargetMemory > 0 {
		memoryRatio := memoryUsage / policy.TargetMemory
		if memoryRatio > 1.2 {
			memDesired := int(math.Ceil(float64(currentReplicas) * memoryRatio))
			if memDesired > desiredReplicas {
				desiredReplicas = memDesired
			}
		} else if memoryUsage < 0.8 {
			memDesired := int(math.Floor(float64(currentReplicas) * memoryRatio))
			if memDesired < desiredReplicas {
				desiredReplicas = memDesired
			}
		}
	}

	// Request rate scaling
	if requestRate, ok := metrics["requests_per_second"]; ok {
		// Simple heuristic: scale based on request rate per replica
		// Assume each replica can handle ~100 requests per second
		requestsPerReplica := 100.0
		requestDesired := int(math.Ceil(requestRate / requestsPerReplica))
		if requestDesired > desiredReplicas {
			desiredReplicas = requestDesired
		}
	}

	// Error rate scaling (scale up if error rate is high)
	if errorRate, ok := metrics["error_rate"]; ok && errorRate > 0.05 { // 5% error rate
		errorDesired := currentReplicas + 1
		if errorDesired > desiredReplicas {
			desiredReplicas = errorDesired
		}
	}

	return desiredReplicas
}

// getServiceMetrics gets current metrics for a service
func (as *AutoScaler) getServiceMetrics(ctx context.Context, serviceID string) (map[string]float64, error) {
	// Get service metrics from the metrics collector
	serviceMetrics, err := as.metricsCollector.GetServiceMetrics(serviceID)
	if err != nil {
		// If no metrics available, return empty map
		return make(map[string]float64), nil
	}

	metrics := make(map[string]float64)

	// Calculate average metrics across instances
	if len(serviceMetrics.Instances) > 0 {
		var totalCPU, totalMemory, totalRequests float64
		var totalErrors int64

		for _, instance := range serviceMetrics.Instances {
			totalCPU += instance.CPU
			totalMemory += float64(instance.Memory)
			totalRequests += serviceMetrics.Requests.Throughput
			totalErrors += serviceMetrics.Errors.Total
		}

		instanceCount := float64(len(serviceMetrics.Instances))
		metrics["cpu"] = totalCPU / instanceCount
		metrics["memory"] = totalMemory / instanceCount / (1024 * 1024 * 1024) // Convert to GB
		metrics["requests_per_second"] = totalRequests
		if serviceMetrics.Requests.Total > 0 {
			metrics["error_rate"] = float64(totalErrors) / float64(serviceMetrics.Requests.Total)
		} else {
			metrics["error_rate"] = 0
		}
	}

	return metrics, nil
}

// executeScaling performs the actual scaling action
func (as *AutoScaler) executeScaling(ctx context.Context, state *ServiceScalingState, decision *ScalingDecision) error {
	serviceID := state.ServiceID
	fromReplicas := state.CurrentReplicas
	toReplicas := decision.DesiredReplicas

	log.Printf("Executing scaling for service %s: %d -> %d replicas (%s)", 
		serviceID, fromReplicas, toReplicas, decision.Reason)

	// In a real implementation, this would call the deployment engine
	// to scale the service (add/remove containers)
	
	// Update state
	as.mu.Lock()
	state.CurrentReplicas = toReplicas
	state.DesiredReplicas = toReplicas
	state.LastScaleAction = time.Now()
	state.LastScaleDirection = decision.Action
	
	// Set cooldowns
	if decision.Action == "scale_up" {
		state.ScaleUpCooldown = time.Now().Add(state.Policy.ScaleUpCooldown)
	} else {
		state.ScaleDownCooldown = time.Now().Add(state.Policy.ScaleDownCooldown)
	}
	as.mu.Unlock()

	// Record the scaling event
	event := &ScaleEvent{
		ServiceID:    serviceID,
		Action:       decision.Action,
		FromReplicas: fromReplicas,
		ToReplicas:   toReplicas,
		Reason:       decision.Reason,
		Timestamp:    time.Now(),
		Metrics:      decision.Metrics,
		CostImpact:   decision.CostEstimate,
	}

	// TODO: Store scaling event in database
	log.Printf("Scaling event: %+v", event)

	return nil
}

// generateScalingReason creates a human-readable reason for scaling
func (as *AutoScaler) generateScalingReason(state *ServiceScalingState, metrics map[string]float64, desiredReplicas int) string {
	var reasons []string

	if cpuUsage, ok := metrics["cpu"]; ok {
		if cpuUsage > state.Policy.TargetCPU*1.2 {
			reasons = append(reasons, fmt.Sprintf("CPU usage %.1f%% above target %.1f%%", cpuUsage, state.Policy.TargetCPU))
		} else if cpuUsage < state.Policy.TargetCPU*0.8 {
			reasons = append(reasons, fmt.Sprintf("CPU usage %.1f%% below target %.1f%%", cpuUsage, state.Policy.TargetCPU))
		}
	}

	if memoryUsage, ok := metrics["memory"]; ok && state.Policy.TargetMemory > 0 {
		if memoryUsage > state.Policy.TargetMemory*1.2 {
			reasons = append(reasons, fmt.Sprintf("Memory usage %.1fGB above target %.1fGB", memoryUsage, state.Policy.TargetMemory))
		}
	}

	if requestRate, ok := metrics["requests_per_second"]; ok {
		reasons = append(reasons, fmt.Sprintf("Request rate %.0f/s requires %d replicas", requestRate, desiredReplicas))
	}

	if len(reasons) == 0 {
		return "Automatic scaling based on metrics"
	}

	return fmt.Sprintf("Scale %s: %v", state.LastScaleDirection, reasons)
}

// estimateScalingCost estimates the cost impact of scaling
func (as *AutoScaler) estimateScalingCost(state *ServiceScalingState, replicas int) float64 {
	// Simple cost model: $0.01 per replica per hour
	// In a real implementation, this would consider actual instance costs
	baseCost := 0.01
	return float64(replicas) * baseCost
}

// SetScalingPolicy sets or updates a scaling policy for a service
func (as *AutoScaler) SetScalingPolicy(policy *ScalingPolicy) error {
	as.mu.Lock()
	defer as.mu.Unlock()

	// Set default values if not specified
	if policy.ScaleUpCooldown == 0 {
		policy.ScaleUpCooldown = 3 * time.Minute
	}
	if policy.ScaleDownCooldown == 0 {
		policy.ScaleDownCooldown = 5 * time.Minute
	}
	if policy.ScaleUpStep == 0 {
		policy.ScaleUpStep = 1
	}
	if policy.ScaleDownStep == 0 {
		policy.ScaleDownStep = 1
	}
	if policy.MinReplicas == 0 {
		policy.MinReplicas = 1
	}
	if policy.MaxReplicas == 0 {
		policy.MaxReplicas = 10
	}

	as.policies[policy.ServiceID] = policy

	// Initialize service state if not exists
	if _, exists := as.services[policy.ServiceID]; !exists {
		as.services[policy.ServiceID] = &ServiceScalingState{
			ServiceID:       policy.ServiceID,
			CurrentReplicas: policy.MinReplicas,
			DesiredReplicas: policy.MinReplicas,
			Policy:          policy,
			MetricsHistory:  make([]MetricsSnapshot, 0),
		}
	} else {
		as.services[policy.ServiceID].Policy = policy
	}

	return nil
}

// GetScalingPolicy returns the scaling policy for a service
func (as *AutoScaler) GetScalingPolicy(serviceID string) (*ScalingPolicy, error) {
	as.mu.RLock()
	defer as.mu.RUnlock()

	policy, exists := as.policies[serviceID]
	if !exists {
		return nil, fmt.Errorf("no scaling policy found for service: %s", serviceID)
	}

	return policy, nil
}

// GetServiceState returns the current scaling state of a service
func (as *AutoScaler) GetServiceState(serviceID string) (*ServiceScalingState, error) {
	as.mu.RLock()
	defer as.mu.RUnlock()

	state, exists := as.services[serviceID]
	if !exists {
		return nil, fmt.Errorf("no scaling state found for service: %s", serviceID)
	}

	return state, nil
}

// GetAllServiceStates returns all service scaling states
func (as *AutoScaler) GetAllServiceStates() map[string]*ServiceScalingState {
	as.mu.RLock()
	defer as.mu.RUnlock()

	result := make(map[string]*ServiceScalingState)
	for id, state := range as.services {
		result[id] = state
	}

	return result
}

// Enable enables the auto-scaler
func (as *AutoScaler) Enable() {
	as.mu.Lock()
	defer as.mu.Unlock()
	as.enabled = true
}

// Disable disables the auto-scaler
func (as *AutoScaler) Disable() {
	as.mu.Lock()
	defer as.mu.Unlock()
	as.enabled = false
}

// IsEnabled returns whether the auto-scaler is enabled
func (as *AutoScaler) IsEnabled() bool {
	as.mu.RLock()
	defer as.mu.RUnlock()
	return as.enabled
}

// GetScalingSummary returns a summary of scaling activities
func (as *AutoScaler) GetScalingSummary() map[string]interface{} {
	as.mu.RLock()
	defer as.mu.RUnlock()

	totalServices := len(as.services)
	enabledServices := 0
	totalReplicas := 0
	scalingUp := 0
	scalingDown := 0

	for _, state := range as.services {
		if state.Policy != nil && state.Policy.Enabled {
			enabledServices++
		}
		totalReplicas += state.CurrentReplicas

		if state.LastScaleDirection == "scale_up" && time.Since(state.LastScaleAction) < time.Hour {
			scalingUp++
		} else if state.LastScaleDirection == "scale_down" && time.Since(state.LastScaleAction) < time.Hour {
			scalingDown++
		}
	}

	return map[string]interface{}{
		"total_services":   totalServices,
		"enabled_services": enabledServices,
		"total_replicas":   totalReplicas,
		"scaling_up":       scalingUp,
		"scaling_down":     scalingDown,
		"enabled":          as.enabled,
		"check_interval":   as.checkInterval.String(),
	}
}
