type NodeType = 'github' | 'database' | 'docker' | 'function' | 'bucket' | 'empty';

export interface ServiceNode {
  id: string;
  type: NodeType;
  position: { x: number; y: number };
  data: {
    label: string;
    type: NodeType;
    repo?: string;
    env?: Record<string, string>;
    status?: 'running' | 'building' | 'error' | 'stopped';
  };
}

export interface ServiceEdge {
  id: string;
  source: string;
  target: string;
  type?: 'network' | 'dependency' | 'data';
  animated?: boolean;
}

// Database Types
export interface DatabaseService {
  id: string;
  name: string;
  type: 'postgresql' | 'redis' | 'mysql';
  status: 'running' | 'stopped' | 'building' | 'error';
  version: string;
  plan: 'hobby' | 'starter' | 'standard' | 'business';
  region: string;
  created_at: string;
  updated_at: string;
  connection_url: string;
  metrics: DatabaseMetrics;
  backups: DatabaseBackupConfig;
  settings: DatabaseSettings;
}

export interface DatabaseMetrics {
  cpu: number;
  memory: number;
  storage: number;
  connections: number;
  read_iops: number;
  write_iops: number;
  network_in: number;
  network_out: number;
}

export interface DatabaseBackupConfig {
  enabled: boolean;
  last_backup?: string;
  retention: number;
  next_backup?: string;
  backups: DatabaseBackup[];
}

export interface DatabaseBackup {
  id: string;
  created_at: string;
  size: string;
  status: 'completed' | 'failed' | 'in_progress';
}

export interface DatabaseSettings {
  max_connections: number;
  timeout: number;
  ssl: boolean;
  logging: boolean;
}

export interface DatabaseCreateRequest {
  name: string;
  type: 'postgresql' | 'redis' | 'mysql';
  plan: 'hobby' | 'starter' | 'standard' | 'business';
  region: string;
}

export interface DatabaseUpdateRequest {
  name?: string;
  plan?: 'hobby' | 'starter' | 'standard' | 'business';
}

export interface DatabaseActionRequest {
  action: 'start' | 'stop' | 'restart';
}

export interface DatabaseRestoreRequest {
  database_id: string;
  backup_id: string;
}

