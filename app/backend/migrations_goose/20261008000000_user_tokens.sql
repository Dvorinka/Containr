-- +goose Up
-- Personal access tokens for CLI/MCP/agent authentication.
-- Only sha256 hashes are stored — raw tokens (cnp_…) are shown once at
-- creation and never persisted. Scope gates what the token may do:
-- read = GET/HEAD only, write = all non-admin routes, admin = everything
-- (admin still requires the owning user to be a platform admin).
CREATE TABLE IF NOT EXISTS public.user_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    name character varying(255) NOT NULL,
    key_prefix character varying(16) NOT NULL,
    token_hash text NOT NULL UNIQUE,
    scope character varying(20) NOT NULL DEFAULT 'write'
        CHECK (scope IN ('read', 'write', 'admin')),
    expires_at timestamp with time zone,
    last_used_at timestamp with time zone,
    revoked_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_user_tokens_user_id ON public.user_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_user_tokens_token_hash ON public.user_tokens(token_hash);

-- +goose Down
DROP TABLE IF EXISTS public.user_tokens;
