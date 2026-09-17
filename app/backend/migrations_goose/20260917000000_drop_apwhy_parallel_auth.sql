-- +goose Up
-- Removes APwhy's parallel auth/RBAC schema and leftover integration tables.
-- Better Auth owns identity; Containr owns audit logs and database services.
-- All statements are idempotent so this is a no-op on fresh installs.

ALTER TABLE public.users
    DROP COLUMN IF EXISTS enabled,
    DROP COLUMN IF EXISTS force_password_reset,
    DROP COLUMN IF EXISTS last_login_at;

DROP TABLE IF EXISTS public.user_roles;
DROP TABLE IF EXISTS public.role_permissions;
DROP TABLE IF EXISTS public.permissions;
DROP TABLE IF EXISTS public.roles;
DROP TABLE IF EXISTS public.password_resets;
DROP TABLE IF EXISTS public.invites;
DROP TABLE IF EXISTS public.sessions;
DROP TABLE IF EXISTS public.audit_log;
DROP TABLE IF EXISTS public.database_connections;
DROP TABLE IF EXISTS public.umami_sync_cache;

-- Legacy filename-tracked migration bookkeeping; goose_db_version supersedes it.
DROP TABLE IF EXISTS public.migrations;

-- +goose Down
-- The dropped schema was dead weight from the APwhy vendor import and is not
-- recreated on rollback.
SELECT 1;
