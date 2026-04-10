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

// ComplianceFramework represents a compliance framework
type ComplianceFramework struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	Version     string    `json:"version"`
	Enabled     bool      `json:"enabled"`
	CreatedAt   time.Time `json:"created_at"`
}

// ComplianceControl represents a compliance control
type ComplianceControl struct {
	ID            string     `json:"id"`
	FrameworkID   string     `json:"framework_id"`
	Code          string     `json:"code"`
	Title         string     `json:"title"`
	Description   string     `json:"description"`
	Category      string     `json:"category"`
	Requirement   string     `json:"requirement"`
	TestProcedure string     `json:"test_procedure"`
	Status        string     `json:"status"` // "compliant", "non_compliant", "not_applicable", "pending"
	LastAssessed  *time.Time `json:"last_assessed,omitempty"`
	Evidence      string     `json:"evidence"`
	Metadata      string     `json:"metadata"`
}

// ComplianceReport represents a compliance assessment report
type ComplianceReport struct {
	ID              string              `json:"id"`
	ProjectID       string              `json:"project_id"`
	FrameworkID     string              `json:"framework_id"`
	AssessmentDate  time.Time           `json:"assessment_date"`
	Assessor        string              `json:"assessor"`
	OverallStatus   string              `json:"overall_status"`
	Score           int                 `json:"score"` // 0-100
	Controls        []ComplianceControl `json:"controls"`
	Risks           []ComplianceRisk    `json:"risks"`
	Recommendations []string            `json:"recommendations"`
}

// ComplianceRisk represents a compliance risk
type ComplianceRisk struct {
	ID          string `json:"id"`
	ControlID   string `json:"control_id"`
	Title       string `json:"title"`
	Description string `json:"description"`
	Impact      string `json:"impact"`     // "high", "medium", "low"
	Likelihood  string `json:"likelihood"` // "high", "medium", "low"
	Mitigation  string `json:"mitigation"`
}

// ComplianceManager handles compliance operations
type ComplianceManager struct {
	db *database.DB
}

// NewComplianceManager creates a new compliance manager
func NewComplianceManager(db *database.DB) *ComplianceManager {
	return &ComplianceManager{db: db}
}

// InitializeGDPRFramework initializes GDPR compliance framework
func (cm *ComplianceManager) InitializeGDPRFramework() error {
	framework := ComplianceFramework{
		ID:          uuid.New().String(),
		Name:        "GDPR",
		Description: "General Data Protection Regulation compliance framework",
		Version:     "1.0",
		Enabled:     true,
		CreatedAt:   time.Now(),
	}

	// Insert framework
	_, err := cm.db.Exec(`
		INSERT INTO compliance_frameworks (id, name, description, version, enabled, created_at)
		VALUES ($1, $2, $3, $4, $5, $6)
		ON CONFLICT (name) DO UPDATE SET version = $4, enabled = $5
	`, framework.ID, framework.Name, framework.Description, framework.Version, framework.Enabled, framework.CreatedAt)

	if err != nil {
		return fmt.Errorf("failed to create GDPR framework: %w", err)
	}

	// Add GDPR controls
	controls := []ComplianceControl{
		{
			ID:            uuid.New().String(),
			FrameworkID:   framework.ID,
			Code:          "GDPR-Art-32",
			Title:         "Security of Processing",
			Description:   "Technical and organizational measures to ensure data security",
			Category:      "Security",
			Requirement:   "Implement appropriate technical and organizational measures to ensure a level of security appropriate to the risk",
			TestProcedure: "Review security controls, encryption policies, access controls, and incident response procedures",
			Status:        "pending",
			Evidence:      "",
			Metadata:      `{"risk_level": "high", "review_frequency": "quarterly"}`,
		},
		{
			ID:            uuid.New().String(),
			FrameworkID:   framework.ID,
			Code:          "GDPR-Art-25",
			Title:         "Data Protection by Design and by Default",
			Description:   "Implement data protection measures in system design",
			Category:      "Privacy by Design",
			Requirement:   "Implement data protection principles in system design and default settings",
			TestProcedure: "Review system architecture, privacy settings, and data minimization practices",
			Status:        "pending",
			Evidence:      "",
			Metadata:      `{"risk_level": "medium", "review_frequency": "biannual"}`,
		},
		{
			ID:            uuid.New().String(),
			FrameworkID:   framework.ID,
			Code:          "GDPR-Art-24",
			Title:         "Responsibility of the Controller",
			Description:   "Data controller responsibility and compliance demonstration",
			Category:      "Governance",
			Requirement:   "Implement measures to ensure and demonstrate compliance with GDPR",
			TestProcedure: "Review governance policies, documentation, and compliance monitoring",
			Status:        "pending",
			Evidence:      "",
			Metadata:      `{"risk_level": "medium", "review_frequency": "annual"}`,
		},
		{
			ID:            uuid.New().String(),
			FrameworkID:   framework.ID,
			Code:          "GDPR-Art-33",
			Title:         "Notification of Personal Data Breach",
			Description:   "Procedures for notifying data breaches to authorities",
			Category:      "Incident Response",
			Requirement:   "Implement procedures for notifying personal data breaches within 72 hours",
			TestProcedure: "Review incident response procedures, notification templates, and breach detection mechanisms",
			Status:        "pending",
			Evidence:      "",
			Metadata:      `{"risk_level": "high", "review_frequency": "quarterly"}`,
		},
	}

	for _, control := range controls {
		_, err := cm.db.Exec(`
			INSERT INTO compliance_controls (id, framework_id, code, title, description, category, requirement, test_procedure, status, last_assessed, evidence, metadata)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NULL, $10, $11)
			ON CONFLICT (framework_id, code) DO UPDATE SET title = $4, description = $5, requirement = $7, test_procedure = $8
		`, control.ID, control.FrameworkID, control.Code, control.Title, control.Description,
			control.Category, control.Requirement, control.TestProcedure, control.Status, control.Evidence, control.Metadata)

		if err != nil {
			log.Printf("Failed to insert GDPR control %s: %v", control.Code, err)
		}
	}

	return nil
}

