-- +goose Up
-- Routing overrides: per-service Traefik middleware definitions stored as
-- { "middlewares.<name>.<type>.<field>": "value" }. Validated against an
-- allowlist; applied to the service's router and auto-attached to its
-- middleware chain at reconcile time.
ALTER TABLE services ADD COLUMN IF NOT EXISTS traefik_labels jsonb NOT NULL DEFAULT '{}';

-- +goose Down
ALTER TABLE services DROP COLUMN IF EXISTS traefik_labels;
