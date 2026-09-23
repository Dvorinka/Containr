import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import type { ServiceEntity } from '@/lib/api-client';
import { serviceStatusClass } from '@/lib/api-client';
import { Box, ExternalLink, Copy, Layers, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { serviceIcon, serviceAccent } from './service-visuals';
import { ServiceIcon } from './ServiceIcon';

export type ServiceNodeData = {
  service: ServiceEntity;
  selected: boolean;
  onOpen: (serviceId: string) => void;
};

export type GroupNodeData = {
  title: string;
  onRename?: (groupId: string, title: string) => void;
};

export type ServiceNodeType = Node<ServiceNodeData, 'serviceNode'>;
export type GroupNodeType = Node<GroupNodeData, 'groupNode'>;

function statusLabel(status: string): string {
  switch (status) {
    case 'running':
      return 'Online';
    case 'degraded':
      return 'Degraded';
    case 'building':
      return 'Deploying';
    case 'failed':
      return 'Failed';
    default:
      return 'Stopped';
  }
}

function statusColor(status: string): string {
  switch (status) {
    case 'running':
      return 'var(--success)';
    case 'degraded':
    case 'building':
      return 'var(--warning)';
    case 'failed':
      return 'var(--error)';
    default:
      return 'var(--text-tertiary)';
  }
}

const TRANSIENT_STATUSES = new Set(['building', 'deploying', 'pending', 'rolling_back']);

export function ServiceNode({ data }: NodeProps<ServiceNodeType>) {
  const { service, selected } = data;
  const brand = serviceIcon(service);
  const typeColor = brand?.color ?? serviceAccent(service);
  const replicas = service.replicas ?? 0;
  const stateColor = statusColor(service.status);
  const isTransient = TRANSIENT_STATUSES.has(service.status);

  const publicUrl = service.domain ? `https://${service.domain}` : service.publicUrl;
  const internalAddr = service.port ? `${service.name}:${service.port}` : service.name;

  return (
    <div
      className={`w-full rounded-[var(--radius-lg)] border transition-[border-color,box-shadow,transform] duration-150 group relative overflow-hidden ${
        selected
          ? 'border-[var(--accent-primary)] bg-[var(--accent-primary-soft)] shadow-[0_0_0_1px_var(--accent-primary),0_12px_36px_rgba(0,0,0,0.5)]'
          : 'border-[var(--border-subtle)] bg-[var(--surface-card)] hover:border-[var(--border-default)] hover:shadow-[0_12px_32px_rgba(0,0,0,0.45)] hover:-translate-y-px'
      }`}
    >
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
        style={{ background: `${typeColor}08` }}
      />

      <Handle id="t-l" type="target" position={Position.Left} className="!opacity-0 !w-2 !h-2 !border-0" />
      <Handle id="t-r" type="target" position={Position.Right} className="!opacity-0 !w-2 !h-2 !border-0" />
      <Handle id="s-l" type="source" position={Position.Left} className="!opacity-0 !w-2 !h-2 !border-0" />
      <Handle id="s-r" type="source" position={Position.Right} className="!opacity-0 !w-2 !h-2 !border-0" />

      <div
        className={`absolute top-0 left-0 right-0 h-0.5 transition-all duration-300 ${service.status === 'running' ? 'opacity-100' : 'opacity-40'}`}
        style={{ background: stateColor }}
      />

      <div className="relative px-3.5 pt-3.5 pb-3">
        <div className="flex items-center gap-3 mb-2.5">
          <div
            className="w-9 h-9 rounded-[var(--radius-md)] flex items-center justify-center flex-shrink-0 transition-all duration-200"
            style={{
              background: selected && !brand ? typeColor : `${typeColor}1c`,
              color: selected && !brand ? 'var(--bg-void)' : typeColor,
            }}
          >
            {isTransient ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <ServiceIcon service={service} size={17} />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="font-semibold text-[13px] leading-tight text-[var(--text-primary)] truncate tracking-tight">
              {service.name}
            </h4>
            <p className="text-[10.5px] text-[var(--text-tertiary)] truncate mt-0.5">
              {service.type}
              {service.environment && service.environment !== 'production' ? ` · ${service.environment}` : ''}
            </p>
          </div>
          {replicas > 1 && (
            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-[var(--surface-muted)] text-[10px] font-semibold text-[var(--text-secondary)]">
              <Layers size={9} />
              {replicas}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 mb-2.5 px-2.5 py-1.5 rounded-[var(--radius-sm)] bg-[var(--surface-muted)]/60 border border-[var(--border-subtle)]/60 group/addr">
          <ExternalLink size={10} className="text-[var(--text-tertiary)] flex-shrink-0" />
          {publicUrl ? (
            <a
              href={publicUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-[10.5px] text-[var(--accent-primary)] truncate mono hover:underline"
            >
              {publicUrl.replace(/^https?:\/\//, '')}
            </a>
          ) : (
            <span className="text-[10.5px] text-[var(--text-secondary)] truncate mono" title="Internal network address">
              {internalAddr}
            </span>
          )}
          <button
            type="button"
            title="Copy internal address"
            onClick={(e) => {
              e.stopPropagation();
              void navigator.clipboard?.writeText(internalAddr);
            }}
            className="ml-auto opacity-0 group-hover/addr:opacity-100 transition-opacity text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
          >
            <Copy size={10} />
          </button>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className={`status-dot ${serviceStatusClass(service.status)}`} />
            <span className="text-[10px] font-semibold tracking-[0.08em] uppercase" style={{ color: stateColor }}>
              {statusLabel(service.status)}
            </span>
          </div>
          {service.image && (
            <span className="text-[9.5px] text-[var(--text-muted)] truncate mono max-w-[110px]" title={service.image}>
              {service.image}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export function GroupNode({ id, data }: NodeProps<GroupNodeType>) {
  const [isHovered, setIsHovered] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(data.title);

  const commit = () => {
    const next = draft.trim() || data.title;
    setEditing(false);
    if (next !== data.title) {
      data.onRename?.(id, next);
    }
  };

  return (
    <div
      className="h-full w-full rounded-[var(--radius-xl)] border-2 border-dashed transition-all duration-200 relative"
      style={{
        borderColor: isHovered ? 'var(--border-strong)' : 'var(--border-default)',
        background: isHovered ? 'var(--accent-primary-soft)' : 'rgba(255,255,255,0.02)',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="relative p-4">
        <div className="flex items-center gap-2.5">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors duration-200"
            style={{
              background: isHovered ? 'var(--accent-primary-soft)' : 'var(--surface-card)',
              color: isHovered ? 'var(--accent-primary)' : 'var(--text-tertiary)',
            }}
          >
            <Box size={14} />
          </div>
          {editing ? (
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commit();
                if (e.key === 'Escape') {
                  setDraft(data.title);
                  setEditing(false);
                }
              }}
              className="nodrag h-7 px-2 rounded-[var(--radius-sm)] border border-[var(--border-default)] bg-[var(--surface-card)] text-sm font-semibold text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)]"
            />
          ) : (
            <h3
              className="text-sm font-semibold text-[var(--text-primary)] tracking-tight"
              onDoubleClick={(e) => {
                e.stopPropagation();
                setDraft(data.title);
                setEditing(true);
              }}
              title="Double-click to rename"
            >
              {data.title}
            </h3>
          )}
        </div>

        <p
          className="text-[10px] text-[var(--text-tertiary)] mt-2 transition-opacity duration-200"
          style={{ opacity: isHovered ? 1 : 0 }}
        >
          Drag services here to group them
        </p>
      </div>
    </div>
  );
}
