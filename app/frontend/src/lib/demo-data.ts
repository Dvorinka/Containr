import type {
  BuildEntity,
  CronJobEntity,
  DatabaseEntity,
  FailoverPolicy,
  HAAlert,
  HAHealthResult,
  HAStatus,
  HostMonitoring,
  ProjectEntity,
  SecurityMetrics,
  SecurityScan,
  ServiceEntity,
  TemplateDetailEntity,
  TemplateEntity,
  Vulnerability,
} from '@/lib/api-client';
import type { ServiceVariable } from '@/features/workspace/auto-connections';

export const demoProjects: ProjectEntity[] = [
  {
    id: 'demo-project-core',
    name: 'Core Platform',
     description: 'Primary production workload with web, API, queue, and data services.',
    isApproved: true,
    createdAt: '2026-03-12T09:30:00Z',
    updatedAt: '2026-03-31T09:10:00Z',
    stats: {
      service_count: 4,
      deployment_count: 27,
      running_services: 3,
      last_deployment: '2026-03-31T08:42:00Z',
    },
  },
  {
    id: 'demo-project-growth',
    name: 'Growth Surface',
     description: 'Landing pages and campaign services for growth experiments.',
    isApproved: true,
    createdAt: '2026-03-01T14:05:00Z',
    updatedAt: '2026-03-30T16:44:00Z',
    stats: {
      service_count: 3,
      deployment_count: 14,
      running_services: 3,
      last_deployment: '2026-03-30T15:01:00Z',
    },
  },
  {
    id: 'demo-project-ml',
    name: 'Inference Lab',
     description: 'Internal inference jobs and model-serving edge services.',
    isApproved: true,
    createdAt: '2026-02-18T07:12:00Z',
    updatedAt: '2026-03-29T19:22:00Z',
    stats: {
      service_count: 2,
      deployment_count: 9,
      running_services: 1,
      last_deployment: '2026-03-29T18:06:00Z',
    },
  },
];

export const demoServicesByProject: Record<string, ServiceEntity[]> = {
  'demo-project-core': [
    {
      id: 'demo-svc-web',
      projectId: 'demo-project-core',
      name: 'Web Frontend',
      type: 'web',
      status: 'running',
      environment: 'production',
      image: 'ghcr.io/containr/web:2026.03.31',
      command: 'npm run serve',
      gitBranch: 'main',
      createdAt: '2026-03-12T10:00:00Z',
      updatedAt: '2026-03-31T08:42:00Z',
    },
    {
      id: 'demo-svc-api',
      projectId: 'demo-project-core',
      name: 'API Gateway',
      type: 'web',
      status: 'running',
      environment: 'production',
      image: 'ghcr.io/containr/api:2026.03.31',
      command: './server',
      gitBranch: 'main',
      createdAt: '2026-03-12T10:02:00Z',
      updatedAt: '2026-03-31T08:43:00Z',
    },
    {
      id: 'demo-svc-worker',
      projectId: 'demo-project-core',
      name: 'Queue Worker',
      type: 'worker',
      status: 'building',
      environment: 'production',
      image: 'ghcr.io/containr/worker:2026.03.31',
      command: './worker',
      gitBranch: 'main',
      createdAt: '2026-03-12T10:05:00Z',
      updatedAt: '2026-03-31T08:44:00Z',
    },
    {
      id: 'demo-svc-postgres',
      projectId: 'demo-project-core',
      name: 'Postgres',
      type: 'database',
      status: 'running',
      environment: 'production',
      image: 'postgres:15-alpine',
      command: 'postgres',
      gitBranch: 'main',
      createdAt: '2026-03-12T10:08:00Z',
      updatedAt: '2026-03-31T08:40:00Z',
    },
  ],
  'demo-project-growth': [
    {
      id: 'demo-growth-site',
      projectId: 'demo-project-growth',
      name: 'Marketing Site',
      type: 'web',
      status: 'running',
      environment: 'production',
      image: 'ghcr.io/containr/marketing:latest',
      command: 'npm run start',
      gitBranch: 'main',
      createdAt: '2026-03-03T09:00:00Z',
      updatedAt: '2026-03-30T12:10:00Z',
    },
    {
      id: 'demo-growth-api',
      projectId: 'demo-project-growth',
      name: 'Campaign API',
      type: 'web',
      status: 'running',
      environment: 'production',
      image: 'ghcr.io/containr/campaign-api:latest',
      command: './api',
      gitBranch: 'main',
      createdAt: '2026-03-03T09:04:00Z',
      updatedAt: '2026-03-30T12:08:00Z',
    },
    {
      id: 'demo-growth-cache',
      projectId: 'demo-project-growth',
      name: 'Redis Cache',
      type: 'database',
      status: 'running',
      environment: 'production',
      image: 'redis:7-alpine',
      command: 'redis-server',
      gitBranch: 'main',
      createdAt: '2026-03-03T09:07:00Z',
      updatedAt: '2026-03-30T12:07:00Z',
    },
  ],
  'demo-project-ml': [
    {
      id: 'demo-ml-api',
      projectId: 'demo-project-ml',
      name: 'Inference API',
      type: 'web',
      status: 'running',
      environment: 'production',
      image: 'ghcr.io/containr/inference-api:latest',
      command: './serve',
      gitBranch: 'main',
      createdAt: '2026-02-18T08:00:00Z',
      updatedAt: '2026-03-29T18:00:00Z',
    },
    {
      id: 'demo-ml-worker',
      projectId: 'demo-project-ml',
      name: 'Batch Evaluator',
      type: 'worker',
      status: 'failed',
      environment: 'production',
      image: 'ghcr.io/containr/evaluator:latest',
      command: './run-jobs',
      gitBranch: 'main',
      createdAt: '2026-02-18T08:03:00Z',
      updatedAt: '2026-03-29T19:22:00Z',
    },
  ],
};

