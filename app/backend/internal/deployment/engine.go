package deployment

import (
	"context"
	"fmt"
	"log"
	"time"

	"containr/internal/build"
	"containr/internal/docker"
	"containr/internal/types"

	"github.com/docker/docker/api/types/mount"
	"github.com/docker/docker/api/types/network"
	"github.com/docker/go-connections/nat"
)

type DeploymentEngine struct {
	buildManager  *build.BuildManager
	dockerClient  *docker.Client
	scheduler     *Scheduler
	deployments   map[string]*Deployment
	deploymentLog chan *DeploymentEvent
}

type Deployment struct {
	ID          string            `json:"id"`
	ProjectID   string            `json:"project_id"`
	ServiceID   string            `json:"service_id"`
	Status      string            `json:"status"`
	ImageName   string            `json:"image_name"`
	ImageTag    string            `json:"image_tag"`
	Environment string            `json:"environment"`
	Replicas    int               `json:"replicas"`
	Config      ServiceConfig     `json:"config"`
	CreatedAt   time.Time         `json:"created_at"`
	StartedAt   *time.Time        `json:"started_at,omitempty"`
	CompletedAt *time.Time        `json:"completed_at,omitempty"`
	Containers  []ContainerInfo   `json:"containers"`
	BuildLog    string            `json:"build_log"`
	DeployLog   string            `json:"deploy_log"`
	Error       string            `json:"error,omitempty"`
	Metadata    map[string]string `json:"metadata"`
}

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
	Replicas      int               `json:"replicas"`
}

type PortMapping struct {
	ContainerPort int32  `json:"container_port"`
	HostPort      int32  `json:"host_port,omitempty"`
	Protocol      string `json:"protocol"`
	HostIP        string `json:"host_ip,omitempty"`
}

type VolumeMount struct {
	Type        string `json:"type"`
	Source      string `json:"source"`
	Destination string `json:"destination"`
	ReadOnly    bool   `json:"read_only,omitempty"`
}

type ResourceLimits struct {
	MemoryBytes int64 `json:"memory_bytes,omitempty"`
	CPUQuota    int64 `json:"cpu_quota,omitempty"`
	CPUPeriod   int64 `json:"cpu_period,omitempty"`
	CPUShares   int64 `json:"cpu_shares,omitempty"`
}

type HealthCheck struct {
	Test        []string      `json:"test"`
	Interval    time.Duration `json:"interval"`
	Timeout     time.Duration `json:"timeout"`
	Retries     int           `json:"retries"`
	StartPeriod time.Duration `json:"start_period"`
}

type ContainerInfo struct {
	ID        string        `json:"id"`
	Name      string        `json:"name"`
	Status    string        `json:"status"`
	CreatedAt time.Time     `json:"created_at"`
	StartedAt time.Time     `json:"started_at"`
	Ports     []PortInfo    `json:"ports,omitempty"`
	Resources ResourceUsage `json:"resources"`
	Health    *HealthStatus `json:"health,omitempty"`
}

type PortInfo struct {
	ContainerPort int32  `json:"container_port"`
	HostPort      int32  `json:"host_port,omitempty"`
	HostIP        string `json:"host_ip"`
	Protocol      string `json:"protocol"`
}

type ResourceUsage struct {
	CPUPercent  float64 `json:"cpu_percent"`
	MemoryUsage int64   `json:"memory_usage"`
	MemoryLimit int64   `json:"memory_limit"`
	NetworkRx   int64   `json:"network_rx"`
	NetworkTx   int64   `json:"network_tx"`
}

type HealthStatus struct {
	Status        string    `json:"status"`
	FailingStreak int       `json:"failing_streak"`
	LastCheck     time.Time `json:"last_check"`
}

type DeploymentEvent struct {
	Type       string      `json:"type"`
	Deployment *Deployment `json:"deployment"`
	Timestamp  time.Time   `json:"timestamp"`
	Message    string      `json:"message"`
}

