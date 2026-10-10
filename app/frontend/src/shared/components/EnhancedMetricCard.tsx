import { type ReactNode } from 'react';
import { ChevronRight, MoreHorizontal } from 'lucide-react';

interface EnhancedMetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  status?: 'good' | 'average' | 'warning';
  statusText?: string;
  icon: ReactNode;
  chart?: ReactNode;
  details?: ReactNode;
  onClick?: () => void;
  className?: string;
  animationDelay?: number;
  horizontal?: boolean;
}

const statusColors: Record<string, string> = {
  good: 'var(--success)',
  average: 'var(--warning)',
  warning: 'var(--warning)',
};

function CardHead({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <div className="s-cardhead">
      <span className="s-ibox">{icon}</span>
      <span className="text-[11.5px] font-medium text-[var(--text-secondary)] whitespace-nowrap">{title}</span>
      <span className="ml-auto text-[var(--text-tertiary)]">
        <MoreHorizontal size={14} />
      </span>
    </div>
  );
}

function CardFoot({ label, onClick }: { label: string; onClick?: () => void }) {
  return (
    <div className="s-stat-foot mt-auto">
      <span
        onClick={onClick}
        className="cursor-pointer hover:text-[var(--text-secondary)] transition-colors"
      >
        {label}
      </span>
      {onClick && (
        <button className="s-icon-btn !w-[26px] !h-[26px]" onClick={onClick} title={label}>
          <ChevronRight size={12} />
        </button>
      )}
    </div>
  );
}

