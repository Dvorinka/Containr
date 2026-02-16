package api

import (
	"containr/internal/database"
	"containr/internal/security"
	"net/http"
	"strconv"
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

	return &SecurityHandler{
		db:                   db,
		scanner:              security.NewScanner(db),
		complianceManager:    security.NewComplianceManager(db),
		encryptionManager:    encryptionManager,
		dataRetentionManager: security.NewDataRetentionManager(encryptionManager),
		auditLogger:          security.NewAuditLogger(encryptionManager),
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

	userID := c.MustGet("user_id").(string)

	// Log audit event
	sh.auditLogger.LogSecurityEvent(userID, "security_scan_started", "project",
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
	scanID := c.Param("scanId")

	scan, err := sh.scanner.GetSecurityScan(scanID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Security scan not found"})
		return
	}

	c.JSON(http.StatusOK, scan)
}

// GetProjectSecurityHistory retrieves security scan history for a project
func (sh *SecurityHandler) GetProjectSecurityHistory(c *gin.Context) {
	projectID := c.Param("projectId")

	limit := 10
	if limitStr := c.Query("limit"); limitStr != "" {
		if parsedLimit, err := strconv.Atoi(limitStr); err == nil && parsedLimit > 0 {
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
	projectID := c.Param("projectId")

	// Query vulnerabilities
	rows, err := sh.db.Query(`
		SELECT id, type, severity, title, description, service_id, status, found_at, resolved_at
		FROM vulnerabilities 
		WHERE project_id = $1 
		ORDER BY 
			CASE severity 
				WHEN 'critical' THEN 1 
				WHEN 'high' THEN 2 
				WHEN 'medium' THEN 3 
				WHEN 'low' THEN 4 
			END,
			found_at DESC
	`, projectID)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get vulnerabilities"})
		return
	}
	defer rows.Close()

	var vulnerabilities []security.Vulnerability
	for rows.Next() {
		var vuln security.Vulnerability
		var resolvedAt *time.Time

		err := rows.Scan(&vuln.ID, &vuln.Type, &vuln.Severity, &vuln.Title, &vuln.Description,
			&vuln.ServiceID, &vuln.Status, &vuln.FoundAt, &resolvedAt)

		if err != nil {
			continue
		}

		vuln.ResolvedAt = resolvedAt
		vulnerabilities = append(vulnerabilities, vuln)
	}

	c.JSON(http.StatusOK, gin.H{"vulnerabilities": vulnerabilities})
}

// UpdateVulnerability updates a vulnerability status
func (sh *SecurityHandler) UpdateVulnerability(c *gin.Context) {
	vulnID := c.Param("vulnId")
	userID := c.MustGet("user_id").(string)

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

	_, err := sh.db.Exec(`
		UPDATE vulnerabilities 
		SET status = $1, resolved_at = $2 
		WHERE id = $3
	`, req.Status, resolvedAt, vulnID)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update vulnerability"})
		return
	}

	// Log audit event
	sh.auditLogger.LogSecurityEvent(userID, "vulnerability_updated", "vulnerability",
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

	userID := c.MustGet("user_id").(string)

	// Log audit event
	sh.auditLogger.LogSecurityEvent(userID, "compliance_assessment_started", "project",
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
	reportID := c.Param("reportId")

	report, err := sh.complianceManager.GetComplianceReport(reportID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Compliance report not found"})
		return
	}

	c.JSON(http.StatusOK, report)
}

// GetComplianceFrameworks retrieves available compliance frameworks
func (sh *SecurityHandler) GetComplianceFrameworks(c *gin.Context) {
	rows, err := sh.db.Query(`
		SELECT id, name, description, version, enabled, created_at
		FROM compliance_frameworks 
		WHERE enabled = true 
		ORDER BY name
	`)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get compliance frameworks"})
		return
	}
	defer rows.Close()

	var frameworks []security.ComplianceFramework
	for rows.Next() {
		var framework security.ComplianceFramework
		err := rows.Scan(&framework.ID, &framework.Name, &framework.Description,
			&framework.Version, &framework.Enabled, &framework.CreatedAt)

		if err != nil {
			continue
		}

		frameworks = append(frameworks, framework)
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
	sh.auditLogger.LogSecurityEvent(userID, "gdpr_framework_initialized", "compliance",
		map[string]interface{}{}, c.ClientIP(), c.GetHeader("User-Agent"), true)

	c.JSON(http.StatusOK, gin.H{"status": "initialized"})
}

// GetSecurityMetrics retrieves security metrics for a project
func (sh *SecurityHandler) GetSecurityMetrics(c *gin.Context) {
	projectID := c.Param("projectId")

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

	sh.db.QueryRow(`
		SELECT 
			COUNT(*) as total,
			COUNT(*) FILTER (WHERE severity = 'critical') as critical,
			COUNT(*) FILTER (WHERE severity = 'high') as high,
			COUNT(*) FILTER (WHERE severity = 'medium') as medium,
			COUNT(*) FILTER (WHERE severity = 'low') as low,
			COUNT(*) FILTER (WHERE status = 'open') as open,
			COUNT(*) FILTER (WHERE status = 'resolved') as resolved
		FROM vulnerabilities 
		WHERE project_id = $1
	`, projectID).Scan(&vulnMetrics.Total, &vulnMetrics.Critical, &vulnMetrics.High,
		&vulnMetrics.Medium, &vulnMetrics.Low, &vulnMetrics.Open, &vulnMetrics.Resolved)

	// Get latest scan
	var latestScan struct {
		ID        string    `json:"id"`
		Score     int       `json:"score"`
		ScannedAt time.Time `json:"scanned_at"`
		Status    string    `json:"status"`
	}

	err := sh.db.QueryRow(`
		SELECT id, score, started_at as scanned_at, status
		FROM security_scans 
		WHERE project_id = $1 
		ORDER BY started_at DESC 
		LIMIT 1
	`, projectID).Scan(&latestScan.ID, &latestScan.Score, &latestScan.ScannedAt, &latestScan.Status)

	if err != nil {
		latestScan = struct {
			ID        string    `json:"id"`
			Score     int       `json:"score"`
			ScannedAt time.Time `json:"scanned_at"`
			Status    string    `json:"status"`
		}{ID: "", Score: 0, ScannedAt: time.Time{}, Status: "never_scanned"}
	}

	// Get compliance status
	var complianceStatus struct {
		OverallStatus string     `json:"overall_status"`
		Score         int        `json:"score"`
		LastAssessed  *time.Time `json:"last_assessed"`
	}

	err = sh.db.QueryRow(`
		SELECT overall_status, score, assessment_date
		FROM compliance_reports 
		WHERE project_id = $1 
		ORDER BY assessment_date DESC 
		LIMIT 1
	`, projectID).Scan(&complianceStatus.OverallStatus, &complianceStatus.Score, &complianceStatus.LastAssessed)

	if err != nil {
		complianceStatus = struct {
			OverallStatus string     `json:"overall_status"`
			Score         int        `json:"score"`
			LastAssessed  *time.Time `json:"last_assessed"`
		}{OverallStatus: "not_assessed", Score: 0, LastAssessed: nil}
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
	_ = c.Param("projectId") // projectID is available but not used in this implementation

	limit := 50
	if limitStr := c.Query("limit"); limitStr != "" {
		if parsedLimit, err := strconv.Atoi(limitStr); err == nil && parsedLimit > 0 && parsedLimit <= 1000 {
			limit = parsedLimit
		}
	}

	// In a real implementation, this would query the audit database
	// For now, return a placeholder response
	c.JSON(http.StatusOK, gin.H{
		"audit_logs": []gin.H{
			{
				"id":         uuid.New().String(),
				"timestamp":  time.Now(),
				"user_id":    c.MustGet("user_id").(string),
				"action":     "security_scan_started",
				"resource":   "project",
				"ip_address": c.ClientIP(),
				"success":    true,
			},
		},
		"total": 1,
		"limit": limit,
	})
}

// max helper function
func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}
