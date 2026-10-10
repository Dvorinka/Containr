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
  type WebhookDelivery,
} from '@/lib/api-client';
import { useDemoMode } from '@/lib/demo-mode';
import { formatRelative } from '@/lib/time';
import { DemoRestricted, useToast } from '@/shared/components';
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

function statusClass(status: WebhookDelivery['status']): string {
  switch (status) {
    case 'success':
      return 'text-[var(--success)]';
    case 'failed':
      return 'text-[var(--error)]';
    default:
      return 'text-[var(--warning)]';
  }
}

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
    <div className="panel p-4">
      <div className="flex items-center gap-3">
        <button onClick={() => setExpanded((v) => !v)} className="text-[var(--text-tertiary)]">
          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-[var(--text-primary)]">{webhook.name}</span>
            {!webhook.enabled && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--surface-muted)] text-[var(--text-muted)]">
                disabled
              </span>
            )}
          </div>
          <p className="text-xs text-[var(--text-muted)] mono truncate">{webhook.url}</p>
        </div>
        <div className="hidden md:flex gap-1">
          {webhook.events.map((ev) => (
            <span
              key={ev}
              className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--accent-primary-soft)] text-[var(--accent-primary)] mono"
            >
              {ev}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={onTest}
            disabled={testing || !webhook.enabled}
            className="p-2 rounded-[var(--radius-md)] text-[var(--text-tertiary)] hover:text-[var(--accent-primary)] disabled:opacity-40 transition-colors"
            title="Send test ping"
          >
            {testing ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
          </button>
          <button
            onClick={onToggle}
            className="p-2 rounded-[var(--radius-md)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors text-xs"
          >
            {webhook.enabled ? 'Disable' : 'Enable'}
          </button>
          <button
            onClick={onDelete}
            className="p-2 rounded-[var(--radius-md)] text-[var(--text-tertiary)] hover:text-[var(--error)] transition-colors"
            title="Delete webhook"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>
      {expanded && (
        <div className="mt-3 border-t border-[var(--border-subtle)] pt-3">
          <p className="text-[11px] uppercase tracking-wider text-[var(--text-muted)] mb-2">
            Recent deliveries
          </p>
          {deliveriesQuery.isLoading ? (
            <Loader2 size={14} className="animate-spin text-[var(--text-muted)]" />
          ) : (deliveriesQuery.data ?? []).length === 0 ? (
            <p className="text-xs text-[var(--text-muted)]">No deliveries yet.</p>
          ) : (
            <div className="space-y-1">
              {(deliveriesQuery.data ?? []).slice(0, 20).map((d) => (
                <div key={d.id} className="flex items-center gap-3 text-xs mono">
                  <span className={statusClass(d.status)}>{d.status}</span>
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
      <div className="border-b border-[var(--border-subtle)]">
        <div className="w-full px-8 py-5 flex items-center justify-between">
          <div>
            <h1 className="v-title">Webhooks<span className="v-cursor">_</span></h1>
            <p className="v-mono mt-1.5 text-[11px] text-[var(--text-tertiary)]">
              Signed HTTP delivery for every platform event — deploys, restarts, deletes
            </p>
          </div>
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-1.5 h-9 px-4 rounded-[var(--radius-md)] text-sm font-semibold text-[var(--accent-on)]"
            style={{ background: 'var(--accent-primary)' }}
          >
            <Plus size={15} />
            New webhook
          </button>
        </div>
      </div>

      <div className="w-full px-4 py-6 sm:px-8 space-y-4 max-w-4xl">
        {secret && (
          <div className="panel-soft p-4 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[var(--text-primary)]">Signing secret — shown once</p>
              <p className="text-xs text-[var(--text-muted)]">
                Verify deliveries with <span className="mono">X-Containr-Signature</span>
              </p>
              <code className="block mt-2 text-xs mono text-[var(--accent-primary)] break-all">{secret}</code>
            </div>
            <button
              onClick={() => {
                navigator.clipboard?.writeText(secret);
                toast.showToast('Secret copied', 'success');
              }}
              className="p-2 text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
            >
              <Copy size={15} />
            </button>
            <button onClick={() => setSecret(null)} className="p-2 text-[var(--text-tertiary)]">
              <X size={15} />
            </button>
          </div>
        )}

        {webhooksQuery.isLoading ? (
          <Loader2 size={18} className="animate-spin text-[var(--text-muted)]" />
        ) : (webhooksQuery.data ?? []).length === 0 ? (
          <div className="panel p-8 text-center">
            <Webhook size={28} className="mx-auto text-[var(--text-muted)] mb-3" />
            <p className="text-sm text-[var(--text-secondary)]">No webhooks yet.</p>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              Subscribe an HTTP endpoint to platform events like <span className="mono">service.*</span> or{' '}
              <span className="mono">deployment.fail</span>.
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
          <div className="relative w-full max-w-md panel p-6">
            <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">New webhook</h3>
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
                  className={`${inputClass} w-full mono`}
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
                      className={`px-2.5 py-1 rounded-[var(--radius-md)] border text-xs mono transition-colors ${
                        form.events.includes(ev)
                          ? 'border-[var(--accent-primary)] bg-[var(--accent-primary-soft)] text-[var(--accent-primary)]'
                          : 'border-[var(--border-subtle)] bg-[var(--surface-muted)] text-[var(--text-tertiary)]'
                      }`}
                    >
                      {ev}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-[11px] text-[var(--text-muted)]">
                  Events are <span className="mono">resource.action</span> — wildcards like{' '}
                  <span className="mono">service.*</span> match the whole resource.
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setCreating(false)}
                className="h-10 px-4 rounded-[var(--radius-md)] text-sm text-[var(--text-secondary)]"
              >
                Cancel
              </button>
              <button
                onClick={() => createMutation.mutate()}
                disabled={
                  createMutation.isPending ||
                  !form.name.trim() ||
                  !form.url.trim() ||
                  form.events.length === 0
                }
                className="h-10 px-5 rounded-[var(--radius-md)] text-sm font-semibold text-[var(--accent-on)] disabled:opacity-50 flex items-center gap-2"
                style={{ background: 'var(--accent-primary)' }}
              >
                {createMutation.isPending && <Loader2 size={14} className="animate-spin" />}
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