const allServices = Object.values(demoServicesByProject).flat();

export const demoVariablesByProject: Record<string, Record<string, ServiceVariable[]>> = {
  'demo-project-core': {
    'demo-svc-web': (
      [
      { key: 'API_BASE_URL', value: '{{api_gateway_url}}', isSecret: false },
      { key: 'CACHE_URL', value: '{{redis_url}}', isSecret: false },
      ] satisfies ServiceVariable[]
    ),
    'demo-svc-api': (
      [
      { key: 'DATABASE_URL', value: '{{db_url}}', isSecret: true },
      { key: 'REDIS_URL', value: '{{redis_url}}', isSecret: true },
      ] satisfies ServiceVariable[]
    ),
    'demo-svc-worker': (
      [
      { key: 'DATABASE_URL', value: '{{postgres_url}}', isSecret: true },
      { key: 'QUEUE_BACKEND', value: '{{api_gateway_host}}', isSecret: false },
      ] satisfies ServiceVariable[]
    ),
    'demo-svc-postgres': [],
  },
  'demo-project-growth': {
    'demo-growth-site': (
      [
      { key: 'CAMPAIGN_API_URL', value: '{{campaign_api_url}}', isSecret: false },
      ] satisfies ServiceVariable[]
    ),
    'demo-growth-api': (
      [
      { key: 'REDIS_URL', value: '{{redis_cache_url}}', isSecret: true },
      ] satisfies ServiceVariable[]
    ),
    'demo-growth-cache': [],
  },
  'demo-project-ml': {
    'demo-ml-api': [],
    'demo-ml-worker': (
      [
      { key: 'MODEL_API_URL', value: '{{inference_api_url}}', isSecret: false },
      ] satisfies ServiceVariable[]
    ),
  },
};

export function getDemoProjectById(projectId: string): ProjectEntity | undefined {
  return demoProjects.find((project) => project.id === projectId);
}

export function getDemoServicesByProject(projectId: string): ServiceEntity[] {
  return demoServicesByProject[projectId] ?? [];
}

export function getDemoServiceById(serviceId: string): ServiceEntity | undefined {
  return allServices.find((service) => service.id === serviceId);
}

