package api

import (
	"containr/internal/database"
	"containr/internal/database/sqlcdb"
	"containr/internal/security"
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
)

// SecurityHandler handles security-related API endpoints
type SecurityHandler struct {
	db                   *database.DB
	scanner              *security.Scanner
	complianceManager    *security.ComplianceManager
	encryptionManager    *security.EncryptionManager
	dataRetentionManager *security.DataRetentionManager
	auditLogger          *security.AuditLogger
}

// NewSecurityHandler creates a new security handler
func NewSecurityHandler(db *database.DB, encryptionKey string) *SecurityHandler {
	encryptionManager, _ := security.NewEncryptionManager(encryptionKey)

	scanner := security.NewScanner(db)
	// Notify the project owner when a background scan completes — criticals
	// earn a distinct title so they stand out in the notification list.
	scanner.OnScanComplete = func(scan *security.SecurityScan) {
		ownerID, err := sqlcdb.New(db.DB).GetProjectOwnerText(context.Background(), uuid.MustParse(scan.ProjectID))
		if err != nil || ownerID == "" {
			return
		}
		title := "Security scan completed"
		if scan.Summary.Critical > 0 || scan.Summary.High > 0 {
			title = "Security scan found issues"
		}
		insertUserNotification(db, ownerID, "security", title,
			fmt.Sprintf("%s scan finished: %d critical, %d high, %d total findings (score %d/100).",
				scan.ScanType, scan.Summary.Critical, scan.Summary.High, scan.Summary.Total, scan.Summary.Score),
			"project", scan.ProjectID)
	}

	return &SecurityHandler{
		db:                   db,
		scanner:              scanner,
		complianceManager:    security.NewComplianceManager(db),
		encryptionManager:    encryptionManager,
		dataRetentionManager: security.NewDataRetentionManager(encryptionManager),
		auditLogger:          security.NewAuditLogger(encryptionManager, db),
	}
}

