package docker

import (
	"context"
	"fmt"
	"io"
	"time"

	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/events"
	"github.com/docker/docker/api/types/image"
	"github.com/docker/docker/api/types/network"
	"github.com/docker/docker/api/types/registry"
	"github.com/docker/docker/api/types/system"
	"github.com/docker/docker/api/types/volume"
	"github.com/docker/docker/client"
)

// Client wraps the Docker client with additional functionality
type Client struct {
	cli *client.Client
}

// NewClient creates a new Docker client
func NewClient() (*Client, error) {
	cli, err := client.NewClientWithOpts(client.FromEnv, client.WithAPIVersionNegotiation())
	if err != nil {
		return nil, fmt.Errorf("failed to create Docker client: %w", err)
	}

	// Test connection
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_, err = cli.Ping(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to Docker daemon: %w", err)
	}

	return &Client{cli: cli}, nil
}

// ListContainers returns all containers
func (c *Client) ListContainers(ctx context.Context, all bool) ([]types.Container, error) {
	return c.cli.ContainerList(ctx, container.ListOptions{
		All: all,
	})
}

// GetContainer returns detailed information about a specific container
func (c *Client) GetContainer(ctx context.Context, containerID string) (types.ContainerJSON, error) {
	return c.cli.ContainerInspect(ctx, containerID)
}

// CreateContainer creates a new container
func (c *Client) CreateContainer(ctx context.Context, config ContainerConfig) (string, error) {
	containerConfig := &container.Config{
		Image:        config.Image,
		Cmd:          config.Cmd,
		Env:          config.Env,
		Labels:       config.Labels,
		ExposedPorts: config.ExposedPorts,
	}

	hostConfig := &container.HostConfig{
		RestartPolicy: container.RestartPolicy{
			Name: container.RestartPolicyMode(config.RestartPolicy),
		},
		PortBindings: config.PortBindings,
		Mounts:       config.Mounts,
		Resources: container.Resources{
			Memory:   config.Memory,
			NanoCPUs: config.NanoCPUs,
		},
		NetworkMode: container.NetworkMode(config.NetworkMode),
	}

	networkingConfig := &network.NetworkingConfig{
		EndpointsConfig: config.Networks,
	}

	resp, err := c.cli.ContainerCreate(
		ctx,
		containerConfig,
		hostConfig,
		networkingConfig,
		nil,
		config.Name,
	)

	if err != nil {
		return "", fmt.Errorf("failed to create container: %w", err)
	}

	return resp.ID, nil
}

// StartContainer starts a container
func (c *Client) StartContainer(ctx context.Context, containerID string) error {
	return c.cli.ContainerStart(ctx, containerID, container.StartOptions{})
}

// StopContainer stops a container
func (c *Client) StopContainer(ctx context.Context, containerID string, timeout *time.Duration) error {
	var timeoutInt *int
	if timeout != nil {
		t := int(timeout.Seconds())
		timeoutInt = &t
	}
	return c.cli.ContainerStop(ctx, containerID, container.StopOptions{
		Timeout: timeoutInt,
	})
}

// RestartContainer restarts a container
func (c *Client) RestartContainer(ctx context.Context, containerID string, timeout *time.Duration) error {
	var timeoutInt *int
	if timeout != nil {
		t := int(timeout.Seconds())
		timeoutInt = &t
	}
	return c.cli.ContainerRestart(ctx, containerID, container.StopOptions{
		Timeout: timeoutInt,
	})
}

// RemoveContainer removes a container
func (c *Client) RemoveContainer(ctx context.Context, containerID string, force bool) error {
	return c.cli.ContainerRemove(ctx, containerID, container.RemoveOptions{
		Force: force,
	})
}

