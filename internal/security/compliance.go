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

	// Simulate assessment logic (in real implementation, this would check actual configurations)
	switch control.Code {
	case "GDPR-Art-32":
		// Check security measures
		hasEncryption := cm.checkDataEncryption(projectID)
		hasAccessControl := cm.checkAccessControl(projectID)
		hasIncidentResponse := cm.checkIncidentResponse(projectID)

		if hasEncryption && hasAccessControl && hasIncidentResponse {
			assessed.Status = "compliant"
			assessed.Evidence = "Encryption enabled, access controls configured, incident response procedures documented"
		} else {
			assessed.Status = "non_compliant"
			missing := []string{}
			if !hasEncryption {
				missing = append(missing, "data encryption")
			}
			if !hasAccessControl {
				missing = append(missing, "access controls")
			}
			if !hasIncidentResponse {
				missing = append(missing, "incident response procedures")
			}
			assessed.Evidence = fmt.Sprintf("Missing controls: %s", strings.Join(missing, ", "))
		}

	case "GDPR-Art-25":
		// Check privacy by design
		hasDataMinimization := cm.checkDataMinimization(projectID)
		hasPrivacySettings := cm.checkPrivacySettings(projectID)

		if hasDataMinimization && hasPrivacySettings {
			assessed.Status = "compliant"
			assessed.Evidence = "Privacy by design principles implemented, data minimization configured"
		} else {
			assessed.Status = "non_compliant"
			assessed.Evidence = "Privacy by design principles not fully implemented"
		}

	default:
		// Default assessment for other controls
		assessed.Status = "pending"
		assessed.Evidence = "Assessment pending manual review"
	}

	return assessed
}

// Helper functions for assessment checks (simulated)
func (cm *ComplianceManager) checkDataEncryption(projectID string) bool {
	// Simulate checking encryption settings
	// In real implementation, this would check actual configurations
	return true
}

func (cm *ComplianceManager) checkAccessControl(projectID string) bool {
	// Simulate checking access control
	return true
}

func (cm *ComplianceManager) checkIncidentResponse(projectID string) bool {
	// Simulate checking incident response procedures
	return false // Simulate missing for demo
}

func (cm *ComplianceManager) checkDataMinimization(projectID string) bool {
	return true
}

func (cm *ComplianceManager) checkPrivacySettings(projectID string) bool {
	return false // Simulate missing for demo
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
