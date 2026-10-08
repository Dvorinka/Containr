-- +goose Up
-- +goose StatementBegin
CREATE TABLE IF NOT EXISTS backup_targets (
    id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    endpoint VARCHAR(512) NOT NULL,
    bucket VARCHAR(255) NOT NULL,
    region VARCHAR(100) NOT NULL DEFAULT '',
    prefix VARCHAR(255) NOT NULL DEFAULT '',
    access_key TEXT NOT NULL DEFAULT '',
    secret_key TEXT NOT NULL DEFAULT '',
    use_tls BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE database_services
    ADD COLUMN IF NOT EXISTS backup_target_id VARCHAR(255);

ALTER TABLE database_backups
    ADD COLUMN IF NOT EXISTS remote_key VARCHAR(512);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE database_backups
    DROP COLUMN IF EXISTS remote_key;

ALTER TABLE database_services
    DROP COLUMN IF EXISTS backup_target_id;

DROP TABLE IF EXISTS backup_targets;
-- +goose StatementEnd
