package api

import (
	"database/sql"
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	_ "github.com/lib/pq"
)

// DatabaseService represents a managed database service
type DatabaseService struct {
	ID            string               `json:"id" db:"id"`
	Name          string               `json:"name" db:"name"`
	Type          string               `json:"type" db:"type"`     // postgresql, redis, mysql
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
	Type   string `json:"type" binding:"required,oneof=postgresql redis mysql"`
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
	db *sql.DB
}

// NewDatabaseHandler creates a new database handler
func NewDatabaseHandler(db *sql.DB) *DatabaseHandler {
	return &DatabaseHandler{db: db}
}

// GetDatabases returns all database services for a user
func (h *DatabaseHandler) GetDatabases(c *gin.Context) {
	userID := c.GetString("userID")

	query := `
		SELECT id, name, type, status, version, plan, region, created_at, updated_at
		FROM database_services
		WHERE user_id = $1
		ORDER BY created_at DESC
	`

	rows, err := h.db.Query(query, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch databases"})
		return
	}
	defer rows.Close()

	var databases []DatabaseService
	for rows.Next() {
		var db DatabaseService
		err := rows.Scan(
			&db.ID, &db.Name, &db.Type, &db.Status, &db.Version,
			&db.Plan, &db.Region, &db.CreatedAt, &db.UpdatedAt,
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to scan database"})
			return
		}

		// Add mock metrics and configuration
		db.Metrics = h.generateMockMetrics()
		db.Backups = h.generateMockBackupConfig()
		db.Settings = h.generateMockSettings()
		db.ConnectionURL = h.generateConnectionURL(db)

		databases = append(databases, db)
	}

	c.JSON(http.StatusOK, gin.H{"databases": databases})
}

// GetDatabase returns a specific database service
func (h *DatabaseHandler) GetDatabase(c *gin.Context) {
	userID := c.GetString("userID")
	databaseID := c.Param("id")

	query := `
		SELECT id, name, type, status, version, plan, region, created_at, updated_at
		FROM database_services
		WHERE id = $1 AND user_id = $2
	`

	var db DatabaseService
	err := h.db.QueryRow(query, databaseID, userID).Scan(
		&db.ID, &db.Name, &db.Type, &db.Status, &db.Version,
		&db.Plan, &db.Region, &db.CreatedAt, &db.UpdatedAt,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "Database not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch database"})
		return
	}

	// Add detailed metrics and configuration
	db.Metrics = h.generateMockMetrics()
	db.Backups = h.generateMockBackupConfig()
	db.Settings = h.generateMockSettings()
	db.ConnectionURL = h.generateConnectionURL(db)

	c.JSON(http.StatusOK, db)
}

// CreateDatabase creates a new database service
func (h *DatabaseHandler) CreateDatabase(c *gin.Context) {
	userID := c.GetString("userID")

	var req DatabaseCreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Generate database ID
	databaseID := fmt.Sprintf("db_%d_%s", time.Now().Unix(), req.Name)

	// Insert database into database
	query := `
		INSERT INTO database_services (id, user_id, name, type, status, version, plan, region, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
	`

	now := time.Now()
	version := h.getDefaultVersion(req.Type)

	_, err := h.db.Exec(query, databaseID, userID, req.Name, req.Type, "building", version, req.Plan, req.Region, now, now)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create database"})
		return
	}

	// In a real implementation, this would trigger the actual database provisioning
	// For now, we'll simulate it by updating the status to "running"
	go h.provisionDatabase(databaseID)

	c.JSON(http.StatusCreated, gin.H{
		"id":      databaseID,
		"message": "Database provisioning started",
		"status":  "building",
	})
}

// UpdateDatabase updates a database service
func (h *DatabaseHandler) UpdateDatabase(c *gin.Context) {
	userID := c.GetString("userID")
	databaseID := c.Param("id")

	var req DatabaseUpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Build dynamic update query
	setParts := []string{}
	args := []interface{}{}
	argIndex := 1

	if req.Name != "" {
		setParts = append(setParts, fmt.Sprintf("name = $%d", argIndex))
		args = append(args, req.Name)
		argIndex++
	}

	if req.Plan != "" {
		setParts = append(setParts, fmt.Sprintf("plan = $%d", argIndex))
		args = append(args, req.Plan)
		argIndex++
	}

	if len(setParts) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No fields to update"})
		return
	}

	setParts = append(setParts, fmt.Sprintf("updated_at = $%d", argIndex))
	args = append(args, time.Now())
	argIndex++

	args = append(args, databaseID, userID)

	query := fmt.Sprintf(`
		UPDATE database_services
		SET %s
		WHERE id = $%d AND user_id = $%d
	`, fmt.Sprintf("%s", setParts), argIndex, argIndex+1)

	_, err := h.db.Exec(query, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update database"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Database updated successfully"})
}

// DeleteDatabase deletes a database service
func (h *DatabaseHandler) DeleteDatabase(c *gin.Context) {
	userID := c.GetString("userID")
	databaseID := c.Param("id")

	// Check if database exists and belongs to user
	var exists bool
	checkQuery := "SELECT EXISTS(SELECT 1 FROM database_services WHERE id = $1 AND user_id = $2)"
	err := h.db.QueryRow(checkQuery, databaseID, userID).Scan(&exists)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to check database"})
		return
	}

	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "Database not found"})
		return
	}

	// In a real implementation, this would trigger the actual database deprovisioning
	// For now, we'll just delete the record
	deleteQuery := "DELETE FROM database_services WHERE id = $1 AND user_id = $2"
	_, err = h.db.Exec(deleteQuery, databaseID, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete database"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Database deleted successfully"})
}

