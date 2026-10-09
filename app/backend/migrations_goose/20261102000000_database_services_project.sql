-- +goose Up
-- Link managed databases provisioned by graph template deploys / compose
-- imports to their project so deleting the project cleans them up too.
ALTER TABLE database_services
    ADD COLUMN IF NOT EXISTS project_id uuid NULL REFERENCES projects(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_database_services_project_id
    ON database_services(project_id);

-- +goose Down
DROP INDEX IF EXISTS idx_database_services_project_id;
ALTER TABLE database_services DROP COLUMN IF EXISTS project_id;
