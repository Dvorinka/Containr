package deployment

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"
)

type HistoryManager struct {
	storagePath string
	mu          sync.RWMutex
	deployments map[string]*DeploymentRecord
}

type DeploymentRecord struct {
	ID           string                 `json:"id"`
	ProjectID    string                 `json:"project_id"`
	ServiceID    string                 `json:"service_id"`
	Environment  string                 `json:"environment"`
	Status       string                 `json:"status"`
	ImageName    string                 `json:"image_name"`
	ImageTag     string                 `json:"image_tag"`
	Config       ServiceConfig          `json:"config"`
	CreatedAt    time.Time              `json:"created_at"`
	StartedAt    *time.Time             `json:"started_at,omitempty"`
	CompletedAt  *time.Time             `json:"completed_at,omitempty"`
	Duration     time.Duration          `json:"duration"`
	Containers   []ContainerRecord      `json:"containers"`
	BuildLog     string                 `json:"build_log"`
	DeployLog    string                 `json:"deploy_log"`
	Error        string                 `json:"error,omitempty"`
	Metadata     map[string]string      `json:"metadata"`
	Trigger      TriggerRecord          `json:"trigger"`
	RollbackFrom *string                `json:"rollback_from,omitempty"`
	Rollbacks    []string               `json:"rollbacks"`
	Tags         []string               `json:"tags"`
	Annotations  map[string]interface{} `json:"annotations"`
}

type ContainerRecord struct {
	ID           string         `json:"id"`
	Name         string         `json:"name"`
	Status       string         `json:"status"`
	CreatedAt    time.Time      `json:"created_at"`
	StartedAt    time.Time      `json:"started_at"`
	StoppedAt    *time.Time     `json:"stopped_at,omitempty"`
	Ports        []PortRecord   `json:"ports,omitempty"`
	Resources    ResourceRecord `json:"resources"`
	Health       *HealthRecord  `json:"health,omitempty"`
	ExitCode     *int           `json:"exit_code,omitempty"`
	ErrorMessage string         `json:"error_message,omitempty"`
}

type PortRecord struct {
	ContainerPort int32  `json:"container_port"`
	HostPort      int32  `json:"host_port,omitempty"`
	HostIP        string `json:"host_ip"`
	Protocol      string `json:"protocol"`
}

type ResourceRecord struct {
	CPUPercent  float64 `json:"cpu_percent"`
	MemoryUsage int64   `json:"memory_usage"`
	MemoryLimit int64   `json:"memory_limit"`
	NetworkRx   int64   `json:"network_rx"`
	NetworkTx   int64   `json:"network_tx"`
	PidsCurrent uint64  `json:"pids_current"`
	PidsLimit   uint64  `json:"pids_limit"`
}

type HealthRecord struct {
	Status        string    `json:"status"`
	FailingStreak int       `json:"failing_streak"`
	LastCheck     time.Time `json:"last_check"`
	Output        string    `json:"output,omitempty"`
}

type TriggerRecord struct {
	Type      string            `json:"type"`      // webhook, manual, api, scheduled
	Source    string            `json:"source"`    // Source of trigger
	User      string            `json:"user"`      // User who triggered
	Data      map[string]string `json:"data"`      // Trigger-specific data
	Timestamp time.Time         `json:"timestamp"` // When trigger occurred
}

type DeploymentFilter struct {
	ProjectID   string    `json:"project_id,omitempty"`
	ServiceID   string    `json:"service_id,omitempty"`
	Environment string    `json:"environment,omitempty"`
	Status      string    `json:"status,omitempty"`
	TriggerType string    `json:"trigger_type,omitempty"`
	User        string    `json:"user,omitempty"`
	From        time.Time `json:"from,omitempty"`
	To          time.Time `json:"to,omitempty"`
	Tags        []string  `json:"tags,omitempty"`
	Limit       int       `json:"limit,omitempty"`
	Offset      int       `json:"offset,omitempty"`
	SortBy      string    `json:"sort_by,omitempty"`    // created_at, started_at, completed_at, duration
	SortOrder   string    `json:"sort_order,omitempty"` // asc, desc
}

