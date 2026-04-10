import { Check, X, Loader2, Box, HelpCircle, type LucideIcon } from 'lucide-react';

type ServiceStatus = 'running' | 'building' | 'failed' | 'stopped' | 'unknown';

interface StatusBadgeProps {
  status: ServiceStatus | string;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  pulse?: boolean;
  className?: string;
}

const statusConfig: Record<
  ServiceStatus,
  { color: string; bg: string; Icon: LucideIcon; label: string; animate?: boolean; glow?: string }
> = {
  running: {
    color: 'var(--success)',
    bg: 'var(--success-soft)',
    Icon: Check,
    label: 'Active',
    animate: true,
    glow: 'rgba(61, 214, 140, 0.4)',
  },
  building: {
    color: 'var(--warning)',
    bg: 'var(--warning-soft)',
    Icon: Loader2,
    label: 'Building',
    animate: true,
    glow: 'rgba(255, 112, 67, 0.4)',
  },
  failed: {
    color: 'var(--error)',
    bg: 'var(--error-soft)',
    Icon: X,
    label: 'Failed',
    glow: 'rgba(255, 107, 91, 0.4)',
  },
  stopped: {
    color: 'var(--text-muted)',
    bg: 'var(--surface-muted)',
    Icon: Box,
    label: 'Stopped',
  },
  unknown: {
    color: 'var(--text-muted)',
    bg: 'var(--surface-muted)',
    Icon: HelpCircle,
    label: 'Unknown',
  },
};

export function StatusBadge({
  status,
  size = 'md',
  showLabel = true,
  pulse = true,
  className = '',
}: StatusBadgeProps) {
  const config = statusConfig[status as ServiceStatus] ?? statusConfig.unknown;
  const { Icon } = config;

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-[10px] gap-1.5',
    md: 'px-2.5 py-1 text-xs gap-1.5',
    lg: 'px-3 py-1.5 text-sm gap-2',
  };

  const iconSizes = {
    sm: 10,
    md: 12,
    lg: 14,
  };

  return (
    <div
      className={`inline-flex items-center rounded-full font-bold uppercase tracking-wider ring-1 ring-inset transition-all duration-200 ${sizeClasses[size]} ${className}`}
      style={{ 
        background: config.bg, 
        color: config.color, 
        borderColor: `${config.color}20`,
        boxShadow: status === 'running' && pulse ? `0 0 12px ${config.glow}` : 'none',
      }}
    >
      {status === 'running' && pulse && (
        <span
          className="w-1.5 h-1.5 rounded-full live-pulse"
          style={{ background: config.color, boxShadow: `0 0 6px ${config.color}` }}
        />
      )}
      <Icon
        size={iconSizes[size]}
        className={config.animate && status === 'building' ? 'animate-spin' : ''}
      />
      {showLabel && <span>{config.label}</span>}
    </div>
  );
}

interface LiveIndicatorProps {
  isLive: boolean;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function LiveIndicator({ isLive, label, size = 'md' }: LiveIndicatorProps) {
  const sizeClasses = {
    sm: 'px-2 py-0.5 text-[10px] gap-1.5',
    md: 'px-2.5 py-1 text-xs gap-2',
    lg: 'px-3 py-1.5 text-sm gap-2',
  };

  return (
    <div 
      className={`inline-flex items-center rounded-full font-bold uppercase tracking-wider ring-1 ring-inset transition-all duration-300 ${sizeClasses[size]}`}
      style={{
        background: isLive ? 'var(--success-soft)' : 'var(--surface-muted)',
        color: isLive ? 'var(--success)' : 'var(--text-muted)',
        borderColor: isLive ? 'rgba(61, 214, 140, 0.2)' : 'rgba(255, 255, 255, 0.05)',
        boxShadow: isLive ? '0 0 12px rgba(61, 214, 140, 0.3)' : 'none',
      }}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${isLive ? 'live-pulse' : ''}`}
        style={{ 
          background: isLive ? 'var(--success)' : 'var(--text-muted)',
          boxShadow: isLive ? '0 0 6px var(--success)' : 'none',
        }}
      />
      {label || (isLive ? 'Active' : 'Stopped')}
    </div>
  );
}
