package api

import (
	"containr/internal/database/sqlcdb"
	"containr/internal/docker"
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"net"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	dockercontainer "github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/mount"
	"github.com/docker/docker/api/types/registry"
	"github.com/docker/go-connections/nat"
	"github.com/gin-gonic/gin"
	_ "github.com/lib/pq"
)

const (
	managedDatabaseContainerPrefix = "containr-db"
	managedDatabaseVolumePrefix    = "containr-db-vol"
	managedDatabaseBackupVolume    = "containr-db-backups"
	managedDatabaseBackupImage     = "alpine:3.20"
	managedDatabaseDefaultPlan     = "hobby"
	managedDatabaseDefaultRegion   = "us-east"
)

// DatabaseService represents a managed database service
type DatabaseService struct {
	ID            string               `json:"id" db:"id"`
	Name          string               `json:"name" db:"name"`
	Type          string               `json:"type" db:"type"`     // postgresql, redis, mysql, mariadb, mongodb, clickhouse, dragonfly
	Status        string               `json:"status" db:"status"` // running, stopped, building, error
	Version       string               `json:"version" db:"version"`
	Plan          string               `json:"plan" db:"plan"` // hobby, starter, standard, business
	Region        string               `json:"region" db:"region"`
	CreatedAt     time.Time            `json:"created_at" db:"created_at"`
	UpdatedAt     time.Time            `json:"updated_at" db:"updated_at"`
	ConnectionURL string               `json:"connection_url"`
	Metrics       DatabaseMetrics      `json:"metrics"`
	Backups       DatabaseBackupConfig `json:"backups"`
	Settings      DatabaseSettings     `json:"settings"`
}

// DatabaseMetrics represents database performance metrics
type DatabaseMetrics struct {
	CPU         float64 `json:"cpu"`
	Memory      float64 `json:"memory"`
	Storage     float64 `json:"storage"`
	Connections int     `json:"connections"`
	ReadIOPS    int     `json:"read_iops"`
	WriteIOPS   int     `json:"write_iops"`
	NetworkIn   float64 `json:"network_in"`
	NetworkOut  float64 `json:"network_out"`
}

// DatabaseBackupConfig represents backup configuration
type DatabaseBackupConfig struct {
	Enabled    bool             `json:"enabled"`
	LastBackup *time.Time       `json:"last_backup,omitempty"`
	Retention  int              `json:"retention"` // days
	NextBackup *time.Time       `json:"next_backup,omitempty"`
	Backups    []DatabaseBackup `json:"backups"`
}

// DatabaseBackup represents a single backup
type DatabaseBackup struct {
	ID        string    `json:"id"`
	CreatedAt time.Time `json:"created_at"`
	Size      string    `json:"size"`
	Status    string    `json:"status"` // completed, failed, in_progress
}

// DatabaseSettings represents database configuration
type DatabaseSettings struct {
	MaxConnections int  `json:"max_connections"`
	Timeout        int  `json:"timeout"` // seconds
	SSL            bool `json:"ssl"`
	Logging        bool `json:"logging"`
}

// DatabaseCreateRequest represents a request to create a new database
type DatabaseCreateRequest struct {
	Name   string `json:"name" binding:"required"`
	Type   string `json:"type" binding:"required"`
	Plan   string `json:"plan" binding:"required,oneof=hobby starter standard business"`
	Region string `json:"region" binding:"required"`
}

// DatabaseUpdateRequest represents a request to update a database
type DatabaseUpdateRequest struct {
	Name string `json:"name,omitempty"`
	Plan string `json:"plan,omitempty"`
}

// DatabaseActionRequest represents a request to perform database actions
type DatabaseActionRequest struct {
	Action string `json:"action" binding:"required,oneof=start stop restart"`
}

// DatabaseBackupRequest represents a request to create a backup
type DatabaseBackupRequest struct {
	DatabaseID string `json:"database_id" binding:"required"`
}

// DatabaseRestoreRequest represents a request to restore from backup
type DatabaseRestoreRequest struct {
	DatabaseID string `json:"database_id" binding:"required"`
	BackupID   string `json:"backup_id" binding:"required"`
}

// DatabaseHandler handles database service operations
type DatabaseHandler struct {
	db           *sql.DB
	queries      *sqlcdb.Queries
	dockerClient *docker.Client
}

var supportedDatabaseTypes = map[string]struct{}{
	"postgresql": {},
	"redis":      {},
	"dragonfly":  {},
	"mysql":      {},
	"mariadb":    {},
	"mongodb":    {},
	"clickhouse": {},
}

var databaseDefaultVersions = map[string]string{
	"postgresql": "16.2",
	"redis":      "7.2",
	"dragonfly":  "1.24",
	"mysql":      "8.4",
	"mariadb":    "11.4",
	"mongodb":    "7.0",
	"clickhouse": "24.8",
}

var (
	errDatabaseNameRequired     = errors.New("name is required")
	errUnsupportedDatabaseType  = errors.New("unsupported database type")
	errUnsupportedDatabasePlan  = errors.New("unsupported database plan")
	errDatabaseNameAlreadyInUse = errors.New("database name already exists")
)

// NewDatabaseHandler creates a new database handler
func NewDatabaseHandler(db *sql.DB, dockerClient *docker.Client) *DatabaseHandler {
	return &DatabaseHandler{
		db:           db,
		queries:      sqlcdb.New(db),
		dockerClient: dockerClient,
	}
}

// GetDatabases returns all database services for a user
func (h *DatabaseHandler) GetDatabases(c *gin.Context) {
	userID, ok := requireAuthenticatedUserID(c)
	if !ok {
		return
	}
	rows, err := h.queries.ListDatabaseServicesByUser(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch databases"})
		return
	}

	databases := make([]DatabaseService, 0, len(rows))
	for _, row := range rows {
		db := mapDatabaseServiceListRow(row)
		db = h.reconcileManagedDatabaseState(c.Request.Context(), db)

		db.Metrics = h.resolveDatabaseMetrics(c.Request.Context(), db)
		if backupConfig, err := h.resolveBackupConfig(c.Request.Context(), userID, db.ID); err == nil {
			db.Backups = backupConfig
		} else {
			db.Backups = h.generateMockBackupConfig()
		}
		db.Settings = h.generateMockSettings()
		db.ConnectionURL = h.resolveConnectionURL(db)

		databases = append(databases, db)
	}

	c.JSON(http.StatusOK, gin.H{"databases": databases})
}

// GetDatabase returns a specific database service
func (h *DatabaseHandler) GetDatabase(c *gin.Context) {
	userID, ok := requireAuthenticatedUserID(c)
	if !ok {
		return
	}
	databaseID := c.Param("id")
	row, err := h.queries.GetDatabaseServiceByIDAndUser(c.Request.Context(), sqlcdb.GetDatabaseServiceByIDAndUserParams{
		ID:     databaseID,
		UserID: userID,
	})
	if err != nil {
		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "Database not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch database"})
		return
	}
	db := mapDatabaseServiceGetRow(row)
	db = h.reconcileManagedDatabaseState(c.Request.Context(), db)

	db.Metrics = h.resolveDatabaseMetrics(c.Request.Context(), db)
	if backupConfig, err := h.resolveBackupConfig(c.Request.Context(), userID, db.ID); err == nil {
		db.Backups = backupConfig
	} else {
		db.Backups = h.generateMockBackupConfig()
	}
	db.Settings = h.generateMockSettings()
	db.ConnectionURL = h.resolveConnectionURL(db)

	c.JSON(http.StatusOK, db)
}