type DeploymentStats struct {
	TotalDeployments      int                      `json:"total_deployments"`
	SuccessfulDeployments int                      `json:"successful_deployments"`
	FailedDeployments     int                      `json:"failed_deployments"`
	AverageDuration       time.Duration            `json:"average_duration"`
	DeploymentsByStatus   map[string]int           `json:"deployments_by_status"`
	DeploymentsByEnv      map[string]int           `json:"deployments_by_env"`
	DeploymentsByDay      map[string]int           `json:"deployments_by_day"`
	RecentActivity        []DeploymentRecord       `json:"recent_activity"`
	TopServices           []ServiceDeploymentStats `json:"top_services"`
	TopUsers              []UserDeploymentStats    `json:"top_users"`
}

type ServiceDeploymentStats struct {
	ServiceID       string        `json:"service_id"`
	ServiceName     string        `json:"service_name"`
	DeploymentCount int           `json:"deployment_count"`
	SuccessCount    int           `json:"success_count"`
	FailureCount    int           `json:"failure_count"`
	SuccessRate     float64       `json:"success_rate"`
	AverageDuration time.Duration `json:"average_duration"`
	LastDeployment  time.Time     `json:"last_deployment"`
}

type UserDeploymentStats struct {
	User            string        `json:"user"`
	DeploymentCount int           `json:"deployment_count"`
	SuccessCount    int           `json:"success_count"`
	FailureCount    int           `json:"failure_count"`
	SuccessRate     float64       `json:"success_rate"`
	AverageDuration time.Duration `json:"average_duration"`
	LastDeployment  time.Time     `json:"last_deployment"`
}

func NewHistoryManager(storagePath string) *HistoryManager {
	return &HistoryManager{
		storagePath: storagePath,
		deployments: make(map[string]*DeploymentRecord),
	}
}

// RecordDeployment records a deployment in history
func (hm *HistoryManager) RecordDeployment(deployment *Deployment) error {
	hm.mu.Lock()
	defer hm.mu.Unlock()

	record := hm.convertToRecord(deployment)
	hm.deployments[record.ID] = record

	// Save to storage
	return hm.saveDeployment(record)
}

// GetDeployment gets a deployment record by ID
func (hm *HistoryManager) GetDeployment(id string) (*DeploymentRecord, error) {
	hm.mu.RLock()
	defer hm.mu.RUnlock()

	record, exists := hm.deployments[id]
	if !exists {
		return nil, fmt.Errorf("deployment not found: %s", id)
	}

	return record, nil
}

// ListDeployments lists deployments with filtering
func (hm *HistoryManager) ListDeployments(filter DeploymentFilter) ([]*DeploymentRecord, error) {
	hm.mu.RLock()
	defer hm.mu.RUnlock()

	var deployments []*DeploymentRecord

	for _, record := range hm.deployments {
		if hm.matchesFilter(record, filter) {
			deployments = append(deployments, record)
		}
	}

	// Sort deployments
	hm.sortDeployments(deployments, filter.SortBy, filter.SortOrder)

	// Apply pagination
	if filter.Limit > 0 {
		start := filter.Offset
		if start >= len(deployments) {
			return []*DeploymentRecord{}, nil
		}
		end := start + filter.Limit
		if end > len(deployments) {
			end = len(deployments)
		}
		deployments = deployments[start:end]
	}

	return deployments, nil
}

// RollbackDeployment creates a rollback deployment
func (hm *HistoryManager) RollbackDeployment(ctx context.Context, deploymentID, reason string, userID string) (*DeploymentRecord, error) {
	hm.mu.RLock()
	originalDeployment, exists := hm.deployments[deploymentID]
	hm.mu.RUnlock()

	if !exists {
		return nil, fmt.Errorf("deployment not found: %s", deploymentID)
	}

	// Create rollback deployment record
	rollbackRecord := &DeploymentRecord{
		ID:          generateDeploymentID(),
		ProjectID:   originalDeployment.ProjectID,
		ServiceID:   originalDeployment.ServiceID,
		Environment: originalDeployment.Environment,
		Status:      "pending",
		ImageName:   originalDeployment.ImageName,
		ImageTag:    originalDeployment.ImageTag,
		Config:      originalDeployment.Config,
		CreatedAt:   time.Now(),
		Metadata: map[string]string{
			"rollback_from":   deploymentID,
			"rollback_reason": reason,
		},
		Trigger: TriggerRecord{
			Type:   "rollback",
			Source: "deployment_history",
			User:   userID,
			Data: map[string]string{
				"original_deployment": deploymentID,
				"reason":              reason,
			},
			Timestamp: time.Now(),
		},
		RollbackFrom: &deploymentID,
		Tags:         append(originalDeployment.Tags, "rollback"),
	}

	// Record the rollback
	err := hm.RecordDeployment(&Deployment{
		ID:          rollbackRecord.ID,
		ProjectID:   rollbackRecord.ProjectID,
		ServiceID:   rollbackRecord.ServiceID,
		Environment: rollbackRecord.Environment,
		Status:      rollbackRecord.Status,
		ImageName:   rollbackRecord.ImageName,
		ImageTag:    rollbackRecord.ImageTag,
		Config:      rollbackRecord.Config,
		CreatedAt:   rollbackRecord.CreatedAt,
		Metadata:    rollbackRecord.Metadata,
	})

	if err != nil {
		return nil, fmt.Errorf("failed to record rollback: %w", err)
	}

	// Update original deployment to track rollbacks
	hm.mu.Lock()
	if original, exists := hm.deployments[deploymentID]; exists {
		original.Rollbacks = append(original.Rollbacks, rollbackRecord.ID)
		hm.saveDeployment(original)
	}
	hm.mu.Unlock()

	return rollbackRecord, nil
}

