-- Performance Optimization Migration
-- This migration adds additional indexes and optimizations for better query performance

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_projects_owner_updated ON projects(owner_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_services_project_env ON services(project_id, environment_id);
CREATE INDEX IF NOT EXISTS idx_services_status_project ON services(status, project_id);
CREATE INDEX IF NOT EXISTS idx_deployments_service_status_created ON deployments(service_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deployments_service_created ON deployments(service_id, created_at DESC);

-- Partial indexes for better performance on filtered queries
CREATE INDEX IF NOT EXISTS idx_active_deployments ON deployments(service_id, created_at DESC) 
WHERE status IN ('running', 'deploying');

CREATE INDEX IF NOT EXISTS idx_running_services ON services(project_id, updated_at DESC) 
WHERE status = 'running';

-- Environment variables optimization
CREATE INDEX IF NOT EXISTS idx_env_vars_service_key ON environment_variables(service_id, key);

-- Service dependencies optimization
CREATE INDEX IF NOT EXISTS idx_service_deps_service ON service_dependencies(service_id);
CREATE INDEX IF NOT EXISTS idx_service_deps_depends_on ON service_dependencies(depends_on_service_id);

-- Project members optimization for role-based queries
CREATE INDEX IF NOT EXISTS idx_project_members_role ON project_members(project_id, role);

-- Add table statistics for better query planning
ANALYZE projects;
ANALYZE services;
ANALYZE deployments;
ANALYZE environment_variables;
ANALYZE service_dependencies;
ANALYZE project_members;
ANALYZE users;
ANALYZE environments;

-- Create a view for project statistics to optimize dashboard queries
CREATE OR REPLACE VIEW project_stats AS
SELECT 
    p.id,
    p.name,
    p.description,
    p.owner_id,
    p.created_at,
    p.updated_at,
    COUNT(DISTINCT s.id) as service_count,
    COUNT(DISTINCT d.id) as deployment_count,
    COUNT(DISTINCT CASE WHEN s.status = 'running' THEN s.id END) as running_services,
    MAX(d.created_at) as last_deployment
FROM projects p
LEFT JOIN services s ON p.id = s.project_id
LEFT JOIN deployments d ON s.id = d.service_id
GROUP BY p.id, p.name, p.description, p.owner_id, p.created_at, p.updated_at;

-- Function to get project statistics efficiently
CREATE OR REPLACE FUNCTION get_project_stats(project_uuid UUID)
RETURNS TABLE(
    service_count BIGINT,
    deployment_count BIGINT,
    running_services BIGINT,
    last_deployment TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(DISTINCT s.id),
        COUNT(DISTINCT d.id),
        COUNT(DISTINCT CASE WHEN s.status = 'running' THEN s.id END),
        MAX(d.created_at)
    FROM services s
    LEFT JOIN deployments d ON s.id = d.service_id
    WHERE s.project_id = project_uuid;
END;
$$ LANGUAGE plpgsql;

-- Add comments for documentation
COMMENT ON VIEW project_stats IS 'Aggregated project-level statistics for dashboards';
COMMENT ON FUNCTION get_project_stats(UUID) IS 'Returns deployment and service summary for a single project';