// PerformDatabaseAction performs actions on a database (start, stop, restart)
func (h *DatabaseHandler) PerformDatabaseAction(c *gin.Context) {
	userID := c.GetString("userID")
	databaseID := c.Param("id")

	var req DatabaseActionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Check if database exists and belongs to user
	var exists bool
	checkQuery := "SELECT EXISTS(SELECT 1 FROM database_services WHERE id = $1 AND user_id = $2)"
	err := h.db.QueryRow(checkQuery, databaseID, userID).Scan(&exists)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to check database"})
		return
	}

	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "Database not found"})
		return
	}

	// Update database status based on action
	var newStatus string
	switch req.Action {
	case "start":
		newStatus = "running"
	case "stop":
		newStatus = "stopped"
	case "restart":
		newStatus = "building" // Will be updated to running after restart
		go h.restartDatabase(databaseID)
	default:
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid action"})
		return
	}

	updateQuery := "UPDATE database_services SET status = $1, updated_at = $2 WHERE id = $3 AND user_id = $4"
	_, err = h.db.Exec(updateQuery, newStatus, time.Now(), databaseID, userID)
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
	userID := c.GetString("userID")
	databaseID := c.Param("id")

	// Check if database exists and belongs to user
	var exists bool
	checkQuery := "SELECT EXISTS(SELECT 1 FROM database_services WHERE id = $1 AND user_id = $2)"
	err := h.db.QueryRow(checkQuery, databaseID, userID).Scan(&exists)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to check database"})
		return
	}

	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "Database not found"})
		return
	}

	// Generate backup ID
	backupID := fmt.Sprintf("backup_%d_%s", time.Now().Unix(), databaseID)

	// In a real implementation, this would trigger the actual backup process
	// For now, we'll simulate it
	go h.createBackupProcess(databaseID, backupID)

	c.JSON(http.StatusCreated, gin.H{
		"backup_id": backupID,
		"message":   "Backup creation started",
		"status":    "in_progress",
	})
}

// RestoreBackup restores a database from a backup
func (h *DatabaseHandler) RestoreBackup(c *gin.Context) {
	userID := c.GetString("userID")
	databaseID := c.Param("id")

	var req DatabaseRestoreRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Check if database exists and belongs to user
	var exists bool
	checkQuery := "SELECT EXISTS(SELECT 1 FROM database_services WHERE id = $1 AND user_id = $2)"
	err := h.db.QueryRow(checkQuery, databaseID, userID).Scan(&exists)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to check database"})
		return
	}

	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "Database not found"})
		return
	}

	// In a real implementation, this would trigger the actual restore process
	// For now, we'll simulate it
	go h.restoreBackupProcess(databaseID, req.BackupID)

	c.JSON(http.StatusOK, gin.H{
		"message": "Database restore started",
		"status":  "in_progress",
	})
}

// Helper functions for mock data generation

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

func (h *DatabaseHandler) generateConnectionURL(db DatabaseService) string {
	switch db.Type {
	case "postgresql":
		return fmt.Sprintf("postgresql://user:password@%s.containr.local:5432/%s", db.Name, db.Name)
	case "redis":
		return fmt.Sprintf("redis://%s.containr.local:6379", db.Name)
	case "mysql":
		return fmt.Sprintf("mysql://user:password@%s.containr.local:3306/%s", db.Name, db.Name)
	default:
		return ""
	}
}

func (h *DatabaseHandler) getDefaultVersion(dbType string) string {
	switch dbType {
	case "postgresql":
		return "15.4"
	case "redis":
		return "7.2"
	case "mysql":
		return "8.0"
	default:
		return "latest"
	}
}

// Mock provisioning functions (in real implementation, these would interact with container orchestration)

func (h *DatabaseHandler) provisionDatabase(databaseID string) {
	// Simulate provisioning time
	time.Sleep(30 * time.Second)

	// Update status to running
	query := "UPDATE database_services SET status = 'running', updated_at = $1 WHERE id = $2"
	h.db.Exec(query, time.Now(), databaseID)
}

func (h *DatabaseHandler) restartDatabase(databaseID string) {
	// Simulate restart time
	time.Sleep(10 * time.Second)

	// Update status to running
	query := "UPDATE database_services SET status = 'running', updated_at = $1 WHERE id = $2"
	h.db.Exec(query, time.Now(), databaseID)
}

func (h *DatabaseHandler) createBackupProcess(databaseID, backupID string) {
	// Simulate backup creation time
	time.Sleep(5 * time.Minute)

	// In a real implementation, this would store backup metadata
	// For now, we'll just log it
	fmt.Printf("Backup %s created for database %s\n", backupID, databaseID)
}

func (h *DatabaseHandler) restoreBackupProcess(databaseID, backupID string) {
	// Simulate restore time
	time.Sleep(10 * time.Minute)

	// In a real implementation, this would restore the database
	// For now, we'll just log it
	fmt.Printf("Database %s restored from backup %s\n", databaseID, backupID)
}
