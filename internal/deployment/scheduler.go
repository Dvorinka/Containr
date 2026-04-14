package deployment

import (
	"context"
	"fmt"
	"sort"
	"sync"
	"time"

	"containr/internal/docker"
)

type Scheduler struct {
	nodes         map[string]*Node
	mu            sync.RWMutex
	dockerClient  *docker.Client
	schedulingAlg SchedulingAlgorithm
}

type Node struct {
	ID            string            `json:"id"`
	Name          string            `json:"name"`
	Address       string            `json:"address"`
	Status        string            `json:"status"`
	Capacity      ResourceCapacity  `json:"capacity"`
	Usage         NodeResourceUsage `json:"usage"`
	Labels        map[string]string `json:"labels"`
	LastHeartbeat time.Time         `json:"last_heartbeat"`
	Containers    []string          `json:"containers"`
}

type ResourceCapacity struct {
	CPU     int64 `json:"cpu"`     // CPU cores in nanoseconds
	Memory  int64 `json:"memory"`  // Memory in bytes
	Storage int64 `json:"storage"` // Storage in bytes
	Network int64 `json:"network"` // Network bandwidth in bytes per second
}

type NodeResourceUsage struct {
	CPU     float64 `json:"cpu"`     // CPU usage percentage
	Memory  int64   `json:"memory"`  // Memory usage in bytes
	Storage int64   `json:"storage"` // Storage usage in bytes
	Network int64   `json:"network"` // Network usage in bytes per second
}

type SchedulingAlgorithm string

const (
	SchedulingAlgorithmRoundRobin  SchedulingAlgorithm = "round_robin"
	SchedulingAlgorithmLeastLoaded SchedulingAlgorithm = "least_loaded"
	SchedulingAlgorithmBestFit     SchedulingAlgorithm = "best_fit"
	SchedulingAlgorithmRandom      SchedulingAlgorithm = "random"
)

type SchedulingDecision struct {
	NodeID       string      `json:"node_id"`
	Reason       string      `json:"reason"`
	Score        float64     `json:"score"`
	Alternatives []NodeScore `json:"alternatives"`
}

type NodeScore struct {
	NodeID string  `json:"node_id"`
	Score  float64 `json:"score"`
	Reason string  `json:"reason"`
}

func NewScheduler() *Scheduler {
	return &Scheduler{
		nodes:         make(map[string]*Node),
		schedulingAlg: SchedulingAlgorithmLeastLoaded,
	}
}

// RegisterNode registers a new node in the scheduler
func (s *Scheduler) RegisterNode(node *Node) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if _, exists := s.nodes[node.ID]; exists {
		return fmt.Errorf("node already registered: %s", node.ID)
	}

	node.Status = "ready"
	node.LastHeartbeat = time.Now()
	s.nodes[node.ID] = node

	return nil
}

// UnregisterNode removes a node from the scheduler
func (s *Scheduler) UnregisterNode(nodeID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if _, exists := s.nodes[nodeID]; !exists {
		return fmt.Errorf("node not found: %s", nodeID)
	}

	delete(s.nodes, nodeID)
	return nil
}

// UpdateNode updates node information
func (s *Scheduler) UpdateNode(node *Node) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if _, exists := s.nodes[node.ID]; !exists {
		return fmt.Errorf("node not found: %s", node.ID)
	}

	node.LastHeartbeat = time.Now()
	s.nodes[node.ID] = node

	return nil
}

// GetNodes returns all registered nodes
func (s *Scheduler) GetNodes() []*Node {
	s.mu.RLock()
	defer s.mu.RUnlock()

	nodes := make([]*Node, 0, len(s.nodes))
	for _, node := range s.nodes {
		nodes = append(nodes, node)
	}

	return nodes
}

