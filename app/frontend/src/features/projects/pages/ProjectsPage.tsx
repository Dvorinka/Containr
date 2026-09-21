import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
} from 'lucide-react';

const demoProjects: ProjectEntity[] = [
  {
    id: 'project-demo',
    name: 'core-services',
    description: 'Sample project with mock services for UI preview.',
    createdAt: new Date(Date.now() - 14 * 86_400_000).toISOString(),
    updatedAt: new Date().toISOString(),
    stats: { service_count: 5, deployment_count: 12, running_services: 5, last_deployment: null },
  },
  {
    id: 'project-staging',
    name: 'ml-pipeline',
    description: 'Pre-production environment for testing new releases.',
    createdAt: new Date(Date.now() - 7 * 86_400_000).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
    stats: { service_count: 2, deployment_count: 5, running_services: 1, last_deployment: null },
  },
];

const demoDeploys = [
  { id: 'd1', name: 'api-gateway', project: 'core-services', status: 'DEPLOYED', when: '4m' },
  { id: 'd2', name: 'web-frontend', project: 'core-services', status: 'BUILDING', when: '6m' },
  { id: 'd3', name: 'worker', project: 'ml-pipeline', status: 'FAILED', when: '1h' },
  { id: 'd4', name: 'site', project: 'growth-site', status: 'DEPLOYED', when: '2h' },
];

function getHealthStatus(stats: ProjectStats): 'healthy' | 'degraded' | 'critical' {
  if (stats.service_count === 0) return 'healthy';
  if (stats.running_services === stats.service_count) return 'healthy';
  if (stats.running_services >= stats.service_count / 2) return 'degraded';
  return 'critical';
}

function healthBadge(health: ReturnType<typeof getHealthStatus>) {
  switch (health) {
    case 'healthy':
      return { label: 'RUNNING', cls: 'v-st-ok' };
    case 'degraded':
      return { label: 'DEGRADED', cls: 'v-st-warn' };
    case 'critical':
      return { label: 'DOWN', cls: 'v-st-fail' };
  }
}

function formatRelative(date?: string): string {
  if (!date) return '—';
  const diff = Date.now() - new Date(date).getTime();
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

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
          svc{i + 1}
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
  const badge = healthBadge(health);
  const envOk = health === 'healthy';

  return (
    <article
      className="group panel p-4 cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--border-strong)]"
      onClick={() => navigate(href)}
    >
      <div className="mb-3 flex items-center gap-2">
        <h3 className="truncate text-[14.5px] font-bold tracking-tight text-[var(--text-primary)]">
          {project.name}
        </h3>
        <span className={`v-st ml-auto ${badge.cls}`}>{badge.label}</span>
      </div>
      <MiniCanvas project={project} />
      <div className="v-mono mt-3 flex items-center gap-2 text-[10.5px] text-[var(--text-tertiary)]">
        <i
          className="inline-block h-1.5 w-1.5 rounded-full"
          style={{ background: envOk ? 'var(--success)' : 'var(--warning)' }}
        />
        <span className="text-[var(--text-secondary)]">
          {envOk ? 'production' : 'degraded'}
        </span>
        <span>·</span>
        <span>
          {project.stats.running_services}/{project.stats.service_count} online
        </span>
        <span className="ml-auto">{formatRelative(project.updatedAt)}</span>
      </div>
    </article>
  );
}

