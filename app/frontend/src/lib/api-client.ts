import type { components, paths } from '@/generated/api-types';

export type ServiceStatus = 'running' | 'stopped' | 'building' | 'failed' | 'unknown';

export type ProjectStats = {
  service_count: number;
  deployment_count: number;
  running_services: number;
  last_deployment?: string;
};

export type ProjectEntity = {
  id: string;
  name: string;
  description: string;
  createdAt?: string;
  updatedAt?: string;
  stats: ProjectStats;
};

export type UserProfile = {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type ServiceEntity = {
  id: string;
  projectId: string;
  name: string;
  type: string;
  status: ServiceStatus;
  createdAt?: string;
  updatedAt?: string;
  image?: string;
  command?: string;
  environment?: string;
  gitRepo?: string;
  gitBranch?: string;
  buildPath?: string;
  cpu?: string;
  memory?: string;
};

export type ServiceVariable = {
  id: string;
  serviceId: string;
  key: string;
  value: string;
  isSecret: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type BuildStatus = 'pending' | 'running' | 'success' | 'failed' | 'cancelled';

export type BuildEntity = {
  id: string;
  projectId?: string;
  serviceId?: string;
  status: BuildStatus;
  progress: number;
  startedAt?: string;
  completedAt?: string;
  imageName?: string;
  imageTag?: string;
  size: number;
  error?: string;
  log?: string;
  metadata: Record<string, string>;
};

export type ListBuildsInput = {
  projectId?: string;
  serviceId?: string;
  status?: BuildStatus;
  page?: number;
  limit?: number;
};

export type ListBuildsResult = {
  builds: BuildEntity[];
  total: number;
  page: number;
  limit: number;
};

export type TemplateEntity = {
  id: string;
  name: string;
  description: string;
  category: string;
  logo: string;
  configRaw: string;
  variablesRaw: string;
  isOfficial: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type TemplateConfigEntity = {
  type: string;
  runtime: string;
  buildCommand: string;
  startCommand: string;
  port: number;
  healthCheck: string;
  environment: Record<string, string>;
  dockerfile?: string;
  nixpacksConfig: Record<string, string>;
};

export type TemplateVariableEntity = {
  key: string;
  label: string;
  defaultValue: string;
  required: boolean;
  secret: boolean;
  description: string;
};

export type TemplateDetailEntity = {
  template: TemplateEntity;
  config: TemplateConfigEntity;
  variables: TemplateVariableEntity[];
};

export type ListTemplatesInput = {
  category?: string;
};

export type DeployTemplateInput = {
  projectId: string;
  name: string;
  variables?: Record<string, string>;
};

export type DeployTemplateResult = {
  serviceId: string;
  message: string;
};

export type UpdateUserProfileInput = {
  name?: string;
  avatarUrl?: string;
};

export type AuditLogEntity = {
  id: string;
  userId: string;
  userEmail: string;
  resource: string;
  resourceId: string;
  action: string;
  details: string;
  ipAddress: string;
  userAgent: string;
  createdAt?: string;
};

export type ListAuditLogsInput = {
  resource?: string;
  action?: string;
  page?: number;
  limit?: number;
};

export type DeploymentEntity = {
  id: string;
  serviceId: string;
  commitHash?: string;
  status: string;
  imageName?: string;
  imageTag?: string;
  buildLog?: string;
  runtimeLog?: string;
  error?: string;
  startedAt?: string;
  completedAt?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type CreateDeploymentInput = {
  commitHash?: string;
  branch?: string;
  trigger?: string;
  envVars?: Record<string, string>;
};

export type RollbackDeploymentResult = {
  deployment?: DeploymentEntity;
  message: string;
};

export type ServiceLogEntity = {
  timestamp?: string;
  message: string;
  stream: string;
};

export type ListServiceLogsInput = {
  tail?: string;
  follow?: boolean;
};

export type GetDeploymentLogsInput = {
  type?: 'all' | 'build' | 'runtime';
};

type RawProject = components['schemas']['Project'] & {
  stats?: Partial<ProjectStats>;
};

type RawService = components['schemas']['Service'] & {
  image?: string;
  command?: string;
  environment?: string;
  git_repo?: string;
  git_branch?: string;
  build_path?: string;
  cpu?: string;
  memory?: string;
};

type RawUserProfile = components['schemas']['User'] & {
  avatar_url?: string;
};

type RawServiceVariable = {
  id?: string;
  service_id?: string;
  key?: string;
  value?: string;
  is_secret?: boolean;
  created_at?: string;
  updated_at?: string;
};

type RawBuildStatus = components['schemas']['BuildStatus'];
type RawBuildListResponse = components['schemas']['BuildListResponse'];
type RawServiceTemplate = components['schemas']['ServiceTemplate'];
type RawTemplateConfig = components['schemas']['TemplateConfig'];
type RawTemplateVariable = components['schemas']['TemplateVariable'];
type RawTemplateDetailResponse = components['schemas']['TemplateDetailResponse'];
type RawDeployTemplateResponse = components['schemas']['DeployTemplateResponse'];
type RawAuditLog = components['schemas']['AuditLog'];
type RawAuditLogListResponse = components['schemas']['AuditLogListResponse'];
type RawDeployment = components['schemas']['Deployment'];
type RawDeploymentListResponse = components['schemas']['DeploymentListResponse'];
type RawCreateDeploymentRequest = components['schemas']['CreateDeploymentRequest'];
type RawServiceLog = components['schemas']['ServiceLogEntry'];
type RawServiceLogsResponse = components['schemas']['ServiceLogsResponse'];
type RawDeploymentLogsResponse = components['schemas']['DeploymentLogsResponse'];
type RawRollbackDeploymentResponse = components['schemas']['RollbackDeploymentResponse'];

export type CreateProjectInput = components['schemas']['CreateProjectRequest'];
export type CreateServiceInput = components['schemas']['CreateServiceRequest'] & {
  environment?: 'production' | 'preview' | 'development';
  project_id?: string;
  image?: string;
  command?: string;
  git_repo?: string;
  git_branch?: string;
  build_path?: string;
  cpu?: string;
  memory?: string;
};

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

type ProjectsResponse200 = paths['/projects']['get']['responses'][200]['content']['application/json'];

type JsonLike = Record<string, unknown>;

const rawBase = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8082';
const normalizedBase = rawBase.replace(/\/$/, '');
const API_BASE = /\/api\/v1$/.test(normalizedBase) ? normalizedBase : `${normalizedBase}/api/v1`;

export function getApiBaseUrl(): string {
  return API_BASE;
}

function authHeaders(): HeadersInit {
  return { 'Content-Type': 'application/json' };
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      ...authHeaders(),
      ...(init?.headers ?? {}),
    },
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const payload = (await response.json().catch(() => null)) as JsonLike | null;

  if (!response.ok) {
    const message =
      (payload?.error as string | undefined) ??
      (payload?.message as string | undefined) ??
      `Request failed with status ${response.status}`;

    throw new ApiError(message, response.status);
  }

  return payload as T;
}

async function requestText(path: string, init?: RequestInit): Promise<string> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      ...authHeaders(),
      ...(init?.headers ?? {}),
    },
  });

  const text = await response.text();
  if (!response.ok) {
    throw new ApiError(text || `Request failed with status ${response.status}`, response.status);
  }

  return text;
}

