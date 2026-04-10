import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createProject, listProjects, type ProjectEntity, type ProjectStats } from '@/lib/api-client';
import { 
  Plus, 
  Search, 
  ArrowRight, 
  Layers, 
  Clock,
  Sparkles,
  FolderOpen,
  X,
  Check,
  AlertTriangle
} from 'lucide-react';

const demoProjects: ProjectEntity[] = [
  {
    id: 'project-demo',
    name: 'Demo Project',
    description: 'Sample project with mock services for UI preview.',
    createdAt: new Date(Date.now() - 14 * 86_400_000).toISOString(),
    updatedAt: new Date().toISOString(),
    stats: { service_count: 3, deployment_count: 12, running_services: 2 },
  },
  {
    id: 'project-staging',
    name: 'Staging Environment',
    description: 'Pre-production environment for testing new releases.',
    createdAt: new Date(Date.now() - 7 * 86_400_000).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
    stats: { service_count: 1, deployment_count: 5, running_services: 1 },
  },
];

function getHealthStatus(stats: ProjectStats): 'healthy' | 'degraded' | 'critical' {
  if (stats.service_count === 0) return 'healthy';
  if (stats.running_services === stats.service_count) return 'healthy';
  if (stats.running_services >= stats.service_count / 2) return 'degraded';
  return 'critical';
}

function healthConfig(health: ReturnType<typeof getHealthStatus>) {
  switch (health) {
    case 'healthy':
      return { 
        label: 'Operational', 
        color: 'var(--success)', 
        bg: 'var(--success-soft)',
        Icon: Check
      };
    case 'degraded':
      return { 
        label: 'Degraded', 
        color: 'var(--warning)', 
        bg: 'var(--warning-soft)',
        Icon: AlertTriangle
      };
    case 'critical':
      return { 
        label: 'Critical', 
        color: 'var(--error)', 
        bg: 'var(--error-soft)',
        Icon: X
      };
  }
}

