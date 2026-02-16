package proxmox

import (
	"fmt"
	"log"
	"sync"
	"time"
)

// Service manages Proxmox operations
type Service struct {
	client    *Client
	nodeCache map[string]*NodeStats
	cacheMu   sync.RWMutex
	config    Config
}

// Config holds Proxmox configuration
type Config struct {
	BaseURL  string `json:"base_url"`
	Username string `json:"username"`
	Password string `json:"password"`
	TokenID  string `json:"token_id"`
	Token    string `json:"token"`
}

// NewService creates a new Proxmox service
func NewService(config Config) *Service {
	var client *Client

	if config.TokenID != "" && config.Token != "" {
		client = NewClientWithToken(config.BaseURL, config.TokenID, config.Token)
	} else {
		client = NewClient(config.BaseURL, config.Username, config.Password)
	}

	return &Service{
		client:    client,
		nodeCache: make(map[string]*NodeStats),
		config:    config,
	}
}

// GetClusterStatus returns the overall cluster status
func (s *Service) GetClusterStatus() (*ClusterInfo, error) {
	// This would require additional API endpoints for cluster info
	// For now, return basic cluster information
	nodes, err := s.client.GetNodes()
	if err != nil {
		return nil, fmt.Errorf("failed to get cluster nodes: %w", err)
	}

	activeNodes := 0
	for _, node := range nodes {
		if node.Status == "online" {
			activeNodes++
		}
	}

	return &ClusterInfo{
		Name:    "containr-cluster",
		Version: "7.x", // This should be dynamically retrieved
		Nodes:   len(nodes),
		Quorate: activeNodes > 0,
	}, nil
}

// GetAllNodes returns all nodes with their current status
func (s *Service) GetAllNodes() ([]Node, error) {
	return s.client.GetNodes()
}

// GetNodeStats returns detailed statistics for a specific node
func (s *Service) GetNodeStats(nodeName string) (*NodeStats, error) {
	s.cacheMu.RLock()
	if stats, exists := s.nodeCache[nodeName]; exists {
		s.cacheMu.RUnlock()
		return stats, nil
	}
	s.cacheMu.RUnlock()

	// Fetch fresh data
	nodes, err := s.client.GetNodes()
	if err != nil {
		return nil, fmt.Errorf("failed to get nodes: %w", err)
	}

	var targetNode *Node
	for _, node := range nodes {
		if node.Node == nodeName {
			targetNode = &node
			break
		}
	}

	if targetNode == nil {
		return nil, fmt.Errorf("node %s not found", nodeName)
	}

	stats := &NodeStats{
		Node:        targetNode.Node,
		Status:      targetNode.Status,
		CPU:         targetNode.CPU,
		MemoryTotal: targetNode.MaxMemory,
		MemoryUsed:  targetNode.MemoryUsed,
		MemoryFree:  targetNode.MaxMemory - targetNode.MemoryUsed,
		DiskTotal:   targetNode.MaxDisk,
		DiskUsed:    targetNode.DiskUsed,
		DiskFree:    targetNode.MaxDisk - targetNode.DiskUsed,
		Uptime:      targetNode.Uptime,
		LastUpdate:  time.Now(),
	}

	// Update cache
	s.cacheMu.Lock()
	s.nodeCache[nodeName] = stats
	s.cacheMu.Unlock()

	return stats, nil
}

// GetAllVMs returns all VMs across all nodes
func (s *Service) GetAllVMs() ([]VM, error) {
	nodes, err := s.client.GetNodes()
	if err != nil {
		return nil, fmt.Errorf("failed to get nodes: %w", err)
	}

	var allVMs []VM
	for _, node := range nodes {
		if node.Status == "online" {
			vms, err := s.client.GetVMs(node.Node)
			if err != nil {
				log.Printf("Failed to get VMs for node %s: %v", node.Node, err)
				continue
			}
			allVMs = append(allVMs, vms...)
		}
	}

	return allVMs, nil
}

// GetAllContainers returns all containers across all nodes
func (s *Service) GetAllContainers() ([]Container, error) {
	nodes, err := s.client.GetNodes()
	if err != nil {
		return nil, fmt.Errorf("failed to get nodes: %w", err)
	}

	var allContainers []Container
	for _, node := range nodes {
		if node.Status == "online" {
			containers, err := s.client.GetContainers(node.Node)
			if err != nil {
				log.Printf("Failed to get containers for node %s: %v", node.Node, err)
				continue
			}
			allContainers = append(allContainers, containers...)
		}
	}

	return allContainers, nil
}

