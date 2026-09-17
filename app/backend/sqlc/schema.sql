CREATE TABLE projects (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    owner_id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE project_members (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL,
    user_id UUID NOT NULL,
    role VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE environments (
    id UUID PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    project_id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(name, project_id)
);

CREATE TABLE services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    environment_id UUID NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
    service_type VARCHAR(50) NOT NULL,
    source_type VARCHAR(50) NOT NULL,
    source_url VARCHAR(500),
    image_name VARCHAR(500),
    build_command TEXT,
    start_command TEXT,
    cpu_limit INTEGER,
    memory_limit INTEGER,
    public_url VARCHAR(500),
    health_check_url VARCHAR(500),
    status VARCHAR(50) DEFAULT 'created',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    type VARCHAR(50),
    image VARCHAR(500),
    command TEXT,
    environment VARCHAR(50),
    git_repo VARCHAR(500),
    git_branch VARCHAR(100),
    build_path VARCHAR(500),
    cpu VARCHAR(50),
    memory VARCHAR(50)
);

CREATE TABLE deployments (
    id UUID PRIMARY KEY,
    service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    status VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE environment_variables (
    id UUID PRIMARY KEY,
    service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    key VARCHAR(255) NOT NULL,
    value TEXT NOT NULL,
    is_secret BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(service_id, key)
);

CREATE TABLE service_templates (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(50) NOT NULL,
    logo VARCHAR(500),
    config JSONB NOT NULL,
    variables JSONB DEFAULT '[]',
    is_official BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE database_services (
    id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'building',
    version VARCHAR(50) NOT NULL,
    plan VARCHAR(50) NOT NULL,
    region VARCHAR(50) NOT NULL,
    connection_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE database_backups (
    id VARCHAR(255) PRIMARY KEY,
    database_id VARCHAR(255) NOT NULL REFERENCES database_services(id) ON DELETE CASCADE,
    size VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'in_progress',
    backup_path TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE node_agents (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    hostname VARCHAR(255) NOT NULL,
    ip_address VARCHAR(45) NOT NULL,
    port INTEGER NOT NULL,
    status VARCHAR(50) DEFAULT 'offline',
    version VARCHAR(50),
    capabilities JSONB,
    resources JSONB,
    last_heartbeat TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB
);

CREATE TABLE container_instances (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    image VARCHAR(255) NOT NULL,
    project_id VARCHAR(255) NOT NULL,
    service_id VARCHAR(255) NOT NULL,
    node_agent_id VARCHAR(255) NOT NULL REFERENCES node_agents(id) ON DELETE CASCADE,
    status JSONB,
    resources JSONB,
    ports JSONB,
    environment JSONB,
    volumes JSONB,
    networks JSONB,
    restart_policy JSONB,
    health_check JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE agent_commands (
    id VARCHAR(255) PRIMARY KEY,
    type VARCHAR(100) NOT NULL,
    node_agent_id VARCHAR(255) NOT NULL REFERENCES node_agents(id) ON DELETE CASCADE,
    container_id VARCHAR(255) REFERENCES container_instances(id) ON DELETE CASCADE,
    payload JSONB,
    status VARCHAR(50) DEFAULT 'pending',
    result TEXT,
    error TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE agent_heartbeats (
    id VARCHAR(255) PRIMARY KEY,
    node_agent_id VARCHAR(255) NOT NULL REFERENCES node_agents(id) ON DELETE CASCADE,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status VARCHAR(50) NOT NULL DEFAULT 'unknown',
    resources JSONB NOT NULL DEFAULT '{}'::jsonb,
    container_count INTEGER NOT NULL DEFAULT 0,
    system_load JSONB NOT NULL DEFAULT '{}'::jsonb,
    uptime BIGINT NOT NULL DEFAULT 0,
    version VARCHAR(50) NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