// StartSecurityScan starts a new security scan
func (sh *SecurityHandler) StartSecurityScan(c *gin.Context) {
	var req struct {
		ProjectID string `json:"project_id" binding:"required"`
		ServiceID string `json:"service_id,omitempty"`
		ScanType  string `json:"scan_type" binding:"required,oneof=dependency configuration comprehensive"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID, ok := sh.requireProjectAccess(c, req.ProjectID)
	if !ok {
		return
	}

	if req.ServiceID != "" {
		if _, err := uuid.Parse(req.ServiceID); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid service ID"})
			return
		}

		serviceExists, err := sqlcdb.New(sh.db.DB).ServiceExistsInProject(context.Background(), sqlcdb.ServiceExistsInProjectParams{
			ID:        uuid.MustParse(req.ServiceID),
			ProjectID: uuid.MustParse(req.ProjectID),
		})
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to validate service"})
			return
		}

		if !serviceExists {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Service not found in project"})
			return
		}
	}

	// Log audit event
	sh.auditLogger.LogSecurityEvent(userID, req.ProjectID, "security_scan_started", "project",
		map[string]interface{}{
			"project_id": req.ProjectID,
			"service_id": req.ServiceID,
			"scan_type":  req.ScanType,
		}, c.ClientIP(), c.GetHeader("User-Agent"), true)

	scan, err := sh.scanner.StartSecurityScan(req.ProjectID, req.ServiceID, req.ScanType)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to start security scan"})
		return
	}

	c.JSON(http.StatusAccepted, scan)
}

// GetSecurityScan retrieves a security scan
func (sh *SecurityHandler) GetSecurityScan(c *gin.Context) {
	scanID := firstPathParam(c, "scanId", "id")
	if !sh.requireSecurityScanAccess(c, scanID) {
		return
	}

	scan, err := sh.scanner.GetSecurityScan(scanID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Security scan not found"})
		return
	}

	c.JSON(http.StatusOK, scan)
}

// GetProjectSecurityHistory retrieves security scan history for a project
func (sh *SecurityHandler) GetProjectSecurityHistory(c *gin.Context) {
	projectID := firstPathParam(c, "projectId", "id", "project_id")
	if _, ok := sh.requireProjectAccess(c, projectID); !ok {
		return
	}

	limit := 10
	if limitStr := c.Query("limit"); limitStr != "" {
		if parsedLimit, err := strconv.Atoi(limitStr); err == nil && parsedLimit > 0 && parsedLimit <= 1000 {
			limit = parsedLimit
		}
	}

	scans, err := sh.scanner.GetProjectSecurityHistory(projectID, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get security history"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"scans": scans})
}

// GetVulnerabilities retrieves vulnerabilities for a project
func (sh *SecurityHandler) GetVulnerabilities(c *gin.Context) {
	projectID := firstPathParam(c, "projectId", "id", "project_id")
	if _, ok := sh.requireProjectAccess(c, projectID); !ok {
		return
	}

	// Query vulnerabilities
	rows, err := sqlcdb.New(sh.db.DB).ListVulnerabilities(context.Background(), uuid.MustParse(projectID))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get vulnerabilities"})
		return
	}

	var vulnerabilities []security.Vulnerability
	for _, row := range rows {
		// NULL description/service_id failed the original scan and dropped
		// the row — keep the same filter.
		if !row.Description.Valid || !row.ServiceID.Valid {
			continue
		}
		vulnerabilities = append(vulnerabilities, security.Vulnerability{
			ID:          row.ID.String(),
			Type:        row.Type,
			Severity:    row.Severity,
			Title:       row.Title,
			Description: row.Description.String,
			ServiceID:   row.ServiceID.UUID.String(),
			Status:      row.Status,
			FoundAt:     row.FoundAt,
			ResolvedAt:  timePtrNT(row.ResolvedAt),
		})
	}

	c.JSON(http.StatusOK, gin.H{"vulnerabilities": vulnerabilities})
}

// UpdateVulnerability updates a vulnerability status
func (sh *SecurityHandler) UpdateVulnerability(c *gin.Context) {
	vulnID := firstPathParam(c, "vulnId", "id")
	userID, ok := sh.requireVulnerabilityAccess(c, vulnID)
	if !ok {
		return
	}

	var req struct {
		Status string `json:"status" binding:"required,oneof=open resolved ignored"`
		Notes  string `json:"notes,omitempty"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var resolvedAt *time.Time
	if req.Status == "resolved" {
		now := time.Now()
		resolvedAt = &now
	}

	err := sqlcdb.New(sh.db.DB).UpdateVulnerabilityStatus(context.Background(), sqlcdb.UpdateVulnerabilityStatusParams{
		Status:     req.Status,
		ResolvedAt: ntPtr(resolvedAt),
		ID:         uuid.MustParse(vulnID),
	})

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update vulnerability"})
		return
	}

	// Log audit event
	sh.auditLogger.LogSecurityEvent(userID, vulnID, "vulnerability_updated", "vulnerability",
		map[string]interface{}{
			"vulnerability_id": vulnID,
			"new_status":       req.Status,
			"notes":            req.Notes,
		}, c.ClientIP(), c.GetHeader("User-Agent"), true)

	c.JSON(http.StatusOK, gin.H{"status": "updated"})
}

