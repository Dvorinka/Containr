-- +goose Up
ALTER TABLE public.database_services
    ADD COLUMN IF NOT EXISTS backup_schedule character varying(100),
    ADD COLUMN IF NOT EXISTS next_backup_at timestamp with time zone;

-- +goose Down
ALTER TABLE public.database_services
    DROP COLUMN IF EXISTS backup_schedule,
    DROP COLUMN IF EXISTS next_backup_at;
