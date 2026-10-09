import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { listActivity, type ActivityEntry } from '@/lib/api-client';
import { useDemoMode } from '@/lib/demo-mode';
import { type FilterConfig } from '@/lib/dynamic-filter';
import { useDynamicFilter, useFilterState } from '@/lib/use-dynamic-filter';
import { formatRelative } from '@/lib/time';
import { DemoRestricted, FilterBar } from '@/shared/components';
import {
  Activity, AlertCircle, CheckCircle2, Database, GitBranch, Info, Key,
  Loader2, Package, Projector, Rocket, Shield, User, Users, Wrench,
} from 'lucide-react';

const CATEGORY_ICONS: Record<string, typeof Activity> = {
  service: Rocket, deployment: Package, project: Projector,
  database: Database, user: User, team: Users, auth: Key,
  security: Shield, git: GitBranch, webhook: GitBranch, system: Wrench,
};

const SEVERITY_STYLE: Record<string, { icon: typeof Info; cls: string; dot: string }> = {
  error:   { icon: AlertCircle,   cls: 'text-[var(--error)]',   dot: 'bg-[var(--error)]' },
  warning: { icon: AlertCircle,   cls: 'text-[var(--warning)]', dot: 'bg-[var(--warning)]' },
  success: { icon: CheckCircle2,  cls: 'text-[var(--success)]', dot: 'bg-[var(--success)]' },
  info:    { icon: Info,          cls: 'text-[var(--accent-primary)]', dot: 'bg-[var(--accent-primary)]' },
};

const SCHEMA: FilterConfig<ActivityEntry>[] = [
  { key: 'q', label: 'Search', type: 'search', searchFields: ['label', 'action', 'user_email'] },
  {
    key: 'severity', label: 'Severity', type: 'select',
    options: [
      { value: 'error', label: 'Error' },
      { value: 'warning', label: 'Warning' },
      { value: 'success', label: 'Success' },
      { value: 'info', label: 'Info' },
    ],
  },
  { key: 'category', label: 'Category', type: 'select' },
];

export function ActivityPage() {
  const isDemoMode = useDemoMode();
  const [page, setPage] = useState(1);
  const { filters } = useFilterState(SCHEMA);
  const severityParam = filters.severity === 'all' ? '' : String(filters.severity ?? '');

  const query = useQuery({
    queryKey: ['activity-feed', severityParam, page],
    queryFn: () => listActivity({ severity: severityParam || undefined, page, limit: 50 }),
    enabled: !isDemoMode,
    refetchInterval: 15000,
  });
  const filter = useDynamicFilter<ActivityEntry>({ data: query.data?.activity ?? [], schema: SCHEMA });

  if (isDemoMode) return <DemoRestricted feature="Activity" />;

  const entries = filter.filteredData;

  return (
    <div className="min-h-screen">
      <div className="border-b border-[var(--border-subtle)]">
        <div className="w-full px-8 py-5">
          <h1 className="v-title">Activity<span className="v-cursor">_</span></h1>
          <p className="v-mono mt-1.5 text-[11px] text-[var(--text-tertiary)]">
            platform events across your visible projects
          </p>
        </div>
      </div>

      <div className="px-8 py-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <FilterBar {...filter} />
          </div>
          {query.isFetching && <Loader2 size={14} className="animate-spin text-[var(--text-muted)] mt-3" />}
        </div>

        <div className="panel p-0 divide-y divide-[var(--border-subtle)]">
          {query.isLoading && <p className="px-5 py-8 text-xs text-[var(--text-muted)]">Loading…</p>}
          {!query.isLoading && entries.length === 0 && (
            <p className="px-5 py-8 text-xs text-[var(--text-muted)]">No events yet — activity appears here as you deploy, configure, and manage services.</p>
          )}
          {entries.map((e) => <Entry key={e.id} entry={e} />)}
        </div>

        <div className="flex items-center gap-3">
          <button
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
            className="v-mono text-[11px] px-3 py-1.5 rounded-md border border-[var(--border-subtle)] text-[var(--text-muted)] disabled:opacity-40 hover:text-[var(--text-primary)]"
          >
            newer
          </button>
          <button
            disabled={!query.data?.has_more}
            onClick={() => setPage(page + 1)}
            className="v-mono text-[11px] px-3 py-1.5 rounded-md border border-[var(--border-subtle)] text-[var(--text-muted)] disabled:opacity-40 hover:text-[var(--text-primary)]"
          >
            older
          </button>
        </div>
      </div>
    </div>
  );
}

function Entry({ entry }: { entry: ActivityEntry }) {
  const Cat = CATEGORY_ICONS[entry.category] ?? Activity;
  const sev = SEVERITY_STYLE[entry.severity] ?? SEVERITY_STYLE.info;
  return (
    <div className="flex items-center gap-3 px-5 py-3">
      <div className={`w-8 h-8 rounded-md bg-[var(--bg-elevated)] flex items-center justify-center ${sev.cls}`}>
        <Cat size={15} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[13px] text-[var(--text-primary)] truncate">{entry.label || entry.action}</span>
          <span className={`v-mono text-[9px] uppercase px-1.5 py-0.5 rounded ${sev.cls} bg-[var(--bg-elevated)]`}>{entry.severity}</span>
        </div>
        <div className="v-mono text-[10px] text-[var(--text-muted)] mt-0.5">
          {entry.category} · {entry.action}{entry.user_email ? ` · ${entry.user_email}` : ''}
        </div>
      </div>
      <span className="v-mono text-[10px] text-[var(--text-muted)] whitespace-nowrap">{formatRelative(entry.created_at)}</span>
    </div>
  );
}