// GetContainerLogs returns logs for a container
func (c *Client) GetContainerLogs(ctx context.Context, containerID string, options LogOptions) (io.ReadCloser, error) {
	return c.cli.ContainerLogs(ctx, containerID, container.LogsOptions{
		ShowStdout: options.Stdout,
		ShowStderr: options.Stderr,
		Follow:     options.Follow,
		Tail:       options.Tail,
		Timestamps: options.Timestamps,
	})
}

// GetContainerStats returns real-time resource usage statistics for a container
func (c *Client) GetContainerStats(ctx context.Context, containerID string, stream bool) (*container.StatsResponseReader, error) {
	resp, err := c.cli.ContainerStats(ctx, containerID, stream)
	if err != nil {
		return nil, err
	}
	return &resp, nil
}

// ListImages returns all images
func (c *Client) ListImages(ctx context.Context, all bool) ([]image.Summary, error) {
	return c.cli.ImageList(ctx, image.ListOptions{
		All: all,
	})
}

// PullImage pulls an image from a registry
func (c *Client) PullImage(ctx context.Context, ref string, auth registry.AuthConfig) (io.ReadCloser, error) {
	authStr, _ := registry.EncodeAuthConfig(auth)
	return c.cli.ImagePull(ctx, ref, image.PullOptions{
		RegistryAuth: authStr,
	})
}

// BuildImage builds an image from a Dockerfile
func (c *Client) BuildImage(ctx context.Context, buildContext io.Reader, options BuildOptions) (types.ImageBuildResponse, error) {
	return c.cli.ImageBuild(ctx, buildContext, types.ImageBuildOptions{
		Dockerfile: options.Dockerfile,
		Tags:       options.Tags,
		BuildArgs:  options.BuildArgs,
		Labels:     options.Labels,
		Remove:     options.Remove,
	})
}

// RemoveImage removes an image
func (c *Client) RemoveImage(ctx context.Context, imageID string, force bool) ([]image.DeleteResponse, error) {
	return c.cli.ImageRemove(ctx, imageID, image.RemoveOptions{
		Force: force,
	})
}

// TagImage tags an image
func (c *Client) TagImage(ctx context.Context, imageID, ref string) error {
	return c.cli.ImageTag(ctx, imageID, ref)
}

// ListNetworks returns all networks
func (c *Client) ListNetworks(ctx context.Context) ([]network.Summary, error) {
	return c.cli.NetworkList(ctx, network.ListOptions{})
}

// CreateNetwork creates a new network
func (c *Client) CreateNetwork(ctx context.Context, config NetworkConfig) (string, error) {
	resp, err := c.cli.NetworkCreate(ctx, config.Name, network.CreateOptions{
		Driver:   config.Driver,
		Internal: config.Internal,
		Labels:   config.Labels,
	})
	if err != nil {
		return "", err
	}
	return resp.ID, nil
}

// RemoveNetwork removes a network
func (c *Client) RemoveNetwork(ctx context.Context, networkID string) error {
	return c.cli.NetworkRemove(ctx, networkID)
}

// ConnectNetwork connects a container to a network
func (c *Client) ConnectNetwork(ctx context.Context, networkID, containerID string, config network.EndpointSettings) error {
	return c.cli.NetworkConnect(ctx, networkID, containerID, &config)
}

// DisconnectNetwork disconnects a container from a network
func (c *Client) DisconnectNetwork(ctx context.Context, networkID, containerID string, force bool) error {
	return c.cli.NetworkDisconnect(ctx, networkID, containerID, force)
}

// ListVolumes returns all volumes
func (c *Client) ListVolumes(ctx context.Context) (volume.ListResponse, error) {
	return c.cli.VolumeList(ctx, volume.ListOptions{})
}

// CreateVolume creates a new volume
func (c *Client) CreateVolume(ctx context.Context, config VolumeConfig) (volume.Volume, error) {
	return c.cli.VolumeCreate(ctx, volume.CreateOptions{
		Name:       config.Name,
		Driver:     config.Driver,
		Labels:     config.Labels,
		DriverOpts: config.DriverOpts,
	})
}

