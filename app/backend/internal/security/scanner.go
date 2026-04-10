package security

import (
	"containr/internal/database"
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/google/uuid"
)

// Vulnerability represents a security vulnerability
type Vulnerability struct {
	ID          string     `json:"id"`
	Type        string     `json:"type"`     // "dependency", "configuration", "code"
	Severity    string     `json:"severity"` // "critical", "high", "medium", "low"
	Title       string     `json:"title"`
	Description string     `json:"description"`
	ServiceID   string     `json:"service_id"`
	ProjectID   string     `json:"project_id"`
	Status      string     `json:"status"` // "open", "resolved", "ignored"
	FoundAt     time.Time  `json:"found_at"`
	ResolvedAt  *time.Time `json:"resolved_at,omitempty"`
	Metadata    string     `json:"metadata"` // JSON string for additional data
}

// SecurityScan represents a security scan result
type SecurityScan struct {
	ID              string          `json:"id"`
	ProjectID       string          `json:"project_id"`
	ServiceID       *string         `json:"service_id,omitempty"`
	ScanType        string          `json:"scan_type"` // "dependency", "configuration", "comprehensive"
	Status          string          `json:"status"`    // "running", "completed", "failed"
	StartedAt       time.Time       `json:"started_at"`
	CompletedAt     *time.Time      `json:"completed_at,omitempty"`
	Vulnerabilities []Vulnerability `json:"vulnerabilities"`
	Summary         ScanSummary     `json:"summary"`
}

// ScanSummary provides a summary of scan results
type ScanSummary struct {
	Total    int `json:"total"`
	Critical int `json:"critical"`
	High     int `json:"high"`
	Medium   int `json:"medium"`
	Low      int `json:"low"`
	Score    int `json:"score"` // 0-100 security score
}

// Scanner handles security scanning operations
type Scanner struct {
	db *database.DB
}

// NewScanner creates a new security scanner
func NewScanner(db *database.DB) *Scanner {
	return &Scanner{db: db}
}

// StartSecurityScan initiates a security scan
func (s *Scanner) StartSecurityScan(projectID, serviceID, scanType string) (*SecurityScan, error) {
	scanID := uuid.New().String()

	scan := &SecurityScan{
		ID:        scanID,
		ProjectID: projectID,
		ScanType:  scanType,
		Status:    "running",
		StartedAt: time.Now(),
		Summary:   ScanSummary{},
	}

	if serviceID != "" {
		scan.ServiceID = &serviceID
	}

	// Insert scan record
	_, err := s.db.Exec(`
		INSERT INTO security_scans (id, project_id, service_id, scan_type, status, started_at)
		VALUES ($1, $2, $3, $4, $5, $6)
	`, scan.ID, scan.ProjectID, scan.ServiceID, scan.ScanType, scan.Status, scan.StartedAt)

	if err != nil {
		return nil, fmt.Errorf("failed to create security scan: %w", err)
	}

	// Start scan in background
	go s.performScan(scan)

	return scan, nil
}

// performScan executes the actual security scan
func (s *Scanner) performScan(scan *SecurityScan) {
	ctx := context.Background()
	var vulnerabilities []Vulnerability

	switch scan.ScanType {
	case "dependency":
		vulnerabilities = s.scanDependencies(ctx, scan)
	case "configuration":
		vulnerabilities = s.scanConfiguration(ctx, scan)
	case "comprehensive":
		vulnerabilities = s.scanComprehensive(ctx, scan)
	default:
		vulnerabilities = []Vulnerability{}
	}

	// Calculate summary
	summary := s.calculateSummary(vulnerabilities)

	// Update scan with results
	completedAt := time.Now()
	_, err := s.db.Exec(`
		UPDATE security_scans 
		SET status = $1, completed_at = $2, summary = $3
		WHERE id = $4
	`, "completed", completedAt, summaryToJSON(summary), scan.ID)

	if err != nil {
		log.Printf("Failed to update security scan %s: %v", scan.ID, err)
		return
	}

	// Store vulnerabilities
	for _, vuln := range vulnerabilities {
		_, err := s.db.Exec(`
			INSERT INTO vulnerabilities (id, type, severity, title, description, service_id, project_id, status, found_at, metadata)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		`, vuln.ID, vuln.Type, vuln.Severity, vuln.Title, vuln.Description, vuln.ServiceID, vuln.ProjectID, vuln.Status, vuln.FoundAt, vuln.Metadata)

		if err != nil {
			log.Printf("Failed to store vulnerability %s: %v", vuln.ID, err)
		}
	}
}

