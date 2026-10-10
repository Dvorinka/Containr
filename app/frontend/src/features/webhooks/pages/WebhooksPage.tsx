import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createWebhook,
  deleteWebhook,
  listWebhookDeliveries,
  listWebhooks,
  testWebhook,
  updateWebhook,
  type OutboundWebhook,
} from '@/lib/api-client';
import { useDemoMode } from '@/lib/demo-mode';
import { formatRelative } from '@/lib/time';
import { DemoRestricted, useToast } from '@/shared/components';
import { GhostBtn, QuietBtn, SPageHead, SPill } from '@/shared/components/sentry';
import { statusTone } from '@/shared/components/sentry-utils';
import {
  Webhook,
  Plus,
  Trash2,
  Send,
  Loader2,
  ChevronDown,
  ChevronRight,
  Copy,
  X,
} from 'lucide-react';

const inputClass =
  'h-10 px-3 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)] transition-all';

const eventSuggestions = ['*', 'service.*', 'project.*', 'database.*', 'deployment.*', 'template.*'];

function WebhookRow({
  webhook,
  onDelete,
  onToggle,
  onTest,
  testing,
}: {
  webhook: OutboundWebhook;
  onDelete: () => void;
  onToggle: () => void;
  onTest: () => void;
  testing: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const deliveriesQuery = useQuery({
    queryKey: ['webhook-deliveries', webhook.id],
    queryFn: () => listWebhookDeliveries(webhook.id),
    enabled: expanded,
    refetchInterval: expanded ? 10000 : false,
  });

  return (
    <div className="s-card !p-0">
      <div className="flex items-center gap-3 px-4 py-3">
        <span className="s-ibox shrink-0"><Webhook /></span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-[var(--text-primary)]">{webhook.name}</span>
            {!webhook.enabled && <SPill tone="off">disabled</SPill>}
          </div>
          <p className="v-mono text-[10.5px] text-[var(--text-muted)] truncate">{webhook.url}</p>
        </div>
        <div className="hidden md:flex gap-1.5">
          {webhook.events.map((ev) => (
            <span key={ev} className="s-chip">{ev}</span>
          ))}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="s-icon-btn"
            title={expanded ? 'Collapse' : 'Deliveries'}
          >
            {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          </button>
          <button
            onClick={onTest}
            disabled={testing || !webhook.enabled}
            className="s-icon-btn disabled:opacity-40"
            title="Send test ping"
          >
            {testing ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
          </button>
          <QuietBtn onClick={onToggle}>{webhook.enabled ? 'Disable' : 'Enable'}</QuietBtn>
          <button
            onClick={onDelete}
            className="s-icon-btn !text-[var(--text-tertiary)] hover:!text-[var(--error)]"
            title="Delete webhook"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>
      {expanded && (
        <div className="border-t border-[var(--border-subtle)] bg-[var(--surface-muted)]/40 px-4 py-3">
          <p className="v-mono text-[10px] uppercase tracking-[0.12em] text-[var(--text-muted)] mb-2">
            Recent deliveries
          </p>
          {deliveriesQuery.isLoading ? (
            <Loader2 size={14} className="animate-spin text-[var(--text-muted)]" />
          ) : (deliveriesQuery.data ?? []).length === 0 ? (
            <p className="text-xs text-[var(--text-muted)]">No deliveries yet.</p>
          ) : (
            <div className="space-y-1.5">
              {(deliveriesQuery.data ?? []).slice(0, 20).map((d) => (
                <div key={d.id} className="flex items-center gap-3 text-[11px] v-mono">
                  <SPill tone={statusTone(d.status)}>{d.status}</SPill>
                  <span className="text-[var(--text-secondary)]">{d.event}</span>
                  {d.response_status != null && (
                    <span className="text-[var(--text-muted)]">HTTP {d.response_status}</span>
                  )}
                  <span className="text-[var(--text-muted)]">{d.attempts} tries</span>
                  {d.duration_ms != null && (
                    <span className="text-[var(--text-muted)]">{d.duration_ms}ms</span>
                  )}
                  <span className="text-[var(--text-muted)] ml-auto">{formatRelative(d.created_at)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function WebhooksPage() {
  const isDemoMode = useDemoMode();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: '', url: '', events: [] as string[] });
  const [secret, setSecret] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);

  const webhooksQuery = useQuery({
    queryKey: ['webhooks'],
    queryFn: listWebhooks,
    enabled: !isDemoMode,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['webhooks'] });

  const createMutation = useMutation({
    mutationFn: () => createWebhook(form),
    onSuccess: (created) => {
      invalidate();
      setCreating(false);
      setForm({ name: '', url: '', events: [] });
      if (created.secret) {
        setSecret(created.secret);
      }
    },
    onError: (err) => toast.showToast(err instanceof Error ? err.message : 'Failed to create webhook', 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteWebhook(id),
    onSuccess: invalidate,
    onError: (err) => toast.showToast(err instanceof Error ? err.message : 'Delete failed', 'error'),
  });

  const toggleMutation = useMutation({
    mutationFn: (w: OutboundWebhook) => updateWebhook(w.id, { enabled: !w.enabled }),
    onSuccess: invalidate,
  });

  const testMutation = useMutation({
    mutationFn: (id: string) => testWebhook(id),
    onMutate: (id) => setTestingId(id),
    onSettled: () => setTestingId(null),
    onSuccess: () => toast.showToast('Test ping queued', 'info'),
    onError: (err) => toast.showToast(err instanceof Error ? err.message : 'Test failed', 'error'),
  });

  if (isDemoMode) {
    return <DemoRestricted feature="Outbound webhooks" />;
  }

  const toggleEvent = (ev: string) =>
    setForm((f) => ({
      ...f,
      events: f.events.includes(ev) ? f.events.filter((e) => e !== ev) : [...f.events, ev],
    }));

  return (
    <div className="min-h-screen">
      <div className="w-full px-4 pt-6 sm:px-8">
        <SPageHead
          title="Webhooks"
          titleAccent="_"
          sub="Signed HTTP delivery for every platform event — deploys, restarts, deletes"
          trail={
            <GhostBtn onClick={() => setCreating(true)}>
              <Plus size={13} /> New webhook
            </GhostBtn>
          }
        />
      </div>

      <div className="w-full px-4 sm:px-8 space-y-4 max-w-4xl">
        {secret && (
          <div className="s-inset p-4 flex items-center gap-3">
            <span className="s-ibox shrink-0"><Webhook /></span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[var(--text-primary)]">Signing secret — shown once</p>
              <p className="v-mono text-[11px] text-[var(--text-muted)]">
                Verify deliveries with <span className="v-mono">X-Containr-Signature</span>
              </p>
              <code className="block mt-2 v-mono text-xs text-[var(--accent-primary)] break-all">{secret}</code>
            </div>
            <button
              onClick={() => {
                navigator.clipboard?.writeText(secret);
                toast.showToast('Secret copied', 'success');
              }}
              className="s-icon-btn"
            >
              <Copy size={13} />
            </button>
            <button onClick={() => setSecret(null)} className="s-icon-btn">
              <X size={13} />
            </button>
          </div>
        )}

        {webhooksQuery.isLoading ? (
          <Loader2 size={18} className="animate-spin text-[var(--text-muted)]" />
        ) : (webhooksQuery.data ?? []).length === 0 ? (
          <div className="s-card py-10 text-center">
            <div className="s-ibox mx-auto mb-3"><Webhook /></div>
            <p className="text-sm text-[var(--text-secondary)]">No webhooks yet.</p>
            <p className="v-mono text-[11px] text-[var(--text-muted)] mt-1">
              Subscribe an HTTP endpoint to platform events like <span className="v-mono">service.*</span> or{' '}
              <span className="v-mono">deployment.fail</span>.
            </p>
          </div>
        ) : (
          (webhooksQuery.data ?? []).map((w) => (
            <WebhookRow
              key={w.id}
              webhook={w}
              testing={testingId === w.id}
              onTest={() => testMutation.mutate(w.id)}
              onToggle={() => toggleMutation.mutate(w)}
              onDelete={() => {
                if (window.confirm(`Delete webhook "${w.name}"?`)) {
                  deleteMutation.mutate(w.id);
                }
              }}
            />
          ))
        )}
      </div>

      {creating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-[var(--bg-void)]/80 backdrop-blur-sm" onClick={() => setCreating(false)} />
          <div className="relative w-full max-w-md s-card">
            <div className="s-cardhead mb-4">
              <span className="s-ibox"><Webhook /></span>
              <h3 className="s-t">New Webhook</h3>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium uppercase tracking-wider text-[var(--text-tertiary)] mb-2">
                  Name
                </label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className={`${inputClass} w-full`}
                  placeholder="deploy-alerts"
                />
              </div>
              <div>
                <label className="block text-xs font-medium uppercase tracking-wider text-[var(--text-tertiary)] mb-2">
                  Endpoint URL
                </label>
                <input
                  value={form.url}
                  onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
                  className={`${inputClass} w-full v-mono`}
                  placeholder="https://example.com/hooks/containr"
                />
              </div>
              <div>
                <label className="block text-xs font-medium uppercase tracking-wider text-[var(--text-tertiary)] mb-2">
                  Events
                </label>
                <div className="flex flex-wrap gap-2">
                  {eventSuggestions.map((ev) => (
                    <button
                      key={ev}
                      onClick={() => toggleEvent(ev)}
                      className={`s-chip v-mono ${form.events.includes(ev) ? 'on' : ''}`}
                    >
                      {ev}
                    </button>
                  ))}
                </div>
                <p className="mt-2 v-mono text-[10.5px] text-[var(--text-muted)]">
                  Events are <span className="v-mono">resource.action</span> — wildcards like{' '}
                  <span className="v-mono">service.*</span> match the whole resource.
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <QuietBtn onClick={() => setCreating(false)}>Cancel</QuietBtn>
              <GhostBtn
                onClick={() => createMutation.mutate()}
                disabled={
                  createMutation.isPending ||
                  !form.name.trim() ||
                  !form.url.trim() ||
                  form.events.length === 0
                }
              >
                {createMutation.isPending && <Loader2 size={13} className="animate-spin" />}
                Create
              </GhostBtn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