function normalizeProject(project: RawProject): ProjectEntity | null {
  if (!project.id || !project.name) {
    return null;
  }

  return {
    id: project.id,
    name: project.name,
    description: project.description ?? '',
    createdAt: project.created_at,
    updatedAt: project.updated_at,
    stats: {
      service_count: project.stats?.service_count ?? project.services_count ?? 0,
      deployment_count: project.stats?.deployment_count ?? 0,
      running_services: project.stats?.running_services ?? 0,
      last_deployment: project.stats?.last_deployment ?? undefined,
    },
  };
}

function normalizeUserProfile(profile: RawUserProfile): UserProfile | null {
  if (!profile.id || !profile.email || !profile.name) {
    return null;
  }

  return {
    id: profile.id,
    email: profile.email,
    name: profile.name,
    avatarUrl: profile.avatar_url ?? undefined,
    createdAt: profile.created_at ?? undefined,
    updatedAt: profile.updated_at ?? undefined,
  };
}

function normalizeService(service: RawService): ServiceEntity | null {
  if (!service.id || !service.name || !service.project_id) {
    return null;
  }

  const status = (service.status ?? 'unknown') as ServiceStatus;

  return {
    id: service.id,
    projectId: service.project_id,
    name: service.name,
    type: service.type ?? 'web',
    status,
    createdAt: service.created_at,
    updatedAt: service.updated_at,
    image: service.image,
    command: service.command,
    environment: service.environment,
    gitRepo: service.git_repo,
    gitBranch: service.git_branch,
    buildPath: service.build_path,
    cpu: service.cpu,
    memory: service.memory,
  };
}

