import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authApi } from '@/lib/api';
import { createContext, useContext, useEffect, type ReactNode } from 'react';

interface AuthContextType {
  user: any | null;
  isLoading: boolean;
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
  const demoUser = isDemoMode ? { id: 'demo', name: 'Demo User', email: 'demo@example.com' } : null;

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

  const logout = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('demoMode');
    queryClient.setQueryData(['auth', 'profile'], null);
    queryClient.clear();
  };

  // Auto-logout if token is invalid
  useEffect(() => {
    if (error && !isLoading) {
      logout();
    }
  }, [error, isLoading]);

  const value: AuthContextType = {
    user: isDemoMode ? demoUser : (user || null),
    isLoading: isDemoMode ? false : isLoading,
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
