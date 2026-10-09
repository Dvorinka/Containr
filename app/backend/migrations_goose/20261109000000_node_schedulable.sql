-- +goose Up
ALTER TABLE node_agents ADD COLUMN IF NOT EXISTS schedulable BOOLEAN NOT NULL DEFAULT true;
CREATE INDEX IF NOT EXISTS idx_node_agents_schedulable ON node_agents(schedulable) WHERE NOT schedulable;

-- +goose Down
DROP INDEX IF EXISTS idx_node_agents_schedulable;
ALTER TABLE node_agents DROP COLUMN IF EXISTS schedulable;