// CreateServiceVM creates a new VM optimized for running services
func (s *Service) CreateServiceVM(nodeName string, config ServiceVMConfig) (*VM, error) {
	// Find the next available VMID
	vmid, err := s.getNextAvailableVMID(nodeName)
	if err != nil {
		return nil, fmt.Errorf("failed to get next VMID: %w", err)
	}

	vmConfig := VMConfig{
		VMID:          vmid,
		Name:          config.Name,
		Memory:        config.Memory,
		Cores:         config.Cores,
		DiskSize:      config.DiskSize,
		Storage:       config.Storage,
		NetworkBridge: config.NetworkBridge,
		Template:      config.Template,
	}

	taskID, err := s.client.CreateVM(nodeName, vmConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to create VM: %w", err)
	}

	log.Printf("VM creation started with task ID: %s", taskID)

	// Wait for VM to be created and get its status
	time.Sleep(5 * time.Second) // Give Proxmox time to process

	vms, err := s.client.GetVMs(nodeName)
	if err != nil {
		return nil, fmt.Errorf("failed to get VM status after creation: %w", err)
	}

	for _, vm := range vms {
		if vm.VMID == vmid {
			return &vm, nil
		}
	}

	return nil, fmt.Errorf("VM %d not found after creation", vmid)
}

// CreateServiceContainer creates a new LXC container optimized for running services
func (s *Service) CreateServiceContainer(nodeName string, config ServiceContainerConfig) (*Container, error) {
	// Find the next available VMID
	vmid, err := s.getNextAvailableVMID(nodeName)
	if err != nil {
		return nil, fmt.Errorf("failed to get next VMID: %w", err)
	}

	containerConfig := ContainerConfig{
		VMID:          vmid,
		Hostname:      config.Hostname,
		Memory:        config.Memory,
		Cores:         config.Cores,
		DiskSize:      config.DiskSize,
		Storage:       config.Storage,
		NetworkBridge: config.NetworkBridge,
		Template:      config.Template,
	}

	taskID, err := s.client.CreateContainer(nodeName, containerConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to create container: %w", err)
	}

	log.Printf("Container creation started with task ID: %s", taskID)

	// Wait for container to be created and get its status
	time.Sleep(5 * time.Second) // Give Proxmox time to process

	containers, err := s.client.GetContainers(nodeName)
	if err != nil {
		return nil, fmt.Errorf("failed to get container status after creation: %w", err)
	}

	for _, container := range containers {
		if container.VMID == vmid {
			return &container, nil
		}
	}

	return nil, fmt.Errorf("Container %d not found after creation", vmid)
}

// StartInstance starts a VM or container
func (s *Service) StartInstance(nodeName string, vmid int, instanceType string) error {
	switch instanceType {
	case "qemu":
		return s.client.StartVM(nodeName, vmid)
	case "lxc":
		// Implement container start
		return fmt.Errorf("container start not yet implemented")
	default:
		return fmt.Errorf("unknown instance type: %s", instanceType)
	}
}

// StopInstance stops a VM or container
func (s *Service) StopInstance(nodeName string, vmid int, instanceType string) error {
	switch instanceType {
	case "qemu":
		return s.client.StopVM(nodeName, vmid)
	case "lxc":
		// Implement container stop
		return fmt.Errorf("container stop not yet implemented")
	default:
		return fmt.Errorf("unknown instance type: %s", instanceType)
	}
}

// DeleteInstance deletes a VM or container
func (s *Service) DeleteInstance(nodeName string, vmid int, instanceType string) error {
	switch instanceType {
	case "qemu":
		return s.client.DeleteVM(nodeName, vmid)
	case "lxc":
		// Implement container delete
		return fmt.Errorf("container delete not yet implemented")
	default:
		return fmt.Errorf("unknown instance type: %s", instanceType)
	}
}

// GetInstanceStatus returns the status of a VM or container
func (s *Service) GetInstanceStatus(nodeName string, vmid int, instanceType string) (interface{}, error) {
	switch instanceType {
	case "qemu":
		return s.client.GetVMStatus(nodeName, vmid)
	case "lxc":
		// Implement container status
		return nil, fmt.Errorf("container status not yet implemented")
	default:
		return nil, fmt.Errorf("unknown instance type: %s", instanceType)
	}
}

