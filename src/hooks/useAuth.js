import { jsx as _jsx } from "react/jsx-runtime";
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authApi } from '@/lib/api';
import { createContext, useContext, useEffect } from 'react';
const AuthContext = createContext(undefined);
export function AuthProvider({ children }) {
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
        mutationFn: ({ email, password }) => authApi.login(email, password),
        onSuccess: (data) => {
            localStorage.setItem('auth_token', data.token);
            queryClient.setQueryData(['auth', 'profile'], data.user);
        },
    });
    const registerMutation = useMutation({
        mutationFn: ({ email, password, name }) => authApi.register(email, password, name),
        onSuccess: (data) => {
            localStorage.setItem('auth_token', data.token);
            queryClient.setQueryData(['auth', 'profile'], data.user);
        },
    });
    const login = async (email, password) => {
        await loginMutation.mutateAsync({ email, password });
    };
    const register = async (email, password, name) => {
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
    const value = {
        user: isDemoMode ? demoUser : (user || null),
        isLoading: isDemoMode ? false : isLoading,
        isAuthenticated: isDemoMode || (!!user && !error),
        login,
        register,
        logout,
    };
    return _jsx(AuthContext.Provider, { value: value, children: children });
}
export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
