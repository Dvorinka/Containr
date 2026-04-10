import { useEffect, useState } from 'react';
import {
  LineMetricChart,
  DualLineChart,
  DonutChart,
} from '@/shared/components';

interface MetricData {
  cpu: number[];
  ram: number;
  ramUsed: string;
  cache: number;
  cacheBreakdown: { cache: number; nonCache: number; total: number };
  users: number[];
  performance: number[];
  performanceAlt: number[];
  upSpeed: number;
  downSpeed: number;
}

interface MetricsDashboardProps {
  projectId?: string;
  isRunning?: boolean;
  onStop?: () => void;
  onRestart?: () => void;
}

function getRandom(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateInitialData(): MetricData {
  return {
    cpu: Array.from({ length: 24 }, () => getRandom(10, 45)),
    ram: getRandom(50, 85),
    ramUsed: '5.4 GB',
    cache: 352,
    cacheBreakdown: { cache: 212, nonCache: 85.5, total: 1750 },
    users: Array.from({ length: 15 }, () => getRandom(40, 110)),
    performance: Array.from({ length: 12 }, () => getRandom(70, 95)),
    performanceAlt: Array.from({ length: 12 }, () => getRandom(60, 85)),
    upSpeed: 10.4,
    downSpeed: 5.2,
  };
}

export function MetricsDashboard({
  isRunning = true,
}: MetricsDashboardProps) {
  const [data, setData] = useState<MetricData>(generateInitialData);
  const [timeRange, setTimeRange] = useState<'day' | 'month' | 'year'>('day');

  useEffect(() => {
    if (!isRunning) return;

    const interval = setInterval(() => {
      setData((prev) => {
        const newCpu = [...prev.cpu.slice(1), getRandom(10, 45)];
        const newUsers = [...prev.users.slice(1), getRandom(60, 110)];
        const newPerf = [...prev.performance.slice(1), getRandom(82, 99)];
        const newPerfAlt = [...prev.performanceAlt.slice(1), getRandom(60, 85)];

        return {
          ...prev,
          cpu: newCpu,
          ram: getRandom(50, 85),
          ramUsed: `${(8 * (prev.ram / 100)).toFixed(1)} GB`,
          users: newUsers,
          performance: newPerf,
          performanceAlt: newPerfAlt,
          upSpeed: parseFloat((Math.random() * 5 + 8).toFixed(1)),
          downSpeed: parseFloat((Math.random() * 3 + 4).toFixed(1)),
        };
      });
    }, 2000);

    return () => clearInterval(interval);
  }, [isRunning]);

  const currentCpu = data.cpu[data.cpu.length - 1];
  const currentUsers = data.users[data.users.length - 1];
  const currentPerf = data.performance[data.performance.length - 1];

  return (
    <div>
      {/* Metrics Header - self.html exact match */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <span style={{ fontSize: '15px', fontWeight: 700, color: '#e8e9f0' }}>Metrics</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button style={{
            height: '32px',
            padding: '0 12px',
            borderRadius: '9px',
            border: '1px solid rgba(255,255,255,0.09)',
            background: 'rgba(255,255,255,0.04)',
            color: '#9295a4',
            fontSize: '12.5px',
            fontWeight: 500,
            fontFamily: 'inherit',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
            </svg>
            Filter
          </button>
          <div className="pill-group">
            {(['day', 'month', 'year'] as const).map((range) => (
              <div
                key={range}
                className={`pill ${timeRange === range ? 'active' : ''}`}
                onClick={() => setTimeRange(range)}
              >
                {range.charAt(0).toUpperCase() + range.slice(1)}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 1: CPU, RAM, Cache - self.html exact: 13px gap */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.95fr', gap: '13px', marginBottom: '13px' }}>
        {/* CPU Card */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
            <div className="card-icon"><svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/><line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="14" x2="23" y2="14"/><line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="14" x2="4" y2="14"/></svg></div>
            <span style={{ fontSize: '14px', fontWeight: 600, color: '#e8e9f0' }}>CPU Usage</span>
          </div>
          <div style={{ fontSize: '38px', fontWeight: 900, letterSpacing: '-1.5px', lineHeight: 1, color: '#e8e9f0' }}>{currentCpu}%</div>
          <div style={{ fontSize: '12px', color: '#6b6e7d', marginTop: '4px' }}>
            <span style={{ color: currentCpu < 50 ? '#3dd68c' : currentCpu < 75 ? '#f0a040' : '#ff7043', fontWeight: 700 }}>
              {currentCpu < 50 ? 'Good' : currentCpu < 75 ? 'Average' : 'High'}
            </span>{' '}
            Daily usage
          </div>
          <div style={{ height: 76, margin: '12px 0 6px' }}>
            <LineMetricChart data={data.cpu} color="#ff7043" height={76} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '4px' }}>
            <span style={{ fontSize: '13px', color: '#6b6e7d', fontWeight: 500, cursor: 'pointer' }}>Details</span>
            <div className="arrow-btn">
              <svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>
            </div>
          </div>
        </div>

        {/* RAM Card */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
            <div className="card-icon"><svg viewBox="0 0 24 24"><rect x="2" y="8" width="20" height="8" rx="2"/><path d="M6 8V6M10 8V6M14 8V6M18 8V6M6 16v2M18 16v2"/></svg></div>
            <span style={{ fontSize: '14px', fontWeight: 600, color: '#e8e9f0' }}>RAM Usage</span>
          </div>
          <div style={{ fontSize: '38px', fontWeight: 900, letterSpacing: '-1.5px', lineHeight: 1, color: '#e8e9f0' }}>{data.ram}%</div>
          <div style={{ fontSize: '12px', color: '#6b6e7d', marginTop: '4px' }}>
            <span style={{ color: data.ram < 60 ? '#3dd68c' : '#f0a040', fontWeight: 700 }}>
              {data.ram < 60 ? 'Good' : 'Average'}
            </span>{' '}
            Daily usage
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', margin: '10px 0 4px', position: 'relative' }}>
            <DonutChart percent={data.ram} color="#9c7ef0" size={160} thickness={16} />
            <div style={{ position: 'absolute', bottom: 14, textAlign: 'center' }}>
              <div style={{ fontSize: '10.5px', color: '#6b6e7d', marginBottom: 1 }}>Used</div>
              <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#e8e9f0' }}>{data.ramUsed} / 8GB</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '4px' }}>
            <span style={{ fontSize: '13px', color: '#6b6e7d', fontWeight: 500, cursor: 'pointer' }}>Details</span>
            <div className="arrow-btn">
              <svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>
            </div>
          </div>
        </div>

        {/* Cache Card */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
            <div className="card-icon"><svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></div>
            <span style={{ fontSize: '14px', fontWeight: 600, color: '#e8e9f0' }}>Cache</span>
          </div>
          <div style={{ fontSize: '38px', fontWeight: 900, letterSpacing: '-1.5px', lineHeight: 1, color: '#e8e9f0' }}>{data.cache} MB</div>
          <div style={{ fontSize: '12px', color: '#6b6e7d', marginTop: '4px' }}>
            <span style={{ color: '#f0a040', fontWeight: 700 }}>220MB Average</span>{' '}
            cached images and files
          </div>

          {/* Segmented Bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', margin: '16px 0 15px', height: '32px' }}>
            <div className="cache-seg" style={{ width: '43%', background: '#ff6b5b', borderRadius: '10px 4px 4px 10px' }} />
            <div className="cache-seg" style={{ width: '13%', background: '#8c6ef0', borderRadius: '5px' }} />
            <div className="cache-seg" style={{ flex: 1, background: 'rgba(255,255,255,0.07)', borderRadius: '4px 10px 10px 4px' }} />
          </div>

          {/* Stats row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr auto 1fr', gap: 0, alignItems: 'stretch' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: '#6b6e7d', marginBottom: '5px' }}>
                <div className="stat-dot" style={{ background: '#ff6b5b' }} />
                Cache
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                <span style={{ fontSize: '15px', fontWeight: 800, color: '#e8e9f0' }}>212 MB</span>
                <span style={{ fontSize: '11px', color: '#6b6e7d' }}>12%</span>
              </div>
            </div>
            <div style={{ width: '1px', background: 'rgba(255,255,255,0.08)', margin: '0 16px' }} />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: '#6b6e7d', marginBottom: '5px' }}>
                <div className="stat-dot" style={{ background: '#8c6ef0' }} />
                Non-Cache
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                <span style={{ fontSize: '15px', fontWeight: 800, color: '#e8e9f0' }}>85.5 MB</span>
                <span style={{ fontSize: '11px', color: '#6b6e7d' }}>4%</span>
              </div>
            </div>
            <div style={{ width: '1px', background: 'rgba(255,255,255,0.08)', margin: '0 16px' }} />
            <div>
              <div style={{ fontSize: '11px', color: '#6b6e7d', marginBottom: '5px' }}>Total</div>
              <div style={{ fontSize: '15px', fontWeight: 800, color: '#e8e9f0' }}>1.75 GB</div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '16px' }}>
            <span style={{ fontSize: '13px', color: '#6b6e7d', fontWeight: 500, cursor: 'pointer' }}>Details</span>
            <div className="arrow-btn">
              <svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>
            </div>
          </div>
        </div>
      </div>

      {/* Row 2: Active Users, Performance - self.html exact: 13px gap */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '13px' }}>
        {/* Active Users - horizontal layout */}
        <div className="card" style={{ flexDirection: 'row', padding: 0, overflow: 'hidden' }}>
          <div style={{ flex: 1, padding: '20px 18px 18px 20px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <div className="card-icon"><svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg></div>
              <span style={{ fontSize: '14px', fontWeight: 600, color: '#e8e9f0' }}>Active User</span>
            </div>
            <div style={{ fontSize: '36px', fontWeight: 900, letterSpacing: '-1.5px', lineHeight: 1, color: '#e8e9f0' }}>{currentUsers} K</div>
            <div style={{ fontSize: '12px', color: '#6b6e7d', marginTop: '4px' }}>User active right now</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '12px', flexWrap: 'wrap' }}>
              {['🇨🇳', '🇮🇩', '🇲🇲', '🇲🇾', '🇯🇵', '🇮🇳', '🇰🇷', '🇵🇭'].map((flag, i) => (
                <span key={i} className="flag">{flag}</span>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', paddingTop: '14px' }}>
              <span style={{ fontSize: '13px', color: '#6b6e7d', fontWeight: 500, cursor: 'pointer' }}>Details</span>
              <div className="arrow-btn">
                <svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>
              </div>
            </div>
          </div>
          <div style={{ width: '50%', padding: '16px 14px 46px 0', display: 'flex', alignItems: 'flex-end' }}>
            <LineMetricChart data={data.users} color="#e8316a" fillOpacity={0.15} showArea height={130} />
          </div>
        </div>

        {/* Performance Card */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
            <div className="card-icon"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg></div>
            <span style={{ fontSize: '14px', fontWeight: 600, color: '#e8e9f0' }}>Performance</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', flex: 1 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '36px', fontWeight: 900, letterSpacing: '-1.5px', lineHeight: 1, color: '#e8e9f0' }}>{currentPerf}%</div>
              <div style={{ fontSize: '12px', color: '#6b6e7d', marginTop: '4px' }}>
                <span style={{ color: currentPerf > 85 ? '#3dd68c' : '#f0a040', fontWeight: 700 }}>
                  {currentPerf > 85 ? 'Good' : 'Average'}
                </span>{' '}
                Last scan
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
              <div style={{ width: 134, height: 58 }}>
                <DualLineChart data1={data.performance} data2={data.performanceAlt} height={58} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-end' }}>
                <div className="speed-row" style={{ color: '#6c8ef0' }}>
                  <svg viewBox="0 0 24 24"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 19 19 12"/></svg>
                  <span>{data.upSpeed}</span> Mbps
                </div>
                <div className="speed-row" style={{ color: '#e8316a' }}>
                  <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 5 5 12"/></svg>
                  <span>{data.downSpeed}</span> Mbps
                </div>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '14px' }}>
            <span style={{ fontSize: '13px', color: '#6b6e7d', fontWeight: 500, cursor: 'pointer' }}>Check Speed</span>
            <div className="arrow-btn">
              <svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
