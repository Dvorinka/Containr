-- +goose Up
-- Baseline migration for goose-managed schema evolution.
SELECT 1;

-- +goose Down
-- Baseline down migration intentionally does not mutate schema.
SELECT 1;
