const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';
export const api = {
    get: async (endpoint) => {
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
        return response.json();
    },
    post: async (endpoint, data) => {
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
        return response.json();
    },
    put: async (endpoint, data) => {
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
        return response.json();
    },
    delete: async (endpoint) => {
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
        return response.json();
    },
};
// Helper function for API calls
async function apiCall(endpoint, options = {}) {
    const token = localStorage.getItem('auth_token');
    const config = {
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
    login: async (email, password) => {
        const response = await apiCall('/api/v1/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
        });
        return response;
    },
    register: async (email, password, name) => {
        const response = await apiCall('/api/v1/auth/register', {
            method: 'POST',
            body: JSON.stringify({ email, password, name }),
        });
        return response;
    },
    getProfile: async () => {
        return apiCall('/api/v1/user/profile');
    },
    updateProfile: async (data) => {
        return apiCall('/api/v1/user/profile', {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    },
};
// Projects API
export const projectsApi = {
    getProjects: async (params) => {
        const queryParams = new URLSearchParams();
        if (params?.page)
            queryParams.append('page', params.page.toString());
        if (params?.limit)
            queryParams.append('limit', params.limit.toString());
        if (params?.search)
            queryParams.append('search', params.search);
        const queryString = queryParams.toString();
        const endpoint = `/api/v1/projects${queryString ? `?${queryString}` : ''}`;
        return apiCall(endpoint);
    },
    getProject: async (id) => {
        return apiCall(`/api/v1/projects/${id}`);
    },
    createProject: async (data) => {
        return apiCall('/api/v1/projects', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    },
    updateProject: async (id, data) => {
        return apiCall(`/api/v1/projects/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    },
    deleteProject: async (id) => {
        return apiCall(`/api/v1/projects/${id}`, {
            method: 'DELETE',
        });
    },
    // Preview Environments
    getPreviewEnvironments: async (projectId) => {
        return apiCall(`/api/v1/projects/${projectId}/preview-environments`);
    },
    getServices: async (projectId) => {
        return apiCall(`/api/v1/projects/${projectId}/services`);
    },
    createPreviewEnvironment: async (projectId, data) => {
        return apiCall(`/api/v1/projects/${projectId}/preview-environments`, {
            method: 'POST',
            body: JSON.stringify(data),
        });
    },
    updatePreviewEnvironment: async (id, data) => {
        return apiCall(`/api/v1/preview-environments/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    },
    deletePreviewEnvironment: async (id) => {
        return apiCall(`/api/v1/preview-environments/${id}`, {
            method: 'DELETE',
        });
    },
    promotePreviewEnvironment: async (id, data) => {
        return apiCall(`/api/v1/preview-environments/${id}/promote`, {
            method: 'POST',
            body: JSON.stringify(data),
        });
    },
    cleanupExpiredPreviewEnvironments: async () => {
        return apiCall('/api/v1/preview-environments/cleanup-expired', {
            method: 'POST',
        });
    },
};
// Services API
export const servicesApi = {
    getServices: async (projectId) => {
        return apiCall(`/api/v1/projects/${projectId}/services`);
    },
    getService: async (id) => {
        return apiCall(`/api/v1/services/${id}`);
    },
    createService: async (projectId, data) => {
        return apiCall(`/api/v1/projects/${projectId}/services`, {
            method: 'POST',
            body: JSON.stringify({ ...data, project_id: projectId }),
        });
    },
    updateService: async (id, data) => {
        return apiCall(`/api/v1/services/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    },
    deleteService: async (id) => {
        return apiCall(`/api/v1/services/${id}`, {
            method: 'DELETE',
        });
    },
};
// Deployments API
export const deploymentsApi = {
    getDeployments: async (serviceId) => {
        return apiCall(`/api/v1/services/${serviceId}/deployments`);
    },
    createDeployment: async (serviceId, data) => {
        return apiCall(`/api/v1/services/${serviceId}/deployments`, {
            method: 'POST',
            body: JSON.stringify(data),
        });
    },
    getDeployment: async (id) => {
        return apiCall(`/api/v1/deployments/${id}`);
    },
    rollbackDeployment: async (id) => {
        return apiCall(`/api/v1/deployments/${id}/rollback`, {
            method: 'POST',
        });
    },
};
// Environment Variables API
export const variablesApi = {
    getVariables: async (serviceId) => {
        return apiCall(`/api/v1/services/${serviceId}/variables`);
    },
    updateVariables: async (serviceId, variables) => {
        return apiCall(`/api/v1/services/${serviceId}/variables`, {
            method: 'PUT',
            body: JSON.stringify({ variables }),
        });
    },
};
// Logs API
export const logsApi = {
    getServiceLogs: async (serviceId, options) => {
        const params = new URLSearchParams();
        if (options?.lines)
            params.append('lines', options.lines.toString());
        if (options?.follow)
            params.append('follow', 'true');
        return apiCall(`/api/v1/services/${serviceId}/logs?${params}`);
    },
    getDeploymentLogs: async (deploymentId, options) => {
        const params = new URLSearchParams();
        if (options?.lines)
            params.append('lines', options.lines.toString());
        return apiCall(`/api/v1/deployments/${deploymentId}/logs?${params}`);
    },
};
// Health check
const healthApi = {
    check: async () => {
        return apiCall('/health');
    },
};
// Git Integration API
export const gitApi = {
    // Git Providers
    getProviders: async () => {
        return apiCall('/api/v1/git/providers');
    },
    createProvider: async (data) => {
        return apiCall('/api/v1/git/providers', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    },
    // Git Repositories
    getProviderRepositories: async (providerId) => {
        return apiCall(`/api/v1/git/providers/${providerId}/repositories`);
    },
    connectRepository: async (data) => {
        return apiCall('/api/v1/git/repositories/connect', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    },
    getConnectedRepositories: async (params) => {
        const searchParams = new URLSearchParams();
        if (params?.page)
            searchParams.append('page', params.page.toString());
        if (params?.limit)
            searchParams.append('limit', params.limit.toString());
        const queryString = searchParams.toString();
        return apiCall(`/api/v1/git/repositories${queryString ? '?' + queryString : ''}`);
    },
    // Webhooks
    createWebhook: async (data) => {
        return apiCall('/api/v1/git/webhooks', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    },
    // Branches
    getRepositoryBranches: async (repoId) => {
        return apiCall(`/api/v1/git/repositories/${repoId}/branches`);
    },
};
// Analytics API (Umami Integration)
export const analyticsApi = {
    // Overview Metrics
    getOverview: async (timeRange, projectId) => {
        const params = new URLSearchParams();
        params.append('timeRange', timeRange);
        if (projectId)
            params.append('projectId', projectId);
        return apiCall(`/api/v1/analytics/overview?${params}`);
    },
    // Visitor Analytics
    getVisitorAnalytics: async (timeRange, projectId) => {
        const params = new URLSearchParams();
        params.append('timeRange', timeRange);
        if (projectId)
            params.append('projectId', projectId);
        return apiCall(`/api/v1/analytics/visitors?${params}`);
    },
    // Traffic Sources
    getTrafficAnalytics: async (timeRange, projectId) => {
        const params = new URLSearchParams();
        params.append('timeRange', timeRange);
        if (projectId)
            params.append('projectId', projectId);
        return apiCall(`/api/v1/analytics/traffic?${params}`);
    },
    // Content Analytics
    getContentAnalytics: async (timeRange, projectId) => {
        const params = new URLSearchParams();
        params.append('timeRange', timeRange);
        if (projectId)
            params.append('projectId', projectId);
        return apiCall(`/api/v1/analytics/content?${params}`);
    },
    // Real-time Analytics
    getRealTimeAnalytics: async (projectId) => {
        const params = new URLSearchParams();
        if (projectId)
            params.append('projectId', projectId);
        return apiCall(`/api/v1/analytics/realtime?${params}`);
    },
    // Custom Events
    trackEvent: async (data) => {
        return apiCall('/api/v1/analytics/events', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    },
    // Reports
    generateReport: async (data) => {
        return apiCall('/api/v1/analytics/reports', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    },
    // Settings
    getSettings: async (projectId) => {
        const params = new URLSearchParams();
        if (projectId)
            params.append('projectId', projectId);
        return apiCall(`/api/v1/analytics/settings?${params}`);
    },
    updateSettings: async (data) => {
        return apiCall('/api/v1/analytics/settings', {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    },
};
// Templates API
const templatesApi = {
    getTemplates: async (category) => {
        const params = new URLSearchParams();
        if (category)
            params.append('category', category);
        return apiCall(`/api/v1/templates?${params}`);
    },
    getTemplate: async (id) => {
        return apiCall(`/api/v1/templates/${id}`);
    },
    deployFromTemplate: async (templateId, data) => {
        return apiCall(`/api/v1/templates/${templateId}/deploy`, {
            method: 'POST',
            body: JSON.stringify(data),
        });
    },
};
// Cron Jobs API
const cronApi = {
    getCronJobs: async (projectId) => {
        const params = new URLSearchParams();
        if (projectId)
            params.append('project_id', projectId);
        return apiCall(`/api/v1/cron-jobs?${params}`);
    },
    createCronJob: async (data) => {
        return apiCall('/api/v1/cron-jobs', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    },
    getCronJob: async (id) => {
        return apiCall(`/api/v1/cron-jobs/${id}`);
    },
    updateCronJob: async (id, data) => {
        return apiCall(`/api/v1/cron-jobs/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    },
    deleteCronJob: async (id) => {
        return apiCall(`/api/v1/cron-jobs/${id}`, {
            method: 'DELETE',
        });
    },
    getExecutions: async (id) => {
        return apiCall(`/api/v1/cron-jobs/${id}/executions`);
    },
    triggerCronJob: async (id) => {
        return apiCall(`/api/v1/cron-jobs/${id}/trigger`, {
            method: 'POST',
        });
    },
};
// Audit Logs API
const auditApi = {
    getAuditLogs: async (params) => {
        const searchParams = new URLSearchParams();
        if (params?.resource)
            searchParams.append('resource', params.resource);
        if (params?.action)
            searchParams.append('action', params.action);
        if (params?.page)
            searchParams.append('page', params.page.toString());
        if (params?.limit)
            searchParams.append('limit', params.limit.toString());
        return apiCall(`/api/v1/audit-logs?${searchParams}`);
    },
    getResourceAuditLogs: async (resource, id) => {
        return apiCall(`/api/v1/audit-logs/${resource}/${id}`);
    },
};