// GetReadyNodes returns only nodes that are ready for scheduling
func (s *Scheduler) GetReadyNodes() []*Node {
	s.mu.RLock()
	defer s.mu.RUnlock()

	nodes := make([]*Node, 0, len(s.nodes))
	for _, node := range s.nodes {
		if node.Status == "ready" && s.isNodeHealthy(node) {
			nodes = append(nodes, node)
		}
	}

	return nodes
}

// ScheduleContainer schedules a container to run on the best available node
func (s *Scheduler) ScheduleContainer(ctx context.Context, requirements ResourceCapacity) (*SchedulingDecision, error) {
	readyNodes := s.GetReadyNodes()
	if len(readyNodes) == 0 {
		return nil, fmt.Errorf("no ready nodes available")
	}

	var decision *SchedulingDecision

	switch s.schedulingAlg {
	case SchedulingAlgorithmRoundRobin:
		decision = s.scheduleRoundRobin(readyNodes, requirements)
	case SchedulingAlgorithmLeastLoaded:
		decision = s.scheduleLeastLoaded(readyNodes, requirements)
	case SchedulingAlgorithmBestFit:
		decision = s.scheduleBestFit(readyNodes, requirements)
	case SchedulingAlgorithmRandom:
		decision = s.scheduleRandom(readyNodes, requirements)
	default:
		return nil, fmt.Errorf("unknown scheduling algorithm: %s", s.schedulingAlg)
	}

	if decision == nil {
		return nil, fmt.Errorf("failed to schedule container")
	}

	return decision, nil
}

// scheduleRoundRobin schedules containers in a round-robin fashion
func (s *Scheduler) scheduleRoundRobin(nodes []*Node, requirements ResourceCapacity) *SchedulingDecision {
	// Find the node with the fewest containers
	var selectedNode *Node
	minContainers := int(^uint(0) >> 1) // Max int

	for _, node := range nodes {
		if len(node.Containers) < minContainers && s.canFitRequirements(node, requirements) {
			selectedNode = node
			minContainers = len(node.Containers)
		}
	}

	if selectedNode == nil {
		return nil
	}

	return &SchedulingDecision{
		NodeID: selectedNode.ID,
		Reason: "Round-robin scheduling",
		Score:  1.0,
	}
}

// scheduleLeastLoaded schedules containers on the least loaded node
func (s *Scheduler) scheduleLeastLoaded(nodes []*Node, requirements ResourceCapacity) *SchedulingDecision {
	var scores []NodeScore

	for _, node := range nodes {
		if !s.canFitRequirements(node, requirements) {
			continue
		}

		score := s.calculateLoadScore(node)
		scores = append(scores, NodeScore{
			NodeID: node.ID,
			Score:  score,
			Reason: "Load-based score",
		})
	}

	if len(scores) == 0 {
		return nil
	}

	// Sort by score (highest first)
	sort.Slice(scores, func(i, j int) bool {
		return scores[i].Score > scores[j].Score
	})

	selected := scores[0]

	return &SchedulingDecision{
		NodeID:       selected.NodeID,
		Reason:       selected.Reason,
		Score:        selected.Score,
		Alternatives: scores[1:],
	}
}

// scheduleBestFit schedules containers on the node with the best resource fit
func (s *Scheduler) scheduleBestFit(nodes []*Node, requirements ResourceCapacity) *SchedulingDecision {
	var scores []NodeScore

	for _, node := range nodes {
		if !s.canFitRequirements(node, requirements) {
			continue
		}

		score := s.calculateFitScore(node, requirements)
		scores = append(scores, NodeScore{
			NodeID: node.ID,
			Score:  score,
			Reason: "Best-fit score",
		})
	}

	if len(scores) == 0 {
		return nil
	}

	// Sort by score (highest first)
	sort.Slice(scores, func(i, j int) bool {
		return scores[i].Score > scores[j].Score
	})

	selected := scores[0]

	return &SchedulingDecision{
		NodeID:       selected.NodeID,
		Reason:       selected.Reason,
		Score:        selected.Score,
		Alternatives: scores[1:],
	}
}