// CreateDatabase creates a new database service
func (h *DatabaseHandler) CreateDatabase(c *gin.Context) {
	userID, ok := requireAuthenticatedUserID(c)
	if !ok {
		return
	}

	var req DatabaseCreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	databaseID, dbName, dbType, err := h.createManagedDatabase(c.Request.Context(), userID, managedDatabaseCreateRequest{
		Name:   req.Name,
		Type:   req.Type,
		Plan:   req.Plan,
		Region: req.Region,
	})
	if err != nil {
		switch {
		case errors.Is(err, errDatabaseNameRequired), errors.Is(err, errUnsupportedDatabaseType), errors.Is(err, errUnsupportedDatabasePlan):
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		case errors.Is(err, errDatabaseNameAlreadyInUse):
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create database"})
		}
		return
	}

	go h.provisionDatabase(databaseID, dbName, dbType)

	c.JSON(http.StatusCreated, gin.H{
		"id":      databaseID,
		"message": "Database provisioning started",
		"status":  "building",
	})
}

type managedDatabaseCreateRequest struct {
	Name             string
	Type             string
	Plan             string
	Region           string
	RuntimeVariables map[string]string
}

func (h *DatabaseHandler) createManagedDatabase(ctx context.Context, userID string, req managedDatabaseCreateRequest) (databaseID string, name string, dbType string, err error) {
	name = strings.TrimSpace(req.Name)
	if name == "" {
		return "", "", "", errDatabaseNameRequired
	}

	dbType = normalizeDatabaseType(req.Type)
	if _, exists := supportedDatabaseTypes[dbType]; !exists {
		return "", "", "", fmt.Errorf("%w: %s", errUnsupportedDatabaseType, dbType)
	}

	plan := strings.TrimSpace(req.Plan)
	if plan == "" {
		plan = managedDatabaseDefaultPlan
	}
	if !isSupportedDatabasePlan(plan) {
		return "", "", "", fmt.Errorf("%w: %s", errUnsupportedDatabasePlan, plan)
	}

	region := strings.TrimSpace(req.Region)
	if region == "" {
		region = managedDatabaseDefaultRegion
	}

	count, err := h.queries.CountDatabaseServicesByUserAndName(ctx, sqlcdb.CountDatabaseServicesByUserAndNameParams{
		UserID: userID,
		Name:   name,
	})
	if err != nil {
		return "", "", "", fmt.Errorf("failed to validate database name: %w", err)
	}
	if count > 0 {
		return "", "", "", errDatabaseNameAlreadyInUse
	}

	databaseID = generateDatabaseID(name)
	now := time.Now()
	version := h.getDefaultVersion(dbType)

	err = h.queries.CreateDatabaseService(ctx, sqlcdb.CreateDatabaseServiceParams{
		ID:        databaseID,
		UserID:    userID,
		Name:      name,
		Type:      dbType,
		Status:    "building",
		Version:   version,
		Plan:      plan,
		Region:    region,
		CreatedAt: sql.NullTime{Time: now, Valid: true},
		UpdatedAt: sql.NullTime{Time: now, Valid: true},
	})
	if err != nil {
		return "", "", "", fmt.Errorf("failed to create database service: %w", err)
	}

	return databaseID, name, dbType, nil
}

func (h *DatabaseHandler) createManagedDatabaseAndProvision(ctx context.Context, userID string, req managedDatabaseCreateRequest) (string, error) {
	databaseID, name, dbType, err := h.createManagedDatabase(ctx, userID, req)
	if err != nil {
		return "", err
	}

	go h.provisionDatabaseWithVariables(databaseID, name, dbType, req.RuntimeVariables)
	return databaseID, nil
}

// UpdateDatabase updates a database service
func (h *DatabaseHandler) UpdateDatabase(c *gin.Context) {
	userID, ok := requireAuthenticatedUserID(c)
	if !ok {
		return
	}
	databaseID := c.Param("id")

	var req DatabaseUpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	req.Name = strings.TrimSpace(req.Name)
	req.Plan = strings.TrimSpace(req.Plan)

	if req.Name == "" && req.Plan == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No fields to update"})
		return
	}

	now := sql.NullTime{Time: time.Now(), Valid: true}
	var err error
	switch {
	case req.Name != "" && req.Plan != "":
		err = h.queries.UpdateDatabaseServiceNameAndPlanByIDAndUser(c.Request.Context(), sqlcdb.UpdateDatabaseServiceNameAndPlanByIDAndUserParams{
			Name:      req.Name,
			Plan:      req.Plan,
			UpdatedAt: now,
			ID:        databaseID,
			UserID:    userID,
		})
	case req.Name != "":
		err = h.queries.UpdateDatabaseServiceNameByIDAndUser(c.Request.Context(), sqlcdb.UpdateDatabaseServiceNameByIDAndUserParams{
			Name:      req.Name,
			UpdatedAt: now,
			ID:        databaseID,
			UserID:    userID,
		})
	default:
		err = h.queries.UpdateDatabaseServicePlanByIDAndUser(c.Request.Context(), sqlcdb.UpdateDatabaseServicePlanByIDAndUserParams{
			Plan:      req.Plan,
			UpdatedAt: now,
			ID:        databaseID,
			UserID:    userID,
		})
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update database"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Database updated successfully"})
}

// DeleteDatabase deletes a database service
func (h *DatabaseHandler) DeleteDatabase(c *gin.Context) {
	userID, ok := requireAuthenticatedUserID(c)
	if !ok {
		return
	}
	databaseID := c.Param("id")

	exists, err := h.queries.DatabaseServiceExistsByIDAndUser(c.Request.Context(), sqlcdb.DatabaseServiceExistsByIDAndUserParams{
		ID:     databaseID,
		UserID: userID,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to check database"})
		return
	}

	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "Database not found"})
		return
	}

	if h.dockerClient != nil {
		if err := h.deleteManagedDatabaseRuntime(databaseID); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete runtime database"})
			return
		}
	}

	err = h.queries.DeleteDatabaseServiceByIDAndUser(c.Request.Context(), sqlcdb.DeleteDatabaseServiceByIDAndUserParams{
		ID:     databaseID,
		UserID: userID,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete database"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Database deleted successfully"})
}

// PerformDatabaseAction performs actions on a database (start, stop, restart)
func (h *DatabaseHandler) PerformDatabaseAction(c *gin.Context) {
	userID, ok := requireAuthenticatedUserID(c)
	if !ok {
		return
	}
	databaseID := c.Param("id")

	var req DatabaseActionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	exists, err := h.queries.DatabaseServiceExistsByIDAndUser(c.Request.Context(), sqlcdb.DatabaseServiceExistsByIDAndUserParams{
		ID:     databaseID,
		UserID: userID,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to check database"})
		return
	}

	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "Database not found"})
		return
	}

	var newStatus string
	switch req.Action {
	case "start":
		if h.dockerClient != nil {
			if err := h.startManagedDatabase(databaseID); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to start database runtime"})
				return
			}
		}
		newStatus = "running"
	case "stop":
		if h.dockerClient != nil {
			if err := h.stopManagedDatabase(databaseID); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to stop database runtime"})
				return
			}
		}
		newStatus = "stopped"
	case "restart":
		newStatus = "building"
		if err := h.queries.SetDatabaseServiceStatusByIDAndUser(c.Request.Context(), sqlcdb.SetDatabaseServiceStatusByIDAndUserParams{
			Status:    newStatus,
			UpdatedAt: sql.NullTime{Time: time.Now(), Valid: true},
			ID:        databaseID,
			UserID:    userID,
		}); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update database status"})
			return
		}

		if h.dockerClient != nil {
			if err := h.restartManagedDatabase(databaseID); err != nil {
				_ = h.queries.SetDatabaseServiceStatusByIDAndUser(c.Request.Context(), sqlcdb.SetDatabaseServiceStatusByIDAndUserParams{
					Status:    "error",
					UpdatedAt: sql.NullTime{Time: time.Now(), Valid: true},
					ID:        databaseID,
					UserID:    userID,
				})
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to restart database runtime"})
				return
			}
		}
		newStatus = "running"
	default:
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid action"})
		return
	}

	err = h.queries.SetDatabaseServiceStatusByIDAndUser(c.Request.Context(), sqlcdb.SetDatabaseServiceStatusByIDAndUserParams{
		Status:    newStatus,
		UpdatedAt: sql.NullTime{Time: time.Now(), Valid: true},
		ID:        databaseID,
		UserID:    userID,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update database status"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": fmt.Sprintf("Database %s initiated", req.Action),
		"status":  newStatus,
	})
}