type DeploymentRequest struct {
	ProjectID   string        `json:"project_id"`
	ServiceID   string        `json:"service_id"`
	Environment string        `json:"environment"`
	Config      ServiceConfig `json:"config"`
	BuildConfig *BuildConfig  `json:"build_config,omitempty"`
	Trigger     TriggerConfig `json:"trigger"`
}

type BuildConfig struct {
	BuildType     string            `json:"build_type"`
	SourcePath    string            `json:"source_path"`
	PrebuiltImage string            `json:"prebuilt_image"`
	BuildCommand  string            `json:"build_command"`
	StartCommand  string            `json:"start_command"`
	Environment   map[string]string `json:"environment"`
	Branch        string            `json:"branch"`
	Commit        string            `json:"commit"`
}

type TriggerConfig struct {
	Type      string            `json:"type"`      // webhook, manual, api, scheduled
	Source    string            `json:"source"`    // Source of trigger
	User      string            `json:"user"`      // User who triggered
	Data      map[string]string `json:"data"`      // Trigger-specific data
	Timestamp time.Time         `json:"timestamp"` // When trigger occurred
}

func NewDeploymentEngine(buildManager *build.BuildManager, dockerClient *docker.Client) *DeploymentEngine {
	return &DeploymentEngine{
		buildManager:  buildManager,
		dockerClient:  dockerClient,
		scheduler:     NewScheduler(),
		deployments:   make(map[string]*Deployment),
		deploymentLog: make(chan *DeploymentEvent, 1000),
	}
}

// Deploy starts a new deployment
func (de *DeploymentEngine) Deploy(ctx context.Context, req *DeploymentRequest) (*Deployment, error) {
	deployment := &Deployment{
		ID:          generateDeploymentID(),
		ProjectID:   req.ProjectID,
		ServiceID:   req.ServiceID,
		Status:      "pending",
		Environment: req.Environment,
		Config:      req.Config,
		CreatedAt:   time.Now(),
		Metadata: map[string]string{
			"trigger_type":   req.Trigger.Type,
			"trigger_source": req.Trigger.Source,
			"branch":         req.BuildConfig.Branch,
			"commit":         req.BuildConfig.Commit,
		},
	}

	// Store deployment
	de.deployments[deployment.ID] = deployment

	// Log deployment start
	de.logEvent(&DeploymentEvent{
		Type:       "deployment_started",
		Deployment: deployment,
		Timestamp:  time.Now(),
		Message:    fmt.Sprintf("Deployment started for service %s", req.ServiceID),
	})

	// Start deployment in background
	go de.executeDeployment(ctx, deployment, req)

	return deployment, nil
}

// executeDeployment executes the deployment process
func (de *DeploymentEngine) executeDeployment(ctx context.Context, deployment *Deployment, req *DeploymentRequest) {
	deployment.Status = "building"
	deployment.StartedAt = &[]time.Time{time.Now()}[0]

	de.logEvent(&DeploymentEvent{
		Type:       "build_started",
		Deployment: deployment,
		Timestamp:  time.Now(),
		Message:    "Build process started",
	})

	// Step 1: Build the image
	imageName, err := de.buildImage(ctx, deployment, req.BuildConfig)
	if err != nil {
		deployment.Status = "failed"
		deployment.Error = fmt.Sprintf("Build failed: %v", err)
		deployment.CompletedAt = &[]time.Time{time.Now()}[0]

		de.logEvent(&DeploymentEvent{
			Type:       "build_failed",
			Deployment: deployment,
			Timestamp:  time.Now(),
			Message:    deployment.Error,
		})
		return
	}

	deployment.ImageName = imageName
	deployment.Status = "deploying"

	de.logEvent(&DeploymentEvent{
		Type:       "build_completed",
		Deployment: deployment,
		Timestamp:  time.Now(),
		Message:    fmt.Sprintf("Build completed successfully: %s", imageName),
	})

	// Step 2: Deploy the service
	err = de.deployService(ctx, deployment)
	if err != nil {
		deployment.Status = "failed"
		deployment.Error = fmt.Sprintf("Deployment failed: %v", err)
		deployment.CompletedAt = &[]time.Time{time.Now()}[0]

		de.logEvent(&DeploymentEvent{
			Type:       "deployment_failed",
			Deployment: deployment,
			Timestamp:  time.Now(),
			Message:    deployment.Error,
		})
		return
	}

	deployment.Status = "running"
	deployment.CompletedAt = &[]time.Time{time.Now()}[0]

	de.logEvent(&DeploymentEvent{
		Type:       "deployment_completed",
		Deployment: deployment,
		Timestamp:  time.Now(),
		Message:    "Deployment completed successfully",
	})
}

