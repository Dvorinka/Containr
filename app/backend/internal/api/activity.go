package api

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"containr/internal/database"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// Activity feed — enriched audit_logs rows (severity/category/label) served
// as a global feed and per-project timelines. Visibility mirrors the
// deployment/operations scoping: own actions, plus events on resources
// inside visible projects (approved / owned / member; admin sees all).

const activityVisibility = `(
	a.user_id = $1::uuid OR $2::bool
	OR (a.resource = 'project' AND a.resource_id IN (
		SELECT id FROM projects p WHERE p.is_approved OR p.owner_id = $1::uuid
		OR EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = $1::uuid)))
	OR (a.resource = 'service' AND a.resource_id IN (
		SELECT s.id FROM services s JOIN projects p ON p.id = s.project_id
		WHERE p.is_approved OR p.owner_id = $1::uuid
		OR EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = $1::uuid)))
	OR (a.resource = 'deployment' AND a.resource_id IN (
		SELECT d.id FROM deployments d
		JOIN services s ON s.id = d.service_id
		JOIN projects p ON p.id = s.project_id
		WHERE p.is_approved OR p.owner_id = $1::uuid
		OR EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = $1::uuid)))
	OR (a.resource = 'database' AND a.resource_id IN (
		SELECT ds.id::uuid FROM database_services ds JOIN projects p ON p.id = ds.project_id
		WHERE p.is_approved OR p.owner_id = $1::uuid
		OR EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = $1::uuid)))
)`

const activitySelect = `SELECT
	a.id, COALESCE(a.user_id::text, ''), COALESCE(u.email, ''),
	a.resource, COALESCE(a.resource_id::text, ''), a.action,
	COALESCE(a.details::text, '{}'),
	COALESCE(a.ip_address::text, ''), COALESCE(a.user_agent, ''),
	COALESCE(a.severity, 'info'), COALESCE(a.category, ''), COALESCE(a.label, ''),
	a.created_at
	FROM audit_logs a
	LEFT JOIN users u ON u.id = a.user_id`

func scanActivityRows(rows *sql.Rows) []AuditLog {
	var logs []AuditLog
	for rows.Next() {
		var l AuditLog
		if err := rows.Scan(&l.ID, &l.UserID, &l.UserEmail, &l.Resource, &l.ResourceID,
			&l.Action, &l.Details, &l.IPAddress, &l.UserAgent,
			&l.Severity, &l.Category, &l.Label, &l.CreatedAt); err != nil {
			continue
		}
		// Rows written before enrichment carry empty metadata — classify on read.
		if l.Label == "" || l.Category == "" {
			sev, cat, label := classifyAuditEvent(l.Resource, l.Action)
			if l.Severity == "" || l.Severity == "info" {
				l.Severity = sev
			}
			if l.Category == "" {
				l.Category = cat
			}
			if l.Label == "" {
				l.Label = label
			}
		}
		logs = append(logs, l)
	}
	return logs
}

// GET /activity — global feed. Filters: severity, category, resource,
// project_id, since, page, limit.
func handleGetActivity(c *gin.Context) {
	userID, ok := requireAuthenticatedUserID(c)
	if !ok {
		return
	}
	db := c.MustGet("db").(*database.DB)
	isAdmin := contextIsAdmin(c)

	page := parsePositiveInt(c.DefaultQuery("page", "1"), 1)
	limit := parsePositiveInt(c.DefaultQuery("limit", "50"), 50)
	if limit > 200 {
		limit = 200
	}
	offset := (page - 1) * limit

	conditions := []string{activityVisibility}
	args := []interface{}{userID, isAdmin}
	nextArg := 3

	if v := strings.TrimSpace(c.Query("severity")); v != "" {
		conditions = append(conditions, fmt.Sprintf("a.severity = $%d", nextArg))
		args = append(args, v)
		nextArg++
	}
	if v := strings.TrimSpace(c.Query("category")); v != "" {
		conditions = append(conditions, fmt.Sprintf("a.category = $%d", nextArg))
		args = append(args, v)
		nextArg++
	}
	if v := strings.TrimSpace(c.Query("resource")); v != "" {
		conditions = append(conditions, fmt.Sprintf("a.resource = $%d", nextArg))
		args = append(args, v)
		nextArg++
	}
	if v := strings.TrimSpace(c.Query("project_id")); v != "" {
		if _, err := uuid.Parse(v); err != nil {
			respondError(c, http.StatusBadRequest, "VALIDATION", "invalid project_id")
			return
		}
		conditions = append(conditions, fmt.Sprintf(`(
			(a.resource = 'project' AND a.resource_id = $%d::uuid)
			OR (a.resource = 'service' AND a.resource_id IN (SELECT id FROM services WHERE project_id = $%d::uuid))
			OR (a.resource = 'deployment' AND a.resource_id IN (
				SELECT d.id FROM deployments d JOIN services s ON s.id = d.service_id WHERE s.project_id = $%d::uuid))
			OR (a.resource = 'database' AND a.resource_id IN (SELECT id::uuid FROM database_services WHERE project_id = $%d::uuid))
		)`, nextArg, nextArg, nextArg, nextArg))
		args = append(args, v)
		nextArg++
	}
	if v := strings.TrimSpace(c.Query("since")); v != "" {
		sinceTime, err := time.Parse(time.RFC3339, v)
		if err != nil {
			respondError(c, http.StatusBadRequest, "VALIDATION", "invalid since timestamp, expected RFC3339")
			return
		}
		conditions = append(conditions, fmt.Sprintf("a.created_at >= $%d", nextArg))
		args = append(args, sinceTime)
		nextArg++
	}

	query := fmt.Sprintf(`%s WHERE %s ORDER BY a.created_at DESC LIMIT $%d OFFSET $%d`,
		activitySelect, strings.Join(conditions, " AND "), nextArg, nextArg+1)
	args = append(args, limit, offset)

	rows, err := db.Query(query, args...)
	if err != nil {
		respondError(c, http.StatusInternalServerError, "INTERNAL", "failed to fetch activity")
		return
	}
	defer rows.Close()

	logs := scanActivityRows(rows)
	if logs == nil {
		logs = []AuditLog{}
	}
	c.JSON(http.StatusOK, gin.H{
		"activity": logs,
		"page":     page,
		"limit":    limit,
		"has_more": len(logs) == limit,
	})
}

