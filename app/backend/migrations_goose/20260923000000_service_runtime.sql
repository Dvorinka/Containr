-- +goose Up
-- Runtime spec for Railway-style services: replica count, the container port
-- to expose, an optional public domain routed via Traefik, healthcheck path
-- and restart policy.
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS replicas integer NOT NULL DEFAULT 1;
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS port integer NOT NULL DEFAULT 0;
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS domain character varying(500) NOT NULL DEFAULT '';
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS healthcheck_path character varying(500) NOT NULL DEFAULT '';
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS restart_policy character varying(50) NOT NULL DEFAULT 'unless-stopped';

-- +goose Down
ALTER TABLE public.services DROP COLUMN IF EXISTS replicas;
ALTER TABLE public.services DROP COLUMN IF EXISTS port;
ALTER TABLE public.services DROP COLUMN IF EXISTS domain;
ALTER TABLE public.services DROP COLUMN IF EXISTS healthcheck_path;
ALTER TABLE public.services DROP COLUMN IF EXISTS restart_policy;
