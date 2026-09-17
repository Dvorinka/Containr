-- +goose Up
CREATE TABLE IF NOT EXISTS scaling_policies (
    service_id          uuid PRIMARY KEY REFERENCES services(id) ON DELETE CASCADE,
    min_replicas        integer NOT NULL DEFAULT 1,
    max_replicas        integer NOT NULL DEFAULT 1,
    target_cpu          double precision NOT NULL DEFAULT 0,
    target_memory       double precision NOT NULL DEFAULT 0,
    scale_up_cooldown   bigint NOT NULL DEFAULT 0,
    scale_down_cooldown bigint NOT NULL DEFAULT 0,
    scale_up_step       integer NOT NULL DEFAULT 1,
    scale_down_step     integer NOT NULL DEFAULT 1,
    metrics             jsonb,
    thresholds          jsonb,
    enabled             boolean NOT NULL DEFAULT true,
    cost_optimization   jsonb,
    updated_at          timestamptz NOT NULL DEFAULT now()
);

-- +goose Down
DROP TABLE IF EXISTS scaling_policies;
