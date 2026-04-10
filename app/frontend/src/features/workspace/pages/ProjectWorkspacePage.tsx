import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  createService,
  getProjectById,
  listServiceLogs,
  listServiceVariables,
  listServicesByProject,
  type CreateServiceInput,
} from '@/lib/api-client';
import { getDemoProjectById, getDemoServicesByProject, getDemoVariablesByProject } from '@/lib/demo-data';
import { formatDate, formatRelative } from '@/lib/time';
import type { ServiceVariable } from '../auto-connections';
import { ProjectCanvas } from '../canvas/ProjectCanvas';
import { canvasStorageKey, clearCanvasMetadata } from '../storage';
import { MetricsDashboard } from '../components/MetricsDashboard';
import { CommandPalette, StatusBadge, LiveIndicator, useToast } from '@/shared/components';
import {
  ArrowLeft,
  LayoutGrid,
  Activity,
  FileText,
  Settings,
  Plus,
  X,
  Loader2,
  Layers,
  Clock,
  Trash2,
  Sparkles,
  Box,
  Search,
} from 'lucide-react';

type WorkspaceView = 'canvas' | 'observability' | 'logs' | 'settings';

const viewItems: Array<{ key: WorkspaceView; label: string; icon: typeof LayoutGrid }> = [
  { key: 'canvas', label: 'Canvas', icon: LayoutGrid },
  { key: 'observability', label: 'Observability', icon: Activity },
  { key: 'logs', label: 'Logs', icon: FileText },
  { key: 'settings', label: 'Settings', icon: Settings },
];

const serviceTypes: Array<CreateServiceInput['type']> = ['web', 'worker', 'database', 'cron'];
const serviceEnvironments = ['production', 'preview', 'development'] as const;

