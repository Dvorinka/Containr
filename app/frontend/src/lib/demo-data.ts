import type { CronJobEntity, DatabaseEntity, ProjectEntity, ServiceEntity } from '@/lib/api-client';
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
      service_count: 5,
      deployment_count: 27,
      running_services: 4,
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
      image: 'ghcr.io/containr/web-react:v42',
      command: 'npm run serve',
      gitBranch: 'main',
      port: 3000,
      domain: 'web.containr.local',
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
      image: 'ghcr.io/containr/api-go:v2.4.1',
      command: './server',
      gitBranch: 'main',
      port: 8080,
      domain: 'api.containr.local',
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
      image: 'ghcr.io/containr/worker:edge',
      command: './worker',
      gitBranch: 'main',
      port: 9100,
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
      image: 'postgres:16',
      command: 'postgres',
      gitBranch: 'main',
      port: 5432,
      createdAt: '2026-03-12T10:08:00Z',
      updatedAt: '2026-03-31T08:40:00Z',
    },
    {
      id: 'demo-svc-redis',
      projectId: 'demo-project-core',
      name: 'Redis Cache',
      type: 'database',
      status: 'running',
      environment: 'production',
      image: 'dragonfly:1.25',
      command: 'redis-server',
      gitBranch: 'main',
      port: 6379,
      createdAt: '2026-03-12T10:12:00Z',
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
      image: 'nginx:1.27-alpine',
      command: 'nginx -g daemon off;',
      gitBranch: 'main',
      port: 8080,
      domain: 'growth.containr.local',
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
      image: 'node:20-alpine',
      command: './api',
      gitBranch: 'main',
      port: 3000,
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
      image: 'dragonfly:1.25',
      command: 'redis-server',
      gitBranch: 'main',
      port: 6379,
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
      image: 'python:3.12-slim',
      command: './serve',
      gitBranch: 'main',
      port: 8000,
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
      image: 'python:3.12-slim',
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
    'demo-svc-redis': [],
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