// AssessCompliance performs a compliance assessment
func (cm *ComplianceManager) AssessCompliance(projectID, frameworkID, assessor string) (*ComplianceReport, error) {
	reportID := uuid.New().String()

	report := &ComplianceReport{
		ID:              reportID,
		ProjectID:       projectID,
		FrameworkID:     frameworkID,
		AssessmentDate:  time.Now(),
		Assessor:        assessor,
		OverallStatus:   "in_progress",
		Score:           0,
		Controls:        []ComplianceControl{},
		Risks:           []ComplianceRisk{},
		Recommendations: []string{},
	}

	// Insert report record
	_, err := cm.db.Exec(`
		INSERT INTO compliance_reports (id, project_id, framework_id, assessment_date, assessor, overall_status, score)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
	`, report.ID, report.ProjectID, report.FrameworkID, report.AssessmentDate, report.Assessor, report.OverallStatus, report.Score)

	if err != nil {
		return nil, fmt.Errorf("failed to create compliance report: %w", err)
	}

	// Start assessment in background
	go cm.performAssessment(report)

	return report, nil
}

// performAssessment executes the compliance assessment
func (cm *ComplianceManager) performAssessment(report *ComplianceReport) {
	ctx := context.Background()

	// Get framework controls
	controls, err := cm.getFrameworkControls(report.FrameworkID)
	if err != nil {
		log.Printf("Failed to get framework controls: %v", err)
		return
	}

	var assessedControls []ComplianceControl
	var risks []ComplianceRisk
	var recommendations []string
	compliantCount := 0

	if len(controls) == 0 {
		_, updateErr := cm.db.Exec(`
			UPDATE compliance_reports 
			SET overall_status = $1, score = $2
			WHERE id = $3
		`, "non_compliant", 0, report.ID)
		if updateErr != nil {
			log.Printf("Failed to update compliance report %s with empty control set: %v", report.ID, updateErr)
		}
		return
	}

	for _, control := range controls {
		assessedControl := cm.assessControl(ctx, report.ProjectID, control)
		assessedControls = append(assessedControls, assessedControl)

		if assessedControl.Status == "compliant" {
			compliantCount++
		} else if assessedControl.Status == "non_compliant" {
			// Generate risk for non-compliant controls
			risk := ComplianceRisk{
				ID:          uuid.New().String(),
				ControlID:   assessedControl.ID,
				Title:       fmt.Sprintf("Non-compliance: %s", assessedControl.Title),
				Description: fmt.Sprintf("Control %s is not compliant", assessedControl.Code),
				Impact:      cm.getRiskImpact(assessedControl),
				Likelihood:  cm.getRiskLikelihood(assessedControl),
				Mitigation:  cm.generateMitigation(assessedControl),
			}
			risks = append(risks, risk)

			// Generate recommendation
			rec := fmt.Sprintf("Implement controls to achieve compliance for %s: %s", assessedControl.Code, assessedControl.Title)
			recommendations = append(recommendations, rec)
		}

		// Update control status in database
		_, err := cm.db.Exec(`
			UPDATE compliance_controls 
			SET status = $1, last_assessed = $2, evidence = $3
			WHERE id = $4
		`, assessedControl.Status, assessedControl.LastAssessed, assessedControl.Evidence, assessedControl.ID)

		if err != nil {
			log.Printf("Failed to update control %s: %v", assessedControl.ID, err)
		}
	}

	// Calculate overall score
	score := int((float64(compliantCount) / float64(len(controls))) * 100)

	// Determine overall status
	overallStatus := "non_compliant"
	if score >= 90 {
		overallStatus = "compliant"
	} else if score >= 70 {
		overallStatus = "partially_compliant"
	}

	// Update report with results
	_, err = cm.db.Exec(`
		UPDATE compliance_reports 
		SET overall_status = $1, score = $2
		WHERE id = $3
	`, overallStatus, score, report.ID)

	if err != nil {
		log.Printf("Failed to update compliance report %s: %v", report.ID, err)
		return
	}

	// Store risks and recommendations
	for _, risk := range risks {
		_, err := cm.db.Exec(`
			INSERT INTO compliance_risks (id, report_id, control_id, title, description, impact, likelihood, mitigation)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		`, risk.ID, report.ID, risk.ControlID, risk.Title, risk.Description, risk.Impact, risk.Likelihood, risk.Mitigation)

		if err != nil {
			log.Printf("Failed to store risk %s: %v", risk.ID, err)
		}
	}
}

