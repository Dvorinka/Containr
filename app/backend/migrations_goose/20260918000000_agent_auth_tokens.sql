-- +goose Up
-- Per-agent onboarding tokens. Hash (sha256 hex) is stored, never the raw token;
-- the raw value is shown once at creation time.
CREATE TABLE IF NOT EXISTS public.agent_auth_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    token_hash text NOT NULL,
    label character varying(255) DEFAULT '' NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    last_used_at timestamp with time zone,
    revoked_at timestamp with time zone,
    CONSTRAINT agent_auth_tokens_pkey PRIMARY KEY (id),
    CONSTRAINT agent_auth_tokens_token_hash_key UNIQUE (token_hash)
);

CREATE INDEX IF NOT EXISTS idx_agent_auth_tokens_active
    ON public.agent_auth_tokens (token_hash)
    WHERE revoked_at IS NULL;

-- +goose Down
DROP TABLE IF EXISTS public.agent_auth_tokens;
