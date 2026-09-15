package api

import (
	"bufio"
	"context"
	"io"
	"net/http"
	"os"
	"runtime"
	"strconv"
	"strings"
	"syscall"
	"time"

	"containr/internal/docker"

	"github.com/docker/docker/api/types/registry"
	"github.com/gin-gonic/gin"
)

type upgradeStatusResponse struct {
	ImageRef        string `json:"image_ref"`
	Registry        string `json:"registry"`
	DockerAvailable bool   `json:"docker_available"`
	Installed       bool   `json:"installed"`
	Digest          string `json:"digest,omitempty"`
	Size            int64  `json:"size,omitempty"`
	AuthConfigured  bool   `json:"auth_configured"`
	Message         string `json:"message"`
}

type hostMonitoringResponse struct {
	Hostname        string         `json:"hostname"`
	OS              string         `json:"os"`
	Architecture    string         `json:"architecture"`
	CPU             hostCPU        `json:"cpu"`
	Memory          hostMemory     `json:"memory"`
	Storage         hostStorage    `json:"storage"`
	Load            SystemLoad     `json:"load"`
	UptimeSeconds   int64          `json:"uptime_seconds"`
	DockerAvailable bool           `json:"docker_available"`
	Docker          map[string]any `json:"docker,omitempty"`
	CollectedAt     string         `json:"collected_at"`
}

type hostCPU struct {
	Cores int `json:"cores"`
}

type hostMemory struct {
	Total     uint64  `json:"total"`
	Used      uint64  `json:"used"`
	Available uint64  `json:"available"`
	UsagePct  float64 `json:"usage_percent"`
}

type hostStorage struct {
	Path      string  `json:"path"`
	Total     uint64  `json:"total"`
	Used      uint64  `json:"used"`
	Available uint64  `json:"available"`
	UsagePct  float64 `json:"usage_percent"`
}

func handleGetUpgradeStatus(c *gin.Context) {
	imageRef := configuredUpgradeImageRef()
	dockerClient, _ := c.Get("docker_client")
	client, _ := dockerClient.(*docker.Client)

	response := upgradeStatusResponse{
		ImageRef:        imageRef,
		Registry:        registryHost(imageRef),
		DockerAvailable: client != nil,
		AuthConfigured:  upgradeRegistryAuthConfigured(),
		Message:         "Upgrade image auto-detected",
	}

	if imageRef == "" {
		response.Message = "Set CONTAINR_UPGRADE_IMAGE_REF or CONTAINR_IMAGE_REF to enable image pulls"
		c.JSON(http.StatusOK, response)
		return
	}

	if client == nil {
		response.Message = "Docker client unavailable"
		c.JSON(http.StatusOK, response)
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	info, err := client.GetImageInfo(ctx, imageRef)
	if err != nil {
		response.Message = "Image not installed locally"
		c.JSON(http.StatusOK, response)
		return
	}

	response.Installed = true
	response.Digest = info.Digest
	response.Size = info.Size
	response.Message = "Image installed locally"
	c.JSON(http.StatusOK, response)
}

func handlePullUpgradeImage(c *gin.Context) {
	imageRef := configuredUpgradeImageRef()
	if imageRef == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Set CONTAINR_UPGRADE_IMAGE_REF or CONTAINR_IMAGE_REF before pulling"})
		return
	}

	dockerClient, _ := c.Get("docker_client")
	client, ok := dockerClient.(*docker.Client)
	if !ok || client == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Docker client unavailable"})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Minute)
	defer cancel()

	reader, err := client.PullImage(ctx, imageRef, upgradeRegistryAuth())
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}
	defer reader.Close()
	_, _ = io.Copy(io.Discard, reader)

	info, infoErr := client.GetImageInfo(ctx, imageRef)
	response := gin.H{
		"image_ref": imageRef,
		"registry":  registryHost(imageRef),
		"message":   "Image pull completed",
	}
	if infoErr == nil {
		response["digest"] = info.Digest
		response["size"] = info.Size
	}

	c.JSON(http.StatusOK, response)
}

