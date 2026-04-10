import { type ReactNode, useEffect, useRef, useState } from 'react';

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

  const statusColors: Record<string, string> = {
    good: '#3dd68c',
    average: '#f0a040',
    warning: '#ff7043',
  };

  // Horizontal layout for cards like Active User
  if (horizontal) {
    return (
      <div
        ref={cardRef}
        className={`panel ${className}`}
        style={{
          display: 'flex',
          flexDirection: 'row',
          padding: 0,
          overflow: 'hidden',
          opacity: isVisible ? 1 : 0,
          transform: isVisible ? 'translateY(0)' : 'translateY(12px)',
          transition: 'all 0.5s ease',
        }}
      >
        <div style={{
          flex: 1,
          padding: '20px 18px 18px 20px',
          display: 'flex',
          flexDirection: 'column',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div className="card-icon">{icon}</div>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#e8e9f0' }}>{title}</span>
          </div>
          <div style={{
            fontSize: 36,
            fontWeight: 900,
            letterSpacing: '-1.5px',
            lineHeight: 1,
            color: '#e8e9f0',
          }}>
            {value}
          </div>
          {subtitle && (
            <div style={{ fontSize: 12, color: '#6b6e7d', marginTop: 4 }}>{subtitle}</div>
          )}
          {details && <div style={{ marginTop: 12 }}>{details}</div>}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: 'auto',
            paddingTop: 14,
          }}>
            <span
              style={{ fontSize: 13, color: '#6b6e7d', fontWeight: 500, cursor: 'pointer' }}
              onClick={onClick}
            >
              Details
            </span>
            <div className="arrow-btn" onClick={onClick}>
              <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </div>
          </div>
        </div>
        {chart && (
          <div style={{
            width: '50%',
            padding: '16px 14px 46px 0',
            display: 'flex',
            alignItems: 'flex-end',
          }}>
            {chart}
          </div>
        )}
      </div>
    );
  }

  // Standard vertical card layout - matching self.html exactly
  return (
    <div
      ref={cardRef}
      className={`panel ${className}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        padding: 20,
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'translateY(0)' : 'translateY(12px)',
        transition: 'all 0.5s ease',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div className="card-icon">{icon}</div>
        <span style={{ fontSize: 14, fontWeight: 600, color: '#e8e9f0' }}>{title}</span>
      </div>

      <div style={{
        fontSize: 38,
        fontWeight: 900,
        letterSpacing: '-1.5px',
        lineHeight: 1,
        color: '#e8e9f0',
      }}>
        {value}
      </div>

      {(subtitle || statusText) && (
        <div style={{ fontSize: 12, color: '#6b6e7d', marginTop: 4 }}>
          {statusText && status && (
            <span style={{ color: statusColors[status], fontWeight: 700 }}>{statusText}</span>
          )}{' '}
          {subtitle}
        </div>
      )}

      {chart && <div style={{ marginTop: 12, marginBottom: 6 }}>{chart}</div>}

      {details && <div style={{ marginTop: 16 }}>{details}</div>}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 4, marginTop: 'auto' }}>
        <span
          onClick={onClick}
          style={{ fontSize: 13, color: '#6b6e7d', fontWeight: 500, cursor: 'pointer' }}
        >
          Details
        </span>
        <div className="arrow-btn" onClick={onClick}>
          <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </div>
      </div>
    </div>
  );
}
