package api

import (
	"context"
	"database/sql"
	"strings"
	"testing"
	"time"

	"containr/internal/database"
	"containr/internal/database/sqlcdb"

	"github.com/google/uuid"
)

// Live invariant test against real Postgres — set METRICS_TEST_DSN (or
// DATABASE_URL). Covers the generated auth/security queries: user upsert
// conflict path, project-access EXISTS predicate, vulnerability ordering and
// status update, latest-scan/report lookups, and the framework list.
func TestSecurityLiveInvariants(t *testing.T) {
	dsn := testDSNString(t)
	db, err := database.NewConnection(dsn)
	if err != nil {
		t.Fatalf("connect: %v", err)
	}
	defer db.Close()
	ctx := context.Background()
	q := sqlcdb.New(db.DB)

	userID := uuid.New()
	otherID := uuid.New()
	projectID := uuid.New()
	envID := uuid.New()
	serviceID := uuid.New()
	scanID := uuid.New()
	reportID := uuid.New()
	frameworkID := uuid.New()
	vulnCrit := uuid.New()
	vulnLow := uuid.New()
	suffix := strings.ReplaceAll(userID.String()[:8], "-", "")
	must := func(err error) {
		t.Helper()
		if err != nil {
			t.Fatalf("setup: %v", err)
		}
	}
	_, err = db.Exec(`INSERT INTO users (id, email, password_hash, name) VALUES ($1, $2, 'x', 'test'), ($3, $4, 'x', 'other')`,
		userID, "sec-"+suffix+"@test.local", otherID, "sec-"+suffix+"-o@test.local")
	must(err)
	_, err = db.Exec(`INSERT INTO projects (id, name, owner_id, is_approved) VALUES ($1, $2, $3, false)`,
		projectID, "sec-"+suffix, userID)
	must(err)
	_, err = db.Exec(`INSERT INTO environments (id, name, project_id) VALUES ($1, 'production', $2)`,
		envID, projectID)
	must(err)
	_, err = db.Exec(`INSERT INTO services (id, name, project_id, environment_id, service_type, source_type)
		VALUES ($1, $2, $3, $4, 'web', 'image')`,
		serviceID, "sec-"+suffix, projectID, envID)
	must(err)
	defer func() { _, _ = db.Exec(`DELETE FROM users WHERE id IN ($1, $2)`, userID, otherID) }()

	// Auth queries: upsert conflicts update rather than error, counts see rows.
	_, err = q.InsertUserAdmin(ctx, sqlcdb.InsertUserAdminParams{
		Email: "ins-" + suffix + "@test.local", PasswordHash: "x", Name: "ins", IsAdmin: false,
	})
	must(err)
	defer func() { _, _ = db.Exec(`DELETE FROM users WHERE email = $1`, "ins-"+suffix+"@test.local") }()
	urow, err := q.UpsertLocalUser(ctx, sqlcdb.UpsertLocalUserParams{
		Email: "ins-" + suffix + "@test.local", PasswordHash: "y", Name: "renamed",
		Column4: "http://img", IsAdmin: false,
	})
	must(err)
	if urow.Name != "renamed" || urow.AvatarUrl != "http://img" {
		t.Fatalf("upsert: %+v", urow)
	}
	byEmail, err := q.GetUserByEmailForAuth(ctx, "ins-"+suffix+"@test.local")
	must(err)
	if byEmail.ID != urow.ID || byEmail.PasswordHash != "x" {
		t.Fatalf("by email: %+v", byEmail)
	}
	count, err := q.CountUsersByEmail(ctx, "ins-"+suffix+"@test.local")
	must(err)
	if count != 1 {
		t.Fatalf("count by email: %d", count)
	}
	byID, err := q.GetUserByID(ctx, urow.ID)
	must(err)
	if byID.Email != "ins-"+suffix+"@test.local" {
		t.Fatalf("by id: %+v", byID)
	}

	// Access predicate: unapproved project is owner/admin/member only.
	ownerAccess, err := q.CheckSecurityProjectAccess(ctx, sqlcdb.CheckSecurityProjectAccessParams{
		ID: projectID, OwnerID: userID, Column3: false,
	})
	must(err)
	if !ownerAccess {
		t.Fatal("owner should have access")
	}
	strangerAccess, err := q.CheckSecurityProjectAccess(ctx, sqlcdb.CheckSecurityProjectAccessParams{
		ID: projectID, OwnerID: otherID, Column3: false,
	})
	must(err)
	if strangerAccess {
		t.Fatal("stranger should not have access")
	}
	adminAccess, err := q.CheckSecurityProjectAccess(ctx, sqlcdb.CheckSecurityProjectAccessParams{
		ID: projectID, OwnerID: otherID, Column3: true,
	})
	must(err)
	if !adminAccess {
		t.Fatal("admin should have access")
	}
	ownerText, err := q.GetProjectOwnerText(ctx, projectID)
	must(err)
	if ownerText != userID.String() {
		t.Fatalf("owner text: %q", ownerText)
	}
	exists, err := q.ServiceExistsInProject(ctx, sqlcdb.ServiceExistsInProjectParams{
		ID: serviceID, ProjectID: projectID,
	})
	must(err)
	if !exists {
		t.Fatal("service should exist in project")
	}

	// Scan/report/vuln rows via raw inserts (fixtures), reads via sqlc.
	_, err = db.Exec(`INSERT INTO security_scans (id, project_id, service_id, scan_type, status, summary, started_at)
		VALUES ($1, $2, $3, 'dependency', 'completed', '{"score": 85}', NOW() - interval '1 hour')`,
		scanID, projectID, serviceID)
	must(err)
	_, err = db.Exec(`INSERT INTO compliance_frameworks (id, name, description, version, enabled)
		VALUES ($1, $2, 'desc', '1.0', true)`,
		frameworkID, "fw-"+suffix)
	must(err)
	defer func() { _, _ = db.Exec(`DELETE FROM compliance_frameworks WHERE id = $1`, frameworkID) }()
	_, err = db.Exec(`INSERT INTO compliance_reports (id, project_id, framework_id, overall_status, score, assessment_date)
		VALUES ($1, $2, $3, 'compliant', 92, NOW() - interval '30 minutes')`,
		reportID, projectID, frameworkID)
	must(err)
	defer func() { _, _ = db.Exec(`DELETE FROM compliance_reports WHERE id = $1`, reportID) }()
	_, err = db.Exec(`INSERT INTO vulnerabilities (id, type, severity, title, description, service_id, project_id, status, found_at)
		VALUES ($1, 'dependency', 'low', 'low-v', 'd', $3, $4, 'open', NOW() - interval '2 hours'),
		       ($2, 'dependency', 'critical', 'crit-v', 'd', $3, $4, 'open', NOW() - interval '1 hour')`,
		vulnLow, vulnCrit, serviceID, projectID)
	must(err)
	defer func() { _, _ = db.Exec(`DELETE FROM vulnerabilities WHERE project_id = $1`, projectID) }()
	defer func() { _, _ = db.Exec(`DELETE FROM security_scans WHERE id = $1`, scanID) }()

	// Severity ordering: critical first.
	vulns, err := q.ListVulnerabilities(ctx, projectID)
	must(err)
	if len(vulns) != 2 || vulns[0].ID != vulnCrit {
		t.Fatalf("vuln ordering: %+v", vulns)
	}
	metrics, err := q.GetVulnerabilityMetrics(ctx, projectID)
	must(err)
	if metrics.Total != 2 || metrics.Critical != 1 || metrics.Low != 1 || metrics.Open != 2 {
		t.Fatalf("metrics: %+v", metrics)
	}
	must(q.UpdateVulnerabilityStatus(ctx, sqlcdb.UpdateVulnerabilityStatusParams{
		Status:     "resolved",
		ResolvedAt: sql.NullTime{Time: time.Now(), Valid: true},
		ID:         vulnCrit,
	}))
	metrics, err = q.GetVulnerabilityMetrics(ctx, projectID)
	must(err)
	if metrics.Open != 1 || metrics.Resolved != 1 {
		t.Fatalf("metrics after resolve: %+v", metrics)
	}

	// Latest scan/report lookups.
	scan, err := q.GetLatestSecurityScan(ctx, projectID)
	must(err)
	if scan.ID != scanID || scan.Score != 85 || scan.Status != "completed" {
		t.Fatalf("latest scan: %+v", scan)
	}
	report, err := q.GetLatestComplianceReport(ctx, projectID)
	must(err)
	if report.OverallStatus != "compliant" || report.Score != 92 {
		t.Fatalf("latest report: %+v", report)
	}

	// Project-ID lookups used by the access guards.
	scanPID, err := q.GetSecurityScanProjectID(ctx, scanID)
	must(err)
	reportPID, err := q.GetComplianceReportProjectID(ctx, reportID)
	must(err)
	vulnPID, err := q.GetVulnerabilityProjectID(ctx, vulnCrit)
	must(err)
	if scanPID != projectID || reportPID != projectID || vulnPID != projectID {
		t.Fatalf("project id lookups: %v %v %v", scanPID, reportPID, vulnPID)
	}

	// Framework list only returns enabled rows.
	frameworks, err := q.ListComplianceFrameworks(ctx)
	must(err)
	found := false
	for _, f := range frameworks {
		if f.ID == frameworkID && f.Enabled {
			found = true
		}
	}
	if !found {
		t.Fatal("enabled framework missing from list")
	}
	frameworkExists, err := q.ComplianceFrameworkExists(ctx, frameworkID)
	must(err)
	if !frameworkExists {
		t.Fatal("framework should exist")
	}
}