// getFrameworkControls retrieves all controls for a framework
func (cm *ComplianceManager) getFrameworkControls(frameworkID string) ([]ComplianceControl, error) {
	rows, err := cm.db.Query(`
		SELECT id, framework_id, code, title, description, category, requirement, test_procedure, status, last_assessed, evidence, metadata
		FROM compliance_controls WHERE framework_id = $1
	`, frameworkID)

	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var controls []ComplianceControl
	for rows.Next() {
		var control ComplianceControl
		var lastAssessed sql.NullTime

		err := rows.Scan(&control.ID, &control.FrameworkID, &control.Code, &control.Title, &control.Description,
			&control.Category, &control.Requirement, &control.TestProcedure, &control.Status, &lastAssessed, &control.Evidence, &control.Metadata)

		if err != nil {
			continue
		}

		if lastAssessed.Valid {
			control.LastAssessed = &lastAssessed.Time
		}

		controls = append(controls, control)
	}

	return controls, nil
}

// assessControl assesses a single compliance control
func (cm *ComplianceManager) assessControl(ctx context.Context, projectID string, control ComplianceControl) ComplianceControl {
	assessed := control
	now := time.Now()
	assessed.LastAssessed = &now

	_ = ctx

	switch control.Code {
	case "GDPR-Art-32":
		encryption := cm.checkDataEncryption(projectID)
		accessControl := cm.checkAccessControl(projectID)
		incidentResponse := cm.checkIncidentResponse(projectID)

		if encryption.OK && accessControl.OK && incidentResponse.OK {
			assessed.Status = "compliant"
			assessed.Evidence = strings.Join([]string{
				encryption.Evidence,
				accessControl.Evidence,
				incidentResponse.Evidence,
			}, " | ")
		} else {
			assessed.Status = "non_compliant"
			missing := []string{}
			if !encryption.OK {
				missing = append(missing, "data encryption")
			}
			if !accessControl.OK {
				missing = append(missing, "access controls")
			}
			if !incidentResponse.OK {
				missing = append(missing, "incident response procedures")
			}
			assessed.Evidence = fmt.Sprintf(
				"Missing controls: %s. Details: %s | %s | %s",
				strings.Join(missing, ", "),
				encryption.Evidence,
				accessControl.Evidence,
				incidentResponse.Evidence,
			)
		}

	case "GDPR-Art-25":
		dataMinimization := cm.checkDataMinimization(projectID)
		privacySettings := cm.checkPrivacySettings(projectID)

		if dataMinimization.OK && privacySettings.OK {
			assessed.Status = "compliant"
			assessed.Evidence = strings.Join([]string{
				dataMinimization.Evidence,
				privacySettings.Evidence,
			}, " | ")
		} else {
			assessed.Status = "non_compliant"
			assessed.Evidence = fmt.Sprintf(
				"Privacy by design principles not fully implemented: %s | %s",
				dataMinimization.Evidence,
				privacySettings.Evidence,
			)
		}

	case "GDPR-Art-24":
		governance := cm.checkGovernance(projectID)
		if governance.OK {
			assessed.Status = "compliant"
			assessed.Evidence = governance.Evidence
		} else {
			assessed.Status = "non_compliant"
			assessed.Evidence = governance.Evidence
		}

	case "GDPR-Art-33":
		breachReadiness := cm.checkBreachNotificationReadiness(projectID)
		if breachReadiness.OK {
			assessed.Status = "compliant"
			assessed.Evidence = breachReadiness.Evidence
		} else {
			assessed.Status = "non_compliant"
			assessed.Evidence = breachReadiness.Evidence
		}

	default:
		// Default assessment for other controls
		assessed.Status = "pending"
		assessed.Evidence = "Assessment pending manual review"
	}

	return assessed
}