// CreateBackup creates a backup of a database
func (h *DatabaseHandler) CreateBackup(c *gin.Context) {
	userID, ok := requireAuthenticatedUserID(c)
	if !ok {
		return
	}
	databaseID := c.Param("id")

	row, err := h.queries.GetDatabaseServiceByIDAndUser(c.Request.Context(), sqlcdb.GetDatabaseServiceByIDAndUserParams{
		ID:     databaseID,
		UserID: userID,
	})
	if err != nil {
		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "Database not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to check database"})
		return
	}
	if row.Status == "building" {
		c.JSON(http.StatusConflict, gin.H{"error": "Database is still provisioning"})
		return
	}

	backupID := generateDatabaseBackupID(databaseID)
	archivePath := sanitizeBackupArchivePath(managedDatabaseBackupArchivePath(backupID))
	now := time.Now()
	if err := h.queries.CreateDatabaseBackup(c.Request.Context(), sqlcdb.CreateDatabaseBackupParams{
		ID:         backupID,
		DatabaseID: databaseID,
		Size:       "pending",
		Status:     "in_progress",
		BackupPath: sql.NullString{String: archivePath, Valid: true},
		CreatedAt:  sql.NullTime{Time: now, Valid: true},
	}); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create backup record"})
		return
	}

	go h.createBackupProcess(databaseID, backupID, archivePath)

	c.JSON(http.StatusCreated, gin.H{
		"backup_id": backupID,
		"message":   "Backup creation started",
		"status":    "in_progress",
	})
}

// RestoreBackup restores a database from a backup
func (h *DatabaseHandler) RestoreBackup(c *gin.Context) {
	userID, ok := requireAuthenticatedUserID(c)
	if !ok {
		return
	}
	databaseID := c.Param("id")

	var req DatabaseRestoreRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	exists, err := h.queries.DatabaseServiceExistsByIDAndUser(c.Request.Context(), sqlcdb.DatabaseServiceExistsByIDAndUserParams{
		ID:     databaseID,
		UserID: userID,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to check database"})
		return
	}

	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "Database not found"})
		return
	}

	backup, err := h.queries.GetDatabaseBackupByIDAndDatabaseAndUser(c.Request.Context(), sqlcdb.GetDatabaseBackupByIDAndDatabaseAndUserParams{
		ID:         req.BackupID,
		DatabaseID: databaseID,
		UserID:     userID,
	})
	if err != nil {
		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "Backup not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to check backup"})
		return
	}
	if backup.Status != "completed" {
		c.JSON(http.StatusConflict, gin.H{"error": "Backup is not ready for restore"})
		return
	}

	backupPath := sanitizeBackupArchivePath(managedDatabaseBackupArchivePath(req.BackupID))
	if backup.BackupPath.Valid && strings.TrimSpace(backup.BackupPath.String) != "" {
		backupPath = sanitizeBackupArchivePath(backup.BackupPath.String)
	}

	go h.restoreBackupProcess(databaseID, req.BackupID, backupPath)

	c.JSON(http.StatusOK, gin.H{
		"message": "Database restore started",
		"status":  "in_progress",
	})
}

func (h *DatabaseHandler) resolveDatabaseMetrics(ctx context.Context, db DatabaseService) DatabaseMetrics {
	if h.dockerClient == nil {
		return h.generateMockMetrics()
	}

	statsCtx, cancel := context.WithTimeout(ctx, 2*time.Second)
	defer cancel()

	stats, err := h.dockerClient.GetContainerStats(statsCtx, managedDatabaseContainerName(db.ID), false)
	if err != nil {
		return h.generateMockMetrics()
	}
	defer stats.Body.Close()

	var payload dockercontainer.StatsResponse
	if err := json.NewDecoder(stats.Body).Decode(&payload); err != nil {
		return h.generateMockMetrics()
	}

	cpu := calculateDockerCPUPercent(payload)
	memory := calculateDockerMemoryPercent(payload)
	readBytes, writeBytes := calculateDockerBlkio(payload)
	networkInBytes, networkOutBytes := calculateDockerNetwork(payload)

	return DatabaseMetrics{
		CPU:         roundFloat(cpu, 2),
		Memory:      roundFloat(memory, 2),
		Storage:     0,
		Connections: 0,
		ReadIOPS:    int(readBytes / 1024),
		WriteIOPS:   int(writeBytes / 1024),
		NetworkIn:   roundFloat(float64(networkInBytes)/(1024*1024), 3),
		NetworkOut:  roundFloat(float64(networkOutBytes)/(1024*1024), 3),
	}
}

func (h *DatabaseHandler) generateMockMetrics() DatabaseMetrics {
	return DatabaseMetrics{
		CPU:         25.0 + (float64(time.Now().Unix() % 50)),
		Memory:      60.0 + (float64(time.Now().Unix() % 30)),
		Storage:     45.0 + (float64(time.Now().Unix() % 40)),
		Connections: 10 + (int(time.Now().Unix() % 20)),
		ReadIOPS:    150 + (int(time.Now().Unix() % 100)),
		WriteIOPS:   80 + (int(time.Now().Unix() % 50)),
		NetworkIn:   2.5 + (float64(time.Now().Unix()%10))/10,
		NetworkOut:  1.8 + (float64(time.Now().Unix()%8))/10,
	}
}

func calculateDockerCPUPercent(payload dockercontainer.StatsResponse) float64 {
	cpuDelta := float64(payload.CPUStats.CPUUsage.TotalUsage) - float64(payload.PreCPUStats.CPUUsage.TotalUsage)
	systemDelta := float64(payload.CPUStats.SystemUsage) - float64(payload.PreCPUStats.SystemUsage)
	if cpuDelta <= 0 || systemDelta <= 0 {
		return 0
	}

	onlineCPUs := float64(payload.CPUStats.OnlineCPUs)
	if onlineCPUs <= 0 {
		onlineCPUs = float64(len(payload.CPUStats.CPUUsage.PercpuUsage))
		if onlineCPUs <= 0 {
			onlineCPUs = 1
		}
	}

	return (cpuDelta / systemDelta) * onlineCPUs * 100
}