export function getDemoVariablesByProject(projectId: string): Record<string, ServiceVariable[]> {
  return demoVariablesByProject[projectId] ?? {};
}

export const demoDatabases: DatabaseEntity[] = [
  {
    id: 'demo-db-postgres',
    name: 'core-postgres',
    type: 'postgresql',
    status: 'running',
    connection_url: 'postgres://demo:***@core-postgres.internal:5432/app',
    version: '16.4',
    plan: 'standard',
    region: 'local',
    backup_schedule: '0 3 * * *',
    next_backup_at: '2026-04-01T03:00:00Z',
    created_at: '2026-03-12T10:05:00Z',
  },
  {
    id: 'demo-db-redis',
    name: 'cache-redis',
    type: 'redis',
    status: 'running',
    connection_url: 'redis://:***@cache-redis.internal:6379',
    version: '7.4',
    plan: 'hobby',
    region: 'local',
    created_at: '2026-03-12T10:12:00Z',
  },
  {
    id: 'demo-db-analytics',
    name: 'analytics-clickhouse',
    type: 'clickhouse',
    status: 'stopped',
    connection_url: 'clickhouse://analytics.internal:9000/default',
    version: '25.3',
    plan: 'business',
    region: 'local',
    created_at: '2026-02-18T08:00:00Z',
  },
];

export const demoCronJobsByService: Record<string, CronJobEntity[]> = {
  'demo-svc-worker': [
    {
      id: 'demo-cron-cleanup',
      project_id: 'demo-project-core',
      service_id: 'demo-svc-worker',
      name: 'Nightly cleanup',
      schedule: '0 2 * * *',
      command: 'npm run cleanup:expired',
      timezone: 'UTC',
      enabled: true,
      last_run_at: '2026-03-31T02:00:00Z',
      next_run_at: '2026-04-01T02:00:00Z',
      last_status: 'success',
      retention: 50,
      created_at: '2026-03-12T10:20:00Z',
      updated_at: '2026-03-31T02:00:00Z',
    },
    {
      id: 'demo-cron-report',
      project_id: 'demo-project-core',
      service_id: 'demo-svc-worker',
      name: 'Hourly metrics rollup',
      schedule: '15 * * * *',
      command: 'npm run metrics:rollup',
      timezone: 'UTC',
      enabled: true,
      last_run_at: '2026-03-31T09:15:00Z',
      next_run_at: '2026-03-31T10:15:00Z',
      last_status: 'success',
      retention: 50,
      created_at: '2026-03-12T10:21:00Z',
      updated_at: '2026-03-31T09:15:00Z',
    },
  ],
  'demo-svc-api': [
    {
      id: 'demo-cron-warmup',
      project_id: 'demo-project-core',
      service_id: 'demo-svc-api',
      name: 'Cache warmup',
      schedule: '*/10 * * * *',
      command: 'curl -sf http://localhost:8080/warm',
      timezone: 'UTC',
      enabled: false,
      last_run_at: '2026-03-30T22:10:00Z',
      next_run_at: '2026-03-30T22:20:00Z',
      last_status: 'failed',
      last_output: 'curl: (7) Failed to connect to localhost port 8080',
      retention: 50,
      created_at: '2026-03-12T10:22:00Z',
      updated_at: '2026-03-30T22:10:00Z',
    },
  ],
};

export function getDemoCronJobsByService(serviceId: string): CronJobEntity[] {
  return demoCronJobsByService[serviceId] ?? [];
}