function normalizeProjectArray(raw: unknown): ProjectEntity[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .map((entry) => normalizeProject(entry as RawProject))
    .filter((entry): entry is ProjectEntity => entry !== null);
}

function normalizeServiceArray(raw: unknown): ServiceEntity[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .map((entry) => normalizeService(entry as RawService))
    .filter((entry): entry is ServiceEntity => entry !== null);
}

function normalizeBuild(build: RawBuildStatus): BuildEntity | null {
  if (!build.id || !build.status) {
    return null;
  }

  return {
    id: build.id,
    projectId: build.project_id,
    serviceId: build.service_id,
    status: build.status as BuildStatus,
    progress: build.progress ?? 0,
    startedAt: build.started_at,
    completedAt: build.completed_at,
    imageName: build.image_name,
    imageTag: build.image_tag,
    size: build.size ?? 0,
    error: build.error,
    log: build.log,
    metadata: build.metadata ?? {},
  };
}

function normalizeBuildArray(raw: unknown): BuildEntity[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .map((entry) => normalizeBuild(entry as RawBuildStatus))
    .filter((entry): entry is BuildEntity => entry !== null);
}

function normalizeTemplate(template: RawServiceTemplate): TemplateEntity | null {
  if (!template.id || !template.name) {
    return null;
  }

  return {
    id: template.id,
    name: template.name,
    description: template.description ?? '',
    category: template.category ?? '',
    logo: template.logo ?? '',
    configRaw: template.config ?? '',
    variablesRaw: template.variables ?? '',
    isOfficial: Boolean(template.is_official),
    createdAt: template.created_at,
    updatedAt: template.updated_at,
  };
}

function normalizeTemplateArray(raw: unknown): TemplateEntity[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .map((entry) => normalizeTemplate(entry as RawServiceTemplate))
    .filter((entry): entry is TemplateEntity => entry !== null);
}

function normalizeStringRecord(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== 'object') {
    return {};
  }

  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === 'string') {
      result[key] = value;
    }
  }
  return result;
}

function normalizeTemplateConfig(config?: RawTemplateConfig): TemplateConfigEntity {
  return {
    type: config?.type ?? '',
    runtime: config?.runtime ?? '',
    buildCommand: config?.build_command ?? '',
    startCommand: config?.start_command ?? '',
    port: config?.port ?? 0,
    healthCheck: config?.health_check ?? '',
    environment: normalizeStringRecord(config?.environment),
    dockerfile: config?.dockerfile ?? undefined,
    nixpacksConfig: normalizeStringRecord(config?.nixpacks_config),
  };
}

function normalizeTemplateVariable(variable: RawTemplateVariable): TemplateVariableEntity | null {
  if (!variable.key) {
    return null;
  }

  return {
    key: variable.key,
    label: variable.label ?? variable.key,
    defaultValue: variable.default ?? '',
    required: Boolean(variable.required),
    secret: Boolean(variable.secret),
    description: variable.description ?? '',
  };
}

function normalizeTemplateVariableArray(raw: unknown): TemplateVariableEntity[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .map((entry) => normalizeTemplateVariable(entry as RawTemplateVariable))
    .filter((entry): entry is TemplateVariableEntity => entry !== null);
}

function normalizeAuditLog(log: RawAuditLog): AuditLogEntity | null {
  if (!log.id || !log.user_id || !log.resource || !log.action) {
    return null;
  }

  return {
    id: log.id,
    userId: log.user_id,
    userEmail: log.user_email ?? '',
    resource: log.resource,
    resourceId: log.resource_id ?? '',
    action: log.action,
    details: log.details ?? '',
    ipAddress: log.ip_address ?? '',
    userAgent: log.user_agent ?? '',
    createdAt: log.created_at,
  };
}