// GetDeploymentHistory gets the deployment history for a service
func (hm *HistoryManager) GetDeploymentHistory(serviceID, environment string, limit int) ([]*DeploymentRecord, error) {
	filter := DeploymentFilter{
		ServiceID:   serviceID,
		Environment: environment,
		Limit:       limit,
		SortBy:      "created_at",
		SortOrder:   "desc",
	}

	return hm.ListDeployments(filter)
}

// GetDeploymentStats gets deployment statistics
func (hm *HistoryManager) GetDeploymentStats(projectID string) (*DeploymentStats, error) {
	hm.mu.RLock()
	defer hm.mu.RUnlock()

	stats := &DeploymentStats{
		DeploymentsByStatus: make(map[string]int),
		DeploymentsByEnv:    make(map[string]int),
		DeploymentsByDay:    make(map[string]int),
	}

	var totalDuration time.Duration
	var successfulDeployments int

	for _, record := range hm.deployments {
		if projectID != "" && record.ProjectID != projectID {
			continue
		}

		stats.TotalDeployments++

		// Count by status
		stats.DeploymentsByStatus[record.Status]++

		// Count by environment
		stats.DeploymentsByEnv[record.Environment]++

		// Count by day
		day := record.CreatedAt.Format("2006-01-02")
		stats.DeploymentsByDay[day]++

		// Calculate success metrics
		if record.Status == "running" || record.Status == "completed" {
			successfulDeployments++
			stats.SuccessfulDeployments++
		} else if record.Status == "failed" {
			stats.FailedDeployments++
		}

		// Calculate duration
		if record.Duration > 0 {
			totalDuration += record.Duration
		}
	}

	// Calculate average duration
	if stats.TotalDeployments > 0 {
		stats.AverageDuration = totalDuration / time.Duration(stats.TotalDeployments)
	}

	// Get recent activity
	stats.RecentActivity = hm.getRecentActivity(projectID, 10)

	// Get top services and users
	stats.TopServices = hm.getTopServices(projectID, 5)
	stats.TopUsers = hm.getTopUsers(projectID, 5)

	return stats, nil
}

// DeleteDeployment removes a deployment from history
func (hm *HistoryManager) DeleteDeployment(id string) error {
	hm.mu.Lock()
	defer hm.mu.Unlock()

	if _, exists := hm.deployments[id]; !exists {
		return fmt.Errorf("deployment not found: %s", id)
	}

	delete(hm.deployments, id)

	// Remove from storage
	return hm.deleteDeploymentFile(id)
}