// buildImage builds the container image
func (de *DeploymentEngine) buildImage(ctx context.Context, deployment *Deployment, buildConfig *BuildConfig) (string, error) {
	if buildConfig == nil {
		return "", fmt.Errorf("build config is required")
	}

	buildReq := &types.BuildRequest{
		BuildType:     buildConfig.BuildType,
		SourcePath:    buildConfig.SourcePath,
		PrebuiltImage: buildConfig.PrebuiltImage,
		ImageName:     fmt.Sprintf("containr-%s-%s", deployment.ServiceID, deployment.Environment),
		ImageTag:      deployment.ID,
		BuildCommand:  buildConfig.BuildCommand,
		StartCommand:  buildConfig.StartCommand,
		Environment:   buildConfig.Environment,
		ProjectID:     deployment.ProjectID,
		ServiceID:     deployment.ServiceID,
		DeploymentID:  deployment.ID,
		TriggeredBy:   "deployment_engine",
		Branch:        buildConfig.Branch,
		Commit:        buildConfig.Commit,
	}

	response, err := de.buildManager.Build(ctx, buildReq)
	if err != nil {
		return "", err
	}

	deployment.BuildLog = response.BuildLog

	return response.ImageName, nil
}

// deployService deploys the service using the built image
func (de *DeploymentEngine) deployService(ctx context.Context, deployment *Deployment) error {
	// Convert service config to Docker container config
	containerConfig := &docker.ContainerConfig{
		Name:     fmt.Sprintf("containr-%s-%s", deployment.ServiceID, deployment.ID),
		Image:    deployment.ImageName,
		Cmd:      deployment.Config.Command,
		Labels:   deployment.Config.Labels,
		Networks: make(map[string]*network.EndpointSettings),
	}

	// Set environment variables
	for k, v := range deployment.Config.Environment {
		containerConfig.Env = append(containerConfig.Env, fmt.Sprintf("%s=%s", k, v))
	}

	// Set restart policy
	containerConfig.RestartPolicy = deployment.Config.RestartPolicy

	// Configure port mappings
	portBindings := make(nat.PortMap)
	for _, pm := range deployment.Config.PortMappings {
		port := nat.Port(fmt.Sprintf("%d/%s", pm.ContainerPort, pm.Protocol))
		if pm.HostPort > 0 {
			portBindings[port] = []nat.PortBinding{
				{
					HostIP:   pm.HostIP,
					HostPort: fmt.Sprintf("%d", pm.HostPort),
				},
			}
		}
	}
	containerConfig.PortBindings = portBindings

	// Configure resource limits
	if deployment.Config.Resources.MemoryBytes > 0 {
		containerConfig.Memory = deployment.Config.Resources.MemoryBytes
	}
	if deployment.Config.Resources.CPUQuota > 0 {
		containerConfig.NanoCPUs = deployment.Config.Resources.CPUQuota
	}

	// Configure volume mounts
	for _, vm := range deployment.Config.VolumeMounts {
		mount := mount.Mount{
			Type:     mount.Type(vm.Type),
			Source:   vm.Source,
			Target:   vm.Destination,
			ReadOnly: vm.ReadOnly,
		}
		containerConfig.Mounts = append(containerConfig.Mounts, mount)
	}

	// Create containers based on replica count
	deployment.Containers = make([]ContainerInfo, deployment.Config.Replicas)
	for i := 0; i < deployment.Config.Replicas; i++ {
		containerName := fmt.Sprintf("%s-%d", containerConfig.Name, i)

		// Create container
		containerID, err := de.dockerClient.CreateContainer(ctx, *containerConfig)
		if err != nil {
			return fmt.Errorf("failed to create container %d: %w", i, err)
		}

		// Start container
		err = de.dockerClient.StartContainer(ctx, containerID)
		if err != nil {
			return fmt.Errorf("failed to start container %d: %w", i, err)
		}

		// Get container info
		_, err = de.dockerClient.GetContainer(ctx, containerID)
		if err != nil {
			log.Printf("Failed to get container info for %s: %v", containerID, err)
		}

		deployment.Containers[i] = ContainerInfo{
			ID:        containerID,
			Name:      containerName,
			Status:    "running",
			CreatedAt: time.Now(),
			StartedAt: time.Now(),
		}
	}

	return nil
}

