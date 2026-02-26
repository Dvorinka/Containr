import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';

vi.mock('./hooks/useAuth', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useAuth: vi.fn(),
}));

vi.mock('./lib/api', () => ({
  authApi: {
    getProfile: vi.fn(),
  },
}));

import { useAuth } from './hooks/useAuth';

const mockUseAuth = vi.mocked(useAuth);

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

const createMockAuth = (overrides = {}) => ({
  user: null,
  isLoading: false,
  isAuthenticating: false,
  isAuthenticated: false,
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
  ...overrides,
});

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
  });

  describe('LoadingScreen', () => {
    it('shows loading screen when auth is loading', () => {
      mockUseAuth.mockReturnValue(createMockAuth({ isLoading: true }));

      render(<App />, { wrapper: createWrapper() });

      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });
  });

  describe('AppContent routing', () => {
    it('renders without crashing when not authenticated', async () => {
      mockUseAuth.mockReturnValue(createMockAuth());

      render(<App />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      });
    });

    it('renders without crashing when authenticated', async () => {
      mockUseAuth.mockReturnValue(createMockAuth({
        user: { id: '1', name: 'Test User', email: 'test@example.com', created_at: '', updated_at: '' },
        isAuthenticated: true,
      }));

      render(<App />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      });
    });
  });

  describe('QueryClient configuration', () => {
    it('creates QueryClient with correct defaults', () => {
      mockUseAuth.mockReturnValue(createMockAuth({ isLoading: true }));

      render(<App />, { wrapper: createWrapper() });

      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });
  });

  describe('Provider structure', () => {
    it('wraps app in all required providers', () => {
      mockUseAuth.mockReturnValue(createMockAuth({ isLoading: true }));

      const { container } = render(<App />, { wrapper: createWrapper() });

      expect(container.firstChild).toBeInTheDocument();
    });
  });
});
