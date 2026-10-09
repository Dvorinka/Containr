-- +goose Up
-- Placement tags: operators label node_agents (tags jsonb array of strings),
-- services require a tag set (placement_tags). "auto" and spread placement
-- only consider online schedulable agents carrying every required tag.
-- Explicit node_id pins bypass tag filtering — the pin is an operator override.
ALTER TABLE services ADD COLUMN IF NOT EXISTS placement_tags jsonb NOT NULL DEFAULT '[]';
ALTER TABLE node_agents ADD COLUMN IF NOT EXISTS tags jsonb NOT NULL DEFAULT '[]';

-- +goose Down
ALTER TABLE services DROP COLUMN IF EXISTS placement_tags;
ALTER TABLE node_agents DROP COLUMN IF EXISTS tags;
