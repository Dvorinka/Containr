import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  getApiBaseUrl,
  getAgentPublicBaseUrl,
  getHostMonitoring,
  createUser,
  createGitProvider,
  deleteGitProvider,
  getCurrentUserProfile,
  listAuditLogs,
  listAgents,
  listBuilds,
  listGitProviders,
  listProjects,
  createAgentToken,
  listAgentTokens,
  revokeAgentToken,
  createUserToken,
  listUserTokens,
  revokeUserToken,
  listRegistries,
  createRegistry,
  deleteRegistry,
  type Registry,
  listDatabases,
  databaseAction,
  updateDatabaseBackupSchedule,
  createDatabaseBackup,
  restoreDatabaseBackup,
  createManagedDatabase,
  registerExternalDatabase,
  importDatabaseBackup,
  updateDatabase,
  listBackupTargets,
  createBackupTarget,
  deleteBackupTarget,
  testBackupTarget,
  testDatabaseConnection,
  testDatabaseConnectionByID,
  type ExternalDatabaseInput,
  listServicesByProject,
  listServiceVariables,
  updateServiceVariables,
  getGitHubAppInstallUrl,
  connectGitHubApp,
  updateCurrentUserProfile,
  getPlatformSettings,
  updatePlatformSettings,
  type Branding,
  type BrandingInput,
  getHAStatus,
  setHAEnabled,
  triggerFailover,
  listFailoverPolicies,
  setFailoverPolicy,
  deleteFailoverPolicy,
  listActiveAlerts,
  resolveAlert,
  listHealthResults,
  startSecurityScan,
  getSecurityHistory,
  listVulnerabilities,
  updateVulnerability,
  getSecurityMetrics,
  type AgentAuthTokenCreated,
  type UserTokenCreated,
  type UserTokenScope,
  type CreateDatabaseInput,
  type DatabaseEntity,
  type FailoverPolicy,
} from '@/lib/api-client';
import {
  demoBuilds,
  demoDatabases,
  demoHAAlerts,
  demoHAHealthResults,
  demoHAPolicies,
  demoHAStatus,
  demoHostMonitoring,
  demoProjects,
  demoSecurityMetrics,
  demoSecurityScans,
  demoVulnerabilities,
  getDemoServicesByProject,
} from '@/lib/demo-data';
import { ServiceIcon } from '@/features/workspace/canvas/ServiceIcon';
import { serviceAccent } from '@/features/workspace/canvas/service-visuals';
import { DocsBrowser } from '@/features/docs/DocsBrowser';
import { useAuthSession } from '@/lib/use-auth-session';
import { useDemoMode } from '@/lib/demo-mode';
import { formatRelative } from '@/lib/time';
import { getAuthBaseUrl, signOutAuthSession } from '@/lib/auth-client';
import { useBuildUpdates } from '@/lib/use-build-updates';
import { EnhancedMetricCard, LineAreaChart, DonutChart, SegmentedBar, BarChart, DemoRestricted } from '@/shared/components';
import {
  Clock,
  Activity,
  Gauge,
  Users,
  Shield,
  FileText,
  Settings,
  User,
  UserPlus,
  Key,
  Database,
  RefreshCw,
  Trash2,
  LogOut,
  Check,
  AlertCircle,
  Loader2,
  Terminal,
  Radio,
  Server,
  HardDrive,
  GitBranch,
  Link2,
  Unlink,
  Cpu,
  MemoryStick,
  ScrollText,
  ChevronRight,
  ChevronDown,
  Copy,
  Play,
  Square,
  Archive,
  ShieldCheck,
  Zap,
  HeartPulse,
  Cloud,
  ExternalLink,
  Upload,
} from 'lucide-react';

function SecondaryPageHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="border-b border-[var(--border-subtle)]">
      <div className="w-full px-8 py-5">
        <h1 className="v-title">{title}<span className="v-cursor">_</span></h1>
        <p className="v-mono mt-1.5 text-[11px] text-[var(--text-tertiary)]">{description}</p>
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
  let storage: Storage | null = null;
  try {
    storage = typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    storage = null;
  }
  if (!storage) {
    return { canvasKeys: [], totalKeys: 0 };
  }

  const canvasKeys: string[] = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key && key.startsWith('containr.canvas.v1.')) {
      canvasKeys.push(key);
    }
  }

  canvasKeys.sort((left, right) => left.localeCompare(right));

  return {
    canvasKeys,
    totalKeys: storage.length,
  };
}

function formatBytes(value: number): string {
  if (!Number.isFinite(value) || value <= 0) {
    return '0 B';
  }
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = value;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(size >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function formatUptime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return '—';
  }
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  if (days > 0) {
    return `${days}d ${hours}h`;
  }
  return `${hours}h ${Math.floor((seconds % 3600) / 60)}m`;
}

