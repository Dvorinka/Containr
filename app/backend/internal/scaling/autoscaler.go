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
	scheduler         *deployment.Scheduler
	metricsCollector  *metrics.MetricsCollector
	policies          map[string]*ScalingPolicy
	services          map[string]*ServiceScalingState
	servicePlacements map[string]map[string]string // service_id -> instance_id -> node_id
	replicaSequence   map[string]int64
	events            []ScaleEvent
	mu                sync.RWMutex
	checkInterval     time.Duration
	cooldownPeriod    time.Duration
	maxStoredEvents   int
	enabled           bool
}

// ScalingPolicy defines how a service should scale
type ScalingPolicy struct {
	ServiceID         string             `json:"service_id"`
	MinReplicas       int                `json:"min_replicas"`
	MaxReplicas       int                `json:"max_replicas"`
	TargetCPU         float64            `json:"target_cpu"`    // Target CPU utilization percentage
	TargetMemory      float64            `json:"target_memory"` // Target memory utilization percentage
	ScaleUpCooldown   time.Duration      `json:"scale_up_cooldown"`
	ScaleDownCooldown time.Duration      `json:"scale_down_cooldown"`
	ScaleUpStep       int                `json:"scale_up_step"`   // How many replicas to add when scaling up
	ScaleDownStep     int                `json:"scale_down_step"` // How many replicas to remove when scaling down
	Metrics           []string           `json:"metrics"`         // Which metrics to consider
	Thresholds        map[string]float64 `json:"thresholds"`      // Custom thresholds for metrics
	Enabled           bool               `json:"enabled"`
	CostOptimization  *CostOptimization  `json:"cost_optimization"`
}

// CostOptimization defines cost-related scaling parameters
type CostOptimization struct {
	MaxCostPerHour   float64       `json:"max_cost_per_hour"`
	PreferEfficiency bool          `json:"prefer_efficiency"`
	IdleTimeout      time.Duration `json:"idle_timeout"`
}

// ServiceScalingState tracks the current scaling state of a service
type ServiceScalingState struct {
	ServiceID          string
	CurrentReplicas    int
	DesiredReplicas    int
	LastScaleAction    time.Time
	LastScaleDirection string // "up" or "down"
	ScaleUpCooldown    time.Time
	ScaleDownCooldown  time.Time
	MetricsHistory     []MetricsSnapshot
	Policy             *ScalingPolicy
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
	ServiceID    string             `json:"service_id"`
	Action       string             `json:"action"` // "scale_up" or "scale_down"
	FromReplicas int                `json:"from_replicas"`
	ToReplicas   int                `json:"to_replicas"`
	Reason       string             `json:"reason"`
	Timestamp    time.Time          `json:"timestamp"`
	Metrics      map[string]float64 `json:"metrics"`
	CostImpact   float64            `json:"cost_impact"`
}

// ScalingDecision contains the decision made by the autoscaler
type ScalingDecision struct {
	ShouldScale     bool               `json:"should_scale"`
	Action          string             `json:"action"`
	CurrentReplicas int                `json:"current_replicas"`
	DesiredReplicas int                `json:"desired_replicas"`
	Reason          string             `json:"reason"`
	Metrics         map[string]float64 `json:"metrics"`
	CostEstimate    float64            `json:"cost_estimate"`
}