func calculateDockerMemoryPercent(payload dockercontainer.StatsResponse) float64 {
	usage := float64(payload.MemoryStats.Usage)
	limit := float64(payload.MemoryStats.Limit)
	if usage <= 0 || limit <= 0 {
		return 0
	}

	cache := 0.0
	if payload.MemoryStats.Stats != nil {
		if v, ok := payload.MemoryStats.Stats["cache"]; ok {
			cache = float64(v)
		}
	}
	adjusted := usage - cache
	if adjusted < 0 {
		adjusted = usage
	}

	return (adjusted / limit) * 100
}

func calculateDockerBlkio(payload dockercontainer.StatsResponse) (readBytes uint64, writeBytes uint64) {
	for _, entry := range payload.BlkioStats.IoServiceBytesRecursive {
		switch strings.ToLower(strings.TrimSpace(entry.Op)) {
		case "read":
			readBytes += entry.Value
		case "write":
			writeBytes += entry.Value
		}
	}
	return readBytes, writeBytes
}

func calculateDockerNetwork(payload dockercontainer.StatsResponse) (rxBytes uint64, txBytes uint64) {
	for _, networkStats := range payload.Networks {
		rxBytes += networkStats.RxBytes
		txBytes += networkStats.TxBytes
	}
	return rxBytes, txBytes
}

func roundFloat(value float64, places int) float64 {
	pow := math.Pow(10, float64(places))
	return math.Round(value*pow) / pow
}

func (h *DatabaseHandler) resolveBackupConfig(ctx context.Context, userID, databaseID string) (DatabaseBackupConfig, error) {
	rows, err := h.queries.ListDatabaseBackupsByDatabaseAndUser(ctx, sqlcdb.ListDatabaseBackupsByDatabaseAndUserParams{
		DatabaseID: databaseID,
		UserID:     userID,
		Limit:      20,
	})
	if err != nil {
		return DatabaseBackupConfig{}, err
	}

	var lastBackup *time.Time
	backups := make([]DatabaseBackup, 0, len(rows))
	for _, row := range rows {
		createdAt := databaseNullTime(row.CreatedAt)
		backups = append(backups, DatabaseBackup{
			ID:        row.ID,
			CreatedAt: createdAt,
			Size:      row.Size,
			Status:    row.Status,
		})
		if lastBackup == nil && row.Status == "completed" {
			t := createdAt
			lastBackup = &t
		}
	}

	var nextBackup *time.Time
	if lastBackup != nil {
		t := lastBackup.Add(24 * time.Hour)
		nextBackup = &t
	}

	return DatabaseBackupConfig{
		Enabled:    true,
		LastBackup: lastBackup,
		Retention:  30,
		NextBackup: nextBackup,
		Backups:    backups,
	}, nil
}

func (h *DatabaseHandler) generateMockBackupConfig() DatabaseBackupConfig {
	return DatabaseBackupConfig{
		Enabled:    true,
		LastBackup: &time.Time{},
		Retention:  30,
		NextBackup: &time.Time{},
		Backups: []DatabaseBackup{
			{
				ID:        "backup_1",
				CreatedAt: time.Now().Add(-6 * time.Hour),
				Size:      "245 MB",
				Status:    "completed",
			},
			{
				ID:        "backup_2",
				CreatedAt: time.Now().Add(-24 * time.Hour),
				Size:      "238 MB",
				Status:    "completed",
			},
			{
				ID:        "backup_3",
				CreatedAt: time.Now().Add(-48 * time.Hour),
				Size:      "241 MB",
				Status:    "completed",
			},
		},
	}
}

func (h *DatabaseHandler) generateMockSettings() DatabaseSettings {
	return DatabaseSettings{
		MaxConnections: 100,
		Timeout:        30,
		SSL:            true,
		Logging:        true,
	}
}

func (h *DatabaseHandler) resolveConnectionURL(db DatabaseService) string {
	if strings.TrimSpace(db.ConnectionURL) != "" {
		return db.ConnectionURL
	}
	return h.generateConnectionURL(db)
}

func (h *DatabaseHandler) generateConnectionURL(db DatabaseService) string {
	safeName := sanitizeDBIdentifier(db.Name, "app")
	switch db.Type {
	case "postgresql":
		return fmt.Sprintf("postgresql://user:password@%s.containr.local:5432/%s", safeName, safeName)
	case "redis":
		return fmt.Sprintf("redis://%s.containr.local:6379", safeName)
	case "dragonfly":
		return fmt.Sprintf("redis://%s.containr.local:6379", safeName)
	case "mysql":
		return fmt.Sprintf("mysql://user:password@%s.containr.local:3306/%s", safeName, safeName)
	case "mariadb":
		return fmt.Sprintf("mysql://user:password@%s.containr.local:3306/%s", safeName, safeName)
	case "mongodb":
		return fmt.Sprintf("mongodb://user:password@%s.containr.local:27017/%s", safeName, safeName)
	case "clickhouse":
		return fmt.Sprintf("http://%s.containr.local:8123", safeName)
	default:
		return ""
	}
}

func (h *DatabaseHandler) reconcileManagedDatabaseState(ctx context.Context, db DatabaseService) DatabaseService {
	if h.dockerClient == nil {
		return db
	}

	status, err := h.resolveManagedRuntimeStatus(ctx, db)
	if err != nil {
		return db
	}
	if status == db.Status {
		return db
	}

	db.Status = status
	updateCtx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	_ = h.queries.SetDatabaseServiceStatusByID(updateCtx, sqlcdb.SetDatabaseServiceStatusByIDParams{
		Status:    status,
		UpdatedAt: sql.NullTime{Time: time.Now(), Valid: true},
		ID:        db.ID,
	})
	return db
}

func (h *DatabaseHandler) resolveManagedRuntimeStatus(ctx context.Context, db DatabaseService) (string, error) {
	inspect, err := h.dockerClient.GetContainer(ctx, managedDatabaseContainerName(db.ID))
	if err != nil {
		if !isDockerNotFoundError(err) {
			return "", err
		}

		// During startup provision there can be a short gap before the runtime exists.
		if db.Status == "building" && time.Since(db.UpdatedAt) < 2*time.Minute {
			return "building", nil
		}
		if db.Status == "stopped" {
			return "stopped", nil
		}
		return "error", nil
	}

	if inspect.State == nil {
		return db.Status, nil
	}

	if inspect.State.Running {
		return "running", nil
	}
	if inspect.State.Restarting {
		return "building", nil
	}

	switch strings.ToLower(strings.TrimSpace(inspect.State.Status)) {
	case "created", "restarting":
		return "building", nil
	case "exited", "dead":
		if inspect.State.ExitCode != 0 && db.Status != "stopped" {
			return "error", nil
		}
		return "stopped", nil
	case "paused":
		return "stopped", nil
	default:
		return db.Status, nil
	}
}

func mapDatabaseServiceListRow(row sqlcdb.ListDatabaseServicesByUserRow) DatabaseService {
	return DatabaseService{
		ID:            row.ID,
		Name:          row.Name,
		Type:          row.Type,
		Status:        row.Status,
		Version:       row.Version,
		Plan:          row.Plan,
		Region:        row.Region,
		ConnectionURL: databaseNullString(row.ConnectionUrl),
		CreatedAt:     databaseNullTime(row.CreatedAt),
		UpdatedAt:     databaseNullTime(row.UpdatedAt),
	}
}

func mapDatabaseServiceGetRow(row sqlcdb.GetDatabaseServiceByIDAndUserRow) DatabaseService {
	return DatabaseService{
		ID:            row.ID,
		Name:          row.Name,
		Type:          row.Type,
		Status:        row.Status,
		Version:       row.Version,
		Plan:          row.Plan,
		Region:        row.Region,
		ConnectionURL: databaseNullString(row.ConnectionUrl),
		CreatedAt:     databaseNullTime(row.CreatedAt),
		UpdatedAt:     databaseNullTime(row.UpdatedAt),
	}
}

