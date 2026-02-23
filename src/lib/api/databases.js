const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';
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
const databasesApi = {
    // Get all databases
    getDatabases: async () => {
        return apiCall('/api/v1/databases');
    },
    // Get single database
    getDatabase: async (id) => {
        return apiCall(`/api/v1/databases/${id}`);
    },
    // Create database
    createDatabase: async (data) => {
        return apiCall('/api/v1/databases', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    },
    // Update database
    updateDatabase: async (id, data) => {
        return apiCall(`/api/v1/databases/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    },
    // Delete database
    deleteDatabase: async (id) => {
        await apiCall(`/api/v1/databases/${id}`, {
            method: 'DELETE',
        });
    },
    // Perform database action (start/stop/restart)
    performAction: async (id, action) => {
        return apiCall(`/api/v1/databases/${id}/action`, {
            method: 'POST',
            body: JSON.stringify(action),
        });
    },
    // Create backup
    createBackup: async (id) => {
        return apiCall(`/api/v1/databases/${id}/backup`, {
            method: 'POST',
        });
    },
    // Restore from backup
    restoreBackup: async (id, data) => {
        return apiCall(`/api/v1/databases/${id}/restore`, {
            method: 'POST',
            body: JSON.stringify(data),
        });
    },
};
export {};
