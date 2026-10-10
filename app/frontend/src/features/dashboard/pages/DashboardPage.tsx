import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueries, useQuery } from '@tanstack/react-query';
import {
  CartesianGrid,
  Line,
  LineChart as RechartsLineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AlertTriangle,
  Cpu,
  FolderKanban,
  HardDrive,
  MemoryStick,
  RefreshCw,
  Rocket,
  Server,
  Settings,
} from 'lucide-react';
import {
  getAgentMetrics,
  getHostMonitoring,
  listActiveAlerts,
  listAgents,
  listProjects,
  listRecentDeployments,
  type AgentMetricPoint,
  type NodeAgentEntity,
} from '@/lib/api-client';
import { useAuthSession } from '@/lib/use-auth-session';
import { useDemoMode } from '@/lib/demo-mode';
import { demoHostMonitoring, demoProjects } from '@/lib/demo-data';
import {
  GhostBtn,
  IconBtn,
  MiniBars,
  SAnomaly,
  SCard,
  SLegend,
  SPageHead,
  SPill,
  STable,
  SStat,
  Ticks,
  type SCol,
} from '@/shared/components/sentry';
import { statusTone } from '@/shared/components/sentry-utils';
import { QuietBtn } from '@/shared/components/sentry';


/* ------------------------------------------------------------------ */
/* Demo fixtures — deterministic, clearly sample data.                 */
/* ------------------------------------------------------------------ */

const demoAgents: NodeAgentEntity[] = [
  {
    id: 'demo-node-1',
    name: 'core-01',
    hostname: 'core-01.containr.local',
    ipAddress: '10.0.1.11',
    port: 9090,
    status: 'online',
    version: '0.9.2',
    capabilities: {
      containerRuntimes: ['docker'],
      supportedArchitectures: ['amd64'],
      maxContainers: 64,
      storageDriver: 'overlay2',
      networkPlugins: ['bridge'],
      features: [],
    },
    resources: {
      cpu: { cores: 8, allocation: 8, usage: 2.6 },
      memory: { total: 16_662_000_000, allocated: 0, used: 9_832_000_000, available: 6_830_000_000 },
      storage: { total: 240_000_000_000, allocated: 0, used: 141_000_000_000, available: 99_000_000_000 },
    },
    autoPrune: true,
    schedulable: true,
    tags: ['prod'],
    metadata: {},
    lastHeartbeat: new Date(Date.now() - 42_000).toISOString(),
  },
  {
    id: 'demo-node-2',
    name: 'edge-01',
    hostname: 'edge-01.containr.local',
    ipAddress: '10.0.2.4',
    port: 9090,
    status: 'degraded',
    version: '0.9.2',
    capabilities: {
      containerRuntimes: ['docker'],
      supportedArchitectures: ['arm64'],
      maxContainers: 32,
      storageDriver: 'overlay2',
      networkPlugins: ['bridge'],
      features: [],
    },
    resources: {
      cpu: { cores: 4, allocation: 4, usage: 3.4 },
      memory: { total: 8_290_000_000, allocated: 0, used: 7_110_000_000, available: 1_180_000_000 },
      storage: { total: 120_000_000_000, allocated: 0, used: 98_000_000_000, available: 22_000_000_000 },
    },
    autoPrune: false,
    schedulable: true,
    tags: ['edge'],
    metadata: {},
    lastHeartbeat: new Date(Date.now() - 610_000).toISOString(),
  },
];