// scanDependencies scans for known vulnerable dependencies
func (s *Scanner) scanDependencies(ctx context.Context, scan *SecurityScan) []Vulnerability {
	var vulnerabilities []Vulnerability

	// Get project services
	query := `
		SELECT
			id,
			name,
			COALESCE(source_type, ''),
			source_url,
			image_name,
			build_command,
			start_command,
			health_check_url
		FROM services
		WHERE project_id = $1
	`
	args := []interface{}{scan.ProjectID}
	if scan.ServiceID != nil {
		query += ` AND id = $2`
		args = append(args, *scan.ServiceID)
	}

	rows, err := s.db.Query(query, args...)

	if err != nil {
		log.Printf("Failed to query services for scan: %v", err)
		return vulnerabilities
	}
	defer rows.Close()

	for rows.Next() {
		var (
			serviceID      string
			serviceName    string
			sourceType     string
			sourceURL      sql.NullString
			imageName      sql.NullString
			buildCommand   sql.NullString
			startCommand   sql.NullString
			healthCheckURL sql.NullString
		)
		if err := rows.Scan(
			&serviceID,
			&serviceName,
			&sourceType,
			&sourceURL,
			&imageName,
			&buildCommand,
			&startCommand,
			&healthCheckURL,
		); err != nil {
			continue
		}

		serviceVulns := s.evaluateDependencyFindings(scan.ProjectID, dependencyEvidence{
			ServiceID:      serviceID,
			ServiceName:    serviceName,
			SourceType:     strings.TrimSpace(sourceType),
			SourceURL:      strings.TrimSpace(sourceURL.String),
			ImageName:      strings.TrimSpace(imageName.String),
			BuildCommand:   strings.TrimSpace(buildCommand.String),
			StartCommand:   strings.TrimSpace(startCommand.String),
			HealthCheckURL: strings.TrimSpace(healthCheckURL.String),
		})
		vulnerabilities = append(vulnerabilities, serviceVulns...)
	}

	return vulnerabilities
}

type dependencyEvidence struct {
	ServiceID      string
	ServiceName    string
	SourceType     string
	SourceURL      string
	ImageName      string
	BuildCommand   string
	StartCommand   string
	HealthCheckURL string
}

func (s *Scanner) evaluateDependencyFindings(projectID string, evidence dependencyEvidence) []Vulnerability {
	var vulns []Vulnerability

	appendVuln := func(severity, title, description string, metadata map[string]interface{}) {
		vulns = append(vulns, Vulnerability{
			ID:          uuid.New().String(),
			Type:        "dependency",
			Severity:    severity,
			Title:       title,
			Description: description,
			ServiceID:   evidence.ServiceID,
			ProjectID:   projectID,
			Status:      "open",
			FoundAt:     time.Now(),
			Metadata:    toJSONMetadata(metadata),
		})
	}

	image := strings.ToLower(evidence.ImageName)
	if image != "" {
		if !strings.Contains(image, ":") || strings.HasSuffix(image, ":latest") {
			appendVuln(
				"medium",
				"Unpinned container image tag",
				"Container image is not pinned to an immutable version/tag, increasing supply-chain risk.",
				map[string]interface{}{"service": evidence.ServiceName, "image": evidence.ImageName},
			)
		}
	}

	if strings.HasPrefix(strings.ToLower(evidence.SourceURL), "http://") {
		appendVuln(
			"high",
			"Insecure source transport",
			"Source URL uses plain HTTP instead of HTTPS, enabling tampering during fetch.",
			map[string]interface{}{"service": evidence.ServiceName, "source_url": evidence.SourceURL},
		)
	}

	build := strings.ToLower(evidence.BuildCommand)
	if strings.Contains(build, "npm install") && !strings.Contains(build, "npm ci") {
		appendVuln(
			"medium",
			"Non-deterministic npm dependency install",
			"Build command uses `npm install`; prefer `npm ci` to enforce lockfile integrity in CI/CD.",
			map[string]interface{}{"service": evidence.ServiceName, "build_command": evidence.BuildCommand},
		)
	}

	if strings.Contains(build, "pip install") && !strings.Contains(build, "--require-hashes") {
		appendVuln(
			"medium",
			"Python dependencies installed without hash verification",
			"Build command uses `pip install` without `--require-hashes`, reducing dependency integrity guarantees.",
			map[string]interface{}{"service": evidence.ServiceName, "build_command": evidence.BuildCommand},
		)
	}

	if strings.Contains(build, "curl") && strings.Contains(build, "|") && (strings.Contains(build, "sh") || strings.Contains(build, "bash")) {
		appendVuln(
			"high",
			"Remote script execution in build pipeline",
			"Build command pipes remote content directly to shell execution (`curl ... | sh/bash`).",
			map[string]interface{}{"service": evidence.ServiceName, "build_command": evidence.BuildCommand},
		)
	}

	if evidence.SourceType == "github" && evidence.SourceURL == "" {
		appendVuln(
			"low",
			"Missing source repository URL",
			"Service is configured as GitHub source but source URL is empty, preventing provenance verification.",
			map[string]interface{}{"service": evidence.ServiceName},
		)
	}

	if evidence.HealthCheckURL == "" {
		appendVuln(
			"low",
			"No health check URL configured",
			"Service has no health check URL, reducing detection speed for vulnerable or failing releases.",
			map[string]interface{}{"service": evidence.ServiceName},
		)
	}

	return vulns
}

