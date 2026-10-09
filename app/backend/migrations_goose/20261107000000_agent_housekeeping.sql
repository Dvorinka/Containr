-- +goose Up
ALTER TABLE node_agents ADD COLUMN IF NOT EXISTS auto_prune BOOLEAN NOT NULL DEFAULT false;

-- +goose Down
ALTER TABLE node_agents DROP COLUMN IF EXISTS auto_prune;
