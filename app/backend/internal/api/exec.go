package api

import (
	"context"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"containr/internal/database"
	"containr/internal/docker"
)

// handleExecInService runs a one-off shell command inside the service's
// running container and returns captured output. Intended for debugging;
// commands run as the container's default user with a 30s ceiling.
func handleExecInService(c *gin.Context) {
	serviceID := c.Param("id")
	db := c.MustGet("db").(*database.DB)

	var req struct {
		Command string `json:"command" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	command := strings.TrimSpace(req.Command)
	if command == "" || len(command) > 4096 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "command must be 1-4096 chars"})
		return
	}

	serviceUUID, err := uuid.Parse(serviceID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid service ID"})
		return
	}
	projectID, found := serviceProjectID(db, serviceUUID)
	if !found {
		c.JSON(http.StatusNotFound, gin.H{"error": "Service not found"})
		return
	}
	if _, allowed := projectManageAccess(c, db, projectID); !allowed {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	dockerClient, _ := c.Get("docker_client")
	dockerCli, _ := dockerClient.(*docker.Client)
	if dockerCli == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Docker unavailable"})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 30*time.Second)
	defer cancel()

	containerID, err := findServiceContainer(ctx, dockerCli, serviceID)
	if err != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "No running container for this service"})
		return
	}

	output, exitCode, runErr := dockerCli.ExecRun(ctx, containerID, []string{"sh", "-c", command})
	if len(output) > 64*1024 {
		output = output[:64*1024]
	}

	errText := ""
	if runErr != nil {
		errText = runErr.Error()
	}

	c.JSON(http.StatusOK, gin.H{
		"output":    output,
		"exit_code": exitCode,
		"error":     errText,
	})
}