export const demoBuilds: BuildEntity[] = [
  {
    id: 'demo-build-api',
    projectId: 'demo-project-core',
    serviceId: 'demo-svc-api',
    status: 'success',
    progress: 100,
    startedAt: new Date(Date.now() - 20 * 60_000).toISOString(),
    completedAt: new Date(Date.now() - 18 * 60_000).toISOString(),
    imageName: 'ghcr.io/containr/api-gateway',
    imageTag: 'sha-1f2e3d4',
    size: 156_000_000,
    log: '[demo] Build finished successfully.',
    metadata: { branch: 'main' },
  },
  {
    id: 'demo-build-worker',
    projectId: 'demo-project-core',
    serviceId: 'demo-svc-worker',
    status: 'running',
    progress: 54,
    startedAt: new Date(Date.now() - 2 * 60_000).toISOString(),
    imageName: 'ghcr.io/containr/queue-worker',
    imageTag: 'sha-9a8b7c6',
    size: 0,
    log: '[demo] Building image layers...',
    metadata: { branch: 'feature/queue' },
  },
  {
    id: 'demo-build-site',
    projectId: 'demo-project-growth',
    serviceId: 'demo-growth-site',
    status: 'success',
    progress: 100,
    startedAt: new Date(Date.now() - 3 * 3_600_000).toISOString(),
    completedAt: new Date(Date.now() - 3 * 3_600_000 + 95_000).toISOString(),
    imageName: 'ghcr.io/containr/marketing-site',
    imageTag: 'sha-77aa1c0',
    size: 89_000_000,
    log: '[demo] Build finished successfully.',
    metadata: { branch: 'main' },
  },
  {
    id: 'demo-build-ml',
    projectId: 'demo-project-ml',
    serviceId: 'demo-ml-worker',
    status: 'failed',
    progress: 71,
    startedAt: new Date(Date.now() - 26 * 3_600_000).toISOString(),
    completedAt: new Date(Date.now() - 26 * 3_600_000 + 240_000).toISOString(),
    imageName: 'ghcr.io/containr/batch-evaluator',
    imageTag: 'sha-3d4e5f6',
    size: 0,
    error: 'pip install failed: could not resolve torch==2.4.0',
    log: '[demo] ERROR: dependency resolution failed.',
    metadata: { branch: 'experiment/eval-v2' },
  },
];

export const demoHostMonitoring: HostMonitoring = {
  hostname: 'containr-node-1',
  os: 'linux',
  architecture: 'amd64',
  cpu: { cores: 16 },
  memory: {
    total: 13.5 * 1024 * 1024 * 1024,
    used: 9.8 * 1024 * 1024 * 1024,
    available: 3.7 * 1024 * 1024 * 1024,
    usagePercent: 72,
  },
  storage: {
    path: '/var/lib/containr',
    total: 465 * 1024 * 1024 * 1024,
    used: 338 * 1024 * 1024 * 1024,
    available: 127 * 1024 * 1024 * 1024,
    usagePercent: 73,
  },
  load: { load1m: 2.2, load5m: 2.6, load15m: 2.4 },
  uptimeSeconds: 1_828_800,
  dockerAvailable: true,
  docker: { containers: 11, images: 34, driver: 'overlay2', server: '27.3.1' },
  collectedAt: new Date().toISOString(),
};

export const demoHAStatus: HAStatus = {
  enabled: true,
  nodes: { total: 3, healthy: 3, unhealthy: 0 },
  health_checks: { total: 6, healthy: 5, unhealthy: 1 },
  alerts: { active: 1 },
};

export const demoHAAlerts: HAAlert[] = [
  {
    id: 'demo-alert-worker-heartbeat',
    rule_id: 'health-check-failing',
    status: 'firing',
    severity: 'warning',
    message: 'Health check failing for demo-svc-worker — 2 consecutive misses',
    starts_at: new Date(Date.now() - 14 * 60_000).toISOString(),
  },
];

export const demoHAPolicies: FailoverPolicy[] = [
  {
    service_id: 'demo-svc-api',
    enabled: true,
    failover_strategy: 'active_passive',
    min_healthy_nodes: 1,
    max_failures: 3,
  },
  {
    service_id: 'demo-svc-postgres',
    enabled: true,
    failover_strategy: 'graceful',
    min_healthy_nodes: 1,
    max_failures: 2,
  },
];

