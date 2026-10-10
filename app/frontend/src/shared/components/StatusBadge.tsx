import { Check, X, Loader2, Box, HelpCircle, type LucideIcon } from 'lucide-react';
import type { PillTone } from './sentry-utils';

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
  { tone: PillTone; Icon: LucideIcon; label: string; animate?: boolean }
> = {
  running: { tone: 'ok', Icon: Check, label: 'Active' },
  building: { tone: 'warn', Icon: Loader2, label: 'Building', animate: true },
  failed: { tone: 'err', Icon: X, label: 'Failed' },
  stopped: { tone: 'off', Icon: Box, label: 'Stopped' },
  unknown: { tone: 'off', Icon: HelpCircle, label: 'Unknown' },
};

const TONE_CLS: Record<PillTone, string> = {
  ok: 'text-[var(--success)] bg-[var(--success-soft)] border-[color-mix(in_srgb,var(--success)_16%,transparent)]',
  warn: 'text-[var(--warning)] bg-[var(--warning-soft)] border-[color-mix(in_srgb,var(--warning)_16%,transparent)]',
  err: 'text-[var(--error)] bg-[var(--error-soft)] border-[color-mix(in_srgb,var(--error)_16%,transparent)]',
  info: 'text-[var(--info)] bg-[var(--info-soft)] border-[color-mix(in_srgb,var(--info)_16%,transparent)]',
  off: 'text-[var(--text-tertiary)] bg-[var(--tint-06)] border-[var(--border-subtle)]',
};

const TONE_DOT: Record<PillTone, string> = {
  ok: 'var(--success)',
  warn: 'var(--warning)',
  err: 'var(--error)',
  info: 'var(--info)',
  off: 'var(--text-tertiary)',
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
    sm: 'px-2 py-[2px] text-[10px] gap-1.5',
    md: 'px-2 py-[3.5px] text-[10.5px] gap-1.5',
    lg: 'px-2.5 py-1 text-[11.5px] gap-1.5',
  };

  const iconSizes = { sm: 10, md: 11, lg: 12 };

  return (
    <div
      className={`inline-flex items-center rounded-[5px] border font-medium transition-colors ${sizeClasses[size]} ${TONE_CLS[config.tone]} ${className}`}
    >
      {status === 'running' && pulse && (
        <span
          className="w-1.5 h-1.5 rounded-full live-pulse"
          style={{ background: TONE_DOT[config.tone] }}
        />
      )}
      <Icon
        size={iconSizes[size]}
        className={config.animate ? 'animate-spin' : ''}
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
    sm: 'px-2 py-[2px] text-[10px] gap-1.5',
    md: 'px-2 py-[3.5px] text-[10.5px] gap-1.5',
    lg: 'px-2.5 py-1 text-[11.5px] gap-1.5',
  };
  const tone: PillTone = isLive ? 'ok' : 'off';

  return (
    <div
      className={`inline-flex items-center rounded-[5px] border font-medium transition-colors ${sizeClasses[size]} ${TONE_CLS[tone]}`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${isLive ? 'live-pulse' : ''}`}
        style={{ background: TONE_DOT[tone] }}
      />
      {label || (isLive ? 'Active' : 'Stopped')}
    </div>
  );
}