// RemoveVolume removes a volume
func (c *Client) RemoveVolume(ctx context.Context, volumeID string, force bool) error {
	return c.cli.VolumeRemove(ctx, volumeID, force)
}

// GetSystemInfo returns system-wide information
func (c *Client) GetSystemInfo(ctx context.Context) (system.Info, error) {
	return c.cli.Info(ctx)
}

// GetDiskUsage returns Docker disk usage information
func (c *Client) GetDiskUsage(ctx context.Context) (types.DiskUsage, error) {
	return c.cli.DiskUsage(ctx, types.DiskUsageOptions{})
}

// GetEvents returns Docker events
func (c *Client) GetEvents(ctx context.Context, options EventOptions) (io.ReadCloser, error) {
	resp, errChan := c.cli.Events(ctx, events.ListOptions{
		Since:   options.Since,
		Until:   options.Until,
		Filters: options.Filters,
	})

	// Convert the channel to a reader
	r, w := io.Pipe()
	go func() {
		defer w.Close()
		for {
			select {
			case event, ok := <-resp:
				if !ok {
					return
				}
				// Write event data to pipe
				w.Write([]byte(fmt.Sprintf("%v\n", event)))
			case err := <-errChan:
				if err != nil {
					w.CloseWithError(err)
					return
				}
			case <-ctx.Done():
				return
			}
		}
	}()
	return r, nil
}

// ExecCreate creates an exec instance in a container
func (c *Client) ExecCreate(ctx context.Context, containerID string, config ExecConfig) (types.IDResponse, error) {
	return c.cli.ContainerExecCreate(ctx, containerID, container.ExecOptions{
		Cmd:          config.Cmd,
		Env:          config.Env,
		WorkingDir:   config.WorkingDir,
		User:         config.User,
		AttachStdin:  config.AttachStdin,
		AttachStdout: config.AttachStdout,
		AttachStderr: config.AttachStderr,
		Tty:          config.Tty,
	})
}

// ExecStart starts an exec instance
func (c *Client) ExecStart(ctx context.Context, execID string, config ExecStartConfig) error {
	return c.cli.ContainerExecStart(ctx, execID, container.ExecStartOptions{
		Detach: config.Detach,
		Tty:    config.Tty,
	})
}

// ExecInspect returns information about an exec instance
func (c *Client) ExecInspect(ctx context.Context, execID string) (container.ExecInspect, error) {
	return c.cli.ContainerExecInspect(ctx, execID)
}

// GetImageInfo returns information about a Docker image
func (c *Client) GetImageInfo(ctx context.Context, imageName string) (*ImageInfo, error) {
	images, err := c.cli.ImageList(ctx, image.ListOptions{})
	if err != nil {
		return nil, err
	}

	for _, img := range images {
		for _, tag := range img.RepoTags {
			if tag == imageName || tag == imageName+":latest" {
				return &ImageInfo{
					ID:          img.ID,
					RepoTags:    img.RepoTags,
					Size:        img.Size,
					Created:     img.Created,
					Labels:      img.Labels,
					RepoDigests: img.RepoDigests,
					Digest:      getDigestFromRepoTags(img.RepoDigests),
				}, nil
			}
		}
	}

	return nil, fmt.Errorf("image not found: %s", imageName)
}

// PushImage pushes an image to a registry
func (c *Client) PushImage(ctx context.Context, imageName, registryURL string) error {
	auth := registry.AuthConfig{}
	authStr, _ := registry.EncodeAuthConfig(auth)

	_, err := c.cli.ImagePush(ctx, imageName, image.PushOptions{
		RegistryAuth: authStr,
	})
	return err
}

// Close closes the Docker client connection
func (c *Client) Close() error {
	return c.cli.Close()
}

// Helper function to extract digest from repo digests
func getDigestFromRepoTags(digests []string) string {
	if len(digests) > 0 {
		return digests[0]
	}
	return ""
}
