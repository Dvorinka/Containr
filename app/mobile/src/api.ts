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