// convertToRecord converts a Deployment to DeploymentRecord
func (hm *HistoryManager) convertToRecord(deployment *Deployment) *DeploymentRecord {
	record := &DeploymentRecord{
		ID:          deployment.ID,
		ProjectID:   deployment.ProjectID,
		ServiceID:   deployment.ServiceID,
		Environment: deployment.Environment,
		Status:      deployment.Status,
		ImageName:   deployment.ImageName,
		ImageTag:    deployment.ImageTag,
		Config:      deployment.Config,
		CreatedAt:   deployment.CreatedAt,
		StartedAt:   deployment.StartedAt,
		CompletedAt: deployment.CompletedAt,
		BuildLog:    deployment.BuildLog,
		DeployLog:   deployment.DeployLog,
		Error:       deployment.Error,
		Metadata:    deployment.Metadata,
		Tags:        []string{},
		Annotations: make(map[string]interface{}),
	}

	// Calculate duration
	if deployment.StartedAt != nil && deployment.CompletedAt != nil {
		record.Duration = deployment.CompletedAt.Sub(*deployment.StartedAt)
	}

	// Convert containers
	for _, container := range deployment.Containers {
		containerRecord := ContainerRecord{
			ID:        container.ID,
			Name:      container.Name,
			Status:    container.Status,
			CreatedAt: container.CreatedAt,
			StartedAt: container.StartedAt,
			Resources: ResourceRecord{
				CPUPercent:  container.Resources.CPUPercent,
				MemoryUsage: container.Resources.MemoryUsage,
				MemoryLimit: container.Resources.MemoryLimit,
				NetworkRx:   container.Resources.NetworkRx,
				NetworkTx:   container.Resources.NetworkTx,
			},
		}

		if container.Health != nil {
			containerRecord.Health = &HealthRecord{
				Status:        container.Health.Status,
				FailingStreak: container.Health.FailingStreak,
				LastCheck:     container.Health.LastCheck,
			}
		}

		record.Containers = append(record.Containers, containerRecord)
	}

	return record
}

// matchesFilter checks if a deployment record matches the filter
func (hm *HistoryManager) matchesFilter(record *DeploymentRecord, filter DeploymentFilter) bool {
	if filter.ProjectID != "" && record.ProjectID != filter.ProjectID {
		return false
	}

	if filter.ServiceID != "" && record.ServiceID != filter.ServiceID {
		return false
	}

	if filter.Environment != "" && record.Environment != filter.Environment {
		return false
	}

	if filter.Status != "" && record.Status != filter.Status {
		return false
	}

	if filter.TriggerType != "" && record.Trigger.Type != filter.TriggerType {
		return false
	}

	if filter.User != "" && record.Trigger.User != filter.User {
		return false
	}

	if !filter.From.IsZero() && record.CreatedAt.Before(filter.From) {
		return false
	}

	if !filter.To.IsZero() && record.CreatedAt.After(filter.To) {
		return false
	}

	if len(filter.Tags) > 0 {
		hasTag := false
		for _, tag := range filter.Tags {
			for _, recordTag := range record.Tags {
				if recordTag == tag {
					hasTag = true
					break
				}
			}
			if hasTag {
				break
			}
		}
		if !hasTag {
			return false
		}
	}

	return true
}

// sortDeployments sorts deployments based on the specified criteria
func (hm *HistoryManager) sortDeployments(deployments []*DeploymentRecord, sortBy, sortOrder string) {
	if sortBy == "" {
		sortBy = "created_at"
	}
	if sortOrder == "" {
		sortOrder = "desc"
	}

	sort.Slice(deployments, func(i, j int) bool {
		var less bool

		switch sortBy {
		case "created_at":
			less = deployments[i].CreatedAt.Before(deployments[j].CreatedAt)
		case "started_at":
			if deployments[i].StartedAt == nil {
				less = true
			} else if deployments[j].StartedAt == nil {
				less = false
			} else {
				less = deployments[i].StartedAt.Before(*deployments[j].StartedAt)
			}
		case "completed_at":
			if deployments[i].CompletedAt == nil {
				less = true
			} else if deployments[j].CompletedAt == nil {
				less = false
			} else {
				less = deployments[i].CompletedAt.Before(*deployments[j].CompletedAt)
			}
		case "duration":
			less = deployments[i].Duration < deployments[j].Duration
		default:
			less = deployments[i].ID < deployments[j].ID
		}

		if sortOrder == "desc" {
			return !less
		}
		return less
	})
}

// getRecentActivity gets recent deployment activity
func (hm *HistoryManager) getRecentActivity(projectID string, limit int) []DeploymentRecord {
	var deployments []DeploymentRecord

	for _, record := range hm.deployments {
		if projectID != "" && record.ProjectID != projectID {
			continue
		}
		deployments = append(deployments, *record)
	}

	// Sort by created_at desc
	sort.Slice(deployments, func(i, j int) bool {
		return deployments[i].CreatedAt.After(deployments[j].CreatedAt)
	})

	if len(deployments) > limit {
		deployments = deployments[:limit]
	}

	return deployments
}

