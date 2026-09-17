-- name: GetAgentByHostAndIP :one
SELECT * FROM node_agents
WHERE hostname = $1 AND ip_address = $2
LIMIT 1;

-- name: GetAgent :one
SELECT * FROM node_agents WHERE id = $1;

-- name: ListAgents :many
SELECT * FROM node_agents ORDER BY created_at ASC;

-- name: CreateAgent :one
INSERT INTO node_agents (
    id, name, hostname, ip_address, port, status, version,
    capabilities, resources, last_heartbeat, metadata
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
RETURNING *;

-- name: UpdateAgent :one
UPDATE node_agents SET
    name = $2,
    hostname = $3,
    ip_address = $4,
    port = $5,
    status = $6,
    version = $7,
    capabilities = $8,
    resources = $9,
    last_heartbeat = $10,
    metadata = $11,
    updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: UpdateAgentHeartbeat :exec
UPDATE node_agents SET
    status = $2,
    resources = $3,
    last_heartbeat = $4,
    updated_at = NOW()
WHERE id = $1;

-- name: DeleteAgent :exec
DELETE FROM node_agents WHERE id = $1;

-- name: InsertAgentHeartbeat :exec
INSERT INTO agent_heartbeats (
    id, node_agent_id, timestamp, status, resources,
    container_count, system_load, uptime, version
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9);

-- name: ListAgentHeartbeatsSince :many
SELECT * FROM agent_heartbeats
WHERE node_agent_id = $1 AND timestamp >= $2
ORDER BY timestamp ASC;

-- name: ListPendingCommands :many
SELECT * FROM agent_commands
WHERE node_agent_id = $1 AND status = 'pending'
ORDER BY created_at ASC
LIMIT 25;

-- name: ListCommandsForAgent :many
SELECT * FROM agent_commands
WHERE node_agent_id = $1
ORDER BY created_at DESC;

-- name: GetCommandForAgent :one
SELECT * FROM agent_commands
WHERE id = $1 AND node_agent_id = $2;

-- name: CreateCommand :one
INSERT INTO agent_commands (
    id, type, node_agent_id, container_id, payload, status
) VALUES ($1, $2, $3, $4, $5, 'pending')
RETURNING *;

-- name: CompleteCommand :one
UPDATE agent_commands SET
    status = $3,
    result = $4,
    error = $5,
    completed_at = NOW(),
    updated_at = NOW()
WHERE id = $1 AND node_agent_id = $2
RETURNING *;

-- name: ListContainersForAgent :many
SELECT * FROM container_instances
WHERE node_agent_id = $1;

-- name: GetContainerForAgent :one
SELECT * FROM container_instances
WHERE id = $1 AND node_agent_id = $2;

-- name: GetContainer :one
SELECT * FROM container_instances WHERE id = $1;

-- name: CreateContainer :one
INSERT INTO container_instances (
    id, name, image, project_id, service_id, node_agent_id,
    status, resources, ports, environment, volumes, networks,
    restart_policy, health_check
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
RETURNING *;

-- name: UpdateContainerStatus :exec
UPDATE container_instances SET status = $2, updated_at = NOW()
WHERE id = $1;