function normalizeAuditLogArray(raw: unknown): AuditLogEntity[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .map((entry) => normalizeAuditLog(entry as RawAuditLog))
    .filter((entry): entry is AuditLogEntity => entry !== null);
}

function normalizeDeployment(deployment: RawDeployment): DeploymentEntity | null {
  if (!deployment.id || !deployment.service_id || !deployment.status) {
    return null;
  }

  return {
    id: deployment.id,
    serviceId: deployment.service_id,
    commitHash: deployment.commit_hash ?? undefined,
    status: deployment.status,
    imageName: deployment.image_name ?? undefined,
    imageTag: deployment.image_tag ?? undefined,
    buildLog: deployment.build_log ?? undefined,
    runtimeLog: deployment.runtime_log ?? undefined,
    error: deployment.error ?? undefined,
    startedAt: deployment.started_at ?? undefined,
    completedAt: deployment.completed_at ?? undefined,
    createdAt: deployment.created_at ?? undefined,
    updatedAt: deployment.updated_at ?? undefined,
  };
}

function normalizeDeploymentArray(raw: unknown): DeploymentEntity[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .map((entry) => normalizeDeployment(entry as RawDeployment))
    .filter((entry): entry is DeploymentEntity => entry !== null);
}

function normalizeServiceLog(log: RawServiceLog): ServiceLogEntity | null {
  if (!log.message || !log.stream) {
    return null;
  }

  return {
    timestamp: log.timestamp ?? undefined,
    message: log.message,
    stream: log.stream,
  };
}

function normalizeServiceLogArray(raw: unknown): ServiceLogEntity[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .map((entry) => normalizeServiceLog(entry as RawServiceLog))
    .filter((entry): entry is ServiceLogEntity => entry !== null);
}

export async function listProjects(): Promise<ProjectEntity[]> {
  const payload = await requestJson<ProjectsResponse200 | { projects?: RawProject[] }>(`/projects`);

  return normalizeProjectArray((payload as { projects?: RawProject[] }).projects);
}

export async function getProjectById(projectId: string): Promise<ProjectEntity> {
  const payload = await requestJson<RawProject | { project?: RawProject }>(`/projects/${projectId}`);
  const rawProject = (payload as { project?: RawProject }).project ?? (payload as RawProject);
  const parsed = normalizeProject(rawProject);

  if (!parsed) {
    throw new ApiError('Project payload is invalid', 500);
  }

  return parsed;
}

export async function getCurrentUserProfile(): Promise<UserProfile> {
  const payload = await requestJson<RawUserProfile | { user?: RawUserProfile }>(`/user/profile`);
  const rawProfile = (payload as { user?: RawUserProfile }).user ?? (payload as RawUserProfile);
  const profile = normalizeUserProfile(rawProfile);

  if (!profile) {
    throw new ApiError('User profile payload is invalid', 500);
  }

  return profile;
}

export async function updateCurrentUserProfile(input: UpdateUserProfileInput): Promise<UserProfile> {
  const payload = await requestJson<RawUserProfile | { user?: RawUserProfile }>(`/user/profile`, {
    method: 'PUT',
    body: JSON.stringify({
      name: input.name,
      avatar_url: input.avatarUrl,
    }),
  });

  const rawProfile = (payload as { user?: RawUserProfile }).user ?? (payload as RawUserProfile);
  const profile = normalizeUserProfile(rawProfile);

  if (!profile) {
    throw new ApiError('Updated user profile payload is invalid', 500);
  }

  return profile;
}

export async function createProject(input: CreateProjectInput): Promise<ProjectEntity> {
  const payload = await requestJson<RawProject | { project?: RawProject }>(`/projects`, {
    method: 'POST',
    body: JSON.stringify(input),
  });

  const rawProject = (payload as { project?: RawProject }).project ?? (payload as RawProject);
  const parsed = normalizeProject(rawProject);

  if (!parsed) {
    throw new ApiError('Create project response is invalid', 500);
  }

  return parsed;
}

