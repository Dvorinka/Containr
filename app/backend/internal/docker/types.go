package docker

import (
	"time"

	"github.com/docker/docker/api/types/filters"
	"github.com/docker/docker/api/types/mount"
	"github.com/docker/docker/api/types/network"
	"github.com/docker/go-connections/nat"
)

// ContainerConfig represents the configuration for creating a container
type ContainerConfig struct {
	Name          string
	Image         string
	Cmd           []string
	Env           []string
	Labels        map[string]string
	RestartPolicy string
	ExposedPorts  nat.PortSet
	PortBindings  nat.PortMap
	Mounts        []mount.Mount
	Memory        int64
	NanoCPUs      int64
	NetworkMode   string
	Networks      map[string]*network.EndpointSettings
}

// LogOptions represents options for retrieving container logs
type LogOptions struct {
	Stdout     bool
	Stderr     bool
	Follow     bool
	Tail       string
	Timestamps bool
}

// BuildOptions represents options for building an image
type BuildOptions struct {
	Dockerfile string
	Tags       []string
	BuildArgs  map[string]*string
	Labels     map[string]string
	Remove     bool
}

// NetworkConfig represents the configuration for creating a network
type NetworkConfig struct {
	Name           string
	CheckDuplicate bool
	Driver         string
	Internal       bool
	Labels         map[string]string
}

// VolumeConfig represents the configuration for creating a volume
type VolumeConfig struct {
	Name       string
	Driver     string
	Labels     map[string]string
	DriverOpts map[string]string
}

// EventOptions represents options for filtering Docker events
type EventOptions struct {
	Since   string
	Until   string
	Filters filters.Args
}

// ExecConfig represents the configuration for creating an exec instance
type ExecConfig struct {
	Cmd          []string
	Env          []string
	WorkingDir   string
	User         string
	AttachStdin  bool
	AttachStdout bool
	AttachStderr bool
	Tty          bool
}

// ExecStartConfig represents the configuration for starting an exec instance
type ExecStartConfig struct {
	Detach bool
	Tty    bool
}

// ServiceConfig represents a service configuration for deployment
type ServiceConfig struct {
	Name          string            `json:"name"`
	Image         string            `json:"image"`
	Command       []string          `json:"command,omitempty"`
	Environment   map[string]string `json:"environment,omitempty"`
	Labels        map[string]string `json:"labels,omitempty"`
	RestartPolicy string            `json:"restart_policy"`
	PortMappings  []PortMapping     `json:"port_mappings,omitempty"`
	VolumeMounts  []VolumeMount     `json:"volume_mounts,omitempty"`
	Networks      []string          `json:"networks,omitempty"`
	Resources     ResourceLimits    `json:"resources,omitempty"`
	HealthCheck   *HealthCheck      `json:"health_check,omitempty"`
}

// PortMapping represents a port mapping configuration
type PortMapping struct {
	ContainerPort int32  `json:"container_port"`
	HostPort      int32  `json:"host_port,omitempty"`
	Protocol      string `json:"protocol"` // tcp or udp
	HostIP        string `json:"host_ip,omitempty"`
}

// VolumeMount represents a volume mount configuration
type VolumeMount struct {
	Type        string `json:"type"` // bind, volume, tmpfs
	Source      string `json:"source"`
	Destination string `json:"destination"`
	ReadOnly    bool   `json:"read_only,omitempty"`
	Consistency string `json:"consistency,omitempty"`
}

// ResourceLimits represents resource limits for a container
type ResourceLimits struct {
	MemoryBytes int64 `json:"memory_bytes,omitempty"`
	CPUQuota    int64 `json:"cpu_quota,omitempty"`
	CPUPeriod   int64 `json:"cpu_period,omitempty"`
	CPUShares   int64 `json:"cpu_shares,omitempty"`
}

// HealthCheck represents a health check configuration
type HealthCheck struct {
	Test        []string      `json:"test"`
	Interval    time.Duration `json:"interval"`
	Timeout     time.Duration `json:"timeout"`
	Retries     int           `json:"retries"`
	StartPeriod time.Duration `json:"start_period"`
}

// ServiceStatus represents the status of a service
type ServiceStatus struct {
	ID        string            `json:"id"`
	Name      string            `json:"name"`
	Image     string            `json:"image"`
	Status    string            `json:"status"`
	CreatedAt time.Time         `json:"created_at"`
	StartedAt *time.Time        `json:"started_at,omitempty"`
	Ports     []PortInfo        `json:"ports,omitempty"`
	Networks  []NetworkInfo     `json:"networks,omitempty"`
	Mounts    []MountInfo       `json:"mounts,omitempty"`
	Resources ResourceUsage     `json:"resources"`
	Health    *HealthStatus     `json:"health,omitempty"`
	Labels    map[string]string `json:"labels,omitempty"`
}

