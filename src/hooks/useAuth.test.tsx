import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './useAuth';
import type { ReactNode } from 'react';

vi.mock('@/lib/api', () => ({
  authApi: {
    getProfile: vi.fn(),
    login: vi.fn(),
    register: vi.fn(),
  },
}));

import { authApi } from '@/lib/api';

const mockAuthApi = vi.mocked(authApi);

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();

Object.defineProperty(global, 'localStorage', { value: localStorageMock });

function TestComponent() {
  const { user, isLoading, isAuthenticated, login, logout } = useAuth();
  
  return (
    <div>
      <span data-testid="loading">{isLoading.toString()}</span>
      <span data-testid="authenticated">{isAuthenticated.toString()}</span>
      <span data-testid="user">{user ? JSON.stringify(user) : 'null'}</span>
      <button onClick={() => login('test@example.com', 'password')}>Login</button>
      <button onClick={logout}>Logout</button>
    </div>
  );
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  );
}

describe('useAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('AuthProvider', () => {
    it('provides unauthenticated state when no token exists', async () => {
      mockAuthApi.getProfile.mockResolvedValue({} as any);
      
      render(<TestComponent />, { wrapper: createWrapper() });
      
      await waitFor(() => {
        expect(screen.getByTestId('authenticated').textContent).toBe('false');
      });
    });

    it('provides authenticated state when user is loaded', async () => {
      const mockUser = { id: '1', name: 'Test User', email: 'test@example.com', created_at: '', updated_at: '' };
      localStorageMock.setItem('auth_token', 'test-token');
      mockAuthApi.getProfile.mockResolvedValue(mockUser as any);
      
      render(<TestComponent />, { wrapper: createWrapper() });
      
      await waitFor(() => {
        expect(screen.getByTestId('authenticated').textContent).toBe('true');
        expect(screen.getByTestId('user').textContent).toContain('Test User');
      });
    });

    it('supports demo mode', async () => {
      localStorageMock.setItem('demoMode', 'true');
      mockAuthApi.getProfile.mockResolvedValue({} as any);
      
      render(<TestComponent />, { wrapper: createWrapper() });
      
      await waitFor(() => {
        expect(screen.getByTestId('authenticated').textContent).toBe('true');
        expect(screen.getByTestId('user').textContent).toContain('Demo User');
      });
    });
  });

  describe('useAuth hook', () => {
    it('throws error when used outside AuthProvider', () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      expect(() => {
        render(<TestComponent />);
      }).toThrow('useAuth must be used within an AuthProvider');
      
      consoleError.mockRestore();
    });
  });
});