export async function listServicesByProject(projectId: string): Promise<ServiceEntity[]> {
  const payload = await requestJson<RawService[] | { services?: RawService[] }>(`/projects/${projectId}/services`);
  const rows = Array.isArray(payload) ? payload : payload.services ?? [];
  return normalizeServiceArray(rows);
}

export async function getServiceById(serviceId: string): Promise<ServiceEntity> {
  const payload = await requestJson<RawService | { service?: RawService }>(`/services/${serviceId}`);
  const row = (payload as { service?: RawService }).service ?? (payload as RawService);
  const parsed = normalizeService(row);

  if (!parsed) {
    throw new ApiError('Service payload is invalid', 500);
  }

  return parsed;
}

export async function createService(projectId: string, input: CreateServiceInput): Promise<ServiceEntity> {
  const payload = await requestJson<RawService | { service?: RawService }>(`/projects/${projectId}/services`, {
    method: 'POST',
    body: JSON.stringify({ ...input, project_id: projectId }),
  });

  const row = (payload as { service?: RawService }).service ?? (payload as RawService);
  const parsed = normalizeService(row);

  if (!parsed) {
    throw new ApiError('Create service response is invalid', 500);
  }

  return parsed;
}

export async function deleteService(serviceId: string): Promise<void> {
  await requestJson<{ message?: string }>(`/services/${serviceId}`, {
    method: 'DELETE',
  });
}

