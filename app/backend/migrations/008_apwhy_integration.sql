-- APwhy Gateway schema integration
-- Add API gateway functionality to Containr

-- Users table extension for APwhy auth system
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS enabled INTEGER NOT NULL DEFAULT 1;
ALTER TABLE users ADD COLUMN IF NOT EXISTS force_password_reset INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP;

-- Sessions table for APwhy authentication
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    access_token_hash TEXT NOT NULL,
    refresh_token_hash TEXT NOT NULL,
    access_expires_at TIMESTAMP NOT NULL,
    refresh_expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMP
);

-- Invites table for user management
CREATE TABLE IF NOT EXISTS invites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    used_at TIMESTAMP,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Password resets table
CREATE TABLE IF NOT EXISTS password_resets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    used_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Roles table
CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    is_system INTEGER NOT NULL DEFAULT 0,
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Permissions table
CREATE TABLE IF NOT EXISTS permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Role permissions junction table
CREATE TABLE IF NOT EXISTS role_permissions (
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    PRIMARY KEY (role_id, permission_id)
);

-- User roles junction table
CREATE TABLE IF NOT EXISTS user_roles (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, role_id)
);

-- API Services table
CREATE TABLE IF NOT EXISTS api_services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    upstream_url TEXT NOT NULL,
    route_prefix TEXT NOT NULL UNIQUE,
    health_path TEXT NOT NULL DEFAULT '/health',
    upstream_auth_header TEXT,
    upstream_auth_value TEXT,
    internal_token TEXT,
    enabled INTEGER NOT NULL DEFAULT 1,
    rpm_limit INTEGER,
    monthly_quota INTEGER,
    request_timeout_ms INTEGER DEFAULT 8000,
    last_validation_at TIMESTAMP,
    last_validation_status TEXT,
    last_validation_message TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Database connections table
CREATE TABLE IF NOT EXISTS database_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    provider TEXT NOT NULL,
    connection_url TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    last_validation_at TIMESTAMP,
    last_validation_status TEXT,
    last_validation_message TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- API Keys table
CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    key_hash TEXT NOT NULL UNIQUE,
    key_prefix TEXT NOT NULL,
    plan TEXT NOT NULL DEFAULT 'free',
    allowed_service_ids TEXT NOT NULL DEFAULT '[]',
    enabled INTEGER NOT NULL DEFAULT 1,
    rpm_limit INTEGER DEFAULT 60,
    monthly_quota INTEGER DEFAULT 1000,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMP
);

-- Usage counters table
CREATE TABLE IF NOT EXISTS usage_counters (
    id SERIAL PRIMARY KEY,
    api_key_id UUID NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
    service_id UUID NOT NULL REFERENCES api_services(id) ON DELETE CASCADE,
    period_month TEXT NOT NULL,
    request_count INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(api_key_id, service_id, period_month)
);

-- Incident events table
CREATE TABLE IF NOT EXISTS incident_events (
    id SERIAL PRIMARY KEY,
    service_id UUID REFERENCES api_services(id) ON DELETE SET NULL,
    api_key_id UUID REFERENCES api_keys(id) ON DELETE SET NULL,
    code TEXT NOT NULL,
    message TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'medium',
    http_status INTEGER,
    count INTEGER NOT NULL DEFAULT 1,
    occurred_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Metrics timeseries table
CREATE TABLE IF NOT EXISTS metrics_timeseries (
    id SERIAL PRIMARY KEY,
    metric TEXT NOT NULL,
    value REAL NOT NULL,
    labels_json TEXT,
    occurred_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Umami sync cache table
CREATE TABLE IF NOT EXISTS umami_sync_cache (
    cache_key TEXT PRIMARY KEY,
    payload_json TEXT NOT NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Audit log table
CREATE TABLE IF NOT EXISTS audit_log (
    id SERIAL PRIMARY KEY,
    actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    target_type TEXT,
    target_id TEXT,
    payload_json TEXT,
    occurred_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Insert default roles and permissions
INSERT INTO roles (id, name, slug, description, is_system, enabled, created_at, updated_at) VALUES
    (gen_random_uuid(), 'Owner', 'owner', 'Full system access', 1, 1, NOW(), NOW()),
    (gen_random_uuid(), 'Admin', 'admin', 'Administrative access', 1, 1, NOW(), NOW()),
    (gen_random_uuid(), 'User', 'user', 'Basic user access', 1, 1, NOW(), NOW()),
    (gen_random_uuid(), 'Viewer', 'viewer', 'Read-only access', 1, 1, NOW(), NOW())
ON CONFLICT (slug) DO NOTHING;

-- Insert default permissions
INSERT INTO permissions (id, code, name, description, created_at) VALUES
    (gen_random_uuid(), 'users.read', 'Read Users', 'View user information', NOW()),
    (gen_random_uuid(), 'users.write', 'Write Users', 'Create and modify users', NOW()),
    (gen_random_uuid(), 'roles.read', 'Read Roles', 'View role information', NOW()),
    (gen_random_uuid(), 'roles.write', 'Write Roles', 'Create and modify roles', NOW()),
    (gen_random_uuid(), 'services.read', 'Read Services', 'View API services', NOW()),
    (gen_random_uuid(), 'services.write', 'Write Services', 'Create and modify services', NOW()),
    (gen_random_uuid(), 'databases.read', 'Read Databases', 'View database connections', NOW()),
    (gen_random_uuid(), 'databases.write', 'Write Databases', 'Create and modify databases', NOW()),
    (gen_random_uuid(), 'keys.read', 'Read Keys', 'View API keys', NOW()),
    (gen_random_uuid(), 'keys.write', 'Write Keys', 'Create and modify API keys', NOW()),
    (gen_random_uuid(), 'analytics.read', 'Read Analytics', 'View analytics data', NOW())
ON CONFLICT (code) DO NOTHING;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_access_hash ON sessions(access_token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_refresh_hash ON sessions(refresh_token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(access_expires_at);

CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_prefix ON api_keys(key_prefix);
CREATE INDEX IF NOT EXISTS idx_api_keys_enabled ON api_keys(enabled);

CREATE INDEX IF NOT EXISTS idx_usage_counters_key_service_month ON usage_counters(api_key_id, service_id, period_month);

CREATE INDEX IF NOT EXISTS idx_incident_events_service ON incident_events(service_id);
CREATE INDEX IF NOT EXISTS idx_incident_events_key ON incident_events(api_key_id);
CREATE INDEX IF NOT EXISTS idx_incident_events_occurred ON incident_events(occurred_at);

CREATE INDEX IF NOT EXISTS idx_metrics_timeseries_metric ON metrics_timeseries(metric);
CREATE INDEX IF NOT EXISTS idx_metrics_timeseries_occurred ON metrics_timeseries(occurred_at);

CREATE INDEX IF NOT EXISTS idx_audit_log_actor ON audit_log(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_occurred ON audit_log(occurred_at);
