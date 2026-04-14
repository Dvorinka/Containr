import type {
  Project,
  Service,
  CreateServiceRequest,
  UpdateServiceRequest,
  User,
  Pagination,
  AuthResponse,
  PreviewEnvironment,
  CreatePreviewEnvironmentRequest,
  UpdatePreviewEnvironmentRequest,
  PromotePreviewRequest,
  GitProvider,
  GitRepository,
  CreateProviderRequest,
  ConnectRepositoryRequest,
  CreateWebhookRequest,
  Webhook,
  Branch,
  Deployment,
  CreateDeploymentRequest,
  EnvironmentVariable,
  CronJob,
  CreateCronJobRequest,
  UpdateCronJobRequest,
  CronExecution,
  AuditLog,
  Template,
  DeployFromTemplateRequest,
  ImportGitHubTemplateRequest,
  ImportComposeTemplateRequest,
  AnalyticsSettings,
  UpdateAnalyticsSettingsRequest,
} from '@/types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

export const api = {
  get: async <T>(endpoint: string) => {
    const token = localStorage.getItem('auth_token');
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
      },
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || `HTTP error! status: ${response.status}`);
    }
    return response.json() as Promise<T>;
  },
  post: async <T>(endpoint: string, data?: unknown) => {
    const token = localStorage.getItem('auth_token');
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || `HTTP error! status: ${response.status}`);
    }
    return response.json() as Promise<T>;
  },
  put: async <T>(endpoint: string, data?: unknown) => {
    const token = localStorage.getItem('auth_token');
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || `HTTP error! status: ${response.status}`);
    }
    return response.json() as Promise<T>;
  },
  delete: async <T>(endpoint: string) => {
    const token = localStorage.getItem('auth_token');
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
      },
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || `HTTP error! status: ${response.status}`);
    }
    return response.json() as Promise<T>;
  },
};

// Helper function for API calls
async function apiCall<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('auth_token');
  
  const config: RequestInit = {
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
    ...options,
  };

  const response = await fetch(`${API_BASE_URL}${endpoint}`, config);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `HTTP error! status: ${response.status}`);
  }

  return response.json();
}

