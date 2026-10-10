-- name: ListPreviewEnvironmentsForProject :many
SELECT pe.id, pe.project_id, pe.service_id, pe.preview_service_id, pe.branch_name, pe.pr_number,
       pe.environment, pe.status, pe.url, pe.expires_at, pe.created_at, pe.updated_at,
       s.id AS svc_id, s.name AS service_name, s.type AS service_type
FROM preview_environments pe
LEFT JOIN services s ON pe.service_id = s.id
WHERE pe.project_id = $1
ORDER BY pe.created_at DESC;

-- name: GetPreviewEnvironment :one
SELECT pe.id, pe.project_id, pe.service_id, pe.preview_service_id, pe.branch_name, pe.pr_number,
       pe.environment, pe.status, pe.url, pe.expires_at, pe.created_at, pe.updated_at,
       s.id AS svc_id, s.name AS service_name, s.type AS service_type
FROM preview_environments pe
LEFT JOIN services s ON pe.service_id = s.id
JOIN projects p ON pe.project_id = p.id
WHERE pe.id = $1 AND (p.is_approved OR p.owner_id = $2 OR $3::bool
    OR EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = $2));

-- name: GetPreviewEnvironmentForWrite :one
SELECT pe.id, pe.project_id, pe.service_id, pe.branch_name, pe.pr_number,
       pe.environment, pe.status, pe.url, pe.expires_at, pe.created_at, pe.updated_at
FROM preview_environments pe
JOIN projects p ON pe.project_id = p.id
WHERE pe.id = $1 AND (p.owner_id = $2 OR $3::bool);

-- name: GetPreviewEnvironmentForPromote :one
SELECT pe.id, pe.project_id, pe.service_id, pe.preview_service_id, pe.branch_name, pe.environment, pe.status
FROM preview_environments pe
JOIN projects p ON pe.project_id = p.id
WHERE pe.id = $1 AND (p.owner_id = $2 OR $3::bool);

-- name: GetPreviewEnvironmentOwner :one
SELECT p.owner_id
FROM preview_environments pe
JOIN projects p ON pe.project_id = p.id
WHERE pe.id = $1;

-- name: GetPreviewServiceID :one
SELECT preview_service_id FROM preview_environments WHERE id = $1;

-- name: UpdatePreviewEnvironment :exec
UPDATE preview_environments
SET status = $1, url = $2, expires_at = $3, updated_at = $4
WHERE id = $5;

-- name: MarkPreviewEnvironmentStatus :exec
UPDATE preview_environments SET status = $1, updated_at = NOW() WHERE id = $2;

-- name: DeletePreviewEnvironment :exec
DELETE FROM preview_environments WHERE id = $1;

-- name: CountActivePreviewsForBranch :one
SELECT COUNT(*) FROM preview_environments
WHERE service_id = $1 AND branch_name = $2 AND status NOT IN ('expired', 'stopped');

-- name: CreatePreviewEnvironment :exec
INSERT INTO preview_environments
    (id, project_id, service_id, preview_service_id, branch_name, pr_number, environment,
     status, url, expires_at, created_at, updated_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12);

-- name: UpdateServicePreviewBranch :exec
UPDATE services SET git_branch = $1, domain = '', updated_at = NOW() WHERE id = $2;

-- name: DeleteAllServiceDomains :exec
DELETE FROM service_domains WHERE service_id = $1;

-- name: CreatePreviewDomain :exec
INSERT INTO service_domains (service_id, domain, is_default, cert_type) VALUES ($1, $2, true, 'tls');

-- name: InsertPendingDeployment :exec
INSERT INTO deployments (id, service_id, version, commit_hash, status, created_at, updated_at)
VALUES ($1, $2, $3, $4, 'pending', NOW(), NOW());

-- name: ListExpiredPreviewsForUser :many
SELECT pe.id, pe.project_id, pe.service_id, pe.preview_service_id, pe.branch_name, pe.environment
FROM preview_environments pe
JOIN projects p ON pe.project_id = p.id
WHERE (p.owner_id = $1 OR $2::bool) AND pe.expires_at < NOW() AND pe.status != 'expired';

-- name: ListSweepablePreviews :many
SELECT id, preview_service_id FROM preview_environments
WHERE expires_at < NOW() AND status NOT IN ('expired', 'stopped');

-- name: SyncPreviewStatuses :exec
UPDATE preview_environments pe
SET status = derived.st, updated_at = NOW()
FROM (
    SELECT pe2.id,
        CASE
            WHEN s.status IN ('running', 'deployed') THEN 'running'
            WHEN s.status IN ('failed', 'error') THEN 'failed'
            WHEN s.status IN ('building', 'deploying', 'queued', 'pending', 'cloning') THEN 'building'
            ELSE pe2.status
        END AS st
    FROM preview_environments pe2
    JOIN services s ON pe2.preview_service_id = s.id
) derived
WHERE pe.id = derived.id
  AND pe.status IN ('building', 'running', 'failed')
  AND pe.status <> derived.st;

-- name: GetProjectBrief :one
SELECT id, name, owner_id FROM projects WHERE id = $1;

-- name: GetServiceTypeBrief :one
SELECT id, name, COALESCE(type, service_type, '') AS service_type FROM services WHERE id = $1 AND project_id = $2;

-- name: GetServiceForDeploy :one
SELECT s.id, s.project_id, s.name, s.type, s.status, s.image, s.command,
       s.environment, s.git_repo, s.git_branch, s.build_path, s.cpu, s.memory,
       COALESCE(s.replicas, 1) AS replicas, COALESCE(s.port, 0) AS port,
       COALESCE(s.domain, '') AS domain, COALESCE(s.healthcheck_path, '') AS healthcheck_path,
       COALESCE(s.restart_policy, 'unless-stopped') AS restart_policy,
       COALESCE(s.builder, 'auto') AS builder, COALESCE(s.cpu_reserve, '') AS cpu_reserve,
       COALESCE(s.memory_reserve, '') AS memory_reserve, COALESCE(s.static_build_cmd, '') AS static_build_cmd,
       COALESCE(s.static_dir, '') AS static_dir,
       s.created_at, s.updated_at
FROM services s
WHERE s.id = $1;
