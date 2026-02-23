-- Service Templates
CREATE TABLE IF NOT EXISTS service_templates (
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

-- Cron Jobs
CREATE TABLE IF NOT EXISTS cron_jobs (
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

-- Cron Executions
CREATE TABLE IF NOT EXISTS cron_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cron_job_id UUID NOT NULL REFERENCES cron_jobs(id) ON DELETE CASCADE,
    started_at TIMESTAMP WITH TIME ZONE NOT NULL,
    finished_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(50) DEFAULT 'pending',
    output TEXT,
    error TEXT
);

-- Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    user_email VARCHAR(255),
    resource VARCHAR(50) NOT NULL,
    resource_id VARCHAR(255),
    action VARCHAR(50) NOT NULL,
    details JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_service_templates_category ON service_templates(category);
CREATE INDEX IF NOT EXISTS idx_cron_jobs_project_id ON cron_jobs(project_id);
CREATE INDEX IF NOT EXISTS idx_cron_jobs_service_id ON cron_jobs(service_id);
CREATE INDEX IF NOT EXISTS idx_cron_jobs_next_run ON cron_jobs(next_run_at) WHERE enabled = true;
CREATE INDEX IF NOT EXISTS idx_cron_executions_job_id ON cron_executions(cron_job_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

-- Insert default templates
INSERT INTO service_templates (id, name, description, category, logo, config, variables, is_official)
VALUES 
    ('tpl-nodejs', 'Node.js Application', 'Generic Node.js application with automatic dependency detection', 'web', 'https://cdn.simpleicons.org/node.js', '{"type":"web","runtime":"node","build_command":"npm install && npm run build","start_command":"npm start","port":3000}', '[{"key":"NODE_ENV","label":"Node Environment","default":"production"}]', true),
    ('tpl-react', 'React Application', 'React single-page application with Vite', 'frontend', 'https://cdn.simpleicons.org/react', '{"type":"web","runtime":"node","build_command":"npm install && npm run build","start_command":"npx serve -s dist","port":3000}', '[{"key":"VITE_API_URL","label":"API URL"}]', true),
    ('tpl-python', 'Python Application', 'Python application with FastAPI/Flask support', 'web', 'https://cdn.simpleicons.org/python', '{"type":"web","runtime":"python","build_command":"pip install -r requirements.txt","start_command":"python main.py","port":8000}', '[{"key":"PYTHON_VERSION","label":"Python Version","default":"3.11"}]', true),
    ('tpl-go', 'Go Application', 'Go backend service', 'web', 'https://cdn.simpleicons.org/go', '{"type":"web","runtime":"go","build_command":"go build -o app .","start_command":"./app","port":8080}', '[]', true),
    ('tpl-postgres', 'PostgreSQL Database', 'Managed PostgreSQL database', 'database', 'https://cdn.simpleicons.org/postgresql', '{"type":"database","runtime":"postgres","port":5432}', '[{"key":"POSTGRES_USER","label":"Username"},{"key":"POSTGRES_PASSWORD","label":"Password","secret":true}]', true),
    ('tpl-redis', 'Redis Cache', 'In-memory data store', 'database', 'https://cdn.simpleicons.org/redis', '{"type":"database","runtime":"redis","port":6379}', '[{"key":"REDIS_PASSWORD","label":"Password","secret":true}]', true),
    ('tpl-mongodb', 'MongoDB Database', 'NoSQL document database', 'database', 'https://cdn.simpleicons.org/mongodb', '{"type":"database","runtime":"mongodb","port":27017}', '[{"key":"MONGO_INITDB_ROOT_USERNAME","label":"Username"},{"key":"MONGO_INITDB_ROOT_PASSWORD","label":"Password","secret":true}]', true),
    ('tpl-worker', 'Background Worker', 'Background job processing service', 'worker', 'https://cdn.simpleicons.org/terminal', '{"type":"worker","runtime":"node","build_command":"npm install","start_command":"npm run worker"}', '[{"key":"WORKER_CONCURRENCY","label":"Concurrency","default":"4"}]', true),
    ('tpl-docker', 'Docker Image', 'Deploy from any Docker image', 'custom', 'https://cdn.simpleicons.org/docker', '{"type":"web","runtime":"docker","port":80}', '[{"key":"IMAGE","label":"Docker Image","required":true}]', true)
ON CONFLICT (id) DO NOTHING;

-- Triggers for updated_at
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_cron_jobs_updated_at') THEN
        CREATE TRIGGER update_cron_jobs_updated_at BEFORE UPDATE ON cron_jobs
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;