// NewAutoScaler creates a new auto-scaler
func NewAutoScaler(scheduler *deployment.Scheduler, metricsCollector *metrics.MetricsCollector) *AutoScaler {
	return &AutoScaler{
		scheduler:         scheduler,
		metricsCollector:  metricsCollector,
		policies:          make(map[string]*ScalingPolicy),
		services:          make(map[string]*ServiceScalingState),
		servicePlacements: make(map[string]map[string]string),
		replicaSequence:   make(map[string]int64),
		events:            make([]ScaleEvent, 0, 200),
		checkInterval:     30 * time.Second,
		cooldownPeriod:    5 * time.Minute,
		maxStoredEvents:   200,
		enabled:           true,
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
	if err := as.scaleServiceOnScheduler(ctx, serviceID, toReplicas); err != nil {
		return fmt.Errorf("failed to apply scheduler scaling plan: %w", err)
	}

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

	as.recordScaleEvent(*event)
	log.Printf("Scaling event: %+v", event)

	return nil
}

// ManualScale performs an immediate, manual scaling action for a service.
func (as *AutoScaler) ManualScale(ctx context.Context, serviceID string, replicas int, reason string) (*ScaleEvent, error) {
	_ = ctx
	if replicas < 1 {
		return nil, fmt.Errorf("replicas must be at least 1")
	}

	as.mu.Lock()
	state, exists := as.services[serviceID]
	if !exists {
		as.mu.Unlock()
		return nil, fmt.Errorf("no scaling state found for service: %s", serviceID)
	}

	if state.Policy != nil {
		if replicas < state.Policy.MinReplicas || replicas > state.Policy.MaxReplicas {
			as.mu.Unlock()
			return nil, fmt.Errorf(
				"requested replicas %d outside policy bounds [%d, %d]",
				replicas,
				state.Policy.MinReplicas,
				state.Policy.MaxReplicas,
			)
		}
	}

	fromReplicas := state.CurrentReplicas
	if reason == "" {
		reason = "manual scaling request"
	}

	action := "manual_scale_noop"
	lastDirection := state.LastScaleDirection
	switch {
	case replicas > fromReplicas:
		action = "manual_scale_up"
		lastDirection = "scale_up"
	case replicas < fromReplicas:
		action = "manual_scale_down"
		lastDirection = "scale_down"
	}

	now := time.Now()
	state.CurrentReplicas = replicas
	state.DesiredReplicas = replicas
	state.LastScaleAction = now
	state.LastScaleDirection = lastDirection
	as.mu.Unlock()

	if err := as.scaleServiceOnScheduler(ctx, serviceID, replicas); err != nil {
		return nil, fmt.Errorf("manual scale applied in state but failed on scheduler: %w", err)
	}

	event := ScaleEvent{
		ServiceID:    serviceID,
		Action:       action,
		FromReplicas: fromReplicas,
		ToReplicas:   replicas,
		Reason:       reason,
		Timestamp:    now,
		Metrics: map[string]float64{
			"requested_replicas": float64(replicas),
		},
		CostImpact: as.estimateServiceCost(serviceID, replicas),
	}
	as.recordScaleEvent(event)

	result := event
	return &result, nil
}

// GetScalingEvents returns recent scale events across services, newest first.
func (as *AutoScaler) GetScalingEvents(limit int) []ScaleEvent {
	as.mu.RLock()
	defer as.mu.RUnlock()

	if limit <= 0 || limit > len(as.events) {
		limit = len(as.events)
	}

	result := make([]ScaleEvent, 0, limit)
	for i := len(as.events) - 1; i >= 0 && len(result) < limit; i-- {
		result = append(result, cloneScaleEvent(as.events[i]))
	}

	return result
}

// GetServiceScalingHistory returns recent scale events for a service, newest first.
func (as *AutoScaler) GetServiceScalingHistory(serviceID string, limit int) []ScaleEvent {
	as.mu.RLock()
	defer as.mu.RUnlock()

	if limit <= 0 {
		limit = len(as.events)
	}

	result := make([]ScaleEvent, 0, limit)
	for i := len(as.events) - 1; i >= 0 && len(result) < limit; i-- {
		if as.events[i].ServiceID == serviceID {
			result = append(result, cloneScaleEvent(as.events[i]))
		}
	}

	return result
}

func (as *AutoScaler) estimateServiceCost(serviceID string, replicas int) float64 {
	as.mu.RLock()
	state := as.services[serviceID]
	as.mu.RUnlock()
	if state == nil {
		return float64(replicas) * 0.01
	}
	return as.estimateScalingCost(state, replicas)
}

func (as *AutoScaler) recordScaleEvent(event ScaleEvent) {
	as.mu.Lock()
	defer as.mu.Unlock()

	as.events = append(as.events, event)
	if as.maxStoredEvents > 0 && len(as.events) > as.maxStoredEvents {
		start := len(as.events) - as.maxStoredEvents
		as.events = as.events[start:]
	}
}

func cloneScaleEvent(event ScaleEvent) ScaleEvent {
	clone := event
	if event.Metrics == nil {
		return clone
	}

	clone.Metrics = make(map[string]float64, len(event.Metrics))
	for key, value := range event.Metrics {
		clone.Metrics[key] = value
	}
	return clone
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
	if replicas <= 0 {
		return 0
	}

	// Basic resource-informed model in USD/hour.
	baseReplicaCost := 0.01
	cpuComponent := math.Max(0, state.Policy.TargetCPU) / 100.0 * 0.02
	memoryComponent := math.Max(0, state.Policy.TargetMemory) * 0.005
	perReplica := baseReplicaCost + cpuComponent + memoryComponent
	total := float64(replicas) * perReplica

	if state.Policy.CostOptimization != nil && state.Policy.CostOptimization.MaxCostPerHour > 0 {
		maxCost := state.Policy.CostOptimization.MaxCostPerHour
		if total > maxCost {
			return maxCost
		}
	}

	return total
}

func (as *AutoScaler) scaleServiceOnScheduler(ctx context.Context, serviceID string, targetReplicas int) error {
	if targetReplicas < 0 {
		return fmt.Errorf("target replicas cannot be negative")
	}
	if as.scheduler == nil {
		return fmt.Errorf("scheduler not initialized")
	}

	select {
	case <-ctx.Done():
		return ctx.Err()
	default:
	}

	as.mu.Lock()
	if _, exists := as.servicePlacements[serviceID]; !exists {
		as.servicePlacements[serviceID] = make(map[string]string)
	}
	placement := make(map[string]string, len(as.servicePlacements[serviceID]))
	for instanceID, nodeID := range as.servicePlacements[serviceID] {
		placement[instanceID] = nodeID
	}
	as.mu.Unlock()

	currentReplicas := len(placement)
	if currentReplicas == targetReplicas {
		return nil
	}

	if currentReplicas < targetReplicas {
		addCount := targetReplicas - currentReplicas
		for i := 0; i < addCount; i++ {
			node, err := as.pickNodeForReplica()
			if err != nil {
				return err
			}
			instanceID := as.nextReplicaInstanceID(serviceID)
			if err := as.addReplicaToNode(node, instanceID); err != nil {
				return err
			}
			placement[instanceID] = node.ID
		}
	} else {
		removeCount := currentReplicas - targetReplicas
		removed := 0
		for instanceID, nodeID := range placement {
			if removed >= removeCount {
				break
			}
			if err := as.removeReplicaFromNode(nodeID, instanceID); err != nil {
				return err
			}
			delete(placement, instanceID)
			removed++
		}
	}

	as.mu.Lock()
	as.servicePlacements[serviceID] = placement
	as.mu.Unlock()

	return nil
}

func (as *AutoScaler) pickNodeForReplica() (*deployment.Node, error) {
	nodes := as.scheduler.GetReadyNodes()
	if len(nodes) == 0 {
		return nil, fmt.Errorf("no ready nodes available for scaling")
	}

	selected := nodes[0]
	for _, node := range nodes[1:] {
		if len(node.Containers) < len(selected.Containers) {
			selected = node
		}
	}

	return selected, nil
}

func (as *AutoScaler) nextReplicaInstanceID(serviceID string) string {
	as.mu.Lock()
	defer as.mu.Unlock()
	as.replicaSequence[serviceID]++
	return fmt.Sprintf("%s-replica-%d", serviceID, as.replicaSequence[serviceID])
}

func (as *AutoScaler) addReplicaToNode(node *deployment.Node, instanceID string) error {
	if node == nil {
		return fmt.Errorf("node is nil")
	}
	updated := *node
	updated.Containers = append(append([]string{}, node.Containers...), instanceID)
	updated.Usage.CPU = math.Min(100, updated.Usage.CPU+2.0)
	updated.Usage.Memory += 128 * 1024 * 1024
	return as.scheduler.UpdateNode(&updated)
}

func (as *AutoScaler) removeReplicaFromNode(nodeID, instanceID string) error {
	nodes := as.scheduler.GetNodes()
	for _, node := range nodes {
		if node.ID != nodeID {
			continue
		}
		updated := *node
		updated.Containers = removeString(node.Containers, instanceID)
		if updated.Usage.CPU >= 2.0 {
			updated.Usage.CPU -= 2.0
		} else {
			updated.Usage.CPU = 0
		}
		if updated.Usage.Memory >= 128*1024*1024 {
			updated.Usage.Memory -= 128 * 1024 * 1024
		} else {
			updated.Usage.Memory = 0
		}
		return as.scheduler.UpdateNode(&updated)
	}

	return fmt.Errorf("node %s not found while removing instance %s", nodeID, instanceID)
}

func removeString(items []string, target string) []string {
	if len(items) == 0 {
		return items
	}

	result := make([]string, 0, len(items))
	for _, item := range items {
		if item == target {
			continue
		}
		result = append(result, item)
	}
	return result
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
		"total_events":     len(as.events),
		"enabled":          as.enabled,
		"check_interval":   as.checkInterval.String(),
	}
}
