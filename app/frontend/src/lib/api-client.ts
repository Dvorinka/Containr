import type { components, paths } from '@/generated/api-types';

export type ServiceStatus = 'running' | 'degraded' | 'stopped' | 'building' | 'failed' | 'unknown';

export type ProjectStats = components['schemas']['ProjectStats'];

export type ProjectEntity = {
  id: string;
  name: string;
  description: string;
  isApproved: boolean;
  createdAt?: string;
  updatedAt?: string;
  stats: ProjectStats;
};

export type UserProfile = {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  isAdmin: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type PlatformSettings = {
  signupEnabled: boolean;
  cloudflareTunnel: {
    tokenSet: boolean;
    source: 'app' | 'env' | 'none';
    container: string;
  };
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
  replicas?: number;
  port?: number;
  domain?: string;
  healthcheckPath?: string;
  restartPolicy?: string;
  publicUrl?: string;
};

export type RuntimeContainer = {
  id: string;
  name: string;
  state: string;
  replica: number;
};

export type ServiceRuntime = {
  desired: number;
  status: 'running' | 'degraded' | 'stopped';
  urls: string[];
  containers: RuntimeContainer[];
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
  ownerId: string | null;
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

export type CreateUserInput = components['schemas']['ManualUserCreateRequest'];

export type UpgradeStatus = {
  imageRef: string;
  registry: string;
  dockerAvailable: boolean;
  installed: boolean;
  digest?: string;
  size?: number;
  authConfigured: boolean;
  message: string;
};

export type SystemLoad = {
  load1m: number;
  load5m: number;
  load15m: number;
};

export type HostMonitoring = {
  hostname: string;
  os: string;
  architecture: string;
  cpu: {
    cores: number;
  };
  memory: {
    total: number;
    used: number;
    available: number;
    usagePercent: number;
  };
  storage: {
    path: string;
    total: number;
    used: number;
    available: number;
    usagePercent: number;
  };
  load: SystemLoad;
  uptimeSeconds: number;
  dockerAvailable: boolean;
  docker?: {
    containers?: number;
    images?: number;
    driver?: string;
    server?: string;
  };
  collectedAt: string;
};

export type AgentCapabilities = {
  containerRuntimes: string[];
  supportedArchitectures: string[];
  maxContainers: number;
  storageDriver: string;
  networkPlugins: string[];
  features: string[];
};

export type NodeResources = {
  cpu: {
    cores: number;
    allocation: number;
    usage: number;
  };
  memory: {
    total: number;
    allocated: number;
    used: number;
    available: number;
  };
  storage: {
    total: number;
    allocated: number;
    used: number;
    available: number;
  };
};

export type NodeAgentEntity = {
  id: string;
  name: string;
  hostname: string;
  ipAddress: string;
  port: number;
  status: string;
  version: string;
  capabilities: AgentCapabilities;
  resources: NodeResources;
  lastHeartbeat?: string;
  createdAt?: string;
  updatedAt?: string;
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
  actor?: string;
  userId?: string;
  since?: string;
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

type RawProject = components['schemas']['Project'];
type RawService = components['schemas']['Service'];
type RawUserProfile = components['schemas']['User'];

type RawServiceVariable = components['schemas']['ServiceVariable'];

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
type RawUpgradeStatus = components['schemas']['UpgradeStatus'];
type RawHostMonitoring = components['schemas']['HostMonitoring'];
type RawSystemLoad = NonNullable<RawHostMonitoring['load']>;
type RawNodeAgent = components['schemas']['NodeAgent'];

export type CreateProjectInput = components['schemas']['CreateProjectRequest'];
export type CreateServiceInput = components['schemas']['CreateServiceRequest'];
export type UpdateServiceInput = components['schemas']['UpdateServiceRequest'];

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

const configuredBase = ((import.meta.env.VITE_API_URL as string | undefined) ?? '').trim();
const rawBase = configuredBase || window.location.origin;
const normalizedBase = rawBase.replace(/\/$/, '');
const API_ROOT = normalizedBase.replace(/\/api\/v1$/, '').replace(/\/api$/, '');
const API_BASE = /\/api\/v1$/.test(normalizedBase) ? normalizedBase : `${normalizedBase}/api/v1`;

export function getApiBaseUrl(): string {
  return API_BASE;
}

export function getAgentPublicBaseUrl(): string {
  return `${API_ROOT}/api/agents`;
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

  // SPA fallback servers may answer /api/* with index.html — an ok response
  // whose body is not JSON. Surface an empty object so envelope unwraps
  // (`payload.x ?? []`) degrade instead of dereferencing null.
  return (payload ?? {}) as T;
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
    isApproved: project.is_approved ?? false,
    createdAt: project.created_at,
    updatedAt: project.updated_at,
    stats: {
      service_count: project.stats?.service_count ?? 0,
      deployment_count: project.stats?.deployment_count ?? 0,
      running_services: project.stats?.running_services ?? 0,
      last_deployment: project.stats?.last_deployment ?? null,
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
    isAdmin: profile.is_admin ?? false,
    createdAt: profile.created_at ?? undefined,
    updatedAt: profile.updated_at ?? undefined,
  };
}

function normalizePlatformSettings(raw: components['schemas']['PlatformSettings']): PlatformSettings {
  return {
    signupEnabled: raw.signup_enabled ?? false,
    cloudflareTunnel: {
      tokenSet: raw.cloudflare_tunnel?.token_set ?? false,
      source: raw.cloudflare_tunnel?.source ?? 'none',
      container: raw.cloudflare_tunnel?.container ?? 'missing',
    },
  };
}

export async function getPlatformSettings(): Promise<PlatformSettings> {
  const raw = await requestJson<components['schemas']['PlatformSettings']>('/settings');
  return normalizePlatformSettings(raw);
}

export async function updatePlatformSettings(input: {
  signupEnabled?: boolean;
  cloudflareTunnelToken?: string;
}): Promise<PlatformSettings> {
  const body: Record<string, unknown> = {};
  if (input.signupEnabled !== undefined) {
    body.signup_enabled = input.signupEnabled;
  }
  if (input.cloudflareTunnelToken !== undefined) {
    body.cloudflare_tunnel_token = input.cloudflareTunnelToken;
  }
  const raw = await requestJson<components['schemas']['PlatformSettings']>('/settings', {
    method: 'PUT',
    body: JSON.stringify(body),
  });
  return normalizePlatformSettings(raw);
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
    replicas: service.replicas,
    port: service.port,
    domain: service.domain,
    healthcheckPath: service.healthcheck_path,
    restartPolicy: service.restart_policy,
    publicUrl: service.public_url,
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
    ownerId: template.owner_id ?? null,
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

export async function listProjects(params?: { limit?: number; search?: string }): Promise<ProjectEntity[]> {
  const search = new URLSearchParams();
  if (params?.limit) search.set('limit', String(params.limit));
  if (params?.search) search.set('search', params.search);
  const qs = search.toString();
  const payload = await requestJson<ProjectsResponse200 | { projects?: RawProject[] }>(`/projects${qs ? `?${qs}` : ''}`);

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

export async function createUser(input: CreateUserInput): Promise<UserProfile> {
  const payload = await requestJson<RawUserProfile | { user?: RawUserProfile }>(`/users`, {
    method: 'POST',
    body: JSON.stringify(input),
  });

  const rawProfile = (payload as { user?: RawUserProfile }).user ?? (payload as RawUserProfile);
  const profile = normalizeUserProfile(rawProfile);

  if (!profile) {
    throw new ApiError('Create user response is invalid', 500);
  }

  return profile;
}

function normalizeUpgradeStatus(payload: RawUpgradeStatus): UpgradeStatus {
  return {
    imageRef: payload.image_ref ?? '',
    registry: payload.registry ?? '',
    dockerAvailable: Boolean(payload.docker_available),
    installed: Boolean(payload.installed),
    digest: payload.digest,
    size: payload.size,
    authConfigured: Boolean(payload.auth_configured),
    message: payload.message ?? '',
  };
}

function normalizeSystemLoad(payload?: RawSystemLoad): SystemLoad {
  return {
    load1m: payload?.load_1m ?? 0,
    load5m: payload?.load_5m ?? 0,
    load15m: payload?.load_15m ?? 0,
  };
}

function normalizeHostMonitoring(payload: RawHostMonitoring): HostMonitoring {
  return {
    hostname: payload.hostname ?? '',
    os: payload.os ?? '',
    architecture: payload.architecture ?? '',
    cpu: {
      cores: payload.cpu?.cores ?? 0,
    },
    memory: {
      total: payload.memory?.total ?? 0,
      used: payload.memory?.used ?? 0,
      available: payload.memory?.available ?? 0,
      usagePercent: payload.memory?.usage_percent ?? 0,
    },
    storage: {
      path: payload.storage?.path ?? '/',
      total: payload.storage?.total ?? 0,
      used: payload.storage?.used ?? 0,
      available: payload.storage?.available ?? 0,
      usagePercent: payload.storage?.usage_percent ?? 0,
    },
    load: normalizeSystemLoad(payload.load),
    uptimeSeconds: payload.uptime_seconds ?? 0,
    dockerAvailable: Boolean(payload.docker_available),
    docker: payload.docker,
    collectedAt: payload.collected_at ?? '',
  };
}

function normalizeAgent(agent: RawNodeAgent): NodeAgentEntity | null {
  if (!agent.id || !agent.name) {
    return null;
  }

  return {
    id: agent.id,
    name: agent.name,
    hostname: agent.hostname ?? '',
    ipAddress: agent.ip_address ?? '',
    port: agent.port ?? 0,
    status: agent.status ?? 'unknown',
    version: agent.version ?? '',
    capabilities: {
      containerRuntimes: agent.capabilities?.container_runtimes ?? [],
      supportedArchitectures: agent.capabilities?.supported_architectures ?? [],
      maxContainers: agent.capabilities?.max_containers ?? 0,
      storageDriver: agent.capabilities?.storage_driver ?? '',
      networkPlugins: agent.capabilities?.network_plugins ?? [],
      features: agent.capabilities?.features ?? [],
    },
    resources: {
      cpu: {
        cores: agent.resources?.cpu?.cores ?? 0,
        allocation: agent.resources?.cpu?.allocation ?? 0,
        usage: agent.resources?.cpu?.usage ?? 0,
      },
      memory: {
        total: agent.resources?.memory?.total ?? 0,
        allocated: agent.resources?.memory?.allocated ?? 0,
        used: agent.resources?.memory?.used ?? 0,
        available: agent.resources?.memory?.available ?? 0,
      },
      storage: {
        total: agent.resources?.storage?.total ?? 0,
        allocated: agent.resources?.storage?.allocated ?? 0,
        used: agent.resources?.storage?.used ?? 0,
        available: agent.resources?.storage?.available ?? 0,
      },
    },
    lastHeartbeat: agent.last_heartbeat,
    createdAt: agent.created_at,
    updatedAt: agent.updated_at,
  };
}

function normalizeAgentArray(raw: unknown): NodeAgentEntity[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .map((entry) => normalizeAgent(entry as RawNodeAgent))
    .filter((entry): entry is NodeAgentEntity => entry !== null);
}

export async function getUpgradeStatus(): Promise<UpgradeStatus> {
  const payload = await requestJson<RawUpgradeStatus>(`/system/upgrade/status`);
  return normalizeUpgradeStatus(payload);
}

export async function pullUpgradeImage(): Promise<UpgradeStatus> {
  const payload = await requestJson<RawUpgradeStatus>(`/system/upgrade/pull`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
  return normalizeUpgradeStatus(payload);
}

export async function getHostMonitoring(): Promise<HostMonitoring> {
  const payload = await requestJson<RawHostMonitoring>(`/system/host`);
  return normalizeHostMonitoring(payload);
}

export async function listAgents(): Promise<NodeAgentEntity[]> {
  const payload = await requestJson<{ agents?: RawNodeAgent[] }>(`/agents`);
  return normalizeAgentArray(payload.agents);
}

export type AgentAuthToken = components['schemas']['AgentAuthToken'];
export type AgentAuthTokenCreated = components['schemas']['AgentAuthTokenCreated'];

export async function createAgentToken(label?: string): Promise<AgentAuthTokenCreated> {
  return requestJson<AgentAuthTokenCreated>(`/agent-tokens`, {
    method: 'POST',
    body: JSON.stringify({ label: label ?? '' }),
  });
}

export async function listAgentTokens(): Promise<AgentAuthToken[]> {
  const payload = await requestJson<{ tokens?: AgentAuthToken[] }>(`/agent-tokens`);
  return payload.tokens ?? [];
}

export async function revokeAgentToken(id: string): Promise<void> {
  await requestJson(`/agent-tokens/${id}`, { method: 'DELETE' });
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

export async function updateProject(
  projectId: string,
  input: { name?: string; description?: string },
): Promise<ProjectEntity> {
  const payload = await requestJson<RawProject | { project?: RawProject }>(
    `/projects/${encodeURIComponent(projectId)}`,
    { method: 'PUT', body: JSON.stringify(input) },
  );
  const rawProject = (payload as { project?: RawProject }).project ?? (payload as RawProject);
  const parsed = normalizeProject(rawProject);
  if (!parsed) {
    throw new ApiError('Update project response is invalid', 500);
  }
  return parsed;
}

export async function deleteProject(projectId: string): Promise<void> {
  await requestJson(`/projects/${encodeURIComponent(projectId)}`, { method: 'DELETE' });
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

export async function updateService(serviceId: string, input: UpdateServiceInput): Promise<ServiceEntity> {
  const payload = await requestJson<RawService | { service?: RawService }>(`/services/${serviceId}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });

  const row = (payload as { service?: RawService }).service ?? (payload as RawService);
  const parsed = normalizeService(row);

  if (!parsed) {
    throw new ApiError('Update service response is invalid', 500);
  }

  return parsed;
}

export async function deleteService(serviceId: string): Promise<void> {
  await requestJson<{ message?: string }>(`/services/${serviceId}`, {
    method: 'DELETE',
  });
}

export async function getServiceRuntime(serviceId: string): Promise<ServiceRuntime> {
  const payload = await requestJson<{ runtime?: ServiceRuntime }>(`/services/${serviceId}/runtime`);
  return (
    payload.runtime ?? {
      desired: 0,
      status: 'stopped',
      urls: [],
      containers: [],
    }
  );
}

async function serviceAction(serviceId: string, action: 'start' | 'stop' | 'restart'): Promise<void> {
  await requestJson<{ message?: string }>(`/services/${serviceId}/${action}`, { method: 'POST' });
}

export const startService = (serviceId: string) => serviceAction(serviceId, 'start');
export const stopService = (serviceId: string) => serviceAction(serviceId, 'stop');
export const restartService = (serviceId: string) => serviceAction(serviceId, 'restart');

export async function redeployService(serviceId: string): Promise<ServiceRuntime> {
  const payload = await requestJson<{ runtime?: ServiceRuntime }>(`/services/${serviceId}/redeploy`, {
    method: 'POST',
  });
  return payload.runtime ?? { desired: 0, status: 'stopped', urls: [], containers: [] };
}

function normalizeServiceVariables(rows: RawServiceVariable[] | undefined): ServiceVariable[] {
  const result: ServiceVariable[] = [];
  for (const row of rows ?? []) {
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

export async function listServiceVariables(serviceId: string): Promise<ServiceVariable[]> {
  const payload = await requestJson<{ variables?: RawServiceVariable[] }>(`/services/${serviceId}/variables`);
  return normalizeServiceVariables(payload.variables);
}

export type UpdateServiceVariableInput = components['schemas']['VariableInput'];

export async function updateServiceVariables(
  serviceId: string,
  variables: UpdateServiceVariableInput[],
): Promise<ServiceVariable[]> {
  const payload = await requestJson<{ variables?: RawServiceVariable[] }>(
    `/services/${serviceId}/variables`,
    { method: 'PUT', body: JSON.stringify({ variables }) },
  );
  return normalizeServiceVariables(payload.variables);
}

export async function listAuditLogs(input: ListAuditLogsInput = {}): Promise<AuditLogEntity[]> {
  const searchParams = new URLSearchParams();
  if (input.resource) {
    searchParams.set('resource', input.resource);
  }
  if (input.action) {
    searchParams.set('action', input.action);
  }
  if (input.actor) {
    searchParams.set('actor', input.actor);
  }
  if (input.userId) {
    searchParams.set('user_id', input.userId);
  }
  if (input.since) {
    searchParams.set('since', input.since);
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

export type RecentDeploymentEntity = {
  id: string;
  serviceId: string;
  serviceName: string;
  projectName: string;
  status: string;
  imageName?: string;
  startedAt?: string;
  completedAt?: string;
  createdAt?: string;
};

export async function listRecentDeployments(limit = 10): Promise<RecentDeploymentEntity[]> {
  const payload = await requestJson<{ deployments?: Array<Record<string, unknown>> }>(
    `/deployments?limit=${limit}`,
  );
  return (payload.deployments ?? [])
    .map((d) => ({
      id: String(d.id ?? ''),
      serviceId: String(d.service_id ?? ''),
      serviceName: String(d.service_name ?? ''),
      projectName: String(d.project_name ?? ''),
      status: String(d.status ?? ''),
      imageName: d.image_name ? String(d.image_name) : undefined,
      startedAt: d.started_at ? String(d.started_at) : undefined,
      completedAt: d.completed_at ? String(d.completed_at) : undefined,
      createdAt: d.created_at ? String(d.created_at) : undefined,
    }))
    .filter((d) => d.id !== '');
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

export type TemplateWriteInput = {
  name: string;
  description?: string;
  category?: string;
  logo?: string;
  config: Record<string, unknown>;
  variables?: TemplateVariableEntity[];
};

function templateWriteBody(input: TemplateWriteInput): string {
  return JSON.stringify({
    name: input.name,
    description: input.description ?? '',
    category: input.category ?? '',
    logo: input.logo ?? '',
    config: input.config,
    variables: input.variables ?? [],
  });
}

export async function createTemplate(input: TemplateWriteInput): Promise<TemplateEntity> {
  const payload = await requestJson<{ template?: RawServiceTemplate }>('/templates', {
    method: 'POST',
    body: templateWriteBody(input),
  });
  const template = payload.template ? normalizeTemplate(payload.template) : null;
  if (!template) {
    throw new ApiError('Template response is invalid', 500);
  }
  return template;
}

export async function updateTemplate(templateId: string, input: TemplateWriteInput): Promise<TemplateEntity> {
  const payload = await requestJson<{ template?: RawServiceTemplate }>(`/templates/${templateId}`, {
    method: 'PUT',
    body: templateWriteBody(input),
  });
  const template = payload.template ? normalizeTemplate(payload.template) : null;
  if (!template) {
    throw new ApiError('Template response is invalid', 500);
  }
  return template;
}

export async function deleteTemplate(templateId: string): Promise<void> {
  await requestJson(`/templates/${templateId}`, { method: 'DELETE' });
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
    case 'degraded':
      return 'status-degraded';
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

export type ServiceInstanceMetrics = components['schemas']['ServiceInstanceMetrics'];
export type ServiceMetrics = components['schemas']['ServiceMetrics'];

export async function getServiceMetrics(serviceId: string): Promise<ServiceMetrics> {
  const payload = await requestJson<{ metrics?: ServiceMetrics }>(`/services/${serviceId}/metrics`);
  if (!payload.metrics) {
    throw new ApiError('Service metrics payload is invalid', 500);
  }
  return payload.metrics;
}

export type GitProviderEntity = components['schemas']['GitProvider'];
export type GitRepositoryEntity = components['schemas']['GitRepository'];
export type GitBranchEntity = components['schemas']['GitBranch'];
export type CreateGitProviderInput = components['schemas']['CreateGitProviderRequest'];

export async function listGitProviders(): Promise<GitProviderEntity[]> {
  const payload = await requestJson<{ providers?: GitProviderEntity[] }>('/git/providers');
  return payload.providers ?? [];
}

export async function createGitProvider(input: CreateGitProviderInput): Promise<GitProviderEntity> {
  const payload = await requestJson<GitProviderEntity>('/git/providers', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  if (!payload.id) {
    throw new ApiError('Provider response is invalid', 500);
  }
  return payload;
}

export async function deleteGitProvider(providerId: string): Promise<void> {
  await requestJson(`/git/providers/${providerId}`, { method: 'DELETE' });
}

export async function listGitRepositories(
  providerId: string,
  search?: string,
): Promise<GitRepositoryEntity[]> {
  const params = new URLSearchParams({ limit: '100' });
  if (search?.trim()) {
    params.set('search', search.trim());
  }
  const payload = await requestJson<{ repositories?: GitRepositoryEntity[] }>(
    `/git/providers/${providerId}/repositories?${params.toString()}`,
  );
  return payload.repositories ?? [];
}

export async function listGitBranches(
  providerId: string,
  owner: string,
  repo: string,
): Promise<GitBranchEntity[]> {
  const payload = await requestJson<{ branches?: GitBranchEntity[] }>(
    `/git/providers/${providerId}/repositories/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/branches`,
  );
  return payload.branches ?? [];
}

export type CreateDatabaseInput = components['schemas']['CreateDatabaseRequest'];
export type DatabaseEntity = components['schemas']['Database'];
export type DatabaseBackupEntity = components['schemas']['DatabaseBackup'];

export async function listDatabases(): Promise<DatabaseEntity[]> {
  const payload = await requestJson<{ databases?: DatabaseEntity[] }>('/databases');
  return payload.databases ?? [];
}

export async function getDatabase(id: string): Promise<DatabaseEntity> {
  return requestJson<DatabaseEntity>(`/databases/${encodeURIComponent(id)}`);
}

export async function databaseAction(id: string, action: 'start' | 'stop' | 'restart'): Promise<void> {
  await requestJson(`/databases/${encodeURIComponent(id)}/action`, {
    method: 'POST',
    body: JSON.stringify({ action }),
  });
}

export async function updateDatabaseBackupSchedule(id: string, schedule: string): Promise<void> {
  await requestJson(`/databases/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify({ backup_schedule: schedule }),
  });
}

export async function createDatabaseBackup(id: string): Promise<void> {
  await requestJson(`/databases/${encodeURIComponent(id)}/backup`, {
    method: 'POST',
    body: JSON.stringify({ database_id: id }),
  });
}

export async function restoreDatabaseBackup(id: string, backupId: string): Promise<void> {
  await requestJson(`/databases/${encodeURIComponent(id)}/restore`, {
    method: 'POST',
    body: JSON.stringify({ database_id: id, backup_id: backupId }),
  });
}

export async function createManagedDatabase(
  input: CreateDatabaseInput,
): Promise<{ id: string; status: string }> {
  const payload = await requestJson<{ id?: string; status?: string }>('/databases', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  if (!payload.id) {
    throw new ApiError('Database response is invalid', 500);
  }
  return { id: payload.id, status: payload.status ?? 'building' };
}

export type ConnectGitRepositoryInput = components['schemas']['ConnectGitRepoRequest'];
export type CreateGitWebhookInput = components['schemas']['CreateWebhookRequest'];
export type GitWebhookEntity = components['schemas']['GitWebhook'];

export async function getGitHubAppInstallUrl(): Promise<string> {
  const payload = await requestJson<{ install_url?: string }>('/git/github-app/install-url');
  if (!payload.install_url) {
    throw new ApiError('GitHub App install URL unavailable', 500);
  }
  return payload.install_url;
}

export async function connectGitHubApp(installationId: number, displayName?: string): Promise<GitProviderEntity> {
  const payload = await requestJson<{ provider?: GitProviderEntity }>('/git/github-app/connect', {
    method: 'POST',
    body: JSON.stringify({ installation_id: installationId, display_name: displayName }),
  });
  if (!payload.provider?.id) {
    throw new ApiError('GitHub App connect response is invalid', 500);
  }
  return payload.provider;
}

export async function connectGitRepository(
  input: ConnectGitRepositoryInput,
): Promise<GitRepositoryEntity> {
  const payload = await requestJson<{ repository?: GitRepositoryEntity }>(
    '/git/repositories/connect',
    { method: 'POST', body: JSON.stringify(input) },
  );
  if (!payload.repository?.id) {
    throw new ApiError('Connect repository response is invalid', 500);
  }
  return payload.repository;
}

export async function listConnectedGitRepositories(): Promise<GitRepositoryEntity[]> {
  const payload = await requestJson<{ repositories?: GitRepositoryEntity[] }>('/git/repositories');
  return payload.repositories ?? [];
}

export async function createGitWebhook(input: CreateGitWebhookInput): Promise<GitWebhookEntity> {
  const payload = await requestJson<{ webhook?: GitWebhookEntity }>('/git/webhooks', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  if (!payload.webhook?.id) {
    throw new ApiError('Webhook response is invalid', 500);
  }
  return payload.webhook;
}

// --- Cron jobs ---

export type CronJobEntity = components['schemas']['CronJob'];
export type CronExecutionEntity = components['schemas']['CronExecution'];
export type CreateCronJobInput = components['schemas']['CreateCronJobRequest'];
export type UpdateCronJobInput = components['schemas']['UpdateCronJobRequest'];

export async function listCronJobs(serviceId: string): Promise<CronJobEntity[]> {
  const payload = await requestJson<{ cron_jobs?: CronJobEntity[] }>(
    `/cron-jobs?service_id=${encodeURIComponent(serviceId)}`,
  );
  return payload.cron_jobs ?? [];
}

export async function createCronJob(input: CreateCronJobInput): Promise<CronJobEntity> {
  const payload = await requestJson<{ cron_job?: CronJobEntity }>('/cron-jobs', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  if (!payload.cron_job?.id) {
    throw new ApiError('Create cron job response is invalid', 500);
  }
  return payload.cron_job;
}

export async function updateCronJob(id: string, input: UpdateCronJobInput): Promise<void> {
  await requestJson(`/cron-jobs/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export async function deleteCronJob(id: string): Promise<void> {
  await requestJson(`/cron-jobs/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function listCronExecutions(id: string): Promise<CronExecutionEntity[]> {
  const payload = await requestJson<{ executions?: CronExecutionEntity[] }>(
    `/cron-jobs/${encodeURIComponent(id)}/executions`,
  );
  return payload.executions ?? [];
}

export async function triggerCronJob(id: string): Promise<void> {
  await requestJson(`/cron-jobs/${encodeURIComponent(id)}/trigger`, { method: 'POST' });
}

export type NotificationEntity = components['schemas']['Notification'];

export type NotificationList = {
  notifications: NotificationEntity[];
  unread: number;
};

export async function listNotifications(limit = 20): Promise<NotificationList> {
  const payload = await requestJson<{ notifications?: NotificationEntity[]; unread?: number }>(
    `/notifications?limit=${limit}`,
  );
  return { notifications: payload.notifications ?? [], unread: payload.unread ?? 0 };
}

export async function markNotificationRead(id: string): Promise<void> {
  await requestJson(`/notifications/${encodeURIComponent(id)}/read`, { method: 'POST' });
}

export async function markAllNotificationsRead(): Promise<void> {
  await requestJson('/notifications/read-all', { method: 'POST' });
}

export type PreviewEnvironmentEntity = components['schemas']['PreviewEnvironment'];

export async function listPreviewEnvironments(projectId: string): Promise<PreviewEnvironmentEntity[]> {
  const payload = await requestJson<{ preview_environments?: PreviewEnvironmentEntity[] }>(
    `/projects/${encodeURIComponent(projectId)}/preview-environments`,
  );
  return payload.preview_environments ?? [];
}

export async function createPreviewEnvironment(
  projectId: string,
  input: components['schemas']['CreatePreviewEnvironmentRequest'],
): Promise<PreviewEnvironmentEntity> {
  return requestJson<PreviewEnvironmentEntity>(
    `/projects/${encodeURIComponent(projectId)}/preview-environments`,
    { method: 'POST', body: JSON.stringify(input) },
  );
}

export async function deletePreviewEnvironment(id: string): Promise<void> {
  await requestJson(`/preview-environments/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function promotePreviewEnvironment(
  id: string,
  input: components['schemas']['PromotePreviewEnvironmentRequest'],
): Promise<void> {
  await requestJson(`/preview-environments/${encodeURIComponent(id)}/promote`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export type ScalingPolicy = components['schemas']['ScalingPolicy'];

export type ServiceScalingState = {
  ServiceID?: string;
  CurrentReplicas?: number;
  DesiredReplicas?: number;
  LastScaleAction?: string;
  LastScaleDirection?: string;
};

export async function getScalingPolicy(serviceId: string): Promise<ScalingPolicy | null> {
  try {
    const payload = await requestJson<{ policy?: ScalingPolicy }>(
      `/scaling/policies/${encodeURIComponent(serviceId)}`,
    );
    return payload.policy ?? null;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

export async function setScalingPolicy(policy: ScalingPolicy): Promise<void> {
  await requestJson('/scaling/policies', { method: 'POST', body: JSON.stringify(policy) });
}

export async function deleteScalingPolicy(serviceId: string): Promise<void> {
  await requestJson(`/scaling/policies/${encodeURIComponent(serviceId)}`, { method: 'DELETE' });
}

export async function getServiceScalingState(serviceId: string): Promise<ServiceScalingState | null> {
  try {
    const payload = await requestJson<{ state?: ServiceScalingState }>(
      `/scaling/services/${encodeURIComponent(serviceId)}`,
    );
    return payload.state ?? null;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

export async function manualScaleService(serviceId: string, replicas: number, reason = ''): Promise<void> {
  await requestJson(`/scaling/services/${encodeURIComponent(serviceId)}/scale`, {
    method: 'POST',
    body: JSON.stringify({ replicas, reason }),
  });
}

export type FailoverPolicy = components['schemas']['FailoverPolicy'];

export type HAStatus = {
  enabled?: boolean;
  nodes?: { total?: number; healthy?: number; unhealthy?: number };
  health_checks?: { total?: number; healthy?: number; unhealthy?: number };
  alerts?: { active?: number };
};

export type HAAlert = {
  id?: string;
  rule_id?: string;
  status?: string;
  severity?: string;
  message?: string;
  starts_at?: string;
  ends_at?: string;
};

export type HAHealthResult = {
  check_id?: string;
  status?: string;
  message?: string;
  latency?: number;
  timestamp?: string;
};

export async function getHAStatus(): Promise<HAStatus> {
  const payload = await requestJson<{ status?: HAStatus }>('/ha/status');
  return payload.status ?? {};
}

export async function setHAEnabled(enabled: boolean): Promise<void> {
  await requestJson(enabled ? '/ha/enable' : '/ha/disable', { method: 'POST' });
}

export async function triggerFailover(reason: string): Promise<void> {
  await requestJson('/ha/failover', { method: 'POST', body: JSON.stringify({ reason }) });
}

export async function listFailoverPolicies(): Promise<FailoverPolicy[]> {
  const payload = await requestJson<{ policies?: FailoverPolicy[] }>('/ha/failover/policies');
  return payload.policies ?? [];
}

export async function setFailoverPolicy(policy: FailoverPolicy): Promise<void> {
  await requestJson('/ha/failover/policies', { method: 'POST', body: JSON.stringify(policy) });
}

export async function deleteFailoverPolicy(serviceId: string): Promise<void> {
  await requestJson(`/ha/failover/policies/${encodeURIComponent(serviceId)}`, { method: 'DELETE' });
}

export async function listActiveAlerts(): Promise<HAAlert[]> {
  const payload = await requestJson<{ alerts?: HAAlert[] }>('/ha/alerts/active');
  return payload.alerts ?? [];
}

export async function resolveAlert(alertId: string): Promise<void> {
  await requestJson(`/ha/alerts/${encodeURIComponent(alertId)}/resolve`, { method: 'POST' });
}

export async function listHealthResults(): Promise<HAHealthResult[]> {
  const payload = await requestJson<{ results?: HAHealthResult[] }>('/ha/health/results');
  return payload.results ?? [];
}

export type SecurityScan = components['schemas']['SecurityScan'];
export type Vulnerability = components['schemas']['Vulnerability'];

export type SecurityMetrics = {
  vulnerabilities?: {
    total?: number; critical?: number; high?: number; medium?: number;
    low?: number; open?: number; resolved?: number;
  };
  latest_scan?: { id?: string; score?: number; scanned_at?: string; status?: string };
  compliance?: { overall_status?: string; score?: number; last_assessed?: string };
  security_score?: number;
};

export async function startSecurityScan(input: {
  project_id: string;
  service_id?: string;
  scan_type: 'dependency' | 'configuration' | 'comprehensive';
}): Promise<SecurityScan> {
  return requestJson<SecurityScan>('/security/scans', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function getSecurityScan(scanId: string): Promise<SecurityScan> {
  const payload = await requestJson<{ scan?: SecurityScan } | SecurityScan>(
    `/security/scans/${encodeURIComponent(scanId)}`,
  );
  return 'scan' in payload && payload.scan ? payload.scan : (payload as SecurityScan);
}

export async function getSecurityHistory(projectId: string): Promise<SecurityScan[]> {
  const payload = await requestJson<{ scans?: SecurityScan[] }>(
    `/projects/${encodeURIComponent(projectId)}/security/history`,
  );
  return payload.scans ?? [];
}

export async function listVulnerabilities(projectId: string): Promise<Vulnerability[]> {
  const payload = await requestJson<{ vulnerabilities?: Vulnerability[] }>(
    `/projects/${encodeURIComponent(projectId)}/vulnerabilities`,
  );
  return payload.vulnerabilities ?? [];
}

export async function updateVulnerability(id: string, status: 'open' | 'resolved' | 'ignored'): Promise<void> {
  await requestJson(`/vulnerabilities/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify({ status }),
  });
}

export async function getSecurityMetrics(projectId: string): Promise<SecurityMetrics> {
  return requestJson<SecurityMetrics>(`/projects/${encodeURIComponent(projectId)}/security/metrics`);
}

export type ExecResult = { output?: string; exit_code?: number; error?: string };

export async function execInService(serviceId: string, command: string): Promise<ExecResult> {
  return requestJson<ExecResult>(`/services/${encodeURIComponent(serviceId)}/exec`, {
    method: 'POST',
    body: JSON.stringify({ command }),
  });
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

export type AdminUser = {
  id: string;
  email: string;
  name: string;
  avatar_url?: string;
  is_admin: boolean;
  created_at?: string;
};

export type AdminOverview = {
  stats: Record<string, number>;
  pending_projects: ProjectEntity[];
};

export async function getAdminOverview(): Promise<AdminOverview> {
  const payload = await requestJson<{
    stats?: Record<string, number>;
    pending_projects?: RawProject[];
  }>('/admin/overview');

  return {
    stats: payload.stats ?? {},
    pending_projects: (payload.pending_projects ?? [])
      .map((project) => normalizeProject(project))
      .filter((project): project is ProjectEntity => project !== null),
  };
}

export async function listAdminUsers(): Promise<AdminUser[]> {
  const payload = await requestJson<{ users?: AdminUser[] }>('/admin/users');
  return payload.users ?? [];
}

export async function setUserAdmin(userId: string, isAdmin: boolean): Promise<void> {
  await requestJson(`/admin/users/${encodeURIComponent(userId)}`, {
    method: 'PATCH',
    body: JSON.stringify({ is_admin: isAdmin }),
  });
}

export async function setProjectApproval(projectId: string, isApproved: boolean): Promise<ProjectEntity | null> {
  const payload = await requestJson<{ project?: RawProject; message?: string }>(
    `/admin/projects/${encodeURIComponent(projectId)}`,
    { method: 'PATCH', body: JSON.stringify({ is_approved: isApproved }) },
  );
  return payload.project ? normalizeProject(payload.project) : null;
}
