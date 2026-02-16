-- Security Features Migration
-- This migration adds tables for security scanning, compliance, and audit logging

-- Security scans table
CREATE TABLE IF NOT EXISTS security_scans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    service_id UUID REFERENCES services(id) ON DELETE CASCADE,
    scan_type VARCHAR(50) NOT NULL CHECK (scan_type IN ('dependency', 'configuration', 'comprehensive')),
    status VARCHAR(50) NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
    started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    summary JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Vulnerabilities table
CREATE TABLE IF NOT EXISTS vulnerabilities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(50) NOT NULL CHECK (type IN ('dependency', 'configuration', 'code')),
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low')),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    service_id UUID REFERENCES services(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'ignored')),
    found_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Compliance frameworks table
CREATE TABLE IF NOT EXISTS compliance_frameworks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    version VARCHAR(20) NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Compliance controls table
CREATE TABLE IF NOT EXISTS compliance_controls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    framework_id UUID NOT NULL REFERENCES compliance_frameworks(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    requirement TEXT,
    test_procedure TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('compliant', 'non_compliant', 'not_applicable', 'pending')),
    last_assessed TIMESTAMP WITH TIME ZONE,
    evidence TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(framework_id, code)
);

-- Compliance reports table
CREATE TABLE IF NOT EXISTS compliance_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    framework_id UUID NOT NULL REFERENCES compliance_frameworks(id) ON DELETE CASCADE,
    assessment_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    assessor VARCHAR(255),
    overall_status VARCHAR(50) NOT NULL CHECK (overall_status IN ('compliant', 'partially_compliant', 'non_compliant', 'in_progress')),
    score INTEGER NOT NULL DEFAULT 0 CHECK (score >= 0 AND score <= 100),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Compliance risks table
