-- +goose Up
-- Outbound webhooks: user-owned HTTP endpoints that receive signed
-- platform events (resource.action), with a delivery log.
CREATE TABLE IF NOT EXISTS outbound_webhooks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name varchar(255) NOT NULL,
    url varchar(500) NOT NULL,
    secret text NOT NULL DEFAULT '',
    events jsonb NOT NULL DEFAULT '[]'::jsonb,
    headers jsonb,
    enabled boolean NOT NULL DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS webhook_deliveries (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    webhook_id uuid NOT NULL REFERENCES outbound_webhooks(id) ON DELETE CASCADE,
    event varchar(255) NOT NULL,
    payload jsonb,
    status varchar(50) NOT NULL DEFAULT 'pending',
    response_status integer,
    response_body text,
    attempts integer NOT NULL DEFAULT 0,
    duration_ms integer,
    created_at timestamptz DEFAULT now(),
    delivered_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_outbound_webhooks_user ON outbound_webhooks(user_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook ON webhook_deliveries(webhook_id, created_at DESC);

-- +goose Down
DROP TABLE IF EXISTS webhook_deliveries;
DROP TABLE IF EXISTS outbound_webhooks;