export const demoHAHealthResults: HAHealthResult[] = [
  {
    check_id: 'demo-svc-api:http',
    status: 'healthy',
    message: 'GET /healthz returned 200',
    latency: 42_000_000,
    timestamp: new Date(Date.now() - 30_000).toISOString(),
  },
  {
    check_id: 'demo-svc-postgres:tcp',
    status: 'healthy',
    message: 'TCP connect to :5432 succeeded',
    latency: 8_000_000,
    timestamp: new Date(Date.now() - 45_000).toISOString(),
  },
  {
    check_id: 'demo-svc-worker:exec',
    status: 'unhealthy',
    message: 'Heartbeat file stale — last write 4m ago',
    latency: 0,
    timestamp: new Date(Date.now() - 60_000).toISOString(),
  },
];

export const demoSecurityMetrics: SecurityMetrics = {
  security_score: 86,
  vulnerabilities: { total: 5, critical: 0, high: 1, medium: 2, low: 2, open: 3, resolved: 2 },
  latest_scan: {
    id: 'demo-scan-latest',
    score: 86,
    status: 'completed',
    scanned_at: new Date(Date.now() - 5 * 3_600_000).toISOString(),
  },
  compliance: { overall_status: 'assessed', score: 92, last_assessed: new Date(Date.now() - 2 * 86_400_000).toISOString() },
};

export const demoVulnerabilities: Vulnerability[] = [
  {
    id: 'demo-vuln-1',
    type: 'dependency',
    severity: 'high',
    title: 'openssl 3.0.13 — CVE-2024-5535',
    description: 'API Gateway base image ships an openssl release with a known TLS session-ticket flaw.',
    service_id: 'demo-svc-api',
    project_id: 'demo-project-core',
    status: 'open',
    found_at: new Date(Date.now() - 5 * 3_600_000).toISOString(),
  },
  {
    id: 'demo-vuln-2',
    type: 'configuration',
    severity: 'medium',
    title: 'Postgres listens on 0.0.0.0',
    description: 'Database port is bound on all interfaces; restrict to the internal network.',
    service_id: 'demo-svc-postgres',
    project_id: 'demo-project-core',
    status: 'open',
    found_at: new Date(Date.now() - 5 * 3_600_000).toISOString(),
  },
  {
    id: 'demo-vuln-3',
    type: 'dependency',
    severity: 'low',
    title: 'express 4.19.x — outdated minor',
    description: 'A newer patch release is available for the web frontend dependency.',
    service_id: 'demo-svc-web',
    project_id: 'demo-project-core',
    status: 'open',
    found_at: new Date(Date.now() - 2 * 86_400_000).toISOString(),
  },
  {
    id: 'demo-vuln-4',
    type: 'dependency',
    severity: 'medium',
    title: 'redis 7.2.3 — CVE-2024-31227',
    description: 'Resolved by upgrading the cache image to 7.2.5.',
    service_id: 'demo-growth-cache',
    project_id: 'demo-project-growth',
    status: 'resolved',
    found_at: new Date(Date.now() - 9 * 86_400_000).toISOString(),
    resolved_at: new Date(Date.now() - 6 * 86_400_000).toISOString(),
  },
];

export const demoSecurityScans: SecurityScan[] = [
  {
    id: 'demo-scan-1',
    project_id: 'demo-project-core',
    scan_type: 'comprehensive',
    status: 'completed',
    findings_count: 3,
    started_at: new Date(Date.now() - 5 * 3_600_000).toISOString(),
    completed_at: new Date(Date.now() - 5 * 3_600_000 + 48_000).toISOString(),
  },
  {
    id: 'demo-scan-2',
    project_id: 'demo-project-core',
    service_id: 'demo-svc-api',
    scan_type: 'dependency',
    status: 'completed',
    findings_count: 1,
    started_at: new Date(Date.now() - 2 * 86_400_000).toISOString(),
    completed_at: new Date(Date.now() - 2 * 86_400_000 + 31_000).toISOString(),
  },
  {
    id: 'demo-scan-3',
    project_id: 'demo-project-core',
    scan_type: 'configuration',
    status: 'failed',
    findings_count: 0,
    started_at: new Date(Date.now() - 4 * 86_400_000).toISOString(),
    completed_at: new Date(Date.now() - 4 * 86_400_000 + 12_000).toISOString(),
  },
];