func databaseNullTime(value sql.NullTime) time.Time {
	if value.Valid {
		return value.Time
	}
	return time.Time{}
}

func databaseNullString(value sql.NullString) string {
	if value.Valid {
		return value.String
	}
	return ""
}

func (h *DatabaseHandler) getDefaultVersion(dbType string) string {
	if version, exists := databaseDefaultVersions[dbType]; exists {
		return version
	}
	return "latest"
}

func normalizeDatabaseType(dbType string) string {
	switch strings.ToLower(strings.TrimSpace(dbType)) {
	case "postgres", "postgresql", "pg":
		return "postgresql"
	case "redis":
		return "redis"
	case "dragonfly", "dragonflydb":
		return "dragonfly"
	case "mysql":
		return "mysql"
	case "mariadb":
		return "mariadb"
	case "mongo", "mongodb":
		return "mongodb"
	case "clickhouse":
		return "clickhouse"
	default:
		return strings.ToLower(strings.TrimSpace(dbType))
	}
}

func isSupportedDatabasePlan(plan string) bool {
	switch strings.ToLower(strings.TrimSpace(plan)) {
	case "hobby", "starter", "standard", "business":
		return true
	default:
		return false
	}
}

func generateDatabaseID(name string) string {
	slug := sanitizeDBIdentifier(name, "database")
	randomPart := "000000"
	buf := make([]byte, 3)
	if _, err := rand.Read(buf); err == nil {
		randomPart = hex.EncodeToString(buf)
	}
	return fmt.Sprintf("db_%d_%s_%s", time.Now().Unix(), slug, randomPart)
}

func generateDatabaseBackupID(databaseID string) string {
	slug := sanitizeDBIdentifier(databaseID, "database")
	randomPart := "0000"
	buf := make([]byte, 2)
	if _, err := rand.Read(buf); err == nil {
		randomPart = hex.EncodeToString(buf)
	}
	return fmt.Sprintf("backup_%d_%s_%s", time.Now().Unix(), slug, randomPart)
}

func managedDatabaseBackupArchivePath(backupID string) string {
	return sanitizeDBIdentifier(backupID, "backup") + ".tar.gz"
}

func sanitizeBackupArchivePath(value string) string {
	value = strings.TrimSpace(value)
	value = strings.TrimPrefix(value, "/")
	value = strings.TrimSuffix(value, ".tar.gz")
	return sanitizeDBIdentifier(value, "backup") + ".tar.gz"
}

func sanitizeDBIdentifier(value, fallback string) string {
	value = strings.TrimSpace(strings.ToLower(value))
	if value == "" {
		return fallback
	}

	var b strings.Builder
	lastWasSep := false
	for _, r := range value {
		isAlphaNum := (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9')
		if isAlphaNum {
			b.WriteRune(r)
			lastWasSep = false
			continue
		}
		if !lastWasSep {
			b.WriteRune('_')
			lastWasSep = true
		}
	}

	sanitized := strings.Trim(b.String(), "_")
	if sanitized == "" {
		return fallback
	}
	if len(sanitized) > 40 {
		sanitized = sanitized[:40]
	}
	return sanitized
}

func managedDatabaseContainerName(databaseID string) string {
	name := strings.ReplaceAll(strings.ToLower(databaseID), "_", "-")
	name = strings.Trim(name, "-")
	if name == "" {
		name = "db"
	}
	full := managedDatabaseContainerPrefix + "-" + name
	if len(full) > 63 {
		full = full[:63]
		full = strings.TrimRight(full, "-")
	}
	return full
}

func managedDatabaseVolumeName(databaseID string) string {
	name := strings.ReplaceAll(strings.ToLower(databaseID), "_", "-")
	name = strings.Trim(name, "-")
	if name == "" {
		name = "db"
	}
	full := managedDatabaseVolumePrefix + "-" + name
	if len(full) > 63 {
		full = full[:63]
		full = strings.TrimRight(full, "-")
	}
	return full
}

type databaseRuntimePlan struct {
	Image         string
	Port          nat.Port
	Env           []string
	Cmd           []string
	DataDir       string
	ConnectionURL func(hostPort string) string
}

func (h *DatabaseHandler) provisionDatabase(databaseID, databaseName, dbType string) {
	h.provisionDatabaseWithVariables(databaseID, databaseName, dbType, nil)
}

func (h *DatabaseHandler) provisionDatabaseWithVariables(databaseID, databaseName, dbType string, runtimeVariables map[string]string) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()

	if h.dockerClient == nil {
		fallbackURL := h.generateConnectionURL(DatabaseService{Name: databaseName, Type: dbType})
		_ = h.setDatabaseStatusAndConnection(databaseID, "running", sql.NullString{String: fallbackURL, Valid: fallbackURL != ""})
		return
	}

	connectionURL, err := h.provisionDatabaseRuntime(ctx, databaseID, databaseName, dbType, runtimeVariables)
	if err != nil {
		_ = h.setDatabaseStatusAndConnection(databaseID, "error", sql.NullString{})
		return
	}

	_ = h.setDatabaseStatusAndConnection(databaseID, "running", sql.NullString{String: connectionURL, Valid: true})
}

func (h *DatabaseHandler) setDatabaseStatusAndConnection(databaseID, status string, connectionURL sql.NullString) error {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	return h.queries.SetDatabaseServiceStatusAndConnectionByID(ctx, sqlcdb.SetDatabaseServiceStatusAndConnectionByIDParams{
		Status:        status,
		ConnectionUrl: connectionURL,
		UpdatedAt:     sql.NullTime{Time: time.Now(), Valid: true},
		ID:            databaseID,
	})
}

func (h *DatabaseHandler) provisionDatabaseRuntime(ctx context.Context, databaseID, databaseName, dbType string, runtimeVariables map[string]string) (string, error) {
	plan, err := buildDatabaseRuntimePlan(dbType, databaseName, runtimeVariables)
	if err != nil {
		return "", err
	}

	containerName := managedDatabaseContainerName(databaseID)
	volumeName := managedDatabaseVolumeName(databaseID)

	if err := h.ensureImage(ctx, plan.Image); err != nil {
		return "", err
	}

	if _, err := h.dockerClient.CreateVolume(ctx, docker.VolumeConfig{
		Name: volumeName,
		Labels: map[string]string{
			"containr.managed":  "true",
			"containr.database": databaseID,
		},
	}); err != nil {
		if !strings.Contains(strings.ToLower(err.Error()), "already exists") {
			return "", fmt.Errorf("failed to create volume: %w", err)
		}
	}

	portBindings := nat.PortMap{
		plan.Port: []nat.PortBinding{{HostIP: "127.0.0.1", HostPort: ""}},
	}

	exposedPorts := nat.PortSet{plan.Port: struct{}{}}

	containerID, err := h.dockerClient.CreateContainer(ctx, docker.ContainerConfig{
		Name:          containerName,
		Image:         plan.Image,
		Cmd:           plan.Cmd,
		Env:           plan.Env,
		RestartPolicy: "unless-stopped",
		ExposedPorts:  exposedPorts,
		PortBindings:  portBindings,
		Mounts: []mount.Mount{
			{
				Type:   mount.TypeVolume,
				Source: volumeName,
				Target: plan.DataDir,
			},
		},
		Labels: map[string]string{
			"containr.managed":  "true",
			"containr.database": databaseID,
			"containr.type":     dbType,
		},
		NetworkMode: "bridge",
	})
	if err != nil {
		if strings.Contains(strings.ToLower(err.Error()), "already in use") {
			_ = h.dockerClient.RemoveContainer(ctx, containerName, true)
			containerID, err = h.dockerClient.CreateContainer(ctx, docker.ContainerConfig{
				Name:          containerName,
				Image:         plan.Image,
				Cmd:           plan.Cmd,
				Env:           plan.Env,
				RestartPolicy: "unless-stopped",
				ExposedPorts:  exposedPorts,
				PortBindings:  portBindings,
				Mounts: []mount.Mount{
					{Type: mount.TypeVolume, Source: volumeName, Target: plan.DataDir},
				},
				Labels: map[string]string{
					"containr.managed":  "true",
					"containr.database": databaseID,
					"containr.type":     dbType,
				},
				NetworkMode: "bridge",
			})
		}
		if err != nil {
			return "", fmt.Errorf("failed to create container: %w", err)
		}
	}

	if err := h.dockerClient.StartContainer(ctx, containerID); err != nil {
		return "", fmt.Errorf("failed to start container: %w", err)
	}

	hostPort, err := h.resolvePublishedHostPort(ctx, containerID, plan.Port)
	if err != nil {
		return "", err
	}
	if err := waitForRuntimePortReadiness(ctx, hostPort); err != nil {
		return "", err
	}

	return plan.ConnectionURL(hostPort), nil
}

