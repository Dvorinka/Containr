-- Database Services Migration
-- This migration creates tables for managed database services

-- Database Services table
CREATE TABLE IF NOT EXISTS database_services (
    id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('postgresql', 'redis', 'mysql')),
    status VARCHAR(50) NOT NULL DEFAULT 'building' CHECK (status IN ('running', 'stopped', 'building', 'error')),
    version VARCHAR(50) NOT NULL,
    plan VARCHAR(50) NOT NULL CHECK (plan IN ('hobby', 'starter', 'standard', 'business')),
    region VARCHAR(50) NOT NULL,
    connection_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT fk_database_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Database Backups table
CREATE TABLE IF NOT EXISTS database_backups (
    id VARCHAR(255) PRIMARY KEY,
    database_id VARCHAR(255) NOT NULL,
    size VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'in_progress' CHECK (status IN ('completed', 'failed', 'in_progress')),
    backup_path TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    
    CONSTRAINT fk_backup_database FOREIGN KEY (database_id) REFERENCES database_services(id) ON DELETE CASCADE
);

-- Database Settings table
CREATE TABLE IF NOT EXISTS database_settings (
    database_id VARCHAR(255) PRIMARY KEY,
    max_connections INTEGER DEFAULT 100,
    timeout INTEGER DEFAULT 30,
    ssl_enabled BOOLEAN DEFAULT true,
    logging_enabled BOOLEAN DEFAULT true,
    retention_days INTEGER DEFAULT 30,
    backup_enabled BOOLEAN DEFAULT true,
    next_backup_time TIMESTAMP WITH TIME ZONE,
    last_backup_time TIMESTAMP WITH TIME ZONE,
    
    CONSTRAINT fk_settings_database FOREIGN KEY (database_id) REFERENCES database_services(id) ON DELETE CASCADE
);

