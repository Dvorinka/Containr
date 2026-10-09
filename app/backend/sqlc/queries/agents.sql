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
    auto_prune = $12,
    schedulable = $13,
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

-- name: UpdateContainerPorts :exec
-- Agent reports the real host bindings after create — persist them with
-- the status flip so ingress can route to the assigned port.
UPDATE container_instances SET status = $2, ports = $3, updated_at = NOW()
WHERE id = $1;

-- name: GetLastAgentCommandByType :one
SELECT * FROM agent_commands
WHERE node_agent_id = $1 AND type = $2
ORDER BY created_at DESC LIMIT 1;

-- name: PickLeastLoadedAgent :one
-- Resource-aware: lowest memory utilisation first, then cpu, then container
-- count. Agents without telemetry sort last (NULL → worst score).
SELECT a.id FROM node_agents a
LEFT JOIN LATERAL (
    SELECT h.container_count FROM agent_heartbeats h
    WHERE h.node_agent_id = a.id
    ORDER BY h.timestamp DESC LIMIT 1
) h ON true
WHERE a.status = 'online' AND a.schedulable
ORDER BY
    COALESCE(
        (a.resources->'memory'->>'used')::double precision
        / NULLIF((a.resources->'memory'->>'total')::double precision, 0),
        1.0
    ) ASC,
    COALESCE((a.resources->'cpu'->>'usage')::double precision, 100.0) ASC,
    COALESCE(h.container_count, 0) ASC,
    a.created_at ASC
LIMIT 1;

-- name: ListSchedulableAgents :many
SELECT id, name FROM node_agents
WHERE status = 'online' AND schedulable
ORDER BY id;

-- name: ListSchedulableAgentsMatching :many
-- Only agents carrying every required placement tag (jsonb array containment).
SELECT id, name FROM node_agents
WHERE status = 'online' AND schedulable
  AND tags @> $1::jsonb
ORDER BY id;

-- name: PickLeastLoadedAgentMatching :one
-- Same resource-aware ordering as PickLeastLoadedAgent, restricted to agents
-- carrying every required placement tag.
SELECT a.id FROM node_agents a
LEFT JOIN LATERAL (
    SELECT h.container_count FROM agent_heartbeats h
    WHERE h.node_agent_id = a.id
    ORDER BY h.timestamp DESC LIMIT 1
) h ON true
WHERE a.status = 'online' AND a.schedulable
  AND a.tags @> $1::jsonb
ORDER BY
    COALESCE(
        (a.resources->'memory'->>'used')::double precision
        / NULLIF((a.resources->'memory'->>'total')::double precision, 0),
        1.0
    ) ASC,
    COALESCE((a.resources->'cpu'->>'usage')::double precision, 100.0) ASC,
    COALESCE(h.container_count, 0) ASC,
    a.created_at ASC
LIMIT 1;

-- name: SetAgentTags :exec
UPDATE node_agents SET tags = $2::jsonb, updated_at = NOW() WHERE id = $1;

-- name: ListServiceContainers :many
SELECT id, name, node_agent_id, status, ports FROM container_instances
WHERE service_id = $1;

-- name: SetAgentSchedulable :exec
UPDATE node_agents SET schedulable = $2, updated_at = NOW() WHERE id = $1;

-- name: ClearServiceNodePins :execrows
UPDATE services SET node_id = NULL, updated_at = NOW() WHERE node_id = $1;

-- name: UpsertServiceContainer :exec
INSERT INTO container_instances (
    id, name, image, project_id, service_id, node_agent_id,
    status, resources, ports, environment, volumes, networks,
    restart_policy, health_check
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
ON CONFLICT (id) DO UPDATE SET
    image = EXCLUDED.image,
    status = EXCLUDED.status,
    updated_at = NOW();

-- name: DeleteServiceContainersOnAgent :exec
DELETE FROM container_instances WHERE node_agent_id = $1 AND service_id = $2;

-- name: ListServiceAgents :many
-- Distinct agents holding inventory rows for a service.
SELECT DISTINCT node_agent_id FROM container_instances WHERE service_id = $1;

-- name: ScrubCommandPayload :exec
UPDATE agent_commands SET payload = $2, updated_at = NOW() WHERE id = $1;
