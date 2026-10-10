import { useDeferredValue, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { listAuditLogs } from '@/lib/api-client';
import { useDemoMode } from '@/lib/demo-mode';
import { type FilterConfig } from '@/lib/dynamic-filter';
import { useDynamicFilter } from '@/lib/use-dynamic-filter';
import { formatDate, formatRelative } from '@/lib/time';
import { DemoRestricted, FilterBar } from '@/shared/components';
import { QuietBtn, SCard, SPageHead, SPill, STable, type SCol } from '@/shared/components/sentry';
import { ScrollText, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import type { AuditLogEntity } from '@/lib/api-client';

const PAGE_SIZE = 50;

const rangeOptions = [
  { value: '', label: 'All time' },
  { value: '24h', label: 'Last 24 hours', ms: 24 * 60 * 60 * 1000 },
  { value: '7d', label: 'Last 7 days', ms: 7 * 24 * 60 * 60 * 1000 },
  { value: '30d', label: 'Last 30 days', ms: 30 * 24 * 60 * 60 * 1000 },
] as const;

// Server-backed filters — the engine runs over empty data; values map to
// API params. URL state makes filtered views shareable.
const AUDIT_SCHEMA: FilterConfig<unknown>[] = [
  { key: 'resource', label: 'Resource', type: 'search' },
  { key: 'action', label: 'Action', type: 'search' },
  { key: 'actor', label: 'Actor', type: 'search' },
  {
    key: 'range', label: 'Time', type: 'select',
    options: rangeOptions.filter((o) => o.value !== '').map((o) => ({ value: o.value, label: o.label })),
  },
];

export function AuditLogsPage() {
  const isDemoMode = useDemoMode();
  const filter = useDynamicFilter<unknown>({ data: [], schema: AUDIT_SCHEMA });
  const [page, setPage] = useState(1);
  // Back to page 1 whenever the filter set changes.
  const filtersJson = JSON.stringify(filter.filters);
  const [prevFiltersJson, setPrevFiltersJson] = useState(filtersJson);
  if (prevFiltersJson !== filtersJson) {
    setPrevFiltersJson(filtersJson);
    setPage(1);
  }

  const deferredResource = useDeferredValue(String(filter.filters.resource ?? ''));
  const deferredAction = useDeferredValue(String(filter.filters.action ?? ''));
  const deferredActor = useDeferredValue(String(filter.filters.actor ?? ''));
  const range = filter.filters.range === 'all' ? '' : String(filter.filters.range ?? '');

  const filters = {
    resource: deferredResource.trim() || undefined,
    action: deferredAction.trim() || undefined,
    actor: deferredActor.trim() || undefined,
    page,
    limit: PAGE_SIZE,
  };

  const logsQuery = useQuery({
    queryKey: ['audit-logs', filters, range],
    queryFn: () => {
      const option = rangeOptions.find((o) => o.value === range);
      const since = option && 'ms' in option ? new Date(Date.now() - option.ms).toISOString() : undefined;
      return listAuditLogs({ ...filters, since });
    },
    enabled: !isDemoMode,
  });

  if (isDemoMode) {
    return <DemoRestricted feature="Audit logs" />;
  }

  const logs = logsQuery.data ?? [];
  const hasNext = logs.length === PAGE_SIZE;
  const hasFilters = filter.activeCount > 0;

  const cols: SCol<AuditLogEntity>[] = [
    {
      key: 'time', label: 'Time', width: '100px', sortable: false,
      render: (log) => (
        <span className="v-mono text-[11px] text-[var(--text-tertiary)]" title={log.createdAt ? formatDate(log.createdAt) : undefined}>
          {log.createdAt ? formatRelative(log.createdAt) : '—'}
        </span>
      ),
    },
    {
      key: 'actor', label: 'Actor', width: 'minmax(140px,1.1fr)',
      sortValue: (log) => log.userEmail ?? log.userId ?? 'system',
      render: (log) => (
        <span className="text-[12px] text-[var(--text-primary)] truncate">
          {log.userEmail || (log.userId ? log.userId.slice(0, 8) : 'system')}
        </span>
      ),
    },
    {
      key: 'resource', label: 'Resource', width: 'minmax(120px,1fr)',
      sortValue: (log) => log.resource ?? '',
      render: (log) => <span className="v-mono text-[11.5px] text-[var(--text-secondary)]">{log.resource}</span>,
    },
    {
      key: 'action', label: 'Action', width: 'minmax(130px,1fr)',
      sortValue: (log) => log.action ?? '',
      render: (log) => <SPill tone="info">{log.action}</SPill>,
    },
    {
      key: 'rid', label: 'Resource ID', width: 'minmax(110px,0.8fr)', sortable: false,
      render: (log) => (
        <span className="v-mono text-[10.5px] text-[var(--text-tertiary)] truncate block" title={log.resourceId}>
          {log.resourceId || '—'}
        </span>
      ),
    },
    {
      key: 'ip', label: 'IP', width: '110px', sortable: false,
      render: (log) => <span className="v-mono text-[10.5px] text-[var(--text-tertiary)]">{log.ipAddress?.replace(/\/\d+$/, '') || '—'}</span>,
    },
    {
      key: 'details', label: 'Details', width: 'minmax(160px,1.2fr)', sortable: false,
      render: (log) => (
        <span className="v-mono text-[10.5px] text-[var(--text-tertiary)] truncate block" title={log.details}>
          {log.details && log.details !== '{}' ? log.details : '—'}
        </span>
      ),
    },
  ];

  return (
    <div className="min-h-screen">
      <div className="w-full px-4 pt-6 sm:px-8">
        <SPageHead
          title="Audit Logs"
          titleAccent="_"
          sub="Every authenticated action recorded by the platform"
        />
      </div>

      <div className="w-full px-4 sm:px-8">
        <SCard icon={<ScrollText />} title="Event Log" accent={`page ${page}`} pad={false}>
          <div className="px-4 pt-1 pb-3">
            <FilterBar {...filter} />
          </div>
          <div className="border-t border-[var(--border-subtle)] px-4 overflow-x-auto">
            {logsQuery.isLoading ? (
              <div className="py-10 text-center text-[var(--text-muted)]">
                <Loader2 size={18} className="animate-spin inline-block" />
              </div>
            ) : logsQuery.isError ? (
              <div className="py-10 text-center text-[var(--error)]">Failed to load audit logs.</div>
            ) : logs.length === 0 ? (
              <div className="py-10 text-center">
                <div className="s-ibox mx-auto mb-2"><ScrollText /></div>
                <p className="text-[var(--text-secondary)] text-sm">No audit events{hasFilters ? ' match these filters' : ' recorded yet'}.</p>
              </div>
            ) : (
              <STable cols={cols} rows={logs} rowKey={(l) => l.id} />
            )}
          </div>
          <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--border-subtle)]">
            <p className="v-mono text-[10.5px] text-[var(--text-muted)]">
              Page {page}{logs.length > 0 ? ` — ${logs.length} entries` : ''}
            </p>
            <div className="flex items-center gap-2">
              <QuietBtn onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
                <ChevronLeft size={12} /> Prev
              </QuietBtn>
              <QuietBtn onClick={() => setPage((p) => p + 1)} disabled={!hasNext}>
                Next <ChevronRight size={12} />
              </QuietBtn>
            </div>
          </div>
        </SCard>
      </div>
    </div>
  );
}