// StartComplianceAssessment starts a new compliance assessment
func (sh *SecurityHandler) StartComplianceAssessment(c *gin.Context) {
	var req struct {
		ProjectID   string `json:"project_id" binding:"required"`
		FrameworkID string `json:"framework_id" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID, ok := sh.requireProjectAccess(c, req.ProjectID)
	if !ok {
		return
	}

	if _, err := uuid.Parse(req.FrameworkID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid framework ID"})
		return
	}

	frameworkExists, err := sqlcdb.New(sh.db.DB).ComplianceFrameworkExists(context.Background(), uuid.MustParse(req.FrameworkID))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to validate framework"})
		return
	}
	if !frameworkExists {
		c.JSON(http.StatusNotFound, gin.H{"error": "Compliance framework not found"})
		return
	}

	// Log audit event
	sh.auditLogger.LogSecurityEvent(userID, req.ProjectID, "compliance_assessment_started", "project",
		map[string]interface{}{
			"project_id":   req.ProjectID,
			"framework_id": req.FrameworkID,
		}, c.ClientIP(), c.GetHeader("User-Agent"), true)

	report, err := sh.complianceManager.AssessCompliance(req.ProjectID, req.FrameworkID, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to start compliance assessment"})
		return
	}

	c.JSON(http.StatusAccepted, report)
}

// GetComplianceReport retrieves a compliance report
func (sh *SecurityHandler) GetComplianceReport(c *gin.Context) {
	reportID := firstPathParam(c, "reportId", "id")
	if !sh.requireComplianceReportAccess(c, reportID) {
		return
	}

	report, err := sh.complianceManager.GetComplianceReport(reportID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Compliance report not found"})
		return
	}

	c.JSON(http.StatusOK, report)
}

// GetComplianceFrameworks retrieves available compliance frameworks
func (sh *SecurityHandler) GetComplianceFrameworks(c *gin.Context) {
	rows, err := sqlcdb.New(sh.db.DB).ListComplianceFrameworks(context.Background())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get compliance frameworks"})
		return
	}

	var frameworks []security.ComplianceFramework
	for _, row := range rows {
		if !row.Description.Valid {
			continue
		}
		frameworks = append(frameworks, security.ComplianceFramework{
			ID:          row.ID.String(),
			Name:        row.Name,
			Description: row.Description.String,
			Version:     row.Version,
			Enabled:     row.Enabled,
			CreatedAt:   row.CreatedAt,
		})
	}

	c.JSON(http.StatusOK, gin.H{"frameworks": frameworks})
}

// InitializeGDPRFramework initializes the GDPR compliance framework
func (sh *SecurityHandler) InitializeGDPRFramework(c *gin.Context) {
	userID := c.MustGet("user_id").(string)

	err := sh.complianceManager.InitializeGDPRFramework()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to initialize GDPR framework"})
		return
	}

	// Log audit event
	sh.auditLogger.LogSecurityEvent(userID, "", "gdpr_framework_initialized", "compliance",
		map[string]interface{}{}, c.ClientIP(), c.GetHeader("User-Agent"), true)

	c.JSON(http.StatusOK, gin.H{"status": "initialized"})
}

// GetSecurityMetrics retrieves security metrics for a project
func (sh *SecurityHandler) GetSecurityMetrics(c *gin.Context) {
	projectID := firstPathParam(c, "projectId", "id", "project_id")
	if _, ok := sh.requireProjectAccess(c, projectID); !ok {
		return
	}

	// Get vulnerability counts
	var vulnMetrics struct {
		Total    int `json:"total"`
		Critical int `json:"critical"`
		High     int `json:"high"`
		Medium   int `json:"medium"`
		Low      int `json:"low"`
		Open     int `json:"open"`
		Resolved int `json:"resolved"`
	}

	q := sqlcdb.New(sh.db.DB)
	mrow, err := q.GetVulnerabilityMetrics(context.Background(), uuid.MustParse(projectID))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get vulnerability metrics"})
		return
	}
	vulnMetrics.Total = int(mrow.Total)
	vulnMetrics.Critical = int(mrow.Critical)
	vulnMetrics.High = int(mrow.High)
	vulnMetrics.Medium = int(mrow.Medium)
	vulnMetrics.Low = int(mrow.Low)
	vulnMetrics.Open = int(mrow.Open)
	vulnMetrics.Resolved = int(mrow.Resolved)

	// Get latest scan
	var latestScan struct {
		ID        string    `json:"id"`
		Score     int       `json:"score"`
		ScannedAt time.Time `json:"scanned_at"`
		Status    string    `json:"status"`
	}

	srow, err := q.GetLatestSecurityScan(context.Background(), uuid.MustParse(projectID))
	latestScan.ID = srow.ID.String()
	latestScan.Score = int(srow.Score)
	latestScan.ScannedAt = srow.ScannedAt
	latestScan.Status = srow.Status

	if err == sql.ErrNoRows {
		latestScan = struct {
			ID        string    `json:"id"`
			Score     int       `json:"score"`
			ScannedAt time.Time `json:"scanned_at"`
			Status    string    `json:"status"`
		}{ID: "", Score: 0, ScannedAt: time.Time{}, Status: "never_scanned"}
	} else if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get latest scan"})
		return
	}

	// Get compliance status
	var complianceStatus struct {
		OverallStatus string     `json:"overall_status"`
		Score         int        `json:"score"`
		LastAssessed  *time.Time `json:"last_assessed"`
	}

	crow, err := q.GetLatestComplianceReport(context.Background(), uuid.MustParse(projectID))
	complianceStatus.OverallStatus = crow.OverallStatus
	complianceStatus.Score = int(crow.Score)
	complianceStatus.LastAssessed = &crow.AssessmentDate

	if err == sql.ErrNoRows {
		complianceStatus = struct {
			OverallStatus string     `json:"overall_status"`
			Score         int        `json:"score"`
			LastAssessed  *time.Time `json:"last_assessed"`
		}{OverallStatus: "not_assessed", Score: 0, LastAssessed: nil}
	} else if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get compliance status"})
		return
	}

	metrics := gin.H{
		"vulnerabilities": vulnMetrics,
		"latest_scan":     latestScan,
		"compliance":      complianceStatus,
		"security_score": sh.calculateOverallSecurityScore(struct{ Total, Critical, High, Medium, Low, Open, Resolved int }{
			Total: vulnMetrics.Total, Critical: vulnMetrics.Critical, High: vulnMetrics.High,
			Medium: vulnMetrics.Medium, Low: vulnMetrics.Low, Open: vulnMetrics.Open, Resolved: vulnMetrics.Resolved,
		}, latestScan.Score, complianceStatus.Score),
	}

	c.JSON(http.StatusOK, metrics)
}

// calculateOverallSecurityScore calculates an overall security score
func (sh *SecurityHandler) calculateOverallSecurityScore(vulnMetrics struct {
	Total, Critical, High, Medium, Low, Open, Resolved int
}, scanScore, complianceScore int) int {
	// Weight the different components
	vulnScore := 100
	if vulnMetrics.Total > 0 {
		deduction := (vulnMetrics.Critical * 25) + (vulnMetrics.High * 15) + (vulnMetrics.Medium * 8) + (vulnMetrics.Low * 3)
		vulnScore = max(0, 100-deduction)
	}

	// Calculate weighted average
	overallScore := (vulnScore*40 + scanScore*30 + complianceScore*30) / 100
	return overallScore
}

// GetAuditLogs retrieves audit logs for security events
func (sh *SecurityHandler) GetAuditLogs(c *gin.Context) {
	projectID := firstPathParam(c, "projectId", "id", "project_id")
	if _, ok := sh.requireProjectAccess(c, projectID); !ok {
		return
	}

	limit := 50
	if limitStr := c.Query("limit"); limitStr != "" {
		if parsedLimit, err := strconv.Atoi(limitStr); err == nil && parsedLimit > 0 && parsedLimit <= 1000 {
			limit = parsedLimit
		}
	}

	offset := 0
	if offsetStr := c.Query("offset"); offsetStr != "" {
		if parsedOffset, err := strconv.Atoi(offsetStr); err == nil && parsedOffset >= 0 {
			offset = parsedOffset
		}
	}

	actionFilter := strings.TrimSpace(c.Query("action"))
	resourceFilter := strings.TrimSpace(c.Query("resource"))

	conditions := []string{
		`((resource = 'project' AND resource_id::text = $1) OR details->>'project_id' = $1)`,
	}
	args := []interface{}{projectID}
	nextArg := 2

	if actionFilter != "" {
		conditions = append(conditions, fmt.Sprintf("action = $%d", nextArg))
		args = append(args, actionFilter)
		nextArg++
	}
	if resourceFilter != "" {
		conditions = append(conditions, fmt.Sprintf("resource = $%d", nextArg))
		args = append(args, resourceFilter)
		nextArg++
	}

	whereClause := strings.Join(conditions, " AND ")

	var total int
	countQuery := "SELECT COUNT(*) FROM audit_logs WHERE " + whereClause
	if err := sh.db.QueryRow(countQuery, args...).Scan(&total); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to count audit logs"})
		return
	}

	dataQuery := fmt.Sprintf(`
		SELECT
			id,
			COALESCE(user_id::text, ''),
			action,
			resource,
			COALESCE(resource_id::text, ''),
			COALESCE(details::text, '{}'),
			COALESCE(ip_address::text, ''),
			COALESCE(user_agent, ''),
			created_at
		FROM audit_logs
		WHERE %s
		ORDER BY created_at DESC
		LIMIT $%d OFFSET $%d
	`, whereClause, nextArg, nextArg+1)
	dataArgs := append(append([]interface{}{}, args...), limit, offset)

	rows, err := sh.db.Query(dataQuery, dataArgs...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch audit logs"})
		return
	}
	defer rows.Close()

	logs := make([]gin.H, 0, limit)
	for rows.Next() {
		var (
			id         string
			userID     string
			action     string
			resource   string
			resourceID string
			detailsRaw string
			ipAddress  string
			userAgent  string
			createdAt  time.Time
		)
		if err := rows.Scan(&id, &userID, &action, &resource, &resourceID, &detailsRaw, &ipAddress, &userAgent, &createdAt); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to decode audit log row"})
			return
		}

		var details map[string]interface{}
		if err := json.Unmarshal([]byte(detailsRaw), &details); err != nil {
			details = map[string]interface{}{"raw": detailsRaw}
		}

		logs = append(logs, gin.H{
			"id":          id,
			"timestamp":   createdAt,
			"user_id":     userID,
			"action":      action,
			"resource":    resource,
			"resource_id": resourceID,
			"details":     details,
			"ip_address":  ipAddress,
			"user_agent":  userAgent,
			"success":     true,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"audit_logs": logs,
		"total":      total,
		"limit":      limit,
		"offset":     offset,
	})
}

func (sh *SecurityHandler) requireProjectAccess(c *gin.Context, projectID string) (string, bool) {
	userID := optionalUserID(c)

	if _, err := uuid.Parse(projectID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid project ID"})
		return "", false
	}

	hasAccess, err := sqlcdb.New(sh.db.DB).CheckSecurityProjectAccess(context.Background(), sqlcdb.CheckSecurityProjectAccessParams{
		ID:      uuid.MustParse(projectID),
		OwnerID: optionalUserUUID(c),
		Column3: contextIsAdmin(c),
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to verify project access"})
		return "", false
	}

	if !hasAccess {
		c.JSON(http.StatusNotFound, gin.H{"error": "Project not found"})
		return "", false
	}

	return userID, true
}

func (sh *SecurityHandler) requireSecurityScanAccess(c *gin.Context, scanID string) bool {
	if _, err := uuid.Parse(scanID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid scan ID"})
		return false
	}

	var projectID string
	pid, err := sqlcdb.New(sh.db.DB).GetSecurityScanProjectID(context.Background(), uuid.MustParse(scanID))
	projectID = pid.String()
	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "Security scan not found"})
		return false
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to verify scan access"})
		return false
	}

	_, ok := sh.requireProjectAccess(c, projectID)
	return ok
}

func (sh *SecurityHandler) requireComplianceReportAccess(c *gin.Context, reportID string) bool {
	if _, err := uuid.Parse(reportID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid report ID"})
		return false
	}

	var projectID string
	pid, err := sqlcdb.New(sh.db.DB).GetComplianceReportProjectID(context.Background(), uuid.MustParse(reportID))
	projectID = pid.String()
	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "Compliance report not found"})
		return false
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to verify report access"})
		return false
	}

	_, ok := sh.requireProjectAccess(c, projectID)
	return ok
}

func (sh *SecurityHandler) requireVulnerabilityAccess(c *gin.Context, vulnID string) (string, bool) {
	if _, err := uuid.Parse(vulnID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid vulnerability ID"})
		return "", false
	}

	var projectID string
	pid, err := sqlcdb.New(sh.db.DB).GetVulnerabilityProjectID(context.Background(), uuid.MustParse(vulnID))
	projectID = pid.String()
	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "Vulnerability not found"})
		return "", false
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to verify vulnerability access"})
		return "", false
	}

	return sh.requireProjectAccess(c, projectID)
}

// max helper function
func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}
