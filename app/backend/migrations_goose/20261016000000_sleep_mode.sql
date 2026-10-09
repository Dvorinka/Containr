-- +goose Up
-- +goose StatementBegin
ALTER TABLE services ADD COLUMN IF NOT EXISTS sleep_enabled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE services ADD COLUMN IF NOT EXISTS sleep_idle_minutes INTEGER NOT NULL DEFAULT 15;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE services DROP COLUMN IF EXISTS sleep_enabled;
ALTER TABLE services DROP COLUMN IF EXISTS sleep_idle_minutes;
-- +goose StatementEnd