function ServiceCreateDialog(props: {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: CreateServiceInput) => void;
  loading: boolean;
  errorMessage?: string;
}) {
  const [form, setForm] = useState<CreateServiceInput>({
    name: '',
    type: 'web',
    environment: 'production',
    image: '',
    command: '',
  });

  if (!props.open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[var(--bg-void)]/80 backdrop-blur-sm" onClick={props.onClose} />
      <div className="relative w-full max-w-lg panel p-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-[var(--radius-md)] bg-[var(--accent-primary-soft)] flex items-center justify-center">
            <Plus size={20} className="text-[var(--accent-primary)]" />
          </div>
          <h3 className="text-xl font-semibold text-[var(--text-primary)]">Add Service</h3>
        </div>
        <p className="text-sm text-[var(--text-secondary)]">
          Deploy a new service to this project. Configure runtime settings after creation.
        </p>

        <div className="mt-6 space-y-4">
          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-[var(--text-tertiary)] mb-2">
              Service Name
            </label>
            <input
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              className="w-full h-11 px-4 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)] transition-all"
              placeholder="api-gateway"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium uppercase tracking-wider text-[var(--text-tertiary)] mb-2">
                Type
              </label>
              <select
                value={form.type}
                onChange={(e) => setForm((p) => ({ ...p, type: e.target.value as CreateServiceInput['type'] }))}
                className="w-full h-11 px-4 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)] transition-all"
              >
                {serviceTypes.map((type) => (
                  <option key={type} value={type}>{type.charAt(0).toUpperCase() + type.slice(1)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium uppercase tracking-wider text-[var(--text-tertiary)] mb-2">
                Environment
              </label>
              <select
                value={form.environment}
                onChange={(e) => setForm((p) => ({ ...p, environment: e.target.value as typeof serviceEnvironments[number] }))}
                className="w-full h-11 px-4 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)] transition-all"
              >
                {serviceEnvironments.map((env) => (
                  <option key={env} value={env}>{env.charAt(0).toUpperCase() + env.slice(1)}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-[var(--text-tertiary)] mb-2">
              Image <span className="normal-case text-[var(--text-muted)]">(optional)</span>
            </label>
            <input
              value={form.image ?? ''}
              onChange={(e) => setForm((p) => ({ ...p, image: e.target.value }))}
              className="w-full h-11 px-4 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)] transition-all mono text-sm"
              placeholder="ghcr.io/org/app:latest"
            />
          </div>

          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-[var(--text-tertiary)] mb-2">
              Command <span className="normal-case text-[var(--text-muted)]">(optional)</span>
            </label>
            <input
              value={form.command ?? ''}
              onChange={(e) => setForm((p) => ({ ...p, command: e.target.value }))}
              className="w-full h-11 px-4 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)] transition-all mono text-sm"
              placeholder="npm run start"
            />
          </div>
        </div>

        {props.errorMessage && (
          <div className="mt-4 px-4 py-3 rounded-[var(--radius-md)] bg-[var(--error-soft)] text-sm text-[var(--error)]">
            {props.errorMessage}
          </div>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={props.onClose}
            className="px-4 py-2 rounded-[var(--radius-md)] border border-[var(--border-subtle)] text-[var(--text-secondary)] text-sm font-medium hover:text-[var(--text-primary)] hover:border-[var(--border-default)] transition-colors"
          >
            Cancel
          </button>
          <button
            disabled={!form.name.trim() || props.loading}
            onClick={() => props.onSubmit({ ...form, name: form.name.trim(), image: form.image?.trim(), command: form.command?.trim() })}
            className="px-5 py-2 rounded-[var(--radius-md)] text-white text-sm font-medium shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            style={{ background: '#e8316a' }}
          >
            {props.loading ? 'Creating...' : 'Create Service'}
          </button>
        </div>
      </div>
    </div>
  );
}


export function ProjectWorkspacePage() {
  const { projectId = '' } = useParams<{ projectId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();

  const activeView = (searchParams.get('view') as WorkspaceView | null) ?? 'canvas';
  const isDemoMode = searchParams.get('demo') === '1';
  const [createOpen, setCreateOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setCommandPaletteOpen((open) => !open);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const projectQuery = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => getProjectById(projectId),
    enabled: Boolean(projectId) && !isDemoMode,
  });

  const servicesQuery = useQuery({
    queryKey: ['project-services', projectId],
    queryFn: () => listServicesByProject(projectId),
    enabled: Boolean(projectId) && !isDemoMode,
  });

  const createServiceMutation = useMutation({
    mutationFn: (payload: CreateServiceInput) => createService(projectId, payload),
    onSuccess: () => {
      setCreateOpen(false);
      queryClient.invalidateQueries({ queryKey: ['project-services', projectId] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });

  const project = useMemo(
    () => (isDemoMode ? getDemoProjectById(projectId) : projectQuery.data),
    [isDemoMode, projectId, projectQuery.data],
  );
  const services = useMemo(
    () => (isDemoMode ? getDemoServicesByProject(projectId) : servicesQuery.data ?? []),
    [isDemoMode, projectId, servicesQuery.data],
  );
  const serviceIdFingerprint = services.map((service) => service.id).sort().join('|');

  const variablesQuery = useQuery({
    queryKey: ['project-service-vars', projectId, serviceIdFingerprint],
    queryFn: async () => {
      const entries = await Promise.all(
        services.map(async (service) => {
          const variables = await listServiceVariables(service.id);
          return [service.id, variables.map((variable) => ({
            key: variable.key,
            value: variable.value,
            isSecret: variable.isSecret,
          }))] as const;
        }),
      );

      return Object.fromEntries(entries) as Record<string, ServiceVariable[]>;
    },
    enabled: !isDemoMode && services.length > 0,
  });

  const variablesByService = isDemoMode ? getDemoVariablesByProject(projectId) : variablesQuery.data ?? {};

  const workspaceLogsQuery = useQuery({
    queryKey: ['workspace-service-logs', projectId, serviceIdFingerprint],
    queryFn: async () => {
      const rows = await Promise.all(
        services.map(async (service) => {
          const logs = await listServiceLogs(service.id, { tail: '20' });
          return logs.map((entry) => ({
            serviceId: service.id,
            serviceName: service.name,
            stream: entry.stream,
            message: entry.message,
            timestamp: entry.timestamp,
          }));
        }),
      );

      return rows
        .flat()
        .sort((left, right) => {
          const leftValue = left.timestamp ? new Date(left.timestamp).getTime() : 0;
          const rightValue = right.timestamp ? new Date(right.timestamp).getTime() : 0;
          return rightValue - leftValue;
        })
        .slice(0, 200);
    },
    enabled: !isDemoMode && activeView === 'logs' && services.length > 0,
  });

  const runningServices = useMemo(() => services.filter((service) => service.status === 'running').length, [services]);
  const serviceHref = (serviceId: string) =>
    isDemoMode
      ? `/projects/${projectId}/services/${serviceId}?demo=1`
      : `/projects/${projectId}/services/${serviceId}`;

  if (!isDemoMode && projectQuery.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center gap-3 text-[var(--text-secondary)]">
          <Loader2 size={20} className="animate-spin" />
          <span>Loading workspace...</span>
        </div>
      </div>
    );
  }

  if ((!isDemoMode && projectQuery.isError) || !project) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="panel p-8 text-center max-w-md">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-[var(--error-soft)] flex items-center justify-center">
            <X size={24} className="text-[var(--error)]" />
          </div>
          <p className="text-lg font-medium text-[var(--text-primary)]">Project not found</p>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            This project may have been deleted or you don't have access.
          </p>
          <button
            onClick={() => navigate('/projects')}
            className="mt-6 px-4 py-2 rounded-[var(--radius-md)] border border-[var(--border-subtle)] text-sm font-medium hover:border-[var(--border-default)] transition-colors"
          >
            Back to Projects
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="border-b border-[var(--border-subtle)] bg-[var(--bg-base)]/50 backdrop-blur-sm">
        <div className="mx-auto w-full max-w-[1400px] px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/projects')}
                className="flex items-center gap-2 text-sm text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
              >
                <ArrowLeft size={16} />
                <span>Projects</span>
              </button>
              <div className="w-px h-5 bg-[var(--border-subtle)]" />
              <div>
                <h1 className="text-xl font-semibold text-[var(--text-primary)]">{project.name}</h1>
                <p className="text-sm text-[var(--text-secondary)]">{project.description || 'No description'}</p>
              </div>
            </div>

            <div className="flex items-center gap-6">
              {/* Stats */}
              <div className="hidden md:flex items-center gap-6">
                <div className="text-center">
                  <p className="text-2xl font-semibold text-[var(--text-primary)]">{services.length}</p>
                  <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Services</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-semibold text-[var(--success)]">{runningServices}</p>
                  <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Running</p>
                </div>
                <div className="w-px h-8 bg-[var(--border-subtle)]" />
                <LiveIndicator isLive={runningServices > 0} />
                <div className="w-px h-8 bg-[var(--border-subtle)]" />
                <div className="flex items-center gap-1.5 text-xs text-[var(--text-tertiary)]">
                  <Clock size={12} />
                  <span>{formatRelative(project.updatedAt)}</span>
                </div>
              </div>

              {/* Search / Command Palette */}
              <button
                onClick={() => setCommandPaletteOpen(true)}
                className="hidden md:flex items-center gap-2 h-9 px-3 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] text-[var(--text-muted)] text-sm hover:border-[var(--border-default)] hover:text-[var(--text-secondary)] transition-colors"
              >
                <Search size={14} />
                <span>Search...</span>
                <kbd className="ml-2 px-1.5 py-0.5 rounded bg-[var(--surface-card)] text-[10px] font-mono">⌘K</kbd>
              </button>

              {/* Add Service Button */}
              {!isDemoMode && (
                <button
                  onClick={() => setCreateOpen(true)}
                  className="flex items-center gap-2 h-9 px-4 rounded-[var(--radius-md)] text-white text-sm font-medium shadow-lg hover:shadow-xl transition-all"
                  style={{ background: '#e8316a' }}
                >
                  <Plus size={16} />
                  <span className="hidden sm:inline">Add Service</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Demo Mode Banner */}
      {isDemoMode && (
        <div className="mx-auto w-full max-w-[1400px] px-6 py-4">
          <div className="px-4 py-3 rounded-[var(--radius-md)] border border-[var(--warning-soft)] bg-[var(--warning-soft)]/50">
            <div className="flex items-center gap-2 text-sm text-[var(--warning)]">
              <Sparkles size={16} />
              <span>Demo mode active — using sample data for preview</span>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="mx-auto w-full max-w-[1400px] px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr] gap-6">
          {/* Sidebar Navigation */}
          <aside className="lg:sticky lg:top-6 lg:h-fit">
            <nav className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0">
              {viewItems.map((item) => {
                const active = activeView === item.key;
                const Icon = item.icon;
                return (
                  <button
                    key={item.key}
                    onClick={() => setSearchParams((prev) => {
                      const next = new URLSearchParams(prev);
                      next.set('view', item.key);
                      return next;
                    })}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius-md)] transition-all whitespace-nowrap ${
                      active
                        ? 'bg-[var(--accent-primary-soft)] text-[var(--accent-primary)]'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-muted)]'
                    }`}
                  >
                    <Icon size={18} />
                    <span className="text-sm font-medium">{item.label}</span>
                    {active && (
                      <div className="hidden lg:block absolute left-0 w-0.5 h-5 bg-[var(--accent-primary)] rounded-full" />
                    )}
                  </button>
                );
              })}
            </nav>
          </aside>

          {/* Content Area */}
          <section className="min-w-0">
            {activeView === 'canvas' && (
              <ProjectCanvas
                projectId={project.id}
                services={services}
                variablesByService={variablesByService}
                onAddService={() => setCreateOpen(true)}
                onOpenService={(serviceId) => navigate(serviceHref(serviceId))}
              />
            )}

            {activeView === 'observability' && (
              <div className="space-y-6">
                {/* Health Summary */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="panel-soft p-4">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-[var(--success)] live-pulse" />
                      <p className="text-xs uppercase tracking-wider text-[var(--text-muted)]">Healthy</p>
                    </div>
                    <p className="mt-2 text-3xl font-semibold text-[var(--success)]">{runningServices}</p>
                  </div>
                  <div className="panel-soft p-4">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-[var(--error)]" />
                      <p className="text-xs uppercase tracking-wider text-[var(--text-muted)]">Failed</p>
                    </div>
                    <p className="mt-2 text-3xl font-semibold text-[var(--error)]">
                      {services.filter((s) => s.status === 'failed').length}
                    </p>
                  </div>
                  <div className="panel-soft p-4">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-[var(--warning)] animate-pulse" />
                      <p className="text-xs uppercase tracking-wider text-[var(--text-muted)]">Building</p>
                    </div>
                    <p className="mt-2 text-3xl font-semibold text-[var(--warning)]">
                      {services.filter((s) => s.status === 'building').length}
                    </p>
                  </div>
                </div>

                {/* Metrics Dashboard */}
                <MetricsDashboard
                  isRunning={runningServices > 0}
                  onStop={() => toast.showToast('Services stopped', 'warning')}
                  onRestart={() => toast.showToast('Services restarted', 'success')}
                />

                {/* Service List */}
                <div className="panel p-6">
                  <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-3">Services</h3>
                  <div className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] overflow-hidden divide-y divide-[var(--border-subtle)]">
                    {services.length === 0 ? (
                      <div className="p-8 text-center">
                        <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-[var(--surface-muted)] flex items-center justify-center">
                          <Layers size={20} className="text-[var(--text-tertiary)]" />
                        </div>
                        <p className="text-sm text-[var(--text-secondary)]">No services deployed yet</p>
                        <p className="text-xs text-[var(--text-muted)] mt-1">Add services from the Canvas view</p>
                      </div>
                    ) : (
                      services.map((service) => (
                        <button
                          key={service.id}
                          onClick={() => navigate(serviceHref(service.id))}
                          className="w-full flex items-center justify-between px-4 py-3 hover:bg-[var(--surface-muted)]/50 transition-colors text-left"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-[var(--radius-sm)] bg-[var(--surface-card)] border border-[var(--border-subtle)] flex items-center justify-center">
                              <Box size={14} className="text-[var(--text-tertiary)]" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-[var(--text-primary)]">{service.name}</p>
                              <p className="text-xs text-[var(--text-tertiary)]">{service.type}</p>
                            </div>
                          </div>
                          <StatusBadge status={service.status} />
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeView === 'logs' && (
              <div className="panel p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-[var(--radius-md)] bg-[var(--accent-primary-soft)] flex items-center justify-center">
                      <FileText size={20} className="text-[var(--accent-primary)]" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-[var(--text-primary)]">Logs</h2>
                      <p className="text-sm text-[var(--text-secondary)]">Aggregated service output</p>
                    </div>
                  </div>
                  {!isDemoMode && (
                    <button
                      onClick={() => workspaceLogsQuery.refetch()}
                      className="px-3 py-1.5 rounded-[var(--radius-md)] border border-[var(--border-subtle)] text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-default)] transition-colors"
                    >
                      Refresh
                    </button>
                  )}
                </div>

                <div className="mono rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-void)] p-4 text-xs text-[var(--text-secondary)] overflow-x-auto max-h-[600px] overflow-y-auto">
                  {services.length === 0 ? (
                    <p className="text-[var(--text-muted)]">No services available.</p>
                  ) : isDemoMode ? (
                    <div className="space-y-1">
                      {services.slice(0, 10).map((service, i) => (
                        <p key={service.id}>
                          <span className="text-[var(--text-muted)]">
                            [{service.updatedAt ? new Date(new Date(service.updatedAt).getTime() - i * 60000).toLocaleTimeString() : '--:--:--'}]
                          </span>
                          {' '}
                          <span className="text-[var(--accent-primary)]">{service.name}</span>
                          {' '}
                          <span className="text-[var(--text-tertiary)]">status={service.status}</span>
                        </p>
                      ))}
                    </div>
                  ) : workspaceLogsQuery.isLoading ? (
                    <p className="text-[var(--text-muted)]">Loading logs...</p>
                  ) : workspaceLogsQuery.isError ? (
                    <p className="text-[var(--error)]">Failed to load logs.</p>
                  ) : (workspaceLogsQuery.data?.length ?? 0) === 0 ? (
                    <p className="text-[var(--text-muted)]">No recent logs.</p>
                  ) : (
                    <div className="space-y-1">
                      {workspaceLogsQuery.data!.map((entry, i) => (
                        <p key={`${entry.serviceId}-${entry.timestamp}-${i}`}>
                          <span className="text-[var(--text-muted)]">
                            [{entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString() : '--:--:--'}]
                          </span>
                          {' '}
                          <span className="text-[var(--accent-primary)]">{entry.serviceName}</span>
                          {' '}
                          <span className="text-[var(--text-tertiary)]">{entry.stream}</span>
                          {' '}
                          {entry.message}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeView === 'settings' && (
              <div className="panel p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-[var(--radius-md)] bg-[var(--accent-primary-soft)] flex items-center justify-center">
                    <Settings size={20} className="text-[var(--accent-primary)]" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-[var(--text-primary)]">Settings</h2>
                    <p className="text-sm text-[var(--text-secondary)]">Project configuration</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="panel-soft p-4">
                    <p className="text-xs uppercase tracking-wider text-[var(--text-muted)]">Project ID</p>
                    <p className="mono mt-2 text-sm text-[var(--text-primary)] break-all">{project.id}</p>
                  </div>
                  <div className="panel-soft p-4">
                    <p className="text-xs uppercase tracking-wider text-[var(--text-muted)]">Created</p>
                    <p className="mt-2 text-sm text-[var(--text-primary)]">{formatDate(project.createdAt)}</p>
                  </div>
                  <div className="panel-soft p-4 md:col-span-2">
                    <p className="text-xs uppercase tracking-wider text-[var(--text-muted)]">Canvas Storage Key</p>
                    <p className="mono mt-2 text-xs text-[var(--text-secondary)] break-all">{canvasStorageKey(project.id)}</p>
                  </div>
                </div>

                <div className="mt-6 pt-6 border-t border-[var(--border-subtle)]">
                  <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-3">Local Data</h3>
                  <button
                    onClick={() => {
                      clearCanvasMetadata(project.id);
                      window.location.reload();
                    }}
                    className="flex items-center gap-2 px-4 py-2 rounded-[var(--radius-md)] border border-[var(--error-soft)] text-[var(--error)] text-sm font-medium hover:bg-[var(--error-soft)] transition-colors"
                  >
                    <Trash2 size={16} />
                    Reset Canvas Layout
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>

      {/* Create Service Dialog */}
      {!isDemoMode && (
        <ServiceCreateDialog
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          loading={createServiceMutation.isPending}
          errorMessage={createServiceMutation.error ? (createServiceMutation.error as Error).message : undefined}
          onSubmit={(payload) => createServiceMutation.mutate(payload)}
        />
      )}

      {/* Command Palette */}
      <CommandPalette
        open={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        onAddService={(type) => {
          setCreateOpen(true);
          toast.showToast(`Creating ${type} service...`, 'info');
        }}
        onNavigate={(path) => {
          setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            next.set('view', path);
            return next;
          });
        }}
      />

      {/* Error Banner */}
      {!isDemoMode && (servicesQuery.isError || variablesQuery.isError) && (
        <div className="fixed bottom-4 right-4 px-4 py-3 rounded-[var(--radius-md)] bg-[var(--error-soft)] border border-[var(--error)]/20 text-sm text-[var(--error)] shadow-lg">
          Unable to load services for this project.
        </div>
      )}
    </div>
  );
}
