import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { listActivity, type ActivityEntry } from '@/lib/api-client';
import { useDemoMode } from '@/lib/demo-mode';
import { type FilterConfig } from '@/lib/dynamic-filter';
import { useDynamicFilter, useFilterState } from '@/lib/use-dynamic-filter';
import { formatRelative } from '@/lib/time';
import { DemoRestricted, FilterBar } from '@/shared/components';
import { QuietBtn, SCard, SPageHead, SPill } from '@/shared/components/sentry';
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

const SEV_TONE: Record<string, 'err' | 'warn' | 'ok' | 'info'> = {
  error: 'err', warning: 'warn', success: 'ok', info: 'info',
};

const SCHEMA: FilterConfig<ActivityEntry>[] = [
  { key: 'q', label: 'events', type: 'search', searchFields: ['label', 'action', 'user_email'] },
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
      <div className="w-full px-4 pt-6 sm:px-8">
        <SPageHead
          title="Activity"
          titleAccent="_"
          sub="Platform events across your visible projects"
          actions={query.isFetching ? <Loader2 size={14} className="animate-spin text-[var(--text-muted)]" /> : undefined}
        />
      </div>

      <div className="px-4 sm:px-8 space-y-4">
        <SCard icon={<Activity />} title="Event Feed" accent={`${entries.length} events`} pad={false}>
          <div className="px-4 pt-1 pb-3">
            <FilterBar {...filter} />
          </div>
          <div className="divide-y divide-[var(--border-subtle)] border-t border-[var(--border-subtle)]">
            {query.isLoading && <p className="px-5 py-8 text-xs text-[var(--text-muted)]">Loading…</p>}
            {!query.isLoading && entries.length === 0 && (
              <p className="px-5 py-8 text-xs text-[var(--text-muted)]">No events yet — activity appears here as you deploy, configure, and manage services.</p>
            )}
            {entries.map((e) => <Entry key={e.id} entry={e} />)}
          </div>
        </SCard>

        <div className="flex items-center gap-2.5">
          <QuietBtn disabled={page <= 1} onClick={() => setPage(page - 1)}>← newer</QuietBtn>
          <QuietBtn disabled={!query.data?.has_more} onClick={() => setPage(page + 1)}>older →</QuietBtn>
          <span className="v-mono text-[10.5px] text-[var(--text-muted)]">page {page}</span>
        </div>
      </div>
    </div>
  );
}

function Entry({ entry }: { entry: ActivityEntry }) {
  const Cat = CATEGORY_ICONS[entry.category] ?? Activity;
  const sev = SEVERITY_STYLE[entry.severity] ?? SEVERITY_STYLE.info;
  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--tint-03)] transition-colors">
      <div className={`s-ibox ${sev.cls}`} style={{ width: 30, height: 30 }}>
        <Cat size={14} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-medium text-[var(--text-primary)] truncate">{entry.label || entry.action}</span>
          <SPill tone={SEV_TONE[entry.severity] ?? 'info'}>{entry.severity}</SPill>
        </div>
        <div className="v-mono text-[10px] text-[var(--text-muted)] mt-0.5">
          {entry.category} · {entry.action}{entry.user_email ? ` · ${entry.user_email}` : ''}
        </div>
      </div>
      <span className="v-mono text-[10px] text-[var(--text-muted)] whitespace-nowrap">{formatRelative(entry.created_at)}</span>
    </div>
  );
}
