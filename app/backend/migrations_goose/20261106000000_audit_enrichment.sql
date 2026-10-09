-- +goose Up
ALTER TABLE audit_logs
    ADD COLUMN IF NOT EXISTS severity TEXT NOT NULL DEFAULT 'info',
    ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS label TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_audit_logs_feed
    ON audit_logs (created_at DESC) INCLUDE (severity, category, resource, action);

-- +goose Down
DROP INDEX IF EXISTS idx_audit_logs_feed;
ALTER TABLE audit_logs
    DROP COLUMN IF EXISTS severity,
    DROP COLUMN IF EXISTS category,
    DROP COLUMN IF EXISTS label;