/* Deterministic pseudo metric series for demo mode (sine + wobble). */
function demoMetricSeries(seed: number, points = 48): AgentMetricPoint[] {
  const now = Date.now();
  return Array.from({ length: points }, (_, i) => {
    const t = now - (points - 1 - i) * 30 * 60_000;
    const wave = Math.sin(i / 5.5 + seed) * 14 + Math.sin(i / 2.3 + seed * 2) * 6;
    const cpu = Math.max(4, Math.min(96, 42 + wave + seed * 9));
    const mem = Math.max(20, Math.min(95, 55 + wave / 2 + seed * 6));
    return {
      timestamp: new Date(t).toISOString(),
      cpu: { usage: cpu, usage_percent: cpu, cores: 8 },
      memory: { usage: mem, usage_percent: mem, limit: 100, available: 100 - mem },
      system_load: { load_1m: cpu / 12, load_5m: cpu / 14, load_15m: cpu / 16 },
      container_count: 12 + seed * 5,
    };
  });
}

const demoDeployRows = [
  { id: 'd1', serviceId: 's1', serviceName: 'api-gateway', projectName: 'Core Platform', status: 'deployed', imageName: undefined, startedAt: new Date(Date.now() - 240_000).toISOString(), completedAt: undefined, createdAt: '' },
  { id: 'd2', serviceId: 's2', serviceName: 'web-frontend', projectName: 'Core Platform', status: 'building', imageName: undefined, startedAt: new Date(Date.now() - 390_000).toISOString(), completedAt: undefined, createdAt: '' },
  { id: 'd3', serviceId: 's3', serviceName: 'batch-evaluator', projectName: 'Inference Lab', status: 'failed', imageName: undefined, startedAt: new Date(Date.now() - 3_900_000).toISOString(), completedAt: undefined, createdAt: '' },
  { id: 'd4', serviceId: 's4', serviceName: 'marketing-site', projectName: 'Growth Surface', status: 'deployed', imageName: undefined, startedAt: new Date(Date.now() - 7_400_000).toISOString(), completedAt: undefined, createdAt: '' },
];

/* ------------------------------------------------------------------ */

const SERIES_COLORS = ['#38bdf8', '#1cd8ec', '#a271d9', '#45e896'];
const MAX_CHART_AGENTS = 4;

type RangeKey = '1h' | '24h' | '7d';

function formatRelative(date?: string): string {
  if (!date) return '—';
  const diff = Date.now() - new Date(date).getTime();
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

const fmtGB = (v: number) => `${(v / (1024 * 1024 * 1024)).toFixed(0)}G`;
const pct = (used: number, total: number) => (total > 0 ? Math.round((used / total) * 100) : 0);

/* Merge per-agent metric arrays into recharts rows keyed by index. */
function mergeSeries(seriesList: { key: string; points: AgentMetricPoint[] }[]) {
  const len = Math.max(...seriesList.map((s) => s.points.length), 0);
  return Array.from({ length: len }, (_, i) => {
    const row: Record<string, number | string> = {};
    seriesList.forEach((s) => {
      const p = s.points[Math.min(i, s.points.length - 1)];
      if (p) {
        row.t = row.t ?? new Date(p.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        row[s.key] = Math.round(p.cpu.usage_percent * 10) / 10;
      }
    });
    return row;
  });
}

function ChartTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="s-tip">
      <div className="s-tip-t">{label}</div>
      {payload.map((p) => (
        <div key={p.name} className="s-tip-r">
          <span><i style={{ background: p.color }} />{p.name}</span>
          <b>{p.value}<small>%</small></b>
        </div>
      ))}
    </div>
  );
}