-- Database Metrics table for storing historical metrics
CREATE TABLE IF NOT EXISTS database_metrics (
    id SERIAL PRIMARY KEY,
    database_id VARCHAR(255) NOT NULL,
    cpu_usage DECIMAL(5,2),
    memory_usage DECIMAL(5,2),
    storage_usage DECIMAL(5,2),
    active_connections INTEGER,
    read_iops INTEGER,
    write_iops INTEGER,
    network_in_mbps DECIMAL(8,2),
    network_out_mbps DECIMAL(8,2),
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT fk_metrics_database FOREIGN KEY (database_id) REFERENCES database_services(id) ON DELETE CASCADE
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_database_services_user_id ON database_services(user_id);
CREATE INDEX IF NOT EXISTS idx_database_services_type ON database_services(type);
CREATE INDEX IF NOT EXISTS idx_database_services_status ON database_services(status);
CREATE INDEX IF NOT EXISTS idx_database_services_created_at ON database_services(created_at);

CREATE INDEX IF NOT EXISTS idx_database_backups_database_id ON database_backups(database_id);
CREATE INDEX IF NOT EXISTS idx_database_backups_created_at ON database_backups(created_at);
CREATE INDEX IF NOT EXISTS idx_database_backups_status ON database_backups(status);

CREATE INDEX IF NOT EXISTS idx_database_metrics_database_id ON database_metrics(database_id);
CREATE INDEX IF NOT EXISTS idx_database_metrics_recorded_at ON database_metrics(recorded_at);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_database_services_updated_at 
    BEFORE UPDATE ON database_services 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Insert default settings for existing databases (if any)
INSERT INTO database_settings (database_id)
SELECT id FROM database_services
WHERE id NOT IN (SELECT database_id FROM database_settings);

-- Create view for database statistics
CREATE OR REPLACE VIEW database_stats AS
SELECT 
    ds.id,
    ds.name,
    ds.type,
    ds.status,
    ds.plan,
    ds.region,
    ds.created_at,
    ds.updated_at,
    COUNT(db.id) as backup_count,
    MAX(db.created_at) as last_backup_time,
    dm.cpu_usage as latest_cpu,
    dm.memory_usage as latest_memory,
    dm.storage_usage as latest_storage,
    dm.active_connections as latest_connections,
    dm.recorded_at as metrics_updated_at
FROM database_services ds
LEFT JOIN database_backups db ON ds.id = db.database_id AND db.status = 'completed'
LEFT JOIN database_metrics dm ON ds.id = dm.database_id
LEFT JOIN LATERAL (
    SELECT cpu_usage, memory_usage, storage_usage, active_connections, recorded_at
    FROM database_metrics 
    WHERE database_id = ds.id 
    ORDER BY recorded_at DESC 
    LIMIT 1
) dm ON true
GROUP BY ds.id, ds.name, ds.type, ds.status, ds.plan, ds.region, ds.created_at, ds.updated_at,
         dm.cpu_usage, dm.memory_usage, dm.storage_usage, dm.active_connections, dm.recorded_at;

-- Add RLS (Row Level Security) policies
ALTER TABLE database_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE database_backups ENABLE ROW LEVEL SECURITY;
ALTER TABLE database_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE database_metrics ENABLE ROW LEVEL SECURITY;

-- Policy for database services - users can only see their own databases
CREATE POLICY "Users can view their own database services" ON database_services
    FOR SELECT USING (user_id = current_setting('app.current_user_id', true)::VARCHAR);

CREATE POLICY "Users can insert their own database services" ON database_services
    FOR INSERT WITH CHECK (user_id = current_setting('app.current_user_id', true)::VARCHAR);

CREATE POLICY "Users can update their own database services" ON database_services
    FOR UPDATE USING (user_id = current_setting('app.current_user_id', true)::VARCHAR);

CREATE POLICY "Users can delete their own database services" ON database_services
    FOR DELETE USING (user_id = current_setting('app.current_user_id', true)::VARCHAR);

-- Policies for backups (inherited from database services)
CREATE POLICY "Users can view backups of their own databases" ON database_backups
    FOR SELECT USING (
        database_id IN (
            SELECT id FROM database_services 
            WHERE user_id = current_setting('app.current_user_id', true)::VARCHAR
        )
    );

CREATE POLICY "Users can insert backups for their own databases" ON database_backups
    FOR INSERT WITH CHECK (
        database_id IN (
            SELECT id FROM database_services 
            WHERE user_id = current_setting('app.current_user_id', true)::VARCHAR
        )
    );

-- Policies for settings (inherited from database services)
CREATE POLICY "Users can view settings of their own databases" ON database_settings
    FOR SELECT USING (
        database_id IN (
            SELECT id FROM database_services 
            WHERE user_id = current_setting('app.current_user_id', true)::VARCHAR
        )
    );

CREATE POLICY "Users can update settings of their own databases" ON database_settings
    FOR UPDATE USING (
        database_id IN (
            SELECT id FROM database_services 
            WHERE user_id = current_setting('app.current_user_id', true)::VARCHAR
        )
    );

-- Policies for metrics (inherited from database services)
CREATE POLICY "Users can view metrics of their own databases" ON database_metrics
    FOR SELECT USING (
        database_id IN (
            SELECT id FROM database_services 
            WHERE user_id = current_setting('app.current_user_id', true)::VARCHAR
        )
    );

CREATE POLICY "Users can insert metrics for their own databases" ON database_metrics
    FOR INSERT WITH CHECK (
        database_id IN (
            SELECT id FROM database_services 
            WHERE user_id = current_setting('app.current_user_id', true)::VARCHAR
        )
    );

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON database_services TO authenticated_users;
GRANT SELECT, INSERT, UPDATE ON database_backups TO authenticated_users;
GRANT SELECT, UPDATE ON database_settings TO authenticated_users;
GRANT SELECT, INSERT ON database_metrics TO authenticated_users;
GRANT SELECT ON database_stats TO authenticated_users;

-- Create function to clean up old metrics (older than 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_metrics()
RETURNS void AS $$
BEGIN
    DELETE FROM database_metrics 
    WHERE recorded_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- Create function to schedule next backup
CREATE OR REPLACE FUNCTION schedule_next_backup(database_id_param VARCHAR(255))
RETURNS void AS $$
BEGIN
    UPDATE database_settings 
    SET next_backup_time = NOW() + INTERVAL '24 hours'
    WHERE database_id = database_id_param;
END;
$$ LANGUAGE plpgsql;

-- Create function to update backup status and schedule next backup
CREATE OR REPLACE FUNCTION complete_backup(backup_id_param VARCHAR(255, success_param BOOLEAN))
RETURNS void AS $$
DECLARE
    db_id VARCHAR(255);
BEGIN
    -- Get database_id from backup
    SELECT database_id INTO db_id FROM database_backups WHERE id = backup_id_param;
    
    IF db_id IS NOT NULL THEN
        -- Update backup completion time if successful
        IF success_param THEN
            UPDATE database_backups 
            SET status = 'completed', completed_at = NOW()
            WHERE id = backup_id_param;
            
            -- Update last_backup_time in settings
            UPDATE database_settings 
            SET last_backup_time = NOW()
            WHERE database_id = db_id;
            
            -- Schedule next backup
            PERFORM schedule_next_backup(db_id);
        ELSE
            UPDATE database_backups 
            SET status = 'failed'
            WHERE id = backup_id_param;
        END IF;
    END IF;
END;
$$ LANGUAGE plpgsql;
