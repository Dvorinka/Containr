package proxmox

import "time"

// Node represents a Proxmox cluster node
type Node struct {
	Node       string `json:"node"`
	Status     string `json:"status"`
	CPU        float64 `json:"cpu"`
	Memory     int    `json:"mem"`
	MemoryUsed int    `json:"mem"`
	MaxMemory  int    `json:"maxmem"`
	Disk       int    `json:"disk"`
	DiskUsed   int    `json:"diskused"`
	MaxDisk    int    `json:"maxdisk"`
	Uptime     int    `json:"uptime"`
	Level      string `json:"level"`
	ID         string `json:"id"`
	Type       string `json:"type"`
}

// VM represents a virtual machine in Proxmox
type VM struct {
	VMID        int     `json:"vmid"`
	Name        string  `json:"name"`
	Status      string  `json:"status"`
	CPU         float64 `json:"cpu"`
	Memory      int     `json:"mem"`
	MemoryUsed  int     `json:"maxmem"`
	Disk        int     `json:"disk"`
	DiskUsed    int     `json:"maxdisk"`
	Uptime      int     `json:"uptime"`
	Template    bool    `json:"template"`
	Node        string  `json:"node"`
	Type        string  `json:"type"`
	NetIn       int64   `json:"netin"`
	NetOut      int64   `json:"netout"`
	DiskRead    int64   `json:"diskread"`
	DiskWrite   int64   `json:"diskwrite"`
	CPUUsage    float64 `json:"cpuusage"`
}

// Container represents an LXC container in Proxmox
type Container struct {
	VMID        int     `json:"vmid"`
	Name        string  `json:"name"`
	Status      string  `json:"status"`
	CPU         float64 `json:"cpu"`
	Memory      int     `json:"mem"`
	MemoryUsed  int     `json:"maxmem"`
	Disk        int     `json:"disk"`
	DiskUsed    int     `json:"maxdisk"`
	Uptime      int     `json:"uptime"`
	Template    bool    `json:"template"`
	Node        string  `json:"node"`
	Type        string  `json:"type"`
	NetIn       int64   `json:"netin"`
	NetOut      int64   `json:"netout"`
	DiskRead    int64   `json:"diskread"`
	DiskWrite   int64   `json:"diskwrite"`
	CPUUsage    float64 `json:"cpuusage"`
}

// VMConfig represents the configuration for creating a VM
type VMConfig struct {
	VMID           int    `json:"vmid"`
	Name           string `json:"name"`
	Memory         int    `json:"memory"`
	Cores          int    `json:"cores"`
	DiskSize       int    `json:"disk_size"` // in GB
	Storage        string `json:"storage"`
	NetworkBridge  string `json:"network_bridge"`
	Template       string `json:"template,omitempty"`
}

// ContainerConfig represents the configuration for creating an LXC container
type ContainerConfig struct {
	VMID           int    `json:"vmid"`
	Hostname       string `json:"hostname"`
	Memory         int    `json:"memory"`
	Cores          int    `json:"cores"`
	DiskSize       int    `json:"disk_size"` // in GB
	Storage        string `json:"storage"`
	NetworkBridge  string `json:"network_bridge"`
	Template       string `json:"template"`
}

// VMStatus represents the current status of a VM
type VMStatus struct {
	VMID       int    `json:"vmid"`
	Name       string `json:"name"`
	Status     string `json:"status"`
	CPU        float64 `json:"cpu"`
	Memory     int    `json:"mem"`
	MemoryUsed int    `json:"maxmem"`
	Disk       int    `json:"disk"`
	DiskUsed   int    `json:"maxdisk"`
	Uptime     int    `json:"uptime"`
	Lock       string `json:"lock,omitempty"`
	HA         bool   `json:"ha"`
	QMPStatus  string `json:"qmpstatus"`
	Spice      bool   `json:"spice"`
	Template   bool   `json:"template"`
	Agent      bool   `json:"agent"`
}

// ContainerStatus represents the current status of a container
type ContainerStatus struct {
	VMID       int    `json:"vmid"`
	Name       string `json:"name"`
	Status     string `json:"status"`
	CPU        float64 `json:"cpu"`
	Memory     int    `json:"mem"`
	MemoryUsed int    `json:"maxmem"`
	Disk       int    `json:"disk"`
	DiskUsed   int    `json:"maxdisk"`
	Uptime     int    `json:"uptime"`
	Lock       string `json:"lock,omitempty"`
	HA         bool   `json:"ha"`
	Template   bool   `json:"template"`
}

