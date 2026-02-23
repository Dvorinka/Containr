import type { 
  DatabaseService, 
  DatabaseMetrics, 
  DatabaseBackupConfig, 
  DatabaseBackup, 
  DatabaseSettings,
  DatabaseCreateRequest,
  DatabaseUpdateRequest,
  DatabaseActionRequest,
  DatabaseRestoreRequest
} from '@/types';

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

const databasesApi = {
  // Get all databases
  getDatabases: async (): Promise<{ databases: DatabaseService[] }> => {
    return apiCall<{ databases: DatabaseService[] }>('/api/v1/databases');
  },

  // Get single database
  getDatabase: async (id: string): Promise<DatabaseService> => {
    return apiCall<DatabaseService>(`/api/v1/databases/${id}`);
  },

  // Create database
  createDatabase: async (data: DatabaseCreateRequest): Promise<DatabaseService> => {
    return apiCall<DatabaseService>('/api/v1/databases', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Update database
  updateDatabase: async (id: string, data: DatabaseUpdateRequest): Promise<DatabaseService> => {
    return apiCall<DatabaseService>(`/api/v1/databases/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // Delete database
  deleteDatabase: async (id: string): Promise<void> => {
    await apiCall<void>(`/api/v1/databases/${id}`, {
      method: 'DELETE',
    });
  },

  // Perform database action (start/stop/restart)
  performAction: async (id: string, action: DatabaseActionRequest): Promise<{ message: string; status: string }> => {
    return apiCall<{ message: string; status: string }>(`/api/v1/databases/${id}/action`, {
      method: 'POST',
      body: JSON.stringify(action),
    });
  },

  // Create backup
  createBackup: async (id: string): Promise<{ backup_id: string; message: string; status: string }> => {
    return apiCall<{ backup_id: string; message: string; status: string }>(`/api/v1/databases/${id}/backup`, {
      method: 'POST',
    });
  },

  // Restore from backup
  restoreBackup: async (id: string, data: DatabaseRestoreRequest): Promise<{ message: string; status: string }> => {
    return apiCall<{ message: string; status: string }>(`/api/v1/databases/${id}/restore`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};
