-- +goose Up
-- +goose StatementBegin
ALTER TABLE database_services
    ADD COLUMN IF NOT EXISTS provider VARCHAR(20) NOT NULL DEFAULT 'managed',
    ADD COLUMN IF NOT EXISTS external_host VARCHAR(255),
    ADD COLUMN IF NOT EXISTS external_port INTEGER,
    ADD COLUMN IF NOT EXISTS external_name VARCHAR(255),
    ADD COLUMN IF NOT EXISTS external_username VARCHAR(255),
    ADD COLUMN IF NOT EXISTS external_password TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS external_ssl BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE database_services
    DROP CONSTRAINT IF EXISTS database_services_plan_check,
    ADD CONSTRAINT database_services_plan_check
        CHECK (plan IN ('hobby', 'starter', 'standard', 'business', 'external'));
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE database_services
    DROP CONSTRAINT IF EXISTS database_services_plan_check,
    ADD CONSTRAINT database_services_plan_check
        CHECK (plan IN ('hobby', 'starter', 'standard', 'business'));

ALTER TABLE database_services
    DROP COLUMN IF EXISTS provider,
    DROP COLUMN IF EXISTS external_host,
    DROP COLUMN IF EXISTS external_port,
    DROP COLUMN IF EXISTS external_name,
    DROP COLUMN IF EXISTS external_username,
    DROP COLUMN IF EXISTS external_password,
    DROP COLUMN IF EXISTS external_ssl;
-- +goose StatementEnd