// NodeStats represents detailed statistics for a node
type NodeStats struct {
	Node            string    `json:"node"`
	Status          string    `json:"status"`
	CPU             float64   `json:"cpu"`
	MemoryTotal     int       `json:"memory_total"`
	MemoryUsed      int       `json:"memory_used"`
	MemoryFree      int       `json:"memory_free"`
	DiskTotal       int       `json:"disk_total"`
	DiskUsed        int       `json:"disk_used"`
	DiskFree        int       `json:"disk_free"`
	Uptime          int       `json:"uptime"`
	LoadAverage     []float64 `json:"load_average"`
	NetworkIn       int64     `json:"network_in"`
	NetworkOut      int64     `json:"network_out"`
	LastUpdate      time.Time `json:"last_update"`
}

// VMTemplate represents a VM template that can be cloned
type VMTemplate struct {
	VMID     int    `json:"vmid"`
	Name     string `json:"name"`
	Node     string `json:"node"`
	Storage  string `json:"storage"`
	Size     int    `json:"size"`
	CPU      int    `json:"cpu"`
	Memory   int    `json:"memory"`
	DiskSize int    `json:"disk_size"`
}

// ContainerTemplate represents an LXC template that can be cloned
type ContainerTemplate struct {
	VMID       int    `json:"vmid"`
	Name       string `json:"name"`
	Node       string `json:"node"`
	Storage    string `json:"storage"`
	Size       int    `json:"size"`
	CPU        int    `json:"cpu"`
	Memory     int    `json:"memory"`
	DiskSize   int    `json:"disk_size"`
	OSTemplate string `json:"os_template"`
}

// StorageInfo represents storage information on a node
type StorageInfo struct {
	Storage     string `json:"storage"`
	Node        string `json:"node"`
	Type        string `json:"type"`
	Total       int    `json:"total"`
	Used        int    `json:"used"`
	Available   int    `json:"avail"`
	Shared      bool   `json:"shared"`
	Content     string `json:"content"`
	Active      bool   `json:"active"`
	Enabled     bool   `json:"enabled"`
	ReadOnly    bool   `json:"read_only"`
}

// NetworkInfo represents network interface information
type NetworkInfo struct {
	Name       string `json:"name"`
	Type       string `json:"type"`
	Active     bool   `json:"active"`
	MACAddress string `json:"mac"`
	Bridge     string `json:"bridge"`
	IP         string `json:"ip"`
	CIDR       string `json:"cidr"`
	Gateway    string `json:"gateway"`
	DNS        string `json:"dns"`
}

// TaskInfo represents a task running on Proxmox
type TaskInfo struct {
	UPID       string    `json:"upid"`
	Node       string    `json:"node"`
	Type       string    `json:"type"`
	Status     string    `json:"status"`
	User       string    `json:"user"`
	StartTime  time.Time `json:"starttime"`
	EndTime    time.Time `json:"endtime"`
	Duration   string    `json:"duration"`
	PID        int       `json:"pid"`
}

// ClusterInfo represents cluster information
type ClusterInfo struct {
	Name     string `json:"name"`
	Version  string `json:"version"`
	Nodes    int    `json:"nodes"`
	Quorate  bool   `json:"quorate"`
	Links    int    `json:"links"`
	Messages string `json:"messages"`
}

// Resource represents a generic resource in Proxmox
type Resource struct {
	ID     string `json:"id"`
	Type   string `json:"type"`
	Node   string `json:"node"`
	Name   string `json:"name"`
	Status string `json:"status"`
	Level  string `json:"level"`
}

// Pool represents a resource pool
type Pool struct {
	PoolID string `json:"poolid"`
	Name   string `json:"name"`
	Comment string `json:"comment,omitempty"`
}

// User represents a Proxmox user
type User struct {
	UserID      string   `json:"userid"`
	Realm       string   `json:"realm"`
	Enabled     bool     `json:"enabled"`
	Email       string   `json:"email,omitempty"`
	FirstName   string   `json:"firstname,omitempty"`
	LastName    string   `json:"lastname,omitempty"`
	Groups      []string `json:"groups,omitempty"`
	Comment     string   `json:"comment,omitempty"`
	Expire      int      `json:"expire,omitempty"`
	LastLogin   int64    `json:"last_login,omitempty"`
}

// Role represents a Proxmox user role
type Role struct {
	RoleID  string   `json:"roleid"`
	Privs   []string `json:"privs,omitempty"`
	Special bool     `json:"special,omitempty"`
}

// Permission represents a permission in Proxmox
type Permission struct {
	Path     string `json:"path"`
	Role     string `json:"role"`
	User     string `json:"user,omitempty"`
	Group    string `json:"group,omitempty"`
	Realm    string `json:"realm,omitempty"`
}