func (h *DatabaseHandler) resolvePublishedHostPort(ctx context.Context, containerID string, port nat.Port) (string, error) {
	deadline := time.Now().Add(20 * time.Second)
	for time.Now().Before(deadline) {
		inspect, err := h.dockerClient.GetContainer(ctx, containerID)
		if err != nil {
			return "", fmt.Errorf("failed to inspect container: %w", err)
		}

		if inspect.NetworkSettings != nil {
			if bindings, ok := inspect.NetworkSettings.Ports[port]; ok && len(bindings) > 0 {
				hostPort := strings.TrimSpace(bindings[0].HostPort)
				if hostPort != "" {
					return hostPort, nil
				}
			}
		}

		select {
		case <-ctx.Done():
			return "", ctx.Err()
		case <-time.After(300 * time.Millisecond):
		}
	}

	return "", fmt.Errorf("published host port not available")
}

func waitForRuntimePortReadiness(ctx context.Context, hostPort string) error {
	addr := net.JoinHostPort("127.0.0.1", strings.TrimSpace(hostPort))
	deadline := time.Now().Add(30 * time.Second)

	for time.Now().Before(deadline) {
		conn, err := net.DialTimeout("tcp", addr, 1500*time.Millisecond)
		if err == nil {
			_ = conn.Close()
			return nil
		}

		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(300 * time.Millisecond):
		}
	}

	return fmt.Errorf("database runtime did not become reachable on %s", addr)
}

func (h *DatabaseHandler) ensureImage(ctx context.Context, imageRef string) error {
	if _, err := h.dockerClient.GetImageInfo(ctx, imageRef); err == nil {
		return nil
	}

	reader, err := h.dockerClient.PullImage(ctx, imageRef, registry.AuthConfig{})
	if err != nil {
		return fmt.Errorf("failed to pull image %q: %w", imageRef, err)
	}
	defer reader.Close()
	_, _ = io.Copy(io.Discard, reader)
	return nil
}

func buildDatabaseRuntimePlan(dbType, databaseName string, runtimeVariables map[string]string) (databaseRuntimePlan, error) {
	databaseName = sanitizeDBIdentifier(databaseName, "app")

	newPassword := func() (string, error) {
		buf := make([]byte, 12)
		if _, err := rand.Read(buf); err != nil {
			return "", err
		}
		return hex.EncodeToString(buf), nil
	}

	safeUser := func(v string) string { return url.QueryEscape(v) }
	safePass := func(v string) string { return url.QueryEscape(v) }
	variable := func(key, fallback string) string {
		if runtimeVariables == nil {
			return fallback
		}
		if value, exists := runtimeVariables[key]; exists {
			value = strings.TrimSpace(value)
			if value != "" {
				return value
			}
		}
		return fallback
	}
	passwordVariable := func(key string) (string, error) {
		if runtimeVariables != nil {
			if value, exists := runtimeVariables[key]; exists {
				value = strings.TrimSpace(value)
				if value != "" {
					return value, nil
				}
			}
		}
		return newPassword()
	}

	switch dbType {
	case "postgresql":
		user := sanitizeDBIdentifier(variable("POSTGRES_USER", "app"), "app")
		dbName := sanitizeDBIdentifier(variable("POSTGRES_DB", databaseName), databaseName)
		password, err := passwordVariable("POSTGRES_PASSWORD")
		if err != nil {
			return databaseRuntimePlan{}, err
		}
		return databaseRuntimePlan{
			Image:   "postgres:16-alpine",
			Port:    nat.Port("5432/tcp"),
			DataDir: "/var/lib/postgresql/data",
			Env: []string{
				"POSTGRES_DB=" + dbName,
				"POSTGRES_USER=" + user,
				"POSTGRES_PASSWORD=" + password,
			},
			ConnectionURL: func(hostPort string) string {
				return fmt.Sprintf("postgresql://%s:%s@localhost:%s/%s?sslmode=disable", safeUser(user), safePass(password), hostPort, dbName)
			},
		}, nil
	case "redis":
		password, err := passwordVariable("REDIS_PASSWORD")
		if err != nil {
			return databaseRuntimePlan{}, err
		}
		return databaseRuntimePlan{
			Image:   "redis:7-alpine",
			Port:    nat.Port("6379/tcp"),
			DataDir: "/data",
			Cmd:     []string{"redis-server", "--appendonly", "yes", "--requirepass", password},
			ConnectionURL: func(hostPort string) string {
				return fmt.Sprintf("redis://default:%s@localhost:%s/0", safePass(password), hostPort)
			},
		}, nil
	case "dragonfly":
		password, err := passwordVariable("DRAGONFLY_PASSWORD")
		if err != nil {
			return databaseRuntimePlan{}, err
		}
		return databaseRuntimePlan{
			Image:   "docker.dragonflydb.io/dragonflydb/dragonfly:latest",
			Port:    nat.Port("6379/tcp"),
			DataDir: "/data",
			Cmd:     []string{"--requirepass", password},
			ConnectionURL: func(hostPort string) string {
				return fmt.Sprintf("redis://default:%s@localhost:%s/0", safePass(password), hostPort)
			},
		}, nil
	case "mysql":
		user := sanitizeDBIdentifier(variable("MYSQL_USER", "app"), "app")
		dbName := sanitizeDBIdentifier(variable("MYSQL_DATABASE", databaseName), databaseName)
		password, err := passwordVariable("MYSQL_PASSWORD")
		if err != nil {
			return databaseRuntimePlan{}, err
		}
		rootPassword, err := passwordVariable("MYSQL_ROOT_PASSWORD")
		if err != nil {
			return databaseRuntimePlan{}, err
		}
		return databaseRuntimePlan{
			Image:   "mysql:8.4",
			Port:    nat.Port("3306/tcp"),
			DataDir: "/var/lib/mysql",
			Env: []string{
				"MYSQL_DATABASE=" + dbName,
				"MYSQL_USER=" + user,
				"MYSQL_PASSWORD=" + password,
				"MYSQL_ROOT_PASSWORD=" + rootPassword,
			},
			ConnectionURL: func(hostPort string) string {
				return fmt.Sprintf("mysql://%s:%s@localhost:%s/%s", safeUser(user), safePass(password), hostPort, dbName)
			},
		}, nil
	case "mariadb":
		user := sanitizeDBIdentifier(variable("MARIADB_USER", "app"), "app")
		dbName := sanitizeDBIdentifier(variable("MARIADB_DATABASE", databaseName), databaseName)
		password, err := passwordVariable("MARIADB_PASSWORD")
		if err != nil {
			return databaseRuntimePlan{}, err
		}
		rootPassword, err := passwordVariable("MARIADB_ROOT_PASSWORD")
		if err != nil {
			return databaseRuntimePlan{}, err
		}
		return databaseRuntimePlan{
			Image:   "mariadb:11",
			Port:    nat.Port("3306/tcp"),
			DataDir: "/var/lib/mysql",
			Env: []string{
				"MARIADB_DATABASE=" + dbName,
				"MARIADB_USER=" + user,
				"MARIADB_PASSWORD=" + password,
				"MARIADB_ROOT_PASSWORD=" + rootPassword,
			},
			ConnectionURL: func(hostPort string) string {
				return fmt.Sprintf("mysql://%s:%s@localhost:%s/%s", safeUser(user), safePass(password), hostPort, dbName)
			},
		}, nil
	case "mongodb":
		user := sanitizeDBIdentifier(variable("MONGO_INITDB_ROOT_USERNAME", "admin"), "admin")
		dbName := sanitizeDBIdentifier(variable("MONGO_INITDB_DATABASE", databaseName), databaseName)
		password, err := passwordVariable("MONGO_INITDB_ROOT_PASSWORD")
		if err != nil {
			return databaseRuntimePlan{}, err
		}
		return databaseRuntimePlan{
			Image:   "mongo:7",
			Port:    nat.Port("27017/tcp"),
			DataDir: "/data/db",
			Env: []string{
				"MONGO_INITDB_ROOT_USERNAME=" + user,
				"MONGO_INITDB_ROOT_PASSWORD=" + password,
				"MONGO_INITDB_DATABASE=" + dbName,
			},
			ConnectionURL: func(hostPort string) string {
				return fmt.Sprintf("mongodb://%s:%s@localhost:%s/%s?authSource=admin", safeUser(user), safePass(password), hostPort, dbName)
			},
		}, nil
	case "clickhouse":
		user := sanitizeDBIdentifier(variable("CLICKHOUSE_USER", "default"), "default")
		dbName := sanitizeDBIdentifier(variable("CLICKHOUSE_DB", databaseName), databaseName)
		password, err := passwordVariable("CLICKHOUSE_PASSWORD")
		if err != nil {
			return databaseRuntimePlan{}, err
		}
		return databaseRuntimePlan{
			Image:   "clickhouse/clickhouse-server:24.8",
			Port:    nat.Port("8123/tcp"),
			DataDir: "/var/lib/clickhouse",
			Env: []string{
				"CLICKHOUSE_DB=" + dbName,
				"CLICKHOUSE_USER=" + user,
				"CLICKHOUSE_PASSWORD=" + password,
			},
			ConnectionURL: func(hostPort string) string {
				return fmt.Sprintf("http://%s:%s@localhost:%s/%s", safeUser(user), safePass(password), hostPort, dbName)
			},
		}, nil
	default:
		return databaseRuntimePlan{}, fmt.Errorf("unsupported database type: %s", dbType)
	}
}

