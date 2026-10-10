-- name: CountDeploymentsForService :one
SELECT COUNT(*) FROM deployments WHERE service_id = $1;

-- name: ListDeploymentsForService :many
SELECT id, service_id, commit_hash, status, image_name, image_tag,
       build_log, runtime_log, error, started_at, completed_at, created_at, updated_at
FROM deployments
WHERE service_id = $1
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;

-- name: CountAccessibleDeployments :one
SELECT COUNT(*)
FROM deployments d
JOIN services s ON s.id = d.service_id
JOIN projects p ON p.id = s.project_id
WHERE p.is_approved OR p.owner_id = $1 OR $2::bool
   OR EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = $1);

-- name: ListRecentAccessibleDeployments :many
SELECT d.id, d.service_id, s.name AS service_name, p.name AS project_name, d.status,
       COALESCE(d.image_name, '') AS image_name, d.started_at, d.completed_at, d.created_at
FROM deployments d
JOIN services s ON s.id = d.service_id
JOIN projects p ON p.id = s.project_id
WHERE p.is_approved OR p.owner_id = $1 OR $2::bool
   OR EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = $1)
ORDER BY d.created_at DESC
LIMIT $3 OFFSET $4;

-- name: GetServiceForDeployWithOwner :one
SELECT s.id, s.project_id, s.name, s.type, s.status, s.image, s.command,
       s.environment, s.git_repo, s.git_branch, s.build_path, s.cpu, s.memory,
       COALESCE(s.replicas, 1) AS replicas, COALESCE(s.port, 0) AS port,
       COALESCE(s.domain, '') AS domain, COALESCE(s.healthcheck_path, '') AS healthcheck_path,
       COALESCE(s.restart_policy, 'unless-stopped') AS restart_policy,
       COALESCE(s.builder, 'auto') AS builder, COALESCE(s.cpu_reserve, '') AS cpu_reserve,
       COALESCE(s.memory_reserve, '') AS memory_reserve, COALESCE(s.static_build_cmd, '') AS static_build_cmd,
       COALESCE(s.static_dir, '') AS static_dir,
       s.created_at, s.updated_at, p.owner_id
FROM services s
JOIN projects p ON s.project_id = p.id
WHERE s.id = $1;

-- name: InsertDeployment :exec
INSERT INTO deployments
    (id, service_id, version, commit_hash, status, image_name, image_tag, created_at, updated_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9);

-- name: FailDeployment :exec
UPDATE deployments
SET status = 'failed', error = $1, completed_at = $2, updated_at = $2
WHERE id = $3;

-- name: CompleteDeployment :exec
UPDATE deployments
SET status = $1, error = $2, completed_at = $3, updated_at = $3
WHERE id = $4;

-- name: SetDeploymentStatus :exec
UPDATE deployments SET status = $1, updated_at = $2 WHERE id = $3;

-- name: SetServiceStatus :exec
UPDATE services SET status = $1, updated_at = $2 WHERE id = $3;

-- name: SyncDeploymentProgress :exec
UPDATE deployments
SET status = $1,
    image_name = $2,
    image_tag = $3,
    build_log = $4,
    runtime_log = $5,
    error = $6,
    started_at = $7,
    completed_at = $8,
    updated_at = $9
WHERE id = $10;

-- name: GetDeploymentAccess :one
SELECT d.status, d.service_id, p.owner_id
FROM deployments d
JOIN services s ON d.service_id = s.id
JOIN projects p ON s.project_id = p.id
WHERE d.id = $1;

-- name: GetDeploymentWithProject :one
SELECT d.id, d.service_id, d.commit_hash, d.status, d.image_name, d.image_tag,
       d.build_log, d.runtime_log, d.error, d.started_at, d.completed_at,
       d.created_at, d.updated_at, p.id AS project_id
FROM deployments d
JOIN services s ON d.service_id = s.id
JOIN projects p ON s.project_id = p.id
WHERE d.id = $1;

-- name: GetDeploymentForRollback :one
SELECT d.id, d.service_id, d.commit_hash, d.status, d.image_name, d.image_tag,
       d.build_log, d.runtime_log, d.error, d.started_at, d.completed_at,
       d.created_at, d.updated_at, p.owner_id
FROM deployments d
JOIN services s ON d.service_id = s.id
JOIN projects p ON s.project_id = p.id
WHERE d.id = $1;

-- name: GetServicePublishedPort :one
SELECT published_port FROM services WHERE id = $1;