// GET /projects/:id/activity — per-project timeline. Resource correlation
// mirrors the global feed, pinned to this project.
func handleGetProjectActivity(c *gin.Context) {
	userID, ok := requireAuthenticatedUserID(c)
	if !ok {
		return
	}
	db := c.MustGet("db").(*database.DB)
	projectID := strings.TrimSpace(c.Param("id"))
	if _, err := uuid.Parse(projectID); err != nil {
		respondError(c, http.StatusBadRequest, "INVALID_ID", "invalid project id")
		return
	}

	// Access check: approved / owner / member / admin.
	var visible bool
	if err := db.QueryRow(
		`SELECT p.is_approved OR p.owner_id = $2::uuid OR $3::bool
			OR EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = $2::uuid)
		 FROM projects p WHERE p.id = $1`,
		projectID, userID, contextIsAdmin(c),
	).Scan(&visible); err != nil || !visible {
		respondError(c, http.StatusNotFound, "NOT_FOUND", "project not found")
		return
	}

	limit := parsePositiveInt(c.DefaultQuery("limit", "50"), 50)
	if limit > 200 {
		limit = 200
	}
	page := parsePositiveInt(c.DefaultQuery("page", "1"), 1)

	rows, err := db.Query(fmt.Sprintf(`%s WHERE (
			(a.resource = 'project' AND a.resource_id = $1::uuid)
			OR (a.resource = 'service' AND a.resource_id IN (SELECT id FROM services WHERE project_id = $1::uuid))
			OR (a.resource = 'deployment' AND a.resource_id IN (
				SELECT d.id FROM deployments d JOIN services s ON s.id = d.service_id WHERE s.project_id = $1::uuid))
			OR (a.resource = 'database' AND a.resource_id IN (SELECT id::uuid FROM database_services WHERE project_id = $1::uuid))
		) ORDER BY a.created_at DESC LIMIT $2 OFFSET $3`,
		activitySelect), projectID, limit, (page-1)*limit)
	if err != nil {
		respondError(c, http.StatusInternalServerError, "INTERNAL", "failed to fetch activity")
		return
	}
	defer rows.Close()

	logs := scanActivityRows(rows)
	if logs == nil {
		logs = []AuditLog{}
	}
	c.JSON(http.StatusOK, gin.H{"activity": logs})
}

// StartAuditRetention prunes audit rows past the retention window once at
// boot and then daily. AUDIT_RETENTION_DAYS overrides the 90-day default;
// 0 disables pruning entirely.
func StartAuditRetention(ctx context.Context, db *database.DB) {
	days := 90
	if raw := strings.TrimSpace(os.Getenv("AUDIT_RETENTION_DAYS")); raw != "" {
		if parsed, err := strconv.Atoi(raw); err == nil {
			days = parsed
		}
	}
	// Backfill enrichment for rows written before the classifier existed,
	// batched so a large audit table doesn't hold a giant transaction.
	go backfillAuditMetadata(db)

	if days <= 0 {
		return
	}

	prune := func() {
		res, err := db.Exec(`DELETE FROM audit_logs WHERE created_at < NOW() - ($1::int * INTERVAL '1 day')`, days)
		if err != nil {
			log.Printf("audit retention prune failed: %v", err)
			return
		}
		if n, _ := res.RowsAffected(); n > 0 {
			log.Printf("audit retention: pruned %d rows older than %d days", n, days)
		}
	}
	prune()

	go func() {
		ticker := time.NewTicker(24 * time.Hour)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				prune()
			}
		}
	}()
}

// backfillAuditMetadata classifies rows written before severity/category/label
// existed so filters and the feed see uniform metadata.
func backfillAuditMetadata(db *database.DB) {
	cursor := uuid.Nil.String()
	for {
		rows, err := db.Query(
			`SELECT id::text, resource, action FROM audit_logs
			 WHERE label = '' AND id > $1::uuid ORDER BY id LIMIT 500`, cursor)
		if err != nil {
			log.Printf("audit backfill scan failed: %v", err)
			return
		}
		type row struct{ id, resource, action string }
		var batch []row
		for rows.Next() {
			var r row
			if rows.Scan(&r.id, &r.resource, &r.action) == nil {
				batch = append(batch, r)
			}
		}
		rows.Close()
		if len(batch) == 0 {
			return
		}
		for _, r := range batch {
			cursor = r.id
			sev, cat, label := classifyAuditEvent(r.resource, r.action)
			if _, err := db.Exec(
				`UPDATE audit_logs SET severity = $1, category = $2, label = $3 WHERE id = $4::uuid`,
				sev, cat, label, r.id,
			); err != nil {
				log.Printf("audit backfill update failed: %v", err)
			}
		}
	}
}
