-- +goose Up
ALTER TABLE services ADD COLUMN IF NOT EXISTS spread BOOLEAN NOT NULL DEFAULT false;

-- +goose Down
ALTER TABLE services DROP COLUMN IF EXISTS spread;
