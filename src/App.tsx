import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider, useAuth } from './hooks/useAuth';
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

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={!isAuthenticated ? <Login /> : <Navigate to="/" />} />
      <Route path="/" element={isAuthenticated ? <Layout /> : <Navigate to="/login" />}>
        <Route index element={<Dashboard />} />
        <Route path="projects" element={<Projects />} />
        <Route path="projects/:projectId" element={<ProjectDetail />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="git" element={<GitIntegration />} />
        <Route path="infrastructure" element={<Infrastructure />} />
        <Route path="agents" element={<NodeAgents />} />
        <Route path="databases" element={<DatabaseServices />} />
        <Route path="settings" element={<Settings />} />
        {/* Add more routes here as we create them */}
      </Route>
    </Routes>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <AppContent />
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
