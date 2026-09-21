import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import type { ServiceEntity } from '@/lib/api-client';
import { serviceStatusClass } from '@/lib/api-client';
import { Box, Globe, Database, Terminal, ExternalLink, Copy, Layers } from 'lucide-react';
import { useState } from 'react';

export type ServiceNodeData = {
  service: ServiceEntity;
  selected: boolean;
  onOpen: (serviceId: string) => void;
};

export type GroupNodeData = {
  title: string;
};

export type ServiceNodeType = Node<ServiceNodeData, 'serviceNode'>;
export type GroupNodeType = Node<GroupNodeData, 'groupNode'>;

function renderServiceTypeIcon(type: string, size = 18) {
  switch (type) {
    case 'web':
      return <Globe size={size} />;
    case 'database':
      return <Database size={size} />;
    case 'worker':
      return <Terminal size={size} />;
    default:
      return <Box size={size} />;
  }
}

function serviceTypeColor(type: string): string {
  switch (type) {
    case 'web':
      return '#7ab8ff';
    case 'database':
      return '#b4e34a';
    case 'worker':
      return 'var(--accent-primary)';
    default:
      return '#9295a4';
  }
}

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

export function ServiceNode({ data }: NodeProps<ServiceNodeType>) {
  const { service, selected } = data;
  const typeColor = serviceTypeColor(service.type);
  const replicas = service.replicas ?? 0;
  const stateColor = statusColor(service.status);

  const publicUrl = service.domain ? `https://${service.domain}` : service.publicUrl;
  const internalAddr = service.port ? `${service.name}:${service.port}` : service.name;

  return (
    <div
      className={`rounded-[var(--radius-lg)] border transition-all duration-200 group relative overflow-hidden ${
        selected
          ? 'border-[var(--accent-primary)] bg-[var(--accent-primary-soft)] shadow-lg shadow-[var(--accent-primary-glow)]'
          : 'border-[var(--border-subtle)] bg-[var(--surface-card)] hover:border-[var(--border-default)] hover:shadow-lg'
      }`}
      style={{ minWidth: 220, maxWidth: 280 }}
    >
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
        style={{ background: `${typeColor}10` }}
      />

      <Handle id="t-l" type="target" position={Position.Left} className="!opacity-0 !w-2 !h-2 !border-0" />
      <Handle id="t-r" type="target" position={Position.Right} className="!opacity-0 !w-2 !h-2 !border-0" />
      <Handle id="s-l" type="source" position={Position.Left} className="!opacity-0 !w-2 !h-2 !border-0" />
      <Handle id="s-r" type="source" position={Position.Right} className="!opacity-0 !w-2 !h-2 !border-0" />

      <div
        className={`absolute top-0 left-0 right-0 h-0.5 transition-all duration-300 ${service.status === 'running' ? 'opacity-100' : 'opacity-40'}`}
        style={{ background: stateColor }}
      />

      <div className="relative p-4">
        <div className="flex items-start gap-3 mb-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-200 ${
              selected ? 'ring-2 ring-white/20' : ''
            }`}
            style={{
              background: selected ? typeColor : `${typeColor}20`,
              color: selected ? 'white' : typeColor,
            }}
          >
            {renderServiceTypeIcon(service.type, 18)}
          </div>
          <div className="min-w-0 flex-1 pt-0.5">
            <h4 className="font-semibold text-sm text-[var(--text-primary)] truncate tracking-tight">{service.name}</h4>
            <p className="text-[11px] text-[var(--text-tertiary)] truncate mt-0.5">
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

        <div className="flex items-center gap-2 mb-3 px-2.5 py-1.5 rounded-lg bg-[var(--surface-muted)]/50 border border-[var(--border-subtle)]/50 group/addr">
          <ExternalLink size={10} className="text-[var(--text-tertiary)] flex-shrink-0" />
          {publicUrl ? (
            <a
              href={publicUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-[10px] text-[var(--accent-primary)] truncate mono hover:underline"
            >
              {publicUrl.replace(/^https?:\/\//, '')}
            </a>
          ) : (
            <span className="text-[10px] text-[var(--text-secondary)] truncate mono" title="Internal network address">
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
          <div className="flex items-center gap-2">
            <span className={`status-dot ${serviceStatusClass(service.status)}`} />
            <span className="text-[11px] font-semibold tracking-wide uppercase" style={{ color: stateColor }}>
              {statusLabel(service.status)}
            </span>
          </div>
          {service.image && (
            <span className="text-[10px] text-[var(--text-tertiary)] truncate mono max-w-[120px]" title={service.image}>
              {service.image}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export function GroupNode({ data }: NodeProps<GroupNodeType>) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className="h-full w-full rounded-[var(--radius-xl)] border-2 border-dashed transition-all duration-200 relative overflow-hidden"
      style={{
        borderColor: isHovered ? 'var(--accent-primary)' : 'var(--border-default)',
        background: isHovered ? 'rgba(232, 49, 106, 0.03)' : 'var(--surface-muted)/30',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        className="absolute inset-0 opacity-0 transition-opacity duration-300 pointer-events-none"
        style={{
          background: 'rgba(232,49,106,0.03)',
          opacity: isHovered ? 1 : 0,
        }}
      />

      <div className="relative p-4">
        <div className="flex items-center justify-between">
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
            <h3 className="text-sm font-semibold text-[var(--text-primary)] tracking-tight">{data.title}</h3>
          </div>
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