// PortInfo represents port information for a running container
type PortInfo struct {
	ContainerPort int32  `json:"container_port"`
	HostPort      int32  `json:"host_port,omitempty"`
	HostIP        string `json:"host_ip"`
	Protocol      string `json:"protocol"`
}

// NetworkInfo represents network information for a container
type NetworkInfo struct {
	Name       string `json:"name"`
	NetworkID  string `json:"network_id"`
	IPAddress  string `json:"ip_address"`
	Gateway    string `json:"gateway,omitempty"`
	MACAddress string `json:"mac_address,omitempty"`
}

// MountInfo represents mount information for a container
type MountInfo struct {
	Type        string `json:"type"`
	Source      string `json:"source"`
	Destination string `json:"destination"`
	ReadOnly    bool   `json:"read_only"`
}

// ResourceUsage represents resource usage for a container
type ResourceUsage struct {
	CPUPercent  float64 `json:"cpu_percent"`
	MemoryUsage int64   `json:"memory_usage"`
	MemoryLimit int64   `json:"memory_limit"`
	NetworkRx   int64   `json:"network_rx"`
	NetworkTx   int64   `json:"network_tx"`
	BlockRead   int64   `json:"block_read"`
	BlockWrite  int64   `json:"block_write"`
	PidsCurrent uint64  `json:"pids_current"`
	PidsLimit   uint64  `json:"pids_limit"`
}

// HealthStatus represents the health status of a container
type HealthStatus struct {
	Status        string    `json:"status"`
	FailingStreak int       `json:"failing_streak"`
	LastCheck     time.Time `json:"last_check"`
}

// RegistryConfig represents Docker registry configuration
type RegistryConfig struct {
	URL      string            `json:"url"`
	Username string            `json:"username,omitempty"`
	Password string            `json:"password,omitempty"`
	Auth     string            `json:"auth,omitempty"`
	Email    string            `json:"email,omitempty"`
	Labels   map[string]string `json:"labels,omitempty"`
}

// ImageInfo represents information about a Docker image
type ImageInfo struct {
	ID          string            `json:"id"`
	RepoTags    []string          `json:"repo_tags"`
	Size        int64             `json:"size"`
	Created     int64             `json:"created"`
	Labels      map[string]string `json:"labels"`
	RepoDigests []string          `json:"repo_digests"`
	Digest      string            `json:"digest"`
}

// BuildContext represents a build context for Docker images
type BuildContext struct {
	Dockerfile string            `json:"dockerfile"`
	Context    string            `json:"context"`
	Tags       []string          `json:"tags"`
	BuildArgs  map[string]string `json:"build_args,omitempty"`
	Labels     map[string]string `json:"labels,omitempty"`
	Target     string            `json:"target,omitempty"`
	NoCache    bool              `json:"no_cache,omitempty"`
	Remove     bool              `json:"remove,omitempty"`
	ForceRm    bool              `json:"force_rm,omitempty"`
	Pull       bool              `json:"pull,omitempty"`
}

// DeploymentConfig represents a deployment configuration
type DeploymentConfig struct {
	Service  ServiceConfig   `json:"service"`
	Replicas int             `json:"replicas"`
	Update   UpdateConfig    `json:"update,omitempty"`
	Rollback RollbackConfig  `json:"rollback,omitempty"`
	Networks []NetworkConfig `json:"networks,omitempty"`
	Volumes  []VolumeConfig  `json:"volumes,omitempty"`
	Secrets  []SecretConfig  `json:"secrets,omitempty"`
	Configs  []ConfigFile    `json:"configs,omitempty"`
}

// UpdateConfig represents update configuration for deployments
type UpdateConfig struct {
	Parallelism     uint          `json:"parallelism"`
	Delay           time.Duration `json:"delay"`
	FailureAction   string        `json:"failure_action"`
	Monitor         time.Duration `json:"monitor"`
	MaxFailureRatio float64       `json:"max_failure_ratio"`
	Order           string        `json:"order"`
}

// RollbackConfig represents rollback configuration
type RollbackConfig struct {
	Parallelism     uint          `json:"parallelism"`
	Delay           time.Duration `json:"delay"`
	FailureAction   string        `json:"failure_action"`
	Monitor         time.Duration `json:"monitor"`
	MaxFailureRatio float64       `json:"max_failure_ratio"`
	Order           string        `json:"order"`
}

// SecretConfig represents a secret configuration
type SecretConfig struct {
	Name     string            `json:"name"`
	Data     string            `json:"data"`
	Labels   map[string]string `json:"labels,omitempty"`
	Driver   string            `json:"driver,omitempty"`
	Template string            `json:"template,omitempty"`
}

// ConfigFile represents a configuration file
type ConfigFile struct {
	Name     string            `json:"name"`
	File     string            `json:"file"`
	Content  string            `json:"content"`
	Labels   map[string]string `json:"labels,omitempty"`
	Template string            `json:"template,omitempty"`
}
