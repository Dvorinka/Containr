-- name: ListNodeAgentsForService :many
SELECT DISTINCT node_agent_id FROM container_instances WHERE service_id = $1;

-- name: ListServiceVariableValues :many
SELECT key, value FROM environment_variables WHERE service_id = $1;

-- name: ListServiceVariablesWithSecret :many
SELECT key, value, COALESCE(is_secret, false) AS is_secret
FROM environment_variables WHERE service_id = $1;

-- name: ListProjectServiceRefs :many
SELECT id, name FROM services WHERE project_id = $1;

-- name: GetServicePort :one
SELECT COALESCE(port, 0) AS port FROM services WHERE id = $1;

-- name: GetServiceVariableValue :one
SELECT value FROM environment_variables WHERE service_id = $1 AND key = $2;

-- name: GetServiceRuntimeWithOwner :one
SELECT s.id, s.project_id, s.name,
       COALESCE(s.type, s.service_type, '') AS type, COALESCE(s.status, '') AS status,
       COALESCE(s.image, s.image_name, '') AS image, COALESCE(s.command, s.start_command, '') AS command,
       COALESCE(s.environment, '') AS environment, COALESCE(s.git_repo, s.source_url, '') AS git_repo,
       COALESCE(s.git_branch, '') AS git_branch, COALESCE(s.build_path, '') AS build_path,
       COALESCE(s.cpu, '') AS cpu, COALESCE(s.memory, '') AS memory,
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

-- name: GetLastDeployedImage :one
SELECT (image_name || ':' || image_tag)::text AS image FROM deployments
WHERE service_id = $1 AND status = 'deployed' AND image_name <> ''
ORDER BY created_at DESC LIMIT 1;

-- name: SetServicePublishedPort :exec
UPDATE services SET published_port = $1 WHERE id = $2 AND published_port <> $1;

-- name: SetServiceReplicas :exec
UPDATE services SET replicas = $1, updated_at = $2 WHERE id = $3;

-- name: ListSleepCandidates :many
SELECT id, project_id, name, COALESCE(status,'') AS status,
       COALESCE(sleep_idle_minutes, 15) AS sleep_idle_minutes
FROM services
WHERE sleep_enabled AND COALESCE(status,'') IN ('running','deployed','degraded','starting');

-- name: GetServiceDomainText :one
SELECT COALESCE(domain,'') AS domain FROM services WHERE id = $1;

-- name: GetServiceStatusText :one
SELECT COALESCE(status,'') AS status FROM services WHERE id = $1;
