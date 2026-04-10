import type { Node, NodeProps } from '@xyflow/react';
import type { ServiceEntity } from '@/lib/api-client';
import { serviceStatusClass } from '@/lib/api-client';
import { Box, ArrowUpRight, Globe, Database, Terminal, MoreHorizontal, ExternalLink } from 'lucide-react';
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

function serviceTypeIcon(type: string): typeof Box {
  switch (type) {
    case 'web':
      return Globe;
    case 'database':
      return Database;
    case 'worker':
      return Terminal;
    default:
      return Box;
  }
}

function serviceTypeColor(type: string): string {
  switch (type) {
    case 'web':
      return '#6c8ef0'; // Blue
    case 'database':
      return '#9c7ef0'; // Purple
    case 'worker':
      return '#e8316a'; // Pink
    default:
      return '#9295a4'; // Gray
  }
}

export function ServiceNode({ data }: NodeProps<ServiceNodeType>) {
  const { service, selected, onOpen } = data;
  const iconType = serviceTypeIcon(service.type);
  const typeColor = serviceTypeColor(service.type);
  const isRunning = service.status === 'running';

  // Generate a mock domain for display (in real app, this would come from service data)
  const domain = `${service.name}.containr.local`;

  return (
    <div
      className={`rounded-[var(--radius-lg)] border transition-all duration-200 group relative overflow-hidden ${
        selected
          ? 'border-[var(--accent-primary)] bg-[var(--accent-primary-soft)] shadow-lg shadow-[var(--accent-primary-glow)]'
          : 'border-[var(--border-subtle)] bg-[var(--surface-card)] hover:border-[var(--border-default)] hover:shadow-lg'
      }`}
      style={{ minWidth: 220, maxWidth: 280 }}
    >
      {/* Ambient overlay */}
      <div 
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
        style={{ background: `${typeColor}10` }}
      />

      {/* Status indicator bar at top */}
      <div 
        className={`absolute top-0 left-0 right-0 h-0.5 transition-all duration-300 ${isRunning ? 'opacity-100' : 'opacity-40'}`}
        style={{ background: isRunning ? 'var(--success)' : 'var(--text-tertiary)' }}
      />

      {/* Action menu on hover */}
      <button className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-all duration-200 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] p-1.5 rounded-lg hover:bg-[var(--surface-muted)]">
        <MoreHorizontal size={14} />
      </button>

      <div className="relative p-4">
        {/* Header with icon and name */}
        <div className="flex items-start gap-3 mb-3">
          <div 
            className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-200 ${
              selected ? 'ring-2 ring-white/20' : ''
            }`}
            style={{ 
              background: selected ? typeColor : `${typeColor}20`,
              color: selected ? 'white' : typeColor
            }}
          >
            {iconType === Globe && <Globe size={18} />}
            {iconType === Database && <Database size={18} />}
            {iconType === Terminal && <Terminal size={18} />}
            {iconType === Box && <Box size={18} />}
          </div>
          <div className="min-w-0 flex-1 pt-0.5">
            <h4 className="font-semibold text-sm text-[var(--text-primary)] truncate tracking-tight">{service.name}</h4>
            <p className="text-[11px] text-[var(--text-tertiary)] truncate mt-0.5">{service.type}</p>
          </div>
        </div>

        {/* Domain display - Railway style */}
        <div className="flex items-center gap-2 mb-3 px-2.5 py-1.5 rounded-lg bg-[var(--surface-muted)]/50 border border-[var(--border-subtle)]/50">
          <ExternalLink size={10} className="text-[var(--text-tertiary)] flex-shrink-0" />
          <span className="text-[10px] text-[var(--text-secondary)] truncate mono">{domain}</span>
        </div>

        {/* Status and action row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`status-dot ${serviceStatusClass(service.status)}`} />
            <span 
              className="text-[11px] font-semibold tracking-wide uppercase" 
              style={{ color: isRunning ? 'var(--success)' : 'var(--text-tertiary)' }}
            >
              {isRunning ? 'Online' : service.status}
            </span>
          </div>

          <button
            type="button"
            onClick={() => onOpen(service.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all duration-200 ${
              selected
                ? 'bg-[var(--accent-primary)] text-white shadow-lg shadow-[var(--accent-primary-glow)]'
                : 'border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)]'
            }`}
          >
            Open
            <ArrowUpRight size={10} />
          </button>
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
        background: isHovered ? 'rgba(232, 49, 106, 0.03)' : 'var(--surface-muted)/30'
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Ambient glow on hover */}
      <div 
        className="absolute inset-0 opacity-0 transition-opacity duration-300 pointer-events-none"
        style={{ 
          background: 'rgba(232,49,106,0.03)',
          opacity: isHovered ? 1 : 0
        }}
      />

      {/* Header */}
      <div className="relative p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div 
              className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors duration-200"
              style={{ 
                background: isHovered ? 'var(--accent-primary-soft)' : 'var(--surface-card)',
                color: isHovered ? 'var(--accent-primary)' : 'var(--text-tertiary)'
              }}
            >
              <Box size={14} />
            </div>
            <h3 className="text-sm font-semibold text-[var(--text-primary)] tracking-tight">{data.title}</h3>
          </div>
          {isHovered && (
            <button className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors p-1 rounded-lg hover:bg-[var(--surface-muted)]">
              <MoreHorizontal size={14} />
            </button>
          )}
        </div>

        {/* Helper text */}
        <p className="text-[10px] text-[var(--text-tertiary)] mt-2 opacity-0 transition-opacity duration-200" style={{ opacity: isHovered ? 1 : 0 }}>
          Drag services here to group them
        </p>
      </div>
    </div>
  );
}