export const demoTemplates: TemplateEntity[] = [
  {
    id: 'tpl-react',
    name: 'React Application',
    description: 'Single-page frontend with Vite and static serving runtime.',
    category: 'frontend',
    logo: 'https://cdn.simpleicons.org/react',
    configRaw: '{"runtime":"node"}',
    variablesRaw: '[]',
    isOfficial: true,
    ownerId: null,
  },
  {
    id: 'tpl-go',
    name: 'Go API Service',
    description: 'API-ready Go runtime with direct binary startup.',
    category: 'web',
    logo: 'https://cdn.simpleicons.org/go',
    configRaw: '{"runtime":"go"}',
    variablesRaw: '[]',
    isOfficial: true,
    ownerId: null,
  },
  {
    id: 'tpl-postgres',
    name: 'PostgreSQL Database',
    description: 'Managed PostgreSQL service with credential setup variables.',
    category: 'database',
    logo: 'https://cdn.simpleicons.org/postgresql',
    configRaw: '{"runtime":"postgres"}',
    variablesRaw: '[]',
    isOfficial: true,
    ownerId: null,
  },
  {
    id: 'tpl-mysql',
    name: 'MySQL Database',
    description: 'Managed MySQL service for transactional workloads.',
    category: 'database',
    logo: 'https://cdn.simpleicons.org/mysql',
    configRaw: '{"runtime":"mysql"}',
    variablesRaw: '[]',
    isOfficial: true,
    ownerId: null,
  },
  {
    id: 'tpl-mariadb',
    name: 'MariaDB Database',
    description: 'Managed MariaDB service with MySQL compatibility.',
    category: 'database',
    logo: 'https://cdn.simpleicons.org/mariadb',
    configRaw: '{"runtime":"mariadb"}',
    variablesRaw: '[]',
    isOfficial: true,
    ownerId: null,
  },
  {
    id: 'tpl-clickhouse',
    name: 'ClickHouse Database',
    description: 'Columnar analytics database template for high-speed queries.',
    category: 'database',
    logo: 'https://cdn.simpleicons.org/clickhouse',
    configRaw: '{"runtime":"clickhouse"}',
    variablesRaw: '[]',
    isOfficial: true,
    ownerId: null,
  },
  {
    id: 'tpl-dragonfly',
    name: 'Dragonfly Database',
    description: 'Redis-compatible in-memory store powered by Dragonfly.',
    category: 'database',
    logo: 'https://cdn.simpleicons.org/redis',
    configRaw: '{"runtime":"dragonfly"}',
    variablesRaw: '[]',
    isOfficial: true,
    ownerId: null,
  },
];

