import { type ReactNode, useEffect, useRef, useState } from 'react';
import { ChevronRight } from 'lucide-react';

interface MetricCardProps {
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

export function MetricCard({
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
}: MetricCardProps) {
  const [isVisible, setIsVisible] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTimeout(() => setIsVisible(true), animationDelay * 1000);
        }
      },
      { threshold: 0.1 }
    );

    if (cardRef.current) {
      observer.observe(cardRef.current);
    }

    return () => observer.disconnect();
  }, [animationDelay]);

  const reveal = {
    opacity: isVisible ? 1 : 0,
    transform: isVisible ? 'translateY(0)' : 'translateY(12px)',
    transition: 'all 0.5s ease',
  } as const;

  const footer = (
    <div className="s-stat-foot">
      <span
        onClick={onClick}
        style={{ cursor: onClick ? 'pointer' : 'default' }}
      >
        {statusText && status ? (
          <b style={{ color: statusColors[status], fontWeight: 600 }}>{statusText}</b>
        ) : null}{' '}
        {subtitle ?? 'Details'}
      </span>
      {onClick ? (
        <button className="s-icon-btn !h-6 !w-6" onClick={onClick} title="Details">
          <ChevronRight size={11} />
        </button>
      ) : null}
    </div>
  );

  if (horizontal) {
    return (
      <div ref={cardRef} className={`s-stat ${className}`} style={{ ...reveal, display: 'flex' }}>
        <div className="flex-1 px-4 pt-4 pb-2 flex flex-col">
          <div className="flex items-center gap-2.5">
            <span className="s-ibox">{icon}</span>
            <span className="text-[11.5px] font-medium text-[var(--text-secondary)]">{title}</span>
          </div>
          <div className="mt-4 font-headline text-[30px] font-bold leading-none tracking-[-0.025em] text-[var(--text-primary)]">
            {value}
          </div>
          {details ? <div className="mt-3">{details}</div> : null}
          <div className="mt-auto">{footer}</div>
        </div>
        {chart ? (
          <div className="w-1/2 flex items-end pr-3 pb-10 pt-3">{chart}</div>
        ) : null}
      </div>
    );
  }

  return (
    <div ref={cardRef} className={`s-stat ${className}`} style={reveal}>
      <div className="flex items-center gap-2.5 px-4 pt-4">
        <span className="s-ibox">{icon}</span>
        <span className="text-[11.5px] font-medium text-[var(--text-secondary)]">{title}</span>
      </div>
      <div className="px-4 mt-4 font-headline text-[32px] font-bold leading-none tracking-[-0.025em] text-[var(--text-primary)]">
        {value}
      </div>
      {chart ? <div className="px-4 mt-3">{chart}</div> : null}
      {details ? <div className="px-4 mt-3">{details}</div> : null}
      <div className="mt-4">{footer}</div>
    </div>
  );
}
