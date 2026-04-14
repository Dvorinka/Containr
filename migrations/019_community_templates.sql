-- Community template metadata for GitHub-backed template imports.
ALTER TABLE service_templates
    ADD COLUMN IF NOT EXISTS source_type VARCHAR(30) DEFAULT 'official',
    ADD COLUMN IF NOT EXISTS source_repo VARCHAR(500),
    ADD COLUMN IF NOT EXISTS source_branch VARCHAR(255),
    ADD COLUMN IF NOT EXISTS source_path VARCHAR(500),
    ADD COLUMN IF NOT EXISTS source_url VARCHAR(1000),
    ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL;

UPDATE service_templates
SET source_type = CASE WHEN is_official THEN 'official' ELSE COALESCE(source_type, 'community') END
WHERE source_type IS NULL OR source_type = '';

CREATE INDEX IF NOT EXISTS idx_service_templates_source_type ON service_templates(source_type);
CREATE INDEX IF NOT EXISTS idx_service_templates_created_by ON service_templates(created_by);
CREATE INDEX IF NOT EXISTS idx_service_templates_source_repo ON service_templates(source_repo);
