import { Link, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ShieldCheck } from 'lucide-react';
import { PlatformShell } from './layout/PlatformShell';
import { ProjectsPage } from '@/features/projects/pages/ProjectsPage';
import { ProjectWorkspacePage } from '@/features/workspace/pages/ProjectWorkspacePage';
import { ServiceDetailPage } from '@/features/service/pages/ServiceDetailPage';
import { ServiceMetricsDashboard } from '@/features/service/pages/ServiceMetricsDashboard';
import { BuildsPage } from '@/features/builds/pages/BuildsPage';
import { TemplatesPage } from '@/features/templates/pages/TemplatesPage';
import { AuditLogsPage } from '@/features/audit/pages/AuditLogsPage';
import { AdminPage } from '@/features/admin/pages/AdminPage';
import { LandingPage } from '@/features/landing/LandingPage';
import {
  DocsPage,
  PeoplePage,
  SettingsPage,
  UsagePage,
  DatabasesPage,
  HighAvailabilityPage,
  SecurityPage,
  ComponentShowcase,
} from '@/features/secondary/pages';
import { SignInPage, SignUpPage } from '@/features/auth/pages';
import { useAuthSession } from '@/lib/use-auth-session';
import { getCurrentUserProfile } from '@/lib/api-client';
import { ErrorBoundary, LoadingState } from '@/shared/components';

function useDemoMode() {
  const location = useLocation();
  return new URLSearchParams(location.search).get('demo') === '1';
}

function AuthRequired() {
  const location = useLocation();
  const isDemoMode = useDemoMode();
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

function AdminRequired() {
  const location = useLocation();
  const isDemoMode = useDemoMode();
  const sessionQuery = useAuthSession({ enabled: !isDemoMode });
  const profileQuery = useQuery({
    queryKey: ['current-profile'],
    queryFn: getCurrentUserProfile,
    enabled: !isDemoMode && Boolean(sessionQuery.data),
    retry: false,
  });

  if (isDemoMode) {
    return <Outlet />;
  }

  if (sessionQuery.isPending || (sessionQuery.data && profileQuery.isPending)) {
    return (
      <div className="min-h-screen bg-[var(--bg-void)]">
        <LoadingState message="Checking admin access..." className="h-screen" />
      </div>
    );
  }

  if (!sessionQuery.data) {
    const redirect = `${location.pathname}${location.search}`;
    return <Navigate to={`/auth/sign-in?redirect=${encodeURIComponent(redirect)}`} replace />;
  }

  if (!profileQuery.data?.isAdmin) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[var(--bg-void)] px-6 text-center">
        <ShieldCheck size={32} className="text-[var(--error)]" />
        <div>
          <h1 className="text-lg font-semibold text-[var(--text-primary)]">Admin access required</h1>
          <p className="mt-1 max-w-sm text-sm text-[var(--text-secondary)]">
            This area is restricted to the platform administrator.
          </p>
        </div>
        <Link
          to="/"
          className="rounded-[var(--radius-md)] border border-[var(--border-default)] px-4 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        >
          Back to home
        </Link>
      </div>
    );
  }

  return <Outlet />;
}

export default function App() {
  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/auth/sign-in" element={<SignInPage />} />
        <Route path="/auth/sign-up" element={<SignUpPage />} />

        {/* Public browsing — approved projects, templates, docs. */}
        <Route element={<PlatformShell />}>
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/projects/:projectId" element={<ProjectWorkspacePage />} />
          <Route path="/projects/:projectId/services/:serviceId" element={<ServiceDetailPage />} />
          <Route path="/templates" element={<TemplatesPage />} />
          <Route path="/databases" element={<DatabasesPage />} />
          <Route path="/ha" element={<HighAvailabilityPage />} />
          <Route path="/security" element={<SecurityPage />} />
          <Route path="/usage" element={<UsagePage />} />
          <Route path="/docs" element={<DocsPage />} />

          {/* Authenticated areas */}
          <Route element={<AuthRequired />}>
            <Route path="/builds" element={<BuildsPage />} />
            <Route path="/people" element={<PeoplePage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/settings/audit-logs" element={<AuditLogsPage />} />
            <Route path="/showcase" element={<ComponentShowcase />} />
          </Route>

          {/* Platform owner only */}
          <Route element={<AdminRequired />}>
            <Route path="/admin" element={<AdminPage />} />
          </Route>
        </Route>

        {/* Full-bleed design demo — renders its own chrome, no app shell */}
        <Route element={<AuthRequired />}>
          <Route path="/metrics-demo" element={<ServiceMetricsDashboard />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ErrorBoundary>
  );
}
