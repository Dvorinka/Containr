import { describe, it, expect, vi, beforeEach } from 'vitest';
import { api, authApi, projectsApi } from './api';

const mockFetch = vi.fn();
global.fetch = mockFetch;

const mockLocalStorage = {
  store: {} as Record<string, string>,
  getItem(key: string) {
    return this.store[key] || null;
  },
  setItem(key: string, value: string) {
    this.store[key] = value;
  },
  removeItem(key: string) {
    delete this.store[key];
  },
  clear() {
    this.store = {};
  },
};

Object.defineProperty(global, 'localStorage', {
  value: mockLocalStorage,
});

describe('api', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockLocalStorage.clear();
  });

  describe('api.get', () => {
    it('makes GET request with correct headers', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: 'test' }),
      });

      const result = await api.get('/test');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/test'),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );
      expect(result).toEqual({ data: 'test' });
    });

    it('includes auth token when present', async () => {
      mockLocalStorage.setItem('auth_token', 'test-token');
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: 'test' }),
      });

      await api.get('/test');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token',
          }),
        })
      );
    });

    it('throws error on non-ok response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ error: 'Not found' }),
      });

      await expect(api.get('/test')).rejects.toThrow('Not found');
    });

    it('handles JSON parse errors gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.reject(new Error('Invalid JSON')),
      });

      await expect(api.get('/test')).rejects.toThrow('Unknown error');
    });
  });

  describe('api.post', () => {
    it('makes POST request with body', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      await api.post('/test', { name: 'test' });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ name: 'test' }),
        })
      );
    });
  });

  describe('api.put', () => {
    it('makes PUT request with body', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      await api.put('/test', { name: 'updated' });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ name: 'updated' }),
        })
      );
    });
  });

  describe('api.delete', () => {
    it('makes DELETE request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      await api.delete('/test/123');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'DELETE',
        })
      );
    });
  });
});

describe('authApi', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockLocalStorage.clear();
  });

  describe('login', () => {
    it('calls login endpoint with credentials', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ token: 'jwt-token', user: { id: 1 } }),
      });

      const result = await authApi.login('test@example.com', 'password');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/auth/login'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ email: 'test@example.com', password: 'password' }),
        })
      );
      expect(result).toEqual({ token: 'jwt-token', user: { id: 1 } });
    });
  });

  describe('register', () => {
    it('calls register endpoint with user data', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ token: 'jwt-token', user: { id: 1 } }),
      });

      await authApi.register('test@example.com', 'password', 'Test User');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/auth/register'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ email: 'test@example.com', password: 'password', name: 'Test User' }),
        })
      );
    });
  });
});

describe('projectsApi', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockLocalStorage.clear();
  });

  describe('getProjects', () => {
    it('fetches projects without params', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ projects: [], pagination: {} }),
      });

      await projectsApi.getProjects();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/projects'),
        expect.any(Object)
      );
    });

    it('includes query params when provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ projects: [], pagination: {} }),
      });

      await projectsApi.getProjects({ page: 2, limit: 10, search: 'test' });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('page=2'),
        expect.any(Object)
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('limit=10'),
        expect.any(Object)
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('search=test'),
        expect.any(Object)
      );
    });
  });

  describe('createProject', () => {
    it('creates project with POST request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ project: { id: '1', name: 'New Project' } }),
      });

      await projectsApi.createProject({ name: 'New Project', description: 'Test' });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/projects'),
        expect.objectContaining({
          method: 'POST',
        })
      );
    });
  });

  describe('deleteProject', () => {
    it('deletes project with DELETE request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ message: 'Deleted' }),
      });

      await projectsApi.deleteProject('project-123');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/projects/project-123'),
        expect.objectContaining({
          method: 'DELETE',
        })
      );
    });
  });
});