// Authentication API
export const authApi = {
  login: async (email: string, password: string): Promise<AuthResponse> => {
    return apiCall<AuthResponse>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  register: async (email: string, password: string, name: string): Promise<AuthResponse> => {
    return apiCall<AuthResponse>('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    });
  },

  getProfile: async (): Promise<User> => {
    return apiCall<User>('/api/v1/user/profile');
  },

  updateProfile: async (data: Partial<Pick<User, 'name' | 'email'>>): Promise<User> => {
    return apiCall<User>('/api/v1/user/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
};

// Projects API
export const projectsApi = {
  getProjects: async (params?: { page?: number; limit?: number; search?: string }): Promise<{ projects: Project[]; pagination: Pagination }> => {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.search) queryParams.append('search', params.search);
    
    const queryString = queryParams.toString();
    const endpoint = `/api/v1/projects${queryString ? `?${queryString}` : ''}`;
    
    return apiCall<{ projects: Project[]; pagination: Pagination }>(endpoint);
  },

  getProject: async (id: string): Promise<{ project: Project }> => {
    const response = await apiCall<Project | { project: Project }>(`/api/v1/projects/${id}`);
    return 'project' in response ? response : { project: response };
  },

  createProject: async (data: { name: string; description?: string }): Promise<{ project: Project }> => {
    const response = await apiCall<Project | { project: Project }>('/api/v1/projects', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return 'project' in response ? response : { project: response };
  },

  updateProject: async (id: string, data: { name?: string; description?: string }): Promise<{ project: Project }> => {
    const response = await apiCall<Project | { project: Project }>(`/api/v1/projects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return 'project' in response ? response : { project: response };
  },

  deleteProject: async (id: string): Promise<{ message: string }> => {
    return apiCall<{ message: string }>(`/api/v1/projects/${id}`, {
      method: 'DELETE',
    });
  },

  getPreviewEnvironments: async (projectId: string): Promise<{ preview_environments: PreviewEnvironment[] }> => {
    return apiCall<{ preview_environments: PreviewEnvironment[] }>(`/api/v1/projects/${projectId}/preview-environments`);
  },

  getServices: async (projectId: string): Promise<{ services: Service[] }> => {
    return apiCall<{ services: Service[] }>(`/api/v1/projects/${projectId}/services`);
  },

  createPreviewEnvironment: async (projectId: string, data: CreatePreviewEnvironmentRequest): Promise<{ preview_environment: PreviewEnvironment }> => {
    return apiCall<{ preview_environment: PreviewEnvironment }>(`/api/v1/projects/${projectId}/preview-environments`, {
      method: 'POST',
      body: JSON.stringify({ ...data, project_id: projectId }),
    });
  },

  updatePreviewEnvironment: async (id: string, data: UpdatePreviewEnvironmentRequest): Promise<{ preview_environment: PreviewEnvironment }> => {
    return apiCall<{ preview_environment: PreviewEnvironment }>(`/api/v1/preview-environments/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  deletePreviewEnvironment: async (id: string): Promise<{ message: string }> => {
    return apiCall<{ message: string }>(`/api/v1/preview-environments/${id}`, {
      method: 'DELETE',
    });
  },

  promotePreviewEnvironment: async (id: string, data: PromotePreviewRequest): Promise<{ promotion: { status: string; target_environment: string } }> => {
    return apiCall<{ promotion: { status: string; target_environment: string } }>(`/api/v1/preview-environments/${id}/promote`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  cleanupExpiredPreviewEnvironments: async (): Promise<{ message: string; cleaned_count: number }> => {
    return apiCall<{ message: string; cleaned_count: number }>('/api/v1/preview-environments/cleanup-expired', {
      method: 'POST',
    });
  },
};

// Services API
export const servicesApi = {
  getServices: async (projectId: string) => {
    return apiCall<{ services: Service[] }>(`/api/v1/projects/${projectId}/services`);
  },

  getService: async (id: string) => {
    return apiCall<{ service: Service }>(`/api/v1/services/${id}`);
  },

  createService: async (projectId: string, data: CreateServiceRequest) => {
    return apiCall<{ service: Service }>(`/api/v1/projects/${projectId}/services`, {
      method: 'POST',
      body: JSON.stringify({ ...data, project_id: projectId }),
    });
  },

  updateService: async (id: string, data: UpdateServiceRequest) => {
    return apiCall<{ service: Service }>(`/api/v1/services/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  deleteService: async (id: string) => {
    return apiCall<{ message: string }>(`/api/v1/services/${id}`, {
      method: 'DELETE',
    });
  },
};

// Deployments API
export const deploymentsApi = {
  getDeployments: async (serviceId: string): Promise<{ deployments: Deployment[] }> => {
    return apiCall<{ deployments: Deployment[] }>(`/api/v1/services/${serviceId}/deployments`);
  },

  createDeployment: async (serviceId: string, data: CreateDeploymentRequest): Promise<{ deployment: Deployment }> => {
    const response = await apiCall<Deployment | { deployment: Deployment }>(`/api/v1/services/${serviceId}/deployments`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return 'deployment' in response ? response : { deployment: response };
  },

  getDeployment: async (id: string): Promise<{ deployment: Deployment }> => {
    return apiCall<{ deployment: Deployment }>(`/api/v1/deployments/${id}`);
  },

  rollbackDeployment: async (id: string): Promise<{ deployment: Deployment }> => {
    return apiCall<{ deployment: Deployment }>(`/api/v1/deployments/${id}/rollback`, {
      method: 'POST',
    });
  },
};

// Environment Variables API
export const variablesApi = {
  getVariables: async (serviceId: string): Promise<{ variables: EnvironmentVariable[] }> => {
    return apiCall<{ variables: EnvironmentVariable[] }>(`/api/v1/services/${serviceId}/variables`);
  },

  updateVariables: async (serviceId: string, variables: { key: string; value: string; is_secret?: boolean }[]): Promise<{ variables: EnvironmentVariable[] }> => {
    return apiCall<{ variables: EnvironmentVariable[] }>(`/api/v1/services/${serviceId}/variables`, {
      method: 'PUT',
      body: JSON.stringify({ variables }),
    });
  },
};

// Logs API
export const logsApi = {
  getServiceLogs: async (serviceId: string, options?: { tail?: number; follow?: boolean }) => {
    const params = new URLSearchParams();
    if (options?.tail) params.append('tail', options.tail.toString());
    if (options?.follow) params.append('follow', 'true');
    
    return apiCall<{ logs: Array<{ timestamp: string; message: string; stream: string }> }>(`/api/v1/services/${serviceId}/logs?${params}`);
  },

  getDeploymentLogs: async (deploymentId: string, options?: { lines?: number }) => {
    const params = new URLSearchParams();
    if (options?.lines) params.append('lines', options.lines.toString());
    
    return apiCall<{ logs: Array<{ timestamp: string; message: string; stream: string }> }>(`/api/v1/deployments/${deploymentId}/logs?${params}`);
  },
};


// Git Integration API
export const gitApi = {
  getProviders: async (): Promise<{ providers: GitProvider[] }> => {
    return apiCall<{ providers: GitProvider[] }>('/api/v1/git/providers');
  },

  createProvider: async (data: CreateProviderRequest): Promise<{ provider: GitProvider }> => {
    const response = await apiCall<GitProvider | { provider: GitProvider }>('/api/v1/git/providers', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return 'provider' in response ? response : { provider: response };
  },

  getProviderRepositories: async (providerId: string): Promise<{ repositories: GitRepository[] }> => {
    return apiCall<{ repositories: GitRepository[] }>(`/api/v1/git/providers/${providerId}/repositories`);
  },

  connectRepository: async (data: ConnectRepositoryRequest): Promise<{ repository: GitRepository }> => {
    const response = await apiCall<GitRepository | { repository: GitRepository }>('/api/v1/git/repositories/connect', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return 'repository' in response ? response : { repository: response };
  },

  getConnectedRepositories: async (params?: { page?: number; limit?: number }): Promise<{ 
    repositories: GitRepository[]; 
    pagination: Pagination 
  }> => {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.append('page', params.page.toString());
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    
    const queryString = searchParams.toString();
    const response = await apiCall<{ 
      repositories: GitRepository[]; 
      pagination: Pagination 
    }>(`/api/v1/git/repositories${queryString ? '?' + queryString : ''}`);
    
    if (typeof response.pagination.pages !== 'number') {
      const { total, limit } = response.pagination;
      response.pagination.pages = limit > 0 ? Math.ceil(total / limit) : 1;
    }

    return response;
  },

  createWebhook: async (data: CreateWebhookRequest): Promise<{ 
    webhook: Webhook; 
    remote_webhook_id: string 
  }> => {
    return apiCall<{ 
      webhook: Webhook; 
      remote_webhook_id: string 
    }>('/api/v1/git/webhooks', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  getRepositoryBranches: async (repoId: string): Promise<{ branches: Branch[] }> => {
    return apiCall<{ branches: Branch[] }>(`/api/v1/git/repositories/${repoId}/branches`);
  },
};

export const templatesApi = {
  getTemplates: async (params?: { category?: string }): Promise<{ templates: Template[] }> => {
    const searchParams = new URLSearchParams();
    if (params?.category) searchParams.append('category', params.category);
    const queryString = searchParams.toString();

    return apiCall<{ templates: Template[] }>(`/api/v1/templates${queryString ? '?' + queryString : ''}`);
  },

  getTemplate: async (id: string): Promise<{ template: Template; config: Record<string, unknown>; variables: unknown[]; screenshots?: string[] }> => {
    return apiCall<{ template: Template; config: Record<string, unknown>; variables: unknown[]; screenshots?: string[] }>(`/api/v1/templates/${id}`);
  },

  deployTemplate: async (id: string, data: DeployFromTemplateRequest): Promise<{ service_id: string; service_ids?: string[]; serviceCount?: number; message: string }> => {
    return apiCall<{ service_id: string; service_ids?: string[]; serviceCount?: number; message: string }>(`/api/v1/templates/${id}/deploy`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  importGitHubTemplate: async (data: ImportGitHubTemplateRequest): Promise<{ template: Template }> => {
    return apiCall<{ template: Template }>('/api/v1/templates/import/github', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  importComposeTemplate: async (data: ImportComposeTemplateRequest): Promise<{ template: Template }> => {
    return apiCall<{ template: Template }>('/api/v1/templates/import/compose', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};

export const auditApi = {
  getAuditLogs: async (params?: { resource?: string; action?: string; page?: number; limit?: number }): Promise<{ audit_logs: AuditLog[] }> => {
    const searchParams = new URLSearchParams();
    if (params?.resource) searchParams.append('resource', params.resource);
    if (params?.action) searchParams.append('action', params.action);
    if (params?.page) searchParams.append('page', params.page.toString());
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    const queryString = searchParams.toString();

    return apiCall<{ audit_logs: AuditLog[] }>(`/api/v1/audit-logs${queryString ? '?' + queryString : ''}`);
  },

  getResourceAuditLogs: async (resource: string, id: string): Promise<{ audit_logs: AuditLog[] }> => {
    return apiCall<{ audit_logs: AuditLog[] }>(`/api/v1/audit-logs/${resource}/${id}`);
  },
};

// Analytics API (Umami Integration)
export const analyticsApi = {
  // Overview Metrics
  getOverview: async (timeRange: string, projectId?: string) => {
    const params = new URLSearchParams();
    params.append('timeRange', timeRange);
    if (projectId) params.append('projectId', projectId);
    
    return apiCall<{
      visitors: { current: number; previous: number; change: number; trend: 'up' | 'down' };
      pageviews: { current: number; previous: number; change: number; trend: 'up' | 'down' };
      sessions: { current: number; previous: number; change: number; trend: 'up' | 'down' };
      bounceRate: { current: number; previous: number; change: number; trend: 'up' | 'down' };
      sessionDuration: { current: number; previous: number; change: number; trend: 'up' | 'down' };
      conversionRate: { current: number; previous: number; change: number; trend: 'up' | 'down' };
    }>(`/api/v1/analytics/overview?${params}`);
  },

  // Visitor Analytics
  getVisitorAnalytics: async (timeRange: string, projectId?: string) => {
    const params = new URLSearchParams();
    params.append('timeRange', timeRange);
    if (projectId) params.append('projectId', projectId);
    
    return apiCall<{
      newVsReturning: { new: number; returning: number };
      devices: { desktop: number; mobile: number; tablet: number };
      browsers: Array<{ name: string; percentage: number; users: number }>;
      operatingSystems: Array<{ name: string; percentage: number; users: number }>;
      countries: Array<{ name: string; percentage: number; users: number }>;
      languages: Array<{ name: string; percentage: number; users: number }>;
    }>(`/api/v1/analytics/visitors?${params}`);
  },

  // Traffic Sources
  getTrafficAnalytics: async (timeRange: string, projectId?: string) => {
    const params = new URLSearchParams();
    params.append('timeRange', timeRange);
    if (projectId) params.append('projectId', projectId);
    
    return apiCall<{
      sources: Array<{
        name: string;
        percentage: number;
        visitors: number;
        trend: 'up' | 'down';
        change: number;
      }>;
      referrers: Array<{ name: string; visitors: number; percentage: number }>;
      campaigns: Array<{
        name: string;
        visitors: number;
        conversionRate: number;
        revenue: number;
      }>;
      keywords: Array<{ name: string; visitors: number; percentage: number }>;
    }>(`/api/v1/analytics/traffic?${params}`);
  },

  // Content Analytics
  getContentAnalytics: async (timeRange: string, projectId?: string) => {
    const params = new URLSearchParams();
    params.append('timeRange', timeRange);
    if (projectId) params.append('projectId', projectId);
    
    return apiCall<{
      topPages: Array<{
        url: string;
        title: string;
        pageviews: number;
        uniquePageviews: number;
        avgTimeOnPage: number;
        bounceRate: number;
        exitRate: number;
        trend: 'up' | 'down';
        change: number;
      }>;
      landingPages: Array<{
        url: string;
        title: string;
        entrances: number;
        bounceRate: number;
        conversions: number;
        conversionRate: number;
      }>;
      exitPages: Array<{
        url: string;
        title: string;
        exits: number;
        exitRate: number;
        totalPageviews: number;
      }>;
      events: Array<{
        name: string;
        count: number;
        uniqueUsers: number;
        category: string;
      }>;
    }>(`/api/v1/analytics/content?${params}`);
  },

  // Real-time Analytics
  getRealTimeAnalytics: async (projectId?: string) => {
    const params = new URLSearchParams();
    if (projectId) params.append('projectId', projectId);
    
    return apiCall<{
      onlineUsers: number;
      currentVisitors: number;
      pageviews: Array<{ url: string; title: string; count: number; percentage: number }>;
      locations: Array<{ country: string; count: number; percentage: number }>;
      devices: Array<{ type: string; count: number; percentage: number }>;
      recentActivity: Array<{
        type: string;
        user: string;
        page: string;
        location: string;
        device: string;
        event?: string;
        timestamp: string;
      }>;
    }>(`/api/v1/analytics/realtime?${params}`);
  },

  // Custom Events
  trackEvent: async (data: {
    event: string;
    url: string;
    referrer?: string;
    userAgent?: string;
    projectId?: string;
    metadata?: Record<string, any>;
  }) => {
    return apiCall<{ success: boolean }>('/api/v1/analytics/events', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Reports
  generateReport: async (data: {
    timeRange: string;
    metrics: string[];
    format: 'json' | 'csv' | 'pdf';
    projectId?: string;
  }) => {
    return apiCall<{ reportUrl: string }>('/api/v1/analytics/reports', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Settings
  getSettings: async (projectId?: string): Promise<AnalyticsSettings> => {
    const params = new URLSearchParams();
    if (projectId) params.append('projectId', projectId);
    
    return apiCall<AnalyticsSettings>(`/api/v1/analytics/settings?${params}`);
  },

  updateSettings: async (data: UpdateAnalyticsSettingsRequest): Promise<{ settings: AnalyticsSettings }> => {
    return apiCall<{ settings: AnalyticsSettings }>('/api/v1/analytics/settings', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
};
