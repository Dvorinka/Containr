import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  getApiBaseUrl,
  getCurrentUserProfile,
  listAuditLogs,
  listBuilds,
  listProjects,
  listTemplates,
  updateCurrentUserProfile,
} from '@/lib/api-client';
import { getAuthBaseUrl, signOutAuthSession } from '@/lib/auth-client';
import { useBuildUpdates } from '@/lib/use-build-updates';
import {
  Clock,
  Activity,
  Gauge,
  Users,
  Shield,
  FileText,
  Settings,
  User,
  Key,
  Database,
  RefreshCw,
  Trash2,
  LogOut,
  Check,
  AlertCircle,
  Loader2,
  BookOpen,
  Folder,
  Box,
  Terminal,
  Radio,
} from 'lucide-react';

function SecondaryPageHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="border-b border-[var(--border-subtle)] bg-[var(--bg-base)]/50 backdrop-blur-sm">
      <div className="mx-auto w-full max-w-[1400px] px-6 py-4">
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">{title}</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">{description}</p>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  description,
  icon: Icon,
  color = 'default',
}: {
  title: string;
  value: string;
  description: string;
  icon: typeof Clock;
  color?: 'default' | 'success' | 'warning' | 'error';
}) {
  const colorClasses = {
    default: 'text-[var(--text-primary)]',
    success: 'text-[var(--success)]',
    warning: 'text-[var(--warning)]',
    error: 'text-[var(--error)]',
  };

  return (
    <div className="panel p-5">
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-[var(--radius-md)] bg-[var(--surface-muted)] flex items-center justify-center">
          <Icon size={18} className="text-[var(--text-tertiary)]" />
        </div>
      </div>
      <p className={`text-2xl font-semibold ${colorClasses[color]}`}>{value}</p>
      <p className="text-xs font-medium text-[var(--text-muted)] mt-1">{title}</p>
      <p className="text-xs text-[var(--text-tertiary)] mt-2">{description}</p>
    </div>
  );
}

type LocalStorageSummary = {
  canvasKeys: string[];
  totalKeys: number;
};

function getLocalStorageSummary(): LocalStorageSummary {
  if (typeof window === 'undefined') {
    return { canvasKeys: [], totalKeys: 0 };
  }

  const canvasKeys: string[] = [];
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (key && key.startsWith('containr.canvas.v1.')) {
      canvasKeys.push(key);
    }
  }

  canvasKeys.sort((left, right) => left.localeCompare(right));

  return {
    canvasKeys,
    totalKeys: localStorage.length,
  };
}

function endpointStateBadge(isLoading: boolean, isError: boolean): {
  label: string;
  toneClass: string;
} {
  if (isLoading) {
    return { label: 'Loading', toneClass: 'text-[var(--warn)]' };
  }
  if (isError) {
    return { label: 'Unavailable', toneClass: 'text-[var(--bad)]' };
  }
  return { label: 'Available', toneClass: 'text-[var(--ok)]' };
}