// API Types
export interface User {
  id: string;
  email: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

export interface Service {
  id: string;
  project_id: string;
  name: string;
  type: 'web' | 'worker' | 'database' | 'cron';
  status: 'building' | 'running' | 'failed' | 'stopped';
  image: string;
  command: string;
  environment: 'production' | 'preview' | 'development';
  git_repo: string;
  git_branch: string;
  build_path: string;
  cpu: string;
  memory: string;
  created_at: string;
  updated_at: string;
}

export interface CreateServiceRequest {
  project_id: string;
  name: string;
  type: 'web' | 'worker' | 'database' | 'cron';
  image?: string;
  command?: string;
  environment: 'production' | 'preview' | 'development';
  git_repo?: string;
  git_branch?: string;
  build_path?: string;
  cpu?: string;
  memory?: string;
}

export interface UpdateServiceRequest {
  name?: string;
  type?: 'web' | 'worker' | 'database' | 'cron';
  image?: string;
  command?: string;
  environment?: 'production' | 'preview' | 'development';
  git_repo?: string;
  git_branch?: string;
  build_path?: string;
  cpu?: string;
  memory?: string;
}

export interface Deployment {
  id: string;
  service_id: string;
  commit_hash?: string | null;
  status: 'pending' | 'building' | 'deploying' | 'deployed' | 'failed' | 'rolling_back';
  image_name: string;
  image_tag: string;
  build_log: string;
  runtime_log: string;
  error?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface EnvironmentVariable {
  id: string;
  service_id: string;
  key: string;
  value: string;
  is_secret?: boolean;
  created_at: string;
  updated_at: string;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

interface PaginatedResponse<T> {
  items: T[];
  pagination: Pagination;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface PreviewEnvironment {
  id: string;
  project_id: string;
  service_id: string;
  branch_name: string;
  pr_number?: number | null;
  environment: string;
  status: 'building' | 'running' | 'failed' | 'stopped' | 'expired';
  url: string;
  expires_at?: string | null;
  created_at: string;
  updated_at: string;
  service?: {
    id: string;
    name: string;
    type: 'web' | 'worker' | 'database' | 'cron';
  };
  deployment_id?: string;
}

export interface CreatePreviewEnvironmentRequest {
  project_id?: string;
  service_id: string;
  branch_name: string;
  pr_number?: number;
  ttl_hours?: number;
}

export interface UpdatePreviewEnvironmentRequest {
  status?: 'building' | 'running' | 'failed' | 'stopped' | 'expired';
  url?: string;
  expires_at?: string;
  ttl_hours?: number;
}

export interface PromotePreviewRequest {
  target_environment: 'production' | 'development';
  create_backup?: boolean;
}

export interface GitProvider {
  id: string;
  name: string;
  display_name: string;
  created_at: string;
}

export interface GitRepository {
  id: string;
  provider_id: string;
  name: string;
  full_name: string;
  description?: string;
  clone_url: string;
  default_branch: string;
  is_private: boolean;
  provider?: {
    name: string;
    display_name: string;
  };
  created_at: string;
  updated_at?: string;
}

export interface CreateWebhookRequest {
  repo_id: string;
  events: string[];
  branch?: string;
}

export interface Webhook {
  id: string;
  repo_id: string;
  remote_webhook_id: string;
  events: string[];
  branch?: string;
  created_at: string;
}

export interface Branch {
  name: string;
  commit_hash: string;
  is_default: boolean;
}

export interface CronJob {
  id: string;
  project_id: string;
  service_id: string;
  name: string;
  schedule: string;
  command: string;
  timezone: string;
  enabled: boolean;
  last_run?: string;
  next_run?: string;
  created_at: string;
}

export interface CreateCronJobRequest {
  project_id: string;
  service_id: string;
  name: string;
  schedule: string;
  command: string;
  timezone?: string;
  enabled?: boolean;
}

export interface UpdateCronJobRequest {
  name?: string;
  schedule?: string;
  command?: string;
  timezone?: string;
  enabled?: boolean;
}

export interface CronExecution {
  id: string;
  cron_job_id: string;
  status: 'running' | 'completed' | 'failed';
  started_at: string;
  completed_at?: string;
  output?: string;
}

export interface AuditLog {
  id: string;
  resource: string;
  resource_id: string;
  action: string;
  actor_id: string;
  actor_email: string;
  details?: Record<string, unknown>;
  created_at: string;
}

export interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  logo?: string;
  config: Record<string, unknown>;
  variables: TemplateVariable[];
}

interface TemplateVariable {
  name: string;
  label: string;
  type: 'string' | 'number' | 'boolean' | 'select';
  default?: string;
  required: boolean;
  options?: string[];
}

export interface DeployFromTemplateRequest {
  project_id: string;
  name: string;
  variables?: Record<string, string>;
}

export interface CreateDeploymentRequest {
  commit_hash?: string;
  branch?: string;
  trigger?: 'manual' | 'webhook' | 'api' | string;
  env_vars?: Record<string, string>;
}

export interface CreateProviderRequest {
  name: string;
  display_name: string;
  access_token: string;
}

export interface ConnectRepositoryRequest {
  provider_id: string;
  repo_full_name: string;
}

export interface AnalyticsSettings {
  trackingEnabled: boolean;
  dataRetention: number;
  anonymizeIp: boolean;
  respectDoNotTrack: boolean;
  customEvents: string[];
}

export interface UpdateAnalyticsSettingsRequest {
  trackingEnabled?: boolean;
  dataRetention?: number;
  anonymizeIp?: boolean;
  respectDoNotTrack?: boolean;
  customEvents?: string[];
  projectId?: string;
}