// scanConfiguration scans for security configuration issues
func (s *Scanner) scanConfiguration(ctx context.Context, scan *SecurityScan) []Vulnerability {
	var vulnerabilities []Vulnerability

	appendVuln := func(severity, title, description, serviceID string, metadata map[string]interface{}) {
		vulnerabilities = append(vulnerabilities, Vulnerability{
			ID:          uuid.New().String(),
			Type:        "configuration",
			Severity:    severity,
			Title:       title,
			Description: description,
			ServiceID:   serviceID,
			ProjectID:   scan.ProjectID,
			Status:      "open",
			FoundAt:     time.Now(),
			Metadata:    toJSONMetadata(metadata),
		})
	}

	serviceQuery := `
		SELECT id, name, COALESCE(public_url, ''), COALESCE(health_check_url, ''), COALESCE(build_command, ''), COALESCE(start_command, ''), COALESCE(status, '')
		FROM services
		WHERE project_id = $1
	`
	args := []interface{}{scan.ProjectID}
	if scan.ServiceID != nil {
		serviceQuery += ` AND id = $2`
		args = append(args, *scan.ServiceID)
	}

	rows, err := s.db.Query(serviceQuery, args...)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var (
				serviceID      string
				serviceName    string
				publicURL      string
				healthCheckURL string
				buildCommand   string
				startCommand   string
				status         string
			)

			if err := rows.Scan(&serviceID, &serviceName, &publicURL, &healthCheckURL, &buildCommand, &startCommand, &status); err != nil {
				continue
			}

			if publicURL != "" && strings.HasPrefix(strings.ToLower(publicURL), "http://") {
				appendVuln(
					"high",
					"Insecure public service URL",
					"Service exposes an HTTP URL without TLS.",
					serviceID,
					map[string]interface{}{"service": serviceName, "public_url": publicURL},
				)
			}

			activeStatus := strings.ToLower(strings.TrimSpace(status))
			if (activeStatus == "running" || activeStatus == "building" || activeStatus == "deploying") && strings.TrimSpace(healthCheckURL) == "" {
				appendVuln(
					"medium",
					"Missing runtime health check",
					"Running/deploying service has no configured health check URL.",
					serviceID,
					map[string]interface{}{"service": serviceName},
				)
			}

			exec := strings.ToLower(buildCommand + " " + startCommand)
			if strings.Contains(exec, "--debug") || strings.Contains(exec, "--reload") || strings.Contains(exec, "node_env=development") {
				appendVuln(
					"medium",
					"Potential debug/development runtime configuration",
					"Service command includes debug/development flags that are risky in production.",
					serviceID,
					map[string]interface{}{"service": serviceName},
				)
			}
		}
	}

	dbRows, dbErr := s.db.Query(`
		SELECT ds.id, ds.name
		FROM projects p
		JOIN database_services ds ON ds.user_id = p.owner_id
		JOIN database_settings st ON st.database_id = ds.id
		WHERE p.id = $1 AND COALESCE(st.ssl_enabled, false) = false
	`, scan.ProjectID)
	if dbErr == nil {
		defer dbRows.Close()
		for dbRows.Next() {
			var dbID, dbName string
			if err := dbRows.Scan(&dbID, &dbName); err != nil {
				continue
			}
			appendVuln(
				"high",
				"Database SSL disabled",
				"Managed database has SSL/TLS disabled; encrypt database traffic in transit.",
				"",
				map[string]interface{}{"database_id": dbID, "database_name": dbName},
			)
		}
	}

	var hasRecentAudit bool
	auditErr := s.db.QueryRow(`
		SELECT EXISTS(
			SELECT 1
			FROM audit_logs
			WHERE (
				(resource = 'project' AND resource_id::text = $1)
				OR details->>'project_id' = $1
			)
			AND created_at > NOW() - INTERVAL '30 days'
		)
	`, scan.ProjectID).Scan(&hasRecentAudit)
	if auditErr == nil && !hasRecentAudit {
		appendVuln(
			"low",
			"No recent security audit events",
			"No audit log entries were found for this project in the last 30 days.",
			"",
			map[string]interface{}{"project_id": scan.ProjectID},
		)
	}

	return vulnerabilities
}

// scanComprehensive performs a comprehensive security scan
func (s *Scanner) scanComprehensive(ctx context.Context, scan *SecurityScan) []Vulnerability {
	var allVulnerabilities []Vulnerability

	// Run all scan types
	allVulnerabilities = append(allVulnerabilities, s.scanDependencies(ctx, scan)...)
	allVulnerabilities = append(allVulnerabilities, s.scanConfiguration(ctx, scan)...)

	return allVulnerabilities
}

