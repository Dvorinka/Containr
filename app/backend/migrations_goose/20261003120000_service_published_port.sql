-- +goose Up
-- Stable public host port for service replica 0. 0 means "not yet assigned";
-- the runtime writes the ephemeral port it picked back here so restarts and
-- redeploys keep the same public endpoint instead of churning.
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS published_port integer NOT NULL DEFAULT 0;

-- +goose Down
ALTER TABLE public.services DROP COLUMN IF EXISTS published_port;
