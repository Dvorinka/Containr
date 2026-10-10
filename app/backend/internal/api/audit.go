package api

import (
	"containr/internal/database"
	"containr/internal/database/sqlcdb"
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/sqlc-dev/pqtype"
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
	Severity   string    `json:"severity" db:"severity"`
	Category   string    `json:"category" db:"category"`
	Label      string    `json:"label" db:"label"`
	CreatedAt  time.Time `json:"created_at" db:"created_at"`
}

// auditVerbs maps action verbs to past-tense words for feed labels.
var auditVerbs = map[string]string{
	"create": "created", "delete": "deleted", "update": "updated",
	"deploy": "deployed", "clone": "cloned", "move": "moved",
	"backup": "backed up", "restore": "restored", "revoke": "revoked",
	"impersonate": "impersonated", "provision": "provisioned",
	"accept": "accepted", "login": "logged in", "scale": "scaled",
	"sleep": "put to sleep", "wake": "woke", "approve": "approved",
	"set_admin": "admin flag changed", "provisioned": "provisioned",
}

// classifyAuditEvent derives severity/category/label for the activity feed.
// Actions may already carry the resource prefix ("service.clone") — it is
// stripped before matching.
func classifyAuditEvent(resource, action string) (severity, category, label string) {
	verb := action
	if idx := strings.LastIndex(verb, "."); idx >= 0 {
		verb = verb[idx+1:]
	}

	category = resource
	switch resource {
	case "user_invite", "invite", "github_app", "banner", "settings":
		category = "system"
	case "user_token", "agent_token", "registry_credential":
		category = "security"
	}

	severity = "info"
	switch {
	case strings.Contains(verb, "fail"), strings.Contains(verb, "error"), strings.Contains(verb, "denied"):
		severity = "error"
	case strings.Contains(verb, "delete"), strings.Contains(verb, "revoke"),
		strings.Contains(verb, "remove"), strings.Contains(verb, "disable"),
		strings.Contains(verb, "impersonate"):
		severity = "warning"
	case strings.Contains(verb, "create"), strings.Contains(verb, "success"),
		strings.Contains(verb, "complete"), strings.Contains(verb, "accept"),
		strings.Contains(verb, "provision"), strings.Contains(verb, "clone"),
		strings.Contains(verb, "deploy"), strings.Contains(verb, "approve"):
		severity = "success"
	}

	past := verb
	if v, ok := auditVerbs[verb]; ok {
		past = v
	}
	resName := strings.ReplaceAll(resource, "_", " ")
	if resName != "" {
		resName = strings.ToUpper(resName[:1]) + resName[1:]
	}
	label = resName + " " + past
	return severity, category, label
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
	severity, category, label := classifyAuditEvent(resource, action)

	err := sqlcdb.New(db.DB).InsertAuditLog(context.Background(), sqlcdb.InsertAuditLogParams{
		ID:         uuid.New(),
		UserID:     nullUUIDOrNil(userID),
		Resource:   resource,
		ResourceID: nullUUIDOrNil(resourceID),
		Action:     action,
		Details:    pqtype.NullRawMessage{RawMessage: detailsJSON, Valid: true},
		Severity:   severity,
		Category:   category,
		Label:      label,
		CreatedAt:  time.Now().UTC(),
	})

	if err != nil {
	}

	emitWebhookEvent(userID, resource, resourceID, action, details)
}

