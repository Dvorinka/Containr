import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { Toaster } from './components/ui/toaster';
import { IconLoader } from '@tabler/icons-react';
import Layout from './components/Layout';
import Projects from './pages/Projects';
import ProjectDetail from './pages/ProjectDetail';
import Analytics from './pages/Analytics';
import Canvas from './pages/Canvas';
import GitIntegration from './pages/GitIntegration';
import Infrastructure from './pages/Infrastructure';
import NodeAgents from './pages/NodeAgents';
import DatabaseServices from './pages/DatabaseServices';
import Security from './pages/Security';
import Settings from './pages/Settings';
import Login from './pages/Login';
import APwhyDashboard from './components/apwhy/APwhyDashboard';
import Templates from './pages/Templates';
import Usage from './pages/Usage';
import People from './pages/People';
import Docs from './pages/Docs';

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
      <div className="text-center space-y-4">
        <IconLoader className="w-12 h-12 text-primary animate-spin mx-auto" />
        <p className="text-muted-foreground">Loading...</p>
      </div>
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
        <Route index element={<Navigate to="/projects" replace />} />
        <Route path="projects" element={<Projects />} />
        <Route path="projects/:projectId" element={<ProjectDetail />} />
        <Route path="templates" element={<Templates />} />
        <Route path="usage" element={<Usage />} />
        <Route path="people" element={<People />} />
        <Route path="docs" element={<Docs />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="canvas" element={<Canvas />} />
        <Route path="git" element={<GitIntegration />} />
        <Route path="infrastructure" element={<Infrastructure />} />
        <Route path="agents" element={<NodeAgents />} />
        <Route path="databases" element={<DatabaseServices />} />
        <Route path="security" element={<Security />} />
        <Route path="settings" element={<Settings />} />
        <Route path="apwhy" element={<APwhyDashboard />} />
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