export function ProjectsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const isDemoMode = searchParams.get('demo') === '1';

  const [search, setSearch] = useState('');
  const [isCreateOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ name: '', description: '' });

  const projectHref = (projectId: string) =>
    isDemoMode ? `/projects/${projectId}?demo=1` : `/projects/${projectId}`;

  const projectsQuery = useQuery({
    queryKey: ['projects'],
    enabled: !isDemoMode,
    queryFn: listProjects,
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
  const cpuPct = isDemoMode ? 14 : host && host.cpu.cores > 0
    ? Math.min(100, Math.round((host.load.load1m / host.cpu.cores) * 100))
    : null;
  const memPct = isDemoMode ? 72 : host ? Math.round(host.memory.usagePercent) : null;
  const diskPct = isDemoMode ? 73 : host ? Math.round(host.storage.usagePercent) : null;
  const fmtGB = (v: number) => `${(v / (1024 * 1024 * 1024)).toFixed(0)}G`;
  const deployments = isDemoMode ? [] : deploysQuery.data ?? [];
  const deployCount = deployments.length;
  const feed = isDemoMode
    ? demoDeploys
    : deployments.slice(0, 5).map((d) => ({
        id: d.id,
        name: d.serviceName || d.imageName || d.serviceId || d.id,
        project: d.projectName,
        status: (d.status || 'queued').toUpperCase(),
        when: formatRelative(d.startedAt ?? d.completedAt ?? d.createdAt),
      }));

  const statusClass = (status: string) =>
    status === 'DEPLOYED' || status === 'SUCCESS' || status === 'SUCCEEDED'
      ? 'v-st-ok'
      : status === 'BUILDING' || status === 'RUNNING' || status === 'QUEUED'
        ? 'v-st-run'
        : status === 'FAILED' || status === 'CANCELLED'
          ? 'v-st-fail'
          : 'v-st-off';

  return (
    <div className="min-h-screen">
      <div className="w-full px-8 py-6">
        {/* Page head */}
        <div className="mb-6 flex items-center justify-between gap-5">
          <div>
            <h1 className="v-title">Projects<span className="v-cursor">_</span></h1>
            <p className="v-mono mt-1.5 text-[11px] text-[var(--text-tertiary)]">
              <b className="text-[var(--text-secondary)]">{String(projects.length).padStart(2, '0')}</b> projects ·{' '}
              <b className="text-[var(--text-secondary)]">{String(totalServices).padStart(2, '0')}</b> services ·{' '}
              <b className="text-[var(--text-secondary)]">{runningServices}</b> online
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="search-box" style={{ width: 240 }}>
              <Search size={13} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="search projects…"
                className="v-mono"
                style={{ fontSize: 11.5 }}
              />
            </div>
            <button onClick={() => setCreateOpen(true)} className="v-btn">
              + new project
            </button>
          </div>
        </div>

        {/* Host stat row */}
        <div className="mb-7 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="v-stat">
            <div className="v-k"><span>HOST.CPU</span><span className="v-live" /></div>
            <div className="v-v">{cpuPct ?? '—'}<span>%</span></div>
            {isDemoMode ? (
              <div className="v-spark">
                {[28, 44, 36, 58, 42, 66, 50, 34, 56, 40, 30, 20].map((h, i) => (
                  <i key={i} style={{ height: `${h}%` }} />
                ))}
              </div>
            ) : null}
            <div className="v-d">
              {isDemoMode || host ? (
                <><b style={{ color: 'var(--success)' }}>healthy</b> · {host?.cpu.cores ?? 16} cores</>
              ) : 'no telemetry'}
            </div>
          </div>
          <div className="v-stat">
            <div className="v-k"><span>HOST.MEM</span><span className="v-live" /></div>
            <div className="v-v">{memPct ?? '—'}<span>%</span></div>
            <div className="v-meter"><i className={memPct !== null && memPct > 85 ? 'r' : 'y'} style={{ width: `${memPct ?? 0}%` }} /></div>
            <div className="v-d">{isDemoMode ? '9.8G / 13G' : host ? `${fmtGB(host.memory.used)} / ${fmtGB(host.memory.total)}` : 'no telemetry'}</div>
          </div>
          <div className="v-stat">
            <div className="v-k"><span>HOST.DISK</span><span className="v-live" /></div>
            <div className="v-v">{diskPct ?? '—'}<span>%</span></div>
            <div className="v-meter"><i className="r" style={{ width: `${diskPct ?? 0}%` }} /></div>
            <div className="v-d">{isDemoMode ? '338G of 465G · high' : host ? `${fmtGB(host.storage.used)} of ${fmtGB(host.storage.total)}` : 'no telemetry'}</div>
          </div>
          <div className="v-stat">
            <div className="v-k"><span>DEPLOYS</span></div>
            <div className="v-v">{isDemoMode ? 18 : deployCount}</div>
            <div className="v-meter"><i style={{ width: '94%' }} /></div>
            <div className="v-d"><b style={{ color: 'var(--success)' }}>{isDemoMode ? '17 ok' : `${deployments.filter((d) => (d.status ?? '').toLowerCase() !== 'failed').length} recent`}</b></div>
          </div>
        </div>

        {/* Projects grid */}
        <p className="v-sect">PROJECTS <span className="v-sect-r">{filteredProjects.length} records</span></p>

        {!isDemoMode && projectsQuery.isLoading && (
          <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="panel h-[210px] animate-pulse" />
            ))}
          </div>
        )}

        {!isDemoMode && projectsQuery.isError && (
          <div className="panel p-8 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--error-soft)]">
              <X size={24} className="text-[var(--error)]" />
            </div>
            <p className="text-lg font-medium text-[var(--text-primary)]">Failed to load projects</p>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">Check API connectivity and try again</p>
          </div>
        )}

        {filteredProjects.length === 0 && !projectsQuery.isLoading && !projectsQuery.isError ? (
          <div className="panel p-12 text-center">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--accent-primary-soft)]">
              <FolderOpen size={28} className="text-[var(--accent-primary)]" />
            </div>
            <p className="text-xl font-semibold text-[var(--text-primary)]">No projects yet</p>
            <p className="mx-auto mt-2 max-w-md text-[var(--text-secondary)]">
              Create your first project to start deploying services with visual topology management.
            </p>
            <button onClick={() => setCreateOpen(true)} className="v-btn mt-6">
              + create project
            </button>
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
        <p className="v-sect mt-7">RECENT DEPLOYMENTS <span className="v-sect-r">latest</span></p>
        <div className="v-tbl">
          <table>
            <thead>
              <tr><th>SERVICE</th><th>STATUS</th><th style={{ textAlign: 'right' }}>WHEN</th></tr>
            </thead>
            <tbody>
              {feed.length === 0 ? (
                <tr><td colSpan={3} className="text-center" style={{ color: 'var(--text-tertiary)' }}>no deployments yet</td></tr>
              ) : feed.map((d) => (
                <tr key={d.id}>
                  <td className="v-lead">{d.name}{d.project ? <span className="v-mono ml-2 text-[10.5px] font-normal text-[var(--text-tertiary)]">{d.project}</span> : null}</td>
                  <td><span className={`v-st ${statusClass(d.status)}`}>{d.status}</span></td>
                  <td style={{ textAlign: 'right' }}>{d.when}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-[var(--bg-void)]/80 backdrop-blur-sm" onClick={() => setCreateOpen(false)} />
          <div className="relative w-full max-w-lg panel p-6">
            <h2 className="text-xl font-semibold text-[var(--text-primary)]">Create new project</h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Projects organize your services and provide a visual canvas for topology management.
            </p>

            <div className="mt-6 space-y-4">
              <div>
                <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-[var(--text-tertiary)]">
                  Project Name
                </label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="my-awesome-project"
                  className="h-11 w-full rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-4 text-[var(--text-primary)] transition-all placeholder:text-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)]"
                />
              </div>
              <div>
                <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-[var(--text-tertiary)]">
                  Description <span className="normal-case text-[var(--text-muted)]">(optional)</span>
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                  placeholder="Describe your project..."
                  rows={3}
                  className="w-full resize-none rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-4 py-3 text-[var(--text-primary)] transition-all placeholder:text-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)]"
                />
              </div>
            </div>

            {createProjectMutation.isError && (
              <div className="mt-4 rounded-[var(--radius-md)] bg-[var(--error-soft)] px-4 py-3 text-sm text-[var(--error)]">
                {(createProjectMutation.error as Error).message}
              </div>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setCreateOpen(false)} className="v-btn-ghost">
                Cancel
              </button>
              <button
                onClick={() => createProjectMutation.mutate()}
                disabled={!form.name.trim() || createProjectMutation.isPending}
                className="v-btn"
              >
                {createProjectMutation.isPending ? 'Creating...' : 'Create Project'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
