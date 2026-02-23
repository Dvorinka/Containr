package api

import (
	"containr/internal/database"
	"encoding/json"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type AuditLog struct {
	ID         string    `json:"id" db:"id"`
	UserID     string    `json:"user_id" db:"user_id"`
	UserEmail  string    `json:"user_email" db:"user_email"`
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

	auditID := uuid.New().String()
	_, err := db.Exec(
		`INSERT INTO audit_logs (id, user_id, resource, resource_id, action, details, created_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
		auditID, userID, resource, resourceID, action, string(detailsJSON), time.Now(),
	)

	if err != nil {
	}
}

func LogAuditWithRequest(c *gin.Context, resource, resourceID, action string, details map[string]interface{}) {
	userID, _ := c.Get("user_id")
	userEmail, _ := c.Get("user_email")

	details["ip_address"] = c.ClientIP()
	details["user_agent"] = c.GetHeader("User-Agent")

	detailsJSON, _ := json.Marshal(details)

	db := c.MustGet("db").(*database.DB)

	auditID := uuid.New().String()
	_, err := db.Exec(
		`INSERT INTO audit_logs (id, user_id, user_email, resource, resource_id, action, details, ip_address, user_agent, created_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
		auditID, userID, userEmail, resource, resourceID, action, string(detailsJSON), c.ClientIP(), c.GetHeader("User-Agent"), time.Now(),
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

	resource := c.Query("resource")
	action := c.Query("action")
	page := c.DefaultQuery("page", "1")
	limit := c.DefaultQuery("limit", "50")

	query := `SELECT id, user_id, COALESCE(user_email, '') as user_email, resource, resource_id, action, details, 
	          COALESCE(ip_address, '') as ip_address, COALESCE(user_agent, '') as user_agent, created_at 
	          FROM audit_logs WHERE user_id = $1`
	args := []interface{}{userID}
	argNum := 2

	if resource != "" {
		query += " AND resource = $" + string(rune('0'+argNum))
		args = append(args, resource)
		argNum++
	}

	if action != "" {
		query += " AND action = $" + string(rune('0'+argNum))
		args = append(args, action)
		argNum++
	}

	query += " ORDER BY created_at DESC LIMIT $" + string(rune('0'+argNum)) + " OFFSET $" + string(rune('0'+argNum+1))
	args = append(args, limit, (atoi(page)-1)*atoi(limit))

	rows, err := db.Query(query, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch audit logs"})
		return
	}
	defer rows.Close()

	var logs []AuditLog
	for rows.Next() {
		var log AuditLog
		err := rows.Scan(&log.ID, &log.UserID, &log.UserEmail, &log.Resource, &log.ResourceID, &log.Action, &log.Details, &log.IPAddress, &log.UserAgent, &log.CreatedAt)
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
		`SELECT id, user_id, COALESCE(user_email, '') as user_email, resource, resource_id, action, details, 
		        COALESCE(ip_address, '') as ip_address, COALESCE(user_agent, '') as user_agent, created_at 
		 FROM audit_logs 
		 WHERE user_id = $1 AND resource = $2 AND resource_id = $3 
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
		err := rows.Scan(&log.ID, &log.UserID, &log.UserEmail, &log.Resource, &log.ResourceID, &log.Action, &log.Details, &log.IPAddress, &log.UserAgent, &log.CreatedAt)
		if err != nil {
			continue
		}
		logs = append(logs, log)
	}

	c.JSON(http.StatusOK, gin.H{"audit_logs": logs})
}

func atoi(s string) int {
	var result int
	for _, c := range s {
		if c >= '0' && c <= '9' {
			result = result*10 + int(c-'0')
		}
	}
	return result
}