type controlCheckResult struct {
	OK       bool
	Evidence string
}

func (cm *ComplianceManager) checkDataEncryption(projectID string) controlCheckResult {
	var insecureServiceURLs int
	if err := cm.db.QueryRow(`
		SELECT COUNT(*)
		FROM services
		WHERE project_id = $1
		  AND COALESCE(public_url, '') <> ''
		  AND LOWER(public_url) LIKE 'http://%'
	`, projectID).Scan(&insecureServiceURLs); err != nil {
		return controlCheckResult{OK: false, Evidence: fmt.Sprintf("failed to evaluate service TLS posture: %v", err)}
	}

	var sslDisabledDatabases int
	if err := cm.db.QueryRow(`
		SELECT COUNT(*)
		FROM projects p
		JOIN database_services ds ON ds.user_id = p.owner_id
		JOIN database_settings st ON st.database_id = ds.id
		WHERE p.id = $1
		  AND COALESCE(st.ssl_enabled, false) = false
	`, projectID).Scan(&sslDisabledDatabases); err != nil {
		return controlCheckResult{OK: false, Evidence: fmt.Sprintf("failed to evaluate database TLS posture: %v", err)}
	}

	ok := insecureServiceURLs == 0 && sslDisabledDatabases == 0
	return controlCheckResult{
		OK: ok,
		Evidence: fmt.Sprintf(
			"service_http_endpoints=%d, databases_with_ssl_disabled=%d",
			insecureServiceURLs,
			sslDisabledDatabases,
		),
	}
}

func (cm *ComplianceManager) checkAccessControl(projectID string) controlCheckResult {
	var memberCount int
	if err := cm.db.QueryRow(`SELECT COUNT(*) FROM project_members WHERE project_id = $1`, projectID).Scan(&memberCount); err != nil {
		return controlCheckResult{OK: false, Evidence: fmt.Sprintf("failed to inspect project membership: %v", err)}
	}

	var ownerID string
	if err := cm.db.QueryRow(`SELECT owner_id::text FROM projects WHERE id = $1`, projectID).Scan(&ownerID); err != nil {
		return controlCheckResult{OK: false, Evidence: fmt.Sprintf("failed to inspect project owner: %v", err)}
	}

	var ownerRoleCount int
	err := cm.db.QueryRow(`SELECT COUNT(*) FROM user_roles WHERE user_id::text = $1`, ownerID).Scan(&ownerRoleCount)
	if err != nil {
		// If RBAC tables are absent in older deployments, fallback to membership signal.
		ownerRoleCount = 1
	}

	ok := memberCount > 0 && ownerRoleCount > 0
	return controlCheckResult{
		OK:       ok,
		Evidence: fmt.Sprintf("project_members=%d, owner_roles=%d", memberCount, ownerRoleCount),
	}
}