// getNextAvailableVMID finds the next available VM ID on the specified node
func (s *Service) getNextAvailableVMID(nodeName string) (int, error) {
	vms, err := s.client.GetVMs(nodeName)
	if err != nil {
		return 0, err
	}

	containers, err := s.client.GetContainers(nodeName)
	if err != nil {
		return 0, err
	}

	usedIDs := make(map[int]bool)
	for _, vm := range vms {
		usedIDs[vm.VMID] = true
	}
	for _, container := range containers {
		usedIDs[container.VMID] = true
	}

	// Start from 1000 and find the first available ID
	for vmid := 1000; vmid < 9999; vmid++ {
		if !usedIDs[vmid] {
			return vmid, nil
		}
	}

	return 0, fmt.Errorf("no available VM IDs found")
}

// ServiceVMConfig represents configuration for creating a service VM
type ServiceVMConfig struct {
	Name          string `json:"name"`
	Memory        int    `json:"memory"`
	Cores         int    `json:"cores"`
	DiskSize      int    `json:"disk_size"` // in GB
	Storage       string `json:"storage"`
	NetworkBridge string `json:"network_bridge"`
	Template      string `json:"template"`
}

// ServiceContainerConfig represents configuration for creating a service container
type ServiceContainerConfig struct {
	Hostname      string `json:"hostname"`
	Memory        int    `json:"memory"`
	Cores         int    `json:"cores"`
	DiskSize      int    `json:"disk_size"` // in GB
	Storage       string `json:"storage"`
	NetworkBridge string `json:"network_bridge"`
	Template      string `json:"template"`
}

// GetResourceUsage returns resource usage across the cluster
func (s *Service) GetResourceUsage() (map[string]interface{}, error) {
	nodes, err := s.client.GetNodes()
	if err != nil {
		return nil, fmt.Errorf("failed to get nodes: %w", err)
	}

	var totalCPU, usedCPU float64
	var totalMemory, usedMemory, totalDisk, usedDisk int64
	var onlineNodes int

	for _, node := range nodes {
		if node.Status == "online" {
			onlineNodes++
			totalCPU += 1.0 // Assuming 1 CPU per node for simplicity
			usedCPU += node.CPU
			totalMemory += int64(node.MaxMemory)
			usedMemory += int64(node.MemoryUsed)
			totalDisk += int64(node.MaxDisk)
			usedDisk += int64(node.DiskUsed)
		}
	}

	return map[string]interface{}{
		"total_nodes":  len(nodes),
		"online_nodes": onlineNodes,
		"cpu_usage": map[string]interface{}{
			"total": totalCPU,
			"used":  usedCPU,
			"free":  totalCPU - usedCPU,
		},
		"memory_usage": map[string]interface{}{
			"total": totalMemory,
			"used":  usedMemory,
			"free":  totalMemory - usedMemory,
		},
		"disk_usage": map[string]interface{}{
			"total": totalDisk,
			"used":  usedDisk,
			"free":  totalDisk - usedDisk,
		},
	}, nil
}

// ValidateConnection tests the connection to Proxmox
func (s *Service) ValidateConnection() error {
	_, err := s.client.GetNodes()
	if err != nil {
		return fmt.Errorf("failed to connect to Proxmox: %w", err)
	}
	return nil
}

// GetAvailableTemplates returns a list of available VM and container templates
func (s *Service) GetAvailableTemplates(nodeName string) (map[string]interface{}, error) {
	vms, err := s.client.GetVMs(nodeName)
	if err != nil {
		return nil, fmt.Errorf("failed to get VMs: %w", err)
	}

	containers, err := s.client.GetContainers(nodeName)
	if err != nil {
		return nil, fmt.Errorf("failed to get containers: %w", err)
	}

	var vmTemplates []VMTemplate
	for _, vm := range vms {
		if vm.Template {
			vmTemplates = append(vmTemplates, VMTemplate{
				VMID:     vm.VMID,
				Name:     vm.Name,
				Node:     vm.Node,
				Storage:  "local", // This should be dynamically retrieved
				CPU:      2,       // Default values
				Memory:   2048,
				DiskSize: 20,
			})
		}
	}

	var containerTemplates []ContainerTemplate
	for _, container := range containers {
		if container.Template {
			containerTemplates = append(containerTemplates, ContainerTemplate{
				VMID:       container.VMID,
				Name:       container.Name,
				Node:       container.Node,
				Storage:    "local", // This should be dynamically retrieved
				CPU:        1,
				Memory:     512,
				DiskSize:   8,
				OSTemplate: "ubuntu-22.04-standard", // Default template
			})
		}
	}

	return map[string]interface{}{
		"vm_templates":        vmTemplates,
		"container_templates": containerTemplates,
	}, nil
}
