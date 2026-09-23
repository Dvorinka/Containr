import type { ServiceEntity } from '@/lib/api-client';
import { serviceStatusClass } from '@/lib/api-client';
import type { ServiceVariable } from '../auto-connections';
import { ServiceIcon } from './ServiceIcon';
import { serviceAccent } from './service-visuals';
import { formatRelative } from '@/lib/time';
import {
  ArrowUpRight,
  Copy,
  Globe,
  KeyRound,
  Layers,
  Link2,
  Loader2,
  Play,
  Rocket,
  Square,
  Trash2,
  X,
} from 'lucide-react';
import { useState } from 'react';

export type InspectorGroup = { id: string; title: string };
export type InspectorConnection = {
  id: string;
  outbound: boolean;
  peer: string;
  peerId: string;
  reasons: string[];
};

export type InspectorActions = {
  deploy: () => void;
  start: () => void;
  restart: () => void;
  stop: () => void;
  remove: () => void;
  pending: boolean;
  deployPending: boolean;
  restartPending: boolean;
};

function statusLabel(status: string): string {
  switch (status) {
    case 'running':
      return 'Online';
    case 'deployed':
      return 'Deployed';
    case 'building':
      return 'Building';
    case 'deploying':
      return 'Deploying';
    case 'pending':
      return 'Pending';
    case 'failed':
      return 'Failed';
    case 'stopped':
      return 'Stopped';
    case 'rolling_back':
      return 'Rolling back';
    default:
      return status;
  }
}

function statusColor(status: string): string {
  switch (status) {
    case 'running':
    case 'deployed':
      return 'var(--success)';
    case 'failed':
      return 'var(--error)';
    case 'building':
    case 'deploying':
    case 'pending':
    case 'rolling_back':
      return 'var(--warning)';
    default:
      return 'var(--text-tertiary)';
  }
}

function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">{title}</p>
        {action}
      </div>
      {children}
    </div>
  );
}

function SectionLink({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-[10px] text-[var(--accent-primary)] hover:underline flex items-center gap-0.5"
    >
      {children}
      <ArrowUpRight size={9} />
    </button>
  );
}

