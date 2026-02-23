type NodeType = 'github' | 'database' | 'docker' | 'function' | 'bucket' | 'empty';
export interface ServiceNode {
    id: string;
    type: NodeType;
    position: {
        x: number;
        y: number;
    };
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
    commit_hash?: string;
    status: 'building' | 'deployed' | 'failed' | 'rolling_back';
    created_at: string;
    updated_at: string;
    build_logs?: string[];
    runtime_logs?: string[];
}
export interface EnvironmentVariable {
    id: string;
    service_id: string;
    key: string;
    value: string;
    created_at: string;
    updated_at: string;
}
export {};