// calculateSummary calculates scan summary from vulnerabilities
func (s *Scanner) calculateSummary(vulnerabilities []Vulnerability) ScanSummary {
	summary := ScanSummary{
		Total: len(vulnerabilities),
	}

	for _, vuln := range vulnerabilities {
		switch vuln.Severity {
		case "critical":
			summary.Critical++
		case "high":
			summary.High++
		case "medium":
			summary.Medium++
		case "low":
			summary.Low++
		}
	}

	// Calculate security score (0-100, higher is better)
	if summary.Total == 0 {
		summary.Score = 100
	} else {
		deduction := (summary.Critical * 25) + (summary.High * 15) + (summary.Medium * 8) + (summary.Low * 3)
		summary.Score = max(0, 100-deduction)
	}

	return summary
}

// GetSecurityScan retrieves a security scan by ID
func (s *Scanner) GetSecurityScan(scanID string) (*SecurityScan, error) {
	var scan SecurityScan
	var summaryJSON sql.NullString
	var completedAt sql.NullTime

	err := s.db.QueryRow(`
		SELECT id, project_id, service_id, scan_type, status, started_at, completed_at, summary
		FROM security_scans WHERE id = $1
	`, scanID).Scan(&scan.ID, &scan.ProjectID, &scan.ServiceID, &scan.ScanType, &scan.Status, &scan.StartedAt, &completedAt, &summaryJSON)

	if err != nil {
		return nil, err
	}

	if completedAt.Valid {
		scan.CompletedAt = &completedAt.Time
	}

	if summaryJSON.Valid {
		scan.Summary = jsonToSummary(summaryJSON.String)
	}

	// Load vulnerabilities
	vulns, err := s.getVulnerabilitiesForScan(scan.ID)
	if err == nil {
		scan.Vulnerabilities = vulns
	}

	return &scan, nil
}

// getVulnerabilitiesForScan retrieves vulnerabilities for a scan
func (s *Scanner) getVulnerabilitiesForScan(scanID string) ([]Vulnerability, error) {
	rows, err := s.db.Query(`
		SELECT id, type, severity, title, description, service_id, project_id, status, found_at, resolved_at, metadata
		FROM vulnerabilities WHERE project_id = (SELECT project_id FROM security_scans WHERE id = $1)
		ORDER BY severity DESC, found_at DESC
	`, scanID)

	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var vulnerabilities []Vulnerability
	for rows.Next() {
		var vuln Vulnerability
		var resolvedAt sql.NullTime

		err := rows.Scan(&vuln.ID, &vuln.Type, &vuln.Severity, &vuln.Title, &vuln.Description,
			&vuln.ServiceID, &vuln.ProjectID, &vuln.Status, &vuln.FoundAt, &resolvedAt, &vuln.Metadata)

		if err != nil {
			continue
		}

		if resolvedAt.Valid {
			vuln.ResolvedAt = &resolvedAt.Time
		}

		vulnerabilities = append(vulnerabilities, vuln)
	}

	return vulnerabilities, nil
}

// GetProjectSecurityHistory retrieves security scan history for a project
func (s *Scanner) GetProjectSecurityHistory(projectID string, limit int) ([]SecurityScan, error) {
	rows, err := s.db.Query(`
		SELECT id, project_id, service_id, scan_type, status, started_at, completed_at, summary
		FROM security_scans 
		WHERE project_id = $1 
		ORDER BY started_at DESC 
		LIMIT $2
	`, projectID, limit)

	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var scans []SecurityScan
	for rows.Next() {
		var scan SecurityScan
		var summaryJSON sql.NullString
		var completedAt sql.NullTime

		err := rows.Scan(&scan.ID, &scan.ProjectID, &scan.ServiceID, &scan.ScanType, &scan.Status,
			&scan.StartedAt, &completedAt, &summaryJSON)

		if err != nil {
			continue
		}

		if completedAt.Valid {
			scan.CompletedAt = &completedAt.Time
		}

		if summaryJSON.Valid {
			scan.Summary = jsonToSummary(summaryJSON.String)
		}

		scans = append(scans, scan)
	}

	return scans, nil
}

// Helper functions
func summaryToJSON(summary ScanSummary) string {
	data, _ := json.Marshal(summary)
	return string(data)
}

func jsonToSummary(jsonStr string) ScanSummary {
	var summary ScanSummary
	json.Unmarshal([]byte(jsonStr), &summary)
	return summary
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}

func toJSONMetadata(metadata map[string]interface{}) string {
	if len(metadata) == 0 {
		return "{}"
	}
	b, err := json.Marshal(metadata)
	if err != nil {
		return "{}"
	}
	return string(b)
}
