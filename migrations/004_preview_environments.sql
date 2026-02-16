-- Add preview environments table
CREATE TABLE IF NOT EXISTS preview_environments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    branch_name VARCHAR(255) NOT NULL,
    pr_number INTEGER, -- Optional: Pull request number if applicable
    environment VARCHAR(255) NOT NULL UNIQUE, -- e.g., preview-feature-branch-20240101-120000
    status VARCHAR(50) NOT NULL DEFAULT 'building' CHECK (status IN ('building', 'running', 'failed', 'stopped', 'expired')),
    url TEXT, -- Preview environment URL
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_preview_environments_project_id ON preview_environments(project_id);
CREATE INDEX IF NOT EXISTS idx_preview_environments_service_id ON preview_environments(service_id);
CREATE INDEX IF NOT EXISTS idx_preview_environments_branch_name ON preview_environments(branch_name);
CREATE INDEX IF NOT EXISTS idx_preview_environments_status ON preview_environments(status);
CREATE INDEX IF NOT EXISTS idx_preview_environments_expires_at ON preview_environments(expires_at);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_preview_environments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER preview_environments_updated_at
    BEFORE UPDATE ON preview_environments
    FOR EACH ROW
    EXECUTE FUNCTION update_preview_environments_updated_at();

-- Add unique constraint to prevent duplicate preview environments for same service and branch
CREATE UNIQUE INDEX IF NOT EXISTS idx_preview_environments_unique_active 
ON preview_environments(service_id, branch_name) 
WHERE status NOT IN ('expired', 'stopped');

-- Add comments for documentation
COMMENT ON TABLE preview_environments IS 'Preview environments for branch-based deployments';
COMMENT ON COLUMN preview_environments.id IS 'Unique identifier for the preview environment';
COMMENT ON COLUMN preview_environments.project_id IS 'Reference to the project';
COMMENT ON COLUMN preview_environments.service_id IS 'Reference to the service';
COMMENT ON COLUMN preview_environments.branch_name IS 'Git branch name';
COMMENT ON COLUMN preview_environments.pr_number IS 'Pull request number (optional)';
COMMENT ON COLUMN preview_environments.environment IS 'Environment name (e.g., preview-feature-branch-20240101-120000)';
COMMENT ON COLUMN preview_environments.status IS 'Current status of the preview environment';
COMMENT ON COLUMN preview_environments.url IS 'URL where the preview environment is accessible';
COMMENT ON COLUMN preview_environments.expires_at IS 'When the preview environment expires';
COMMENT ON COLUMN preview_environments.created_at IS 'When the preview environment was created';
COMMENT ON COLUMN preview_environments.updated_at IS 'When the preview environment was last updated';
