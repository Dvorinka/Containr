-- Metrics Schema Migration
-- This migration creates tables for storing system and service metrics

-- Enable TimescaleDB extension for time-series data (optional)
CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;

-- Node metrics table
CREATE TABLE IF NOT EXISTS node_metrics (
    node_id VARCHAR(255) NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL,
    cpu_usage DECIMAL(5,2),
    cpu_cores DECIMAL(10,2),
    load_avg_1 DECIMAL(5,2),
    load_avg_5 DECIMAL(5,2),
    load_avg_15 DECIMAL(5,2),
    memory_total BIGINT,
    memory_used BIGINT,
    memory_available BIGINT,
    memory_usage_percent DECIMAL(5,2),
    storage_total BIGINT,
    storage_used BIGINT,
    storage_available BIGINT,
    storage_usage_percent DECIMAL(5,2),
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
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (node_id, timestamp)
);

-- Create index for time-series queries
CREATE INDEX IF NOT EXISTS idx_node_metrics_timestamp ON node_metrics (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_node_metrics_node_timestamp ON node_metrics (node_id, timestamp DESC);

-- Container metrics table
CREATE TABLE IF NOT EXISTS container_metrics (
    node_id VARCHAR(255) NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL,
    container_id VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    state VARCHAR(50),
    cpu DECIMAL(5,2),
    memory BIGINT,
    network_bytes_in BIGINT,
    network_bytes_out BIGINT,
    network_packets_in BIGINT,
    network_packets_out BIGINT,
    start_time TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (node_id, timestamp, container_id),
    FOREIGN KEY (node_id, timestamp) REFERENCES node_metrics (node_id, timestamp) ON DELETE CASCADE
);

-- Service metrics table
CREATE TABLE IF NOT EXISTS service_metrics (
    service_id VARCHAR(255) NOT NULL,
    service_name VARCHAR(255) NOT NULL,
    project_id VARCHAR(255) NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL,
    requests_total BIGINT DEFAULT 0,
    requests_success BIGINT DEFAULT 0,
    requests_errors BIGINT DEFAULT 0,
    requests_avg_latency DECIMAL(10,3),
    requests_p95_latency DECIMAL(10,3),
    requests_p99_latency DECIMAL(10,3),
    requests_throughput DECIMAL(10,3),
    errors_total BIGINT DEFAULT 0,
    errors_rate DECIMAL(5,4),
    performance_response_time DECIMAL(10,3),
    performance_throughput DECIMAL(10,3),
    performance_concurrency BIGINT,
    performance_saturation DECIMAL(5,2),
    performance_utilization DECIMAL(5,2),
    resource_cpu_usage DECIMAL(5,2),
    resource_memory_usage BIGINT,
    resource_storage_usage BIGINT,
    resource_network_usage BIGINT,
    resource_score DECIMAL(5,2),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (service_id, timestamp)
);

-- Create indexes for service metrics
CREATE INDEX IF NOT EXISTS idx_service_metrics_timestamp ON service_metrics (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_service_metrics_service_timestamp ON service_metrics (service_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_service_metrics_project_timestamp ON service_metrics (project_id, timestamp DESC);

-- Instance metrics table
CREATE TABLE IF NOT EXISTS instance_metrics (
    service_id VARCHAR(255) NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL,
    instance_id VARCHAR(255) NOT NULL,
    node_id VARCHAR(255),
    status VARCHAR(50),
    cpu DECIMAL(5,2),
    memory BIGINT,
    network_bytes_in BIGINT,
    network_bytes_out BIGINT,
    network_packets_in BIGINT,
    network_packets_out BIGINT,
    network_connections_in INTEGER,
    network_connections_out INTEGER,
    network_errors_in BIGINT,
    network_errors_out BIGINT,
    start_time TIMESTAMPTZ,
    last_seen TIMESTAMPTZ,
    health_status VARCHAR(20),
    health_last_check TIMESTAMPTZ,
    health_check_count INTEGER DEFAULT 0,
    health_failure_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (service_id, timestamp, instance_id),
    FOREIGN KEY (service_id, timestamp) REFERENCES service_metrics (service_id, timestamp) ON DELETE CASCADE
);

-- Service discovery table
CREATE TABLE IF NOT EXISTS service_discovery (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id VARCHAR(255) NOT NULL,
    service_name VARCHAR(255) NOT NULL,
    project_id VARCHAR(255) NOT NULL,
    instance_id VARCHAR(255) NOT NULL,
    node_id VARCHAR(255),
    ip_address INET NOT NULL,
    port INTEGER,
    status VARCHAR(50) DEFAULT 'unknown',
    health_status VARCHAR(20) DEFAULT 'unknown',
    labels JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_seen TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(service_id, instance_id)
);

-- Create indexes for service discovery
CREATE INDEX IF NOT EXISTS idx_service_discovery_service ON service_discovery (service_id);
CREATE INDEX IF NOT EXISTS idx_service_discovery_project ON service_discovery (project_id);
CREATE INDEX IF NOT EXISTS idx_service_discovery_name ON service_discovery (service_name);
CREATE INDEX IF NOT EXISTS idx_service_discovery_status ON service_discovery (status);
CREATE INDEX IF NOT EXISTS idx_service_discovery_ip ON service_discovery (ip_address);
CREATE INDEX IF NOT EXISTS idx_service_discovery_labels ON service_discovery USING GIN (labels);

-- DNS records table
CREATE TABLE IF NOT EXISTS dns_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(10) NOT NULL, -- A, SRV, CNAME, etc.
    ttl INTEGER DEFAULT 300,
    records JSONB NOT NULL, -- Array of records
    priority INTEGER,
    weight INTEGER,
    port INTEGER,
    service_id VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for DNS records
CREATE INDEX IF NOT EXISTS idx_dns_records_name ON dns_records (name);
CREATE INDEX IF NOT EXISTS idx_dns_records_type ON dns_records (type);
CREATE INDEX IF NOT EXISTS idx_dns_records_service ON dns_records (service_id);

-- Metrics aggregation rules table
CREATE TABLE IF NOT EXISTS metrics_aggregation_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL UNIQUE,
    metric_type VARCHAR(50) NOT NULL, -- node, service, container
    aggregation_function VARCHAR(50) NOT NULL, -- avg, sum, min, max, count
    interval INTERVAL NOT NULL, -- 1m, 5m, 1h, etc.
    retention_period INTERVAL DEFAULT '30 days',
    fields JSONB NOT NULL, -- Which fields to aggregate
    filters JSONB DEFAULT '{}', -- Optional filters
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for aggregation rules
CREATE INDEX IF NOT EXISTS idx_metrics_aggregation_rules_type ON metrics_aggregation_rules (metric_type);

-- Alert rules table
CREATE TABLE IF NOT EXISTS alert_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    metric_type VARCHAR(50) NOT NULL,
    metric_field VARCHAR(100) NOT NULL,
    condition VARCHAR(20) NOT NULL, -- gt, lt, eq, gte, lte
    threshold DECIMAL(15,4) NOT NULL,
    duration INTERVAL DEFAULT '5 minutes',
    severity VARCHAR(20) DEFAULT 'warning', -- critical, warning, info
    enabled BOOLEAN DEFAULT true,
    filters JSONB DEFAULT '{}',
    notification_channels JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for alert rules
CREATE INDEX IF NOT EXISTS idx_alert_rules_type ON alert_rules (metric_type);
CREATE INDEX IF NOT EXISTS idx_alert_rules_enabled ON alert_rules (enabled);

-- Alert incidents table
CREATE TABLE IF NOT EXISTS alert_incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_id UUID NOT NULL REFERENCES alert_rules (id) ON DELETE CASCADE,
    metric_type VARCHAR(50) NOT NULL,
    metric_field VARCHAR(100) NOT NULL,
    current_value DECIMAL(15,4) NOT NULL,
    threshold DECIMAL(15,4) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    status VARCHAR(20) DEFAULT 'firing', -- firing, resolved
    started_at TIMESTAMPTZ NOT NULL,
    resolved_at TIMESTAMPTZ,
    duration INTERVAL,
    description TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for alert incidents
CREATE INDEX IF NOT EXISTS idx_alert_incidents_rule ON alert_incidents (rule_id);
CREATE INDEX IF NOT EXISTS idx_alert_incidents_status ON alert_incidents (status);
CREATE INDEX IF NOT EXISTS idx_alert_incidents_started ON alert_incidents (started_at DESC);

-- Create TimescaleDB hypertables if TimescaleDB is available
DO $$
BEGIN
    -- Only create hypertables if TimescaleDB extension is available
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'timescaledb') THEN
        PERFORM create_hypertable('node_metrics', 'timestamp', chunk_time_interval => INTERVAL '1 hour');
        PERFORM create_hypertable('service_metrics', 'timestamp', chunk_time_interval => INTERVAL '1 hour');
        PERFORM create_hypertable('container_metrics', 'timestamp', chunk_time_interval => INTERVAL '1 hour');
        PERFORM create_hypertable('instance_metrics', 'timestamp', chunk_time_interval => INTERVAL '1 hour');
        
        -- Create compression policies for older data
        PERFORM add_compression_policy('node_metrics', INTERVAL '7 days');
        PERFORM add_compression_policy('service_metrics', INTERVAL '7 days');
        PERFORM add_compression_policy('container_metrics', INTERVAL '7 days');
        PERFORM add_compression_policy('instance_metrics', INTERVAL '7 days');
        
        -- Create retention policies
        PERFORM add_retention_policy('node_metrics', INTERVAL '90 days');
        PERFORM add_retention_policy('service_metrics', INTERVAL '90 days');
        PERFORM add_retention_policy('container_metrics', INTERVAL '90 days');
        PERFORM add_retention_policy('instance_metrics', INTERVAL '90 days');
    END IF;
END $$;

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at columns (only if they don't exist)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_service_discovery_updated_at') THEN
        CREATE TRIGGER update_service_discovery_updated_at BEFORE UPDATE ON service_discovery FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_dns_records_updated_at') THEN
        CREATE TRIGGER update_dns_records_updated_at BEFORE UPDATE ON dns_records FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_metrics_aggregation_rules_updated_at') THEN
        CREATE TRIGGER update_metrics_aggregation_rules_updated_at BEFORE UPDATE ON metrics_aggregation_rules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_alert_rules_updated_at') THEN
        CREATE TRIGGER update_alert_rules_updated_at BEFORE UPDATE ON alert_rules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- Insert default aggregation rules
INSERT INTO metrics_aggregation_rules (name, metric_type, aggregation_function, interval, fields) VALUES
('node_cpu_1m', 'node', 'avg', INTERVAL '1 minute', '{"cpu_usage": true, "memory_usage_percent": true}'),
('node_cpu_5m', 'node', 'avg', INTERVAL '5 minutes', '{"cpu_usage": true, "memory_usage_percent": true}'),
('node_cpu_1h', 'node', 'avg', INTERVAL '1 hour', '{"cpu_usage": true, "memory_usage_percent": true, "storage_usage_percent": true}'),
('service_requests_1m', 'service', 'sum', INTERVAL '1 minute', '{"requests_total": true, "requests_success": true, "requests_errors": true}'),
('service_requests_5m', 'service', 'sum', INTERVAL '5 minutes', '{"requests_total": true, "requests_success": true, "requests_errors": true}'),
('service_performance_5m', 'service', 'avg', INTERVAL '5 minutes', '{"requests_avg_latency": true, "requests_p95_latency": true, "requests_throughput": true}')
ON CONFLICT (name) DO NOTHING;

-- Insert default alert rules
INSERT INTO alert_rules (name, description, metric_type, metric_field, condition, threshold, severity) VALUES
('High CPU Usage', 'Node CPU usage is above 80%', 'node', 'cpu_usage', 'gt', 80.0, 'warning'),
('Critical CPU Usage', 'Node CPU usage is above 95%', 'node', 'cpu_usage', 'gt', 95.0, 'critical'),
('High Memory Usage', 'Node memory usage is above 85%', 'node', 'memory_usage_percent', 'gt', 85.0, 'warning'),
('Critical Memory Usage', 'Node memory usage is above 95%', 'node', 'memory_usage_percent', 'gt', 95.0, 'critical'),
('High Error Rate', 'Service error rate is above 10%', 'service', 'errors_rate', 'gt', 0.10, 'warning'),
('Critical Error Rate', 'Service error rate is above 25%', 'service', 'errors_rate', 'gt', 0.25, 'critical'),
('High Latency', 'Service P95 latency is above 1000ms', 'service', 'requests_p95_latency', 'gt', 1000.0, 'warning'),
('Critical Latency', 'Service P95 latency is above 5000ms', 'service', 'requests_p95_latency', 'gt', 5000.0, 'critical')
ON CONFLICT (name) DO NOTHING;

-- Create views for common queries
CREATE OR REPLACE VIEW node_metrics_summary AS
SELECT 
    node_id,
    timestamp,
    cpu_usage,
    memory_usage_percent,
    storage_usage_percent,
    network_bytes_in + network_bytes_out as total_network_bytes,
    load_avg_1,
    uptime
FROM node_metrics
ORDER BY timestamp DESC;

CREATE OR REPLACE VIEW service_metrics_summary AS
SELECT 
    service_id,
    service_name,
    project_id,
    timestamp,
    requests_total,
    requests_success,
    requests_errors,
    CASE WHEN requests_total > 0 THEN (requests_errors::DECIMAL / requests_total) ELSE 0 END as error_rate,
    requests_avg_latency,
    requests_p95_latency,
    requests_throughput,
    resource_cpu_usage,
    resource_memory_usage
FROM service_metrics
ORDER BY timestamp DESC;

-- Grant permissions (adjust as needed for your setup)
-- GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO containr_app;
-- GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO containr_app;

COMMIT;
