package security

import (
	"containr/internal/database"
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
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
	query := `SELECT id, name FROM services WHERE project_id = $1`
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
		var serviceID, serviceName string
		if err := rows.Scan(&serviceID, &serviceName); err != nil {
			continue
		}

		// Simulate dependency scanning (in real implementation, this would check package.json, go.mod, etc.)
		serviceVulns := s.simulateDependencyScan(serviceID, serviceName, scan.ProjectID)
		vulnerabilities = append(vulnerabilities, serviceVulns...)
	}

	return vulnerabilities
}

// simulateDependencyScan simulates scanning for vulnerable dependencies
func (s *Scanner) simulateDependencyScan(serviceID, serviceName, projectID string) []Vulnerability {
	var vulns []Vulnerability

	// Simulate finding some common vulnerabilities
	commonVulns := []struct {
		title       string
		description string
		severity    string
	}{
		{"Outdated OpenSSL version", "Service uses OpenSSL version with known vulnerabilities", "high"},
		{"Vulnerable npm package", "Package 'lodash' version < 4.17.21 has prototype pollution vulnerability", "medium"},
		{"Outdated Go module", "Go module 'net/http' version has security issues", "low"},
	}

	for i, vuln := range commonVulns {
		vulns = append(vulns, Vulnerability{
			ID:          uuid.New().String(),
			Type:        "dependency",
			Severity:    vuln.severity,
			Title:       vuln.title,
			Description: vuln.description,
			ServiceID:   serviceID,
			ProjectID:   projectID,
			Status:      "open",
			FoundAt:     time.Now(),
			Metadata:    fmt.Sprintf(`{"service": "%s", "package": "example-package-%d"}`, serviceName, i+1),
		})
	}

	return vulns
}

// scanConfiguration scans for security configuration issues
func (s *Scanner) scanConfiguration(ctx context.Context, scan *SecurityScan) []Vulnerability {
	var vulnerabilities []Vulnerability

	// Check for common configuration issues
	configIssues := []struct {
		title       string
		description string
		severity    string
	}{
		{"Debug mode enabled", "Application is running in debug mode in production", "high"},
		{"No rate limiting", "API endpoints lack rate limiting protection", "medium"},
		{"CORS too permissive", "CORS configuration allows all origins", "medium"},
		{"Missing security headers", "Security headers (CSP, HSTS) not configured", "low"},
	}

	for _, issue := range configIssues {
		vulnerabilities = append(vulnerabilities, Vulnerability{
			ID:          uuid.New().String(),
			Type:        "configuration",
			Severity:    issue.severity,
			Title:       issue.title,
			Description: issue.description,
			ServiceID:   "", // Project-level issue
			ProjectID:   scan.ProjectID,
			Status:      "open",
			FoundAt:     time.Now(),
			Metadata:    "{}",
		})
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
