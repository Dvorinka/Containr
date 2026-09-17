import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
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
  listTemplates,
  updateCurrentUserProfile,
} from '@/lib/api-client';
import { getAuthBaseUrl, signOutAuthSession } from '@/lib/auth-client';
import { useBuildUpdates } from '@/lib/use-build-updates';
import { EnhancedMetricCard, LineAreaChart, DonutChart, SegmentedBar, BarChart } from '@/shared/components';
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
  BookOpen,
  Folder,
  Box,
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
  const buildsQuery = useQuery({
    queryKey: ['usage-builds'],
    queryFn: () => listBuilds({ page: 1, limit: 100 }),
  });
  const hostQuery = useQuery({
    queryKey: ['usage-host-monitoring'],
    queryFn: getHostMonitoring,
    refetchInterval: 15_000,
  });
  const agentsQuery = useQuery({
    queryKey: ['usage-agents'],
    queryFn: listAgents,
    refetchInterval: 15_000,
  });

  const builds = buildsQuery.data?.builds ?? [];
  const liveStatus = useBuildUpdates(
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
  const host = hostQuery.data;
  const agents = agentsQuery.data ?? [];

  // Accumulate host samples for the load sparkline (polled every 15s).
  const [loadHistory, setLoadHistory] = useState<number[]>([]);
  useEffect(() => {
    const sample = hostQuery.data;
    if (!sample || sample.cpu.cores <= 0) {
      return;
    }
    const loadPercent = Math.min(100, (sample.load.load1m / sample.cpu.cores) * 100);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- accumulating polled samples is a legitimate sync-to-external pattern
    setLoadHistory((prev) => [...prev, loadPercent].slice(-24));
  }, [hostQuery.data]);

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
    const timestamps = (buildsQuery.data?.builds ?? [])
      .map((build) => new Date((build.startedAt ?? build.completedAt) as string).getTime())
      .filter((t) => Number.isFinite(t));
    if (timestamps.length === 0) {
      return counts;
    }
    const anchor = Math.max(...timestamps);
    (buildsQuery.data?.builds ?? []).forEach((build) => {
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
  }, [buildsQuery.data]);
  const onlineAgents = agents.filter((agent) => agent.status === 'online' || agent.status === 'connecting').length;
  const totalAgentMemory = agents.reduce((sum, agent) => sum + agent.resources.memory.total, 0);
  const availableAgentMemory = agents.reduce((sum, agent) => sum + agent.resources.memory.available, 0);
  const agentEndpoint = getAgentPublicBaseUrl();
  const connectCommand = `CONTAINR_API_URL=${getApiBaseUrl().replace(/\/api\/v1$/, '')} \\
CONTAINR_AGENT_AUTH_TOKEN=<token> \\
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

              {hostQuery.isError ? (
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
                    chart={<LineAreaChart data={loadHistory.length > 0 ? loadHistory : [0]} color="#b4e34a" height={72} />}
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
                        <DonutChart percentage={host?.memory.usagePercent ?? 0} color="#f2c94c" size={150} thickness={14} />
                        <div className="absolute inset-x-0 bottom-0 text-center">
                          <div className="text-[10px] uppercase tracking-wide text-[#6b6e7d]">Used</div>
                          <div className="text-sm font-bold text-[#e8e9f0]">
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
                            { width: host?.storage.usagePercent ?? 0, color: '#ff8a5c' },
                            { width: Math.max(2, 100 - (host?.storage.usagePercent ?? 0)), color: 'rgba(255,255,255,0.07)' },
                          ]}
                          height={18}
                        />
                        <div className="mt-3 flex items-center gap-4 text-xs text-[#6b6e7d]">
                          <span><span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ background: '#ff8a5c' }} />{host ? `${formatBytes(host.storage.used)} used` : '—'}</span>
                          <span><span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-white/10" />{host ? `${formatBytes(host.storage.available)} free` : '—'}</span>
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
                  <pre className="mono text-xs text-[var(--text-secondary)] whitespace-pre-wrap">{connectCommand}</pre>
                  <div className="mt-4 space-y-2 text-xs text-[var(--text-tertiary)]">
                    <p>Agent endpoint: <span className="mono text-[var(--text-primary)]">{agentEndpoint}</span></p>
                    <p>Set <span className="mono text-[var(--text-primary)]">CONTAINR_AGENT_AUTH_TOKEN</span> to a value accepted by the backend.</p>
                    <p>Agent sends host resources, polls pending Docker commands, and reports command results.</p>
                  </div>
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
  const profileQuery = useQuery({
    queryKey: ['user-profile'],
    queryFn: getCurrentUserProfile,
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
  const providersQuery = useQuery({
    queryKey: ['git-providers'],
    queryFn: listGitProviders,
  });

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
        <button
          onClick={() => setFormOpen((open) => !open)}
          className="flex items-center gap-2 h-9 px-4 rounded-[var(--radius-md)] text-[var(--accent-on)] text-sm font-medium shadow-lg transition-all"
          style={{ background: 'var(--accent-primary)' }}
        >
          <Link2 size={14} />
          {formOpen ? 'Close' : 'Connect'}
        </button>
      </div>

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
      <div className="w-full px-8 py-6">
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
                <p className="mono text-xs text-[var(--text-primary)]">app/frontend/src/generated/api-types.ts</p>
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
                <p className="mono text-xs text-[var(--text-primary)]">docs/references/dashboard.png • projects.png</p>
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
npm --prefix app/frontend run generate:api

# Frontend type-check + build
npm --prefix app/frontend run build:check

# Backend API tests
cd app/backend && go test ./internal/api/...

# Build remote node agent
cd app/backend && go build -o bin/containr-agent ./cmd/agent`}
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
