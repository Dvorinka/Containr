package api

import (
	"net/http"
	"strconv"

	"containr/internal/proxmox"

	"github.com/gin-gonic/gin"
)

// ProxmoxHandler handles Proxmox-related API endpoints
type ProxmoxHandler struct {
	service *proxmox.Service
}

// NewProxmoxHandler creates a new Proxmox handler
func NewProxmoxHandler(service *proxmox.Service) *ProxmoxHandler {
	return &ProxmoxHandler{
		service: service,
	}
}

// RegisterProxmoxRoutes registers Proxmox API routes
func RegisterProxmoxRoutes(router *gin.Engine, service *proxmox.Service) {
	handler := NewProxmoxHandler(service)

	proxmox := router.Group("/api/proxmox")
	{
		// Cluster and node management
		proxmox.GET("/cluster/status", handler.getClusterStatus)
		proxmox.GET("/nodes", handler.getNodes)
		proxmox.GET("/nodes/:nodeName/stats", handler.getNodeStats)
		proxmox.GET("/nodes/:nodeName/templates", handler.getTemplates)

		// VM management
		proxmox.GET("/vms", handler.getAllVMs)
		proxmox.GET("/vms/:vmid/status", handler.getVMStatus)
		proxmox.POST("/vms", handler.createVM)
		proxmox.POST("/vms/:vmid/start", handler.startVM)
		proxmox.POST("/vms/:vmid/stop", handler.stopVM)
		proxmox.DELETE("/vms/:vmid", handler.deleteVM)

		// Container management
		proxmox.GET("/containers", handler.getAllContainers)
		proxmox.POST("/containers", handler.createContainer)
		proxmox.POST("/containers/:vmid/start", handler.startContainer)
		proxmox.POST("/containers/:vmid/stop", handler.stopContainer)
		proxmox.DELETE("/containers/:vmid", handler.deleteContainer)

		// Resource management
		proxmox.GET("/resources/usage", handler.getResourceUsage)
		proxmox.GET("/health", handler.healthCheck)
	}
}

// getClusterStatus returns the overall cluster status
func (h *ProxmoxHandler) getClusterStatus(c *gin.Context) {
	status, err := h.service.GetClusterStatus()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": status})
}

// getNodes returns all nodes in the cluster
func (h *ProxmoxHandler) getNodes(c *gin.Context) {
	nodes, err := h.service.GetAllNodes()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": nodes})
}

// getNodeStats returns detailed statistics for a specific node
func (h *ProxmoxHandler) getNodeStats(c *gin.Context) {
	nodeName := c.Param("nodeName")
	
	stats, err := h.service.GetNodeStats(nodeName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": stats})
}

// getTemplates returns available VM and container templates
func (h *ProxmoxHandler) getTemplates(c *gin.Context) {
	nodeName := c.Param("nodeName")
	
	templates, err := h.service.GetAvailableTemplates(nodeName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": templates})
}

// getAllVMs returns all VMs across all nodes
func (h *ProxmoxHandler) getAllVMs(c *gin.Context) {
	vms, err := h.service.GetAllVMs()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": vms})
}

// getVMStatus returns the status of a specific VM
func (h *ProxmoxHandler) getVMStatus(c *gin.Context) {
	vmidStr := c.Param("vmid")
	vmid, err := strconv.Atoi(vmidStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid VM ID"})
		return
	}

	// For now, we'll need to determine the node - this could be improved
	// by maintaining a VM-to-node mapping
	nodes, err := h.service.GetAllNodes()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Try each node until we find the VM
	for _, node := range nodes {
		if node.Status == "online" {
			status, err := h.service.GetInstanceStatus(node.Node, vmid, "qemu")
			if err == nil {
				c.JSON(http.StatusOK, gin.H{"data": status})
				return
			}
		}
	}

	c.JSON(http.StatusNotFound, gin.H{"error": "VM not found"})
}

// createVM creates a new VM
func (h *ProxmoxHandler) createVM(c *gin.Context) {
	var config proxmox.ServiceVMConfig
	if err := c.ShouldBindJSON(&config); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// For now, use the first available online node
	// In a production system, you'd want smarter node selection
	nodes, err := h.service.GetAllNodes()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	var targetNode string
	for _, node := range nodes {
		if node.Status == "online" {
			targetNode = node.Node
			break
		}
	}

	if targetNode == "" {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "No online nodes available"})
		return
	}

	vm, err := h.service.CreateServiceVM(targetNode, config)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"data": vm})
}

// startVM starts a VM
func (h *ProxmoxHandler) startVM(c *gin.Context) {
	vmidStr := c.Param("vmid")
	vmid, err := strconv.Atoi(vmidStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid VM ID"})
		return
	}

	// Find which node the VM is on
	vms, err := h.service.GetAllVMs()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	var nodeName string
	for _, vm := range vms {
		if vm.VMID == vmid {
			nodeName = vm.Node
			break
		}
	}

	if nodeName == "" {
		c.JSON(http.StatusNotFound, gin.H{"error": "VM not found"})
		return
	}

	err = h.service.StartInstance(nodeName, vmid, "qemu")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "VM started successfully"})
}

