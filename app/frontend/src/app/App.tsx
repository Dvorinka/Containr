import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { PlatformShell } from './layout/PlatformShell';
import { ProjectsPage } from '@/features/projects/pages/ProjectsPage';
import { ProjectWorkspacePage } from '@/features/workspace/pages/ProjectWorkspacePage';
import { ServiceDetailPage } from '@/features/service/pages/ServiceDetailPage';
import { ServiceMetricsDashboard } from '@/features/service/pages/ServiceMetricsDashboard';
import { BuildsPage } from '@/features/builds/pages/BuildsPage';
import { TemplatesPage } from '@/features/templates/pages/TemplatesPage';
import {
  DocsPage,
  PeoplePage,
  SettingsPage,
  UsagePage,
  ComponentShowcase,
} from '@/features/secondary/pages';
import { SignInPage, SignUpPage } from '@/features/auth/pages';
import { useAuthSession } from '@/lib/use-auth-session';
import { ErrorBoundary, LoadingState } from '@/shared/components';

function AuthRequired() {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const isDemoMode = searchParams.get('demo') === '1';
  const sessionQuery = useAuthSession({ enabled: !isDemoMode });

  if (isDemoMode) {
    return <Outlet />;
  }

  if (sessionQuery.isPending) {
    return (
      <div className="min-h-screen bg-[var(--bg-void)]">
        <LoadingState message="Checking session..." className="h-screen" />
      </div>
    );
  }

  if (!sessionQuery.data) {
    const redirect = `${location.pathname}${location.search}`;
    return <Navigate to={`/auth/sign-in?redirect=${encodeURIComponent(redirect)}`} replace />;
  }

  return <Outlet />;
}

export default function App() {
  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/" element={<Navigate to="/projects" replace />} />
        <Route path="/auth/sign-in" element={<SignInPage />} />
        <Route path="/auth/sign-up" element={<SignUpPage />} />

        <Route element={<AuthRequired />}>
          <Route element={<PlatformShell />}>
            <Route path="/projects" element={<ProjectsPage />} />
            <Route path="/projects/:projectId" element={<ProjectWorkspacePage />} />
            <Route path="/projects/:projectId/services/:serviceId" element={<ServiceDetailPage />} />
            <Route path="/builds" element={<BuildsPage />} />

            <Route path="/templates" element={<TemplatesPage />} />
            <Route path="/usage" element={<UsagePage />} />
            <Route path="/people" element={<PeoplePage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/docs" element={<DocsPage />} />
            
            {/* Enhanced Dashboard & Showcase */}
            <Route path="/metrics-demo" element={<ServiceMetricsDashboard />} />
            <Route path="/showcase" element={<ComponentShowcase />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/projects" replace />} />
      </Routes>
    </ErrorBoundary>
  );
}