export function EnhancedMetricCard({
  title,
  value,
  subtitle,
  status,
  statusText,
  icon,
  chart,
  details,
  onClick,
  className = '',
  animationDelay = 0,
  horizontal = false,
}: EnhancedMetricCardProps) {
  if (horizontal) {
    return (
      <div className={`s-card flex flex-row overflow-hidden ${className}`} style={{ animationDelay: `${animationDelay}s` }}>
        <div className="flex flex-1 flex-col">
          <CardHead icon={icon} title={title} />
          <div className="px-4">
            <div className="font-headline text-[32px] font-bold leading-none tracking-[-0.025em] text-[var(--text-primary)]">
              {value}
            </div>
            {subtitle && <div className="mt-1 text-[11.5px] text-[var(--text-tertiary)]">{subtitle}</div>}
            {details && <div className="mt-3">{details}</div>}
          </div>
          <div className="mt-4" />
          <CardFoot label="Details" onClick={onClick} />
        </div>
        {chart && (
          <div className="flex w-1/2 items-end py-3 pr-3.5">
            {chart}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`s-card flex flex-col ${className}`} style={{ animationDelay: `${animationDelay}s` }}>
      <CardHead icon={icon} title={title} />
      <div className="px-4 pb-1">
        <div className="font-headline text-[32px] font-bold leading-none tracking-[-0.025em] text-[var(--text-primary)]">
          {value}
        </div>
        {(subtitle || statusText) && (
          <div className="mt-1.5 text-[11.5px] text-[var(--text-tertiary)]">
            {statusText && status && (
              <span className="font-semibold" style={{ color: statusColors[status] }}>{statusText}</span>
            )}{' '}
            {subtitle}
          </div>
        )}
        {chart && <div className="mt-3 mb-1">{chart}</div>}
        {details && <div className="mt-3">{details}</div>}
      </div>
      <CardFoot label="Details" onClick={onClick} />
    </div>
  );
}

interface CacheMetricCardProps {
  totalMB: number;
  cacheMB: number;
  nonCacheMB: number;
  onClick?: () => void;
  animationDelay?: number;
}

export function CacheMetricCard({
  totalMB,
  cacheMB,
  nonCacheMB,
  onClick,
  animationDelay = 0,
}: CacheMetricCardProps) {
  const cachePercent = Math.round((cacheMB / totalMB) * 100);
  const nonCachePercent = Math.round((nonCacheMB / totalMB) * 100);

  return (
    <div className="s-card flex flex-col" style={{ animationDelay: `${animationDelay}s` }}>
      <CardHead
        icon={
          <svg viewBox="0 0 24 24" width="13.5" height="13.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
        }
        title="Cache"
      />
      <div className="px-4">
        <div className="font-headline text-[32px] font-bold leading-none tracking-[-0.025em] text-[var(--text-primary)]">
          {totalMB} <span className="text-[12px] font-medium text-[var(--text-tertiary)]">MB</span>
        </div>
        <div className="mt-1.5 text-[11.5px] text-[var(--text-tertiary)]">
          <span className="font-semibold text-[var(--warning)]">{Math.round(totalMB * 0.625)}MB average</span> cached images and files
        </div>

        {/* Segmented bar */}
        <div className="my-4 flex h-8 items-center gap-1">
          <div className="h-full rounded-l-md" style={{ width: `${cachePercent}%`, background: 'var(--error)' }} />
          <div className="h-full" style={{ width: `${nonCachePercent}%`, background: 'var(--accent-tertiary)' }} />
          <div className="h-full flex-1 rounded-r-md bg-[var(--tint-07)]" />
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr] items-stretch">
          {[
            { dot: 'var(--error)', label: 'Cache', value: `${cacheMB} MB`, pct: `${cachePercent}%` },
            { dot: 'var(--accent-tertiary)', label: 'Non-Cache', value: `${nonCacheMB} MB`, pct: `${nonCachePercent}%` },
            { dot: null, label: 'Total', value: `${totalMB * 5} GB`, pct: '' },
          ].map((s, i) => (
            <div key={s.label} className="contents">
              {i > 0 && <div className="mx-4 w-px bg-[var(--border-subtle)]" />}
              <div>
                <div className="mb-1 flex items-center gap-1.5 text-[10.5px] text-[var(--text-tertiary)]">
                  {s.dot && <i className="h-1.5 w-1.5 rounded-full" style={{ background: s.dot }} />}
                  {s.label}
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-[14px] font-bold text-[var(--text-primary)]">{s.value}</span>
                  {s.pct && <span className="text-[10.5px] text-[var(--text-tertiary)]">{s.pct}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-4" />
      <CardFoot label="Details" onClick={onClick} />
    </div>
  );
}

interface PerformanceMetricCardProps {
  percentage: number;
  upSpeed: number;
  downSpeed: number;
  datasets: Array<{ data: number[]; color: string; fillOpacity?: number }>;
  onClick?: () => void;
  animationDelay?: number;
}

export function PerformanceMetricCard({
  percentage,
  upSpeed,
  downSpeed,
  onClick,
  animationDelay = 0,
}: PerformanceMetricCardProps) {
  const status = percentage >= 85 ? 'Good' : percentage >= 70 ? 'Average' : 'Warning';
  const statusColor = percentage >= 85 ? 'var(--success)' : percentage >= 70 ? 'var(--warning)' : 'var(--error)';

  return (
    <div className="s-card flex flex-col" style={{ animationDelay: `${animationDelay}s` }}>
      <CardHead
        icon={
          <svg viewBox="0 0 24 24" width="13.5" height="13.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="2" y1="12" x2="22" y2="12" />
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
          </svg>
        }
        title="Performance"
      />
      <div className="flex flex-1 items-start gap-4 px-4">
        <div className="flex-1">
          <div className="font-headline text-[32px] font-bold leading-none tracking-[-0.025em] text-[var(--text-primary)]">
            {percentage}%
          </div>
          <div className="mt-1.5 text-[11.5px] text-[var(--text-tertiary)]">
            <span className="font-semibold" style={{ color: statusColor }}>{status}</span>
            {' '}Last scan {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="h-[58px] w-[134px] rounded-lg bg-[var(--tint-03)]" />
          <div className="flex flex-col items-end gap-1">
            {[{ v: upSpeed, up: false }, { v: downSpeed, up: true }].map((s, i) => (
              <div key={i} className="flex items-center gap-1 text-[11px] font-medium text-[var(--accent-primary)]">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="12" y1={s.up ? 5 : 19} x2="12" y2={s.up ? 19 : 5} />
                  {s.up ? <polyline points="19 12 12 5 5 12" /> : <polyline points="5 12 12 19 19 12" />}
                </svg>
                <span>{s.v}</span> Mbps
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-4" />
      <CardFoot label="Check Speed" onClick={onClick} />
    </div>
  );
}