export function UsagePage() {
  const queryClient = useQueryClient();
  const buildsQuery = useQuery({
    queryKey: ['usage-builds'],
    queryFn: () => listBuilds({ page: 1, limit: 100 }),
  });

  const builds = buildsQuery.data?.builds ?? [];
  const liveConnected = useBuildUpdates(
    builds.map((build) => build.id),
    () => {
      queryClient.invalidateQueries({ queryKey: ['usage-builds'] });
    },
  );

  const successfulBuilds = builds.filter((build) => build.status === 'success').length;
  const failedBuilds = builds.filter((build) => build.status === 'failed').length;
  const runningBuilds = builds.filter((build) => build.status === 'running').length;
  const pendingBuilds = builds.filter((build) => build.status === 'pending').length;
  const completedDurationsMs = builds
    .filter((build) => Boolean(build.startedAt && build.completedAt))
    .map((build) => {
      const started = new Date(build.startedAt as string).getTime();
      const completed = new Date(build.completedAt as string).getTime();
      return Math.max(0, completed - started);
    })
    .filter((duration) => Number.isFinite(duration) && duration > 0);

  const totalBuildDurationMs = completedDurationsMs.reduce((sum, duration) => sum + duration, 0);
  const averageBuildDurationMs =
    completedDurationsMs.length > 0 ? totalBuildDurationMs / completedDurationsMs.length : 0;

  const totalBuildHours = totalBuildDurationMs / 3_600_000;
  const avgBuildMinutes = averageBuildDurationMs / 60_000;
  const activeBuildPressure = runningBuilds + pendingBuilds;
  const uniqueServices = new Set(builds.map((build) => build.serviceId).filter(Boolean)).size;

  let buildActivityBody = 'Track deployment frequency and failed rollouts over time.';
  let runtimeBody = 'Build duration telemetry will appear after completed builds are available.';
  let capacityBody = 'No active build pressure detected.';

  if (buildsQuery.isLoading) {
    buildActivityBody = 'Loading recent build activity from Containr API.';
    runtimeBody = 'Loading build runtime metrics from Containr API.';
    capacityBody = 'Loading active queue depth and service fan-out.';
  } else if (buildsQuery.isError) {
    buildActivityBody = 'Unable to fetch build telemetry right now. Check API connectivity and auth.';
    runtimeBody = 'Unable to calculate runtime metrics while build telemetry is unavailable.';
    capacityBody = 'Unable to evaluate queue pressure while build telemetry is unavailable.';
  } else if (builds.length > 0) {
    buildActivityBody = `${builds.length} recent builds, ${successfulBuilds} successful, ${failedBuilds} failed${runningBuilds > 0 ? `, ${runningBuilds} running` : ''}.`;

    if (completedDurationsMs.length > 0) {
      runtimeBody = `${totalBuildHours.toFixed(1)}h total build runtime across ${completedDurationsMs.length} completed builds (avg ${avgBuildMinutes.toFixed(1)}m).`;
    } else {
      runtimeBody = 'Builds exist, but completed duration samples are not available yet.';
    }

    if (activeBuildPressure > 0) {
      capacityBody = `${activeBuildPressure} active jobs in queue (${runningBuilds} running, ${pendingBuilds} pending) across ${uniqueServices} service${uniqueServices === 1 ? '' : 's'}.`;
    } else {
      capacityBody = `No pending or running jobs. Last sampled ${builds.length} builds touched ${uniqueServices} service${uniqueServices === 1 ? '' : 's'}.`;
    }
  } else {
    buildActivityBody = 'No builds recorded yet. Trigger a service deployment to populate this view.';
    runtimeBody = 'No completed builds yet, so runtime totals are not available.';
    capacityBody = 'Queue depth is empty because no build history is available yet.';
  }

  return (
    <div className="min-h-screen">
      <SecondaryPageHeader
        title="Usage"
        description="Platform usage metrics and operational summaries"
      />
      <div className="mx-auto w-full max-w-[1400px] px-6 py-6">
        <div className="flex items-center gap-2 mb-6">
          <div className={`w-2 h-2 rounded-full ${liveConnected ? 'bg-[var(--success)] animate-pulse' : 'bg-[var(--text-muted)]'}`} />
          <span className={`text-sm ${liveConnected ? 'text-[var(--success)]' : 'text-[var(--text-muted)]'}`}>
            {liveConnected ? 'Live sync active' : 'Offline'}
          </span>
        </div>

        {buildsQuery.isLoading ? (
          <div className="py-16 text-center">
            <Loader2 size={24} className="animate-spin mx-auto text-[var(--text-tertiary)]" />
            <p className="mt-3 text-sm text-[var(--text-muted)]">Loading usage data...</p>
          </div>
        ) : buildsQuery.isError ? (
          <div className="panel p-8 text-center">
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-[var(--error-soft)] flex items-center justify-center">
              <AlertCircle size={24} className="text-[var(--error)]" />
            </div>
            <p className="text-sm text-[var(--error)]">Failed to load usage data</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatCard
              title="Runtime Hours"
              value={totalBuildHours > 0 ? `${totalBuildHours.toFixed(1)}h` : '—'}
              description={runtimeBody}
              icon={Clock}
              color={completedDurationsMs.length > 0 ? 'success' : 'default'}
            />
            <StatCard
              title="Build Activity"
              value={String(builds.length)}
              description={buildActivityBody}
              icon={Activity}
              color={failedBuilds > 0 ? 'warning' : 'success'}
            />
            <StatCard
              title="Capacity"
              value={String(activeBuildPressure)}
              description={capacityBody}
              icon={Gauge}
              color={activeBuildPressure > 0 ? 'warning' : 'default'}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export function PeoplePage() {
  const profileQuery = useQuery({
    queryKey: ['user-profile'],
    queryFn: getCurrentUserProfile,
  });

  const projectsQuery = useQuery({
    queryKey: ['people-projects'],
    queryFn: listProjects,
  });
  const auditLogsQuery = useQuery({
    queryKey: ['people-audit-logs'],
    queryFn: () => listAuditLogs({ page: 1, limit: 20 }),
  });

  let membersBody = 'Owner-only mode currently. Multi-user collaboration is planned.';

  if (profileQuery.isLoading) {
    membersBody = 'Loading authenticated profile from Containr API.';
  } else if (profileQuery.isError) {
    membersBody = 'Unable to fetch current user profile. Verify API connectivity and Better Auth session.';
  } else if (profileQuery.data) {
    membersBody = `${profileQuery.data.name} (${profileQuery.data.email}) is currently authenticated as platform owner.`;
  }

  let rolesBody = 'Predefined roles will map to service and project permissions.';

  if (projectsQuery.isLoading) {
    rolesBody = 'Loading project access footprint for current user.';
  } else if (projectsQuery.isError) {
    rolesBody = 'Project visibility check failed. Role scope cannot be calculated right now.';
  } else {
    const projectCount = projectsQuery.data?.length ?? 0;
    rolesBody = `Current account can access ${projectCount} project${projectCount === 1 ? '' : 's'} in owner mode.`;
  }

  let auditBody = 'Human-readable action log for project and service changes.';

  if (auditLogsQuery.isLoading) {
    auditBody = 'Loading recent audit events from Containr API.';
  } else if (auditLogsQuery.isError) {
    auditBody = 'Unable to load recent audit events. Verify API connectivity and Better Auth session.';
  } else {
    const auditLogs = auditLogsQuery.data ?? [];
    if (auditLogs.length > 0) {
      const latest = auditLogs[0];
      auditBody = `${auditLogs.length} recent events. Latest action: ${latest.action} on ${latest.resource}${
        latest.resourceId ? ` (${latest.resourceId})` : ''
      }.`;
    } else {
      auditBody = 'No audit events recorded yet for this account.';
    }
  }

  return (
    <div className="min-h-screen">
      <SecondaryPageHeader
        title="People"
        description="Team management and access control"
      />
      <div className="mx-auto w-full max-w-[1400px] px-6 py-6">
        {profileQuery.isLoading ? (
          <div className="py-16 text-center">
            <Loader2 size={24} className="animate-spin mx-auto text-[var(--text-tertiary)]" />
            <p className="mt-3 text-sm text-[var(--text-muted)]">Loading team data...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatCard
              title="Members"
              value={profileQuery.data ? '1' : '—'}
              description={membersBody}
              icon={Users}
              color={profileQuery.data ? 'success' : 'default'}
            />
            <StatCard
              title="Roles"
              value={projectsQuery.data?.length ? String(projectsQuery.data.length) : '—'}
              description={rolesBody}
              icon={Shield}
              color="default"
            />
            <StatCard
              title="Audit Trail"
              value={auditLogsQuery.data ? String(auditLogsQuery.data.length) : '—'}
              description={auditBody}
              icon={FileText}
              color={auditLogsQuery.data?.length ? 'success' : 'default'}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export function SettingsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const profileQuery = useQuery({
    queryKey: ['settings-profile'],
    queryFn: getCurrentUserProfile,
  });

  const [nameDraft, setNameDraft] = useState<string | null>(null);
  const [avatarDraft, setAvatarDraft] = useState<string | null>(null);
  const [storageSummary, setStorageSummary] = useState<LocalStorageSummary>(() =>
    getLocalStorageSummary(),
  );

  const resolvedNameDraft = nameDraft ?? profileQuery.data?.name ?? '';
  const resolvedAvatarDraft = avatarDraft ?? profileQuery.data?.avatarUrl ?? '';

  const hasProfileChanges = useMemo(() => {
    if (!profileQuery.data) {
      return false;
    }

    return (
      resolvedNameDraft.trim() !== profileQuery.data.name ||
      resolvedAvatarDraft.trim() !== (profileQuery.data.avatarUrl ?? '')
    );
  }, [profileQuery.data, resolvedAvatarDraft, resolvedNameDraft]);

  const updateProfileMutation = useMutation({
    mutationFn: () =>
      updateCurrentUserProfile({
        name: resolvedNameDraft.trim(),
        avatarUrl: resolvedAvatarDraft.trim() || undefined,
      }),
    onSuccess: (profile) => {
      queryClient.setQueryData(['settings-profile'], profile);
      queryClient.setQueryData(['user-profile'], profile);
      setNameDraft(null);
      setAvatarDraft(null);
    },
  });

  const refreshStorage = () => {
    setStorageSummary(getLocalStorageSummary());
  };

  const clearCanvasCache = () => {
    for (const key of storageSummary.canvasKeys) {
      localStorage.removeItem(key);
    }
    refreshStorage();
  };

  const signOutLocalSession = async () => {
    try {
      await signOutAuthSession();
    } catch {
      // Continue with local cleanup even if remote sign-out call fails.
    }
    queryClient.removeQueries();
    await queryClient.invalidateQueries({ queryKey: ['auth-session'] });
    navigate('/auth/sign-in', { replace: true });
    refreshStorage();
  };

  return (
    <div className="min-h-screen">
      <SecondaryPageHeader
        title="Settings"
        description="Manage account profile and local configuration"
      />
      <div className="mx-auto w-full max-w-[1400px] px-6 py-6">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Profile Section */}
          <section className="panel p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-[var(--radius-md)] bg-[var(--accent-primary-soft)] flex items-center justify-center">
                <User size={18} className="text-[var(--accent-primary)]" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">Profile</h2>
                <p className="text-xs text-[var(--text-tertiary)]">Backed by GET/PUT /user/profile</p>
              </div>
            </div>

            {profileQuery.isLoading ? (
              <div className="py-8 text-center">
                <Loader2 size={20} className="animate-spin mx-auto text-[var(--text-tertiary)]" />
              </div>
            ) : profileQuery.isError ? (
              <div className="px-4 py-3 rounded-[var(--radius-md)] bg-[var(--error-soft)] text-sm text-[var(--error)]">
                Failed to load profile
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium uppercase tracking-wider text-[var(--text-muted)] mb-2">
                    Name
                  </label>
                  <input
                    value={resolvedNameDraft}
                    onChange={(e) => setNameDraft(e.target.value)}
                    className="w-full h-10 px-3 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] text-sm focus:border-[var(--accent-primary)] transition-colors"
                    placeholder="Your name"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium uppercase tracking-wider text-[var(--text-muted)] mb-2">
                    Avatar URL
                  </label>
                  <input
                    value={resolvedAvatarDraft}
                    onChange={(e) => setAvatarDraft(e.target.value)}
                    className="w-full h-10 px-3 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] text-sm focus:border-[var(--accent-primary)] transition-colors"
                    placeholder="https://example.com/avatar.png"
                  />
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    onClick={() => updateProfileMutation.mutate()}
                    disabled={!hasProfileChanges || updateProfileMutation.isPending}
                    className="flex items-center gap-2 h-9 px-4 rounded-[var(--radius-md)] text-white text-sm font-medium shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    style={{ background: '#e8316a' }}
                  >
                    {updateProfileMutation.isPending ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Check size={14} />
                        Save Profile
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => profileQuery.refetch()}
                    className="flex items-center gap-2 h-9 px-4 rounded-[var(--radius-md)] border border-[var(--border-subtle)] text-sm font-medium hover:border-[var(--border-default)] transition-colors"
                  >
                    <RefreshCw size={14} />
                    Refresh
                  </button>
                </div>

                {updateProfileMutation.isError && (
                  <div className="px-4 py-3 rounded-[var(--radius-md)] bg-[var(--error-soft)] text-sm text-[var(--error)]">
                    {updateProfileMutation.error instanceof Error ? updateProfileMutation.error.message : 'Failed to update profile'}
                  </div>
                )}
                {updateProfileMutation.isSuccess && (
                  <div className="px-4 py-3 rounded-[var(--radius-md)] bg-[var(--success-soft)] text-sm text-[var(--success)] flex items-center gap-2">
                    <Check size={16} />
                    Profile updated successfully
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Runtime & Local State Section */}
          <section className="panel p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-[var(--radius-md)] bg-[var(--surface-muted)] flex items-center justify-center">
                <Settings size={18} className="text-[var(--text-tertiary)]" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">Runtime & Local State</h2>
                <p className="text-xs text-[var(--text-tertiary)]">API endpoints, cookie-session mode, and storage diagnostics</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="p-4 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-muted)]">
                <div className="flex items-center gap-2 mb-1">
                  <Key size={14} className="text-[var(--text-tertiary)]" />
                  <span className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">API Base</span>
                </div>
                <p className="mono text-xs text-[var(--text-primary)] break-all">{getApiBaseUrl()}</p>
              </div>

              <div className="p-4 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-muted)]">
                <div className="flex items-center gap-2 mb-1">
                  <Key size={14} className="text-[var(--text-tertiary)]" />
                  <span className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">Auth Base</span>
                </div>
                <p className="mono text-xs text-[var(--text-primary)] break-all">{getAuthBaseUrl()}</p>
              </div>

              <div className="p-4 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-muted)]">
                <div className="flex items-center gap-2 mb-1">
                  <Shield size={14} className="text-[var(--text-tertiary)]" />
                  <span className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">Session Mode</span>
                </div>
                <p className="text-xs text-[var(--text-primary)]">HttpOnly Better Auth cookie (no local auth token)</p>
              </div>

              <div className="p-4 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-muted)]">
                <div className="flex items-center gap-2 mb-1">
                  <Database size={14} className="text-[var(--text-tertiary)]" />
                  <span className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">Canvas Cache</span>
                </div>
                <p className="text-xs text-[var(--text-primary)]">
                  {storageSummary.canvasKeys.length} cached canvas entries ({storageSummary.totalKeys} total keys)
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 mt-4">
              <button
                onClick={refreshStorage}
                className="flex items-center gap-2 h-9 px-4 rounded-[var(--radius-md)] border border-[var(--border-subtle)] text-sm font-medium hover:border-[var(--border-default)] transition-colors"
              >
                <RefreshCw size={14} />
                Refresh
              </button>
              <button
                onClick={clearCanvasCache}
                disabled={storageSummary.canvasKeys.length === 0}
                className="flex items-center gap-2 h-9 px-4 rounded-[var(--radius-md)] border border-[var(--warning-soft)] text-[var(--warning)] text-sm font-medium hover:bg-[var(--warning-soft)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Trash2 size={14} />
                Clear Cache
              </button>
              <button
                onClick={() => {
                  void signOutLocalSession();
                }}
                className="flex items-center gap-2 h-9 px-4 rounded-[var(--radius-md)] border border-[var(--error-soft)] text-[var(--error)] text-sm font-medium hover:bg-[var(--error-soft)] transition-colors"
              >
                <LogOut size={14} />
                Sign Out
              </button>
            </div>

            {storageSummary.canvasKeys.length > 0 && (
              <div className="mt-4 p-4 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-muted)]">
                <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)] mb-2">Cached Keys</p>
                <ul className="space-y-1">
                  {storageSummary.canvasKeys.slice(0, 5).map((key) => (
                    <li key={key} className="mono text-xs text-[var(--text-tertiary)] truncate">
                      {key}
                    </li>
                  ))}
                  {storageSummary.canvasKeys.length > 5 && (
                    <li className="text-xs text-[var(--text-muted)]">
                      +{storageSummary.canvasKeys.length - 5} more...
                    </li>
                  )}
                </ul>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

export function DocsPage() {
  const profileQuery = useQuery({
    queryKey: ['docs-profile'],
    queryFn: getCurrentUserProfile,
  });
  const projectsQuery = useQuery({
    queryKey: ['docs-projects'],
    queryFn: listProjects,
  });
  const templatesQuery = useQuery({
    queryKey: ['docs-templates'],
    queryFn: () => listTemplates(),
  });
  const buildsQuery = useQuery({
    queryKey: ['docs-builds'],
    queryFn: () => listBuilds({ page: 1, limit: 1 }),
  });

  const profileStatus = endpointStateBadge(profileQuery.isLoading, profileQuery.isError);
  const projectStatus = endpointStateBadge(projectsQuery.isLoading, projectsQuery.isError);
  const templateStatus = endpointStateBadge(templatesQuery.isLoading, templatesQuery.isError);
  const buildStatus = endpointStateBadge(buildsQuery.isLoading, buildsQuery.isError);

  return (
    <div className="min-h-screen">
      <SecondaryPageHeader
        title="Docs"
        description="Operational references and API documentation"
      />
      <div className="mx-auto w-full max-w-[1400px] px-6 py-6">
        {/* API Status Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="panel p-4">
            <div className="flex items-center gap-2 mb-2">
              <User size={14} className={profileStatus.toneClass} />
              <span className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">Profile</span>
            </div>
            <p className={`text-sm font-semibold ${profileStatus.toneClass}`}>{profileStatus.label}</p>
            <p className="text-xs text-[var(--text-tertiary)] mt-1">
              {profileQuery.data ? `${profileQuery.data.name} authenticated` : 'GET /user/profile'}
            </p>
          </div>
          <div className="panel p-4">
            <div className="flex items-center gap-2 mb-2">
              <Folder size={14} className={projectStatus.toneClass} />
              <span className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">Projects</span>
            </div>
            <p className={`text-sm font-semibold ${projectStatus.toneClass}`}>{projectStatus.label}</p>
            <p className="text-xs text-[var(--text-tertiary)] mt-1">
              {projectsQuery.data ? `${projectsQuery.data.length} projects` : 'GET /projects'}
            </p>
          </div>
          <div className="panel p-4">
            <div className="flex items-center gap-2 mb-2">
              <Box size={14} className={templateStatus.toneClass} />
              <span className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">Templates</span>
            </div>
            <p className={`text-sm font-semibold ${templateStatus.toneClass}`}>{templateStatus.label}</p>
            <p className="text-xs text-[var(--text-tertiary)] mt-1">
              {templatesQuery.data ? `${templatesQuery.data.length} templates` : 'GET /templates'}
            </p>
          </div>
          <div className="panel p-4">
            <div className="flex items-center gap-2 mb-2">
              <Activity size={14} className={buildStatus.toneClass} />
              <span className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">Builds</span>
            </div>
            <p className={`text-sm font-semibold ${buildStatus.toneClass}`}>{buildStatus.label}</p>
            <p className="text-xs text-[var(--text-tertiary)] mt-1">
              {buildsQuery.data ? `${buildsQuery.data.total} builds` : 'GET /builds'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Repository Paths */}
          <section className="panel p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-[var(--radius-md)] bg-[var(--accent-primary-soft)] flex items-center justify-center">
                <BookOpen size={18} className="text-[var(--accent-primary)]" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">Repository Paths</h2>
                <p className="text-xs text-[var(--text-tertiary)]">Source files and documentation</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="p-4 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-muted)]">
                <div className="flex items-center gap-2 mb-1">
                  <FileText size={14} className="text-[var(--text-tertiary)]" />
                  <span className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">API Contract</span>
                </div>
                <p className="mono text-xs text-[var(--text-primary)]">docs/api/openapi.yaml</p>
              </div>
              <div className="p-4 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-muted)]">
                <div className="flex items-center gap-2 mb-1">
                  <FileText size={14} className="text-[var(--text-tertiary)]" />
                  <span className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">Generated Types</span>
                </div>
                <p className="mono text-xs text-[var(--text-primary)]">frontend/src/generated/api-types.ts</p>
              </div>
              <div className="p-4 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-muted)]">
                <div className="flex items-center gap-2 mb-1">
                  <BookOpen size={14} className="text-[var(--text-tertiary)]" />
                  <span className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">Primary Guides</span>
                </div>
                <p className="mono text-xs text-[var(--text-primary)]">README.md • DOCKER_SETUP.md • docs/guides/</p>
              </div>
              <div className="p-4 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-muted)]">
                <div className="flex items-center gap-2 mb-1">
                  <FileText size={14} className="text-[var(--text-tertiary)]" />
                  <span className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">UI References</span>
                </div>
                <p className="mono text-xs text-[var(--text-primary)]">docs/references/self.html</p>
              </div>
            </div>
          </section>

          {/* Common Commands */}
          <section className="panel p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-[var(--radius-md)] bg-[var(--surface-muted)] flex items-center justify-center">
                <Terminal size={18} className="text-[var(--text-tertiary)]" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">Common Commands</h2>
                <p className="text-xs text-[var(--text-tertiary)]">Development and build scripts</p>
              </div>
            </div>

            <div className="p-4 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-void)]">
              <pre className="mono text-xs text-[var(--text-secondary)] whitespace-pre-wrap">
{`# Regenerate frontend API types
npm --prefix frontend run generate:api

# Frontend type-check + build
npm --prefix frontend run build:check

# Backend API tests
cd backend && go test ./internal/api/...`}
              </pre>
            </div>

            <div className="mt-4 p-4 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-muted)]">
              <div className="flex items-center gap-2 mb-1">
                <Radio size={14} className="text-[var(--text-tertiary)]" />
                <span className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">Active API Base</span>
              </div>
              <p className="mono text-xs text-[var(--text-primary)] break-all">{getApiBaseUrl()}</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}


export { ComponentShowcase } from './pages/ComponentShowcase';
