-- +goose Up
CREATE TABLE IF NOT EXISTS agent_heartbeats (
    id VARCHAR(255) PRIMARY KEY,
    node_agent_id VARCHAR(255) NOT NULL REFERENCES node_agents(id) ON DELETE CASCADE,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status VARCHAR(50) NOT NULL DEFAULT 'unknown',
    resources JSONB NOT NULL DEFAULT '{}'::jsonb,
    container_count INTEGER NOT NULL DEFAULT 0,
    system_load JSONB NOT NULL DEFAULT '{}'::jsonb,
    uptime BIGINT NOT NULL DEFAULT 0,
    version VARCHAR(50) NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_heartbeats_node_agent_id ON agent_heartbeats(node_agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_heartbeats_timestamp ON agent_heartbeats(timestamp);
CREATE INDEX IF NOT EXISTS idx_agent_heartbeats_node_timestamp ON agent_heartbeats(node_agent_id, timestamp DESC);

-- +goose Down
DROP TABLE IF EXISTS agent_heartbeats;