export const demoTemplateDetails: Record<string, TemplateDetailEntity> = {
  'tpl-react': {
    template: demoTemplates[0],
    config: {
      type: 'web',
      runtime: 'node',
      buildCommand: 'npm install && npm run build',
      startCommand: 'npx serve -s dist',
      port: 3000,
      healthCheck: '/health',
      environment: {},
      nixpacksConfig: {},
    },
    variables: [
      {
        key: 'VITE_API_URL',
        label: 'API URL',
        defaultValue: 'https://api.example.com',
        required: true,
        secret: false,
        description: 'Public API endpoint for frontend calls',
      },
    ],
  },
  'tpl-go': {
    template: demoTemplates[1],
    config: {
      type: 'web',
      runtime: 'go',
      buildCommand: 'go build -o app .',
      startCommand: './app',
      port: 8080,
      healthCheck: '/health',
      environment: {},
      nixpacksConfig: {},
    },
    variables: [
      {
        key: 'GO_ENV',
        label: 'Go Environment',
        defaultValue: 'production',
        required: false,
        secret: false,
        description: 'Runtime environment value',
      },
    ],
  },
  'tpl-postgres': {
    template: demoTemplates[2],
    config: {
      type: 'database',
      runtime: 'postgres',
      buildCommand: '',
      startCommand: '',
      port: 5432,
      healthCheck: '',
      environment: {},
      nixpacksConfig: {},
    },
    variables: [
      {
        key: 'POSTGRES_USER',
        label: 'Username',
        defaultValue: 'postgres',
        required: true,
        secret: false,
        description: 'Database user',
      },
      {
        key: 'POSTGRES_PASSWORD',
        label: 'Password',
        defaultValue: '',
        required: true,
        secret: true,
        description: 'Database password',
      },
    ],
  },
  'tpl-mysql': {
    template: demoTemplates[3],
    config: {
      type: 'database',
      runtime: 'mysql',
      buildCommand: '',
      startCommand: '',
      port: 3306,
      healthCheck: '',
      environment: {},
      nixpacksConfig: {},
    },
    variables: [
      {
        key: 'MYSQL_DATABASE',
        label: 'Database Name',
        defaultValue: 'app',
        required: true,
        secret: false,
        description: 'Initial database to create',
      },
      {
        key: 'MYSQL_USER',
        label: 'Username',
        defaultValue: 'app',
        required: true,
        secret: false,
        description: 'Application DB user',
      },
      {
        key: 'MYSQL_PASSWORD',
        label: 'User Password',
        defaultValue: '',
        required: true,
        secret: true,
        description: 'Application DB password',
      },
      {
        key: 'MYSQL_ROOT_PASSWORD',
        label: 'Root Password',
        defaultValue: '',
        required: true,
        secret: true,
        description: 'Root account password',
      },
    ],
  },
  'tpl-mariadb': {
    template: demoTemplates[4],
    config: {
      type: 'database',
      runtime: 'mariadb',
      buildCommand: '',
      startCommand: '',
      port: 3306,
      healthCheck: '',
      environment: {},
      nixpacksConfig: {},
    },
    variables: [
      {
        key: 'MARIADB_DATABASE',
        label: 'Database Name',
        defaultValue: 'app',
        required: true,
        secret: false,
        description: 'Initial database to create',
      },
      {
        key: 'MARIADB_USER',
        label: 'Username',
        defaultValue: 'app',
        required: true,
        secret: false,
        description: 'Application DB user',
      },
      {
        key: 'MARIADB_PASSWORD',
        label: 'User Password',
        defaultValue: '',
        required: true,
        secret: true,
        description: 'Application DB password',
      },
      {
        key: 'MARIADB_ROOT_PASSWORD',
        label: 'Root Password',
        defaultValue: '',
        required: true,
        secret: true,
        description: 'Root account password',
      },
    ],
  },
  'tpl-clickhouse': {
    template: demoTemplates[5],
    config: {
      type: 'database',
      runtime: 'clickhouse',
      buildCommand: '',
      startCommand: '',
      port: 8123,
      healthCheck: '',
      environment: {},
      nixpacksConfig: {},
    },
    variables: [
      {
        key: 'CLICKHOUSE_DB',
        label: 'Database Name',
        defaultValue: 'app',
        required: false,
        secret: false,
        description: 'Default database name',
      },
      {
        key: 'CLICKHOUSE_USER',
        label: 'Username',
        defaultValue: 'default',
        required: false,
        secret: false,
        description: 'ClickHouse user',
      },
      {
        key: 'CLICKHOUSE_PASSWORD',
        label: 'Password',
        defaultValue: '',
        required: false,
        secret: true,
        description: 'ClickHouse password',
      },
    ],
  },
  'tpl-dragonfly': {
    template: demoTemplates[6],
    config: {
      type: 'database',
      runtime: 'dragonfly',
      buildCommand: '',
      startCommand: '',
      port: 6379,
      healthCheck: '',
      environment: {},
      nixpacksConfig: {},
    },
    variables: [
      {
        key: 'DRAGONFLY_PASSWORD',
        label: 'Password',
        defaultValue: '',
        required: false,
        secret: true,
        description: 'Optional Redis-compatible password',
      },
    ],
  },
};