func (h *DatabaseHandler) startManagedDatabase(databaseID string) error {
	ctx, cancel := context.WithTimeout(context.Background(), 45*time.Second)
	defer cancel()

	if err := h.dockerClient.StartContainer(ctx, managedDatabaseContainerName(databaseID)); err != nil {
		if isDockerNotFoundError(err) {
			return nil
		}
		return err
	}
	return nil
}

func (h *DatabaseHandler) stopManagedDatabase(databaseID string) error {
	ctx, cancel := context.WithTimeout(context.Background(), 45*time.Second)
	defer cancel()

	timeout := 15 * time.Second
	if err := h.dockerClient.StopContainer(ctx, managedDatabaseContainerName(databaseID), &timeout); err != nil {
		if isDockerNotFoundError(err) {
			return nil
		}
		return err
	}
	return nil
}

func (h *DatabaseHandler) restartManagedDatabase(databaseID string) error {
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	timeout := 15 * time.Second
	if err := h.dockerClient.RestartContainer(ctx, managedDatabaseContainerName(databaseID), &timeout); err != nil {
		if isDockerNotFoundError(err) {
			return nil
		}
		return err
	}
	return nil
}

func (h *DatabaseHandler) deleteManagedDatabaseRuntime(databaseID string) error {
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	containerName := managedDatabaseContainerName(databaseID)
	volumeName := managedDatabaseVolumeName(databaseID)
	stopTimeout := 10 * time.Second

	if err := h.dockerClient.StopContainer(ctx, containerName, &stopTimeout); err != nil && !isDockerNotFoundError(err) {
		return err
	}
	if err := h.dockerClient.RemoveContainer(ctx, containerName, true); err != nil && !isDockerNotFoundError(err) {
		return err
	}
	if err := h.dockerClient.RemoveVolume(ctx, volumeName, true); err != nil && !isDockerNotFoundError(err) {
		return err
	}

	return nil
}

func isDockerNotFoundError(err error) bool {
	if err == nil {
		return false
	}
	lower := strings.ToLower(err.Error())
	return strings.Contains(lower, "not found") || strings.Contains(lower, "no such")
}

func (h *DatabaseHandler) createBackupProcess(databaseID, backupID, backupPath string) {
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Minute)
	defer cancel()

	if h.dockerClient == nil {
		_ = h.setDatabaseBackupStatus(backupID, "failed", "0 B", false)
		return
	}

	sizeLabel, err := h.snapshotDatabaseVolume(ctx, databaseID, backupPath)
	if err != nil {
		_ = h.setDatabaseBackupStatus(backupID, "failed", "0 B", false)
		return
	}
	_ = h.setDatabaseBackupStatus(backupID, "completed", sizeLabel, true)
}

func (h *DatabaseHandler) restoreBackupProcess(databaseID, _ string, backupPath string) {
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Minute)
	defer cancel()

	if h.dockerClient == nil {
		_ = h.setDatabaseStatus(databaseID, "error")
		return
	}

	_ = h.setDatabaseStatus(databaseID, "building")
	_ = h.stopManagedDatabase(databaseID)

	if err := h.restoreDatabaseVolumeSnapshot(ctx, databaseID, backupPath); err != nil {
		_ = h.setDatabaseStatus(databaseID, "error")
		return
	}

	if err := h.startManagedDatabase(databaseID); err != nil {
		_ = h.setDatabaseStatus(databaseID, "error")
		return
	}

	_ = h.setDatabaseStatus(databaseID, "running")
}

func (h *DatabaseHandler) setDatabaseStatus(databaseID, status string) error {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	return h.queries.SetDatabaseServiceStatusByID(ctx, sqlcdb.SetDatabaseServiceStatusByIDParams{
		Status:    status,
		UpdatedAt: sql.NullTime{Time: time.Now(), Valid: true},
		ID:        databaseID,
	})
}

