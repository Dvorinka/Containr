-- +goose Up
-- In-app platform settings. Values here override environment variables;
-- secrets (e.g. Cloudflare tunnel token) are flagged and masked in API reads.
CREATE TABLE IF NOT EXISTS public.app_settings (
    key character varying(255) PRIMARY KEY,
    value text NOT NULL DEFAULT '',
    is_secret boolean NOT NULL DEFAULT false,
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;

-- The first registered user owns the platform. Backfill existing installs:
-- the earliest account becomes admin when no admin is set.
UPDATE public.users
SET is_admin = true
WHERE id = (
    SELECT id FROM public.users ORDER BY created_at ASC, id ASC LIMIT 1
)
  AND NOT EXISTS (SELECT 1 FROM public.users WHERE is_admin);

-- +goose Down
ALTER TABLE public.users DROP COLUMN IF EXISTS is_admin;
DROP TABLE IF EXISTS public.app_settings;
