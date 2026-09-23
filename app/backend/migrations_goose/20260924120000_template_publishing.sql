-- +goose Up
-- Railway-style template publishing: owners can mark a user template public so
-- it appears in the anonymous catalog (GET /api/v1/templates) and on the
-- landing page. Official templates stay official; is_public only matters for
-- user templates.
ALTER TABLE public.service_templates ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_service_templates_public ON public.service_templates(is_public) WHERE is_public;

-- +goose Down
DROP INDEX IF EXISTS public.idx_service_templates_public;
ALTER TABLE public.service_templates DROP COLUMN IF EXISTS is_public;
