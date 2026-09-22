-- +goose Up
-- Public platform model: projects are browsable without a session once the
-- admin approves them; service_templates gains ownership for user templates.
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS is_approved boolean NOT NULL DEFAULT false;

-- Projects that already exist stay live; only newly created ones enter the
-- approval queue.
UPDATE public.projects SET is_approved = true;

ALTER TABLE public.service_templates ADD COLUMN IF NOT EXISTS owner_id uuid;
CREATE INDEX IF NOT EXISTS idx_service_templates_owner ON public.service_templates(owner_id);

-- +goose Down
ALTER TABLE public.projects DROP COLUMN IF EXISTS is_approved;
DROP INDEX IF EXISTS public.idx_service_templates_owner;
ALTER TABLE public.service_templates DROP COLUMN IF EXISTS owner_id;
