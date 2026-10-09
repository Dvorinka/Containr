-- +goose Up
-- Instance-wide announcement banners. Admins create them; active ones are
-- shown to every signed-in user in the web UI and surfaced in the CLI.
CREATE TABLE IF NOT EXISTS banners (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title varchar(255) NOT NULL,
    body text NOT NULL DEFAULT '',
    level varchar(20) NOT NULL DEFAULT 'info',
    active boolean NOT NULL DEFAULT true,
    dismissible boolean NOT NULL DEFAULT true,
    created_by uuid REFERENCES users(id) ON DELETE SET NULL,
    starts_at timestamptz,
    ends_at timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_banners_active ON banners(active);

-- +goose Down
DROP TABLE IF EXISTS banners;
