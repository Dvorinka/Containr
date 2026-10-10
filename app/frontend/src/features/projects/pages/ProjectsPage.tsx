import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createProject,
  getHostMonitoring,
  listRecentDeployments,
  listProjects,
  type ProjectEntity,
  type ProjectStats,
} from '@/lib/api-client';
import {
  Search,
  FolderOpen,
  X,
  Cpu,
  MemoryStick,
  HardDrive,
  Rocket,
  RefreshCw,
  Server,
} from 'lucide-react';
import { useAuthSession } from '@/lib/use-auth-session';
import { useDemoMode } from '@/lib/demo-mode';
import { demoProjects } from '@/lib/demo-data';
import {
  GhostBtn,
  IconBtn,
  QuietBtn,
  SAnomaly,
  SCard,
  SPageHead,
  SPill,
  SSection,
  SStat,
  STable,
  Ticks,
  type SCol,
} from '@/shared/components/sentry';
import { statusTone } from '@/shared/components/sentry-utils';

const demoDeploys = [
  { id: 'd1', name: 'API Gateway', project: 'Core Platform', status: 'DEPLOYED', when: '4m' },
  { id: 'd2', name: 'Web Frontend', project: 'Core Platform', status: 'BUILDING', when: '6m' },
  { id: 'd3', name: 'Batch Evaluator', project: 'Inference Lab', status: 'FAILED', when: '1h' },
  { id: 'd4', name: 'Marketing Site', project: 'Growth Surface', status: 'DEPLOYED', when: '2h' },
];

type DeployRow = { id: string; name: string; project?: string; status: string; when: string };

function getHealthStatus(stats: ProjectStats): 'healthy' | 'idle' | 'degraded' | 'critical' {
  if (stats.service_count === 0) return 'idle';
  if (stats.running_services === stats.service_count) return 'healthy';
  if (stats.running_services > 0) return 'degraded';
  return 'critical';
}

