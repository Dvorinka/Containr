export interface Project {
  id: string;
  name: string;
  description?: string;
  created_at?: string;
}

export interface Service {
  id: string;
  project_id: string;
  name: string;
  type: string;
  status: string;
  image?: string;
  environment?: string;
  domain?: string;
  public_url?: string;
  port?: number;
  replicas?: number;
  cpu?: string;
  memory?: string;
  sleep_enabled?: boolean;
  sleep_idle_minutes?: number;
  created_at?: string;
  updated_at?: string;
}

export interface Deployment {
  id: string;
  service_id: string;
  service_name?: string;
  project_name?: string;
  status: string;
  image_name?: string;
  created_at?: string;
  completed_at?: string | null;
}

export interface Database {
  id: string;
  name: string;
  type: string;
  status: string;
  version?: string;
  plan?: string;
  connection_url?: string;
  created_at?: string;
}

export interface EnvCheck {
  ok: boolean;
  unresolved: string[];
  empty: string[];
  unreadable: string[];
}

export interface LogEntry {
  timestamp: string;
  message: string;
  stream: string;
}

export interface Template {
  id: string;
  name: string;
  description?: string;
  category?: string;
  icon?: string;
}

export interface Variable {
  id?: string;
  key: string;
  value: string;
  is_secret: boolean;
}

export interface ServiceDomain {
  id: string;
  domain: string;
  is_default: boolean;
  cert_type?: string;
  cert_status?: string;
}

export interface AppNotification {
  id: string;
  kind: string;
  title: string;
  body?: string;
  resource_type?: string;
  resource_id?: string;
  read_at?: string | null;
  created_at?: string;
}

export interface NotificationChannel {
  id: string;
  kind: 'ntfy' | 'gotify';
  endpoint: string;
  enabled: boolean;
  created_at?: string;
}

export interface CronJob {
  id: string;
  service_id?: string;
  name: string;
  schedule: string;
  command: string;
  timezone?: string;
  enabled?: boolean;
  last_run_at?: string;
  next_run_at?: string;
  last_status?: string;
  last_output?: string;
}

export interface CronExecution {
  id: string;
  cron_job_id: string;
  started_at?: string;
  finished_at?: string;
  status?: string;
  output?: string;
  error?: string;
}

