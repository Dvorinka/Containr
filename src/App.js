import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { Toaster } from './components/ui/toaster';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Projects from './pages/Projects';
import ProjectDetail from './pages/ProjectDetail';
import Analytics from './pages/Analytics';
import GitIntegration from './pages/GitIntegration';
import Infrastructure from './pages/Infrastructure';
import NodeAgents from './pages/NodeAgents';
import DatabaseServices from './pages/DatabaseServices';
import Settings from './pages/Settings';
import Login from './pages/Login';
const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 1000 * 60 * 5,
            gcTime: 1000 * 60 * 30,
            retry: 1,
            refetchOnWindowFocus: false,
        },
    },
});
function LoadingScreen() {
    return (_jsxs("div", { className: "min-h-screen flex flex-col items-center justify-center bg-background", children: [_jsxs("div", { className: "relative", children: [_jsx("div", { className: "w-12 h-12 border-2 border-primary border-t-transparent rounded-full animate-spin" }), _jsx("div", { className: "absolute inset-0 w-12 h-12 border-2 border-primary/20 rounded-full" })] }), _jsx("p", { className: "mt-4 text-sm text-muted-foreground animate-pulse", children: "Loading..." })] }));
}
function AppContent() {
    const { isAuthenticated, isLoading } = useAuth();
    if (isLoading) {
        return _jsx(LoadingScreen, {});
    }
    return (_jsxs(Routes, { children: [_jsx(Route, { path: "/login", element: !isAuthenticated ? _jsx(Login, {}) : _jsx(Navigate, { to: "/" }) }), _jsxs(Route, { path: "/", element: isAuthenticated ? _jsx(Layout, {}) : _jsx(Navigate, { to: "/login" }), children: [_jsx(Route, { index: true, element: _jsx(Dashboard, {}) }), _jsx(Route, { path: "projects", element: _jsx(Projects, {}) }), _jsx(Route, { path: "projects/:projectId", element: _jsx(ProjectDetail, {}) }), _jsx(Route, { path: "analytics", element: _jsx(Analytics, {}) }), _jsx(Route, { path: "git", element: _jsx(GitIntegration, {}) }), _jsx(Route, { path: "infrastructure", element: _jsx(Infrastructure, {}) }), _jsx(Route, { path: "agents", element: _jsx(NodeAgents, {}) }), _jsx(Route, { path: "databases", element: _jsx(DatabaseServices, {}) }), _jsx(Route, { path: "settings", element: _jsx(Settings, {}) })] })] }));
}
function App() {
    return (_jsx(QueryClientProvider, { client: queryClient, children: _jsx(ThemeProvider, { children: _jsx(AuthProvider, { children: _jsx(Toaster, { children: _jsx(Router, { children: _jsx(AppContent, {}) }) }) }) }) }));
}
export default App;
