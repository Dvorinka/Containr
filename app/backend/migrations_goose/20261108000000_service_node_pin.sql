-- +goose Up
ALTER TABLE services ADD COLUMN IF NOT EXISTS node_id VARCHAR(255);

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'services_node_id_fkey') THEN
        ALTER TABLE services
            ADD CONSTRAINT services_node_id_fkey
            FOREIGN KEY (node_id) REFERENCES node_agents(id) ON DELETE SET NULL;
    END IF;
END $$;
-- +goose StatementEnd

CREATE INDEX IF NOT EXISTS idx_services_node_id ON services (node_id) WHERE node_id IS NOT NULL;

-- +goose Down
DROP INDEX IF EXISTS idx_services_node_id;
ALTER TABLE services DROP COLUMN IF EXISTS node_id;
