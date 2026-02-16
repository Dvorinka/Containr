-- Git integration schema for Containr platform
-- This migration adds tables for Git providers, repositories, and webhooks

-- Git providers table (GitHub, GitLab, Bitbucket accounts)
CREATE TABLE IF NOT EXISTS git_providers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) NOT NULL, -- 'github', 'gitlab', 'bitbucket'
    display_name VARCHAR(255) NOT NULL, -- User-friendly name for the account
    api_url VARCHAR(500) NOT NULL,
    webhook_url VARCHAR(500) NOT NULL,
    access_token TEXT NOT NULL, -- Encrypted in production
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(name, user_id)
);

-- Git repositories table (connected repositories)
CREATE TABLE IF NOT EXISTS git_repositories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id UUID NOT NULL REFERENCES git_providers(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    full_name VARCHAR(500) NOT NULL, -- e.g., "owner/repo-name"
    description TEXT,
    clone_url VARCHAR(500) NOT NULL,
    webhook_url VARCHAR(500), -- Webhook URL on the Git provider
    default_branch VARCHAR(100) DEFAULT 'main',
    is_private BOOLEAN DEFAULT false,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(provider_id, full_name)
);

-- Git webhooks table (webhook configurations)
CREATE TABLE IF NOT EXISTS git_webhooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    repo_id UUID NOT NULL REFERENCES git_repositories(id) ON DELETE CASCADE,
    provider_id UUID NOT NULL REFERENCES git_providers(id) ON DELETE CASCADE,
    events TEXT NOT NULL, -- JSON array of webhook events
    webhook_secret TEXT NOT NULL, -- Secret for validating webhook payloads
    remote_webhook_id VARCHAR(255), -- Webhook ID on the Git provider
    active BOOLEAN DEFAULT true,
    branch_filter VARCHAR(100), -- Optional branch filter for deployments
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(repo_id, provider_id)
);

-- Git branches table (for tracking branch-specific deployments)
CREATE TABLE IF NOT EXISTS git_branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    repo_id UUID NOT NULL REFERENCES git_repositories(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL, -- Branch name
    last_commit_hash VARCHAR(100),
    last_commit_message TEXT,
    last_commit_author VARCHAR(255),
    last_commit_date TIMESTAMP WITH TIME ZONE,
    is_protected BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(repo_id, name)
);

-- Git deployment triggers table (links webhooks to services)
CREATE TABLE IF NOT EXISTS git_deployment_triggers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    webhook_id UUID NOT NULL REFERENCES git_webhooks(id) ON DELETE CASCADE,
    service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    branch VARCHAR(255) NOT NULL, -- Branch to trigger deployment for
    environment VARCHAR(50) NOT NULL, -- Target environment
    auto_deploy BOOLEAN DEFAULT false, -- Whether to auto-deploy on push
    build_command TEXT,
    start_command TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(webhook_id, service_id, branch)
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_git_providers_user_id ON git_providers(user_id);
CREATE INDEX IF NOT EXISTS idx_git_providers_name ON git_providers(name);
CREATE INDEX IF NOT EXISTS idx_git_repositories_provider_id ON git_repositories(provider_id);
CREATE INDEX IF NOT EXISTS idx_git_repositories_user_id ON git_repositories(user_id);
CREATE INDEX IF NOT EXISTS idx_git_repositories_full_name ON git_repositories(full_name);
CREATE INDEX IF NOT EXISTS idx_git_webhooks_repo_id ON git_webhooks(repo_id);
CREATE INDEX IF NOT EXISTS idx_git_webhooks_provider_id ON git_webhooks(provider_id);
CREATE INDEX IF NOT EXISTS idx_git_webhooks_active ON git_webhooks(active);
CREATE INDEX IF NOT EXISTS idx_git_branches_repo_id ON git_branches(repo_id);
CREATE INDEX IF NOT EXISTS idx_git_branches_name ON git_branches(name);
CREATE INDEX IF NOT EXISTS idx_git_deployment_triggers_webhook_id ON git_deployment_triggers(webhook_id);
CREATE INDEX IF NOT EXISTS idx_git_deployment_triggers_service_id ON git_deployment_triggers(service_id);
CREATE INDEX IF NOT EXISTS idx_git_deployment_triggers_branch ON git_deployment_triggers(branch);

-- Add update triggers to new tables
CREATE TRIGGER update_git_providers_updated_at BEFORE UPDATE ON git_providers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_git_repositories_updated_at BEFORE UPDATE ON git_repositories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_git_webhooks_updated_at BEFORE UPDATE ON git_webhooks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_git_branches_updated_at BEFORE UPDATE ON git_branches
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_git_deployment_triggers_updated_at BEFORE UPDATE ON git_deployment_triggers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add foreign key constraint for project_members table if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'project_members_user_id_fkey'
    ) THEN
        ALTER TABLE project_members 
        ADD CONSTRAINT project_members_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
END
$$;