func handleGetHostMonitoring(c *gin.Context) {
	hostname, _ := os.Hostname()
	memory := readHostMemory()
	storage := readHostStorage("/")
	load := readSystemLoad()
	uptime := readSystemUptime()

	response := hostMonitoringResponse{
		Hostname:      hostname,
		OS:            runtime.GOOS,
		Architecture:  runtime.GOARCH,
		CPU:           hostCPU{Cores: runtime.NumCPU()},
		Memory:        memory,
		Storage:       storage,
		Load:          load,
		UptimeSeconds: uptime,
		CollectedAt:   time.Now().UTC().Format(time.RFC3339),
	}

	if dockerClient, ok := c.Get("docker_client"); ok {
		if client, ok := dockerClient.(*docker.Client); ok && client != nil {
			ctx, cancel := context.WithTimeout(c.Request.Context(), 3*time.Second)
			defer cancel()
			if info, err := client.GetSystemInfo(ctx); err == nil {
				response.DockerAvailable = true
				response.Docker = map[string]any{
					"containers": info.Containers,
					"images":     info.Images,
					"driver":     info.Driver,
					"server":     info.ServerVersion,
				}
			}
		}
	}

	c.JSON(http.StatusOK, response)
}

func configuredUpgradeImageRef() string {
	for _, key := range []string{"CONTAINR_UPGRADE_IMAGE_REF", "CONTAINR_IMAGE_REF", "DOCKER_IMAGE_REF"} {
		if value := strings.TrimSpace(os.Getenv(key)); value != "" {
			return value
		}
	}
	return ""
}

func registryHost(imageRef string) string {
	parts := strings.Split(imageRef, "/")
	if len(parts) > 1 && (strings.Contains(parts[0], ".") || strings.Contains(parts[0], ":")) {
		return parts[0]
	}
	if strings.HasPrefix(imageRef, "ghcr.io/") {
		return "ghcr.io"
	}
	return "docker.io"
}

func upgradeRegistryAuthConfigured() bool {
	auth := upgradeRegistryAuth()
	return strings.TrimSpace(auth.Username) != "" || strings.TrimSpace(auth.Password) != "" || strings.TrimSpace(auth.Auth) != ""
}

func upgradeRegistryAuth() registry.AuthConfig {
	username := firstConfigured("GITHUB_CONTAINER_REGISTRY_USER", "GHCR_USERNAME", "DOCKER_REGISTRY_USERNAME")
	password := firstConfigured("GITHUB_CONTAINER_REGISTRY_TOKEN", "GHCR_TOKEN", "DOCKER_REGISTRY_PASSWORD")
	return registry.AuthConfig{
		Username: username,
		Password: password,
	}
}

func firstConfigured(keys ...string) string {
	for _, key := range keys {
		if value := strings.TrimSpace(os.Getenv(key)); value != "" {
			return value
		}
	}
	return ""
}

func readHostMemory() hostMemory {
	values := map[string]uint64{}
	file, err := os.Open("/proc/meminfo")
	if err != nil {
		return hostMemory{}
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		fields := strings.Fields(scanner.Text())
		if len(fields) < 2 {
			continue
		}
		key := strings.TrimSuffix(fields[0], ":")
		value, parseErr := strconv.ParseUint(fields[1], 10, 64)
		if parseErr != nil {
			continue
		}
		values[key] = value * 1024
	}

	total := values["MemTotal"]
	available := values["MemAvailable"]
	used := uint64(0)
	if total > available {
		used = total - available
	}

	usage := 0.0
	if total > 0 {
		usage = float64(used) / float64(total) * 100
	}

	return hostMemory{
		Total:     total,
		Used:      used,
		Available: available,
		UsagePct:  usage,
	}
}

func readHostStorage(path string) hostStorage {
	var stat syscall.Statfs_t
	if err := syscall.Statfs(path, &stat); err != nil {
		return hostStorage{Path: path}
	}

	total := stat.Blocks * uint64(stat.Bsize)
	available := stat.Bavail * uint64(stat.Bsize)
	used := total - available
	usage := 0.0
	if total > 0 {
		usage = float64(used) / float64(total) * 100
	}

	return hostStorage{
		Path:      path,
		Total:     total,
		Used:      used,
		Available: available,
		UsagePct:  usage,
	}
}

func readSystemLoad() SystemLoad {
	data, err := os.ReadFile("/proc/loadavg")
	if err != nil {
		return SystemLoad{}
	}
	fields := strings.Fields(string(data))
	if len(fields) < 3 {
		return SystemLoad{}
	}
	load1, _ := strconv.ParseFloat(fields[0], 64)
	load5, _ := strconv.ParseFloat(fields[1], 64)
	load15, _ := strconv.ParseFloat(fields[2], 64)
	return SystemLoad{Load1M: load1, Load5M: load5, Load15M: load15}
}

func readSystemUptime() int64 {
	data, err := os.ReadFile("/proc/uptime")
	if err != nil {
		return 0
	}
	fields := strings.Fields(string(data))
	if len(fields) == 0 {
		return 0
	}
	uptime, err := strconv.ParseFloat(fields[0], 64)
	if err != nil {
		return 0
	}
	return int64(uptime)
}