function formatRelative(date?: string): string {
  if (!date) return '—';
  const diff = Date.now() - new Date(date).getTime();
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

/* Mini service topology preview inside each project card. */
function MiniCanvas({ project }: { project: ProjectEntity }) {
  const count = project.stats.service_count;
  const running = project.stats.running_services;
  const shown = Math.min(count, 4);
  const extra = count - shown;
  const positions = [
    { left: 14, top: 22 },
    { left: 96, top: 22 },
    { left: 14, top: 62 },
    { left: 96, top: 62 },
  ];
  return (
    <div className="v-mini">
      {count >= 2 ? <div className="v-edge" style={{ left: 46, top: 38, width: 50 }} /> : null}
      {count >= 4 ? <div className="v-edge" style={{ left: 46, top: 78, width: 50 }} /> : null}
      {Array.from({ length: shown }).map((_, i) => (
        <div key={i} className="v-node" style={positions[i]}>
          <b className={`v-nd ${i < running ? '' : 'r'}`} />
        </div>
      ))}
      {extra > 0 ? (
        <div className="v-more" style={{ left: 178, top: 22 }}>+{extra}</div>
      ) : null}
    </div>
  );
}

function ProjectCard({ project, href }: { project: ProjectEntity; href: string }) {
  const navigate = useNavigate();
  const health = getHealthStatus(project.stats);
  const envLabel =
    health === 'healthy' ? 'production' : health === 'idle' ? 'idle' : health === 'critical' ? 'down' : 'degraded';

  return (
    <article
      className="s-card group cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--border-strong)]"
      onClick={() => navigate(href)}
    >
      <div className="s-cardhead">
        <IboxStub />
        <h3 className="s-t truncate">{project.name}</h3>
        <span className="s-trail">
          <SPill
            tone={
              health === 'healthy' ? 'ok' : health === 'idle' ? 'off' : health === 'critical' ? 'err' : 'warn'
            }
          >
            {health === 'healthy' ? 'Running' : health === 'idle' ? 'Idle' : health === 'critical' ? 'Down' : 'Degraded'}
          </SPill>
        </span>
      </div>
      <div className="px-4">
        <MiniCanvas project={project} />
      </div>
      <div className="s-stat-foot mt-3.5">
        <span className="flex items-center gap-2">
          <i
            className="inline-block h-1.5 w-1.5 rounded-full"
            style={{
              background:
                health === 'healthy'
                  ? 'var(--success)'
                  : health === 'idle'
                    ? 'var(--text-tertiary)'
                    : health === 'critical'
                      ? 'var(--error)'
                      : 'var(--warning)',
            }}
          />
          {envLabel} · {project.stats.running_services}/{project.stats.service_count} online
        </span>
        <span>{formatRelative(project.updatedAt)}</span>
      </div>
    </article>
  );
}

function IboxStub() {
  return (
    <span className="s-ibox">
      <Server size={13.5} />
    </span>
  );
}

export function ProjectsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isDemoMode = useDemoMode();

  const [search, setSearch] = useState('');
  const [isCreateOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ name: '', description: '' });
  const sessionQuery = useAuthSession({ enabled: !isDemoMode });
  const signedIn = isDemoMode || Boolean(sessionQuery.data);
  const openCreate = () => {
    if (!signedIn) {
      navigate('/auth/sign-in');
      return;
    }
    setCreateOpen(true);
  };

  const projectHref = (projectId: string) =>
    isDemoMode ? `/projects/${projectId}?demo=1` : `/projects/${projectId}`;

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
  const deploysQuery = useQuery({
    queryKey: ['recent-deploys'],
    enabled: !isDemoMode,
    queryFn: () => listRecentDeployments(10),
    refetchInterval: 30_000,
  });

  const createProjectMutation = useMutation({
    mutationFn: () => createProject({ name: form.name.trim(), description: form.description.trim() || undefined }),
    onSuccess: (project) => {
      setCreateOpen(false);
      setForm({ name: '', description: '' });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      navigate(projectHref(project.id));
    },
  });

  const filteredProjects = useMemo(() => {
    const source = isDemoMode ? demoProjects : projectsQuery.data ?? [];
    if (!search.trim()) return source;
    const needle = search.toLowerCase();
    return source.filter((project) =>
      project.name.toLowerCase().includes(needle) ||
      project.description?.toLowerCase().includes(needle)
    );
  }, [isDemoMode, projectsQuery.data, search]);

  const projects = isDemoMode ? demoProjects : projectsQuery.data ?? [];
  const totalServices = projects.reduce((sum, p) => sum + p.stats.service_count, 0);
  const runningServices = projects.reduce((sum, p) => sum + p.stats.running_services, 0);
  const host = hostQuery.data;
  const hostLabel = host?.scope === 'docker-desktop-vm' ? 'VM' : 'Host';
  const cpuPct = isDemoMode ? 14 : host && host.cpu.cores > 0
    ? Math.min(100, Math.round((host.load.load1m / host.cpu.cores) * 100))
    : null;
  const memPct = isDemoMode ? 72 : host ? Math.round(host.memory.usagePercent) : null;
  const diskPct = isDemoMode ? 73 : host ? Math.round(host.storage.usagePercent) : null;
  const fmtGB = (v: number) => `${(v / (1024 * 1024 * 1024)).toFixed(0)}G`;
  const deployments = isDemoMode ? [] : deploysQuery.data ?? [];
  const deployCount = deployments.length;
  const feed: DeployRow[] = isDemoMode
    ? demoDeploys
    : deployments.slice(0, 6).map((d) => ({
        id: d.id,
        name: d.serviceName || d.imageName || d.serviceId || d.id,
        project: d.projectName,
        status: (d.status || 'queued').toUpperCase(),
        when: formatRelative(d.startedAt ?? d.completedAt ?? d.createdAt),
      }));

  const statDefs = [
    {
      icon: <Cpu size={13.5} />,
      label: `${hostLabel} CPU`,
      value: cpuPct ?? '—',
      unit: cpuPct !== null ? '%' : undefined,
      ticks: cpuPct,
      foot: isDemoMode || host ? `${host?.cpu.cores ?? 16} cores · load avg` : 'no telemetry',
    },
    {
      icon: <MemoryStick size={13.5} />,
      label: `${hostLabel} Memory`,
      value: memPct ?? '—',
      unit: memPct !== null ? '%' : undefined,
      ticks: memPct,
      foot: isDemoMode
        ? '9.8G / 13G used'
        : host
          ? `${fmtGB(host.memory.used)} / ${fmtGB(host.memory.total)} used`
          : 'no telemetry',
    },
    {
      icon: <HardDrive size={13.5} />,
      label: `${hostLabel} Disk`,
      value: diskPct ?? '—',
      unit: diskPct !== null ? '%' : undefined,
      ticks: diskPct,
      foot: isDemoMode
        ? '338G of 465G'
        : host
          ? `${fmtGB(host.storage.used)} of ${fmtGB(host.storage.total)}`
          : 'no telemetry',
    },
    {
      icon: <Rocket size={13.5} />,
      label: 'Deployments',
      value: isDemoMode ? 18 : deployCount,
      unit: 'recent',
      ticks: null,
      foot: isDemoMode
        ? '17 succeeded'
        : `${deployments.filter((d) => (d.status ?? '').toLowerCase() !== 'failed').length} succeeded`,
    },
  ];

  const deployCols: SCol<DeployRow>[] = [
    {
      key: 'service',
      label: 'Service',
      width: '2.4fr',
      sortValue: (r) => r.name,
      render: (r) => (
        <span className="text-[var(--text-primary)] font-medium">
          {r.name}
          {r.project ? (
            <span className="v-mono ml-2 text-[10.5px] font-normal text-[var(--text-tertiary)]">{r.project}</span>
          ) : null}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      width: '1fr',
      sortValue: (r) => r.status,
      render: (r) => <SPill tone={statusTone(r.status)}>{r.status}</SPill>,
    },
    {
      key: 'when',
      label: 'When',
      width: '0.6fr',
      sortable: false,
      render: (r) => <span className="v-mono text-[11.5px] text-[var(--text-tertiary)]">{r.when}</span>,
    },
  ];

  const anomalies =
    (diskPct ?? 0) > 85 || (memPct ?? 0) > 85
      ? [
          ...(diskPct ?? 0) > 85 ? [`Disk usage at ${diskPct}% — prune images or expand volume`] : [],
          ...(memPct ?? 0) > 85 ? [`Memory pressure at ${memPct}% — consider rebalancing services`] : [],
        ]
      : [];

  return (
    <div className="min-h-screen">
      <div className="w-full px-4 py-6 sm:px-7">
        <SPageHead
          title="Projects"
          titleAccent="_"
          sub={
            <>
              {String(projects.length).padStart(2, '0')} projects · {String(totalServices).padStart(2, '0')} services ·{' '}
            </>
          }
          subAccent={`${runningServices} online`}
          actions={
            <>
              <div className="search-box" style={{ width: 'min(230px, 40vw)' }}>
                <Search size={13} />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search projects"
                />
              </div>
              <IconBtn title="Refresh" onClick={() => { projectsQuery.refetch(); deploysQuery.refetch(); hostQuery.refetch(); }}>
                <RefreshCw size={14} />
              </IconBtn>
              {signedIn && (
                <GhostBtn onClick={openCreate}>+ New Project</GhostBtn>
              )}
            </>
          }
        />

        {/* Host telemetry */}
        <div className="mb-4 grid grid-cols-2 gap-3.5 lg:grid-cols-4">
          {statDefs.map((s) => (
            <SStat
              key={s.label}
              icon={s.icon}
              label={s.label}
              value={s.value}
              unit={s.unit}
              foot={s.foot}
              delta={s.label === 'Deployments' && feed.length > 0 ? { dir: 'up', text: `+${feed.length}` } : undefined}
              extra={s.ticks !== null && s.ticks !== undefined ? <Ticks pct={s.ticks} count={44} warn={s.ticks > 85} /> : undefined}
            />
          ))}
        </div>

        {anomalies.length > 0 && (
          <div className="mb-4">
            <SAnomaly
              icon={
                <svg width="12.5" height="12.5" viewBox="0 0 16 16" fill="none" stroke="var(--warning)" strokeWidth="1.5">
                  <path d="M8 2.4 2.2 13h11.6z" />
                  <path d="M8 6.6v3M8 11.4v.3" />
                </svg>
              }
              title={<><b className="text-[var(--text-primary)] font-semibold">{anomalies.length}</b> resource anomaly{anomalies.length > 1 ? 's' : ''} detected</>}
              items={anomalies}
            />
          </div>
        )}

        {/* Projects grid */}
        <SSection right={`${filteredProjects.length} records`}>Projects</SSection>

        {!isDemoMode && projectsQuery.isLoading && (
          <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="s-card h-[210px] animate-pulse" />
            ))}
          </div>
        )}

        {!isDemoMode && projectsQuery.isError && (
          <div className="s-card p-8 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--error-soft)]">
              <X size={22} className="text-[var(--error)]" />
            </div>
            <p className="text-[15px] font-semibold text-[var(--text-primary)]">Failed to load projects</p>
            <p className="mt-1.5 text-[12px] text-[var(--text-tertiary)]">Check API connectivity and try again</p>
          </div>
        )}

        {filteredProjects.length === 0 && !projectsQuery.isLoading && !projectsQuery.isError ? (
          <div className="s-card p-12 text-center">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-xl border border-[var(--border-default)] bg-[var(--bg-overlay)]">
              <FolderOpen size={24} className="text-[var(--accent-primary)]" />
            </div>
            <p className="font-headline text-[17px] font-bold text-[var(--text-primary)]">No projects yet</p>
            <p className="mx-auto mt-2 max-w-md text-[12.5px] text-[var(--text-secondary)]">
              {signedIn
                ? 'Create your first project to start deploying services with visual topology management.'
                : 'No public projects yet. Sign in to create one — an admin approves it before it goes public.'}
            </p>
            <GhostBtn onClick={openCreate} className="mt-6">
              {signedIn ? '+ New Project' : 'Sign in to create'}
            </GhostBtn>
          </div>
        ) : null}

        {filteredProjects.length > 0 && (
          <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {filteredProjects.map((project) => (
              <ProjectCard key={project.id} project={project} href={projectHref(project.id)} />
            ))}
          </div>
        )}

        {/* Deploy feed */}
        <div className="mt-6">
          <SCard
            icon={<Rocket size={13.5} />}
            title="Recent Deployments"
            accent={feed.length > 0 ? `(${feed.length})` : undefined}
            trail={
              <IconBtn title="Refresh" onClick={() => deploysQuery.refetch()}>
                <RefreshCw size={13} />
              </IconBtn>
            }
            pad={false}
          >
            <STable cols={deployCols} rows={feed} rowKey={(r) => r.id} />
            {feed.length === 0 && (
              <p className="px-7 pb-5 text-[12px] text-[var(--text-tertiary)]">No deployments yet.</p>
            )}
          </SCard>
        </div>
      </div>

      {/* Create Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-[var(--bg-void)]/80 backdrop-blur-sm" onClick={() => setCreateOpen(false)} />
          <div className="s-card relative w-full max-w-lg p-6">
            <h2 className="font-headline text-[19px] font-bold tracking-tight text-[var(--text-primary)]">New project</h2>
            <p className="mt-1 text-[12.5px] text-[var(--text-secondary)]">
              Projects organize your services and provide a visual canvas for topology management.
            </p>
            <div className="s-inset mt-3 text-[11.5px] text-[var(--warning)]">
              New projects stay private until a platform admin approves them for public listing.
            </div>

            <div className="mt-5 space-y-4">
              <div>
                <label className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-[var(--text-tertiary)]">
                  Project Name
                </label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="my-awesome-project"
                  className="h-10 w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-overlay)] px-3.5 text-[13px] text-[var(--text-primary)] transition-all placeholder:text-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-[var(--text-tertiary)]">
                  Description <span className="normal-case text-[var(--text-muted)]">(optional)</span>
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                  placeholder="Describe your project…"
                  rows={3}
                  className="w-full resize-none rounded-lg border border-[var(--border-default)] bg-[var(--bg-overlay)] px-3.5 py-3 text-[13px] text-[var(--text-primary)] transition-all placeholder:text-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:outline-none"
                />
              </div>
            </div>

            {createProjectMutation.isError && (
              <div className="s-inset mt-4 text-[12px] text-[var(--error)]">
                {(createProjectMutation.error as Error).message}
              </div>
            )}

            <div className="mt-6 flex justify-end gap-2.5">
              <QuietBtn onClick={() => setCreateOpen(false)}>Cancel</QuietBtn>
              <GhostBtn
                onClick={() => createProjectMutation.mutate()}
                disabled={!form.name.trim() || createProjectMutation.isPending}
              >
                {createProjectMutation.isPending ? 'Creating…' : 'Create Project'}
              </GhostBtn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
