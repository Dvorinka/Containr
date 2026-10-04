-- +goose Up
-- Persisted HA health checks. Previously checks lived only in memory, so a
-- backend restart silently deleted every configured check while services kept
-- running unmonitored.
CREATE TABLE IF NOT EXISTS ha_health_checks (
    id          uuid PRIMARY KEY,
    service_id  uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    node_id     varchar(255) NOT NULL DEFAULT '',
    type        varchar(20) NOT NULL,
    config      jsonb NOT NULL DEFAULT '{}'::jsonb,
    status      varchar(20) NOT NULL DEFAULT 'unknown',
    last_check  timestamptz,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);

-- +goose Down
DROP TABLE IF EXISTS ha_health_checks;
