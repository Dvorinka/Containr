package api

import (
	"containr/internal/database"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type AuditLog struct {
	ID         string    `json:"id" db:"id"`
	UserID     string    `json:"user_id" db:"user_id"`
	UserEmail  string    `json:"user_email,omitempty" db:"user_email"`
	Resource   string    `json:"resource" db:"resource"`
	ResourceID string    `json:"resource_id" db:"resource_id"`
	Action     string    `json:"action" db:"action"`
	Details    string    `json:"details" db:"details"`
	IPAddress  string    `json:"ip_address" db:"ip_address"`
	UserAgent  string    `json:"user_agent" db:"user_agent"`
	CreatedAt  time.Time `json:"created_at" db:"created_at"`
}

type AuditLogDetail struct {
	OldValue  interface{} `json:"old_value,omitempty"`
	NewValue  interface{} `json:"new_value,omitempty"`
	Message   string      `json:"message,omitempty"`
	Timestamp time.Time   `json:"timestamp"`
}

func LogAudit(userID, resource, resourceID, action string, details map[string]interface{}) {
	db := GetAuditDB()
	if db == nil {
		return
	}

	detailsJSON, _ := json.Marshal(details)
	resourceUUID := parseUUIDOrNil(resourceID)
	userUUID := parseUUIDOrNil(userID)

	auditID := uuid.New().String()
	_, err := db.Exec(
		`INSERT INTO audit_logs (id, user_id, resource, resource_id, action, details, created_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
		auditID, userUUID, resource, resourceUUID, action, string(detailsJSON), time.Now().UTC(),
	)

	if err != nil {
	}
}

func LogAuditWithRequest(c *gin.Context, resource, resourceID, action string, details map[string]interface{}) {
	userID, _ := c.Get("user_id")

	details["ip_address"] = c.ClientIP()
	details["user_agent"] = c.GetHeader("User-Agent")

	detailsJSON, _ := json.Marshal(details)

	db := c.MustGet("db").(*database.DB)
	userIDStr := ""
	if uid, ok := userID.(string); ok {
		userIDStr = uid
	}
	userUUID := parseUUIDOrNil(userIDStr)
	resourceUUID := parseUUIDOrNil(resourceID)

	auditID := uuid.New().String()
	_, err := db.Exec(
		`INSERT INTO audit_logs (id, user_id, resource, resource_id, action, details, ip_address, user_agent, created_at)
		 VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9)`,
		auditID, userUUID, resource, resourceUUID, action, string(detailsJSON), c.ClientIP(), c.GetHeader("User-Agent"), time.Now().UTC(),
	)

	if err != nil {
	}
}

var auditDB *database.DB

func GetAuditDB() *database.DB {
	return auditDB
}

func SetAuditDB(db *database.DB) {
	auditDB = db
}

func handleGetAuditLogs(c *gin.Context) {
	db := c.MustGet("db").(*database.DB)
	userID := c.MustGet("user_id").(string)

	resource := strings.TrimSpace(c.Query("resource"))
	action := strings.TrimSpace(c.Query("action"))
	page := parsePositiveInt(c.DefaultQuery("page", "1"), 1)
	limit := parsePositiveInt(c.DefaultQuery("limit", "50"), 50)
	if limit > 500 {
		limit = 500
	}
	offset := (page - 1) * limit

	conditions := []string{"user_id::text = $1"}
	args := []interface{}{userID}
	nextArg := 2

	if resource != "" {
		conditions = append(conditions, fmt.Sprintf("resource = $%d", nextArg))
		args = append(args, resource)
		nextArg++
	}
	if action != "" {
		conditions = append(conditions, fmt.Sprintf("action = $%d", nextArg))
		args = append(args, action)
		nextArg++
	}

	whereClause := strings.Join(conditions, " AND ")
	query := fmt.Sprintf(`SELECT
		id,
		COALESCE(user_id::text, ''),
		resource,
		COALESCE(resource_id::text, ''),
		action,
		COALESCE(details::text, '{}'),
		COALESCE(ip_address::text, ''),
		COALESCE(user_agent, ''),
		created_at
		FROM audit_logs
		WHERE %s
		ORDER BY created_at DESC
		LIMIT $%d OFFSET $%d`, whereClause, nextArg, nextArg+1)
	args = append(args, limit, offset)

	rows, err := db.Query(query, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch audit logs"})
		return
	}
	defer rows.Close()

	var logs []AuditLog
	for rows.Next() {
		var log AuditLog
		err := rows.Scan(&log.ID, &log.UserID, &log.Resource, &log.ResourceID, &log.Action, &log.Details, &log.IPAddress, &log.UserAgent, &log.CreatedAt)
		if err != nil {
			continue
		}
		logs = append(logs, log)
	}

	c.JSON(http.StatusOK, gin.H{"audit_logs": logs})
}

func handleGetResourceAuditLogs(c *gin.Context) {
	db := c.MustGet("db").(*database.DB)
	userID := c.MustGet("user_id").(string)
	resource := c.Param("resource")
	resourceID := c.Param("id")

	rows, err := db.Query(
		`SELECT id, COALESCE(user_id::text, ''), resource, COALESCE(resource_id::text, ''), action, COALESCE(details::text, '{}'),
		        COALESCE(ip_address::text, ''), COALESCE(user_agent, ''), created_at 
		 FROM audit_logs 
		 WHERE user_id::text = $1 AND resource = $2 AND resource_id::text = $3 
		 ORDER BY created_at DESC 
		 LIMIT 100`,
		userID, resource, resourceID,
	)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch audit logs"})
		return
	}
	defer rows.Close()

	var logs []AuditLog
	for rows.Next() {
		var log AuditLog
		err := rows.Scan(&log.ID, &log.UserID, &log.Resource, &log.ResourceID, &log.Action, &log.Details, &log.IPAddress, &log.UserAgent, &log.CreatedAt)
		if err != nil {
			continue
		}
		logs = append(logs, log)
	}

	c.JSON(http.StatusOK, gin.H{"audit_logs": logs})
}

func parsePositiveInt(raw string, fallback int) int {
	v, err := strconv.Atoi(strings.TrimSpace(raw))
	if err != nil || v <= 0 {
		return fallback
	}
	return v
}

func parseUUIDOrNil(raw string) interface{} {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return nil
	}
	if _, err := uuid.Parse(trimmed); err != nil {
		return nil
	}
	return trimmed
}
