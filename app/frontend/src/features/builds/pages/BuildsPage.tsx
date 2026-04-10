import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import {
  cancelBuild,
  getBuildLogs,
  listBuilds,
  type BuildEntity,
  type BuildStatus,
} from '@/lib/api-client';
import { useBuildUpdates } from '@/lib/use-build-updates';
import { formatRelative } from '@/lib/time';
import {
  Check,
  X,
  Loader2,
  Clock,
  RefreshCw,
  FileText,
  Box,
  Sparkles,
  Filter,
  Circle,
  HardDrive,
} from 'lucide-react';

const statusOptions: Array<{ value: '' | BuildStatus; label: string }> = [
  { value: '', label: 'All statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'running', label: 'Running' },
  { value: 'success', label: 'Success' },
  { value: 'failed', label: 'Failed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const demoBuilds: BuildEntity[] = [
  {
    id: 'build-demo-01',
    projectId: 'project-demo',
    serviceId: 'service-api',
    status: 'success',
    progress: 100,
    startedAt: new Date(Date.now() - 20 * 60_000).toISOString(),
    completedAt: new Date(Date.now() - 18 * 60_000).toISOString(),
    imageName: 'ghcr.io/containr/api',
    imageTag: 'sha-1f2e3d4',
    size: 156_000_000,
    log: '[demo] Build finished successfully.',
    metadata: { branch: 'main' },
  },
  {
    id: 'build-demo-02',
    projectId: 'project-demo',
    serviceId: 'service-worker',
    status: 'running',
    progress: 54,
    startedAt: new Date(Date.now() - 2 * 60_000).toISOString(),
    imageName: 'ghcr.io/containr/worker',
    imageTag: 'sha-9a8b7c6',
    size: 0,
    log: '[demo] Building image layers...',
    metadata: { branch: 'feature/queue' },
  },
];

function StatusBadge({ status }: { status: BuildStatus }) {
  const config = {
    success: { color: 'var(--success)', bg: 'var(--success-soft)', Icon: Check, animate: false },
    failed: { color: 'var(--error)', bg: 'var(--error-soft)', Icon: X, animate: false },
    running: { color: 'var(--warning)', bg: 'var(--warning-soft)', Icon: Loader2, animate: true },
    pending: { color: 'var(--text-tertiary)', bg: 'var(--surface-muted)', Icon: Clock, animate: false },
    cancelled: { color: 'var(--text-tertiary)', bg: 'var(--surface-muted)', Icon: X, animate: false },
  }[status] || { color: 'var(--text-tertiary)', bg: 'var(--surface-muted)', Icon: Circle, animate: false };

  const { Icon } = config;

  return (
    <div 
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
      style={{ background: config.bg, color: config.color }}
    >
      <Icon size={12} className={config.animate ? 'animate-spin' : ''} />
      {status}
    </div>
  );
}

function bytesToHumanReadable(bytes: number): string {
  if (bytes <= 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

export function BuildsPage() {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const isDemoMode = searchParams.get('demo') === '1';

  const [projectFilter, setProjectFilter] = useState('');
  const [serviceFilter, setServiceFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'' | BuildStatus>('');
  const [limit, setLimit] = useState(50);
  const [selectedBuild, setSelectedBuild] = useState<BuildEntity | null>(null);

  const buildsQuery = useQuery({
    queryKey: ['builds-page', { projectFilter, serviceFilter, statusFilter, limit }],
    enabled: !isDemoMode,
    queryFn: () =>
      listBuilds({
        projectId: projectFilter || undefined,
        serviceId: serviceFilter || undefined,
        status: statusFilter || undefined,
        page: 1,
        limit,
      }),
  });

  const builds = useMemo(
    () => (isDemoMode ? demoBuilds : buildsQuery.data?.builds ?? []),
    [isDemoMode, buildsQuery.data?.builds],
  );

  const subscribedBuildIds = useMemo(() => builds.map((build) => build.id), [builds]);
  const liveConnected = useBuildUpdates(subscribedBuildIds, ({ channel }) => {
    queryClient.invalidateQueries({ queryKey: ['builds-page'] });
    queryClient.invalidateQueries({ queryKey: ['usage-builds'] });
    if (selectedBuild && channel === `build:${selectedBuild.id}`) {
      queryClient.invalidateQueries({ queryKey: ['build-logs', selectedBuild.id] });
    }
  });

  const cancelMutation = useMutation({
    mutationFn: (buildId: string) => cancelBuild(buildId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['builds-page'] });
      queryClient.invalidateQueries({ queryKey: ['usage-builds'] });
    },
  });

  const logsQuery = useQuery({
    queryKey: ['build-logs', selectedBuild?.id],
    enabled: Boolean(selectedBuild) && !isDemoMode,
    queryFn: () => getBuildLogs(selectedBuild!.id),
  });

  const isCancellingBuild = (buildId: string): boolean =>
    cancelMutation.isPending && cancelMutation.variables === buildId;

  // Stats
  const stats = useMemo(() => {
    const running = builds.filter(b => b.status === 'running' || b.status === 'pending').length;
    const success = builds.filter(b => b.status === 'success').length;
    const failed = builds.filter(b => b.status === 'failed').length;
    return { running, success, failed, total: builds.length };
  }, [builds]);

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="border-b border-[var(--border-subtle)] bg-[var(--bg-base)]/50 backdrop-blur-sm">
        <div className="mx-auto w-full max-w-[1400px] px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-xl font-semibold text-[var(--text-primary)]">Build Pipeline</h1>
              <p className="text-sm text-[var(--text-secondary)]">Monitor build progress and manage jobs</p>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm">
                <div className={`w-2 h-2 rounded-full ${liveConnected ? 'bg-[var(--success)] animate-pulse' : 'bg-[var(--text-muted)]'}`} />
                <span className={liveConnected ? 'text-[var(--success)]' : 'text-[var(--text-muted)]'}>
                  {liveConnected ? 'Live' : 'Offline'}
                </span>
              </div>
              <button
                onClick={() => queryClient.invalidateQueries({ queryKey: ['builds-page'] })}
                className="flex items-center gap-2 h-9 px-4 rounded-[var(--radius-md)] border border-[var(--border-subtle)] text-sm font-medium hover:border-[var(--border-default)] transition-colors"
              >
                <RefreshCw size={14} />
                Refresh
              </button>
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
              <span>Demo mode active — using sample data</span>
            </div>
          </div>
        </div>
      )}

      {/* Stats Overview */}
      <div className="mx-auto w-full max-w-[1400px] px-6 py-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="panel p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="w-8 h-8 rounded-[var(--radius-sm)] bg-[var(--accent-primary-soft)] flex items-center justify-center">
                <Box size={16} className="text-[var(--accent-primary)]" />
              </div>
            </div>
            <p className="text-2xl font-semibold text-[var(--text-primary)]">{stats.total}</p>
            <p className="text-xs text-[var(--text-muted)] mt-1">Total Builds</p>
          </div>
          <div className="panel p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="w-8 h-8 rounded-[var(--radius-sm)] bg-[var(--warning-soft)] flex items-center justify-center">
                <Loader2 size={16} className="text-[var(--warning)]" />
              </div>
            </div>
            <p className="text-2xl font-semibold text-[var(--warning)]">{stats.running}</p>
            <p className="text-xs text-[var(--text-muted)] mt-1">In Progress</p>
          </div>
          <div className="panel p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="w-8 h-8 rounded-[var(--radius-sm)] bg-[var(--success-soft)] flex items-center justify-center">
                <Check size={16} className="text-[var(--success)]" />
              </div>
            </div>
            <p className="text-2xl font-semibold text-[var(--success)]">{stats.success}</p>
            <p className="text-xs text-[var(--text-muted)] mt-1">Successful</p>
          </div>
          <div className="panel p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="w-8 h-8 rounded-[var(--radius-sm)] bg-[var(--error-soft)] flex items-center justify-center">
                <X size={16} className="text-[var(--error)]" />
              </div>
            </div>
            <p className="text-2xl font-semibold text-[var(--error)]">{stats.failed}</p>
            <p className="text-xs text-[var(--text-muted)] mt-1">Failed</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="mx-auto w-full max-w-[1400px] px-6">
        <div className="panel p-4">
          <div className="flex items-center gap-2 mb-4">
            <Filter size={16} className="text-[var(--text-tertiary)]" />
            <span className="text-sm font-medium text-[var(--text-secondary)]">Filters</span>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium uppercase tracking-wider text-[var(--text-muted)] mb-2">
                Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as '' | BuildStatus)}
                className="w-full h-10 px-3 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] text-sm focus:border-[var(--accent-primary)] transition-colors"
              >
                {statusOptions.map((option) => (
                  <option key={option.label} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium uppercase tracking-wider text-[var(--text-muted)] mb-2">
                Project ID
              </label>
              <input
                value={projectFilter}
                onChange={(e) => setProjectFilter(e.target.value)}
                className="w-full h-10 px-3 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] text-sm focus:border-[var(--accent-primary)] transition-colors"
                placeholder="project-123"
              />
            </div>
            <div>
              <label className="block text-xs font-medium uppercase tracking-wider text-[var(--text-muted)] mb-2">
                Service ID
              </label>
              <input
                value={serviceFilter}
                onChange={(e) => setServiceFilter(e.target.value)}
                className="w-full h-10 px-3 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] text-sm focus:border-[var(--accent-primary)] transition-colors"
                placeholder="service-abc"
              />
            </div>
            <div>
              <label className="block text-xs font-medium uppercase tracking-wider text-[var(--text-muted)] mb-2">
                Page Size
              </label>
              <select
                value={String(limit)}
                onChange={(e) => setLimit(Number(e.target.value))}
                className="w-full h-10 px-3 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] text-sm focus:border-[var(--accent-primary)] transition-colors"
              >
                <option value="20">20</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Build Table */}
      <div className="mx-auto w-full max-w-[1400px] px-6 py-6">
        <div className="panel overflow-hidden">
          {!isDemoMode && buildsQuery.isLoading ? (
            <div className="p-12 text-center">
              <Loader2 size={24} className="animate-spin mx-auto text-[var(--text-tertiary)]" />
              <p className="mt-3 text-sm text-[var(--text-muted)]">Loading builds...</p>
            </div>
          ) : null}

          {!isDemoMode && buildsQuery.isError ? (
            <div className="p-8 text-center">
              <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-[var(--error-soft)] flex items-center justify-center">
                <X size={24} className="text-[var(--error)]" />
              </div>
              <p className="text-sm text-[var(--error)]">Failed to load builds</p>
              <p className="text-xs text-[var(--text-muted)] mt-1">{buildsQuery.error instanceof Error ? buildsQuery.error.message : 'Unknown error'}</p>
            </div>
          ) : null}

          {builds.length === 0 && !buildsQuery.isLoading ? (
            <div className="p-12 text-center">
              <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-[var(--surface-muted)] flex items-center justify-center">
                <Box size={24} className="text-[var(--text-tertiary)]" />
              </div>
              <p className="text-sm text-[var(--text-muted)]">No builds match current filters</p>
            </div>
          ) : null}

          {builds.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-4">
              {builds.map((build) => (
                <div 
                  key={build.id} 
                  className="panel p-4 group hover:border-[var(--accent-primary)]/30 transition-all duration-300 card-lift cursor-pointer"
                  onClick={() => setSelectedBuild(build)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        build.status === 'success' 
                          ? 'bg-[var(--success-soft)]' 
                          : build.status === 'failed'
                          ? 'bg-[var(--error-soft)]'
                          : build.status === 'running'
                          ? 'bg-[var(--warning-soft)]'
                          : 'bg-[var(--surface-muted)]'
                      }`}>
                        {build.status === 'success' && <Check size={18} className="text-[var(--success)]" />}
                        {build.status === 'failed' && <X size={18} className="text-[var(--error)]" />}
                        {build.status === 'running' && <Loader2 size={18} className="text-[var(--warning)] animate-spin" />}
                        {build.status === 'pending' && <Clock size={18} className="text-[var(--text-tertiary)]" />}
                        {build.status === 'cancelled' && <X size={18} className="text-[var(--text-tertiary)]" />}
                      </div>
                      <div>
                        <p className="mono text-sm font-medium text-[var(--text-primary)]">{build.id}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <StatusBadge status={build.status} />
                          <span className="text-xs text-[var(--text-tertiary)]">
                            {build.startedAt ? formatRelative(build.startedAt) : '—'}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="p-2 rounded-lg hover:bg-[var(--surface-muted)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-all">
                        <FileText size={14} />
                      </button>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    {/* Image info */}
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[var(--text-tertiary)]">Image</span>
                      <span className="mono text-[var(--text-secondary)]">
                        {build.imageName || '—'}:{build.imageTag || 'latest'}
                      </span>
                    </div>
                    
                    {/* Progress bar */}
                    {(build.status === 'running' || build.status === 'pending') && (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-[var(--text-tertiary)]">Progress</span>
                          <span className="text-[var(--text-secondary)] font-medium">{build.progress}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-[var(--surface-muted)] overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-300"
                            style={{ width: `${Math.max(0, Math.min(100, build.progress))}%`, background: '#e8316a' }}
                          />
                        </div>
                      </div>
                    )}
                    
                    {/* Size and service */}
                    <div className="flex items-center justify-between text-xs pt-2 border-t border-[var(--border-subtle)]">
                      <div className="flex items-center gap-1.5 text-[var(--text-tertiary)]">
                        <HardDrive size={10} />
                        <span>{bytesToHumanReadable(build.size)}</span>
                      </div>
                      <span className="mono text-[var(--text-tertiary)]">{build.serviceId || '—'}</span>
                    </div>
                  </div>
                  
                  {/* Error message if present */}
                  {build.error && (
                    <div className="mt-3 p-2 rounded-lg bg-[var(--error-soft)]/50 border border-[var(--error)]/20">
                      <p className="text-xs text-[var(--error)] line-clamp-2">{build.error}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {/* Error Toast */}
      {cancelMutation.isError && (
        <div className="fixed bottom-4 right-4 px-4 py-3 rounded-[var(--radius-md)] bg-[var(--error-soft)] border border-[var(--error)]/20 text-sm text-[var(--error)] shadow-lg">
          {cancelMutation.error instanceof Error ? cancelMutation.error.message : 'Failed to cancel build.'}
        </div>
      )}

      {/* Logs Modal */}
      {selectedBuild && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-[var(--bg-void)]/80 backdrop-blur-sm" onClick={() => setSelectedBuild(null)} />
          <div className="relative w-full max-w-3xl panel p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-[var(--radius-md)] bg-[var(--accent-primary-soft)] flex items-center justify-center">
                  <FileText size={20} className="text-[var(--accent-primary)]" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-[var(--text-primary)]">Build Logs</h2>
                  <p className="mono text-xs text-[var(--text-tertiary)]">{selectedBuild.id}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedBuild(null)}
                className="px-4 py-2 rounded-[var(--radius-md)] border border-[var(--border-subtle)] text-sm font-medium hover:border-[var(--border-default)] transition-colors"
              >
                Close
              </button>
            </div>

            <div className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-void)] p-4 max-h-[400px] overflow-auto">
              <pre className="mono text-xs text-[var(--text-secondary)] whitespace-pre-wrap break-all">
                {isDemoMode
                  ? selectedBuild.log || '[demo] No logs available.'
                  : logsQuery.isLoading
                  ? 'Loading logs...'
                  : logsQuery.isError
                  ? 'Failed to load logs.'
                  : logsQuery.data || '(empty logs)'}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
