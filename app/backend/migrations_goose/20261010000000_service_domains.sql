-- +goose Up
-- Multi-domain support. services.domain stays as the derived default for
-- compatibility; service_domains is the source of truth for the full
-- hostname set. Backfills existing services.domain rows as defaults.
CREATE TABLE IF NOT EXISTS service_domains (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    service_id uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    domain varchar(255) NOT NULL,
    is_default boolean NOT NULL DEFAULT false,
    cert_type varchar(32) NOT NULL DEFAULT 'letsencrypt',
    cert_status varchar(32) NOT NULL DEFAULT 'pending',
    last_checked_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (service_id, domain)
);
CREATE INDEX IF NOT EXISTS idx_service_domains_service ON service_domains(service_id);

INSERT INTO service_domains (service_id, domain, is_default)
    SELECT id, domain, true FROM services WHERE domain <> '' AND domain IS NOT NULL
    ON CONFLICT (service_id, domain) DO NOTHING;

-- Access control: maintenance mode redirects to a platform page; basic auth
-- gates the route behind htpasswd-format user:hash pairs (Traefik middleware).
ALTER TABLE services ADD COLUMN IF NOT EXISTS maintenance_mode boolean NOT NULL DEFAULT false;
ALTER TABLE services ADD COLUMN IF NOT EXISTS basic_auth_users text NOT NULL DEFAULT '';

-- +goose Down
ALTER TABLE services DROP COLUMN IF EXISTS maintenance_mode;
ALTER TABLE services DROP COLUMN IF EXISTS basic_auth_users;
DROP TABLE IF EXISTS service_domains;