export async function listServiceVariables(serviceId: string): Promise<ServiceVariable[]> {
  const payload = await requestJson<{ variables?: RawServiceVariable[] }>(`/services/${serviceId}/variables`);
  const rows = payload.variables ?? [];
  const result: ServiceVariable[] = [];

  for (const row of rows) {
    if (!row.id || !row.service_id || !row.key) {
      continue;
    }

    result.push({
      id: row.id,
      serviceId: row.service_id,
      key: row.key,
      value: row.value ?? '',
      isSecret: Boolean(row.is_secret),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  return result;
}

export async function listAuditLogs(input: ListAuditLogsInput = {}): Promise<AuditLogEntity[]> {
  const searchParams = new URLSearchParams();
  if (input.resource) {
    searchParams.set('resource', input.resource);
  }
  if (input.action) {
    searchParams.set('action', input.action);
  }
  if (input.page && input.page > 0) {
    searchParams.set('page', String(input.page));
  }
  if (input.limit && input.limit > 0) {
    searchParams.set('limit', String(input.limit));
  }

  const query = searchParams.toString();
  const payload = await requestJson<RawAuditLogListResponse>(query ? `/audit-logs?${query}` : '/audit-logs');

  return normalizeAuditLogArray(payload.audit_logs);
}

export async function listDeployments(serviceId: string): Promise<DeploymentEntity[]> {
  const payload = await requestJson<RawDeploymentListResponse>(`/services/${serviceId}/deployments`);
  return normalizeDeploymentArray(payload.deployments);
}

export async function createDeployment(
  serviceId: string,
  input: CreateDeploymentInput = {},
): Promise<DeploymentEntity> {
  const requestBody: RawCreateDeploymentRequest = {
    commit_hash: input.commitHash,
    branch: input.branch,
    trigger: input.trigger,
    env_vars: input.envVars,
  };

  const payload = await requestJson<RawDeployment>(`/services/${serviceId}/deployments`, {
    method: 'POST',
    body: JSON.stringify(requestBody),
  });

  const deployment = normalizeDeployment(payload);
  if (!deployment) {
    throw new ApiError('Create deployment response is invalid', 500);
  }

  return deployment;
}

export async function listServiceLogs(
  serviceId: string,
  input: ListServiceLogsInput = {},
): Promise<ServiceLogEntity[]> {
  const searchParams = new URLSearchParams();
  if (input.tail) {
    searchParams.set('tail', input.tail);
  }
  if (typeof input.follow === 'boolean') {
    searchParams.set('follow', String(input.follow));
  }

  const query = searchParams.toString();
  const payload = await requestJson<RawServiceLogsResponse>(
    query ? `/services/${serviceId}/logs?${query}` : `/services/${serviceId}/logs`,
  );
  return normalizeServiceLogArray(payload.logs);
}

export async function getDeploymentLogs(
  deploymentId: string,
  input: GetDeploymentLogsInput = {},
): Promise<{
  logs: ServiceLogEntity[];
  buildLog: string;
  runtimeLog: string;
}> {
  const searchParams = new URLSearchParams();
  if (input.type) {
    searchParams.set('type', input.type);
  }
  const query = searchParams.toString();
  const payload = await requestJson<RawDeploymentLogsResponse>(
    query ? `/deployments/${deploymentId}/logs?${query}` : `/deployments/${deploymentId}/logs`,
  );

  return {
    logs: normalizeServiceLogArray(payload.logs),
    buildLog: payload.build_log ?? '',
    runtimeLog: payload.runtime_log ?? '',
  };
}

export async function rollbackDeployment(deploymentId: string): Promise<RollbackDeploymentResult> {
  const payload = await requestJson<RawRollbackDeploymentResponse>(`/deployments/${deploymentId}/rollback`, {
    method: 'POST',
  });

  return {
    deployment: payload.deployment ? normalizeDeployment(payload.deployment) ?? undefined : undefined,
    message: payload.message ?? 'Rollback initiated',
  };
}

export async function listBuilds(input: ListBuildsInput = {}): Promise<ListBuildsResult> {
  const searchParams = new URLSearchParams();
  if (input.projectId) {
    searchParams.set('project_id', input.projectId);
  }
  if (input.serviceId) {
    searchParams.set('service_id', input.serviceId);
  }
  if (input.status) {
    searchParams.set('status', input.status);
  }
  if (input.page && input.page > 0) {
    searchParams.set('page', String(input.page));
  }
  if (input.limit && input.limit > 0) {
    searchParams.set('limit', String(input.limit));
  }

  const query = searchParams.toString();
  const payload = await requestJson<RawBuildListResponse>(query ? `/builds?${query}` : '/builds');

  return {
    builds: normalizeBuildArray(payload.builds),
    total: payload.total ?? 0,
    page: payload.page ?? input.page ?? 1,
    limit: payload.limit ?? input.limit ?? 20,
  };
}

export async function cancelBuild(buildId: string): Promise<string> {
  const payload = await requestJson<{ message?: string }>(`/builds/${buildId}/cancel`, {
    method: 'POST',
  });
  return payload.message ?? 'Build cancelled';
}

export async function getBuildLogs(buildId: string, follow = false): Promise<string> {
  const query = follow ? '?follow=true' : '';
  return requestText(`/builds/${buildId}/logs${query}`);
}

export async function listTemplates(input: ListTemplatesInput = {}): Promise<TemplateEntity[]> {
  const searchParams = new URLSearchParams();
  if (input.category) {
    searchParams.set('category', input.category);
  }

  const query = searchParams.toString();
  const payload = await requestJson<{ templates?: RawServiceTemplate[] }>(
    query ? `/templates?${query}` : '/templates',
  );
  return normalizeTemplateArray(payload.templates);
}

export async function getTemplateById(templateId: string): Promise<TemplateDetailEntity> {
  const payload = await requestJson<RawTemplateDetailResponse>(`/templates/${templateId}`);
  const template = payload.template ? normalizeTemplate(payload.template) : null;
  if (!template) {
    throw new ApiError('Template payload is invalid', 500);
  }

  return {
    template,
    config: normalizeTemplateConfig(payload.config),
    variables: normalizeTemplateVariableArray(payload.variables),
  };
}

export async function deployTemplate(
  templateId: string,
  input: DeployTemplateInput,
): Promise<DeployTemplateResult> {
  const payload = await requestJson<RawDeployTemplateResponse>(`/templates/${templateId}/deploy`, {
    method: 'POST',
    body: JSON.stringify({
      project_id: input.projectId,
      name: input.name,
      variables: input.variables ?? {},
    }),
  });

  if (!payload.service_id) {
    throw new ApiError('Template deployment response is invalid', 500);
  }

  return {
    serviceId: payload.service_id,
    message: payload.message ?? 'Service created from template',
  };
}

export function serviceStatusClass(status: ServiceStatus): string {
  switch (status) {
    case 'running':
      return 'status-running';
    case 'building':
      return 'status-building';
    case 'failed':
      return 'status-failed';
    case 'stopped':
      return 'status-stopped';
    default:
      return 'status-stopped';
  }
}
