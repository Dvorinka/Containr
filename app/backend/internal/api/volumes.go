package api

import (
	"net/http"
	"time"

	"containr/internal/docker"

	"github.com/gin-gonic/gin"
)

// VolumeInfo is one docker volume plus whether any container mounts it.
type VolumeInfo struct {
	Name       string            `json:"name"`
	Driver     string            `json:"driver"`
	Mountpoint string            `json:"mountpoint"`
	Scope      string            `json:"scope"`
	InUse      bool              `json:"in_use"`
	UsedBy     []string          `json:"used_by,omitempty"`
	Labels     map[string]string `json:"labels,omitempty"`
	CreatedAt  time.Time         `json:"created_at,omitempty"`
}

func dockerClientOr500(c *gin.Context) (*docker.Client, bool) {
	v, exists := c.Get("docker_client")
	if !exists || v == nil {
		respondError(c, http.StatusInternalServerError, "INTERNAL", "Docker client not available")
		return nil, false
	}
	return v.(*docker.Client), true
}

// handleAdminListVolumes returns the node's docker volume inventory with
// in-use flags. Admin-only: mountpoints reveal host filesystem layout.
func handleAdminListVolumes(c *gin.Context) {
	client, ok := dockerClientOr500(c)
	if !ok {
		return
	}
	ctx := c.Request.Context()

	vols, err := client.ListVolumes(ctx)
	if err != nil {
		respondError(c, http.StatusBadGateway, "DEPENDENCY_UNAVAILABLE", "Failed to list volumes: "+err.Error())
		return
	}

	containers, err := client.ListContainers(ctx, true)
	if err != nil {
		respondError(c, http.StatusBadGateway, "DEPENDENCY_UNAVAILABLE", "Failed to list containers: "+err.Error())
		return
	}
	inUse := map[string][]string{}
	for _, cont := range containers {
		for _, m := range cont.Mounts {
			if m.Type == "volume" {
				name := cont.ID[:12]
				if len(cont.Names) > 0 {
					name = cont.Names[0]
				}
				inUse[m.Name] = append(inUse[m.Name], name)
			}
		}
	}

	out := make([]VolumeInfo, 0, len(vols.Volumes))
	for _, v := range vols.Volumes {
		if v == nil {
			continue
		}
		info := VolumeInfo{
			Name:       v.Name,
			Driver:     v.Driver,
			Mountpoint: v.Mountpoint,
			Scope:      v.Scope,
			Labels:     v.Labels,
			UsedBy:     inUse[v.Name],
		}
		info.InUse = len(info.UsedBy) > 0
		if t, err := time.Parse(time.RFC3339Nano, v.CreatedAt); err == nil {
			info.CreatedAt = t
		}
		out = append(out, info)
	}
	c.JSON(http.StatusOK, gin.H{"volumes": out})
}

// handleAdminDeleteVolume removes a docker volume. Docker refuses removal
// of in-use volumes — that error is surfaced as a conflict.
func handleAdminDeleteVolume(c *gin.Context) {
	client, ok := dockerClientOr500(c)
	if !ok {
		return
	}
	name := c.Param("name")
	if name == "" {
		respondError(c, http.StatusBadRequest, "VALIDATION", "Volume name is required")
		return
	}
	if err := client.RemoveVolume(c.Request.Context(), name, false); err != nil {
		respondError(c, http.StatusConflict, "CONFLICT", "Failed to remove volume: "+err.Error())
		return
	}
	c.JSON(http.StatusOK, gin.H{"deleted": name})
}
