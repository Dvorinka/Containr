import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { getOperations, type OperationsView } from '@/lib/api-client';
import { useDemoMode } from '@/lib/demo-mode';
import { formatRelative } from '@/lib/time';
import { DemoRestricted } from '@/shared/components';
import { SPageHead, SPill, SStat, Ticks } from '@/shared/components/sentry';
import { statusTone } from '@/shared/components/sentry-utils';
import { Activity, AlertTriangle, Clock, Database, Loader2, Timer } from 'lucide-react';

function Section({ title, icon: Icon, count, children }: {
  title: string;
  icon: typeof Activity;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section className="s-card overflow-hidden">
      <div className="s-cardhead border-b border-[var(--border-subtle)]">
        <span className="s-ibox"><Icon /></span>
        <h2 className="s-t">{title}</h2>
        <span className="s-trail">
          <span className="s-chip" style={{ cursor: 'default' }}>{count}</span>
        </span>
      </div>
      <div className="p-3">{children}</div>
    </section>
  );
}

function EmptyLine({ text }: { text: string }) {
  return <p className="text-xs text-[var(--text-muted)]">{text}</p>;
}

export function OperationsPage() {
  const isDemoMode = useDemoMode();
  const navigate = useNavigate();

  const opsQuery = useQuery({
    queryKey: ['operations'],
    queryFn: getOperations,
    enabled: !isDemoMode,
    refetchInterval: (query) =>
      (query.state.data?.active_deployments?.length ?? 0) > 0 ? 3000 : 15000,
  });

  if (isDemoMode) {
    return <DemoRestricted feature="Operations" />;
  }

  const ops: OperationsView | undefined = opsQuery.data;
  const active = ops?.active_deployments ?? [];
  const failed = ops?.recent_failures ?? [];
  const cron = ops?.cron_runs ?? [];
  const backups = ops?.backups ?? [];
  const queue = ops?.deploy_queue ?? [];
  const queuedTotal = queue.reduce((sum, q) => sum + q.queued, 0);

  return (
    <div className="min-h-screen">
      <div className="w-full px-4 pt-6 sm:px-8">
        <SPageHead title="Operations" titleAccent="_" sub="Live view of deploys, queues, cron runs, and backups" />
      </div>

      {opsQuery.isLoading ? (
        <div className="w-full px-8 py-12 flex justify-center">
          <Loader2 size={20} className="animate-spin text-[var(--text-muted)]" />
        </div>
      ) : (
        <div className="w-full px-4 py-6 sm:px-8 space-y-6">
          <div className="grid grid-cols-2 gap-3.5 md:grid-cols-4">
            <SStat icon={<Activity />} label="In Flight" value={active.length} foot="deploying now" />
            <SStat icon={<Clock />} label="Queued" value={queuedTotal} foot="waiting in queue" />
            <SStat icon={<AlertTriangle />} label="Failed 24h" value={failed.length} foot="need attention" />
            <SStat icon={<Database />} label="Backups 24h" value={backups.length} foot="completed runs" />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <Section title="Active deployments" icon={Activity} count={active.length}>
              {active.length === 0 ? (
                <EmptyLine text="Nothing deploying right now." />
              ) : (
                <div className="space-y-2">
                  {active.map((d) => (
                    <button
                      key={d.id}
                      onClick={() => navigate(`/services/${d.service_id}`)}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-[var(--radius-md)] hover:bg-[var(--surface-muted)] text-left transition-colors"
                    >
                      <Loader2 size={13} className="animate-spin text-[var(--accent-primary)] shrink-0" />
                      <div className="min-w-0 flex-1">
                        <span className="text-sm text-[var(--text-primary)]">{d.service_name}</span>
                        <span className="text-xs text-[var(--text-muted)]"> · {d.project_name}</span>
                      </div>
                      <SPill tone={statusTone(d.status)}>{d.status}</SPill>
                      <span className="text-xs text-[var(--text-muted)]">{formatRelative(d.created_at)}</span>
                    </button>
                  ))}
                </div>
              )}
            </Section>

            <Section title="Failed — last 24h" icon={AlertTriangle} count={failed.length}>
              {failed.length === 0 ? (
                <EmptyLine text="No recent failures." />
              ) : (
                <div className="space-y-2">
                  {failed.map((d) => (
                    <button
                      key={d.id}
                      onClick={() => navigate(`/services/${d.service_id}`)}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-[var(--radius-md)] hover:bg-[var(--surface-muted)] text-left transition-colors"
                    >
                      <AlertTriangle size={13} className="text-[var(--error)] shrink-0" />
                      <div className="min-w-0 flex-1">
                        <span className="text-sm text-[var(--text-primary)]">{d.service_name}</span>
                        <span className="text-xs text-[var(--text-muted)]"> · {d.project_name}</span>
                        {d.error && (
                          <p className="text-[11px] text-[var(--error)]/80 truncate">{d.error}</p>
                        )}
                      </div>
                      <SPill tone={statusTone(d.status)}>{d.status}</SPill>
                      <span className="text-xs text-[var(--text-muted)]">{formatRelative(d.created_at)}</span>
                    </button>
                  ))}
                </div>
              )}
            </Section>

            <Section title="Cron — last 24h" icon={Timer} count={cron.length}>
              {cron.length === 0 ? (
                <EmptyLine text="No cron runs in the last day." />
              ) : (
                <div className="space-y-1.5">
                  {cron.map((r) => (
                    <div key={r.id} className="flex items-center gap-3 px-3 py-1.5 text-xs">
                      <SPill tone={statusTone(r.status)}>{r.status}</SPill>
                      <span className="text-[var(--text-primary)]">{r.job_name}</span>
                      <span className="v-mono text-[var(--text-muted)]">{r.schedule}</span>
                      {r.error && <span className="text-[var(--error)]/80 truncate">{r.error}</span>}
                      <span className="ml-auto text-[var(--text-muted)]">{formatRelative(r.started_at)}</span>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            <Section title="Backups — last 24h" icon={Database} count={backups.length}>
              {backups.length === 0 ? (
                <EmptyLine text="No backups in the last day." />
              ) : (
                <div className="space-y-1.5">
                  {backups.map((b) => (
                    <div key={b.id} className="flex items-center gap-3 px-3 py-1.5 text-xs">
                      <SPill tone={statusTone(b.status)}>{b.status}</SPill>
                      <span className="text-[var(--text-primary)]">{b.database_name}</span>
                      <span className="text-[var(--text-muted)]">{b.size}</span>
                      <span className="ml-auto text-[var(--text-muted)]">{formatRelative(b.created_at)}</span>
                    </div>
                  ))}
                </div>
              )}
            </Section>
          </div>

          {queue.length > 0 && (
            <Section title="Deploy queue depth" icon={Clock} count={queue.length}>
              <div className="space-y-2">
                {queue.map((q) => (
                  <div key={q.service_id} className="flex items-center gap-3 px-3 py-1.5 text-xs">
                    <span className="v-mono text-[var(--text-secondary)]">{q.service_id.slice(0, 8)}</span>
                    <SPill tone={q.running ? 'info' : 'off'}>{q.running ? 'running' : 'idle'}</SPill>
                    <span className="flex-1 max-w-[220px]">
                      <Ticks pct={Math.min(100, q.queued * 25)} count={32} warn={!q.running} />
                    </span>
                    <span className="v-mono text-[var(--warning)]">{q.queued} queued</span>
                  </div>
                ))}
              </div>
            </Section>
          )}
        </div>
      )}
    </div>
  );
}
