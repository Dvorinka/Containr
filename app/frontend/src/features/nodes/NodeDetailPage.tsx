import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  cordonAgent,
  deleteAgent,
  drainAgent,
  getAgent,
  getAgentMetrics,
  listAgentCommands,
  listAgentContainers,
  pruneAgent,
  updateAgent,
  upgradeAgent,
  type AgentMetricPoint,
} from '@/lib/api-client';
import { getCurrentUserProfile } from '@/lib/api-client';
import { useAuthSession } from '@/lib/use-auth-session';
import { useDemoMode } from '@/lib/demo-mode';
import { formatBytes, formatRelative } from '@/lib/time';
import { DemoRestricted } from '@/shared/components';
import {
  ArrowLeft, CheckCircle2, ChevronRight, Loader2, Pencil, XCircle,
} from 'lucide-react';

const TIME_RANGES = [
  { label: '1h', value: '1h' },
  { label: '24h', value: '24h' },
  { label: '7d', value: '168h' },
];

export function NodeDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isDemoMode = useDemoMode();
  const sessionQuery = useAuthSession({ enabled: !isDemoMode });
  const profileQuery = useQuery({
    queryKey: ['user-profile'],
    queryFn: getCurrentUserProfile,
    enabled: !isDemoMode && Boolean(sessionQuery.data),
    retry: false,
  });
  const isAdmin = !isDemoMode && Boolean(profileQuery.data?.isAdmin);
  const [timeRange, setTimeRange] = useState('24h');
  const [rename, setRename] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmVolumes, setConfirmVolumes] = useState(false);
  const [confirmDrain, setConfirmDrain] = useState(false);
  const [tagDraft, setTagDraft] = useState<string | null>(null);

  const agentQuery = useQuery({
    queryKey: ['node-agent', id],
    queryFn: () => getAgent(id),
    enabled: !isDemoMode && id !== '',
    refetchInterval: 15000,
  });
  const metricsQuery = useQuery({
    queryKey: ['node-metrics', id, timeRange],
    queryFn: () => getAgentMetrics(id, timeRange),
    enabled: !isDemoMode && id !== '',
    refetchInterval: 30000,
  });
  const containersQuery = useQuery({
    queryKey: ['node-containers', id],
    queryFn: () => listAgentContainers(id),
    enabled: !isDemoMode && id !== '',
    refetchInterval: 15000,
  });
  const commandsQuery = useQuery({
    queryKey: ['node-commands', id],
    queryFn: () => listAgentCommands(id),
    enabled: !isDemoMode && id !== '',
    refetchInterval: 15000,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['node-agent', id] });
    queryClient.invalidateQueries({ queryKey: ['node-commands', id] });
    queryClient.invalidateQueries({ queryKey: ['usage-agents'] });
  };
  const updateMutation = useMutation({
    mutationFn: (body: { name?: string; auto_prune?: boolean; tags?: string[] }) => updateAgent(id, body),
    onSuccess: () => { setRename(null); setTagDraft(null); invalidate(); },
  });
  const pruneMutation = useMutation({
    mutationFn: (volumes: boolean) => pruneAgent(id, { volumes }),
    onSuccess: () => { setConfirmVolumes(false); invalidate(); },
  });
  const deleteMutation = useMutation({
    mutationFn: () => deleteAgent(id),
    onSuccess: () => navigate('/usage'),
  });
  const cordonMutation = useMutation({
    mutationFn: (cordoned: boolean) => cordonAgent(id, cordoned),
    onSuccess: invalidate,
  });
  const drainMutation = useMutation({
    mutationFn: () => drainAgent(id),
    onSuccess: () => { setConfirmDrain(false); invalidate(); },
  });
  const upgradeMutation = useMutation({
    mutationFn: () => upgradeAgent(id),
    onSuccess: invalidate,
  });

  const agent = agentQuery.data;
  const metrics = useMemo(() => metricsQuery.data ?? [], [metricsQuery.data]);
  const latest = metrics.length > 0 ? metrics[metrics.length - 1] : null;
  const containers = containersQuery.data ?? [];
  const commands = commandsQuery.data ?? [];

  if (isDemoMode) return <DemoRestricted feature="Nodes" />;

  if (agentQuery.isLoading) {
    return <div className="px-8 py-10 text-xs text-[var(--text-muted)]">Loading node…</div>;
  }
  if (!agent) {
    return (
      <div className="px-8 py-10">
        <p className="text-sm text-[var(--text-secondary)]">Node not found.</p>
        <Link to="/usage" className="v-mono text-[11px] text-[var(--accent-primary)] hover:underline">← back to usage</Link>
      </div>
    );
  }

  const online = agent.status === 'online' || agent.status === 'connecting';

  return (
    <div className="min-h-screen">
      <div className="border-b border-[var(--border-subtle)]">
        <div className="w-full px-8 py-5">
          <div className="flex items-center gap-2 v-mono text-[11px] text-[var(--text-tertiary)] mb-2">
            <Link to="/usage" className="hover:text-[var(--text-primary)] flex items-center gap-1">
              <ArrowLeft size={12} /> usage
            </Link>
            <ChevronRight size={10} />
            <span className="text-[var(--text-primary)]">{agent.name}</span>
          </div>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h1 className="v-title">
                {rename === null ? agent.name : rename}
                {isAdmin && rename === null && (
                  <button
                    onClick={() => setRename(agent.name)}
                    className="ml-2 inline-block align-middle text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                    title="Rename node"
                  >
                    <Pencil size={14} />
                  </button>
                )}
                <span className="v-cursor">_</span>
              </h1>
              {rename !== null && (
                <div className="mt-2 flex items-center gap-2">
                  <input
                    value={rename}
                    onChange={(e) => setRename(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') updateMutation.mutate({ name: rename });
                      if (e.key === 'Escape') setRename(null);
                    }}
                    autoFocus
                    className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-tertiary)] px-2 py-1 text-sm text-[var(--text-primary)]"
                  />
                  <button onClick={() => updateMutation.mutate({ name: rename })} className="v-mono text-[11px] text-[var(--accent-primary)] hover:underline">save</button>
                  <button onClick={() => setRename(null)} className="v-mono text-[11px] text-[var(--text-muted)] hover:underline">cancel</button>
                </div>
              )}
              <p className="v-mono mt-1.5 text-[11px] text-[var(--text-tertiary)]">
                {agent.hostname} · {agent.ipAddress}:{agent.port}
                {agent.version ? ` · v${agent.version}` : ''}
                {agent.lastHeartbeat ? ` · heartbeat ${formatRelative(agent.lastHeartbeat)}` : ''}
              </p>
              {meshAddresses(agent).length > 0 && (
                <p className="v-mono mt-1 text-[11px] text-[var(--text-tertiary)]">
                  mesh: {meshAddresses(agent).map(([iface, ip]) => `${iface}=${ip}`).join(' · ')}
                </p>
              )}
              <p className="v-mono mt-1 text-[11px] text-[var(--text-tertiary)] flex items-center gap-1.5 flex-wrap">
                tags:
                {tagDraft === null ? (
                  <>
                    {agent.tags.length > 0
                      ? agent.tags.map((t) => (
                          <span key={t} className="px-1.5 py-0.5 rounded border border-[var(--border-subtle)] text-[var(--text-secondary)]">{t}</span>
                        ))
                      : <span className="text-[var(--text-muted)]">none</span>}
                    {isAdmin && (
                      <button
                        onClick={() => setTagDraft(agent.tags.join(', '))}
                        className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                        title="Edit placement tags — services can require them via placement_tags"
                      >
                        <Pencil size={11} />
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <input
                      value={tagDraft}
                      onChange={(e) => setTagDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') updateMutation.mutate({ tags: tagDraft.split(',').map((t) => t.trim()).filter(Boolean) });
                        if (e.key === 'Escape') setTagDraft(null);
                      }}
                      autoFocus
                      placeholder="eu-west, gpu"
                      className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-tertiary)] px-2 py-0.5 text-[11px] text-[var(--text-primary)] w-52"
                    />
                    <button
                      onClick={() => updateMutation.mutate({ tags: tagDraft.split(',').map((t) => t.trim()).filter(Boolean) })}
                      className="text-[var(--accent-primary)] hover:underline"
                    >save</button>
                    <button onClick={() => setTagDraft(null)} className="text-[var(--text-muted)] hover:underline">cancel</button>
                  </>
                )}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className={`v-mono text-[11px] px-2 py-1 rounded-md border ${online
                ? 'border-[var(--success)]/40 text-[var(--success)]'
                : 'border-[var(--error)]/40 text-[var(--error)]'}`}>
                {agent.status}
              </span>
              {!agent.schedulable && (
                <span className="v-mono text-[11px] px-2 py-1 rounded-md border border-[var(--warning)]/40 text-[var(--warning)]">
                  cordoned
                </span>
              )}
              {isAdmin && (
                <>
                  <label className="flex items-center gap-1.5 v-mono text-[11px] text-[var(--text-tertiary)] cursor-pointer" title="Daily automatic docker prune">
                    <input
                      type="checkbox"
                      checked={agent.autoPrune}
                      onChange={(e) => updateMutation.mutate({ auto_prune: e.target.checked })}
                      className="accent-[var(--accent-primary)]"
                    />
                    auto-prune
                  </label>
                  <button
                    onClick={() => cordonMutation.mutate(agent.schedulable)}
                    disabled={cordonMutation.isPending}
                    title={agent.schedulable
                      ? 'Block new placements — running replicas stay'
                      : 'Re-open for placement'}
                    className="v-mono text-[11px] px-3 py-1.5 rounded-md border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-50"
                  >
                    {agent.schedulable ? 'cordon' : 'uncordon'}
                  </button>
                  <button
                    onClick={() => setConfirmDrain(true)}
                    disabled={drainMutation.isPending || !online}
                    title={online
                      ? 'Cordon + remove all service containers + unpin services (they redeploy locally)'
                      : 'Node must be online to drain'}
                    className="v-mono text-[11px] px-3 py-1.5 rounded-md border border-[var(--warning)]/40 text-[var(--warning)] hover:bg-[var(--warning)]/10 disabled:opacity-50"
                  >
                    drain
                  </button>
                  <button
                    onClick={() => upgradeMutation.mutate()}
                    disabled={upgradeMutation.isPending || !online}
                    title={online
                      ? `Upgrade agent to the server's bundled binary (server ${upgradeMutation.data?.version ?? 'build'}) — the agent restarts itself`
                      : 'Node must be online to upgrade'}
                    className="v-mono text-[11px] px-3 py-1.5 rounded-md border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-50"
                  >
                    {upgradeMutation.isPending ? 'upgrading…' : 'upgrade agent'}
                  </button>
                  <button
                    onClick={() => setConfirmVolumes(true)}
                    disabled={pruneMutation.isPending}
                    className="v-mono text-[11px] px-3 py-1.5 rounded-md border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-50"
                  >
                    prune now
                  </button>
                  <button
                    onClick={() => setConfirmDelete(true)}
                    className="v-mono text-[11px] px-3 py-1.5 rounded-md border border-[var(--error)]/40 text-[var(--error)] hover:bg-[var(--error)]/10"
                  >
                    remove
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="px-8 py-6 space-y-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="cpu" value={latest ? `${latest.cpu.usage_percent.toFixed(0)}%` : '—'} sub={latest ? `${latest.cpu.cores} cores` : ''} />
          <Stat label="memory" value={latest ? `${latest.memory.usage_percent.toFixed(0)}%` : '—'} sub={latest ? `${formatBytes(latest.memory.available)} free of ${formatBytes(latest.memory.limit)}` : ''} />
          <Stat label="load 1m" value={latest ? latest.system_load.load_1m.toFixed(2) : '—'} sub={latest ? `5m ${latest.system_load.load_5m.toFixed(2)} · 15m ${latest.system_load.load_15m.toFixed(2)}` : ''} />
          <Stat label="containers" value={latest ? String(latest.container_count) : String(containers.length)} sub="reported by agent" />
        </div>

        <section className="panel p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="v-mono text-[11px] uppercase tracking-wider text-[var(--text-tertiary)]">telemetry</h2>
            <div className="flex gap-1">
              {TIME_RANGES.map((r) => (
                <button
                  key={r.value}
                  onClick={() => setTimeRange(r.value)}
                  className={`v-mono text-[11px] px-2.5 py-1 rounded-md border ${timeRange === r.value
                    ? 'border-[var(--accent-primary)]/50 text-[var(--accent-primary)]'
                    : 'border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
          {metricsQuery.isLoading ? (
            <p className="text-xs text-[var(--text-muted)]">Loading metrics…</p>
          ) : metrics.length < 2 ? (
            <p className="text-xs text-[var(--text-muted)]">Not enough heartbeat history yet — the agent reports every few seconds once connected.</p>
          ) : (
            <div className="grid gap-6 md:grid-cols-2">
              <Sparkline label="cpu %" points={metrics} value={(m) => m.cpu.usage_percent} />
              <Sparkline label="memory %" points={metrics} value={(m) => m.memory.usage_percent} />
            </div>
          )}
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="panel p-0">
            <h2 className="v-mono text-[11px] uppercase tracking-wider text-[var(--text-tertiary)] px-5 pt-4 pb-3">containers</h2>
            <div className="divide-y divide-[var(--border-subtle)] border-t border-[var(--border-subtle)]">
              {containers.length === 0 && (
                <p className="px-5 py-6 text-xs text-[var(--text-muted)]">No containers reported on this node.</p>
              )}
              {containers.map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-[var(--text-primary)]">{c.name ?? c.id}</p>
                    <p className="truncate v-mono text-[11px] text-[var(--text-tertiary)]">{c.image}</p>
                  </div>
                  <span className="v-mono text-[11px] text-[var(--text-secondary)]">{c.status ?? '—'}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="panel p-0">
            <h2 className="v-mono text-[11px] uppercase tracking-wider text-[var(--text-tertiary)] px-5 pt-4 pb-3">command history</h2>
            <div className="divide-y divide-[var(--border-subtle)] border-t border-[var(--border-subtle)]">
              {commands.length === 0 && (
                <p className="px-5 py-6 text-xs text-[var(--text-muted)]">No commands sent to this node yet.</p>
              )}
              {commands.slice(0, 15).map((cmd) => (
                <div key={cmd.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="flex items-center gap-2 min-w-0">
                    {cmd.status === 'completed'
                      ? <CheckCircle2 size={13} className="text-[var(--success)] shrink-0" />
                      : cmd.status === 'failed'
                        ? <XCircle size={13} className="text-[var(--error)] shrink-0" />
                        : <Loader2 size={13} className="text-[var(--text-muted)] animate-spin shrink-0" />}
                    <span className="v-mono text-[11px] text-[var(--text-primary)]">{cmd.type}</span>
                    {cmd.error && <span className="truncate text-[11px] text-[var(--error)]">{cmd.error}</span>}
                  </div>
                  <span className="v-mono text-[11px] text-[var(--text-muted)] whitespace-nowrap">
                    {cmd.created_at ? formatRelative(cmd.created_at) : ''}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      {confirmVolumes && (
        <ConfirmModal
          title="Prune this node?"
          body={`Runs a bounded docker system prune on ${agent.name}. Unused images, stopped containers, and networks are removed.`}
          confirmLabel="prune"
          danger={false}
          extra={
            <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)] cursor-pointer">
              <input type="checkbox" id="prune-volumes" className="accent-[var(--error)]" />
              also prune volumes (can delete database data)
            </label>
          }
          onCancel={() => setConfirmVolumes(false)}
          onConfirm={() => {
            const volumes = (document.getElementById('prune-volumes') as HTMLInputElement | null)?.checked ?? false;
            pruneMutation.mutate(volumes);
          }}
          pending={pruneMutation.isPending}
        />
      )}
      {confirmDrain && (
        <ConfirmModal
          title={`Drain ${agent.name}?`}
          body="Every service container on this node is removed and the affected services are unpinned — they redeploy on the local host until re-pinned elsewhere. The node stays cordoned."
          confirmLabel="drain node"
          danger
          onCancel={() => setConfirmDrain(false)}
          onConfirm={() => drainMutation.mutate()}
          pending={drainMutation.isPending}
        />
      )}
      {confirmDelete && (
        <ConfirmModal
          title={`Remove ${agent.name}?`}
          body="The agent record and its history are deleted. Containers running on the host are not stopped — uninstall the agent there separately."
          confirmLabel="remove node"
          danger
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => deleteMutation.mutate()}
          pending={deleteMutation.isPending}
        />
      )}
    </div>
  );
}

function meshAddresses(agent: { metadata: Record<string, unknown> }): [string, string][] {
  const mesh = agent.metadata?.mesh;
  if (!mesh || typeof mesh !== 'object' || Array.isArray(mesh)) return [];
  return Object.entries(mesh as Record<string, unknown>)
    .filter((entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1] !== '');
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="panel p-4">
      <p className="v-mono text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">{label}</p>
      <p className="mt-1 text-xl font-semibold text-[var(--text-primary)]">{value}</p>
      {sub && <p className="mt-0.5 v-mono text-[11px] text-[var(--text-muted)]">{sub}</p>}
    </div>
  );
}

function Sparkline({ label, points, value }: {
  label: string;
  points: AgentMetricPoint[];
  value: (m: AgentMetricPoint) => number;
}) {
  const w = 560;
  const h = 90;
  const vals = points.map(value);
  const max = Math.max(100, ...vals);
  const step = w / Math.max(points.length - 1, 1);
  const polyline = vals.map((v, i) => `${(i * step).toFixed(1)},${(h - (v / max) * (h - 6)).toFixed(1)}`).join(' ');
  return (
    <div>
      <p className="v-mono text-[10px] uppercase tracking-wider text-[var(--text-tertiary)] mb-2">
        {label} — now {vals[vals.length - 1].toFixed(0)}% / peak {Math.max(...vals).toFixed(0)}%
      </p>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-24 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-secondary)]">
        <polyline points={polyline} fill="none" stroke="var(--accent-primary)" strokeWidth="1.5" />
      </svg>
    </div>
  );
}

function ConfirmModal({ title, body, confirmLabel, danger, extra, onCancel, onConfirm, pending }: {
  title: string;
  body: string;
  confirmLabel: string;
  danger: boolean;
  extra?: React.ReactNode;
  onCancel: () => void;
  onConfirm: () => void;
  pending: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onCancel}>
      <div className="panel w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">{title}</h3>
        <p className="mt-2 text-xs text-[var(--text-secondary)]">{body}</p>
        {extra && <div className="mt-3">{extra}</div>}
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onCancel} className="v-mono text-[11px] px-3 py-1.5 rounded-md border border-[var(--border-subtle)] text-[var(--text-secondary)]">
            cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={pending}
            className={`v-mono text-[11px] px-3 py-1.5 rounded-md border disabled:opacity-50 ${danger
              ? 'border-[var(--error)]/50 text-[var(--error)] hover:bg-[var(--error)]/10'
              : 'border-[var(--accent-primary)]/50 text-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/10'}`}
          >
            {pending ? 'working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
