import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  cancelBuild,
  getBuildLogs,
  listBuilds,
  type BuildEntity,
  type BuildStatus,
} from '@/lib/api-client';
import { useBuildUpdates } from '@/lib/use-build-updates';
import { useDemoMode } from '@/lib/demo-mode';
import { type FilterConfig } from '@/lib/dynamic-filter';
import { useDynamicFilter, useFilterState } from '@/lib/use-dynamic-filter';
import { FilterBar } from '@/shared/components';
import { demoBuilds } from '@/lib/demo-data';
import { formatRelative } from '@/lib/time';
import {
  SCard,
  SPageHead,
  SPill,
  SStat,
  STable,
  IconBtn,
  QuietBtn,
  Ticks,
  type SCol,
} from '@/shared/components/sentry';
import { statusTone } from '@/shared/components/sentry-utils';
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
} from 'lucide-react';

const statusOptions: Array<{ value: '' | BuildStatus; label: string }> = [
  { value: '', label: 'All statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'running', label: 'Running' },
  { value: 'success', label: 'Success' },
  { value: 'failed', label: 'Failed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const BUILD_SCHEMA: FilterConfig<BuildEntity>[] = [
  {
    key: 'status', label: 'Status', type: 'select',
    options: statusOptions.filter((o) => o.value !== '').map((o) => ({ value: o.value, label: o.label })),
  },
  { key: 'project', label: 'Project ID', type: 'search', searchFields: ['projectId'] },
  { key: 'service', label: 'Service ID', type: 'search', searchFields: ['serviceId'] },
  {
    key: 'created', label: 'Time', type: 'date-range',
    accessor: (b) => b.startedAt ?? b.completedAt,
  },
];

function BuildIcon({ status }: { status: BuildStatus }) {
  if (status === 'success') return <Check size={14} className="text-[var(--success)]" />;
  if (status === 'failed') return <X size={14} className="text-[var(--error)]" />;
  if (status === 'running') return <Loader2 size={14} className="text-[var(--warning)] animate-spin" />;
  return <Clock size={14} className="text-[var(--text-tertiary)]" />;
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
  const isDemoMode = useDemoMode();

  const { filters } = useFilterState(BUILD_SCHEMA);
  const projectFilter = String(filters.project ?? '');
  const serviceFilter = String(filters.service ?? '');
  const statusFilter = filters.status === 'all' ? '' : String(filters.status ?? '');
  const [limit, setLimit] = useState(50);
  const [selectedBuild, setSelectedBuild] = useState<BuildEntity | null>(null);

  const buildsQuery = useQuery({
    queryKey: ['builds-page', { projectFilter, serviceFilter, statusFilter, limit }],
    enabled: !isDemoMode,
    queryFn: () =>
      listBuilds({
        projectId: projectFilter || undefined,
        serviceId: serviceFilter || undefined,
        status: (statusFilter || undefined) as BuildStatus | undefined,
        page: 1,
        limit,
      }),
  });

  const rawBuilds = useMemo(
    () => (isDemoMode ? demoBuilds : buildsQuery.data?.builds ?? []),
    [isDemoMode, buildsQuery.data?.builds],
  );
  const filter = useDynamicFilter<BuildEntity>({ data: rawBuilds, schema: BUILD_SCHEMA });
  const builds = filter.filteredData;

  const subscribedBuildIds = useMemo(
    () => (isDemoMode ? [] : rawBuilds.map((build) => build.id)),
    [isDemoMode, rawBuilds],
  );
  const liveStatus = useBuildUpdates(subscribedBuildIds, ({ channel }) => {
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

  // Stats
  const stats = useMemo(() => {
    const running = builds.filter(b => b.status === 'running' || b.status === 'pending').length;
    const success = builds.filter(b => b.status === 'success').length;
    const failed = builds.filter(b => b.status === 'failed').length;
    return { running, success, failed, total: builds.length };
  }, [builds]);

  const buildCols: SCol<BuildEntity>[] = [
    {
      key: 'build', label: 'Build', width: 'minmax(220px,1.4fr)',
      sortValue: (b) => b.id,
      render: (b) => (
        <span className="flex items-center gap-2.5 min-w-0">
          <span className="s-ibox"><BuildIcon status={b.status} /></span>
          <span className="min-w-0">
            <span className="block v-mono text-[12px] font-medium text-[var(--text-primary)] truncate">{b.id}</span>
            <span className="block v-mono text-[10.5px] text-[var(--text-tertiary)] truncate">
              {b.imageName || '—'}{b.imageTag ? `:${b.imageTag}` : ''}
            </span>
          </span>
        </span>
      ),
    },
    {
      key: 'status', label: 'Status', width: '110px',
      sortValue: (b) => b.status,
      render: (b) => <SPill tone={statusTone(b.status)}>{b.status}</SPill>,
    },
    {
      key: 'progress', label: 'Progress', width: '1fr',
      sortValue: (b) => b.progress,
      render: (b) =>
        b.status === 'running' || b.status === 'pending' ? (
          <span className="flex items-center gap-2.5">
            <Ticks pct={b.progress} count={40} />
            <span className="v-mono text-[10.5px] text-[var(--text-tertiary)]">{b.progress}%</span>
          </span>
        ) : (
          <span className="v-mono text-[10.5px] text-[var(--text-muted)]">—</span>
        ),
    },
    {
      key: 'size', label: 'Size', width: '90px',
      sortValue: (b) => b.size,
      render: (b) => <span className="v-mono text-[11.5px] text-[var(--text-secondary)]">{bytesToHumanReadable(b.size)}</span>,
    },
    {
      key: 'service', label: 'Service', width: '1fr',
      sortValue: (b) => b.serviceId ?? '',
      render: (b) => <span className="v-mono text-[11px] text-[var(--text-tertiary)] truncate">{b.serviceId || '—'}</span>,
    },
    {
      key: 'when', label: 'Started', width: '90px',
      sortValue: (b) => b.startedAt ?? '',
      render: (b) => <span className="v-mono text-[11px] text-[var(--text-tertiary)]">{b.startedAt ? formatRelative(b.startedAt) : '—'}</span>,
    },
  ];

  return (
    <div className="min-h-screen">
      <div className="w-full px-4 pt-6 sm:px-8">
        <SPageHead
          title="Build Pipeline"
          titleAccent="_"
          sub="Monitor build progress and manage jobs"
          actions={
            <>
              <div className="flex items-center gap-2 text-[11px] v-mono">
                <div className={`w-1.5 h-1.5 rounded-full ${liveStatus === 'live' ? 'bg-[var(--success)] animate-pulse' : 'bg-[var(--text-muted)]'}`} />
                <span className={liveStatus === 'live' ? 'text-[var(--success)]' : 'text-[var(--text-muted)]'}>
                  {liveStatus === 'live' ? 'live' : liveStatus === 'offline' ? 'reconnecting' : 'polling'}
                </span>
              </div>
              <IconBtn onClick={() => queryClient.invalidateQueries({ queryKey: ['builds-page'] })} title="Refresh builds">
                <RefreshCw size={14} />
              </IconBtn>
            </>
          }
        />
      </div>

      {/* Demo Mode Banner */}
      {isDemoMode && (
        <div className="w-full px-8 py-4">
          <div className="s-inset flex items-center gap-2 text-xs text-[var(--warning)]">
            <Sparkles size={13} />
            Demo mode active — using sample data
          </div>
        </div>
      )}

      <div className="w-full px-4 py-6 sm:px-8 space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          <SStat icon={<Box />} label="Total Builds" value={stats.total} foot="all jobs" />
          <SStat icon={<Loader2 />} label="In Progress" value={stats.running} foot="building now" />
          <SStat icon={<Check />} label="Successful" value={stats.success} foot="completed ok" />
          <SStat icon={<X />} label="Failed" value={stats.failed} foot="need attention" />
        </div>

        <SCard icon={<Filter />} title="Filters"
          trail={<span className="v-mono text-[10.5px] text-[var(--text-muted)]">{builds.length} jobs shown</span>}
        >
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[280px]">
              <FilterBar {...filter} />
            </div>
            <div>
              <label className="block text-[10.5px] font-medium uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
                Page Size
              </label>
              <select
                value={String(limit)}
                onChange={(e) => setLimit(Number(e.target.value))}
                className="s-chip !cursor-pointer appearance-none pr-6"
              >
                <option value="20">20</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </select>
            </div>
          </div>
        </SCard>

        <SCard icon={<Box />} title="Build Queue" accent={`${builds.length} jobs`} pad={false}
          trail={
            <IconBtn onClick={() => queryClient.invalidateQueries({ queryKey: ['builds-page'] })} title="Refresh">
              <RefreshCw size={13} />
            </IconBtn>
          }
        >
          {!isDemoMode && buildsQuery.isLoading ? (
            <div className="p-12 text-center">
              <Loader2 size={24} className="animate-spin mx-auto text-[var(--text-tertiary)]" />
              <p className="mt-3 text-sm text-[var(--text-muted)]">Loading builds...</p>
            </div>
          ) : !isDemoMode && buildsQuery.isError ? (
            <div className="p-10 text-center">
              <p className="text-sm text-[var(--error)]">Failed to load builds</p>
              <p className="text-xs text-[var(--text-muted)] mt-1">{buildsQuery.error instanceof Error ? buildsQuery.error.message : 'Unknown error'}</p>
            </div>
          ) : builds.length === 0 ? (
            <div className="p-12 text-center">
              <div className="s-ibox mx-auto mb-3 !w-10 !h-10"><Box /></div>
              <p className="text-sm text-[var(--text-muted)]">No builds match current filters</p>
            </div>
          ) : (
            <div className="px-4">
              <STable
                cols={buildCols}
                rows={builds}
                rowKey={(b) => b.id}
                onRowClick={(b) => setSelectedBuild(b)}
              />
            </div>
          )}
        </SCard>
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
          <div className="relative w-full max-w-3xl s-card">
            <div className="s-cardhead">
              <span className="s-ibox"><FileText /></span>
              <div>
                <div className="s-t">Build Logs</div>
                <div className="v-mono mt-0.5 text-[11px] text-[var(--text-tertiary)]">{selectedBuild.id}</div>
              </div>
              <div className="s-trail">
                <QuietBtn onClick={() => setSelectedBuild(null)}>Close</QuietBtn>
              </div>
            </div>
            <div className="px-4 pb-4">

            <div className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-void)] p-4 max-h-[400px] overflow-auto">
              <pre className="v-mono text-xs text-[var(--text-secondary)] whitespace-pre-wrap break-all">
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
        </div>
      )}
    </div>
  );
}