// Masked value the API returns for secret variables; echoing it back on
// update preserves the stored ciphertext.
export const MASKED_SECRET = '********';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export class Api {
  constructor(
    private baseUrl: string,
    private token: string,
  ) {}

  private async req<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${this.baseUrl}/api/v1${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) {
      let msg = `HTTP ${res.status}`;
      try {
        const j = (await res.json()) as { error?: string };
        if (j.error) msg = j.error;
      } catch {
        // non-JSON error body
      }
      throw new ApiError(res.status, msg);
    }
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  ping() {
    return fetch(`${this.baseUrl}/health`).then((r) => r.ok);
  }

  projects() {
    return this.req<{ projects: Project[] }>('GET', '/projects?limit=100').then(
      (r) => r.projects ?? [],
    );
  }

  projectServices(projectId: string) {
    return this.req<{ services: Service[] }>(
      'GET',
      `/projects/${projectId}/services?limit=200`,
    ).then((r) => r.services ?? []);
  }

  service(id: string) {
    return this.req<{ service: Service }>('GET', `/services/${id}`).then((r) => r.service);
  }

  serviceAction(id: string, action: 'start' | 'stop' | 'restart' | 'redeploy' | 'sleep' | 'wake') {
    return this.req<{ status?: string; message?: string }>(
      'POST',
      `/services/${id}/${action}`,
    );
  }

  serviceLogs(id: string, tail = 300) {
    return this.req<{ logs: LogEntry[]; message?: string }>(
      'GET',
      `/services/${id}/logs?tail=${tail}`,
    ).then((r) => r.logs ?? []);
  }

  envCheck(id: string) {
    return this.req<EnvCheck>('GET', `/services/${id}/env-check`);
  }

  serviceVariables(id: string) {
    return this.req<{ variables: Variable[] }>('GET', `/services/${id}/variables`).then(
      (r) => r.variables ?? [],
    );
  }

  updateVariables(id: string, variables: { key: string; value: string; is_secret: boolean }[]) {
    return this.req<unknown>('PUT', `/services/${id}/variables`, { variables });
  }

  serviceDomains(id: string) {
    return this.req<{ domains: ServiceDomain[] }>('GET', `/services/${id}/domains`).then(
      (r) => r.domains ?? [],
    );
  }

  addDomain(id: string, domain: string) {
    return this.req<unknown>('POST', `/services/${id}/domains`, { domain });
  }

  deleteDomain(id: string, domainId: string) {
    return this.req<unknown>('DELETE', `/services/${id}/domains/${domainId}`);
  }

  setDefaultDomain(id: string, domainId: string) {
    return this.req<unknown>('POST', `/services/${id}/domains/${domainId}/default`);
  }

  updateService(
    id: string,
    patch: Partial<{
      name: string;
      command: string;
      replicas: number;
      port: number;
      domain: string;
      restart_policy: string;
      healthcheck_path: string;
      cpu: string;
      memory: string;
      sleep_enabled: boolean;
      sleep_idle_minutes: number;
      maintenance_mode: boolean;
    }>,
  ) {
    return this.req<unknown>('PUT', `/services/${id}`, patch);
  }

  notifications() {
    return this.req<{ notifications: AppNotification[]; unread: number }>(
      'GET',
      '/notifications?limit=50',
    );
  }

  markNotificationRead(id: string) {
    return this.req<unknown>('POST', `/notifications/${id}/read`);
  }

  markAllNotificationsRead() {
    return this.req<unknown>('POST', '/notifications/read-all');
  }

  notificationChannels() {
    return this.req<{ channels: NotificationChannel[] }>(
      'GET',
      '/notifications/channels',
    ).then((r) => r.channels ?? []);
  }

  addNotificationChannel(input: {
    kind: 'ntfy' | 'gotify';
    endpoint: string;
    token?: string;
  }) {
    return this.req<{ channel: NotificationChannel }>(
      'POST',
      '/notifications/channels',
      input,
    );
  }

  deleteNotificationChannel(id: string) {
    return this.req<unknown>('DELETE', `/notifications/channels/${id}`);
  }

  testNotificationChannel(id: string) {
    return this.req<unknown>('POST', `/notifications/channels/${id}/test`, {});
  }

  cronJobs(serviceId: string) {
    return this.req<{ cron_jobs: CronJob[] }>(
      'GET',
      `/cron-jobs?service_id=${serviceId}`,
    ).then((r) => r.cron_jobs ?? []);
  }

  cronExecutions(jobId: string) {
    return this.req<{ executions: CronExecution[] }>(
      'GET',
      `/cron-jobs/${jobId}/executions`,
    ).then((r) => r.executions ?? []);
  }

  triggerCronJob(jobId: string) {
    return this.req<unknown>('POST', `/cron-jobs/${jobId}/trigger`, {});
  }

  serviceDeployments(id: string) {
    return this.req<{ deployments: Deployment[] }>(
      'GET',
      `/services/${id}/deployments?limit=20`,
    ).then((r) => r.deployments ?? []);
  }

  recentDeployments() {
    return this.req<{ deployments: Deployment[] }>(
      'GET',
      '/deployments?limit=20',
    ).then((r) => r.deployments ?? []);
  }

  deploymentAction(id: string, action: 'rollback' | 'cancel') {
    return this.req<unknown>('POST', `/deployments/${id}/${action}`);
  }

  databases() {
    return this.req<{ databases: Database[] }>('GET', '/databases').then(
      (r) => r.databases ?? [],
    );
  }

  databaseBackup(id: string) {
    return this.req<unknown>('POST', `/databases/${id}/backup`);
  }

  databaseAction(id: string, action: 'start' | 'stop' | 'restart') {
    return this.req<unknown>('POST', `/databases/${id}/action`, { action });
  }

  templates() {
    return this.req<{ templates: Template[] }>('GET', '/templates?limit=100').then(
      (r) => r.templates ?? [],
    );
  }
}