func (h *DatabaseHandler) setDatabaseBackupStatus(backupID, status, size string, markCompleted bool) error {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	completedAt := sql.NullTime{}
	if markCompleted {
		completedAt = sql.NullTime{Time: time.Now(), Valid: true}
	}

	return h.queries.SetDatabaseBackupStatusByID(ctx, sqlcdb.SetDatabaseBackupStatusByIDParams{
		Status:      status,
		Size:        size,
		CompletedAt: completedAt,
		ID:          backupID,
	})
}

func (h *DatabaseHandler) snapshotDatabaseVolume(ctx context.Context, databaseID, backupPath string) (string, error) {
	sourceVolume := managedDatabaseVolumeName(databaseID)
	if err := h.ensureImage(ctx, managedDatabaseBackupImage); err != nil {
		return "", err
	}
	if _, err := h.dockerClient.CreateVolume(ctx, docker.VolumeConfig{Name: managedDatabaseBackupVolume}); err != nil && !strings.Contains(strings.ToLower(err.Error()), "already exists") {
		return "", fmt.Errorf("failed to create backup volume: %w", err)
	}

	archive := sanitizeBackupArchivePath(backupPath)
	if archive == "" {
		return "", fmt.Errorf("backup path is required")
	}

	cmd := []string{"sh", "-c", fmt.Sprintf("tar -czf /backup/%s -C /source .", archive)}
	containerID, err := h.runOneShotUtilityContainer(ctx, "backup", databaseID, managedDatabaseBackupImage, cmd, []mount.Mount{
		{Type: mount.TypeVolume, Source: sourceVolume, Target: "/source", ReadOnly: true},
		{Type: mount.TypeVolume, Source: managedDatabaseBackupVolume, Target: "/backup"},
	})
	if err != nil {
		return "", err
	}
	defer func() { _ = h.dockerClient.RemoveContainer(context.Background(), containerID, true) }()

	sizeLabel, err := h.estimateBackupArchiveSize(ctx, archive)
	if err != nil {
		return "unknown", nil
	}
	return sizeLabel, nil
}

func (h *DatabaseHandler) restoreDatabaseVolumeSnapshot(ctx context.Context, databaseID, backupPath string) error {
	targetVolume := managedDatabaseVolumeName(databaseID)
	archive := sanitizeBackupArchivePath(backupPath)
	if archive == "" {
		return fmt.Errorf("backup path is required")
	}

	cmd := []string{"sh", "-c", fmt.Sprintf("mkdir -p /target && rm -rf /target/* /target/.[!.]* /target/..?* 2>/dev/null || true; tar -xzf /backup/%s -C /target", archive)}
	containerID, err := h.runOneShotUtilityContainer(ctx, "restore", databaseID, managedDatabaseBackupImage, cmd, []mount.Mount{
		{Type: mount.TypeVolume, Source: targetVolume, Target: "/target"},
		{Type: mount.TypeVolume, Source: managedDatabaseBackupVolume, Target: "/backup", ReadOnly: true},
	})
	if err != nil {
		return err
	}
	defer func() { _ = h.dockerClient.RemoveContainer(context.Background(), containerID, true) }()
	return nil
}

func (h *DatabaseHandler) estimateBackupArchiveSize(ctx context.Context, archivePath string) (string, error) {
	archive := sanitizeBackupArchivePath(archivePath)
	cmd := []string{"sh", "-c", fmt.Sprintf("wc -c < /backup/%s", archive)}
	containerID, err := h.runOneShotUtilityContainer(ctx, "backup-size", "shared", managedDatabaseBackupImage, cmd, []mount.Mount{
		{Type: mount.TypeVolume, Source: managedDatabaseBackupVolume, Target: "/backup", ReadOnly: true},
	})
	if err != nil {
		return "", err
	}
	defer func() { _ = h.dockerClient.RemoveContainer(context.Background(), containerID, true) }()

	logReader, err := h.dockerClient.GetContainerLogs(ctx, containerID, docker.LogOptions{
		Stdout: true,
		Stderr: false,
		Follow: false,
		Tail:   "1",
	})
	if err != nil {
		return "", err
	}
	defer logReader.Close()

	raw, err := io.ReadAll(logReader)
	if err != nil {
		return "", err
	}

	clean := strings.TrimSpace(strings.Map(func(r rune) rune {
		if r >= '0' && r <= '9' {
			return r
		}
		if r == '\n' || r == '\r' || r == ' ' || r == '\t' {
			return r
		}
		return -1
	}, string(raw)))

	fields := strings.Fields(clean)
	if len(fields) == 0 {
		return "", fmt.Errorf("unable to parse backup size")
	}

	sizeBytes, err := strconv.ParseInt(fields[0], 10, 64)
	if err != nil {
		return "", err
	}
	return humanReadableBytes(sizeBytes), nil
}

func (h *DatabaseHandler) runOneShotUtilityContainer(
	ctx context.Context,
	prefix string,
	databaseID string,
	image string,
	cmd []string,
	mounts []mount.Mount,
) (string, error) {
	containerName := h.generateUtilityContainerName(prefix, databaseID)
	containerID, err := h.dockerClient.CreateContainer(ctx, docker.ContainerConfig{
		Name:          containerName,
		Image:         image,
		Cmd:           cmd,
		RestartPolicy: "no",
		Mounts:        mounts,
		Labels: map[string]string{
			"containr.managed": "true",
			"containr.utility": prefix,
		},
		NetworkMode: "none",
	})
	if err != nil {
		return "", fmt.Errorf("failed to create utility container: %w", err)
	}

	if err := h.dockerClient.StartContainer(ctx, containerID); err != nil {
		_ = h.dockerClient.RemoveContainer(context.Background(), containerID, true)
		return containerID, fmt.Errorf("failed to start utility container: %w", err)
	}
	if err := h.waitForContainerExit(ctx, containerID, 10*time.Minute); err != nil {
		_ = h.dockerClient.RemoveContainer(context.Background(), containerID, true)
		return containerID, err
	}

	return containerID, nil
}

func (h *DatabaseHandler) waitForContainerExit(ctx context.Context, containerID string, timeout time.Duration) error {
	waitCtx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	for {
		inspect, err := h.dockerClient.GetContainer(waitCtx, containerID)
		if err != nil {
			return fmt.Errorf("failed to inspect utility container: %w", err)
		}
		if inspect.State != nil && !inspect.State.Running {
			if inspect.State.ExitCode != 0 {
				return fmt.Errorf("utility container exited with code %d", inspect.State.ExitCode)
			}
			return nil
		}

		select {
		case <-waitCtx.Done():
			return waitCtx.Err()
		case <-time.After(300 * time.Millisecond):
		}
	}
}

func (h *DatabaseHandler) generateUtilityContainerName(prefix, databaseID string) string {
	suffix := "0000"
	buf := make([]byte, 2)
	if _, err := rand.Read(buf); err == nil {
		suffix = hex.EncodeToString(buf)
	}
	name := fmt.Sprintf("containr-%s-%s-%s", sanitizeDBIdentifier(prefix, "job"), sanitizeDBIdentifier(databaseID, "db"), suffix)
	name = strings.ReplaceAll(name, "_", "-")
	if len(name) > 63 {
		name = name[:63]
	}
	return strings.Trim(name, "-")
}

func humanReadableBytes(size int64) string {
	if size <= 0 {
		return "0 B"
	}
	units := []string{"B", "KB", "MB", "GB", "TB"}
	value := float64(size)
	unit := 0
	for value >= 1024 && unit < len(units)-1 {
		value /= 1024
		unit++
	}
	return fmt.Sprintf("%.2f %s", value, units[unit])
}
