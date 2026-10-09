-- +goose Up
-- +goose StatementBegin
ALTER TABLE database_services
    ADD COLUMN IF NOT EXISTS public_port BOOLEAN NOT NULL DEFAULT false;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE database_services
    DROP COLUMN IF EXISTS public_port;
-- +goose StatementEnd
