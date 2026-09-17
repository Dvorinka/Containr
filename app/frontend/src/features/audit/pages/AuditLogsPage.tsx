import { useDeferredValue, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { listAuditLogs } from '@/lib/api-client';
import { formatDate, formatRelative } from '@/lib/time';
import { ScrollText, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';

const PAGE_SIZE = 50;

const rangeOptions = [
  { value: '', label: 'All time' },
  { value: '24h', label: 'Last 24 hours', ms: 24 * 60 * 60 * 1000 },
  { value: '7d', label: 'Last 7 days', ms: 7 * 24 * 60 * 60 * 1000 },
  { value: '30d', label: 'Last 30 days', ms: 30 * 24 * 60 * 60 * 1000 },
] as const;

const inputClass =
  'h-9 px-3 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)] transition-all';

export function AuditLogsPage() {
  const [resource, setResource] = useState('');
  const [action, setAction] = useState('');
  const [actor, setActor] = useState('');
  const [range, setRange] = useState('');
  const [page, setPage] = useState(1);

  const deferredResource = useDeferredValue(resource);
  const deferredAction = useDeferredValue(action);
  const deferredActor = useDeferredValue(actor);

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
  });

  const logs = logsQuery.data ?? [];
  const hasNext = logs.length === PAGE_SIZE;
  const hasFilters = Boolean(resource || action || actor || range);

  const resetFilters = () => {
    setResource('');
    setAction('');
    setActor('');
    setRange('');
    setPage(1);
  };

  return (
    <div className="min-h-screen">
      <div className="border-b border-[var(--border-subtle)]">
        <div className="w-full px-8 py-5">
          <h1 className="v-title">
            Audit Logs<span className="v-cursor">_</span>
          </h1>
          <p className="v-mono mt-1.5 text-[11px] text-[var(--text-tertiary)]">
            Every authenticated action recorded by the platform
          </p>
        </div>
      </div>

      <div className="w-full px-8 py-6">
        <section className="panel p-6">
          <div className="flex flex-wrap items-end gap-3 mb-5">
            <div>
              <label className="block text-xs font-medium uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
                Resource
              </label>
              <input
                value={resource}
                onChange={(e) => { setResource(e.target.value); setPage(1); }}
                placeholder="service, project…"
                className={`${inputClass} w-44`}
              />
            </div>
            <div>
              <label className="block text-xs font-medium uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
                Action
              </label>
              <input
                value={action}
                onChange={(e) => { setAction(e.target.value); setPage(1); }}
                placeholder="create, deploy…"
                className={`${inputClass} w-44`}
              />
            </div>
            <div>
              <label className="block text-xs font-medium uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
                Actor
              </label>
              <input
                value={actor}
                onChange={(e) => { setActor(e.target.value); setPage(1); }}
                placeholder="user email"
                className={`${inputClass} w-52`}
              />
            </div>
            <div>
              <label className="block text-xs font-medium uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
                Time
              </label>
              <select
                value={range}
                onChange={(e) => { setRange(e.target.value); setPage(1); }}
                className={`${inputClass} w-40`}
              >
                {rangeOptions.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            {hasFilters && (
              <button
                onClick={resetFilters}
                className="h-9 px-3 rounded-[var(--radius-md)] border border-[var(--border-subtle)] text-xs font-medium text-[var(--text-secondary)] hover:border-[var(--border-default)] transition-colors"
              >
                Clear
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-subtle)] text-left">
                  <th className="px-3 py-2.5 font-medium uppercase tracking-wider text-xs text-[var(--text-muted)]">Time</th>
                  <th className="px-3 py-2.5 font-medium uppercase tracking-wider text-xs text-[var(--text-muted)]">Actor</th>
                  <th className="px-3 py-2.5 font-medium uppercase tracking-wider text-xs text-[var(--text-muted)]">Resource</th>
                  <th className="px-3 py-2.5 font-medium uppercase tracking-wider text-xs text-[var(--text-muted)]">Action</th>
                  <th className="px-3 py-2.5 font-medium uppercase tracking-wider text-xs text-[var(--text-muted)]">Resource ID</th>
                  <th className="px-3 py-2.5 font-medium uppercase tracking-wider text-xs text-[var(--text-muted)]">IP</th>
                  <th className="px-3 py-2.5 font-medium uppercase tracking-wider text-xs text-[var(--text-muted)]">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {logsQuery.isLoading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-[var(--text-muted)]">
                      <Loader2 size={18} className="animate-spin inline-block" />
                    </td>
                  </tr>
                ) : logsQuery.isError ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-[var(--error)]">
                      Failed to load audit logs.
                    </td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center">
                      <ScrollText size={20} className="inline-block mb-2 text-[var(--text-muted)]" />
                      <p className="text-[var(--text-secondary)]">No audit events{hasFilters ? ' match these filters' : ' recorded yet'}.</p>
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="hover:bg-[var(--surface-muted)]/50 transition-colors">
                      <td className="px-3 py-2.5 whitespace-nowrap text-[var(--text-tertiary)]" title={log.createdAt ? formatDate(log.createdAt) : undefined}>
                        {log.createdAt ? formatRelative(log.createdAt) : '—'}
                      </td>
                      <td className="px-3 py-2.5 text-[var(--text-primary)]">
                        {log.userEmail || (log.userId ? log.userId.slice(0, 8) : 'system')}
                      </td>
                      <td className="px-3 py-2.5 mono text-[var(--text-secondary)]">{log.resource}</td>
                      <td className="px-3 py-2.5">
                        <span className="px-2 py-0.5 rounded-[var(--radius-sm)] bg-[var(--accent-primary-soft)] text-xs font-medium text-[var(--accent-primary)]">
                          {log.action}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 mono text-xs text-[var(--text-tertiary)] max-w-[140px] truncate" title={log.resourceId}>
                        {log.resourceId || '—'}
                      </td>
                      <td className="px-3 py-2.5 mono text-xs text-[var(--text-tertiary)]">{log.ipAddress || '—'}</td>
                      <td className="px-3 py-2.5 mono text-xs text-[var(--text-tertiary)] max-w-[220px] truncate" title={log.details}>
                        {log.details && log.details !== '{}' ? log.details : '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <p className="text-xs text-[var(--text-muted)]">
              Page {page}{logs.length > 0 ? ` — ${logs.length} entries` : ''}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="flex items-center gap-1 px-3 py-1.5 rounded-[var(--radius-md)] border border-[var(--border-subtle)] text-xs font-medium text-[var(--text-secondary)] hover:border-[var(--border-default)] disabled:opacity-40 transition-colors"
              >
                <ChevronLeft size={12} />
                Prev
              </button>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={!hasNext}
                className="flex items-center gap-1 px-3 py-1.5 rounded-[var(--radius-md)] border border-[var(--border-subtle)] text-xs font-medium text-[var(--text-secondary)] hover:border-[var(--border-default)] disabled:opacity-40 transition-colors"
              >
                Next
                <ChevronRight size={12} />
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
