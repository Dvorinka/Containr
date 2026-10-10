-- name: GetServiceSleep :one
SELECT COALESCE(sleep_enabled, false) AS sleep_enabled, COALESCE(sleep_idle_minutes, 15) AS sleep_idle_minutes
FROM services WHERE id = $1;

-- name: GetServiceNodeID :one
SELECT node_id FROM services WHERE id = $1;

-- name: GetServiceSpread :one
SELECT COALESCE(spread, false) FROM services WHERE id = $1;

-- name: GetServicePlacementTags :one
SELECT placement_tags FROM services WHERE id = $1;

-- name: GetServiceTraefikLabels :one
SELECT traefik_labels FROM services WHERE id = $1;

-- name: GetServiceVolumes :one
SELECT volumes FROM services WHERE id = $1;

-- name: GetNodeAgentName :one
SELECT name FROM node_agents WHERE id = $1;

-- name: GetServiceProjectID :one
SELECT project_id FROM services WHERE id = $1;

-- name: GetServiceProjectAndStatus :one
SELECT s.project_id, COALESCE(s.status, '') AS status
FROM services s WHERE s.id = $1;

-- name: GetEnvironmentProjectID :one
SELECT project_id FROM environments WHERE id = $1;

-- name: GetProjectReadAccess :one
SELECT is_approved, owner_id::text FROM projects WHERE id = $1;

-- name: ProjectMemberExists :one
SELECT EXISTS(SELECT 1 FROM project_members WHERE project_id = $1 AND user_id = $2);

-- name: DeleteEnvVarsForService :exec
DELETE FROM environment_variables WHERE service_id = $1;

-- name: FailInterruptedDeployments :exec
UPDATE deployments SET status = 'failed', error = 'Interrupted by server restart', completed_at = NOW(), updated_at = NOW()
WHERE status IN ('queued', 'pending', 'building', 'deploying', 'rolling_back');

-- name: ListSecretEnvVars :many
SELECT id, value FROM environment_variables WHERE is_secret = TRUE;

-- name: UpdateEnvVarValue :exec
UPDATE environment_variables SET value = $1, updated_at = NOW() WHERE id = $2;

-- name: ListAgentHealthRows :many
SELECT id, COALESCE(name, hostname, id::text) AS name, COALESCE(status, '') AS status,
       COALESCE(last_heartbeat < $1, TRUE)::bool AS stale, auto_prune
FROM node_agents;

-- name: SetAgentStatus :exec
UPDATE node_agents SET status = $1, updated_at = NOW() WHERE id = $2;

-- name: GetServiceNameProjectPort :one
SELECT name, project_id::text, COALESCE(port, 0)::int AS port
FROM services WHERE id::text = $1;
