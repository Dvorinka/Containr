-- name: GetProjectOwnerText :one
SELECT owner_id::text FROM projects WHERE id = $1;

-- name: ServiceExistsInProject :one
SELECT EXISTS(SELECT 1 FROM services WHERE id = $1 AND project_id = $2);

-- name: ListVulnerabilities :many
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
    found_at DESC;

-- name: UpdateVulnerabilityStatus :exec
UPDATE vulnerabilities SET status = $1, resolved_at = $2 WHERE id = $3;

-- name: ComplianceFrameworkExists :one
SELECT EXISTS(SELECT 1 FROM compliance_frameworks WHERE id = $1);

-- name: ListComplianceFrameworks :many
SELECT id, name, description, version, enabled, created_at
FROM compliance_frameworks
WHERE enabled = true
ORDER BY name;

-- name: GetVulnerabilityMetrics :one
SELECT
    COUNT(*) AS total,
    COUNT(*) FILTER (WHERE severity = 'critical') AS critical,
    COUNT(*) FILTER (WHERE severity = 'high') AS high,
    COUNT(*) FILTER (WHERE severity = 'medium') AS medium,
    COUNT(*) FILTER (WHERE severity = 'low') AS low,
    COUNT(*) FILTER (WHERE status = 'open') AS open,
    COUNT(*) FILTER (WHERE status = 'resolved') AS resolved
FROM vulnerabilities
WHERE project_id = $1;

-- name: GetLatestSecurityScan :one
SELECT id, COALESCE((summary->>'score')::int, 0)::int AS score, started_at AS scanned_at, status
FROM security_scans
WHERE project_id = $1
ORDER BY started_at DESC
LIMIT 1;

-- name: GetLatestComplianceReport :one
SELECT overall_status, score, assessment_date
FROM compliance_reports
WHERE project_id = $1
ORDER BY assessment_date DESC
LIMIT 1;

-- name: CheckSecurityProjectAccess :one
SELECT EXISTS (
    SELECT 1
    FROM projects p
    WHERE p.id = $1
      AND (p.is_approved
           OR $3::bool
           OR p.owner_id = $2 OR EXISTS (
            SELECT 1 FROM project_members pm
            WHERE pm.project_id = p.id AND pm.user_id = $2
      ))
);

-- name: GetSecurityScanProjectID :one
SELECT project_id FROM security_scans WHERE id = $1;

-- name: GetComplianceReportProjectID :one
SELECT project_id FROM compliance_reports WHERE id = $1;

-- name: GetVulnerabilityProjectID :one
SELECT project_id FROM vulnerabilities WHERE id = $1;
