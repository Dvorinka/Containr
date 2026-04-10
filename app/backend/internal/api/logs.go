package api

import (
	"bufio"
	"containr/internal/database"
	"containr/internal/docker"
	"context"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type LogEntry struct {
	Timestamp time.Time `json:"timestamp"`
	Message   string    `json:"message"`
	Stream    string    `json:"stream"`
}

func handleGetLogs(c *gin.Context) {
	db, exists := c.Get("db")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database connection not available"})
		return
	}

	serviceIDStr := c.Param("id")
	serviceID, err := uuid.Parse(serviceIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid service ID"})
		return
	}

	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	var ownerCheck string
	err = db.(*database.DB).QueryRow(
		`SELECT p.owner_id FROM services s 
		 JOIN projects p ON s.project_id = p.id 
		 WHERE s.id = $1`,
		serviceID,
	).Scan(&ownerCheck)

	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Service not found"})
		return
	}

	if ownerCheck != userID.(string) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	follow := c.DefaultQuery("follow", "false") == "true"
	tail := c.DefaultQuery("tail", "100")

	dockerClient, exists := c.Get("docker_client")
	if !exists || dockerClient == nil {
		respondDependencyUnavailable(c, "docker", "Container log streaming is unavailable because Docker is not configured.")
		return
	}

	client := dockerClient.(*docker.Client)
	containerName := fmt.Sprintf("containr-%s", serviceID)

	logOpts := docker.LogOptions{
		Stdout:     true,
		Stderr:     true,
		Follow:     follow,
		Tail:       tail,
		Timestamps: true,
	}

	ctx := context.Background()
	logsReader, err := client.GetContainerLogs(ctx, containerName, logOpts)
	if err != nil {
		respondDependencyUnavailable(c, "docker", "Failed to fetch container logs. The container may be unavailable.")
		return
	}
	defer logsReader.Close()

	if follow {
		c.Header("Content-Type", "text/event-stream")
		c.Header("Cache-Control", "no-cache")
		c.Header("Connection", "keep-alive")

		streamWriter := c.Writer
		flusher, ok := streamWriter.(http.Flusher)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Streaming not supported"})
			return
		}

		scanner := bufio.NewScanner(logsReader)
		for scanner.Scan() {
			line := scanner.Text()
			if line == "" {
				continue
			}

			cleanLine := stripDockerLogHeader(line)
			entry := LogEntry{
				Timestamp: time.Now(),
				Message:   cleanLine,
				Stream:    "stdout",
			}
			if strings.Contains(strings.ToLower(cleanLine), "error") || strings.Contains(strings.ToLower(cleanLine), "err") {
				entry.Stream = "stderr"
			}

			fmt.Fprintf(streamWriter, "data: {\"timestamp\":\"%s\",\"message\":\"%s\",\"stream\":\"%s\"}\n\n",
				entry.Timestamp.Format(time.RFC3339),
				strings.ReplaceAll(entry.Message, `"`, `\"`),
				entry.Stream,
			)
			flusher.Flush()
		}
		return
	}

	logBytes, err := io.ReadAll(logsReader)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to read logs"})
		return
	}

	logContent := string(logBytes)
	var logEntries []LogEntry
	scanner := bufio.NewScanner(strings.NewReader(logContent))
	for scanner.Scan() {
		line := scanner.Text()
		if line == "" {
			continue
		}

		cleanLine := stripDockerLogHeader(line)
		entry := LogEntry{
			Timestamp: time.Now(),
			Message:   cleanLine,
			Stream:    "stdout",
		}
		if strings.Contains(strings.ToLower(cleanLine), "error") || strings.Contains(strings.ToLower(cleanLine), "err") {
			entry.Stream = "stderr"
		}
		logEntries = append(logEntries, entry)
	}

	c.JSON(http.StatusOK, gin.H{"logs": logEntries})
}

func handleGetDeploymentLogs(c *gin.Context) {
	db, exists := c.Get("db")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database connection not available"})
		return
	}

	deploymentIDStr := c.Param("id")
	deploymentID, err := uuid.Parse(deploymentIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid deployment ID"})
		return
	}

	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	var buildLog, runtimeLog string
	var ownerCheck string
	err = db.(*database.DB).QueryRow(
		`SELECT d.build_log, d.runtime_log, p.owner_id
		 FROM deployments d
		 JOIN services s ON d.service_id = s.id
		 JOIN projects p ON s.project_id = p.id
		 WHERE d.id = $1`,
		deploymentID,
	).Scan(&buildLog, &runtimeLog, &ownerCheck)

	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Deployment not found"})
		return
	}

	if ownerCheck != userID.(string) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	logType := c.DefaultQuery("type", "all")
	var logs []LogEntry

	parseLogs := func(logContent string, stream string) []LogEntry {
		var entries []LogEntry
		scanner := bufio.NewScanner(strings.NewReader(logContent))
		for scanner.Scan() {
			line := scanner.Text()
			if line == "" {
				continue
			}
			entries = append(entries, LogEntry{
				Timestamp: time.Now(),
				Message:   line,
				Stream:    stream,
			})
		}
		return entries
	}

	if logType == "all" || logType == "build" {
		logs = append(logs, parseLogs(buildLog, "build")...)
	}
	if logType == "all" || logType == "runtime" {
		logs = append(logs, parseLogs(runtimeLog, "runtime")...)
	}

	c.JSON(http.StatusOK, gin.H{
		"logs":        logs,
		"build_log":   buildLog,
		"runtime_log": runtimeLog,
	})
}

func stripDockerLogHeader(line string) string {
	if len(line) > 8 && (line[0] == 1 || line[0] == 2) {
		return line[8:]
	}
	return line
}
