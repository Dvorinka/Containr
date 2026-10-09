-- +goose Up
-- Per-node base domain: services pinned/spread onto an agent with
-- default_domain get auto-generated hostnames (<service>.<domain>) when
-- they have no explicit service_domains rows.
ALTER TABLE node_agents ADD COLUMN IF NOT EXISTS default_domain VARCHAR(255) NOT NULL DEFAULT '';

-- +goose Down
ALTER TABLE node_agents DROP COLUMN IF EXISTS default_domain;