// GetDeployment gets a deployment by ID
func (de *DeploymentEngine) GetDeployment(id string) (*Deployment, error) {
	deployment, exists := de.deployments[id]
	if !exists {
		return nil, fmt.Errorf("deployment not found: %s", id)
	}
	return deployment, nil
}

// ListDeployments lists all deployments
func (de *DeploymentEngine) ListDeployments(projectID, serviceID string) ([]*Deployment, error) {
	var deployments []*Deployment

	for _, deployment := range de.deployments {
		if projectID != "" && deployment.ProjectID != projectID {
			continue
		}
		if serviceID != "" && deployment.ServiceID != serviceID {
			continue
		}
		deployments = append(deployments, deployment)
	}

	return deployments, nil
}

// CancelDeployment cancels a running deployment
func (de *DeploymentEngine) CancelDeployment(ctx context.Context, id string) error {
	deployment, exists := de.deployments[id]
	if !exists {
		return fmt.Errorf("deployment not found: %s", id)
	}

	if deployment.Status == "completed" || deployment.Status == "failed" {
		return fmt.Errorf("cannot cancel completed deployment: %s", id)
	}

	// Stop all containers
	for _, container := range deployment.Containers {
		err := de.dockerClient.StopContainer(ctx, container.ID, nil)
		if err != nil {
			log.Printf("Failed to stop container %s: %v", container.ID, err)
		}
	}

	deployment.Status = "cancelled"
	deployment.CompletedAt = &[]time.Time{time.Now()}[0]

	de.logEvent(&DeploymentEvent{
		Type:       "deployment_cancelled",
		Deployment: deployment,
		Timestamp:  time.Now(),
		Message:    "Deployment was cancelled",
	})

	return nil
}

// GetDeploymentLogs gets the logs for a deployment
func (de *DeploymentEngine) GetDeploymentLogs(ctx context.Context, id string) (string, error) {
	deployment, exists := de.deployments[id]
	if !exists {
		return "", fmt.Errorf("deployment not found: %s", id)
	}

	logs := deployment.BuildLog
	logs += "\n" + deployment.DeployLog

	// Add container logs
	for _, container := range deployment.Containers {
		containerLogs, err := de.dockerClient.GetContainerLogs(ctx, container.ID, docker.LogOptions{
			Stdout: true,
			Stderr: true,
		})
		if err != nil {
			log.Printf("Failed to get logs for container %s: %v", container.ID, err)
			continue
		}
		logs += fmt.Sprintf("\n=== Container %s Logs ===\n%s", container.Name, containerLogs)
	}

	return logs, nil
}

// WatchDeploymentEvents returns a channel of deployment events
func (de *DeploymentEngine) WatchDeploymentEvents() <-chan *DeploymentEvent {
	return de.deploymentLog
}

// logEvent logs a deployment event
func (de *DeploymentEngine) logEvent(event *DeploymentEvent) {
	select {
	case de.deploymentLog <- event:
	default:
		// Channel is full, drop the event
		log.Printf("Deployment event channel is full, dropping event: %s", event.Type)
	}
}

// generateDeploymentID generates a unique deployment ID
func generateDeploymentID() string {
	return fmt.Sprintf("deploy-%d", time.Now().UnixNano())
}