func LogAuditWithRequest(c *gin.Context, resource, resourceID, action string, details map[string]interface{}) {
	userID, _ := c.Get("user_id")

	if details == nil {
		details = map[string]interface{}{}
	}
	details["ip_address"] = c.ClientIP()
	details["user_agent"] = c.GetHeader("User-Agent")

	detailsJSON, _ := json.Marshal(details)

	db := c.MustGet("db").(*database.DB)
	userIDStr := ""
	if uid, ok := userID.(string); ok {
		userIDStr = uid
	}
	severity, category, label := classifyAuditEvent(resource, action)

	var inet pqtype.Inet
	_ = inet.Scan(c.ClientIP())
	err := sqlcdb.New(db.DB).InsertAuditLogWithRequest(context.Background(), sqlcdb.InsertAuditLogWithRequestParams{
		ID:         uuid.New(),
		UserID:     nullUUIDOrNil(userIDStr),
		Resource:   resource,
		ResourceID: nullUUIDOrNil(resourceID),
		Action:     action,
		Column6:    json.RawMessage(detailsJSON),
		Column7:    inet,
		UserAgent:  sql.NullString{String: c.GetHeader("User-Agent"), Valid: true},
		Severity:   severity,
		Category:   category,
		Label:      label,
		CreatedAt:  time.Now().UTC(),
	})

	if err != nil {
	}

	emitWebhookEvent(userIDStr, resource, resourceID, action, details)
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
	resource := strings.TrimSpace(c.Query("resource"))
	action := strings.TrimSpace(c.Query("action"))
	actor := strings.TrimSpace(c.Query("actor"))
	userIDFilter := strings.TrimSpace(c.Query("user_id"))
	since := strings.TrimSpace(c.Query("since"))
	page := parsePositiveInt(c.DefaultQuery("page", "1"), 1)
	limit := parsePositiveInt(c.DefaultQuery("limit", "50"), 50)
	if limit > 500 {
		limit = 500
	}
	offset := (page - 1) * limit

	conditions := []string{"TRUE"}
	args := []interface{}{}
	nextArg := 1

	if userIDFilter != "" {
		conditions = append(conditions, fmt.Sprintf("a.user_id = $%d::uuid", nextArg))
		args = append(args, userIDFilter)
		nextArg++
	}
	if actor != "" {
		conditions = append(conditions, fmt.Sprintf("u.email ILIKE $%d", nextArg))
		args = append(args, "%"+actor+"%")
		nextArg++
	}
	if resource != "" {
		conditions = append(conditions, fmt.Sprintf("a.resource = $%d", nextArg))
		args = append(args, resource)
		nextArg++
	}
	if action != "" {
		conditions = append(conditions, fmt.Sprintf("a.action = $%d", nextArg))
		args = append(args, action)
		nextArg++
	}
	if since != "" {
		sinceTime, err := time.Parse(time.RFC3339, since)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid since timestamp, expected RFC3339"})
			return
		}
		conditions = append(conditions, fmt.Sprintf("a.created_at >= $%d", nextArg))
		args = append(args, sinceTime)
		nextArg++
	}

	whereClause := strings.Join(conditions, " AND ")
	query := fmt.Sprintf(`SELECT
		a.id,
		COALESCE(a.user_id::text, ''),
		COALESCE(u.email, ''),
		a.resource,
		COALESCE(a.resource_id::text, ''),
		a.action,
		COALESCE(a.details::text, '{}'),
		COALESCE(a.ip_address::text, ''),
		COALESCE(a.user_agent, ''),
		COALESCE(a.severity, 'info'),
		COALESCE(a.category, ''),
		COALESCE(a.label, ''),
		a.created_at
		FROM audit_logs a
		LEFT JOIN users u ON u.id = a.user_id
		WHERE %s
		ORDER BY a.created_at DESC
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
		err := rows.Scan(&log.ID, &log.UserID, &log.UserEmail, &log.Resource, &log.ResourceID, &log.Action, &log.Details, &log.IPAddress, &log.UserAgent, &log.Severity, &log.Category, &log.Label, &log.CreatedAt)
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

	rows, err := sqlcdb.New(db.DB).ListResourceAuditLogs(context.Background(), sqlcdb.ListResourceAuditLogsParams{
		UserID:     nullUUIDOrNil(userID),
		Resource:   resource,
		ResourceID: nullUUIDOrNil(resourceID),
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch audit logs"})
		return
	}

	var logs []AuditLog
	for _, row := range rows {
		logs = append(logs, AuditLog{
			ID:         row.ID.String(),
			UserID:     row.UserID,
			Resource:   row.Resource,
			ResourceID: row.ResourceID,
			Action:     row.Action,
			Details:    row.Details,
			IPAddress:  row.IpAddress,
			UserAgent:  row.UserAgent,
			CreatedAt:  row.CreatedAt,
		})
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

func nullUUIDOrNil(raw string) uuid.NullUUID {
	parsed, err := uuid.Parse(strings.TrimSpace(raw))
	return uuid.NullUUID{UUID: parsed, Valid: err == nil}
}
