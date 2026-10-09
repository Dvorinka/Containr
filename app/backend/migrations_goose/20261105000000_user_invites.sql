-- +goose Up
-- Team invites: admin-generated single-use links that let a new user
-- register even while public signup is closed. Tokens are sha256-hashed
-- at rest like PATs.
CREATE TABLE IF NOT EXISTS user_invites (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    token_hash varchar(64) NOT NULL UNIQUE,
    email varchar(255),
    created_by uuid REFERENCES users(id) ON DELETE SET NULL,
    expires_at timestamptz NOT NULL,
    used_by uuid REFERENCES users(id) ON DELETE SET NULL,
    used_at timestamptz,
    created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_invites_expires ON user_invites(expires_at);

-- +goose Down
DROP TABLE IF EXISTS user_invites;
