import type { Project, Service, CreateServiceRequest, UpdateServiceRequest } from '@/types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

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
  login: async (email: string, password: string) => {
    const response = await apiCall<{ token: string; user: any }>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    return response;
  },

  register: async (email: string, password: string, name: string) => {
    const response = await apiCall<{ token: string; user: any }>('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    });
    return response;
  },

  getProfile: async () => {
    return apiCall<any>('/api/v1/user/profile');
  },

  updateProfile: async (data: any) => {
    return apiCall<any>('/api/v1/user/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
};

// Projects API
export const projectsApi = {
  getProjects: async (params?: { page?: number; limit?: number; search?: string }) => {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.search) queryParams.append('search', params.search);
    
    const queryString = queryParams.toString();
    const endpoint = `/api/v1/projects${queryString ? `?${queryString}` : ''}`;
    
    return apiCall<{ projects: Project[]; pagination: any }>(endpoint);
  },

  getProject: async (id: string) => {
    return apiCall<{ project: Project }>(`/api/v1/projects/${id}`);
  },

  createProject: async (data: { name: string; description?: string }) => {
    return apiCall<{ project: Project }>('/api/v1/projects', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  updateProject: async (id: string, data: { name?: string; description?: string }) => {
    return apiCall<{ project: Project }>(`/api/v1/projects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  deleteProject: async (id: string) => {
    return apiCall<{ message: string }>(`/api/v1/projects/${id}`, {
      method: 'DELETE',
    });
  },

  // Preview Environments
  getPreviewEnvironments: async (projectId: string) => {
    return apiCall<{ preview_environments: any[] }>(`/api/v1/projects/${projectId}/preview-environments`);
  },

  getServices: async (projectId: string) => {
    return apiCall<{ services: Service[] }>(`/api/v1/projects/${projectId}/services`);
  },

  createPreviewEnvironment: async (projectId: string, data: any) => {
    return apiCall<{ preview_environment: any }>(`/api/v1/projects/${projectId}/preview-environments`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  updatePreviewEnvironment: async (id: string, data: any) => {
    return apiCall<{ preview_environment: any }>(`/api/v1/preview-environments/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  deletePreviewEnvironment: async (id: string) => {
    return apiCall<{ message: string }>(`/api/v1/preview-environments/${id}`, {
      method: 'DELETE',
    });
  },

  promotePreviewEnvironment: async (id: string, data: any) => {
    return apiCall<{ promotion: any }>(`/api/v1/preview-environments/${id}/promote`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  cleanupExpiredPreviewEnvironments: async () => {
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
  getDeployments: async (serviceId: string) => {
    return apiCall<{ deployments: any[] }>(`/api/v1/services/${serviceId}/deployments`);
  },

  createDeployment: async (serviceId: string, data: any) => {
    return apiCall<{ deployment: any }>(`/api/v1/services/${serviceId}/deployments`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  getDeployment: async (id: string) => {
    return apiCall<{ deployment: any }>(`/api/v1/deployments/${id}`);
  },

  rollbackDeployment: async (id: string) => {
    return apiCall<{ deployment: any }>(`/api/v1/deployments/${id}/rollback`, {
      method: 'POST',
    });
  },
};

// Environment Variables API
export const variablesApi = {
  getVariables: async (serviceId: string) => {
    return apiCall<{ variables: any[] }>(`/api/v1/services/${serviceId}/variables`);
  },

  updateVariables: async (serviceId: string, variables: Record<string, string>) => {
    return apiCall<{ variables: any[] }>(`/api/v1/services/${serviceId}/variables`, {
      method: 'PUT',
      body: JSON.stringify({ variables }),
    });
  },
};

// Logs API
export const logsApi = {
  getServiceLogs: async (serviceId: string, options?: { lines?: number; follow?: boolean }) => {
    const params = new URLSearchParams();
    if (options?.lines) params.append('lines', options.lines.toString());
    if (options?.follow) params.append('follow', 'true');
    
    return apiCall<{ logs: string[] }>(`/api/v1/services/${serviceId}/logs?${params}`);
  },

  getDeploymentLogs: async (deploymentId: string, options?: { lines?: number }) => {
    const params = new URLSearchParams();
    if (options?.lines) params.append('lines', options.lines.toString());
    
    return apiCall<{ logs: string[] }>(`/api/v1/deployments/${deploymentId}/logs?${params}`);
  },
};

// Health check
export const healthApi = {
  check: async () => {
    return apiCall<{ status: string; service: string }>('/health');
  },
};

// Git Integration API
export const gitApi = {
  // Git Providers
  getProviders: async () => {
    return apiCall<{ providers: any[] }>('/api/v1/git/providers');
  },

  createProvider: async (data: { name: string; display_name: string; access_token: string }) => {
    return apiCall<{ provider: any }>('/api/v1/git/providers', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Git Repositories
  getProviderRepositories: async (providerId: string) => {
    return apiCall<{ repositories: any[] }>(`/api/v1/git/providers/${providerId}/repositories`);
  },

  connectRepository: async (data: { provider_id: string; repo_full_name: string }) => {
    return apiCall<{ repository: any }>('/api/v1/git/repositories/connect', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  getConnectedRepositories: async (params?: { page?: number; limit?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.append('page', params.page.toString());
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    
    const queryString = searchParams.toString();
    return apiCall<{ 
      repositories: any[]; 
      pagination: { page: number; limit: number; total: number } 
    }>(`/api/v1/git/repositories${queryString ? '?' + queryString : ''}`);
  },

  // Webhooks
  createWebhook: async (data: { 
    repo_id: string; 
    events: string[]; 
    branch?: string 
  }) => {
    return apiCall<{ 
      webhook: any; 
      remote_webhook_id: string 
    }>('/api/v1/git/webhooks', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Branches
  getRepositoryBranches: async (repoId: string) => {
    return apiCall<{ branches: any[] }>(`/api/v1/git/repositories/${repoId}/branches`);
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
  getSettings: async (projectId?: string) => {
    const params = new URLSearchParams();
    if (projectId) params.append('projectId', projectId);
    
    return apiCall<{
      trackingEnabled: boolean;
      dataRetention: number;
      anonymizeIp: boolean;
      respectDoNotTrack: boolean;
      customEvents: string[];
    }>(`/api/v1/analytics/settings?${params}`);
  },

  updateSettings: async (data: {
    trackingEnabled?: boolean;
    dataRetention?: number;
    anonymizeIp?: boolean;
    respectDoNotTrack?: boolean;
    customEvents?: string[];
    projectId?: string;
  }) => {
    return apiCall<{ settings: any }>('/api/v1/analytics/settings', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
};
