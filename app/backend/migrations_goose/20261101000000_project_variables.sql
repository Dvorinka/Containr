-- +goose Up
-- Project-level shared variables (Railway-style). Services reference them via
-- ${{shared.KEY}} in environment values; secret entries are encrypted at rest
-- and masked in API responses exactly like service variables.
CREATE TABLE IF NOT EXISTS project_variables (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    key varchar(255) NOT NULL,
    value text NOT NULL DEFAULT '',
    is_secret boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (project_id, key)
);

CREATE INDEX IF NOT EXISTS idx_project_variables_project ON project_variables(project_id);

-- +goose Down
DROP TABLE IF EXISTS project_variables;