export function UsagePage() {
  const queryClient = useQueryClient();
  const isDemoMode = useDemoMode();
  const sessionQuery = useAuthSession({ enabled: !isDemoMode });
  const profileQuery = useQuery({
    queryKey: ['user-profile'],
    queryFn: getCurrentUserProfile,
    enabled: !isDemoMode && Boolean(sessionQuery.data),
    retry: false,
  });
  const signedIn = isDemoMode || Boolean(sessionQuery.data);
  const isAdmin = !isDemoMode && Boolean(profileQuery.data?.isAdmin);
  const buildsQuery = useQuery({
    queryKey: ['usage-builds'],
    queryFn: () => listBuilds({ page: 1, limit: 100 }),
    enabled: signedIn && !isDemoMode,
    retry: false,
  });
  const hostQuery = useQuery({
    queryKey: ['usage-host-monitoring'],
    queryFn: getHostMonitoring,
    refetchInterval: 15_000,
    enabled: !isDemoMode,
  });
  const agentsQuery = useQuery({
    queryKey: ['usage-agents'],
    queryFn: listAgents,
    refetchInterval: 15_000,
    enabled: isAdmin,
    retry: false,
  });
  const agentTokensQuery = useQuery({
    queryKey: ['agent-tokens'],
    queryFn: listAgentTokens,
    enabled: isAdmin,
    retry: false,
  });
  const [tokenLabel, setTokenLabel] = useState('');
  const [issuedToken, setIssuedToken] = useState<AgentAuthTokenCreated | null>(null);
  const createTokenMutation = useMutation({
    mutationFn: () => createAgentToken(tokenLabel.trim()),
    onSuccess: (data) => {
      setIssuedToken(data);
      setTokenLabel('');
      queryClient.invalidateQueries({ queryKey: ['agent-tokens'] });
    },
  });
  const revokeTokenMutation = useMutation({
    mutationFn: (id: string) => revokeAgentToken(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['agent-tokens'] }),
  });

  const builds = useMemo(
    () => (isDemoMode ? demoBuilds : buildsQuery.data?.builds ?? []),
    [isDemoMode, buildsQuery.data],
  );
  const liveStatus = useBuildUpdates(
    isDemoMode ? [] : builds.map((build) => build.id),
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
  const host = isDemoMode ? demoHostMonitoring : hostQuery.data;
  const agents = agentsQuery.data ?? [];

  // Accumulate host samples for the load sparkline (polled every 15s).
  const [loadHistory, setLoadHistory] = useState<number[]>([]);
  useEffect(() => {
    if (!host || host.cpu.cores <= 0) {
      return;
    }
    const loadPercent = Math.min(100, (host.load.load1m / host.cpu.cores) * 100);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- accumulating polled samples is a legitimate sync-to-external pattern
    setLoadHistory((prev) => [...prev, loadPercent].slice(-24));
  }, [host]);

  const hostLoadPercent = host && host.cpu.cores > 0
    ? Math.min(100, (host.load.load1m / host.cpu.cores) * 100)
    : 0;

  const hostStatus = (percent: number): 'good' | 'average' | 'warning' =>
    percent < 50 ? 'good' : percent < 80 ? 'average' : 'warning';

  // Builds per day over the last 14 days, normalized to bar heights.
  // Anchored on the newest build timestamp so the chart is render-pure.
  const buildsPerDay = useMemo(() => {
    const days = 14;
    const counts = new Array<number>(days).fill(0);
    const timestamps = builds
      .map((build) => new Date((build.startedAt ?? build.completedAt) as string).getTime())
      .filter((t) => Number.isFinite(t));
    if (timestamps.length === 0) {
      return counts;
    }
    const anchor = Math.max(...timestamps);
    builds.forEach((build) => {
      const timestamp = build.startedAt ?? build.completedAt;
      if (!timestamp) {
        return;
      }
      const created = new Date(timestamp).getTime();
      const dayIndex = days - 1 - Math.floor((anchor - created) / 86_400_000);
      if (dayIndex >= 0 && dayIndex < days) {
        counts[dayIndex] += 1;
      }
    });
    const peak = Math.max(...counts, 1);
    return counts.map((count) => (count / peak) * 100);
  }, [builds]);
  const onlineAgents = agents.filter((agent) => agent.status === 'online' || agent.status === 'connecting').length;
  const totalAgentMemory = agents.reduce((sum, agent) => sum + agent.resources.memory.total, 0);
  const availableAgentMemory = agents.reduce((sum, agent) => sum + agent.resources.memory.available, 0);
  const agentEndpoint = getAgentPublicBaseUrl();
  const connectCommand = `CONTAINR_API_URL=${getApiBaseUrl().replace(/\/api\/v1$/, '')} \\
CONTAINR_AGENT_AUTH_TOKEN=${issuedToken?.token ?? '<token>'} \\
containr-agent`;

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
      <div className="w-full px-8 py-6">
        <div className="flex items-center gap-2 mb-6">
          <div className={`w-2 h-2 rounded-full ${liveStatus === 'live' ? 'bg-[var(--success)] animate-pulse' : 'bg-[var(--text-muted)]'}`} />
          <span className={`text-sm ${liveStatus === 'live' ? 'text-[var(--success)]' : 'text-[var(--text-muted)]'}`}>
            {liveStatus === 'live' ? 'Live sync active' : liveStatus === 'offline' ? 'Reconnecting...' : 'Polling for updates'}
          </span>
        </div>

        {!isDemoMode && buildsQuery.isLoading ? (
          <div className="py-16 text-center">
            <Loader2 size={24} className="animate-spin mx-auto text-[var(--text-tertiary)]" />
            <p className="mt-3 text-sm text-[var(--text-muted)]">Loading usage data...</p>
          </div>
        ) : !isDemoMode && buildsQuery.isError ? (
          <div className="panel p-8 text-center">
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-[var(--error-soft)] flex items-center justify-center">
              <AlertCircle size={24} className="text-[var(--error)]" />
            </div>
            <p className="text-sm text-[var(--error)]">Failed to load usage data</p>
          </div>
        ) : !signedIn ? (
          <div className="panel p-8 text-center">
            <p className="text-sm text-[var(--text-secondary)]">Sign in to view build activity and capacity.</p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <EnhancedMetricCard
                title="Runtime Hours"
                value={totalBuildHours > 0 ? `${totalBuildHours.toFixed(1)}h` : '—'}
                statusText={completedDurationsMs.length > 0 ? 'Active' : ''}
                status="good"
                subtitle={runtimeBody}
                icon={<Clock size={18} />}
              />
              <EnhancedMetricCard
                title="Build Activity"
                value={String(builds.length)}
                status={failedBuilds > 0 ? 'average' : 'good'}
                statusText={failedBuilds > 0 ? `${failedBuilds} failed` : 'Healthy'}
                subtitle={buildActivityBody}
                icon={<Activity size={18} />}
                chart={<BarChart data={buildsPerDay} color="var(--accent-primary)" height={72} gap={3} />}
              />
              <EnhancedMetricCard
                title="Capacity"
                value={String(activeBuildPressure)}
                status={activeBuildPressure > 0 ? 'average' : 'good'}
                statusText={activeBuildPressure > 0 ? 'Busy' : 'Idle'}
                subtitle={capacityBody}
                icon={<Gauge size={18} />}
              />
            </div>

            <section className="panel p-6">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] bg-[var(--accent-primary-soft)]">
                    <Server size={18} className="text-[var(--accent-primary)]" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-[var(--text-primary)]">Host Monitoring</h2>
                    <p className="text-xs text-[var(--text-tertiary)]">
                      {host
                        ? `${host.hostname} · ${host.os}/${host.architecture} · uptime ${formatUptime(host.uptimeSeconds)}${host.dockerAvailable ? '' : ' · Docker unavailable'}`
                        : 'Autoscaling base signal from this Containr host.'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    void hostQuery.refetch();
                    void agentsQuery.refetch();
                  }}
                  className="inline-flex h-9 items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border-subtle)] px-3 text-sm"
                >
                  <RefreshCw size={14} />
                  Refresh
                </button>
              </div>

              {!isDemoMode && hostQuery.isError ? (
                <div className="rounded-[var(--radius-md)] bg-[var(--error-soft)] px-4 py-3 text-sm text-[var(--error)]">
                  Host monitoring unavailable.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <EnhancedMetricCard
                    title="CPU Load"
                    icon={<Cpu size={18} />}
                    value={host ? host.load.load1m.toFixed(2) : '—'}
                    status={hostStatus(hostLoadPercent)}
                    statusText={host ? { good: 'Good', average: 'Average', warning: 'High' }[hostStatus(hostLoadPercent)] : ''}
                    subtitle={host ? `${host.cpu.cores} cores · 5m ${host.load.load5m.toFixed(2)} · 15m ${host.load.load15m.toFixed(2)}` : 'Loading CPU telemetry.'}
                    chart={<LineAreaChart data={loadHistory.length > 0 ? loadHistory : [0]} color="var(--accent-primary)" height={72} />}
                  />
                  <EnhancedMetricCard
                    title="Memory"
                    icon={<MemoryStick size={18} />}
                    value={host ? `${host.memory.usagePercent.toFixed(0)}%` : '—'}
                    status={hostStatus(host?.memory.usagePercent ?? 0)}
                    statusText={host ? { good: 'Good', average: 'Average', warning: 'High' }[hostStatus(host.memory.usagePercent)] : ''}
                    subtitle={host ? `${formatBytes(host.memory.available)} free` : 'Loading memory telemetry.'}
                    chart={
                      <div className="relative mx-auto" style={{ width: 150 }}>
                        <DonutChart percentage={host?.memory.usagePercent ?? 0} color="var(--warning)" size={150} thickness={14} />
                        <div className="absolute inset-x-0 bottom-0 text-center">
                          <div className="text-[10px] uppercase tracking-wide text-[var(--text-tertiary)]">Used</div>
                          <div className="text-sm font-bold text-[var(--text-primary)]">
                            {host ? `${formatBytes(host.memory.used)} / ${formatBytes(host.memory.total)}` : '—'}
                          </div>
                        </div>
                      </div>
                    }
                  />
                  <EnhancedMetricCard
                    title="Disk"
                    icon={<HardDrive size={18} />}
                    value={host ? `${host.storage.usagePercent.toFixed(0)}%` : '—'}
                    status={hostStatus(host?.storage.usagePercent ?? 0)}
                    statusText={host ? { good: 'Good', average: 'Average', warning: 'High' }[hostStatus(host.storage.usagePercent)] : ''}
                    subtitle={host ? `Mounted at ${host.storage.path}` : 'Loading disk telemetry.'}
                    chart={
                      <div>
                        <SegmentedBar
                          segments={[
                            { width: host?.storage.usagePercent ?? 0, color: 'var(--info)' },
                            { width: Math.max(2, 100 - (host?.storage.usagePercent ?? 0)), color: 'var(--surface-muted)' },
                          ]}
                          height={18}
                        />
                        <div className="mt-3 flex items-center gap-4 text-xs text-[var(--text-tertiary)]">
                          <span><span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ background: 'var(--info)' }} />{host ? `${formatBytes(host.storage.used)} used` : '—'}</span>
                          <span><span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ background: 'var(--surface-muted)' }} />{host ? `${formatBytes(host.storage.available)} free` : '—'}</span>
                        </div>
                      </div>
                    }
                  />
                </div>
              )}
            </section>

            <section className="panel p-6">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] bg-[var(--surface-muted)]">
                  <Radio size={18} className="text-[var(--text-tertiary)]" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-[var(--text-primary)]">Node Agents</h2>
                  <p className="text-xs text-[var(--text-tertiary)]">Remote VPS, VM, and LXC capacity for placement and autoscaling.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1fr]">
                <div className="space-y-3">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <StatCard
                      title="Registered"
                      value={String(agents.length)}
                      description={agentsQuery.isError ? 'Agent API unavailable.' : 'Nodes connected through token heartbeats.'}
                      icon={Radio}
                      color={agents.length > 0 ? 'success' : 'default'}
                    />
                    <StatCard
                      title="Online"
                      value={String(onlineAgents)}
                      description="Online and connecting agents can receive queued commands."
                      icon={Activity}
                      color={onlineAgents > 0 ? 'success' : 'default'}
                    />
                    <StatCard
                      title="Remote Memory"
                      value={formatBytes(totalAgentMemory)}
                      description={`${formatBytes(availableAgentMemory)} currently free across agents.`}
                      icon={Database}
                      color={totalAgentMemory > 0 ? 'success' : 'default'}
                    />
                  </div>

                  <div className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--border-subtle)]">
                    {agents.length > 0 ? (
                      agents.slice(0, 5).map((agent) => (
                        <div key={agent.id} className="flex items-center justify-between gap-3 border-b border-[var(--border-subtle)] px-4 py-3 last:border-b-0">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-[var(--text-primary)]">{agent.name}</p>
                            <p className="truncate text-xs text-[var(--text-tertiary)]">{agent.hostname} · {agent.ipAddress}:{agent.port}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-semibold text-[var(--text-primary)]">{agent.status}</p>
                            <p className="text-xs text-[var(--text-tertiary)]">{formatBytes(agent.resources.memory.available)} free</p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="px-4 py-6 text-sm text-[var(--text-tertiary)]">
                        No remote agents registered yet.
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-void)] p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <Terminal size={14} className="text-[var(--text-tertiary)]" />
                    <span className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">Connect Node</span>
                  </div>

                  {isAdmin ? (
                  <>
                  <div className="mb-3 flex gap-2">
                    <input
                      value={tokenLabel}
                      onChange={(e) => setTokenLabel(e.target.value)}
                      placeholder="Token label (e.g. node name)"
                      className="h-8 flex-1 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-3 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)] transition-all"
                    />
                    <button
                      onClick={() => createTokenMutation.mutate()}
                      disabled={createTokenMutation.isPending}
                      className="h-8 px-3 rounded-[var(--radius-md)] text-xs font-medium text-[var(--accent-on)] transition-all disabled:opacity-50"
                      style={{ background: 'var(--accent-primary)' }}
                    >
                      {createTokenMutation.isPending ? 'Issuing…' : 'Issue token'}
                    </button>
                  </div>

                  {issuedToken && (
                    <div className="mb-3 rounded-[var(--radius-md)] border border-[var(--success)]/30 bg-[var(--success-soft)] p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="mono text-xs text-[var(--text-primary)] break-all">{issuedToken.token}</span>
                        <button
                          onClick={() => void navigator.clipboard.writeText(issuedToken.token ?? '')}
                          className="flex items-center gap-1 text-xs text-[var(--accent-primary)] hover:underline shrink-0"
                        >
                          <Copy size={11} />
                          Copy
                        </button>
                      </div>
                      <p className="mt-1 text-xs text-[var(--text-tertiary)]">Shown once — store it now. Only the hash is kept server-side.</p>
                    </div>
                  )}
                  {createTokenMutation.isError && (
                    <p className="mb-3 text-xs text-[var(--error)]">
                      {createTokenMutation.error instanceof Error ? createTokenMutation.error.message : 'Failed to issue token'}
                    </p>
                  )}

                  <pre className="mono text-xs text-[var(--text-secondary)] whitespace-pre-wrap">{connectCommand}</pre>
                  <div className="mt-4 space-y-2 text-xs text-[var(--text-tertiary)]">
                    <p>Agent endpoint: <span className="mono text-[var(--text-primary)]">{agentEndpoint}</span></p>
                    <p>Use an issued token above, or set <span className="mono text-[var(--text-primary)]">CONTAINR_AGENT_AUTH_TOKENS</span> on the backend.</p>
                    <p>Agent sends host resources, polls pending Docker commands, and reports command results.</p>
                  </div>

                  {(agentTokensQuery.data ?? []).length > 0 && (
                    <div className="mt-4 border-t border-[var(--border-subtle)] pt-3">
                      <p className="mb-2 text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">Issued tokens</p>
                      <div className="space-y-1.5">
                        {(agentTokensQuery.data ?? []).map((t) => (
                          <div key={t.id} className="flex items-center justify-between gap-2 text-xs">
                            <div className="min-w-0">
                              <span className="text-[var(--text-primary)]">{t.label || t.id?.slice(0, 8)}</span>
                              <span className="ml-2 text-[var(--text-muted)]">
                                {t.revoked ? 'revoked' : t.last_used_at ? `used ${formatRelative(t.last_used_at)}` : 'unused'}
                              </span>
                            </div>
                            {!t.revoked && (
                              <button
                                onClick={() => revokeTokenMutation.mutate(t.id ?? '')}
                                disabled={revokeTokenMutation.isPending}
                                className="text-[var(--error)] hover:underline disabled:opacity-50 shrink-0"
                              >
                                Revoke
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  </>
                  ) : (
                    <p className="text-xs text-[var(--text-tertiary)]">
                      Node registration and token issuance are admin operations. {signedIn ? 'Your account does not have admin rights.' : 'Sign in as an admin to manage nodes.'}
                    </p>
                  )}
                </div>
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

export function PeoplePage() {
  const queryClient = useQueryClient();
  const isDemoMode = useDemoMode();
  const profileQuery = useQuery({
    queryKey: ['user-profile'],
    queryFn: getCurrentUserProfile,
    enabled: !isDemoMode,
  });
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');

  const createUserMutation = useMutation({
    mutationFn: () =>
      createUser({
        name: newUserName.trim(),
        email: newUserEmail.trim(),
        password: newUserPassword,
      }),
    onSuccess: () => {
      setNewUserName('');
      setNewUserEmail('');
      setNewUserPassword('');
      queryClient.invalidateQueries({ queryKey: ['user-profile'] });
      queryClient.invalidateQueries({ queryKey: ['people-audit-logs'] });
    },
  });

  const projectsQuery = useQuery({
    queryKey: ['people-projects'],
    queryFn: () => listProjects(),
    enabled: !isDemoMode,
  });
  const auditLogsQuery = useQuery({
    queryKey: ['people-audit-logs'],
    queryFn: () => listAuditLogs({ page: 1, limit: 20 }),
    enabled: !isDemoMode,
  });

  if (isDemoMode) {
    return <DemoRestricted feature="People and access management" />;
  }

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
      <div className="w-full px-8 py-6">
        {profileQuery.isLoading ? (
          <div className="py-16 text-center">
            <Loader2 size={24} className="animate-spin mx-auto text-[var(--text-tertiary)]" />
            <p className="mt-3 text-sm text-[var(--text-muted)]">Loading team data...</p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <StatCard
                title="Members"
                value={profileQuery.data ? '1+' : '—'}
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

            <section className="panel p-6">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] bg-[var(--accent-primary-soft)]">
                  <UserPlus size={18} className="text-[var(--accent-primary)]" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-[var(--text-primary)]">Manual User Creation</h2>
                  <p className="text-xs text-[var(--text-tertiary)]">Public registration is closed after bootstrap.</p>
                </div>
              </div>

              <form
                className="grid gap-3 lg:grid-cols-[1fr_1fr_1fr_auto]"
                onSubmit={(event) => {
                  event.preventDefault();
                  createUserMutation.mutate();
                }}
              >
                <input
                  value={newUserName}
                  onChange={(event) => setNewUserName(event.target.value)}
                  required
                  className="h-10 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-3 text-sm"
                  placeholder="Name"
                />
                <input
                  value={newUserEmail}
                  onChange={(event) => setNewUserEmail(event.target.value)}
                  type="email"
                  required
                  className="h-10 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-3 text-sm"
                  placeholder="email@example.com"
                />
                <input
                  value={newUserPassword}
                  onChange={(event) => setNewUserPassword(event.target.value)}
                  type="password"
                  minLength={8}
                  required
                  className="h-10 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-3 text-sm"
                  placeholder="Temporary password"
                />
                <button
                  type="submit"
                  disabled={createUserMutation.isPending}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-[var(--radius-md)] px-4 text-sm font-semibold text-[var(--accent-on)] disabled:opacity-60"
                  style={{ background: 'var(--accent-primary)' }}
                >
                  {createUserMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
                  Create
                </button>
              </form>

              {createUserMutation.isError ? (
                <div className="mt-4 rounded-[var(--radius-md)] bg-[var(--error-soft)] px-4 py-3 text-sm text-[var(--error)]">
                  {createUserMutation.error instanceof Error ? createUserMutation.error.message : 'Failed to create user'}
                </div>
              ) : null}
              {createUserMutation.isSuccess ? (
                <div className="mt-4 rounded-[var(--radius-md)] bg-[var(--success-soft)] px-4 py-3 text-sm text-[var(--success)]">
                  User created. Share credentials through secure channel.
                </div>
              ) : null}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

const gitProviderTypes = [
  { value: 'github', label: 'GitHub', tokenHint: 'Personal access token with repo scope' },
  { value: 'gitlab', label: 'GitLab', tokenHint: 'Personal access token with read_api scope' },
  { value: 'gitea', label: 'Gitea', tokenHint: 'Access token from your Gitea instance' },
  { value: 'bitbucket', label: 'Bitbucket', tokenHint: 'App password with repository read' },
] as const;

function GitProvidersSection() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const providersQuery = useQuery({
    queryKey: ['git-providers'],
    queryFn: listGitProviders,
  });

  // GitHub redirects back here with ?installation_id=<id> after app install.
  const installIdParam = searchParams.get('installation_id');
  const connectAppMutation = useMutation({
    mutationFn: (installationId: number) => connectGitHubApp(installationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['git-providers'] });
      const next = new URLSearchParams(searchParams);
      next.delete('installation_id');
      next.delete('setup_action');
      setSearchParams(next, { replace: true });
    },
  });
  const connectFiredFor = useRef<number | null>(null);
  useEffect(() => {
    const id = Number(installIdParam);
    if (id > 0 && connectFiredFor.current !== id) {
      connectFiredFor.current = id;
      connectAppMutation.mutate(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fire once per installation id
  }, [installIdParam]);

  const [installUrlError, setInstallUrlError] = useState<string | null>(null);
  const installApp = async () => {
    setInstallUrlError(null);
    try {
      window.open(await getGitHubAppInstallUrl(), '_blank', 'noopener');
    } catch (err) {
      setInstallUrlError(err instanceof Error ? err.message : 'GitHub App is not configured');
    }
  };

  const [form, setForm] = useState({
    name: 'github' as (typeof gitProviderTypes)[number]['value'],
    displayName: '',
    accessToken: '',
    apiUrl: '',
  });
  const [formOpen, setFormOpen] = useState(false);

  const createMutation = useMutation({
    mutationFn: () =>
      createGitProvider({
        name: form.name,
        display_name: form.displayName.trim() || gitProviderTypes.find((t) => t.value === form.name)!.label,
        access_token: form.accessToken.trim(),
        api_url: form.apiUrl.trim() || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['git-providers'] });
      setForm({ name: 'github', displayName: '', accessToken: '', apiUrl: '' });
      setFormOpen(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (providerId: string) => deleteGitProvider(providerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['git-providers'] });
    },
  });

  const providers = providersQuery.data ?? [];
  const selectedType = gitProviderTypes.find((t) => t.value === form.name)!;

  return (
    <section className="panel p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-[var(--radius-md)] bg-[var(--accent-primary-soft)] flex items-center justify-center">
            <GitBranch size={18} className="text-[var(--accent-primary)]" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Git Providers</h2>
            <p className="text-xs text-[var(--text-tertiary)]">Connect accounts to deploy services from repositories</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void installApp()}
            className="flex items-center gap-2 h-9 px-4 rounded-[var(--radius-md)] border border-[var(--border-subtle)] text-sm font-medium text-[var(--text-secondary)] hover:border-[var(--border-default)] transition-colors"
          >
            <GitBranch size={14} />
            Install GitHub App
          </button>
          <button
            onClick={() => setFormOpen((open) => !open)}
            className="flex items-center gap-2 h-9 px-4 rounded-[var(--radius-md)] text-[var(--accent-on)] text-sm font-medium shadow-lg transition-all"
            style={{ background: 'var(--accent-primary)' }}
          >
            <Link2 size={14} />
            {formOpen ? 'Close' : 'Connect'}
          </button>
        </div>
      </div>

      {installUrlError && (
        <div className="mb-4 px-4 py-3 rounded-[var(--radius-md)] bg-[var(--error-soft)] text-sm text-[var(--error)]">
          {installUrlError}
        </div>
      )}
      {connectAppMutation.isPending && (
        <div className="mb-4 px-4 py-3 rounded-[var(--radius-md)] bg-[var(--surface-muted)] text-sm text-[var(--text-secondary)]">
          Completing GitHub App installation…
        </div>
      )}
      {connectAppMutation.isError && (
        <div className="mb-4 px-4 py-3 rounded-[var(--radius-md)] bg-[var(--error-soft)] text-sm text-[var(--error)]">
          {connectAppMutation.error instanceof Error ? connectAppMutation.error.message : 'Failed to connect GitHub App'}
        </div>
      )}

      {providersQuery.isLoading ? (
        <div className="py-6 text-center">
          <Loader2 size={20} className="animate-spin mx-auto text-[var(--text-tertiary)]" />
        </div>
      ) : providersQuery.isError ? (
        <div className="px-4 py-3 rounded-[var(--radius-md)] bg-[var(--error-soft)] text-sm text-[var(--error)]">
          Failed to load providers
        </div>
      ) : providers.length === 0 ? (
        <div className="py-6 text-center">
          <p className="text-sm text-[var(--text-secondary)]">No Git providers connected</p>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Connect GitHub, GitLab, Gitea, or Bitbucket to deploy services from source
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {providers.map((provider) => (
            <div
              key={provider.id}
              className="flex items-center justify-between p-3 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-muted)]"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-[var(--radius-sm)] bg-[var(--surface-card)] flex items-center justify-center">
                  <GitBranch size={14} className="text-[var(--text-tertiary)]" />
                </div>
                <div>
                  <p className="text-sm font-medium text-[var(--text-primary)]">{provider.display_name}</p>
                  <p className="text-xs text-[var(--text-muted)] capitalize">{provider.name.replace('_', ' ')}</p>
                </div>
              </div>
              <button
                onClick={() => deleteMutation.mutate(provider.id)}
                disabled={deleteMutation.isPending}
                className="flex items-center gap-2 h-8 px-3 rounded-[var(--radius-sm)] border border-[var(--error-soft)] text-[var(--error)] text-xs font-medium hover:bg-[var(--error-soft)] disabled:opacity-50 transition-colors"
              >
                <Unlink size={12} />
                Disconnect
              </button>
            </div>
          ))}
        </div>
      )}

      {formOpen && (
        <div className="mt-4 pt-4 border-t border-[var(--border-subtle)] space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium uppercase tracking-wider text-[var(--text-muted)] mb-2">
                Provider
              </label>
              <select
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value as typeof form.name }))}
                className="w-full h-10 px-3 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] text-sm focus:border-[var(--accent-primary)] transition-colors"
              >
                {gitProviderTypes.map((type) => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium uppercase tracking-wider text-[var(--text-muted)] mb-2">
                Display Name
              </label>
              <input
                value={form.displayName}
                onChange={(e) => setForm((p) => ({ ...p, displayName: e.target.value }))}
                className="w-full h-10 px-3 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] text-sm focus:border-[var(--accent-primary)] transition-colors"
                placeholder={selectedType.label}
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-[var(--text-muted)] mb-2">
              Access Token
            </label>
            <input
              type="password"
              value={form.accessToken}
              onChange={(e) => setForm((p) => ({ ...p, accessToken: e.target.value }))}
              className="w-full h-10 px-3 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] text-sm mono focus:border-[var(--accent-primary)] transition-colors"
              placeholder="••••••••••••••••"
            />
            <p className="text-xs text-[var(--text-muted)] mt-1.5">{selectedType.tokenHint}</p>
          </div>
          {form.name === 'gitea' && (
            <div>
              <label className="block text-xs font-medium uppercase tracking-wider text-[var(--text-muted)] mb-2">
                Instance URL
              </label>
              <input
                value={form.apiUrl}
                onChange={(e) => setForm((p) => ({ ...p, apiUrl: e.target.value }))}
                className="w-full h-10 px-3 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] text-sm mono focus:border-[var(--accent-primary)] transition-colors"
                placeholder="https://gitea.example.com"
              />
            </div>
          )}
          {createMutation.isError && (
            <div className="px-4 py-3 rounded-[var(--radius-md)] bg-[var(--error-soft)] text-sm text-[var(--error)]">
              {createMutation.error instanceof Error ? createMutation.error.message : 'Failed to connect provider'}
            </div>
          )}
          <div className="flex justify-end pt-1">
            <button
              onClick={() => createMutation.mutate()}
              disabled={!form.accessToken.trim() || createMutation.isPending}
              className="flex items-center gap-2 h-9 px-4 rounded-[var(--radius-md)] text-[var(--accent-on)] text-sm font-medium shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              style={{ background: 'var(--accent-primary)' }}
            >
              {createMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              Connect Provider
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function PlatformSettingsSection() {
  const queryClient = useQueryClient();
  const settingsQuery = useQuery({
    queryKey: ['platform-settings'],
    queryFn: getPlatformSettings,
  });

  const [signupDraft, setSignupDraft] = useState<boolean | null>(null);
  const [tokenDraft, setTokenDraft] = useState('');
  const [brandDraft, setBrandDraft] = useState<BrandingInput>({});
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const signupEnabled = signupDraft ?? settingsQuery.data?.signupEnabled ?? false;
  const tunnel = settingsQuery.data?.cloudflareTunnel;

  const saveMutation = useMutation({
    mutationFn: updatePlatformSettings,
    onSuccess: (settings) => {
      queryClient.setQueryData(['platform-settings'], settings);
      queryClient.invalidateQueries({ queryKey: ['branding'] });
      setSignupDraft(null);
      setTokenDraft('');
      setBrandDraft({});
      setFeedback('Settings saved.');
      setError(null);
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
      setFeedback(null);
    },
  });

  const saveSignup = (enabled: boolean) => {
    setSignupDraft(enabled);
    saveMutation.mutate({ signupEnabled: enabled });
  };

  const saveToken = () => {
    if (!tokenDraft.trim()) return;
    saveMutation.mutate({ cloudflareTunnelToken: tokenDraft.trim() });
  };

  const clearToken = () => {
    saveMutation.mutate({ cloudflareTunnelToken: '' });
  };

  return (
    <section className="panel p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-[var(--radius-md)] bg-[var(--accent-primary-soft)] flex items-center justify-center">
          <Cloud size={18} className="text-[var(--accent-primary)]" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Platform</h2>
          <p className="text-xs text-[var(--text-tertiary)]">Owner only - values set here override environment variables</p>
        </div>
      </div>

      {settingsQuery.isLoading ? (
        <div className="py-6 text-center">
          <Loader2 size={18} className="animate-spin mx-auto text-[var(--text-tertiary)]" />
        </div>
      ) : (
        <div className="space-y-4">
          <label className="flex items-start gap-3 p-4 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] cursor-pointer">
            <input
              type="checkbox"
              checked={signupEnabled}
              onChange={(e) => saveSignup(e.target.checked)}
              disabled={saveMutation.isPending}
              className="mt-0.5 accent-[var(--accent-primary)]"
            />
            <div>
              <span className="text-sm font-medium text-[var(--text-primary)]">Open registration</span>
              <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
                Let anyone with the URL create an account. Off by default after the owner account is created.
              </p>
            </div>
          </label>

          <div className="p-4 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-muted)]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">Cloudflare Tunnel</span>
              <span className="text-xs text-[var(--text-tertiary)]">
                {tunnel?.tokenSet
                  ? `token saved (${tunnel.source}) - ${tunnel.container}`
                  : tunnel?.container === 'unavailable'
                    ? 'Docker socket unavailable'
                    : 'not configured'}
              </span>
            </div>
            <p className="text-xs text-[var(--text-secondary)] mb-3">
              Expose this instance through a Cloudflare Tunnel. Create a tunnel in the dashboard,
              copy the token, paste it here - the cloudflared sidecar is managed for you.
            </p>
            <div className="flex gap-2">
              <input
                type="password"
                value={tokenDraft}
                onChange={(e) => setTokenDraft(e.target.value)}
                className="flex-1 h-9 px-3 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-void)] text-sm focus:border-[var(--accent-primary)] transition-colors"
                placeholder={tunnel?.tokenSet ? 'Token saved - paste a new one to rotate' : 'eyJhIjo... tunnel token'}
              />
              <button
                onClick={saveToken}
                disabled={saveMutation.isPending || !tokenDraft.trim()}
                className="h-9 px-4 rounded-[var(--radius-md)] text-sm font-medium text-[var(--accent-on)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                style={{ background: 'var(--accent-primary)' }}
              >
                Save
              </button>
              {tunnel?.tokenSet && tunnel.source === 'app' ? (
                <button
                  onClick={clearToken}
                  disabled={saveMutation.isPending}
                  className="h-9 px-3 rounded-[var(--radius-md)] border border-[var(--error-soft)] text-[var(--error)] text-sm font-medium hover:bg-[var(--error-soft)] disabled:opacity-50 transition-colors"
                >
                  Remove
                </button>
              ) : null}
            </div>
            <a
              href="https://one.dash.cloudflare.com/"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 mt-3 text-xs text-[var(--accent-primary)] hover:underline"
            >
              Open Cloudflare Zero Trust dashboard - Networks → Tunnels → Create
              <ExternalLink size={12} />
            </a>
          </div>

          <div className="p-4 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-muted)]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">Branding</span>
              <span className="text-xs text-[var(--text-tertiary)]">leave blank to keep Containr defaults</span>
            </div>
            <p className="text-xs text-[var(--text-secondary)] mb-3">
              White-label this instance — product name, logo, accent color and links apply
              to the shell, login page and document title.
            </p>
            <div className="grid grid-cols-2 gap-2 max-sm:grid-cols-1">
              {(
                [
                  ['productName', 'Product name'],
                  ['logoUrl', 'Logo URL'],
                  ['faviconUrl', 'Favicon URL'],
                  ['accentColor', 'Accent color (#hex)'],
                  ['docsUrl', 'Docs URL'],
                  ['supportUrl', 'Support URL'],
                ] as const
              ).map(([field, label]) => (
                <label key={field} className="block">
                  <span className="mb-1 block text-[11px] text-[var(--text-tertiary)]">{label}</span>
                  <input
                    value={brandDraft[field] ?? settingsQuery.data?.branding[field] ?? ''}
                    onChange={(e) => setBrandDraft((d) => ({ ...d, [field]: e.target.value }))}
                    className="h-9 w-full px-3 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-void)] text-sm focus:border-[var(--accent-primary)] transition-colors"
                  />
                </label>
              ))}
            </div>
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => {
                  const b = { ...(settingsQuery.data?.branding ?? {}), ...brandDraft } as Branding;
                  saveMutation.mutate({ branding: b });
                }}
                disabled={saveMutation.isPending || Object.keys(brandDraft).length === 0}
                className="h-9 px-4 rounded-[var(--radius-md)] text-sm font-medium text-[var(--accent-on)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                style={{ background: 'var(--accent-primary)' }}
              >
                Save branding
              </button>
              {Object.keys(brandDraft).length > 0 ? (
                <button
                  onClick={() => setBrandDraft({})}
                  className="h-9 px-3 rounded-[var(--radius-md)] border border-[var(--border-subtle)] text-sm text-[var(--text-secondary)]"
                >
                  Reset draft
                </button>
              ) : null}
            </div>
          </div>

          {feedback ? <p className="text-xs text-[var(--success)]">{feedback}</p> : null}
          {error ? <p className="text-xs text-[var(--error)]">{error}</p> : null}
        </div>
      )}
    </section>
  );
}

const PAT_EXPIRY_OPTIONS: { label: string; days: number }[] = [
  { label: 'Never', days: 0 },
  { label: '30 days', days: 30 },
  { label: '90 days', days: 90 },
  { label: '1 year', days: 365 },
];

function UserTokensSection({ isAdmin }: { isAdmin: boolean }) {
  const queryClient = useQueryClient();
  const tokensQuery = useQuery({
    queryKey: ['user-tokens'],
    queryFn: listUserTokens,
  });
  const [tokenName, setTokenName] = useState('');
  const [tokenScope, setTokenScope] = useState<UserTokenScope>('write');
  const [expiryDays, setExpiryDays] = useState(0);
  const [issuedToken, setIssuedToken] = useState<UserTokenCreated | null>(null);

  const createMutation = useMutation({
    mutationFn: () =>
      createUserToken({
        name: tokenName.trim(),
        scope: tokenScope,
        expiresInDays: expiryDays,
      }),
    onSuccess: (data) => {
      setIssuedToken(data);
      setTokenName('');
      queryClient.invalidateQueries({ queryKey: ['user-tokens'] });
    },
  });
  const revokeMutation = useMutation({
    mutationFn: (id: string) => revokeUserToken(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['user-tokens'] }),
  });

  const tokens = tokensQuery.data ?? [];
  const scopeOptions: { value: UserTokenScope; label: string }[] = isAdmin
    ? [
        { value: 'read', label: 'Read - GET requests only' },
        { value: 'write', label: 'Write - read and manage resources' },
        { value: 'admin', label: 'Admin - everything, incl. platform settings' },
      ]
    : [
        { value: 'read', label: 'Read - GET requests only' },
        { value: 'write', label: 'Write - read and manage resources' },
      ];

  return (
    <section className="panel p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-[var(--radius-md)] bg-[var(--accent-primary-soft)] flex items-center justify-center">
          <Key size={18} className="text-[var(--accent-primary)]" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Personal Access Tokens</h2>
          <p className="text-xs text-[var(--text-tertiary)]">Authenticate the CLI, MCP server, and scripts - same rights as you, bounded by scope</p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <input
            value={tokenName}
            onChange={(e) => setTokenName(e.target.value)}
            placeholder="Token name (e.g. laptop cli)"
            className="h-9 flex-1 min-w-[180px] rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-primary)] transition-all"
          />
          <select
            value={tokenScope}
            onChange={(e) => setTokenScope(e.target.value as UserTokenScope)}
            className="h-9 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-3 text-sm text-[var(--text-primary)] focus:border-[var(--accent-primary)] transition-all"
          >
            {scopeOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <select
            value={expiryDays}
            onChange={(e) => setExpiryDays(Number(e.target.value))}
            className="h-9 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-3 text-sm text-[var(--text-primary)] focus:border-[var(--accent-primary)] transition-all"
          >
            {PAT_EXPIRY_OPTIONS.map((option) => (
              <option key={option.days} value={option.days}>{option.label}</option>
            ))}
          </select>
          <button
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending || !tokenName.trim()}
            className="h-9 px-4 rounded-[var(--radius-md)] text-sm font-medium text-[var(--accent-on)] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            style={{ background: 'var(--accent-primary)' }}
          >
            {createMutation.isPending ? 'Creating…' : 'Create token'}
          </button>
        </div>

        {issuedToken ? (
          <div className="rounded-[var(--radius-md)] border border-[var(--success)]/30 bg-[var(--success-soft)] p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="mono text-xs text-[var(--text-primary)] break-all">{issuedToken.token}</span>
              <button
                onClick={() => void navigator.clipboard.writeText(issuedToken.token ?? '')}
                className="flex items-center gap-1 text-xs text-[var(--accent-primary)] hover:underline shrink-0"
              >
                <Copy size={11} />
                Copy
              </button>
            </div>
            <p className="mt-1 text-xs text-[var(--text-tertiary)]">
              Shown once - store it now. Use with <span className="mono">containr auth login --token</span> or as a Bearer token.
            </p>
          </div>
        ) : null}
        {createMutation.isError ? (
          <p className="text-xs text-[var(--error)]">
            {createMutation.error instanceof Error ? createMutation.error.message : 'Failed to create token'}
          </p>
        ) : null}

        {tokensQuery.isLoading ? (
          <div className="py-4 text-center">
            <Loader2 size={16} className="animate-spin mx-auto text-[var(--text-tertiary)]" />
          </div>
        ) : tokens.length === 0 ? (
          <p className="text-xs text-[var(--text-tertiary)]">No tokens yet. Create one to connect the CLI or an agent.</p>
        ) : (
          <div className="space-y-1.5 border-t border-[var(--border-subtle)] pt-3">
            {tokens.map((token) => (
              <div key={token.id} className="flex items-center justify-between gap-2 text-xs">
                <div className="min-w-0">
                  <span className="text-[var(--text-primary)]">{token.name}</span>
                  <span className="ml-2 mono text-[var(--text-muted)]">{token.key_prefix}…</span>
                  <span className="ml-2 rounded px-1.5 py-0.5 bg-[var(--surface-muted)] text-[var(--text-secondary)]">{token.scope}</span>
                  <span className="ml-2 text-[var(--text-muted)]">
                    {token.last_used_at ? `used ${formatRelative(token.last_used_at)}` : 'unused'}
                    {token.expires_at ? ` · expires ${formatRelative(token.expires_at)}` : ''}
                  </span>
                </div>
                <button
                  onClick={() => {
                    if (window.confirm(`Revoke token "${token.name}"? Clients using it lose access immediately.`)) {
                      revokeMutation.mutate(token.id ?? '');
                    }
                  }}
                  disabled={revokeMutation.isPending}
                  className="text-[var(--error)] hover:underline disabled:opacity-50 shrink-0"
                >
                  Revoke
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function RegistriesSection() {
  const queryClient = useQueryClient();
  const registriesQuery = useQuery({
    queryKey: ['registries'],
    queryFn: listRegistries,
  });
  const [name, setName] = useState('');
  const [host, setHost] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const createMutation = useMutation({
    mutationFn: () =>
      createRegistry({
        name: name.trim(),
        host: host.trim(),
        username: username.trim() || undefined,
        password: password || undefined,
      }),
    onSuccess: () => {
      setName('');
      setHost('');
      setUsername('');
      setPassword('');
      queryClient.invalidateQueries({ queryKey: ['registries'] });
    },
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteRegistry(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['registries'] }),
  });

  const registries = registriesQuery.data ?? [];

  return (
    <section className="panel p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-[var(--radius-md)] bg-[var(--accent-primary-soft)] flex items-center justify-center">
          <Archive size={18} className="text-[var(--accent-primary)]" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Registry credentials</h2>
          <p className="text-xs text-[var(--text-tertiary)]">Pull private images on deploy - matched by image host, stored encrypted</p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name (e.g. ghcr)"
            className="h-9 flex-1 min-w-[120px] rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-primary)] transition-all"
          />
          <input
            value={host}
            onChange={(e) => setHost(e.target.value)}
            placeholder="Host (ghcr.io, docker.io)"
            className="h-9 flex-1 min-w-[160px] rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-primary)] transition-all"
          />
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Username"
            className="h-9 w-40 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-primary)] transition-all"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password / token"
            className="h-9 w-44 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-primary)] transition-all"
          />
          <button
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending || !name.trim() || !host.trim()}
            className="h-9 px-4 rounded-[var(--radius-md)] text-sm font-medium text-[var(--accent-on)] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            style={{ background: 'var(--accent-primary)' }}
          >
            {createMutation.isPending ? 'Adding…' : 'Add registry'}
          </button>
        </div>

        {createMutation.isError ? (
          <p className="text-xs text-[var(--error)]">
            {createMutation.error instanceof Error ? createMutation.error.message : 'Failed to add registry'}
          </p>
        ) : null}

        {registriesQuery.isLoading ? (
          <div className="py-4 text-center">
            <Loader2 size={16} className="animate-spin mx-auto text-[var(--text-tertiary)]" />
          </div>
        ) : registries.length === 0 ? (
          <p className="text-xs text-[var(--text-tertiary)]">
            No credentials. Image pulls are anonymous unless a registry matching the image host exists here.
          </p>
        ) : (
          <div className="space-y-1.5 border-t border-[var(--border-subtle)] pt-3">
            {registries.map((r: Registry) => (
              <div key={r.id} className="flex items-center justify-between gap-2 text-xs">
                <div className="min-w-0">
                  <span className="text-[var(--text-primary)]">{r.name}</span>
                  <span className="ml-2 mono text-[var(--text-muted)]">{r.host}</span>
                  {r.username ? <span className="ml-2 text-[var(--text-secondary)]">{r.username}</span> : null}
                  <span className="ml-2 rounded px-1.5 py-0.5 bg-[var(--surface-muted)] text-[var(--text-secondary)]">
                    {r.has_password ? 'password set' : 'anonymous'}
                  </span>
                </div>
                <button
                  onClick={() => {
                    if (window.confirm(`Remove credentials for ${r.host}?`)) {
                      deleteMutation.mutate(r.id);
                    }
                  }}
                  disabled={deleteMutation.isPending}
                  className="text-[var(--error)] hover:underline disabled:opacity-50 shrink-0"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function BackupTargetsSection() {
  const queryClient = useQueryClient();
  const targetsQuery = useQuery({
    queryKey: ['backup-targets'],
    queryFn: listBackupTargets,
  });
  const [form, setForm] = useState({ name: '', endpoint: '', bucket: '', region: '', prefix: '', accessKey: '', secretKey: '', noTls: false });
  const [testResult, setTestResult] = useState<Record<string, { ok: boolean; latency_ms?: number; error?: string }>>({});

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['backup-targets'] });
  const createMutation = useMutation({
    mutationFn: () =>
      createBackupTarget({
        name: form.name.trim(),
        endpoint: form.endpoint.trim(),
        bucket: form.bucket.trim(),
        region: form.region.trim() || undefined,
        prefix: form.prefix.trim() || undefined,
        access_key: form.accessKey || undefined,
        secret_key: form.secretKey || undefined,
        use_tls: !form.noTls,
      }),
    onSuccess: () => {
      setForm({ name: '', endpoint: '', bucket: '', region: '', prefix: '', accessKey: '', secretKey: '', noTls: false });
      invalidate();
    },
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteBackupTarget(id),
    onSuccess: invalidate,
  });
  const testMutation = useMutation({
    mutationFn: (id: string) => testBackupTarget(id),
    onSuccess: (result, id) => setTestResult((prev) => ({ ...prev, [id]: result })),
    onError: (error, id) =>
      setTestResult((prev) => ({ ...prev, [id]: { ok: false, error: error instanceof Error ? error.message : 'probe failed' } })),
  });

  const targets = targetsQuery.data ?? [];
  const fieldCls = 'h-9 flex-1 min-w-[130px] rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-primary)] transition-all';

  return (
    <section className="panel p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-[var(--radius-md)] bg-[var(--accent-primary-soft)] flex items-center justify-center">
          <HardDrive size={18} className="text-[var(--accent-primary)]" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Backup targets</h2>
          <p className="text-xs text-[var(--text-tertiary)]">S3-compatible destinations for database archives — keys stored encrypted</p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Name (e.g. garage)" className={fieldCls} />
          <input value={form.endpoint} onChange={(e) => setForm((f) => ({ ...f, endpoint: e.target.value }))} placeholder="Endpoint host:port" className={fieldCls} />
          <input value={form.bucket} onChange={(e) => setForm((f) => ({ ...f, bucket: e.target.value }))} placeholder="Bucket" className="h-9 w-36 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-primary)] transition-all" />
          <input value={form.accessKey} onChange={(e) => setForm((f) => ({ ...f, accessKey: e.target.value }))} placeholder="Access key" className={fieldCls} />
          <input type="password" value={form.secretKey} onChange={(e) => setForm((f) => ({ ...f, secretKey: e.target.value }))} placeholder="Secret key" className={fieldCls} />
          <label className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
            <input type="checkbox" checked={form.noTls} onChange={(e) => setForm((f) => ({ ...f, noTls: e.target.checked }))} className="accent-[var(--accent-primary)]" />
            No TLS
          </label>
          <button
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending || !form.name.trim() || !form.endpoint.trim() || !form.bucket.trim()}
            className="h-9 px-4 rounded-[var(--radius-md)] text-sm font-medium text-[var(--accent-on)] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            style={{ background: 'var(--accent-primary)' }}
          >
            {createMutation.isPending ? 'Checking…' : 'Add target'}
          </button>
        </div>

        {createMutation.isError ? (
          <p className="text-xs text-[var(--error)]">
            {createMutation.error instanceof Error ? createMutation.error.message : 'Failed to add target'}
          </p>
        ) : null}

        {targetsQuery.isLoading ? (
          <div className="py-4 text-center">
            <Loader2 size={16} className="animate-spin mx-auto text-[var(--text-tertiary)]" />
          </div>
        ) : targets.length === 0 ? (
          <p className="text-xs text-[var(--text-tertiary)]">
            No backup targets. Database archives stay in the local backups volume until a target is configured.
          </p>
        ) : (
          <div className="space-y-1.5 border-t border-[var(--border-subtle)] pt-3">
            {targets.map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-2 text-xs">
                <div className="min-w-0">
                  <span className="text-[var(--text-primary)]">{t.name}</span>
                  <span className="ml-2 mono text-[var(--text-muted)]">{t.endpoint}/{t.bucket}{t.prefix ? `/${t.prefix}` : ''}</span>
                  <span className="ml-2 rounded px-1.5 py-0.5 bg-[var(--surface-muted)] text-[var(--text-secondary)]">
                    {t.has_credentials ? 'keys set' : 'anonymous'}{t.use_tls ? '' : ' · no TLS'}
                  </span>
                  {testResult[t.id ?? ''] && (
                    <span className={`ml-2 ${testResult[t.id ?? '']?.ok ? 'text-[var(--success)]' : 'text-[var(--error)]'}`}>
                      {testResult[t.id ?? '']?.ok ? `reachable (${testResult[t.id ?? '']?.latency_ms ?? 0}ms)` : `unreachable — ${testResult[t.id ?? '']?.error ?? 'probe failed'}`}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <button
                    onClick={() => testMutation.mutate(t.id ?? '')}
                    disabled={testMutation.isPending}
                    className="text-[var(--accent-primary)] hover:underline disabled:opacity-50"
                  >
                    Test
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm(`Delete backup target ${t.name}?`)) {
                        deleteMutation.mutate(t.id ?? '');
                      }
                    }}
                    disabled={deleteMutation.isPending}
                    className="text-[var(--error)] hover:underline disabled:opacity-50"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export function SettingsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isDemoMode = useDemoMode();
  const profileQuery = useQuery({
    queryKey: ['settings-profile'],
    queryFn: getCurrentUserProfile,
    enabled: !isDemoMode,
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
    try {
      for (const key of storageSummary.canvasKeys) {
        window.localStorage.removeItem(key);
      }
    } catch {
      // Storage unavailable — nothing to clear.
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

  if (isDemoMode) {
    return <DemoRestricted feature="Account and platform settings" />;
  }

  return (
    <div className="min-h-screen">
      <SecondaryPageHeader
        title="Settings"
        description="Manage account profile and local configuration"
      />
      <div className="w-full px-8 py-6">
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
                    className="flex items-center gap-2 h-9 px-4 rounded-[var(--radius-md)] text-[var(--accent-on)] text-sm font-medium shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    style={{ background: 'var(--accent-primary)' }}
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

          {/* Personal Access Tokens */}
          <UserTokensSection isAdmin={profileQuery.data?.isAdmin ?? false} />
          <RegistriesSection />
          <BackupTargetsSection />

          {/* Platform Settings - owner only */}
          {profileQuery.data?.isAdmin ? <PlatformSettingsSection /> : null}

          {/* Git Providers Section */}
          <GitProvidersSection />

          {/* Audit Logs Section */}
          <section className="panel p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-[var(--radius-md)] bg-[var(--accent-primary-soft)] flex items-center justify-center">
                <ScrollText size={18} className="text-[var(--accent-primary)]" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">Audit Logs</h2>
                <p className="text-xs text-[var(--text-tertiary)]">Every authenticated action recorded by the platform</p>
              </div>
            </div>
            <p className="text-sm text-[var(--text-secondary)] mb-4">
              Filter the full audit trail by resource, action, actor, and time range.
            </p>
            <button
              onClick={() => navigate('/settings/audit-logs')}
              className="flex items-center gap-2 h-9 px-4 rounded-[var(--radius-md)] border border-[var(--border-subtle)] text-sm font-medium hover:border-[var(--border-default)] transition-colors"
            >
              Open audit logs
              <ChevronRight size={14} />
            </button>
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
  return (
    <div className="min-h-screen">
      <SecondaryPageHeader
        title="Docs"
        description="Guides and references — synced from GitHub, cached offline"
      />
      <div className="w-full px-8 py-6">
        <DocsBrowser />
      </div>
    </div>
  );
}


export { ComponentShowcase } from './pages/ComponentShowcase';

const dbStatusClass: Record<string, string> = {
  running: 'bg-[var(--success-soft)] text-[var(--success)]',
  stopped: 'bg-[var(--surface-muted)] text-[var(--text-muted)]',
  building: 'bg-[var(--warning-soft)] text-[var(--warning)]',
  error: 'bg-[var(--error-soft)] text-[var(--error)]',
};

const DATABASE_TYPES = ['postgresql', 'mysql', 'mariadb', 'mongodb', 'redis', 'dragonfly', 'clickhouse'] as const;
const DATABASE_PLANS = ['hobby', 'starter', 'standard', 'business'] as const;

export function DatabasesPage() {
  const queryClient = useQueryClient();
  const isDemoMode = useDemoMode();
  const sessionQuery = useAuthSession({ enabled: !isDemoMode });
  const signedIn = isDemoMode || Boolean(sessionQuery.data);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [bindDb, setBindDb] = useState<DatabaseEntity | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createMode, setCreateMode] = useState<'managed' | 'external'>('managed');
  const [createForm, setCreateForm] = useState({ name: '', type: 'postgresql', plan: 'hobby', region: 'local', public: false });
  const [externalForm, setExternalForm] = useState({ name: '', type: 'postgresql', host: '', port: '', database: '', username: '', password: '', ssl: false });
  const [externalProbe, setExternalProbe] = useState<{ ok: boolean; latency_ms?: number; error?: string } | null>(null);
  const [externalTestResult, setExternalTestResult] = useState<Record<string, { ok: boolean; latency_ms?: number; error?: string }>>({});
  const [createError, setCreateError] = useState<string | null>(null);
  const databasesQuery = useQuery({
    queryKey: ['databases'],
    queryFn: listDatabases,
    refetchInterval: 15_000,
    enabled: !isDemoMode,
  });
  const backupTargetsQuery = useQuery({
    queryKey: ['backup-targets'],
    queryFn: listBackupTargets,
    enabled: !isDemoMode,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['databases'] });
  const createMutation = useMutation({
    mutationFn: () =>
      createManagedDatabase({
        name: createForm.name.trim(),
        type: createForm.type as CreateDatabaseInput['type'],
        plan: createForm.plan as CreateDatabaseInput['plan'],
        region: createForm.region.trim() || 'local',
        public_port: createForm.public,
      }),
    onSuccess: () => {
      setCreateOpen(false);
      setCreateForm({ name: '', type: 'postgresql', plan: 'hobby', region: 'local', public: false });
      setCreateError(null);
      invalidate();
    },
    onError: (error) => {
      setCreateError(error instanceof Error ? error.message : 'Failed to create database');
    },
  });
  const externalPayload = (): ExternalDatabaseInput => ({
    name: externalForm.name.trim(),
    type: externalForm.type,
    host: externalForm.host.trim(),
    port: Number(externalForm.port) || undefined,
    database: externalForm.database.trim() || undefined,
    username: externalForm.username.trim() || undefined,
    password: externalForm.password || undefined,
    ssl: externalForm.ssl,
  });
  const registerExternalMutation = useMutation({
    mutationFn: () => registerExternalDatabase(externalPayload()),
    onSuccess: () => {
      setCreateOpen(false);
      setExternalForm({ name: '', type: 'postgresql', host: '', port: '', database: '', username: '', password: '', ssl: false });
      setExternalProbe(null);
      setCreateError(null);
      invalidate();
    },
    onError: (error) => {
      setCreateError(error instanceof Error ? error.message : 'Failed to register database');
    },
  });
  const probeMutation = useMutation({
    mutationFn: () => testDatabaseConnection(externalPayload()),
    onSuccess: (result) => setExternalProbe(result),
    onError: (error) => setExternalProbe({ ok: false, error: error instanceof Error ? error.message : 'probe failed' }),
  });
  const publicPortMutation = useMutation({
    mutationFn: ({ id, publicPort }: { id: string; publicPort: boolean }) =>
      updateDatabase(id, { public_port: publicPort }),
    onSuccess: () => window.setTimeout(invalidate, 1500),
  });
  const backupTargetMutation = useMutation({
    mutationFn: ({ id, targetId }: { id: string; targetId: string }) =>
      updateDatabase(id, { backup_target_id: targetId }),
    onSuccess: invalidate,
  });
  const importBackupMutation = useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) => importDatabaseBackup(id, file),
    onSuccess: invalidate,
  });
  const testByIdMutation = useMutation({
    mutationFn: (id: string) => testDatabaseConnectionByID(id),
    onSuccess: (result, id) => setExternalTestResult((prev) => ({ ...prev, [id]: result })),
    onError: (error, id) =>
      setExternalTestResult((prev) => ({ ...prev, [id]: { ok: false, error: error instanceof Error ? error.message : 'probe failed' } })),
  });
  const actionMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'start' | 'stop' | 'restart' }) =>
      databaseAction(id, action),
    onSuccess: invalidate,
  });
  const backupMutation = useMutation({
    mutationFn: (id: string) => createDatabaseBackup(id),
    onSuccess: () => window.setTimeout(invalidate, 3000),
  });
  const restoreMutation = useMutation({
    mutationFn: ({ id, backupId }: { id: string; backupId: string }) =>
      restoreDatabaseBackup(id, backupId),
    onSuccess: () => window.setTimeout(invalidate, 3000),
  });

  const databases = isDemoMode ? demoDatabases : databasesQuery.data ?? [];

  return (
    <div>
      <SecondaryPageHeader
        title="Databases"
        description="Managed database services — connection info, runtime actions and backups"
      />
      <div className="w-full px-8 py-6">
        <div className="mb-5 flex items-center justify-between">
          <p className="text-xs text-[var(--text-tertiary)]">
            {databases.length} {databases.length === 1 ? 'database' : 'databases'}
          </p>
          {signedIn && !isDemoMode ? (
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--accent-primary)] px-4 text-[12.5px] font-semibold text-[var(--accent-on)]"
            >
              <Database size={13} /> New database
            </button>
          ) : null}
        </div>
        {databasesQuery.isLoading ? (
          <div className="flex items-center justify-center py-16 text-[var(--text-muted)]">
            <Loader2 size={20} className="animate-spin" />
          </div>
        ) : databases.length === 0 ? (
          <div className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-10 text-center">
            <Database size={28} className="mx-auto text-[var(--text-muted)]" />
            <p className="mt-3 text-sm text-[var(--text-secondary)]">No managed databases yet.</p>
            {signedIn ? (
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                className="mt-4 inline-flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--accent-primary)] px-4 py-2 text-[12.5px] font-semibold text-[var(--accent-on)]"
              >
                <Database size={13} /> Create your first database
              </button>
            ) : (
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                Sign in to provision a managed database.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {databases.map((db: DatabaseEntity) => {
              const expanded = expandedId === db.id;
              const running = db.status === 'running';
              const backups = db.backups?.backups ?? [];
              return (
                <div key={db.id} className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-void)]">
                  <button
                    onClick={() => setExpandedId(expanded ? null : (db.id ?? null))}
                    className="flex w-full items-center gap-3 p-4 text-left"
                  >
                    <div
                      className="w-9 h-9 rounded-[var(--radius-md)] flex items-center justify-center shrink-0"
                      style={{
                        background: `${serviceAccent({ name: db.type })}1c`,
                        color: serviceAccent({ name: db.type }),
                      }}
                    >
                      <ServiceIcon service={{ name: db.type, type: 'database' }} size={17} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-[var(--text-primary)]">{db.name}</span>
                        <span className="text-xs px-1.5 py-0.5 rounded bg-[var(--surface-muted)] text-[var(--text-secondary)] mono">{db.type}{db.version ? ` ${db.version}` : ''}</span>
                        {db.provider === 'external' && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-[var(--accent-primary-soft)] text-[var(--accent-primary)]">external</span>
                        )}
                        <span className={`text-xs px-1.5 py-0.5 rounded ${dbStatusClass[db.status ?? ''] ?? 'bg-[var(--surface-muted)] text-[var(--text-muted)]'}`}>{db.status}</span>
                      </div>
                      <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                        {db.provider === 'external' && db.external
                          ? `${db.external.host}:${db.external.port}${db.external.database ? ` · ${db.external.database}` : ''}`
                          : `${db.plan} · ${db.region}`}
                      </p>
                    </div>
                    <ChevronDown size={15} className={`shrink-0 text-[var(--text-muted)] transition-transform ${expanded ? 'rotate-180' : ''}`} />
                  </button>

                  {expanded && (
                    <div className="border-t border-[var(--border-subtle)] p-4 space-y-4">
                      <div>
                        <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">Connection URL</p>
                        <div className="flex items-center gap-2">
                          <code className="mono flex-1 truncate rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-3 py-2 text-xs text-[var(--text-primary)]">
                            {db.connection_url || '—'}
                          </code>
                          {db.connection_url && (
                            <button
                              onClick={() => void navigator.clipboard.writeText(db.connection_url ?? '')}
                              className="flex items-center gap-1 text-xs text-[var(--accent-primary)] hover:underline shrink-0"
                            >
                              <Copy size={11} /> Copy
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {signedIn ? (
                          <>
                        <span className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)] mr-1">Actions</span>
                        {db.provider === 'external' ? (
                          <>
                            <button
                              onClick={() => testByIdMutation.mutate(db.id ?? '')}
                              disabled={testByIdMutation.isPending}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-md)] border border-[var(--border-subtle)] text-xs font-medium text-[var(--text-secondary)] hover:border-[var(--border-default)] disabled:opacity-40 transition-colors"
                            >
                              <RefreshCw size={11} /> Test connection
                            </button>
                            {externalTestResult[db.id ?? ''] && (
                              <span className={`text-xs ${externalTestResult[db.id ?? '']?.ok ? 'text-[var(--success)]' : 'text-[var(--error)]'}`}>
                                {externalTestResult[db.id ?? '']?.ok
                                  ? `reachable (${externalTestResult[db.id ?? '']?.latency_ms ?? 0}ms)`
                                  : `unreachable — ${externalTestResult[db.id ?? '']?.error ?? 'probe failed'}`}
                              </span>
                            )}
                          </>
                        ) : (
                          <>
                        <button
                          onClick={() => actionMutation.mutate({ id: db.id ?? '', action: 'start' })}
                          disabled={running || actionMutation.isPending}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-md)] border border-[var(--border-subtle)] text-xs font-medium text-[var(--text-secondary)] hover:border-[var(--border-default)] disabled:opacity-40 transition-colors"
                        >
                          <Play size={11} /> Start
                        </button>
                        <button
                          onClick={() => actionMutation.mutate({ id: db.id ?? '', action: 'stop' })}
                          disabled={!running || actionMutation.isPending}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-md)] border border-[var(--border-subtle)] text-xs font-medium text-[var(--text-secondary)] hover:border-[var(--border-default)] disabled:opacity-40 transition-colors"
                        >
                          <Square size={11} /> Stop
                        </button>
                        <button
                          onClick={() => actionMutation.mutate({ id: db.id ?? '', action: 'restart' })}
                          disabled={!running || actionMutation.isPending}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-md)] border border-[var(--border-subtle)] text-xs font-medium text-[var(--text-secondary)] hover:border-[var(--border-default)] disabled:opacity-40 transition-colors"
                        >
                          <RefreshCw size={11} /> Restart
                        </button>
                        <button
                          onClick={() => { if (window.confirm(`${db.public_port ? 'Stop exposing' : 'Expose'} ${db.name} on all interfaces? The container will be recreated; data persists.`)) publicPortMutation.mutate({ id: db.id ?? '', publicPort: !db.public_port }) }}
                          disabled={publicPortMutation.isPending}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-md)] border text-xs font-medium transition-colors disabled:opacity-40 ${db.public_port ? 'border-[var(--warning)] text-[var(--warning)]' : 'border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--border-default)]'}`}
                        >
                          <Link2 size={11} /> {db.public_port ? 'Public ✓' : 'Local only'}
                        </button>
                          </>
                        )}
                        <button
                          onClick={() => setBindDb(bindDb?.id === db.id ? null : db)}
                          disabled={!db.connection_url}
                          title={db.connection_url ? 'Inject connection URL into a service' : 'No connection URL available'}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-md)] border border-[var(--border-subtle)] text-xs font-medium text-[var(--text-secondary)] hover:border-[var(--border-default)] disabled:opacity-40 transition-colors"
                        >
                          <Link2 size={11} /> Bind
                        </button>
                        {actionMutation.isError && (
                          <span className="text-xs text-[var(--error)]">
                            {actionMutation.error instanceof Error ? actionMutation.error.message : 'Action failed'}
                          </span>
                        )}
                          </>
                        ) : (
                          <span className="text-xs text-[var(--text-tertiary)]">Sign in to manage this database.</span>
                        )}
                      </div>

                      {bindDb?.id === db.id && db.connection_url && (
                        <BindDatabasePanel
                          connectionUrl={db.connection_url}
                          onClose={() => setBindDb(null)}
                        />
                      )}

                      {db.metrics && (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {([
                            ['CPU', `${db.metrics.cpu ?? 0}%`],
                            ['Memory', `${db.metrics.memory ?? 0}%`],
                            ['Storage', `${db.metrics.storage ?? 0}%`],
                            ['Connections', `${db.metrics.connections ?? 0}`],
                          ] as const).map(([label, value]) => (
                            <div key={label} className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-3 py-2">
                              <p className="text-xs text-[var(--text-muted)]">{label}</p>
                              <p className="mono text-sm text-[var(--text-primary)]">{value}</p>
                            </div>
                          ))}
                        </div>
                      )}

                      {db.provider !== 'external' && (
                      <div>
                        <div className="mb-2 flex items-center justify-between">
                          <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">Backups</p>
                          {signedIn ? (
                          <div className="flex items-center gap-2">
                            {(backupTargetsQuery.data?.length ?? 0) > 0 && (
                              <select
                                value={db.backup_target_id ?? ''}
                                onChange={(e) => backupTargetMutation.mutate({ id: db.id ?? '', targetId: e.target.value })}
                                title="Offsite archive destination"
                                className="h-7 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-2 text-xs text-[var(--text-secondary)]"
                              >
                                <option value="">local only</option>
                                {(backupTargetsQuery.data ?? []).map((t) => (
                                  <option key={t.id} value={t.id}>{t.name} ({t.bucket})</option>
                                ))}
                              </select>
                            )}
                          <label
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-md)] text-xs font-medium border border-[var(--border-subtle)] text-[var(--text-secondary)] transition-all ${importBackupMutation.isPending ? 'opacity-50' : 'cursor-pointer hover:text-[var(--text-primary)]'}`}
                            title="Import a .tar.gz archive as a restore point"
                          >
                            <Upload size={11} />
                            {importBackupMutation.isPending ? 'Importing…' : 'Import'}
                            <input
                              type="file"
                              accept=".tar.gz,application/gzip"
                              className="hidden"
                              disabled={importBackupMutation.isPending}
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) importBackupMutation.mutate({ id: db.id ?? '', file: f });
                                e.target.value = '';
                              }}
                            />
                          </label>
                          <button
                            onClick={() => backupMutation.mutate(db.id ?? '')}
                            disabled={!running || backupMutation.isPending}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-md)] text-xs font-medium text-[var(--accent-on)] disabled:opacity-40 transition-all"
                            style={{ background: 'var(--accent-primary)' }}
                          >
                            <Archive size={11} />
                            {backupMutation.isPending ? 'Starting…' : 'New backup'}
                          </button>
                          </div>
                          ) : null}
                        </div>
                        <BackupScheduleRow
                          databaseId={db.id ?? ''}
                          schedule={db.backup_schedule ?? ''}
                          nextBackupAt={db.next_backup_at}
                        />
                        {backups.length === 0 ? (
                          <p className="text-xs text-[var(--text-muted)]">No backups yet.</p>
                        ) : (
                          <div className="space-y-1.5">
                            {backups.map((b) => (
                              <div key={b.id} className="flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-3 py-2 text-xs">
                                <span className="text-[var(--text-secondary)]">{formatRelative(b.created_at)}</span>
                                <span className="mono text-[var(--text-muted)]">{b.size}</span>
                                <span className={`${b.status === 'completed' ? 'text-[var(--success)]' : b.status === 'in_progress' ? 'text-[var(--warning)]' : 'text-[var(--error)]'}`}>{b.status}</span>
                                {b.remote && <span className="rounded bg-[var(--surface-card)] px-1.5 py-0.5 text-[var(--accent-primary)]" title="Also shipped to the configured backup target">offsite</span>}
                                {b.status === 'completed' && (
                                  <span className="ml-auto flex items-center gap-3">
                                    <a
                                      href={`${getApiBaseUrl()}/databases/${encodeURIComponent(db.id ?? '')}/backups/${encodeURIComponent(b.id ?? '')}/download`}
                                      className="text-[var(--accent-primary)] hover:underline"
                                    >
                                      Download
                                    </a>
                                    <button
                                      onClick={() => { if (window.confirm(`Restore ${db.name} from this backup? Current data will be overwritten.`)) restoreMutation.mutate({ id: db.id ?? '', backupId: b.id ?? '' }); }}
                                      disabled={restoreMutation.isPending}
                                      className="text-[var(--accent-primary)] hover:underline disabled:opacity-40"
                                    >
                                      Restore
                                    </button>
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                        {restoreMutation.isError && (
                          <p className="mt-2 text-xs text-[var(--error)]">
                            {restoreMutation.error instanceof Error ? restoreMutation.error.message : 'Restore failed'}
                          </p>
                        )}
                      </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {createOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-base)] shadow-2xl">
            <div className="border-b border-[var(--border-subtle)] px-5 py-4">
              <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">New database</h2>
              <div className="mt-3 flex gap-1 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-1">
                {(['managed', 'external'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => { setCreateMode(mode); setCreateError(null); }}
                    className={`flex-1 rounded-[calc(var(--radius-md)-2px)] px-3 py-1.5 text-xs font-medium capitalize transition-colors ${createMode === mode ? 'bg-[var(--bg-base)] text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'}`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-[var(--text-tertiary)]">
                {createMode === 'managed' ? 'Provision a managed database service.' : 'Register a database hosted outside Containr.'}
              </p>
            </div>
            <div className="space-y-4 px-5 py-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">Name</label>
                <input
                  value={createMode === 'managed' ? createForm.name : externalForm.name}
                  onChange={(e) => (createMode === 'managed' ? setCreateForm((f) => ({ ...f, name: e.target.value })) : setExternalForm((f) => ({ ...f, name: e.target.value })))}
                  placeholder="my-postgres"
                  className="h-10 w-full rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-3 text-sm focus:border-[var(--accent-primary)]"
                />
              </div>
              {createMode === 'external' ? (
                <>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">Type</label>
                      <select
                        value={externalForm.type}
                        onChange={(e) => setExternalForm((f) => ({ ...f, type: e.target.value }))}
                        className="h-10 w-full rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-2 text-sm focus:border-[var(--accent-primary)]"
                      >
                        {DATABASE_TYPES.map((t) => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">Host</label>
                      <input
                        value={externalForm.host}
                        onChange={(e) => setExternalForm((f) => ({ ...f, host: e.target.value }))}
                        placeholder="db.example.com"
                        className="h-10 w-full rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-3 text-sm focus:border-[var(--accent-primary)]"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">Port</label>
                      <input
                        value={externalForm.port}
                        onChange={(e) => setExternalForm((f) => ({ ...f, port: e.target.value }))}
                        placeholder="default"
                        className="h-10 w-full rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-3 text-sm focus:border-[var(--accent-primary)]"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">Database</label>
                      <input
                        value={externalForm.database}
                        onChange={(e) => setExternalForm((f) => ({ ...f, database: e.target.value }))}
                        placeholder="optional"
                        className="h-10 w-full rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-3 text-sm focus:border-[var(--accent-primary)]"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">Username</label>
                      <input
                        value={externalForm.username}
                        onChange={(e) => setExternalForm((f) => ({ ...f, username: e.target.value }))}
                        placeholder="optional"
                        className="h-10 w-full rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-3 text-sm focus:border-[var(--accent-primary)]"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">Password</label>
                      <input
                        type="password"
                        value={externalForm.password}
                        onChange={(e) => setExternalForm((f) => ({ ...f, password: e.target.value }))}
                        placeholder="optional"
                        className="h-10 w-full rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-3 text-sm focus:border-[var(--accent-primary)]"
                      />
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                    <input
                      type="checkbox"
                      checked={externalForm.ssl}
                      onChange={(e) => setExternalForm((f) => ({ ...f, ssl: e.target.checked }))}
                      className="accent-[var(--accent-primary)]"
                    />
                    Require TLS/SSL
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => probeMutation.mutate()}
                      disabled={probeMutation.isPending || externalForm.host.trim().length === 0}
                      className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--border-subtle)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:border-[var(--border-default)] disabled:opacity-40"
                    >
                      {probeMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : null}
                      Test connection
                    </button>
                    {externalProbe && (
                      <span className={`text-xs ${externalProbe.ok ? 'text-[var(--success)]' : 'text-[var(--error)]'}`}>
                        {externalProbe.ok ? `reachable (${externalProbe.latency_ms ?? 0}ms)` : `unreachable — ${externalProbe.error ?? 'probe failed'}`}
                      </span>
                    )}
                  </div>
                </>
              ) : (
              <>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">Type</label>
                  <select
                    value={createForm.type}
                    onChange={(e) => setCreateForm((f) => ({ ...f, type: e.target.value }))}
                    className="h-10 w-full rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-2 text-sm focus:border-[var(--accent-primary)]"
                  >
                    {DATABASE_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">Plan</label>
                  <select
                    value={createForm.plan}
                    onChange={(e) => setCreateForm((f) => ({ ...f, plan: e.target.value }))}
                    className="h-10 w-full rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-2 text-sm focus:border-[var(--accent-primary)]"
                  >
                    {DATABASE_PLANS.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">Region</label>
                  <input
                    value={createForm.region}
                    onChange={(e) => setCreateForm((f) => ({ ...f, region: e.target.value }))}
                    placeholder="local"
                    className="h-10 w-full rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-3 text-sm focus:border-[var(--accent-primary)]"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                <input
                  type="checkbox"
                  checked={createForm.public}
                  onChange={(e) => setCreateForm((f) => ({ ...f, public: e.target.checked }))}
                  className="accent-[var(--accent-primary)]"
                />
                Expose port on all interfaces (default: localhost only)
              </label>
              </>
              )}
              {createError ? (
                <div className="rounded-[var(--radius-md)] bg-[var(--error-soft)] px-3.5 py-2.5 text-xs text-[var(--error)]">{createError}</div>
              ) : null}
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-[var(--border-subtle)] px-5 py-3.5">
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="rounded-[var(--radius-md)] px-3.5 py-2 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => (createMode === 'managed' ? createMutation.mutate() : registerExternalMutation.mutate())}
                disabled={
                  (createMode === 'managed' ? createMutation.isPending : registerExternalMutation.isPending) ||
                  (createMode === 'managed' ? createForm.name.trim().length === 0 : externalForm.name.trim().length === 0 || externalForm.host.trim().length === 0)
                }
                className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--accent-primary)] px-4 py-2 text-xs font-semibold text-[var(--accent-on)] disabled:opacity-50"
              >
                {(createMode === 'managed' ? createMutation.isPending : registerExternalMutation.isPending) ? <Loader2 size={13} className="animate-spin" /> : null}
                {createMode === 'managed' ? 'Create database' : 'Register database'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function BindDatabasePanel({
  connectionUrl,
  onClose,
}: {
  connectionUrl: string;
  onClose: () => void;
}) {
  const [projectId, setProjectId] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [varKey, setVarKey] = useState('DATABASE_URL');
  const [bound, setBound] = useState(false);

  const projectsQuery = useQuery({ queryKey: ['projects'], queryFn: () => listProjects() });
  const servicesQuery = useQuery({
    queryKey: ['services', projectId],
    queryFn: () => listServicesByProject(projectId),
    enabled: projectId !== '',
  });

  const bindMutation = useMutation({
    mutationFn: async () => {
      const existing = await listServiceVariables(serviceId);
      const merged = existing
        .filter((v) => v.key !== varKey)
        .map((v) => ({ key: v.key, value: v.value, is_secret: v.isSecret }));
      merged.push({ key: varKey, value: connectionUrl, is_secret: true });
      await updateServiceVariables(serviceId, merged);
    },
    onSuccess: () => setBound(true),
  });

  const services = servicesQuery.data ?? [];

  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-card)] p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-[var(--text-primary)]">Bind to service</p>
        <button onClick={onClose} className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]">Close</button>
      </div>
      <p className="text-xs text-[var(--text-muted)]">
        Injects this database's connection URL as an environment variable on the selected service.
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-xs text-[var(--text-muted)]">
          Project
          <select
            value={projectId}
            onChange={(e) => { setProjectId(e.target.value); setServiceId(''); }}
            className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-2 py-1.5 text-xs text-[var(--text-primary)]"
          >
            <option value="">Select…</option>
            {(projectsQuery.data ?? []).map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-[var(--text-muted)]">
          Service
          <select
            value={serviceId}
            onChange={(e) => setServiceId(e.target.value)}
            disabled={!projectId}
            className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-2 py-1.5 text-xs text-[var(--text-primary)] disabled:opacity-40"
          >
            <option value="">Select…</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-[var(--text-muted)]">
          Variable key
          <input
            value={varKey}
            onChange={(e) => setVarKey(e.target.value)}
            className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-2 py-1.5 text-xs mono text-[var(--text-primary)] w-40"
          />
        </label>
        <button
          onClick={() => bindMutation.mutate()}
          disabled={!serviceId || !varKey.trim() || bindMutation.isPending}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-md)] bg-[var(--accent-primary)] text-[var(--accent-on)] text-xs font-medium disabled:opacity-40"
        >
          {bindMutation.isPending ? <Loader2 size={11} className="animate-spin" /> : <Link2 size={11} />} Bind
        </button>
      </div>
      {bound && (
        <p className="text-xs text-[var(--success)]">
          Bound — {varKey} is set on the service. Redeploy the service for it to take effect.
        </p>
      )}
      {bindMutation.isError && (
        <p className="text-xs text-[var(--error)]">
          {bindMutation.error instanceof Error ? bindMutation.error.message : 'Bind failed'}
        </p>
      )}
    </div>
  );
}

function BackupScheduleRow({
  databaseId,
  schedule,
  nextBackupAt,
}: {
  databaseId: string;
  schedule: string;
  nextBackupAt?: string;
}) {
  const queryClient = useQueryClient();
  const [value, setValue] = useState(schedule);
  const mutation = useMutation({
    mutationFn: (expr: string) => updateDatabaseBackupSchedule(databaseId, expr),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['databases'] }),
  });

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="cron schedule, e.g. 0 3 * * *"
        className="w-44 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-2 py-1.5 text-xs mono text-[var(--text-primary)]"
      />
      <button
        onClick={() => mutation.mutate(value.trim())}
        disabled={mutation.isPending || value.trim() === schedule}
        className="px-2.5 py-1.5 rounded-[var(--radius-md)] border border-[var(--border-subtle)] text-xs text-[var(--text-secondary)] hover:border-[var(--border-default)] disabled:opacity-40"
      >
        {mutation.isPending ? 'Saving…' : 'Save schedule'}
      </button>
      {schedule && (
        <button
          onClick={() => { setValue(''); mutation.mutate(''); }}
          disabled={mutation.isPending}
          className="px-2.5 py-1.5 rounded-[var(--radius-md)] border border-[var(--border-subtle)] text-xs text-[var(--text-secondary)] hover:border-[var(--border-default)] disabled:opacity-40"
        >
          Disable
        </button>
      )}
      <span className="text-xs text-[var(--text-muted)]">
        {schedule ? `auto-backup ${schedule}${nextBackupAt ? ` — next ${formatRelative(nextBackupAt)}` : ''}` : 'manual only'}
      </span>
      {mutation.isError && (
        <span className="text-xs text-[var(--error)]">
          {mutation.error instanceof Error ? mutation.error.message : 'Failed to save schedule'}
        </span>
      )}
    </div>
  );
}

const failoverStrategies = [
  { value: 'active_passive', label: 'Active / passive' },
  { value: 'active_active', label: 'Active / active' },
  { value: 'graceful', label: 'Graceful' },
] as const;

export function HighAvailabilityPage() {
  const queryClient = useQueryClient();
  const isDemoMode = useDemoMode();
  const sessionQuery = useAuthSession({ enabled: !isDemoMode });
  const profileQuery = useQuery({
    queryKey: ['user-profile'],
    queryFn: getCurrentUserProfile,
    enabled: !isDemoMode && Boolean(sessionQuery.data),
    retry: false,
  });
  const isAdmin = !isDemoMode && Boolean(profileQuery.data?.isAdmin);
  const [failoverReason, setFailoverReason] = useState('');
  const [policyForm, setPolicyForm] = useState<{
    serviceId: string;
    strategy: string;
    minHealthyNodes: string;
    maxFailures: string;
    enabled: boolean;
    editing: boolean;
  } | null>(null);
  const [policyProjectId, setPolicyProjectId] = useState('');

  const statusQuery = useQuery({ queryKey: ['ha-status'], queryFn: getHAStatus, refetchInterval: 15_000, enabled: !isDemoMode });
  const policiesQuery = useQuery({ queryKey: ['ha-policies'], queryFn: listFailoverPolicies, enabled: !isDemoMode });
  const alertsQuery = useQuery({ queryKey: ['ha-alerts'], queryFn: listActiveAlerts, refetchInterval: 15_000, enabled: !isDemoMode });
  const healthQuery = useQuery({ queryKey: ['ha-health'], queryFn: listHealthResults, refetchInterval: 30_000, enabled: !isDemoMode });
  const projectsQuery = useQuery({ queryKey: ['projects'], queryFn: () => listProjects(), enabled: !isDemoMode });
  const servicesQuery = useQuery({
    queryKey: ['services', policyProjectId],
    queryFn: () => listServicesByProject(policyProjectId),
    enabled: Boolean(policyProjectId),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['ha-status'] });
    queryClient.invalidateQueries({ queryKey: ['ha-policies'] });
    queryClient.invalidateQueries({ queryKey: ['ha-alerts'] });
  };

  const toggleMutation = useMutation({
    mutationFn: (enabled: boolean) => setHAEnabled(enabled),
    onSuccess: invalidate,
  });
  const failoverMutation = useMutation({
    mutationFn: () => triggerFailover(failoverReason.trim()),
    onSuccess: () => { setFailoverReason(''); invalidate(); },
  });
  const savePolicyMutation = useMutation({
    mutationFn: async () => {
      if (!policyForm) return;
      await setFailoverPolicy({
        service_id: policyForm.serviceId,
        enabled: policyForm.enabled,
        failover_strategy: policyForm.strategy,
        min_healthy_nodes: Number(policyForm.minHealthyNodes) || 1,
        max_failures: Number(policyForm.maxFailures) || 3,
        failover_timeout: 30e9,
        recovery_timeout: 60e9,
      });
    },
    onSuccess: () => { setPolicyForm(null); invalidate(); },
  });
  const deletePolicyMutation = useMutation({
    mutationFn: (serviceId: string) => deleteFailoverPolicy(serviceId),
    onSuccess: invalidate,
  });
  const resolveMutation = useMutation({
    mutationFn: (alertId: string) => resolveAlert(alertId),
    onSuccess: invalidate,
  });

  const status = isDemoMode ? demoHAStatus : statusQuery.data;
  const alerts = isDemoMode ? demoHAAlerts : alertsQuery.data ?? [];
  const policies = isDemoMode ? demoHAPolicies : policiesQuery.data ?? [];
  const healthResults = isDemoMode ? demoHAHealthResults : healthQuery.data ?? [];
  const pageError =
    statusQuery.error ?? policiesQuery.error ?? alertsQuery.error ?? healthQuery.error ??
    toggleMutation.error ?? failoverMutation.error ?? savePolicyMutation.error ??
    deletePolicyMutation.error ?? resolveMutation.error;

  return (
    <div className="flex flex-col min-h-full">
      <SecondaryPageHeader
        title="High availability"
        description="Failover manager, policies, and active alerts"
      />
      <div className="p-8 space-y-8">
        <div className="flex items-center gap-2 text-xs text-[var(--text-tertiary)]">
          <ShieldCheck size={13} className="text-[var(--accent-primary)]" />
          <span>HA state feeds the platform security posture.</span>
          <Link to={isDemoMode ? '/security?demo=1' : '/security'} className="font-medium text-[var(--accent-primary)] hover:underline">
            Open Security →
          </Link>
        </div>
        {pageError && (
          <div className="rounded-[var(--radius-md)] border border-[var(--error)] bg-[var(--error)]/10 px-4 py-3 text-sm text-[var(--error)]">
            {pageError instanceof Error ? pageError.message : 'Request failed'}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Manager"
            value={status?.enabled ? 'Enabled' : 'Disabled'}
            description="HA manager state"
            icon={ShieldCheck}
            color={status?.enabled ? 'success' : 'default'}
          />
          <StatCard
            title="Nodes"
            value={`${status?.nodes?.healthy ?? 0}/${status?.nodes?.total ?? 0}`}
            description={`${status?.nodes?.unhealthy ?? 0} unhealthy`}
            icon={Server}
            color={status?.nodes?.unhealthy ? 'warning' : 'default'}
          />
          <StatCard
            title="Health checks"
            value={`${status?.health_checks?.healthy ?? 0}/${status?.health_checks?.total ?? 0}`}
            description={`${status?.health_checks?.unhealthy ?? 0} unhealthy`}
            icon={HeartPulse}
            color={status?.health_checks?.unhealthy ? 'warning' : 'default'}
          />
          <StatCard
            title="Active alerts"
            value={String(status?.alerts?.active ?? 0)}
            description="Firing right now"
            icon={AlertCircle}
            color={status?.alerts?.active ? 'error' : 'default'}
          />
        </div>

        {isAdmin ? (
        <div className="panel p-6">
          <div className="flex items-center gap-3 mb-4">
            <Zap size={18} className="text-[var(--accent-primary)]" />
            <h2 className="text-base font-semibold text-[var(--text-primary)]">Manager controls</h2>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <button
              type="button"
              disabled={toggleMutation.isPending || statusQuery.isLoading}
              onClick={() => toggleMutation.mutate(!status?.enabled)}
              className="px-4 py-2 rounded-[var(--radius-md)] bg-[var(--accent-primary)] text-[var(--accent-on)] text-sm font-medium disabled:opacity-50"
            >
              {status?.enabled ? 'Disable HA manager' : 'Enable HA manager'}
            </button>
            <div className="flex items-end gap-2">
              <div>
                <label className="block text-xs text-[var(--text-tertiary)] mb-1">Failover reason</label>
                <input
                  value={failoverReason}
                  onChange={(e) => setFailoverReason(e.target.value)}
                  placeholder="Manual failover"
                  className="px-3 py-2 rounded-[var(--radius-md)] bg-[var(--surface-muted)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)] w-56"
                />
              </div>
              <button
                type="button"
                disabled={failoverMutation.isPending}
                onClick={() => {
                  if (window.confirm('Trigger a platform failover now? Services may be rescheduled.')) {
                    failoverMutation.mutate();
                  }
                }}
                className="px-4 py-2 rounded-[var(--radius-md)] border border-[var(--warning)] text-sm text-[var(--warning)] disabled:opacity-50"
              >
                {failoverMutation.isPending ? 'Triggering…' : 'Trigger failover'}
              </button>
            </div>
          </div>
        </div>
        ) : null}

        <div className="panel p-6">
          <div className="flex items-center gap-3 mb-4">
            <AlertCircle size={18} className="text-[var(--accent-primary)]" />
            <h2 className="text-base font-semibold text-[var(--text-primary)]">Active alerts</h2>
          </div>
          {!isDemoMode && alertsQuery.isLoading ? (
            <p className="text-sm text-[var(--text-secondary)]">Loading…</p>
          ) : alerts.length === 0 ? (
            <p className="text-sm text-[var(--text-tertiary)]">No active alerts.</p>
          ) : (
            <div className="space-y-2">
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className="flex items-center justify-between rounded-[var(--radius-md)] border border-[var(--border-subtle)] px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm text-[var(--text-primary)] truncate">{alert.message ?? alert.id}</p>
                    <p className="text-xs text-[var(--text-tertiary)]">
                      {alert.severity ?? 'info'} · since {alert.starts_at ? formatRelative(alert.starts_at) : '—'}
                    </p>
                  </div>
                  {isAdmin ? (
                  <button
                    type="button"
                    disabled={resolveMutation.isPending}
                    onClick={() => alert.id && resolveMutation.mutate(alert.id)}
                    className="ml-4 shrink-0 px-3 py-1.5 rounded-[var(--radius-md)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] disabled:opacity-50"
                  >
                    Resolve
                  </button>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="panel p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <ShieldCheck size={18} className="text-[var(--accent-primary)]" />
              <h2 className="text-base font-semibold text-[var(--text-primary)]">Failover policies</h2>
            </div>
            {policyForm === null && isAdmin && (
              <button
                type="button"
                onClick={() => setPolicyForm({ serviceId: '', strategy: 'active_passive', minHealthyNodes: '1', maxFailures: '3', enabled: true, editing: false })}
                className="px-3 py-1.5 rounded-[var(--radius-md)] bg-[var(--accent-primary)] text-[var(--accent-on)] text-xs font-medium"
              >
                New policy
              </button>
            )}
          </div>

          {policyForm !== null && (
            <div className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] p-4 mb-4 space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                {policyForm.editing ? (
                  <div>
                    <label className="block text-xs text-[var(--text-tertiary)] mb-1">Service</label>
                    <p className="px-3 py-2 rounded-[var(--radius-md)] bg-[var(--surface-muted)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)] font-mono">
                      {policyForm.serviceId}
                    </p>
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="block text-xs text-[var(--text-tertiary)] mb-1">Project</label>
                      <select
                        value={policyProjectId}
                        onChange={(e) => { setPolicyProjectId(e.target.value); setPolicyForm({ ...policyForm, serviceId: '' }); }}
                        className="w-full px-3 py-2 rounded-[var(--radius-md)] bg-[var(--surface-muted)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)]"
                      >
                        <option value="">Select project…</option>
                        {(projectsQuery.data ?? []).map((p) => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-[var(--text-tertiary)] mb-1">Service</label>
                      <select
                        value={policyForm.serviceId}
                        onChange={(e) => setPolicyForm({ ...policyForm, serviceId: e.target.value })}
                        disabled={!policyProjectId}
                        className="w-full px-3 py-2 rounded-[var(--radius-md)] bg-[var(--surface-muted)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)] disabled:opacity-50"
                      >
                        <option value="">Select service…</option>
                        {(servicesQuery.data ?? []).map((s) => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    </div>
                  </>
                )}
                <div>
                  <label className="block text-xs text-[var(--text-tertiary)] mb-1">Strategy</label>
                  <select
                    value={policyForm.strategy}
                    onChange={(e) => setPolicyForm({ ...policyForm, strategy: e.target.value })}
                    className="w-full px-3 py-2 rounded-[var(--radius-md)] bg-[var(--surface-muted)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)]"
                  >
                    {failoverStrategies.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-[var(--text-tertiary)] mb-1">Min healthy nodes</label>
                    <input
                      type="number" min={1}
                      value={policyForm.minHealthyNodes}
                      onChange={(e) => setPolicyForm({ ...policyForm, minHealthyNodes: e.target.value })}
                      className="w-full px-3 py-2 rounded-[var(--radius-md)] bg-[var(--surface-muted)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[var(--text-tertiary)] mb-1">Max failures</label>
                    <input
                      type="number" min={1}
                      value={policyForm.maxFailures}
                      onChange={(e) => setPolicyForm({ ...policyForm, maxFailures: e.target.value })}
                      className="w-full px-3 py-2 rounded-[var(--radius-md)] bg-[var(--surface-muted)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)]"
                    />
                  </div>
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-[var(--text-primary)]">
                <input
                  type="checkbox"
                  checked={policyForm.enabled}
                  onChange={(e) => setPolicyForm({ ...policyForm, enabled: e.target.checked })}
                />
                Enabled
              </label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  disabled={savePolicyMutation.isPending || !policyForm.serviceId}
                  onClick={() => savePolicyMutation.mutate()}
                  className="px-4 py-2 rounded-[var(--radius-md)] bg-[var(--accent-primary)] text-[var(--accent-on)] text-sm font-medium disabled:opacity-50"
                >
                  {savePolicyMutation.isPending ? 'Saving…' : 'Save policy'}
                </button>
                <button
                  type="button"
                  onClick={() => setPolicyForm(null)}
                  className="px-4 py-2 rounded-[var(--radius-md)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)]"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {!isDemoMode && policiesQuery.isLoading ? (
            <p className="text-sm text-[var(--text-secondary)]">Loading…</p>
          ) : policies.length === 0 ? (
            <p className="text-sm text-[var(--text-tertiary)]">No failover policies configured.</p>
          ) : (
            <div className="space-y-2">
              {policies.map((policy: FailoverPolicy) => (
                <div
                  key={policy.service_id}
                  className="flex items-center justify-between rounded-[var(--radius-md)] border border-[var(--border-subtle)] px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[var(--text-primary)] font-mono truncate">{policy.service_id}</p>
                    <p className="text-xs text-[var(--text-tertiary)]">
                      {policy.enabled ? 'enabled' : 'disabled'} · {policy.failover_strategy ?? 'default'} ·
                      min nodes {policy.min_healthy_nodes ?? '—'} · max failures {policy.max_failures ?? '—'}
                    </p>
                  </div>
                  <div className="ml-4 flex items-center gap-2 shrink-0">
                    {isAdmin ? (
                    <>
                    <button
                      type="button"
                      onClick={() => setPolicyForm({
                        serviceId: policy.service_id ?? '',
                        strategy: policy.failover_strategy ?? 'active_passive',
                        minHealthyNodes: String(policy.min_healthy_nodes ?? 1),
                        maxFailures: String(policy.max_failures ?? 3),
                        enabled: policy.enabled ?? true,
                        editing: true,
                      })}
                      className="px-3 py-1.5 rounded-[var(--radius-md)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)]"
                    >
                      Edit
                    </button>
                    {policy.enabled && (
                      <button
                        type="button"
                        disabled={deletePolicyMutation.isPending}
                        onClick={() => {
                          if (window.confirm(`Disable failover for ${policy.service_id}?`)) {
                            deletePolicyMutation.mutate(policy.service_id ?? '');
                          }
                        }}
                        className="px-3 py-1.5 rounded-[var(--radius-md)] border border-[var(--error)] text-xs text-[var(--error)] disabled:opacity-50"
                      >
                        Disable
                      </button>
                    )}
                    </>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="panel p-6">
          <div className="flex items-center gap-3 mb-4">
            <HeartPulse size={18} className="text-[var(--accent-primary)]" />
            <h2 className="text-base font-semibold text-[var(--text-primary)]">Health check results</h2>
          </div>
          {!isDemoMode && healthQuery.isLoading ? (
            <p className="text-sm text-[var(--text-secondary)]">Loading…</p>
          ) : healthResults.length === 0 ? (
            <p className="text-sm text-[var(--text-tertiary)]">No health checks configured.</p>
          ) : (
            <div className="space-y-2">
              {healthResults.slice(0, 20).map((result, i) => (
                <div
                  key={`${result.check_id}-${i}`}
                  className="flex items-center justify-between rounded-[var(--radius-md)] border border-[var(--border-subtle)] px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm text-[var(--text-primary)] font-mono truncate">{result.check_id}</p>
                    <p className="text-xs text-[var(--text-tertiary)]">{result.message || '—'}</p>
                  </div>
                  <div className="ml-4 text-right shrink-0">
                    <p className={`text-xs font-medium ${result.status === 'healthy' ? 'text-[var(--success)]' : 'text-[var(--error)]'}`}>
                      {result.status ?? 'unknown'}
                    </p>
                    <p className="text-xs text-[var(--text-tertiary)]">
                      {result.timestamp ? formatRelative(result.timestamp) : ''}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const scanTypes = [
  { value: 'dependency', label: 'Dependency' },
  { value: 'configuration', label: 'Configuration' },
  { value: 'comprehensive', label: 'Comprehensive' },
] as const;

const severityColor: Record<string, string> = {
  critical: 'text-[var(--error)]',
  high: 'text-[var(--error)]',
  medium: 'text-[var(--warning)]',
  low: 'text-[var(--text-tertiary)]',
};

export function SecurityPage() {
  const queryClient = useQueryClient();
  const isDemoMode = useDemoMode();
  const sessionQuery = useAuthSession({ enabled: !isDemoMode });
  const signedIn = !isDemoMode && Boolean(sessionQuery.data);
  const [projectId, setProjectId] = useState(isDemoMode ? 'demo-project-core' : '');
  const [scanType, setScanType] = useState<string>('comprehensive');
  const [scanServiceId, setScanServiceId] = useState('');

  const projectsQuery = useQuery({ queryKey: ['projects'], queryFn: () => listProjects(), enabled: !isDemoMode });
  const projects = isDemoMode ? demoProjects : projectsQuery.data ?? [];
  const servicesQuery = useQuery({
    queryKey: ['services', projectId],
    queryFn: () => listServicesByProject(projectId),
    enabled: !isDemoMode && Boolean(projectId),
  });
  const services = isDemoMode ? getDemoServicesByProject(projectId) : servicesQuery.data ?? [];
  const metricsQuery = useQuery({
    queryKey: ['security-metrics', projectId],
    queryFn: () => getSecurityMetrics(projectId),
    enabled: !isDemoMode && Boolean(projectId),
    refetchInterval: 15_000,
  });
  const historyQuery = useQuery({
    queryKey: ['security-history', projectId],
    queryFn: () => getSecurityHistory(projectId),
    enabled: !isDemoMode && Boolean(projectId),
    refetchInterval: 15_000,
  });
  const vulnsQuery = useQuery({
    queryKey: ['security-vulns', projectId],
    queryFn: () => listVulnerabilities(projectId),
    enabled: !isDemoMode && Boolean(projectId),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['security-metrics', projectId] });
    queryClient.invalidateQueries({ queryKey: ['security-history', projectId] });
    queryClient.invalidateQueries({ queryKey: ['security-vulns', projectId] });
  };

  const scanMutation = useMutation({
    mutationFn: () => startSecurityScan({
      project_id: projectId,
      service_id: scanServiceId || undefined,
      scan_type: scanType as 'dependency' | 'configuration' | 'comprehensive',
    }),
    onSuccess: invalidate,
  });
  const vulnMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'open' | 'resolved' | 'ignored' }) =>
      updateVulnerability(id, status),
    onSuccess: invalidate,
  });

  const metrics = isDemoMode ? demoSecurityMetrics : metricsQuery.data;
  const scanHistory = isDemoMode
    ? demoSecurityScans.filter((s) => s.project_id === projectId)
    : historyQuery.data ?? [];
  const vulns = (isDemoMode
    ? demoVulnerabilities.filter((v) => v.project_id === projectId)
    : vulnsQuery.data ?? []
  ).filter((v) => v.status !== 'resolved');
  const pageError =
    projectsQuery.error ?? metricsQuery.error ?? historyQuery.error ?? vulnsQuery.error ??
    scanMutation.error ?? vulnMutation.error;

  return (
    <div className="flex flex-col min-h-full">
      <SecondaryPageHeader
        title="Security"
        description="Scan findings, security posture, and compliance status"
      />
      <div className="p-8 space-y-8">
        <div className="flex items-center gap-2 text-xs text-[var(--text-tertiary)]">
          <HeartPulse size={13} className="text-[var(--accent-primary)]" />
          <span>Platform availability and failover live under High availability.</span>
          <Link to={isDemoMode ? '/ha?demo=1' : '/ha'} className="font-medium text-[var(--accent-primary)] hover:underline">
            Open HA →
          </Link>
        </div>
        {pageError && (
          <div className="rounded-[var(--radius-md)] border border-[var(--error)] bg-[var(--error)]/10 px-4 py-3 text-sm text-[var(--error)]">
            {pageError instanceof Error ? pageError.message : 'Request failed'}
          </div>
        )}

        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs text-[var(--text-tertiary)] mb-1">Project</label>
            <select
              value={projectId}
              onChange={(e) => { setProjectId(e.target.value); setScanServiceId(''); }}
              className="px-3 py-2 rounded-[var(--radius-md)] bg-[var(--surface-muted)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)] w-56"
            >
              <option value="">Select project…</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          {projectId && (
            <>
              <div>
                <label className="block text-xs text-[var(--text-tertiary)] mb-1">Scan type</label>
                <select
                  value={scanType}
                  onChange={(e) => setScanType(e.target.value)}
                  className="px-3 py-2 rounded-[var(--radius-md)] bg-[var(--surface-muted)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)]"
                >
                  {scanTypes.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-[var(--text-tertiary)] mb-1">Service (optional)</label>
                <select
                  value={scanServiceId}
                  onChange={(e) => setScanServiceId(e.target.value)}
                  className="px-3 py-2 rounded-[var(--radius-md)] bg-[var(--surface-muted)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)]"
                >
                  <option value="">All services</option>
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              {signedIn ? (
              <button
                type="button"
                disabled={scanMutation.isPending}
                onClick={() => scanMutation.mutate()}
                className="px-4 py-2 rounded-[var(--radius-md)] bg-[var(--accent-primary)] text-[var(--accent-on)] text-sm font-medium disabled:opacity-50"
              >
                {scanMutation.isPending ? 'Starting…' : 'Run scan'}
              </button>
              ) : (
                <span className="self-end pb-2 text-xs text-[var(--text-tertiary)]">{isDemoMode ? 'Read-only in demo.' : 'Sign in to run scans.'}</span>
              )}
            </>
          )}
        </div>

        {projectId && metrics && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Security score"
              value={String(metrics.security_score ?? '—')}
              description={metrics.latest_scan?.status === 'never_scanned' ? 'Never scanned' : `Latest scan: ${metrics.latest_scan?.status ?? '—'}`}
              icon={Shield}
              color={(metrics.security_score ?? 100) < 70 ? 'error' : (metrics.security_score ?? 100) < 90 ? 'warning' : 'success'}
            />
            <StatCard
              title="Open findings"
              value={String(metrics.vulnerabilities?.open ?? 0)}
              description={`${metrics.vulnerabilities?.critical ?? 0} critical · ${metrics.vulnerabilities?.high ?? 0} high`}
              icon={AlertCircle}
              color={metrics.vulnerabilities?.critical ? 'error' : metrics.vulnerabilities?.open ? 'warning' : 'default'}
            />
            <StatCard
              title="Resolved"
              value={String(metrics.vulnerabilities?.resolved ?? 0)}
              description="Closed findings"
              icon={Check}
            />
            <StatCard
              title="Compliance"
              value={metrics.compliance?.overall_status === 'not_assessed' ? '—' : `${metrics.compliance?.score ?? 0}%`}
              description={metrics.compliance?.overall_status ?? 'not assessed'}
              icon={FileText}
            />
          </div>
        )}

        {projectId && (
          <div className="panel p-6">
            <div className="flex items-center gap-3 mb-4">
              <Shield size={18} className="text-[var(--accent-primary)]" />
              <h2 className="text-base font-semibold text-[var(--text-primary)]">Findings</h2>
            </div>
            {!isDemoMode && vulnsQuery.isLoading ? (
              <p className="text-sm text-[var(--text-secondary)]">Loading…</p>
            ) : vulns.length === 0 ? (
              <p className="text-sm text-[var(--text-tertiary)]">No open findings.</p>
            ) : (
              <div className="space-y-2">
                {vulns.map((v) => (
                  <div
                    key={v.id}
                    className="flex items-start justify-between rounded-[var(--radius-md)] border border-[var(--border-subtle)] px-4 py-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-semibold uppercase ${severityColor[v.severity ?? ''] ?? 'text-[var(--text-tertiary)]'}`}>
                          {v.severity}
                        </span>
                        <p className="text-sm font-medium text-[var(--text-primary)] truncate">{v.title}</p>
                      </div>
                      <p className="text-xs text-[var(--text-tertiary)] mt-0.5">{v.description}</p>
                      <p className="text-xs text-[var(--text-muted)] mt-1">
                        {v.type} · {v.status} · found {v.found_at ? formatRelative(v.found_at) : '—'}
                      </p>
                    </div>
                    {v.status === 'open' && v.id && signedIn && (
                      <div className="ml-4 flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          disabled={vulnMutation.isPending}
                          onClick={() => vulnMutation.mutate({ id: v.id!, status: 'resolved' })}
                          className="px-3 py-1.5 rounded-[var(--radius-md)] border border-[var(--success)] text-xs text-[var(--success)] disabled:opacity-50"
                        >
                          Resolve
                        </button>
                        <button
                          type="button"
                          disabled={vulnMutation.isPending}
                          onClick={() => vulnMutation.mutate({ id: v.id!, status: 'ignored' })}
                          className="px-3 py-1.5 rounded-[var(--radius-md)] border border-[var(--border-subtle)] text-xs text-[var(--text-secondary)] disabled:opacity-50"
                        >
                          Ignore
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {projectId && (
          <div className="panel p-6">
            <div className="flex items-center gap-3 mb-4">
              <Clock size={18} className="text-[var(--accent-primary)]" />
              <h2 className="text-base font-semibold text-[var(--text-primary)]">Scan history</h2>
            </div>
            {!isDemoMode && historyQuery.isLoading ? (
              <p className="text-sm text-[var(--text-secondary)]">Loading…</p>
            ) : scanHistory.length === 0 ? (
              <p className="text-sm text-[var(--text-tertiary)]">No scans yet.</p>
            ) : (
              <div className="space-y-2">
                {scanHistory.map((scan) => (
                  <div
                    key={scan.id}
                    className="flex items-center justify-between rounded-[var(--radius-md)] border border-[var(--border-subtle)] px-4 py-3"
                  >
                    <div>
                      <p className="text-sm text-[var(--text-primary)]">
                        {scan.scan_type} · {scan.findings_count ?? 0} findings
                      </p>
                      <p className="text-xs text-[var(--text-tertiary)]">
                        {scan.started_at ? formatRelative(scan.started_at) : '—'}
                      </p>
                    </div>
                    <span className={`text-xs font-medium ${
                      scan.status === 'completed' ? 'text-[var(--success)]'
                      : scan.status === 'failed' ? 'text-[var(--error)]'
                      : 'text-[var(--warning)]'
                    }`}>
                      {scan.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