// getTopServices gets top services by deployment count
func (hm *HistoryManager) getTopServices(projectID string, limit int) []ServiceDeploymentStats {
	serviceStats := make(map[string]*ServiceDeploymentStats)

	for _, record := range hm.deployments {
		if projectID != "" && record.ProjectID != projectID {
			continue
		}

		stats, exists := serviceStats[record.ServiceID]
		if !exists {
			stats = &ServiceDeploymentStats{
				ServiceID: record.ServiceID,
			}
			serviceStats[record.ServiceID] = stats
		}

		stats.DeploymentCount++
		stats.LastDeployment = record.CreatedAt

		if record.Status == "running" || record.Status == "completed" {
			stats.SuccessCount++
		} else if record.Status == "failed" {
			stats.FailureCount++
		}

		if record.Duration > 0 {
			// Simple moving average for duration
			if stats.AverageDuration == 0 {
				stats.AverageDuration = record.Duration
			} else {
				stats.AverageDuration = (stats.AverageDuration + record.Duration) / 2
			}
		}
	}

	// Calculate success rates
	for _, stats := range serviceStats {
		if stats.DeploymentCount > 0 {
			stats.SuccessRate = float64(stats.SuccessCount) / float64(stats.DeploymentCount) * 100
		}
	}

	// Convert to slice and sort
	var topServices []ServiceDeploymentStats
	for _, stats := range serviceStats {
		topServices = append(topServices, *stats)
	}

	sort.Slice(topServices, func(i, j int) bool {
		return topServices[i].DeploymentCount > topServices[j].DeploymentCount
	})

	if len(topServices) > limit {
		topServices = topServices[:limit]
	}

	return topServices
}

// getTopUsers gets top users by deployment count
func (hm *HistoryManager) getTopUsers(projectID string, limit int) []UserDeploymentStats {
	userStats := make(map[string]*UserDeploymentStats)

	for _, record := range hm.deployments {
		if projectID != "" && record.ProjectID != projectID {
			continue
		}

		user := record.Trigger.User
		if user == "" {
			continue
		}

		stats, exists := userStats[user]
		if !exists {
			stats = &UserDeploymentStats{
				User: user,
			}
			userStats[user] = stats
		}

		stats.DeploymentCount++
		stats.LastDeployment = record.CreatedAt

		if record.Status == "running" || record.Status == "completed" {
			stats.SuccessCount++
		} else if record.Status == "failed" {
			stats.FailureCount++
		}

		if record.Duration > 0 {
			if stats.AverageDuration == 0 {
				stats.AverageDuration = record.Duration
			} else {
				stats.AverageDuration = (stats.AverageDuration + record.Duration) / 2
			}
		}
	}

	// Calculate success rates
	for _, stats := range userStats {
		if stats.DeploymentCount > 0 {
			stats.SuccessRate = float64(stats.SuccessCount) / float64(stats.DeploymentCount) * 100
		}
	}

	// Convert to slice and sort
	var topUsers []UserDeploymentStats
	for _, stats := range userStats {
		topUsers = append(topUsers, *stats)
	}

	sort.Slice(topUsers, func(i, j int) bool {
		return topUsers[i].DeploymentCount > topUsers[j].DeploymentCount
	})

	if len(topUsers) > limit {
		topUsers = topUsers[:limit]
	}

	return topUsers
}

// saveDeployment saves a deployment record to storage
func (hm *HistoryManager) saveDeployment(record *DeploymentRecord) error {
	if err := os.MkdirAll(hm.storagePath, 0755); err != nil {
		return err
	}

	filename := filepath.Join(hm.storagePath, record.ID+".json")
	data, err := json.MarshalIndent(record, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(filename, data, 0644)
}

// deleteDeploymentFile removes a deployment file from storage
func (hm *HistoryManager) deleteDeploymentFile(id string) error {
	filename := filepath.Join(hm.storagePath, id+".json")
	return os.Remove(filename)
}

// loadDeployments loads all deployments from storage
func (hm *HistoryManager) loadDeployments() error {
	if _, err := os.Stat(hm.storagePath); os.IsNotExist(err) {
		return nil // Storage doesn't exist yet
	}

	files, err := os.ReadDir(hm.storagePath)
	if err != nil {
		return err
	}

	for _, file := range files {
		if file.IsDir() || !strings.HasSuffix(file.Name(), ".json") {
			continue
		}

		filename := filepath.Join(hm.storagePath, file.Name())
		data, err := os.ReadFile(filename)
		if err != nil {
			continue // Skip files that can't be read
		}

		var record DeploymentRecord
		if err := json.Unmarshal(data, &record); err != nil {
			continue // Skip invalid files
		}

		hm.deployments[record.ID] = &record
	}

	return nil
}