CREATE TABLE IF NOT EXISTS compliance_risks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID NOT NULL REFERENCES compliance_reports(id) ON DELETE CASCADE,
    control_id UUID NOT NULL REFERENCES compliance_controls(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    impact VARCHAR(20) NOT NULL CHECK (impact IN ('high', 'medium', 'low')),
    likelihood VARCHAR(20) NOT NULL CHECK (likelihood IN ('high', 'medium', 'low')),
    mitigation TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Audit logs table
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    resource VARCHAR(100) NOT NULL,
    resource_id UUID,
    details JSONB DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    success BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Data retention policies table
CREATE TABLE IF NOT EXISTS data_retention_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    data_type VARCHAR(100) NOT NULL,
    retention_period INTERVAL NOT NULL,
    action VARCHAR(50) NOT NULL CHECK (action IN ('delete', 'anonymize', 'archive')),
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Anonymized data table
CREATE TABLE IF NOT EXISTS anonymized_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    original_id UUID NOT NULL,
    anonymized_id VARCHAR(255) NOT NULL UNIQUE,
    data_type VARCHAR(100) NOT NULL,
    anonymized_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    retained_data TEXT, -- Encrypted non-sensitive data
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_security_scans_project_id ON security_scans(project_id);
CREATE INDEX IF NOT EXISTS idx_security_scans_status ON security_scans(status);
CREATE INDEX IF NOT EXISTS idx_security_scans_started_at ON security_scans(started_at);

CREATE INDEX IF NOT EXISTS idx_vulnerabilities_project_id ON vulnerabilities(project_id);
CREATE INDEX IF NOT EXISTS idx_vulnerabilities_service_id ON vulnerabilities(service_id);
CREATE INDEX IF NOT EXISTS idx_vulnerabilities_severity ON vulnerabilities(severity);
CREATE INDEX IF NOT EXISTS idx_vulnerabilities_status ON vulnerabilities(status);
CREATE INDEX IF NOT EXISTS idx_vulnerabilities_found_at ON vulnerabilities(found_at);

CREATE INDEX IF NOT EXISTS idx_compliance_controls_framework_id ON compliance_controls(framework_id);
CREATE INDEX IF NOT EXISTS idx_compliance_controls_status ON compliance_controls(status);
CREATE INDEX IF NOT EXISTS idx_compliance_controls_last_assessed ON compliance_controls(last_assessed);

CREATE INDEX IF NOT EXISTS idx_compliance_reports_project_id ON compliance_reports(project_id);
CREATE INDEX IF NOT EXISTS idx_compliance_reports_framework_id ON compliance_reports(framework_id);
CREATE INDEX IF NOT EXISTS idx_compliance_reports_assessment_date ON compliance_reports(assessment_date);

CREATE INDEX IF NOT EXISTS idx_compliance_risks_report_id ON compliance_risks(report_id);
CREATE INDEX IF NOT EXISTS idx_compliance_risks_control_id ON compliance_risks(control_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource);

CREATE INDEX IF NOT EXISTS idx_anonymized_data_original_id ON anonymized_data(original_id);
CREATE INDEX IF NOT EXISTS idx_anonymized_data_anonymized_id ON anonymized_data(anonymized_id);
CREATE INDEX IF NOT EXISTS idx_anonymized_data_data_type ON anonymized_data(data_type);

-- Insert default data retention policies
INSERT INTO data_retention_policies (name, data_type, retention_period, action, enabled) VALUES
('User Data Retention', 'user_data', INTERVAL '2 years', 'anonymize', true),
('Analytics Data Retention', 'analytics_data', INTERVAL '6 months', 'delete', true),
('Log Data Retention', 'log_data', INTERVAL '90 days', 'delete', true),
('Deleted User Data', 'deleted_user_data', INTERVAL '30 days', 'delete', true),
('Audit Log Retention', 'audit_log', INTERVAL '1 year', 'archive', true)
ON CONFLICT (name) DO NOTHING;

-- Insert default GDPR framework
INSERT INTO compliance_frameworks (id, name, description, version, enabled) VALUES
('gen_random_uuid()', 'GDPR', 'General Data Protection Regulation compliance framework', '1.0', true)
ON CONFLICT (name) DO UPDATE SET version = '1.0', enabled = true;

-- Update updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_security_scans_updated_at BEFORE UPDATE ON security_scans FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_vulnerabilities_updated_at BEFORE UPDATE ON vulnerabilities FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_compliance_frameworks_updated_at BEFORE UPDATE ON compliance_frameworks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_compliance_controls_updated_at BEFORE UPDATE ON compliance_controls FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_compliance_reports_updated_at BEFORE UPDATE ON compliance_reports FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_compliance_risks_updated_at BEFORE UPDATE ON compliance_risks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_data_retention_policies_updated_at BEFORE UPDATE ON data_retention_policies FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) for audit logs
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Policy for audit logs - users can only see their own audit logs
CREATE POLICY audit_logs_user_policy ON audit_logs
    FOR SELECT USING (user_id = current_setting('app.current_user_id')::UUID);

-- Policy for audit logs - no direct inserts (only through application)
CREATE POLICY audit_logs_insert_policy ON audit_logs
    FOR INSERT WITH CHECK (false);

-- Policy for audit logs - no direct updates (audit logs are immutable)
CREATE POLICY audit_logs_update_policy ON audit_logs
    FOR UPDATE WITH CHECK (false);

-- Row Level Security for anonymized data
ALTER TABLE anonymized_data ENABLE ROW LEVEL SECURITY;

-- Policy for anonymized data - restricted access
CREATE POLICY anonymized_data_policy ON anonymized_data
    FOR SELECT USING (current_setting('app.is_admin', true)::BOOLEAN);

-- Add comments for documentation
COMMENT ON TABLE security_scans IS 'Security scan records for vulnerability assessment';
COMMENT ON TABLE vulnerabilities IS 'Security vulnerabilities found during scans';
COMMENT ON TABLE compliance_frameworks IS 'Compliance frameworks like GDPR, SOC2, etc.';
COMMENT ON TABLE compliance_controls IS 'Individual controls within compliance frameworks';
COMMENT ON TABLE compliance_reports IS 'Compliance assessment reports';
COMMENT ON TABLE compliance_risks IS 'Risk assessments for compliance gaps';
COMMENT ON TABLE audit_logs IS 'Security audit trail for all sensitive operations';
COMMENT ON TABLE data_retention_policies IS 'Data retention and deletion policies';
COMMENT ON TABLE anonymized_data IS 'Anonymized user data for privacy compliance';