function formatRelative(date?: string): string {
  if (!date) return '—';
  const now = Date.now();
  const then = new Date(date).getTime();
  const diff = now - then;

  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

function ProjectCard({ project, href }: { project: ProjectEntity; href: string }) {
  const navigate = useNavigate();
  const health = getHealthStatus(project.stats);
  const config = healthConfig(health);
  const Icon = config.Icon;
  const healthPercent = project.stats.service_count === 0 
    ? 100 
    : Math.round((project.stats.running_services / project.stats.service_count) * 100);

  return (
    <article 
      className="group panel p-0 overflow-hidden cursor-pointer transition-all duration-300 hover:shadow-[var(--shadow-lg)] hover:border-[var(--border-default)]"
      onClick={() => navigate(href)}
    >
      {/* Header with solid accent */}
      <div className="relative px-5 pt-5 pb-4">
        <div className="absolute inset-0 h-28 bg-[#e8316a]/10" />
        <div className="relative flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-headline text-lg font-semibold tracking-tight text-[var(--text-primary)] truncate group-hover:text-[var(--accent-primary)] transition-colors">
              {project.name}
            </h3>
            <p className="mt-1.5 text-sm text-[var(--text-secondary)] line-clamp-2 leading-relaxed">
              {project.description || 'No description provided'}
            </p>
          </div>
          <div 
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium ring-1 ring-inset"
            style={{ background: config.bg, color: config.color, borderColor: `${config.color}30` }}
          >
            <Icon size={12} />
            {config.label}
          </div>
        </div>
      </div>

      {/* Service Topology Preview */}
      <div className="px-5 py-3 border-y border-[var(--border-subtle)] bg-[var(--surface-muted)]/30">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            {Array.from({ length: Math.min(project.stats.service_count, 5) }).map((_, i) => (
              <div 
                key={i}
                className="w-8 h-8 rounded-lg bg-[var(--surface-card)] border border-[var(--border-subtle)] flex items-center justify-center transition-colors group-hover:border-[var(--border-default)]"
              >
                <Layers size={14} className="text-[var(--text-tertiary)]" />
              </div>
            ))}
            {project.stats.service_count > 5 && (
              <div className="w-8 h-8 rounded-lg bg-[var(--surface-muted)] border border-[var(--border-subtle)] flex items-center justify-center text-xs text-[var(--text-tertiary)] font-medium">
                +{project.stats.service_count - 5}
              </div>
            )}
          </div>
          <span className="text-xs text-[var(--text-tertiary)] font-medium">
            {project.stats.service_count} service{project.stats.service_count !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="p-5">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-medium">Services</p>
            <p className="mt-1.5 text-xl font-semibold text-[var(--text-primary)]">{project.stats.service_count}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-medium">Running</p>
            <p className="mt-1.5 text-xl font-semibold text-[var(--success)]">{project.stats.running_services}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-medium">Health</p>
            <p className="mt-1.5 text-xl font-semibold text-[var(--text-primary)]">{healthPercent}%</p>
          </div>
        </div>

        {/* Health Progress Bar */}
        <div className="mt-4">
          <div className="h-1.5 rounded-full bg-[var(--surface-muted)] overflow-hidden">
            <div 
              className="h-full rounded-full transition-all duration-500"
              style={{ 
                width: `${healthPercent}%`,
                background: config.color
              }}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-[var(--text-tertiary)]">
            <Clock size={12} />
            <span>Updated {formatRelative(project.updatedAt)}</span>
          </div>
          <div className="flex items-center gap-1 text-xs font-medium text-[var(--accent-primary)] opacity-0 group-hover:opacity-100 transition-all duration-200 translate-x-2 group-hover:translate-x-0">
            <span>Open</span>
            <ArrowRight size={12} />
          </div>
        </div>
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

  return (
    <div className="min-h-screen relative">
      {/* Hero Section - Premium ambient design */}
      <div className="relative overflow-hidden border-b border-[var(--border-subtle)]">
        {/* Solid ambient background */}
        <div className="absolute inset-0 bg-[#e8316a]/5" />
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-[var(--accent-primary)]/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-[var(--accent-secondary)]/5 rounded-full blur-3xl" />
        
        <div className="relative mx-auto w-full max-w-[1400px] px-6 py-12 md:py-16 lg:py-20">
          <div className="max-w-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div 
                className="flex items-center justify-center rounded-xl shadow-lg ring-1 ring-white/10"
                style={{ width: '44px', height: '44px', background: '#e8316a' }}
              >
                <FolderOpen size={20} className="text-white" />
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--surface-muted)] border border-[var(--border-subtle)]">
                <div className="w-1.5 h-1.5 rounded-full bg-[var(--success)] live-pulse" />
                <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-tertiary)]">
                  Workspace
                </span>
              </div>
            </div>
            <h1 className="font-headline text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-[var(--text-primary)]">
              Projects
            </h1>
            <p className="mt-4 text-lg text-[var(--text-secondary)] max-w-xl leading-relaxed">
              Deploy, manage, and monitor your containerized services with visual topology mapping and real-time observability.
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="mx-auto w-full max-w-[1400px] px-6 py-8">
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search projects by name or description..."
              className="w-full h-11 pl-11 pr-4 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-card)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)] transition-all"
            />
          </div>
          <button
            onClick={() => setCreateOpen(true)}
            className="flex items-center justify-center gap-2 h-11 px-5 rounded-[var(--radius-md)] text-white font-medium text-sm shadow-lg hover:shadow-xl transition-all duration-300"
            style={{ background: '#e8316a' }}
          >
            <Plus size={16} />
            <span>New Project</span>
          </button>
        </div>

        {/* Demo Mode Banner */}
        {isDemoMode && (
          <div className="mb-6 px-4 py-3 rounded-[var(--radius-md)] border border-[var(--warning-soft)] bg-[var(--warning-soft)]/50">
            <div className="flex items-center gap-2 text-sm text-[var(--warning)]">
              <Sparkles size={16} />
              <span>Demo mode active — using sample data for preview</span>
            </div>
          </div>
        )}

        {/* Loading State */}
        {!isDemoMode && projectsQuery.isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="panel h-[320px] animate-pulse bg-[var(--surface-card)]" />
            ))}
          </div>
        )}

        {/* Error State */}
        {!isDemoMode && projectsQuery.isError && (
          <div className="panel p-8 text-center">
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-[var(--error-soft)] flex items-center justify-center">
              <X size={24} className="text-[var(--error)]" />
            </div>
            <p className="text-lg font-medium text-[var(--text-primary)]">Failed to load projects</p>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">Check API connectivity and try again</p>
          </div>
        )}

        {/* Empty State */}
        {((isDemoMode && filteredProjects.length === 0) || (!isDemoMode && !projectsQuery.isLoading && !projectsQuery.isError && filteredProjects.length === 0)) && (
          <div className="panel p-12 text-center">
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-[var(--accent-primary-soft)] flex items-center justify-center">
              <FolderOpen size={28} className="text-[var(--accent-primary)]" />
            </div>
            <p className="text-xl font-semibold text-[var(--text-primary)]">No projects yet</p>
            <p className="mt-2 text-[var(--text-secondary)] max-w-md mx-auto">
              Create your first project to start deploying services with visual topology management.
            </p>
            <button
              onClick={() => setCreateOpen(true)}
              className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-[var(--radius-md)] border border-[var(--accent-primary)] text-[var(--accent-primary)] font-medium text-sm hover:bg-[var(--accent-primary-soft)] transition-colors"
            >
              <Plus size={16} />
              Create Project
            </button>
          </div>
        )}

        {/* Project Grid */}
        {((isDemoMode && filteredProjects.length > 0) || (!isDemoMode && !projectsQuery.isLoading && !projectsQuery.isError && filteredProjects.length > 0)) && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredProjects.map((project) => (
              <ProjectCard key={project.id} project={project} href={projectHref(project.id)} />
            ))}
          </div>
        )}
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
                <label className="block text-xs font-medium uppercase tracking-wider text-[var(--text-tertiary)] mb-2">
                  Project Name
                </label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="my-awesome-project"
                  className="w-full h-11 px-4 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)] transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-medium uppercase tracking-wider text-[var(--text-tertiary)] mb-2">
                  Description <span className="normal-case text-[var(--text-muted)]">(optional)</span>
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                  placeholder="Describe your project..."
                  rows={3}
                  className="w-full px-4 py-3 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)] transition-all resize-none"
                />
              </div>
            </div>

            {createProjectMutation.isError && (
              <div className="mt-4 px-4 py-3 rounded-[var(--radius-md)] bg-[var(--error-soft)] text-sm text-[var(--error)]">
                {(createProjectMutation.error as Error).message}
              </div>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setCreateOpen(false)}
                className="px-4 py-2 rounded-[var(--radius-md)] border border-[var(--border-subtle)] text-[var(--text-secondary)] text-sm font-medium hover:text-[var(--text-primary)] hover:border-[var(--border-default)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => createProjectMutation.mutate()}
                disabled={!form.name.trim() || createProjectMutation.isPending}
                className="px-5 py-2 rounded-[var(--radius-md)] text-white text-sm font-medium shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                style={{ background: '#e8316a' }}
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
