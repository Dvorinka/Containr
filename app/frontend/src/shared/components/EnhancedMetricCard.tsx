import { type ReactNode } from 'react';

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
  const statusColors: Record<string, string> = {
    good: '#3dd68c',
    average: '#f0a040',
    warning: '#ff7043',
  };

  // Horizontal layout for cards like Active User
  if (horizontal) {
    return (
      <div
        className={`card ${className}`}
        style={{
          display: 'flex',
          flexDirection: 'row',
          padding: 0,
          overflow: 'hidden',
          animationDelay: `${animationDelay}s`,
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
      className={`card ${className}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        padding: 20,
        animationDelay: `${animationDelay}s`,
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

      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        paddingTop: 4, 
        marginTop: 'auto' 
      }}>
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
  const freePercent = 100 - cachePercent - nonCachePercent;

  return (
    <div
      className="card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        padding: 20,
        animationDelay: `${animationDelay}s`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div className="card-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="#9295a4" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
        </div>
        <span style={{ fontSize: 14, fontWeight: 600, color: '#e8e9f0' }}>Cache</span>
      </div>

      <div style={{
        fontSize: 38,
        fontWeight: 900,
        letterSpacing: '-1.5px',
        lineHeight: 1,
        color: '#e8e9f0',
      }}>
        {totalMB} MB
      </div>

      <div style={{ fontSize: 12, color: '#6b6e7d', marginTop: 4 }}>
        <span style={{ color: '#f0a040', fontWeight: 700 }}>{Math.round(totalMB * 0.625)}MB Average</span> cached images and files
      </div>

      {/* Segmented Bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, margin: '16px 0 15px', height: 32 }}>
        <div 
          className="cache-seg" 
          style={{ 
            width: `${cachePercent}%`, 
            background: '#ff6b5b', 
            borderRadius: '10px 4px 4px 10px' 
          }} 
        />
        <div 
          className="cache-seg" 
          style={{ 
            width: `${nonCachePercent}%`, 
            background: '#8c6ef0', 
            borderRadius: '5px' 
          }} 
        />
        <div 
          className="cache-seg" 
          style={{ 
            flex: 1, 
            background: 'rgba(255,255,255,0.07)', 
            borderRadius: '4px 10px 10px 4px' 
          }} 
        />
      </div>

      {/* Stats Row */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: '1fr auto 1fr auto 1fr', 
        gap: 0, 
        alignItems: 'stretch' 
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#6b6e7d', marginBottom: 5 }}>
            <div className="stat-dot" style={{ background: '#ff6b5b' }} /> Cache
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
            <span style={{ fontSize: 15, fontWeight: 800 }}>{cacheMB} MB</span>
            <span style={{ fontSize: 11, color: '#6b6e7d' }}>{cachePercent}%</span>
          </div>
        </div>
        <div style={{ width: 1, background: 'rgba(255,255,255,0.08)', margin: '0 16px' }} />
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#6b6e7d', marginBottom: 5 }}>
            <div className="stat-dot" style={{ background: '#8c6ef0' }} /> Non-Cache
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
            <span style={{ fontSize: 15, fontWeight: 800 }}>{nonCacheMB} MB</span>
            <span style={{ fontSize: 11, color: '#6b6e7d' }}>{nonCachePercent}%</span>
          </div>
        </div>
        <div style={{ width: 1, background: 'rgba(255,255,255,0.08)', margin: '0 16px' }} />
        <div>
          <div style={{ fontSize: 11, color: '#6b6e7d', marginBottom: 5 }}>Total</div>
          <div style={{ fontSize: 15, fontWeight: 800 }}>{totalMB * 5} GB</div>
        </div>
      </div>

      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        paddingTop: 16 
      }}>
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
  datasets,
  onClick,
  animationDelay = 0,
}: PerformanceMetricCardProps) {
  const status = percentage >= 85 ? 'Good' : percentage >= 70 ? 'Average' : 'Warning';
  const statusColor = percentage >= 85 ? '#3dd68c' : percentage >= 70 ? '#f0a040' : '#ff7043';

  return (
    <div
      className="card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        padding: 20,
        animationDelay: `${animationDelay}s`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div className="card-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="#9295a4" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="2" y1="12" x2="22" y2="12"/>
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
          </svg>
        </div>
        <span style={{ fontSize: 14, fontWeight: 600, color: '#e8e9f0' }}>Performance</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flex: 1 }}>
        <div style={{ flex: 1 }}>
          <div style={{
            fontSize: 36,
            fontWeight: 900,
            letterSpacing: '-1.5px',
            lineHeight: 1,
            color: '#e8e9f0',
          }}>
            {percentage}%
          </div>
          <div style={{ fontSize: 12, color: '#6b6e7d', marginTop: 4 }}>
            <span style={{ color: statusColor, fontWeight: 700 }}>{status}</span> Last scan on {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
          {/* Chart placeholder - will be replaced with actual chart */}
          <div style={{ width: 134, height: 58, background: 'rgba(255,255,255,0.03)', borderRadius: 8 }} />
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
            <div className="speed-row" style={{ color: '#6c8ef0' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="12" y1="19" x2="12" y2="5"/>
                <polyline points="5 12 12 19 19 12"/>
              </svg>
              <span>{upSpeed}</span> Mbps
            </div>
            <div className="speed-row" style={{ color: '#e8316a' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19"/>
                <polyline points="19 12 12 5 5 12"/>
              </svg>
              <span>{downSpeed}</span> Mbps
            </div>
          </div>
        </div>
      </div>

      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        paddingTop: 14 
      }}>
        <span
          onClick={onClick}
          style={{ fontSize: 13, color: '#6b6e7d', fontWeight: 500, cursor: 'pointer' }}
        >
          Check Speed
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