// scheduleRandom schedules containers on a random available node
func (s *Scheduler) scheduleRandom(nodes []*Node, requirements ResourceCapacity) *SchedulingDecision {
	var availableNodes []*Node

	for _, node := range nodes {
		if s.canFitRequirements(node, requirements) {
			availableNodes = append(availableNodes, node)
		}
	}

	if len(availableNodes) == 0 {
		return nil
	}

	// Simple random selection (in production, use proper random)
	selectedNode := availableNodes[0] // For simplicity, just pick the first one

	return &SchedulingDecision{
		NodeID: selectedNode.ID,
		Reason: "Random selection",
		Score:  1.0,
	}
}

// canFitRequirements checks if a node can accommodate the resource requirements
func (s *Scheduler) canFitRequirements(node *Node, requirements ResourceCapacity) bool {
	availableCPU := node.Capacity.CPU - int64(node.Usage.CPU*float64(node.Capacity.CPU)/100)
	availableMemory := node.Capacity.Memory - node.Usage.Memory

	return availableCPU >= requirements.CPU && availableMemory >= requirements.Memory
}

// calculateLoadScore calculates a score based on node load
func (s *Scheduler) calculateLoadScore(node *Node) float64 {
	// Lower load = higher score
	cpuLoad := node.Usage.CPU / 100.0
	memoryLoad := float64(node.Usage.Memory) / float64(node.Capacity.Memory)
	containerLoad := float64(len(node.Containers)) / 10.0 // Assume max 10 containers

	// Combined load score (0-1, where 0 is no load and 1 is full load)
	combinedLoad := (cpuLoad + memoryLoad + containerLoad) / 3.0

	// Convert to score where higher is better (1 - load)
	return 1.0 - combinedLoad
}

// calculateFitScore calculates how well the requirements fit the node
func (s *Scheduler) calculateFitScore(node *Node, requirements ResourceCapacity) float64 {
	availableCPU := node.Capacity.CPU - int64(node.Usage.CPU*float64(node.Capacity.CPU)/100)
	availableMemory := node.Capacity.Memory - node.Usage.Memory

	// Calculate utilization after placing this container
	newCPUUtilization := float64(node.Capacity.CPU-availableCPU+requirements.CPU) / float64(node.Capacity.CPU)
	newMemoryUtilization := float64(node.Capacity.Memory-availableMemory+requirements.Memory) / float64(node.Capacity.Memory)

	// Prefer moderate utilization (not too low, not too high)
	cpuScore := 1.0 - abs(newCPUUtilization-0.7)
	memoryScore := 1.0 - abs(newMemoryUtilization-0.7)

	return (cpuScore + memoryScore) / 2.0
}

// isNodeHealthy checks if a node is healthy based on heartbeat
func (s *Scheduler) isNodeHealthy(node *Node) bool {
	return time.Since(node.LastHeartbeat) < 30*time.Second
}

// abs returns the absolute value of a float64
func abs(x float64) float64 {
	if x < 0 {
		return -x
	}
	return x
}

// SetSchedulingAlgorithm sets the scheduling algorithm
func (s *Scheduler) SetSchedulingAlgorithm(alg SchedulingAlgorithm) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.schedulingAlg = alg
}

// GetNodeStats returns statistics about nodes
func (s *Scheduler) GetNodeStats() map[string]interface{} {
	s.mu.RLock()
	defer s.mu.RUnlock()

	totalNodes := len(s.nodes)
	readyNodes := 0
	unhealthyNodes := 0

	for _, node := range s.nodes {
		if node.Status == "ready" {
			if s.isNodeHealthy(node) {
				readyNodes++
			} else {
				unhealthyNodes++
			}
		}
	}

	return map[string]interface{}{
		"total_nodes":     totalNodes,
		"ready_nodes":     readyNodes,
		"unhealthy_nodes": unhealthyNodes,
		"scheduling_alg":  string(s.schedulingAlg),
	}
}
