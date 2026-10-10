CREATE TABLE projects (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    owner_id UUID NOT NULL,
    is_approved BOOLEAN NOT NULL DEFAULT false,
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
    memory VARCHAR(50),
    replicas INTEGER NOT NULL DEFAULT 1,
    port INTEGER NOT NULL DEFAULT 0,
    domain VARCHAR(255) NOT NULL DEFAULT '',
    healthcheck_path VARCHAR(255) NOT NULL DEFAULT '',
    restart_policy VARCHAR(50) NOT NULL DEFAULT 'unless-stopped',
    published_port INTEGER NOT NULL DEFAULT 0,
    volumes JSONB NOT NULL DEFAULT '[]'::jsonb,
    maintenance_mode BOOLEAN NOT NULL DEFAULT false,
    basic_auth_users TEXT NOT NULL DEFAULT '',
    builder VARCHAR(32) NOT NULL DEFAULT 'auto',
    cpu_reserve VARCHAR(20) NOT NULL DEFAULT '',
    memory_reserve VARCHAR(20) NOT NULL DEFAULT '',
    static_build_cmd VARCHAR(255) NOT NULL DEFAULT '',
    static_dir VARCHAR(255) NOT NULL DEFAULT '',
    node_id VARCHAR(255),
    spread BOOLEAN NOT NULL DEFAULT false,
    sleep_enabled BOOLEAN NOT NULL DEFAULT false,
    sleep_idle_minutes INTEGER NOT NULL DEFAULT 15,
    placement_tags JSONB NOT NULL DEFAULT '[]',
    traefik_labels JSONB NOT NULL DEFAULT '{}'
);

CREATE TABLE registries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    host VARCHAR(255) NOT NULL,
    username VARCHAR(255) NOT NULL DEFAULT '',
    password TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (owner_id, host)
);

CREATE TABLE service_domains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    domain VARCHAR(255) NOT NULL,
    is_default BOOLEAN NOT NULL DEFAULT false,
    cert_type VARCHAR(32) NOT NULL DEFAULT 'letsencrypt',
    cert_status VARCHAR(32) NOT NULL DEFAULT 'pending',
    last_checked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (service_id, domain)
);

CREATE TABLE deployments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    version VARCHAR(255) NOT NULL,
    commit_hash VARCHAR(255),
    image_digest VARCHAR(255),
    status VARCHAR(50) DEFAULT 'created',
    build_log TEXT,
    deployment_log TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    image_name VARCHAR(255),
    image_tag VARCHAR(255),
    runtime_log TEXT,
    error TEXT
);

