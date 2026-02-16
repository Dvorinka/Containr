-- Agent system migration for Phase 3: Node Agent System

-- Create node_agents table
CREATE TABLE IF NOT EXISTS node_agents (
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

-- Create container_instances table
CREATE TABLE IF NOT EXISTS container_instances (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    image VARCHAR(255) NOT NULL,
    project_id VARCHAR(255) NOT NULL,
    service_id VARCHAR(255) NOT NULL,
    node_agent_id VARCHAR(255) NOT NULL,
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
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (node_agent_id) REFERENCES node_agents(id) ON DELETE CASCADE
);

-- Create agent_commands table
CREATE TABLE IF NOT EXISTS agent_commands (
    id VARCHAR(255) PRIMARY KEY,
    type VARCHAR(100) NOT NULL,
    node_agent_id VARCHAR(255) NOT NULL,
    container_id VARCHAR(255),
    payload JSONB,
    status VARCHAR(50) DEFAULT 'pending',
    result TEXT,
    error TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    FOREIGN KEY (node_agent_id) REFERENCES node_agents(id) ON DELETE CASCADE,
    FOREIGN KEY (container_id) REFERENCES container_instances(id) ON DELETE CASCADE
);

-- Create node_clusters table
CREATE TABLE IF NOT EXISTS node_clusters (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'active',
    total_resources JSONB,
    used_resources JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create cluster_agents table to link clusters and agents
CREATE TABLE IF NOT EXISTS cluster_agents (
    cluster_id VARCHAR(255) NOT NULL,
    agent_id VARCHAR(255) NOT NULL,
    added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (cluster_id, agent_id),
    FOREIGN KEY (cluster_id) REFERENCES node_clusters(id) ON DELETE CASCADE,
    FOREIGN KEY (agent_id) REFERENCES node_agents(id) ON DELETE CASCADE
);

-- Create scheduling_rules table
CREATE TABLE IF NOT EXISTS scheduling_rules (
    id VARCHAR(255) PRIMARY KEY,
    cluster_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    selector JSONB,
    weight INTEGER DEFAULT 1,
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (cluster_id) REFERENCES node_clusters(id) ON DELETE CASCADE
);

-- Create container_metrics table for monitoring
CREATE TABLE IF NOT EXISTS container_metrics (
    id SERIAL PRIMARY KEY,
    container_id VARCHAR(255) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    cpu_usage DECIMAL(5,2),
    cpu_usage_percent DECIMAL(5,2),
    memory_usage BIGINT,
    memory_usage_percent DECIMAL(5,2),
    memory_limit BIGINT,
    network_rx_bytes BIGINT,
    network_tx_bytes BIGINT,
    network_rx_packets BIGINT,
    network_tx_packets BIGINT,
    block_read_bytes BIGINT,
    block_write_bytes BIGINT,
    pids_current INTEGER,
    pids_limit INTEGER,
    FOREIGN KEY (container_id) REFERENCES container_instances(id) ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_node_agents_status ON node_agents(status);
CREATE INDEX IF NOT EXISTS idx_node_agents_hostname ON node_agents(hostname);
CREATE INDEX IF NOT EXISTS idx_node_agents_ip_address ON node_agents(ip_address);
CREATE INDEX IF NOT EXISTS idx_node_agents_last_heartbeat ON node_agents(last_heartbeat);

CREATE INDEX IF NOT EXISTS idx_container_instances_project_id ON container_instances(project_id);
CREATE INDEX IF NOT EXISTS idx_container_instances_service_id ON container_instances(service_id);
CREATE INDEX IF NOT EXISTS idx_container_instances_node_agent_id ON container_instances(node_agent_id);
CREATE INDEX IF NOT EXISTS idx_container_instances_status ON container_instances USING GIN(status);

CREATE INDEX IF NOT EXISTS idx_agent_commands_node_agent_id ON agent_commands(node_agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_commands_status ON agent_commands(status);
CREATE INDEX IF NOT EXISTS idx_agent_commands_type ON agent_commands(type);
CREATE INDEX IF NOT EXISTS idx_agent_commands_created_at ON agent_commands(created_at);

CREATE INDEX IF NOT EXISTS idx_container_metrics_container_id ON container_metrics(container_id);
CREATE INDEX IF NOT EXISTS idx_container_metrics_timestamp ON container_metrics(timestamp);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_node_agents_updated_at BEFORE UPDATE ON node_agents 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_container_instances_updated_at BEFORE UPDATE ON container_instances 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_agent_commands_updated_at BEFORE UPDATE ON agent_commands 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_node_clusters_updated_at BEFORE UPDATE ON node_clusters 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_scheduling_rules_updated_at BEFORE UPDATE ON scheduling_rules 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default cluster
INSERT INTO node_clusters (id, name, description, status, total_resources, used_resources)
VALUES (
    'default-cluster',
    'Default Cluster',
    'Default cluster for all node agents',
    'active',
    '{"cpu": {"cores": 0, "allocation": 0, "usage": 0}, "memory": {"total": 0, "allocated": 0, "used": 0, "available": 0}, "storage": {"total": 0, "allocated": 0, "used": 0, "available": 0}, "network": {"interfaces": [], "bandwidth": {"inbound": 0, "outbound": 0}}}',
    '{"cpu": {"cores": 0, "allocation": 0, "usage": 0}, "memory": {"total": 0, "allocated": 0, "used": 0, "available": 0}, "storage": {"total": 0, "allocated": 0, "used": 0, "available": 0}, "network": {"interfaces": [], "bandwidth": {"inbound": 0, "outbound": 0}}}'
) ON CONFLICT (id) DO NOTHING;

-- Add comment to tables
COMMENT ON TABLE node_agents IS 'Container orchestration agents that manage containers on nodes';
COMMENT ON TABLE container_instances IS 'Container instances running on node agents';
COMMENT ON TABLE agent_commands IS 'Commands sent to node agents for execution';
COMMENT ON TABLE node_clusters IS 'Clusters of node agents for resource pooling';
COMMENT ON TABLE cluster_agents IS 'Many-to-many relationship between clusters and agents';
COMMENT ON TABLE scheduling_rules IS 'Rules for scheduling containers on agents';
COMMENT ON TABLE container_metrics IS 'Metrics collected from running containers';