func (cm *ComplianceManager) checkIncidentResponse(projectID string) controlCheckResult {
	var recentSecurityScans int
	if err := cm.db.QueryRow(`
		SELECT COUNT(*)
		FROM security_scans
		WHERE project_id = $1
		  AND status = 'completed'
		  AND started_at > NOW() - INTERVAL '30 days'
	`, projectID).Scan(&recentSecurityScans); err != nil {
		return controlCheckResult{OK: false, Evidence: fmt.Sprintf("failed to inspect security scans: %v", err)}
	}

	var recentAuditEvents int
	if err := cm.db.QueryRow(`
		SELECT COUNT(*)
		FROM audit_logs
		WHERE (
			(resource = 'project' AND resource_id::text = $1)
			OR details->>'project_id' = $1
		)
		AND created_at > NOW() - INTERVAL '30 days'
	`, projectID).Scan(&recentAuditEvents); err != nil {
		return controlCheckResult{OK: false, Evidence: fmt.Sprintf("failed to inspect audit events: %v", err)}
	}

	ok := recentSecurityScans > 0 && recentAuditEvents > 0
	return controlCheckResult{
		OK: ok,
		Evidence: fmt.Sprintf(
			"completed_scans_30d=%d, audit_events_30d=%d",
			recentSecurityScans,
			recentAuditEvents,
		),
	}
}

func (cm *ComplianceManager) checkDataMinimization(projectID string) controlCheckResult {
	var nonSecretSensitiveVars int
	if err := cm.db.QueryRow(`
		SELECT COUNT(*)
		FROM environment_variables ev
		JOIN services s ON s.id = ev.service_id
		WHERE s.project_id = $1
		  AND COALESCE(ev.is_secret, false) = false
		  AND (
			LOWER(ev.key) LIKE '%password%'
			OR LOWER(ev.key) LIKE '%token%'
			OR LOWER(ev.key) LIKE '%secret%'
			OR LOWER(ev.key) LIKE '%apikey%'
			OR LOWER(ev.key) LIKE '%api_key%'
		  )
	`, projectID).Scan(&nonSecretSensitiveVars); err != nil {
		return controlCheckResult{OK: false, Evidence: fmt.Sprintf("failed to inspect environment variable minimization: %v", err)}
	}

	ok := nonSecretSensitiveVars == 0
	return controlCheckResult{
		OK:       ok,
		Evidence: fmt.Sprintf("non_secret_sensitive_env_vars=%d", nonSecretSensitiveVars),
	}
}

func (cm *ComplianceManager) checkPrivacySettings(projectID string) controlCheckResult {
	var totalPublic int
	if err := cm.db.QueryRow(`
		SELECT COUNT(*)
		FROM services
		WHERE project_id = $1
		  AND COALESCE(public_url, '') <> ''
	`, projectID).Scan(&totalPublic); err != nil {
		return controlCheckResult{OK: false, Evidence: fmt.Sprintf("failed to inspect public endpoints: %v", err)}
	}

	var httpsPublic int
	if err := cm.db.QueryRow(`
		SELECT COUNT(*)
		FROM services
		WHERE project_id = $1
		  AND COALESCE(public_url, '') <> ''
		  AND LOWER(public_url) LIKE 'https://%'
	`, projectID).Scan(&httpsPublic); err != nil {
		return controlCheckResult{OK: false, Evidence: fmt.Sprintf("failed to inspect public endpoint TLS settings: %v", err)}
	}

	var retentionPolicies int
	if err := cm.db.QueryRow(`
		SELECT COUNT(*)
		FROM data_retention_policies
		WHERE enabled = true
	`).Scan(&retentionPolicies); err != nil {
		return controlCheckResult{OK: false, Evidence: fmt.Sprintf("failed to inspect retention policies: %v", err)}
	}

	ok := (totalPublic == 0 || totalPublic == httpsPublic) && retentionPolicies > 0
	return controlCheckResult{
		OK: ok,
		Evidence: fmt.Sprintf(
			"public_services=%d, https_public_services=%d, retention_policies_enabled=%d",
			totalPublic,
			httpsPublic,
			retentionPolicies,
		),
	}
}

func (cm *ComplianceManager) checkGovernance(projectID string) controlCheckResult {
	var reports int
	if err := cm.db.QueryRow(`
		SELECT COUNT(*)
		FROM compliance_reports
		WHERE project_id = $1
		  AND assessment_date > NOW() - INTERVAL '180 days'
	`, projectID).Scan(&reports); err != nil {
		return controlCheckResult{OK: false, Evidence: fmt.Sprintf("failed to inspect compliance reporting cadence: %v", err)}
	}

	var auditEvents int
	if err := cm.db.QueryRow(`
		SELECT COUNT(*)
		FROM audit_logs
		WHERE (
			(resource = 'project' AND resource_id::text = $1)
			OR details->>'project_id' = $1
		)
		AND created_at > NOW() - INTERVAL '90 days'
	`, projectID).Scan(&auditEvents); err != nil {
		return controlCheckResult{OK: false, Evidence: fmt.Sprintf("failed to inspect governance audit trail: %v", err)}
	}

	ok := reports > 0 && auditEvents > 0
	return controlCheckResult{
		OK:       ok,
		Evidence: fmt.Sprintf("compliance_reports_180d=%d, audit_events_90d=%d", reports, auditEvents),
	}
}

