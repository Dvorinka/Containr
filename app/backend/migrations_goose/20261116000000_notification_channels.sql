-- +goose Up
CREATE TABLE IF NOT EXISTS public.notification_channels (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    kind varchar(20) NOT NULL CHECK (kind IN ('ntfy', 'gotify')),
    endpoint text NOT NULL,
    token varchar(255),
    enabled boolean NOT NULL DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notification_channels_user ON public.notification_channels (user_id);

-- +goose Down
DROP TABLE IF EXISTS public.notification_channels;