export function DashboardPage() {
  const navigate = useNavigate();
  const isDemoMode = useDemoMode();
  const sessionQuery = useAuthSession({ enabled: !isDemoMode });
  const signedIn = isDemoMode || Boolean(sessionQuery.data);
  const userName = sessionQuery.data?.user.name;
  const firstName = isDemoMode ? 'Operator' : userName?.split(' ')[0];
  const [range, setRange] = useState<RangeKey>('24h');

  const projectsQuery = useQuery({
    queryKey: ['projects'],
    enabled: !isDemoMode,
    queryFn: () => listProjects(),
  });
  const hostQuery = useQuery({
    queryKey: ['host-monitoring'],
    enabled: !isDemoMode,
    queryFn: getHostMonitoring,
    refetchInterval: 30_000,
  });
  // Agents are admin-scoped; failures collapse to an empty list, never an error state.
  const agentsQuery = useQuery({
    queryKey: ['agents'],
    enabled: !isDemoMode && signedIn,
    queryFn: listAgents,
    retry: false,
    staleTime: 30_000,
  });
  const deploysQuery = useQuery({
    queryKey: ['recent-deploys', 50],
    enabled: !isDemoMode,
    queryFn: () => listRecentDeployments(50),
    refetchInterval: 30_000,
  });
  const alertsQuery = useQuery({
    queryKey: ['ha-alerts'],
    enabled: !isDemoMode && signedIn,
    queryFn: listActiveAlerts,
    retry: false,
  });

  const projects = isDemoMode ? demoProjects : projectsQuery.data ?? [];
  const host = isDemoMode ? demoHostMonitoring : hostQuery.data;
  const agents = isDemoMode ? demoAgents : agentsQuery.data ?? [];
  const deployments = isDemoMode ? demoDeployRows : deploysQuery.data ?? [];
  const alerts = isDemoMode ? [{ id: 'a1', severity: 'warning' as const, message: 'Disk I/O spikes at 03:22' }] : alertsQuery.data ?? [];

  const chartAgents = agents.slice(0, MAX_CHART_AGENTS);
  const metricQueries = useQueries({
    queries: chartAgents.map((a) => ({
      queryKey: ['agent-metrics', a.id, range],
      queryFn: () => getAgentMetrics(a.id, range),
      enabled: !isDemoMode && agents.length > 0,
      staleTime: 60_000,
      retry: false,
    })),
  });

  /* Series: real per-agent CPU%; demo synth; empty otherwise.
     Plain computation — the compiler memoizes it. */
  const seriesList = chartAgents.map((a, i) => ({
    key: a.name || a.hostname || `node-${i + 1}`,
    points: isDemoMode ? demoMetricSeries(i + 1) : metricQueries[i]?.data ?? [],
  }));
  const chartData = {
    rows: mergeSeries(seriesList),
    series: seriesList.map((s, i) => ({ key: s.key, color: SERIES_COLORS[i % SERIES_COLORS.length] })),
    hasData: seriesList.some((s) => s.points.length > 1),
  };

  const hostLabel = host?.scope === 'docker-desktop-vm' ? 'VM' : 'Host';
  const cpuPct = host && host.cpu.cores > 0
    ? Math.min(100, Math.round((host.load.load1m / host.cpu.cores) * 100))
    : null;
  const memPct = host ? Math.round(host.memory.usagePercent) : null;
  const diskPct = host ? Math.round(host.storage.usagePercent) : null;

  const totalServices = projects.reduce((sum, p) => sum + p.stats.service_count, 0);
  const runningServices = projects.reduce((sum, p) => sum + p.stats.running_services, 0);
  const onlineAgents = agents.filter((a) => a.status === 'online').length;
  const succeeded = deployments.filter((d) => !['failed', 'error'].includes((d.status ?? '').toLowerCase())).length;

  const anomalies = [
    ...(diskPct !== null && diskPct > 85 ? [`Disk usage at ${diskPct}% — prune images or expand volume`] : []),
    ...(memPct !== null && memPct > 85 ? [`Memory pressure at ${memPct}% — rebalance services`] : []),
    ...alerts.slice(0, 3).map((a) => a.message).filter((m): m is string => Boolean(m)),
    ...(deployments.some((d) => (d.status ?? '').toLowerCase() === 'failed')
      ? [`${deployments.filter((d) => (d.status ?? '').toLowerCase() === 'failed').length} failed deployment${deployments.filter((d) => (d.status ?? '').toLowerCase() === 'failed').length > 1 ? 's' : ''} in the feed`]
      : []),
  ];

  const statDefs = [
    {
      icon: <Server size={13.5} />,
      label: 'Active Nodes',
      value: agents.length > 0 ? onlineAgents : host?.dockerAvailable ? 1 : '—',
      unit: agents.length > 0 ? `of ${agents.length}` : 'local',
      ticks: null,
      foot: agents.length > 0 ? `${agents.length - onlineAgents} offline or degraded` : 'single-host install',
      delta: undefined,
    },
    {
      icon: <Cpu size={13.5} />,
      label: `${hostLabel} CPU`,
      value: cpuPct ?? '—',
      unit: cpuPct !== null ? '%' : undefined,
      ticks: cpuPct,
      foot: host ? `${host.cpu.cores} cores · load avg` : 'no telemetry',
      delta: undefined,
    },
    {
      icon: <MemoryStick size={13.5} />,
      label: 'Memory Usage',
      value: memPct ?? '—',
      unit: memPct !== null ? '%' : undefined,
      ticks: memPct,
      foot: host ? `${fmtGB(host.memory.used)} / ${fmtGB(host.memory.total)} used` : 'no telemetry',
      delta: undefined,
    },
    {
      icon: <Rocket size={13.5} />,
      label: 'Deployments',
      value: deployments.length,
      unit: 'recent',
      ticks: null,
      foot: `${succeeded} succeeded`,
      delta: deployments.length > 0 ? { dir: 'up' as const, text: `+${deployments.length}` } : undefined,
    },
  ];

  type NodeRow = {
    id: string;
    name: string;
    address: string;
    status: string;
    cpu: number | null;
    mem: number | null;
    disk: number | null;
    containers: string;
    heartbeat: string;
  };

  const nodeRows: NodeRow[] = agents.length > 0
    ? agents.map((a) => ({
        id: a.id,
        name: a.name || a.hostname,
        address: `${a.ipAddress}${a.port ? `:${a.port}` : ''}`,
        status: a.status,
        cpu: a.resources.cpu.cores > 0 ? Math.round((a.resources.cpu.usage / a.resources.cpu.cores) * 100) : null,
        mem: pct(a.resources.memory.used, a.resources.memory.total),
        disk: pct(a.resources.storage.used, a.resources.storage.total),
        containers: String(a.capabilities.maxContainers ? `≤${a.capabilities.maxContainers}` : '—'),
        heartbeat: formatRelative(a.lastHeartbeat),
      }))
    : host
      ? [{
          id: 'local',
          name: host.hostname || 'local host',
          address: `${host.os}/${host.architecture}`,
          status: host.dockerAvailable ? 'online' : 'degraded',
          cpu: cpuPct,
          mem: memPct,
          disk: diskPct,
          containers: host.docker?.containers !== undefined ? String(host.docker.containers) : '—',
          heartbeat: 'live',
        }]
      : [];

  const metricCell = (v: number | null) =>
    v === null ? <span className="text-[var(--text-muted)]">—</span> : (
      <span className="inline-flex items-center gap-2">
        <MiniBars tone={v > 85 ? 'var(--error)' : v > 70 ? 'var(--warning)' : 'var(--accent-primary)'} />
        <span className="text-[12.5px] font-medium text-[var(--text-primary)]">{v}<small className="text-[var(--text-tertiary)] font-normal">%</small></span>
      </span>
    );

  const nodeCols: SCol<NodeRow>[] = [
    { key: 'name', label: 'Node', width: '1.7fr', sortValue: (r) => r.name,
      render: (r) => <span className="text-[var(--text-primary)] font-medium">{r.name}</span> },
    { key: 'address', label: 'Address', width: '1.15fr', sortValue: (r) => r.address,
      render: (r) => <span className="v-mono text-[11.5px] text-[var(--text-secondary)]">{r.address}</span> },
    { key: 'status', label: 'Status', width: '0.85fr', sortValue: (r) => r.status,
      render: (r) => <SPill tone={statusTone(r.status)}>{r.status}</SPill> },
    { key: 'cpu', label: 'CPU', width: '0.9fr', sortValue: (r) => r.cpu ?? -1, render: (r) => metricCell(r.cpu) },
    { key: 'mem', label: 'Memory', width: '0.9fr', sortValue: (r) => r.mem ?? -1, render: (r) => metricCell(r.mem) },
    { key: 'disk', label: 'Disk', width: '0.9fr', sortValue: (r) => r.disk ?? -1, render: (r) => metricCell(r.disk) },
    { key: 'containers', label: 'Capacity', width: '0.8fr', sortable: false,
      render: (r) => <span className="v-mono text-[11.5px] text-[var(--text-secondary)]">{r.containers}</span> },
    { key: 'heartbeat', label: 'Heartbeat', width: '0.8fr', sortable: false,
      render: (r) => <span className="v-mono text-[11.5px] text-[var(--text-tertiary)]">{r.heartbeat}</span> },
  ];

  type DeployRow = { id: string; service: string; project: string; status: string; when: string };
  const deployRows: DeployRow[] = deployments.slice(0, 7).map((d) => ({
    id: d.id,
    service: d.serviceName || d.imageName || d.serviceId || d.id,
    project: d.projectName || '—',
    status: d.status || 'queued',
    when: formatRelative(d.startedAt ?? d.completedAt ?? d.createdAt),
  }));

  const deployCols: SCol<DeployRow>[] = [
    { key: 'service', label: 'Service', width: '1.6fr', sortValue: (r) => r.service,
      render: (r) => (
        <span className="text-[var(--text-primary)] font-medium">
          {r.service}
          <span className="v-mono ml-2 text-[10.5px] font-normal text-[var(--text-tertiary)]">{r.project}</span>
        </span>
      ) },
    { key: 'status', label: 'Status', width: '0.9fr', sortValue: (r) => r.status,
      render: (r) => <SPill tone={statusTone(r.status)}>{r.status}</SPill> },
    { key: 'when', label: 'When', width: '0.55fr', sortable: false,
      render: (r) => <span className="v-mono text-[11.5px] text-[var(--text-tertiary)]">{r.when}</span> },
  ];

  const refetchAll = () => {
    projectsQuery.refetch();
    hostQuery.refetch();
    deploysQuery.refetch();
    agentsQuery.refetch();
    alertsQuery.refetch();
    metricQueries.forEach((q) => q.refetch());
  };

  return (
    <div className="min-h-screen">
      <div className="w-full px-4 py-6 sm:px-7">
        <SPageHead
          title={firstName ? 'Welcome back,' : 'Fleet'}
          titleAccent={firstName ?? 'overview'}
          sub={
            <>
              {String(runningServices).padStart(2, '0')} of {String(totalServices).padStart(2, '0')} services online ·{' '}
            </>
          }
          subAccent={agents.length > 0 ? `${onlineAgents}/${agents.length} nodes live` : 'single host'}
          actions={
            <>
              {signedIn && (
                <GhostBtn onClick={() => navigate('/projects')}>+ New Project</GhostBtn>
              )}
              <QuietBtn onClick={() => navigate('/operations')}>
                <AlertTriangle size={13} />
                View alerts
              </QuietBtn>
              <IconBtn title="Refresh" onClick={refetchAll}>
                <RefreshCw size={14} />
              </IconBtn>
              <IconBtn title="Settings" onClick={() => navigate('/settings')}>
                <Settings size={14} />
              </IconBtn>
            </>
          }
        />

        {/* Stat row */}
        <div className="mb-4 grid grid-cols-2 gap-3.5 xl:grid-cols-4">
          {statDefs.map((s) => (
            <SStat
              key={s.label}
              icon={s.icon}
              label={s.label}
              value={s.value}
              unit={s.unit}
              foot={s.foot}
              delta={s.delta}
              extra={s.ticks !== null && s.ticks !== undefined ? <Ticks pct={s.ticks} count={44} warn={s.ticks > 85} /> : undefined}
            />
          ))}
        </div>

        {/* Chart + resource usage */}
        <div className="mb-4 grid grid-cols-1 gap-3.5 xl:grid-cols-[2.32fr_1fr]">
          <SCard
            icon={<Cpu size={13.5} />}
            title="Node CPU Load"
            accent={`(${range})`}
            trail={
              <IconBtn title="Refresh" onClick={refetchAll}>
                <RefreshCw size={13} />
              </IconBtn>
            }
            pad={false}
          >
            <SLegend items={chartData.series.map((s) => ({ color: s.color, label: s.key }))} />
            <div className="px-3 pb-3">
              {chartData.hasData ? (
                <ResponsiveContainer width="100%" height={292} initialDimension={{ width: 640, height: 292 }}>
                  <RechartsLineChart data={chartData.rows} margin={{ top: 14, right: 14, bottom: 4, left: -14 }}>
                    <CartesianGrid stroke="var(--border-subtle)" vertical={false} />
                    <XAxis
                      dataKey="t"
                      tick={{ fill: 'var(--text-tertiary)', fontSize: 10.5, fontFamily: 'IBM Plex Mono' }}
                      tickLine={false}
                      axisLine={{ stroke: 'var(--border-subtle)' }}
                      minTickGap={48}
                    />
                    <YAxis
                      domain={[0, 100]}
                      tick={{ fill: 'var(--text-tertiary)', fontSize: 10, fontFamily: 'IBM Plex Mono' }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v: number) => `${v}%`}
                    />
                    <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'var(--border-default)' }} />
                    {chartData.series.map((s, i) => (
                      <Line
                        key={s.key}
                        dataKey={s.key}
                        stroke={s.color}
                        strokeWidth={i === 0 ? 1.6 : 1.3}
                        dot={false}
                        isAnimationActive={false}
                      />
                    ))}
                  </RechartsLineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-[292px] flex-col items-center justify-center gap-2 text-center">
                  <Server size={22} className="text-[var(--text-tertiary)]" />
                  <p className="text-[12.5px] text-[var(--text-secondary)]">No node telemetry yet</p>
                  <p className="max-w-xs text-[11px] text-[var(--text-tertiary)]">
                    Enroll a Containr agent on a host to chart per-node CPU over time.
                  </p>
                </div>
              )}
            </div>
            {/* range picker rendered as a real control row under the chart */}
            <div className="flex items-center gap-1.5 border-t border-[var(--border-subtle)] px-4 py-2">
              {(['1h', '24h', '7d'] as RangeKey[]).map((r) => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  className={`rounded-[5px] px-2 py-1 text-[10.5px] font-medium transition-colors ${
                    range === r
                      ? 'bg-[var(--nav-active)] text-[var(--text-primary)]'
                      : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {r}
                </button>
              ))}
              <span className="v-mono ml-auto text-[10.5px] text-[var(--text-muted)]">
                {chartAgents.length > 0 ? `${chartAgents.length} node${chartAgents.length > 1 ? 's' : ''} sampled` : 'awaiting agents'}
              </span>
            </div>
          </SCard>

          <SCard
            icon={<HardDrive size={13.5} />}
            title="Resource Usage"
            accent="(host)"
            pad={false}
          >
            <div className="px-4 pt-1">
              {[
                { label: 'CPU Load', v: cpuPct },
                { label: 'Memory', v: memPct },
                { label: 'Disk I/O', v: diskPct },
                { label: 'Services online', v: totalServices > 0 ? Math.round((runningServices / totalServices) * 100) : null },
              ].map((r) => (
                <div key={r.label} className="py-2">
                  <div className="mb-2 flex items-baseline justify-between text-[12px]">
                    <span className="font-medium text-[var(--text-secondary)]">{r.label}</span>
                    <b className="font-semibold text-[var(--accent-primary)]">{r.v !== null ? `${r.v}%` : '—'}</b>
                  </div>
                  <Ticks pct={r.v ?? 0} count={56} warn={(r.v ?? 0) > 85} />
                </div>
              ))}
            </div>
            <div className="p-4 pt-2.5">
              <SAnomaly
                icon={<AlertTriangle size={12.5} className="text-[var(--accent-primary)]" />}
                title={
                  <>
                    <b className="font-semibold text-[var(--text-primary)]">{anomalies.length}</b>
                    {anomalies.length === 1 ? ' anomaly' : ' anomalies'} detected
                  </>
                }
                items={anomalies.length > 0 ? anomalies : ['All systems nominal']}
              />
            </div>
          </SCard>
        </div>

        {/* Node summary */}
        <SCard
          icon={<Server size={13.5} />}
          title="Node Summary"
          trail={
            <IconBtn title="Refresh" onClick={() => agentsQuery.refetch()}>
              <RefreshCw size={13} />
            </IconBtn>
          }
          pad={false}
        >
          <STable
            cols={nodeCols}
            rows={nodeRows}
            rowKey={(r) => r.id}
            selectable
            onRowClick={(r) => { if (r.id !== 'local') navigate(`/nodes/${r.id}`); }}
          />
          {nodeRows.length === 0 && (
            <p className="px-7 pb-5 text-[12px] text-[var(--text-tertiary)]">
              No nodes enrolled. The local host appears here once telemetry arrives.
            </p>
          )}
        </SCard>

        {/* Deployments + projects */}
        <div className="mt-4 grid grid-cols-1 gap-3.5 xl:grid-cols-[1.6fr_1fr]">
          <SCard
            icon={<Rocket size={13.5} />}
            title="Recent Deployments"
            accent={deployRows.length > 0 ? `(${deployments.length})` : undefined}
            trail={
              <IconBtn title="Refresh" onClick={() => deploysQuery.refetch()}>
                <RefreshCw size={13} />
              </IconBtn>
            }
            pad={false}
          >
            <STable cols={deployCols} rows={deployRows} rowKey={(r) => r.id} />
            {deployRows.length === 0 && (
              <p className="px-7 pb-5 text-[12px] text-[var(--text-tertiary)]">No deployments yet.</p>
            )}
          </SCard>

          <SCard
            icon={<FolderKanban size={13.5} />}
            title="Projects"
            accent={`(${projects.length})`}
            pad={false}
          >
            <div className="px-2 pb-2">
              {projects.slice(0, 6).map((p) => {
                const running = p.stats.running_services;
                const total = p.stats.service_count;
                const tone = total === 0 ? 'off' : running === total ? 'ok' : running > 0 ? 'warn' : 'err';
                return (
                  <button
                    key={p.id}
                    onClick={() => navigate(isDemoMode ? `/projects/${p.id}?demo=1` : `/projects/${p.id}`)}
                    className="flex w-full items-center gap-3 rounded-[8px] px-3 py-2.5 text-left transition-colors hover:bg-[var(--surface-muted)]"
                  >
                    <span className="s-ibox"><FolderKanban size={13.5} /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12.5px] font-medium text-[var(--text-primary)]">{p.name}</span>
                      <span className="v-mono block text-[10.5px] text-[var(--text-tertiary)]">
                        {running}/{total} services · {p.stats.deployment_count} deploys
                      </span>
                    </span>
                    <SPill tone={tone}>{total === 0 ? 'idle' : running === total ? 'healthy' : running > 0 ? 'partial' : 'down'}</SPill>
                  </button>
                );
              })}
              {projects.length === 0 && (
                <p className="px-5 py-4 text-[12px] text-[var(--text-tertiary)]">No projects yet.</p>
              )}
            </div>
          </SCard>
        </div>
      </div>
    </div>
  );
}
