-- +goose Up
-- +goose StatementBegin
ALTER TABLE services ADD COLUMN IF NOT EXISTS builder varchar(32) NOT NULL DEFAULT 'auto';
ALTER TABLE services ADD COLUMN IF NOT EXISTS cpu_reserve varchar(20) NOT NULL DEFAULT '';
ALTER TABLE services ADD COLUMN IF NOT EXISTS memory_reserve varchar(20) NOT NULL DEFAULT '';
ALTER TABLE services ADD COLUMN IF NOT EXISTS static_build_cmd varchar(255) NOT NULL DEFAULT '';
ALTER TABLE services ADD COLUMN IF NOT EXISTS static_dir varchar(255) NOT NULL DEFAULT '';
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE services DROP COLUMN IF EXISTS static_dir;
ALTER TABLE services DROP COLUMN IF EXISTS static_build_cmd;
ALTER TABLE services DROP COLUMN IF EXISTS memory_reserve;
ALTER TABLE services DROP COLUMN IF EXISTS cpu_reserve;
ALTER TABLE services DROP COLUMN IF EXISTS builder;
-- +goose StatementEnd