func (cm *ComplianceManager) checkBreachNotificationReadiness(projectID string) controlCheckResult {
	var incidentSignals int
	if err := cm.db.QueryRow(`
		SELECT COUNT(*)
		FROM audit_logs
		WHERE (
			(resource = 'project' AND resource_id::text = $1)
			OR details->>'project_id' = $1
		)
		AND (
			LOWER(action) LIKE '%incident%'
			OR LOWER(action) LIKE '%security_%'
			OR LOWER(action) LIKE '%breach%'
		)
		AND created_at > NOW() - INTERVAL '365 days'
	`, projectID).Scan(&incidentSignals); err != nil {
		return controlCheckResult{OK: false, Evidence: fmt.Sprintf("failed to inspect incident/breach logs: %v", err)}
	}

	var scans int
	if err := cm.db.QueryRow(`
		SELECT COUNT(*)
		FROM security_scans
		WHERE project_id = $1
		  AND status = 'completed'
		  AND started_at > NOW() - INTERVAL '90 days'
	`, projectID).Scan(&scans); err != nil {
		return controlCheckResult{OK: false, Evidence: fmt.Sprintf("failed to inspect scan readiness: %v", err)}
	}

	ok := scans > 0 && incidentSignals > 0
	return controlCheckResult{
		OK:       ok,
		Evidence: fmt.Sprintf("security_scans_90d=%d, incident_signals_365d=%d", scans, incidentSignals),
	}
}

func (cm *ComplianceManager) getRiskImpact(control ComplianceControl) string {
	// Extract impact from metadata or default based on category
	var metadata map[string]interface{}
	json.Unmarshal([]byte(control.Metadata), &metadata)

	if impact, ok := metadata["risk_level"].(string); ok {
		return impact
	}

	// Default impact based on category
	switch control.Category {
	case "Security", "Incident Response":
		return "high"
	case "Privacy by Design":
		return "medium"
	default:
		return "low"
	}
}

func (cm *ComplianceManager) getRiskLikelihood(control ComplianceControl) string {
	// Default likelihood based on control complexity
	if strings.Contains(control.Requirement, "implement") || strings.Contains(control.Requirement, "procedures") {
		return "medium"
	}
	return "low"
}

func (cm *ComplianceManager) generateMitigation(control ComplianceControl) string {
	return fmt.Sprintf("Implement and document controls for %s as specified in the requirements", control.Title)
}

// GetComplianceReport retrieves a compliance report by ID
func (cm *ComplianceManager) GetComplianceReport(reportID string) (*ComplianceReport, error) {
	var report ComplianceReport

	err := cm.db.QueryRow(`
		SELECT id, project_id, framework_id, assessment_date, assessor, overall_status, score
		FROM compliance_reports WHERE id = $1
	`, reportID).Scan(&report.ID, &report.ProjectID, &report.FrameworkID, &report.AssessmentDate, &report.Assessor, &report.OverallStatus, &report.Score)

	if err != nil {
		return nil, err
	}

	// Load controls
	controls, err := cm.getFrameworkControls(report.FrameworkID)
	if err == nil {
		report.Controls = controls
	}

	// Load risks
	risks, err := cm.getReportRisks(report.ID)
	if err == nil {
		report.Risks = risks
	}

	return &report, nil
}

// getReportRisks retrieves risks for a compliance report
func (cm *ComplianceManager) getReportRisks(reportID string) ([]ComplianceRisk, error) {
	rows, err := cm.db.Query(`
		SELECT id, control_id, title, description, impact, likelihood, mitigation
		FROM compliance_risks WHERE report_id = $1
	`, reportID)

	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var risks []ComplianceRisk
	for rows.Next() {
		var risk ComplianceRisk
		err := rows.Scan(&risk.ID, &risk.ControlID, &risk.Title, &risk.Description, &risk.Impact, &risk.Likelihood, &risk.Mitigation)
		if err != nil {
			continue
		}
		risks = append(risks, risk)
	}

	return risks, nil
}
