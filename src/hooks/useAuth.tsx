import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authApi } from '@/lib/api';
import { createContext, useCallback, useContext, useEffect, type ReactNode } from 'react';
import type { User } from '@/types';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticating: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  // Check if user is authenticated on mount
  const { data: user, isLoading, error } = useQuery({
    queryKey: ['auth', 'profile'],
    queryFn: authApi.getProfile,
    retry: false,
    enabled: !!localStorage.getItem('auth_token') && !localStorage.getItem('demoMode'),
  });

  // Demo mode check
  const isDemoMode = !!localStorage.getItem('demoMode');
  const demoUser: User | null = isDemoMode
    ? {
        id: 'demo',
        name: 'Demo User',
        email: 'demo@example.com',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
    : null;

  const loginMutation = useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      authApi.login(email, password),
    onSuccess: (data) => {
      localStorage.setItem('auth_token', data.token);
      queryClient.setQueryData(['auth', 'profile'], data.user);
    },
  });

  const registerMutation = useMutation({
    mutationFn: ({ email, password, name }: { email: string; password: string; name: string }) =>
      authApi.register(email, password, name),
    onSuccess: (data) => {
      localStorage.setItem('auth_token', data.token);
      queryClient.setQueryData(['auth', 'profile'], data.user);
    },
  });

  const login = async (email: string, password: string) => {
    await loginMutation.mutateAsync({ email, password });
  };

  const register = async (email: string, password: string, name: string) => {
    await registerMutation.mutateAsync({ email, password, name });
  };

  const logout = useCallback(() => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('demoMode');
    queryClient.setQueryData(['auth', 'profile'], null);
    queryClient.clear();
  }, [queryClient]);

  // Auto-logout if token is invalid
  useEffect(() => {
    if (error && !isLoading) {
      logout();
    }
  }, [error, isLoading, logout]);

  const value: AuthContextType = {
    user: isDemoMode ? demoUser : (user || null),
    isLoading: isDemoMode ? false : isLoading,
    isAuthenticating: loginMutation.isPending || registerMutation.isPending,
    isAuthenticated: isDemoMode || (!!user && !error),
    login,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