export function ServiceInspector({
  service,
  variables,
  connections,
  groups,
  groupId,
  readOnly,
  actions,
  onClose,
  onOpenService,
  onOpenSection,
  onSelectPeer,
  onAssignGroup,
  onNewGroupFor,
}: {
  service: ServiceEntity;
  variables: ServiceVariable[];
  connections: InspectorConnection[];
  groups: InspectorGroup[];
  groupId: string | undefined;
  readOnly?: boolean;
  actions: InspectorActions;
  onClose: () => void;
  onOpenService: (serviceId: string) => void;
  onOpenSection: (serviceId: string, section: string) => void;
  onSelectPeer: (serviceId: string) => void;
  onAssignGroup: (serviceId: string, groupId: string | null) => void;
  onNewGroupFor: (serviceId: string) => void;
}) {
  const accent = serviceAccent(service);
  const publicUrl = service.domain ? `https://${service.domain}` : service.publicUrl;
  const [copied, setCopied] = useState(false);

  const copyAddress = () => {
    const text = publicUrl ?? (service.port ? `${service.name}:${service.port}` : service.name);
    void navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    });
  };

  const configRows: [string, string | undefined][] = [
    ['Image', service.image],
    ['Command', service.command],
    ['Port', service.port ? String(service.port) : undefined],
    ['Domain', service.domain],
    ['Git repo', service.gitRepo],
    ['Branch', service.gitBranch],
    ['Build path', service.buildPath],
    ['CPU', service.cpu],
    ['Memory', service.memory],
    ['Restart', service.restartPolicy],
    ['Healthcheck', service.healthcheckPath],
  ];
  const visibleConfig = configRows.filter(([, value]) => value);

  return (
    <aside className="canvas-inspector absolute right-4 top-4 bottom-4 w-[312px] panel-glass flex flex-col overflow-hidden">
      <div className="flex items-center gap-3 px-4 pt-4 pb-3 border-b border-[var(--border-subtle)]">
        <div
          className="w-9 h-9 rounded-[var(--radius-md)] flex items-center justify-center flex-shrink-0"
          style={{ background: `${accent}1c`, color: accent }}
        >
          <ServiceIcon service={service} size={16} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] truncate">{service.name}</h3>
          <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-tertiary)]">
            <span className={`status-dot ${serviceStatusClass(service.status)}`} />
            <span style={{ color: statusColor(service.status) }}>{statusLabel(service.status)}</span>
            <span>· {service.type}</span>
            {service.environment && service.environment !== 'production' && <span>· {service.environment}</span>}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="w-7 h-7 rounded-md flex items-center justify-center text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-muted)]"
          title="Close (Esc)"
        >
          <X size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {(publicUrl || service.port) && (
          <Section title="Address">
            <div className="flex items-center gap-1.5 group">
              <Globe size={11} className="text-[var(--text-tertiary)] flex-shrink-0" />
              {publicUrl ? (
                <a
                  href={publicUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mono text-[11px] text-[var(--accent-primary)] hover:underline break-all"
                >
                  {publicUrl.replace(/^https?:\/\//, '')}
                </a>
              ) : (
                <span className="mono text-[11px] text-[var(--text-secondary)]">
                  {service.name}:{service.port}
                </span>
              )}
              <button
                type="button"
                onClick={copyAddress}
                className="ml-auto text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                title="Copy address"
              >
                {copied ? <span className="text-[10px] text-[var(--success)]">Copied</span> : <Copy size={11} />}
              </button>
            </div>
            {publicUrl && service.port ? (
              <p className="mono text-[10.5px] text-[var(--text-tertiary)] mt-0.5 pl-4">
                {service.name}:{service.port}
              </p>
            ) : null}
          </Section>
        )}

        <Section title="Group">
          <div className="flex items-center gap-2">
            <Layers size={11} className="text-[var(--text-tertiary)] flex-shrink-0" />
            <select
              value={groupId ?? ''}
              onChange={(event) => {
                const next = event.target.value;
                if (next === '__new__') {
                  onNewGroupFor(service.id);
                  return;
                }
                onAssignGroup(service.id, next === '' ? null : next);
              }}
              className="nodrag flex-1 h-7 rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-2 text-[11px] text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)]"
            >
              <option value="">Ungrouped</option>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.title}
                </option>
              ))}
              <option value="__new__">+ New group…</option>
            </select>
          </div>
        </Section>

        <Section
          title={`Variables (${variables.length})`}
          action={
            <SectionLink onClick={() => onOpenSection(service.id, 'variables')}>
              Manage
            </SectionLink>
          }
        >
          {variables.length === 0 ? (
            <p className="text-[11px] text-[var(--text-muted)]">No variables yet.</p>
          ) : (
            <div className="space-y-1">
              {variables.slice(0, 6).map((variable) => (
                <div
                  key={variable.key}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-[var(--radius-sm)] bg-[var(--surface-muted)]/50"
                >
                  <KeyRound size={9} className="text-[var(--text-tertiary)] flex-shrink-0" />
                  <span className="mono text-[10px] text-[var(--text-primary)] truncate font-medium">
                    {variable.key}
                  </span>
                  <span className="mono text-[10px] text-[var(--text-tertiary)] truncate ml-auto max-w-[130px]" title={variable.isSecret ? 'Secret' : variable.value}>
                    {variable.isSecret ? '••••••••' : variable.value}
                  </span>
                </div>
              ))}
              {variables.length > 6 && (
                <p className="text-[10px] text-[var(--text-muted)] pl-1">+{variables.length - 6} more</p>
              )}
            </div>
          )}
        </Section>

        <Section
          title="Config"
          action={
            <SectionLink onClick={() => onOpenSection(service.id, 'config')}>
              Edit
            </SectionLink>
          }
        >
          {visibleConfig.length === 0 ? (
            <p className="text-[11px] text-[var(--text-muted)]">No configuration set.</p>
          ) : (
            <dl className="space-y-1">
              {visibleConfig.map(([label, value]) => (
                <div key={label} className="flex items-baseline gap-2">
                  <dt className="text-[10px] text-[var(--text-muted)] w-[70px] flex-shrink-0">{label}</dt>
                  <dd className="mono text-[10.5px] text-[var(--text-secondary)] truncate" title={value}>
                    {value}
                  </dd>
                </div>
              ))}
              {(service.replicas ?? 0) > 0 && (
                <div className="flex items-baseline gap-2">
                  <dt className="text-[10px] text-[var(--text-muted)] w-[70px] flex-shrink-0">Replicas</dt>
                  <dd className="mono text-[10.5px] text-[var(--text-secondary)]">{service.replicas}</dd>
                </div>
              )}
            </dl>
          )}
        </Section>

        <Section title={`Connections (${connections.length})`}>
          {connections.length === 0 ? (
            <p className="text-[11px] text-[var(--text-muted)]">
              No inferred connections. Reference another service via{' '}
              <span className="mono">{'{{variable}}'}</span> placeholders in env vars.
            </p>
          ) : (
            <div className="space-y-1.5">
              {connections.map((conn) => (
                <button
                  key={conn.id}
                  type="button"
                  onClick={() => onSelectPeer(conn.peerId)}
                  className="w-full text-left px-2.5 py-2 rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--surface-muted)]/40 hover:bg-[var(--surface-muted)] transition-colors"
                >
                  <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-primary)]">
                    <Link2 size={10} className="text-[var(--accent-primary)] flex-shrink-0" />
                    <span className="truncate font-medium">{conn.outbound ? `→ ${conn.peer}` : `← ${conn.peer}`}</span>
                  </div>
                  <p className="mono text-[9.5px] text-[var(--text-tertiary)] truncate mt-0.5 pl-4">
                    {conn.reasons.join(' · ')}
                  </p>
                </button>
              ))}
            </div>
          )}
        </Section>

        {service.updatedAt && (
          <p className="text-[10px] text-[var(--text-muted)] pt-1">
            Updated {formatRelative(service.updatedAt)}
          </p>
        )}
      </div>

      <div className="border-t border-[var(--border-subtle)] px-4 py-3 space-y-2">
        <button
          type="button"
          onClick={() => onOpenService(service.id)}
          className="w-full flex items-center justify-center gap-2 h-9 rounded-[var(--radius-md)] text-[var(--accent-on)] text-[13px] font-medium"
          style={{ background: 'var(--accent-primary)' }}
        >
          <ArrowUpRight size={14} />
          Open service
        </button>
        <div className="grid grid-cols-3 gap-1.5">
          <button
            type="button"
            disabled={actions.pending || readOnly}
            onClick={actions.deploy}
            className="flex items-center justify-center gap-1 h-8 rounded-[var(--radius-sm)] border border-[var(--border-subtle)] text-[11px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-default)] transition-colors disabled:opacity-40"
          >
            {actions.deployPending ? <Loader2 size={11} className="animate-spin" /> : <Rocket size={11} />}
            Deploy
          </button>
          {service.status !== 'running' ? (
            <button
              type="button"
              disabled={actions.pending || readOnly}
              onClick={actions.start}
              className="flex items-center justify-center gap-1 h-8 rounded-[var(--radius-sm)] border border-[var(--border-subtle)] text-[11px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-default)] transition-colors disabled:opacity-40"
            >
              <Play size={11} />
              Start
            </button>
          ) : (
            <button
              type="button"
              disabled={actions.pending || readOnly}
              onClick={actions.restart}
              className="flex items-center justify-center gap-1 h-8 rounded-[var(--radius-sm)] border border-[var(--border-subtle)] text-[11px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-default)] transition-colors disabled:opacity-40"
            >
              {actions.restartPending ? <Loader2 size={11} className="animate-spin" /> : <Play size={11} />}
              Restart
            </button>
          )}
          <button
            type="button"
            disabled={actions.pending || readOnly || service.status !== 'running'}
            onClick={actions.stop}
            className="flex items-center justify-center gap-1 h-8 rounded-[var(--radius-sm)] border border-[var(--border-subtle)] text-[11px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-default)] transition-colors disabled:opacity-40"
          >
            <Square size={11} />
            Stop
          </button>
        </div>
        <button
          type="button"
          disabled={actions.pending || readOnly}
          onClick={actions.remove}
          className="w-full flex items-center justify-center gap-1.5 h-8 rounded-[var(--radius-sm)] text-[11px] font-medium text-[var(--error)] hover:bg-[var(--error-soft)] transition-colors disabled:opacity-40"
        >
          <Trash2 size={11} />
          Delete service
        </button>
      </div>
    </aside>
  );
}
