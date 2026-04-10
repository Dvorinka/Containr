import type { ProjectEntity, ServiceEntity } from '@/lib/api-client';
import type { ServiceVariable } from '@/features/workspace/auto-connections';

export const demoProjects: ProjectEntity[] = [
  {
    id: 'demo-project-core',
    name: 'Core Platform',
    description: 'Primary production workload with web, API, queue, and data services.',
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