// stopVM stops a VM
func (h *ProxmoxHandler) stopVM(c *gin.Context) {
	vmidStr := c.Param("vmid")
	vmid, err := strconv.Atoi(vmidStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid VM ID"})
		return
	}

	// Find which node the VM is on
	vms, err := h.service.GetAllVMs()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	var nodeName string
	for _, vm := range vms {
		if vm.VMID == vmid {
			nodeName = vm.Node
			break
		}
	}

	if nodeName == "" {
		c.JSON(http.StatusNotFound, gin.H{"error": "VM not found"})
		return
	}

	err = h.service.StopInstance(nodeName, vmid, "qemu")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "VM stopped successfully"})
}

// deleteVM deletes a VM
func (h *ProxmoxHandler) deleteVM(c *gin.Context) {
	vmidStr := c.Param("vmid")
	vmid, err := strconv.Atoi(vmidStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid VM ID"})
		return
	}

	// Find which node the VM is on
	vms, err := h.service.GetAllVMs()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	var nodeName string
	for _, vm := range vms {
		if vm.VMID == vmid {
			nodeName = vm.Node
			break
		}
	}

	if nodeName == "" {
		c.JSON(http.StatusNotFound, gin.H{"error": "VM not found"})
		return
	}

	err = h.service.DeleteInstance(nodeName, vmid, "qemu")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "VM deleted successfully"})
}

// getAllContainers returns all containers across all nodes
func (h *ProxmoxHandler) getAllContainers(c *gin.Context) {
	containers, err := h.service.GetAllContainers()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": containers})
}

// createContainer creates a new container
func (h *ProxmoxHandler) createContainer(c *gin.Context) {
	var config proxmox.ServiceContainerConfig
	if err := c.ShouldBindJSON(&config); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// For now, use the first available online node
	nodes, err := h.service.GetAllNodes()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	var targetNode string
	for _, node := range nodes {
		if node.Status == "online" {
			targetNode = node.Node
			break
		}
	}

	if targetNode == "" {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "No online nodes available"})
		return
	}

	container, err := h.service.CreateServiceContainer(targetNode, config)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"data": container})
}

// startContainer starts a container
func (h *ProxmoxHandler) startContainer(c *gin.Context) {
	vmidStr := c.Param("vmid")
	vmid, err := strconv.Atoi(vmidStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid container ID"})
		return
	}

	// Find which node the container is on
	containers, err := h.service.GetAllContainers()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	var nodeName string
	for _, container := range containers {
		if container.VMID == vmid {
			nodeName = container.Node
			break
		}
	}

	if nodeName == "" {
		c.JSON(http.StatusNotFound, gin.H{"error": "Container not found"})
		return
	}

	err = h.service.StartInstance(nodeName, vmid, "lxc")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Container started successfully"})
}

// stopContainer stops a container
func (h *ProxmoxHandler) stopContainer(c *gin.Context) {
	vmidStr := c.Param("vmid")
	vmid, err := strconv.Atoi(vmidStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid container ID"})
		return
	}

	// Find which node the container is on
	containers, err := h.service.GetAllContainers()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	var nodeName string
	for _, container := range containers {
		if container.VMID == vmid {
			nodeName = container.Node
			break
		}
	}

	if nodeName == "" {
		c.JSON(http.StatusNotFound, gin.H{"error": "Container not found"})
		return
	}

	err = h.service.StopInstance(nodeName, vmid, "lxc")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Container stopped successfully"})
}

// deleteContainer deletes a container
func (h *ProxmoxHandler) deleteContainer(c *gin.Context) {
	vmidStr := c.Param("vmid")
	vmid, err := strconv.Atoi(vmidStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid container ID"})
		return
	}

	// Find which node the container is on
	containers, err := h.service.GetAllContainers()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	var nodeName string
	for _, container := range containers {
		if container.VMID == vmid {
			nodeName = container.Node
			break
		}
	}

	if nodeName == "" {
		c.JSON(http.StatusNotFound, gin.H{"error": "Container not found"})
		return
	}

	err = h.service.DeleteInstance(nodeName, vmid, "lxc")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Container deleted successfully"})
}

// getResourceUsage returns resource usage across the cluster
func (h *ProxmoxHandler) getResourceUsage(c *gin.Context) {
	usage, err := h.service.GetResourceUsage()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": usage})
}

// healthCheck validates the connection to Proxmox
func (h *ProxmoxHandler) healthCheck(c *gin.Context) {
	err := h.service.ValidateConnection()
	if err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"status": "unhealthy",
			"error":  err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status": "healthy",
		"message": "Proxmox connection is working",
	})
}
