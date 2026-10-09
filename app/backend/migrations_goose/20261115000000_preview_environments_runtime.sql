-- +goose Up
ALTER TABLE public.preview_environments
    ADD COLUMN IF NOT EXISTS preview_service_id uuid REFERENCES public.services(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_preview_environments_expiry
    ON public.preview_environments (expires_at)
    WHERE status NOT IN ('expired', 'stopped');

-- +goose Down
DROP INDEX IF EXISTS public.idx_preview_environments_expiry;
ALTER TABLE public.preview_environments DROP COLUMN IF EXISTS preview_service_id;