CREATE TABLE preview_environments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL,
    service_id UUID NOT NULL,
    branch_name VARCHAR(255) NOT NULL,
    pr_number INTEGER,
    environment VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'building',
    url TEXT,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    preview_service_id UUID
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
    owner_id UUID,
    is_public BOOLEAN NOT NULL DEFAULT false,
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
    backup_schedule VARCHAR(100),
    next_backup_at TIMESTAMP WITH TIME ZONE,
    provider VARCHAR(20) NOT NULL DEFAULT 'managed',
    external_host VARCHAR(255),
    external_port INTEGER,
    external_name VARCHAR(255),
    external_username VARCHAR(255),
    external_password TEXT NOT NULL DEFAULT '',
    external_ssl BOOLEAN NOT NULL DEFAULT false,
    public_port BOOLEAN NOT NULL DEFAULT false,
    backup_target_id VARCHAR(255),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE database_backups (
    id VARCHAR(255) PRIMARY KEY,
    database_id VARCHAR(255) NOT NULL REFERENCES database_services(id) ON DELETE CASCADE,
    size VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'in_progress',
    backup_path TEXT,
    remote_key VARCHAR(512),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE backup_targets (
    id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    endpoint VARCHAR(512) NOT NULL,
    bucket VARCHAR(255) NOT NULL,
    region VARCHAR(100) NOT NULL DEFAULT '',
    prefix VARCHAR(255) NOT NULL DEFAULT '',
    access_key TEXT NOT NULL DEFAULT '',
    secret_key TEXT NOT NULL DEFAULT '',
    use_tls BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
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
    metadata JSONB,
    auto_prune BOOLEAN NOT NULL DEFAULT false,
    schedulable BOOLEAN NOT NULL DEFAULT true,
    tags JSONB NOT NULL DEFAULT '[]',
    default_domain VARCHAR(255) NOT NULL DEFAULT ''
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

CREATE TABLE agent_auth_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token_hash TEXT NOT NULL UNIQUE,
    label VARCHAR(255) NOT NULL DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_used_at TIMESTAMP WITH TIME ZONE,
    revoked_at TIMESTAMP WITH TIME ZONE
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

CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    body TEXT,
    resource_type VARCHAR(50),
    resource_id VARCHAR(255),
    read_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE user_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    key_prefix VARCHAR(16) NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    scope VARCHAR(20) NOT NULL DEFAULT 'write',
    expires_at TIMESTAMP WITH TIME ZONE,
    last_used_at TIMESTAMP WITH TIME ZONE,
    revoked_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE outbound_webhooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    url VARCHAR(500) NOT NULL,
    secret TEXT NOT NULL DEFAULT '',
    events JSONB NOT NULL DEFAULT '[]'::jsonb,
    headers JSONB,
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE webhook_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    webhook_id UUID NOT NULL REFERENCES outbound_webhooks(id) ON DELETE CASCADE,
    event VARCHAR(255) NOT NULL,
    payload JSONB,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    response_status INTEGER,
    response_body TEXT,
    attempts INTEGER NOT NULL DEFAULT 0,
    duration_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    delivered_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE banners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    body TEXT NOT NULL DEFAULT '',
    level VARCHAR(20) NOT NULL DEFAULT 'info',
    active BOOLEAN NOT NULL DEFAULT true,
    dismissible BOOLEAN NOT NULL DEFAULT true,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    starts_at TIMESTAMP WITH TIME ZONE,
    ends_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE user_invites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    email VARCHAR(255),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_by UUID REFERENCES users(id) ON DELETE SET NULL,
    used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE notification_channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind VARCHAR(20) NOT NULL CHECK (kind IN ('ntfy', 'gotify')),
    endpoint TEXT NOT NULL,
    token VARCHAR(255),
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE node_metrics (
    node_id VARCHAR(255) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    cpu_usage NUMERIC(5,2),
    cpu_cores NUMERIC(10,2),
    load_avg_1 NUMERIC(5,2),
    load_avg_5 NUMERIC(5,2),
    load_avg_15 NUMERIC(5,2),
    memory_total BIGINT,
    memory_used BIGINT,
    memory_available BIGINT,
    memory_usage_percent NUMERIC(5,2),
    storage_total BIGINT,
    storage_used BIGINT,
    storage_available BIGINT,
    storage_usage_percent NUMERIC(5,2),
    network_bytes_in BIGINT,
    network_bytes_out BIGINT,
    network_packets_in BIGINT,
    network_packets_out BIGINT,
    network_connections_in INTEGER,
    network_connections_out INTEGER,
    network_errors_in BIGINT,
    network_errors_out BIGINT,
    uptime INTERVAL,
    processes INTEGER,
    os VARCHAR(50),
    kernel VARCHAR(50),
    architecture VARCHAR(20),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (node_id, timestamp)
);

CREATE TABLE service_metrics (
    service_id VARCHAR(255) NOT NULL,
    service_name VARCHAR(255) NOT NULL,
    project_id VARCHAR(255) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    requests_total BIGINT DEFAULT 0,
    requests_success BIGINT DEFAULT 0,
    requests_errors BIGINT DEFAULT 0,
    requests_avg_latency NUMERIC(10,3),
    requests_p95_latency NUMERIC(10,3),
    requests_p99_latency NUMERIC(10,3),
    requests_throughput NUMERIC(10,3),
    errors_total BIGINT DEFAULT 0,
    errors_rate NUMERIC(5,4),
    performance_response_time NUMERIC(10,3),
    performance_throughput NUMERIC(10,3),
    performance_concurrency BIGINT,
    performance_saturation NUMERIC(5,2),
    performance_utilization NUMERIC(5,2),
    resource_cpu_usage NUMERIC(5,2),
    resource_memory_usage BIGINT,
    resource_storage_usage BIGINT,
    resource_network_usage BIGINT,
    resource_score NUMERIC(5,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (service_id, timestamp)
);

CREATE TABLE instance_metrics (
    service_id VARCHAR(255) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    instance_id VARCHAR(255) NOT NULL,
    node_id VARCHAR(255),
    status VARCHAR(50),
    cpu NUMERIC(5,2),
    memory BIGINT,
    network_bytes_in BIGINT,
    network_bytes_out BIGINT,
    network_packets_in BIGINT,
    network_packets_out BIGINT,
    network_connections_in INTEGER,
    network_connections_out INTEGER,
    network_errors_in BIGINT,
    network_errors_out BIGINT,
    start_time TIMESTAMP WITH TIME ZONE,
    last_seen TIMESTAMP WITH TIME ZONE,
    health_status VARCHAR(20),
    health_last_check TIMESTAMP WITH TIME ZONE,
    health_check_count INTEGER DEFAULT 0,
    health_failure_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (service_id, timestamp, instance_id)
);

CREATE TABLE cron_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    schedule VARCHAR(100) NOT NULL,
    command TEXT NOT NULL,
    timezone VARCHAR(50) DEFAULT 'UTC',
    enabled BOOLEAN DEFAULT true,
    last_run_at TIMESTAMP WITH TIME ZONE,
    next_run_at TIMESTAMP WITH TIME ZONE,
    last_status VARCHAR(50),
    last_output TEXT,
    retention INTEGER DEFAULT 30,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE cron_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cron_job_id UUID NOT NULL REFERENCES cron_jobs(id) ON DELETE CASCADE,
    started_at TIMESTAMP WITH TIME ZONE NOT NULL,
    finished_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(50) DEFAULT 'pending',
    output TEXT,
    error TEXT
);
