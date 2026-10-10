import type { ServiceEntity } from '@/lib/api-client';
import type { ServiceVariable } from '../auto-connections';
import { GhostBtn, QuietBtn, SPill } from '@/shared/components/sentry';
import { statusTone } from '@/shared/components/sentry-utils';
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

function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <p className="v-mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-muted)]">{title}</p>
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
      <div className="s-cardhead border-b border-[var(--border-subtle)]">
        <span
          className="s-ibox flex-shrink-0"
          style={{ background: `${accent}14`, color: accent, borderColor: `${accent}33` }}
        >
          <ServiceIcon service={service} size={15} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-[13px] font-semibold text-[var(--text-primary)] truncate leading-tight">{service.name}</h3>
          <div className="flex items-center gap-1.5 mt-1">
            <SPill tone={statusTone(service.status)}>{statusLabel(service.status)}</SPill>
            <span className="v-mono text-[10px] text-[var(--text-tertiary)]">
              {service.type}
              {service.environment && service.environment !== 'production' ? ` · ${service.environment}` : ''}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="s-icon-btn"
          title="Close (Esc)"
        >
          <X size={12} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {(publicUrl || service.port) && (
          <Section title="Address">
            <div className="s-inset flex items-center gap-1.5 px-2.5 py-2 group">
              <Globe size={11} className="text-[var(--text-tertiary)] flex-shrink-0" />
              {publicUrl ? (
                <a
                  href={publicUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="v-mono text-[11px] text-[var(--accent-primary)] hover:underline break-all"
                >
                  {publicUrl.replace(/^https?:\/\//, '')}
                </a>
              ) : (
                <span className="v-mono text-[11px] text-[var(--text-secondary)]">
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
              <p className="v-mono text-[10.5px] text-[var(--text-tertiary)] mt-1 pl-1">
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
                  className="s-inset !rounded-[6px] flex items-center gap-2 px-2 py-1.5"
                >
                  <KeyRound size={9} className="text-[var(--text-tertiary)] flex-shrink-0" />
                  <span className="v-mono text-[10px] text-[var(--text-primary)] truncate font-medium">
                    {variable.key}
                  </span>
                  <span className="v-mono text-[10px] text-[var(--text-tertiary)] truncate ml-auto max-w-[130px]" title={variable.isSecret ? 'Secret' : variable.value}>
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
                  <dd className="v-mono text-[10.5px] text-[var(--text-secondary)] truncate" title={value}>
                    {value}
                  </dd>
                </div>
              ))}
              {(service.replicas ?? 0) > 0 && (
                <div className="flex items-baseline gap-2">
                  <dt className="text-[10px] text-[var(--text-muted)] w-[70px] flex-shrink-0">Replicas</dt>
                  <dd className="v-mono text-[10.5px] text-[var(--text-secondary)]">{service.replicas}</dd>
                </div>
              )}
            </dl>
          )}
        </Section>

        <Section title={`Connections (${connections.length})`}>
          {connections.length === 0 ? (
            <p className="text-[11px] text-[var(--text-muted)]">
              No inferred connections. Reference another service via{' '}
              <span className="v-mono">{'{{variable}}'}</span> placeholders in env vars.
            </p>
          ) : (
            <div className="space-y-1.5">
              {connections.map((conn) => (
                <button
                  key={conn.id}
                  type="button"
                  onClick={() => onSelectPeer(conn.peerId)}
                  className="s-inset !rounded-[6px] w-full text-left px-2.5 py-2 hover:border-[var(--border-default)] transition-colors"
                >
                  <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-primary)]">
                    <Link2 size={10} className="text-[var(--accent-primary)] flex-shrink-0" />
                    <span className="truncate font-medium">{conn.outbound ? `→ ${conn.peer}` : `← ${conn.peer}`}</span>
                  </div>
                  <p className="v-mono text-[9.5px] text-[var(--text-tertiary)] truncate mt-0.5 pl-4">
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
        <GhostBtn
          onClick={() => onOpenService(service.id)}
          className="w-full justify-center !h-9"
        >
          <ArrowUpRight size={14} />
          Open service
        </GhostBtn>
        <div className="grid grid-cols-3 gap-1.5">
          <QuietBtn
            disabled={actions.pending || readOnly}
            onClick={actions.deploy}
            className="justify-center"
          >
            {actions.deployPending ? <Loader2 size={11} className="animate-spin" /> : <Rocket size={11} />}
            Deploy
          </QuietBtn>
          {service.status !== 'running' ? (
            <QuietBtn
              disabled={actions.pending || readOnly}
              onClick={actions.start}
              className="justify-center"
            >
              <Play size={11} />
              Start
            </QuietBtn>
          ) : (
            <QuietBtn
              disabled={actions.pending || readOnly}
              onClick={actions.restart}
              className="justify-center"
            >
              {actions.restartPending ? <Loader2 size={11} className="animate-spin" /> : <Play size={11} />}
              Restart
            </QuietBtn>
          )}
          <QuietBtn
            disabled={actions.pending || readOnly || service.status !== 'running'}
            onClick={actions.stop}
            className="justify-center"
          >
            <Square size={11} />
            Stop
          </QuietBtn>
        </div>
        <QuietBtn
          disabled={actions.pending || readOnly}
          onClick={actions.remove}
          className="w-full justify-center !text-[var(--error)] hover:!border-[var(--error)]/50"
        >
          <Trash2 size={11} />
          Delete service
        </QuietBtn>
      </div>
    </aside>
  );
}
