-- Dedicated build tracking table for /api/v1/builds endpoints.
-- This persists build status across API restarts and supports filtering queries.

CREATE TABLE IF NOT EXISTS builds (
    id VARCHAR(255) PRIMARY KEY,
    project_id VARCHAR(255),
    service_id VARCHAR(255),
    status VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending, running, success, failed, cancelled
    progress INTEGER NOT NULL DEFAULT 0,
    started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    image_name VARCHAR(500) NOT NULL DEFAULT '',
    image_tag VARCHAR(200) NOT NULL DEFAULT '',
    size BIGINT NOT NULL DEFAULT 0,
    error TEXT,
    log TEXT NOT NULL DEFAULT '',
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT builds_progress_range CHECK (progress >= 0 AND progress <= 100)
);

CREATE INDEX IF NOT EXISTS idx_builds_project_id ON builds(project_id);
CREATE INDEX IF NOT EXISTS idx_builds_service_id ON builds(service_id);
CREATE INDEX IF NOT EXISTS idx_builds_status ON builds(status);
CREATE INDEX IF NOT EXISTS idx_builds_created_at_desc ON builds(created_at DESC);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_builds_updated_at') THEN
        CREATE TRIGGER update_builds_updated_at
            BEFORE UPDATE ON builds
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;
