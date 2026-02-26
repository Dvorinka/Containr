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
import Canvas from './pages/Canvas';
import Security from './pages/Security';
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
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background">
      <div className="relative">
        <div className="w-12 h-12 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <div className="absolute inset-0 w-12 h-12 border-2 border-primary/20 rounded-full" />
      </div>
      <p className="mt-4 text-sm text-muted-foreground animate-pulse">Loading...</p>
    </div>
  );
}

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <Routes>
      <Route path="/login" element={!isAuthenticated ? <Login /> : <Navigate to="/" />} />
      <Route path="/" element={isAuthenticated ? <Layout /> : <Navigate to="/login" />}>
        <Route index element={<Dashboard />} />
        <Route path="projects" element={<Projects />} />
        <Route path="projects/:projectId" element={<ProjectDetail />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="canvas" element={<Canvas />} />
        <Route path="git" element={<GitIntegration />} />
        <Route path="infrastructure" element={<Infrastructure />} />
        <Route path="agents" element={<NodeAgents />} />
        <Route path="databases" element={<DatabaseServices />} />
        <Route path="security" element={<Security />} />
        <Route path="settings" element={<Settings />} />
      </Route>
    </Routes>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <Toaster>
            <Router>
              <AppContent />
            </Router>
          </Toaster>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
