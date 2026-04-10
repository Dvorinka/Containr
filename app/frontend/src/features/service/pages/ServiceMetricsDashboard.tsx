import { useMemo, useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { 
  Cpu, 
  MemoryStick, 
  Zap, 
  Users, 
  Globe,
  ArrowLeft,
  Search,
  Bell,
  ChevronUp,
  Activity,
  FileText,
  Sliders,
  Settings as SettingsIcon
} from 'lucide-react';
import { 
  LineChart, 
  LineAreaChart, 
  DonutChart, 
  MultiLineChart,
  EnhancedMetricCard,
  CacheMetricCard,
  PerformanceMetricCard
} from '@/shared/components';

// Generate seeded random data for demo
function seededRandom(seed: string, min: number, max: number): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash = hash & hash;
  }
  const normalized = Math.abs(Math.sin(hash));
  return Math.floor(normalized * (max - min + 1)) + min;
}

type TabKey = 'metrics' | 'requests' | 'apis' | 'config';

const tabs: Array<{ key: TabKey; label: string; icon: typeof Activity }> = [
  { key: 'metrics', label: 'Metrics', icon: Activity },
  { key: 'requests', label: 'Requests', icon: Zap },
  { key: 'apis', label: 'APIs', icon: Globe },
  { key: 'config', label: 'Config', icon: Sliders },
];

const timePeriods = ['Day', 'Month', 'Year'];

export function ServiceMetricsDashboard() {
  const { serviceId = 'demo-service' } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const [activeTab, setActiveTab] = useState<TabKey>('metrics');
  const [timePeriod, setTimePeriod] = useState('Day');
  const [isSystemRunning, setIsSystemRunning] = useState(true);

  // Generate realistic metric data
  const metrics = useMemo(() => {
    const cpuData = Array.from({ length: 24 }, (_, i) => 
      seededRandom(`${serviceId}:cpu:${i}`, 10, 45)
    );
    const ramPercent = seededRandom(`${serviceId}:ram`, 50, 85);
    const userCount = seededRandom(`${serviceId}:users`, 400, 500);
    const userData = Array.from({ length: 15 }, (_, i) => 
      seededRandom(`${serviceId}:users:${i}`, 40, 110)
    );
    const perfPercent = seededRandom(`${serviceId}:perf`, 82, 99);
    const perfData1 = Array.from({ length: 12 }, (_, i) => 
      seededRandom(`${serviceId}:perf1:${i}`, 70, 95)
    );
    const perfData2 = Array.from({ length: 12 }, (_, i) => 
      seededRandom(`${serviceId}:perf2:${i}`, 60, 90)
    );

    return {
      cpu: cpuData[cpuData.length - 1],
      cpuData,
      ram: ramPercent,
      ramUsedGB: ((8 * ramPercent) / 100).toFixed(1),
      users: userCount,
      userData,
      perf: perfPercent,
      perfData: [
        { data: perfData1, color: '#6c8ef0', fillOpacity: 0.15 },
        { data: perfData2, color: '#9c7ef0', fillOpacity: 0.15 }
      ],
      upSpeed: (Math.random() * 5 + 8).toFixed(1),
      downSpeed: (Math.random() * 3 + 4).toFixed(1),
    };
  }, [serviceId, timePeriod]);

  // Auto-update metrics every 2 seconds
  useEffect(() => {
    if (!isSystemRunning) return;
    
    const interval = setInterval(() => {
      // Trigger re-render by updating time period
      setTimePeriod(prev => prev);
    }, 2000);

    return () => clearInterval(interval);
  }, [isSystemRunning]);

  const handleStop = () => {
    setIsSystemRunning(false);
  };

  const handleRestart = () => {
    setIsSystemRunning(true);
  };

  return (
    <div className="min-h-screen" style={{ background: '#16171c' }}>
      {/* Ambient glow */}
      <div className="ambient-glow" />

      <div className="flex min-h-screen relative">
        {/* Sidebar - self.html exact match */}
        <aside 
          className="hidden md:flex shrink-0 flex-col items-center border-r"
          style={{ 
            width: '64px',
            background: '#111217',
            borderRight: '1px solid rgba(255,255,255,0.07)',
            padding: '16px 0',
            gap: '5px'
          }}
        >
          {/* Logo */}
          <div 
            className="rounded-full flex items-center justify-center"
            style={{ 
              width: '38px', 
              height: '38px', 
              background: '#e8316a',
              marginBottom: '14px'
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/>
            </svg>
          </div>
          
          {/* Nav Items */}
          <div className="nav-item active">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" rx="1.5"/>
              <rect x="14" y="3" width="7" height="7" rx="1.5"/>
              <rect x="3" y="14" width="7" height="7" rx="1.5"/>
              <rect x="14" y="14" width="7" height="7" rx="1.5"/>
            </svg>
          </div>
          <div className="nav-item">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2"/>
              <path d="M8 21h8M12 17v4"/>
            </svg>
          </div>
          <div className="nav-item">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <ellipse cx="12" cy="5" rx="9" ry="3"/>
              <path d="M3 5v6c0 1.66 4.03 3 9 3s9-1.34 9-3V5"/>
              <path d="M3 11v6c0 1.66 4.03 3 9 3s9-1.34 9-3v-6"/>
            </svg>
          </div>
          
          <div className="flex-1" />
          
          {/* User Avatar */}
          <div 
            className="rounded-full flex items-center justify-center cursor-pointer"
            style={{ 
              width: '34px', 
              height: '34px', 
              background: '#22233a',
              fontSize: '11px',
              fontWeight: 700,
              color: '#9295a4',
              marginTop: '4px',
              letterSpacing: '-0.3px'
            }}
          >
            w.
          </div>
        </aside>

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
          {/* Topbar - self.html exact match */}
          <header 
            className="shrink-0 flex items-center"
            style={{ 
              height: '52px',
              background: '#111217',
              borderBottom: '1px solid rgba(255,255,255,0.07)',
              padding: '0 22px',
              gap: '14px'
            }}
          >
            <div className="search-box">
              <Search size={14} />
              <input type="text" placeholder="Search logs..." />
            </div>
            
            <div className="ml-auto flex items-center" style={{ gap: '8px' }}>
              <button 
                className="rounded-[9px] border bg-transparent text-[#9295a4] font-medium cursor-pointer"
                style={{
                  height: '32px',
                  padding: '0 14px',
                  border: '1px solid rgba(255,255,255,0.1)',
                  fontSize: '13px'
                }}
              >
                Support
              </button>
              <button 
                className="rounded-[9px] border-none flex items-center text-[#e8e9f0] font-medium cursor-pointer"
                style={{
                  height: '32px',
                  padding: '0 14px',
                  background: 'rgba(255,255,255,0.08)',
                  fontSize: '13px',
                  gap: '6px'
                }}
              >
                <ChevronUp size={13} />
                Upgrade
              </button>
              <button 
                className="rounded-[9px] border flex items-center justify-center cursor-pointer bg-transparent"
                style={{
                  width: '32px',
                  height: '32px',
                  border: '1px solid rgba(255,255,255,0.1)'
                }}
              >
                <Bell size={15} color="#9295a4" />
              </button>
            </div>
          </header>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto" style={{ padding: '0 24px 28px' }}>
            {/* Breadcrumb */}
            <div 
              className="flex items-center"
              style={{ 
                gap: '6px', 
                padding: '14px 0 10px',
                color: '#6b6e7d',
                fontSize: '13px'
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b6e7d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
              <button 
                onClick={() => navigate(-1)}
                style={{ color: '#6b6e7d' }}
                className="hover:text-[#9295a4] transition-colors"
              >
                Servers
              </button>
              <span style={{ opacity: 0.4 }}>/</span>
              <span style={{ color: '#9295a4' }}>[NuFest] - App Project</span>
            </div>

            {/* Project Header */}
            <div className="flex items-center" style={{ paddingBottom: '18px' }}>
              <div 
                className="rounded-[13px] flex items-center justify-center flex-shrink-0"
                style={{ 
                  width: '46px', 
                  height: '46px', 
                  background: '#e8316a',
                  marginRight: '14px'
                }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/>
                </svg>
              </div>
              <div>
                <div className="flex items-center" style={{ gap: '10px' }}>
                  <span style={{ fontSize: '20px', fontWeight: 800, letterSpacing: '-0.5px', color: '#e8e9f0' }}>
                    [NuFest] - App Project
                  </span>
                  <span className={`badge-${isSystemRunning ? 'active' : 'stopped'}`}>
                    {isSystemRunning && <span className="live-dot" />}
                    {isSystemRunning ? 'Active' : 'Stopped'}
                  </span>
                </div>
                <div className="flex items-center" style={{ gap: '16px', marginTop: '4px' }}>
                  <a 
                    href="https://nufest-dth.app"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center hover:text-[#9295a4] transition-colors"
                    style={{ color: '#6b6e7d', fontSize: '12.5px', textDecoration: 'none', gap: '4px' }}
                  >
                    https://nufest-dth.app
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                      <polyline points="15 3 21 3 21 9"/>
                      <line x1="10" y1="14" x2="21" y2="3"/>
                    </svg>
                  </a>
                  <button 
                    className="flex items-center hover:text-[#9295a4] transition-colors"
                    style={{ color: '#6b6e7d', fontSize: '12.5px', gap: '4px' }}
                  >
                    Project Information
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <polyline points="9 18 15 12 9 6"/>
                    </svg>
                  </button>
                </div>
              </div>
              <div className="ml-auto flex" style={{ gap: '10px' }}>
                <button
                  onClick={handleStop}
                  disabled={!isSystemRunning}
                  className={`btn-stop ${!isSystemRunning ? 'disabled' : ''}`}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                    <circle cx="12" cy="12" r="10"/>
                    <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none"/>
                  </svg>
                  STOP
                </button>
                <button
                  onClick={handleRestart}
                  disabled={isSystemRunning}
                  className={`btn-restart ${isSystemRunning ? 'disabled' : ''}`}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                    <polyline points="1 4 1 10 7 10"/>
                    <path d="M3.51 15a9 9 0 1 0 .49-4.5"/>
                  </svg>
                  RESTART
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div 
              className="flex"
              style={{ 
                borderBottom: '1px solid rgba(255,255,255,0.07)',
                marginBottom: '18px'
              }}
            >
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`tab ${activeTab === tab.key ? 'active' : ''}`}
                  >
                    <Icon size={14} />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Metrics Header */}
            <div className="flex items-center justify-between" style={{ marginBottom: '16px' }}>
              <span style={{ fontSize: '15px', fontWeight: 700, color: '#e8e9f0' }}>Metrics</span>
              <div className="flex items-center" style={{ gap: '8px' }}>
                <button 
                  className="rounded-[9px] border flex items-center font-medium cursor-pointer"
                  style={{
                    height: '32px',
                    padding: '0 12px',
                    border: '1px solid rgba(255,255,255,0.09)',
                    background: 'rgba(255,255,255,0.04)',
                    color: '#9295a4',
                    fontSize: '12.5px',
                    gap: '6px'
                  }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
                  </svg>
                  Filter
                </button>
                <div className="pill-group">
                  {timePeriods.map((period) => (
                    <div
                      key={period}
                      onClick={() => setTimePeriod(period)}
                      className={`pill ${timePeriod === period ? 'active' : ''}`}
                    >
                      {period}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Row 1: CPU, RAM, Cache */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.95fr', gap: '13px', marginBottom: '13px' }}>
              {/* CPU Card */}
              <EnhancedMetricCard
                title="CPU Usage"
                value={`${metrics.cpu}%`}
                subtitle="Daily usage"
                status="good"
                statusText="Good"
                icon={<Cpu size={16} />}
                chart={<LineChart data={metrics.cpuData} color="#ff7043" height={76} />}
                animationDelay={0.04}
              />

              {/* RAM Card */}
              <div className="card" style={{ animationDelay: '0.09s' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <div className="card-icon">
                    <MemoryStick size={16} />
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#e8e9f0' }}>RAM Usage</span>
                </div>
                <div style={{ fontSize: 38, fontWeight: 900, letterSpacing: '-1.5px', lineHeight: 1, color: '#e8e9f0' }}>
                  {metrics.ram}%
                </div>
                <div style={{ fontSize: 12, color: '#6b6e7d', marginTop: 4 }}>
                  <span style={{ color: '#f0a040', fontWeight: 700 }}>Average</span> Daily usage
                </div>
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', margin: '10px 0 4px', position: 'relative' }}>
                  <DonutChart percentage={metrics.ram} color="#9c7ef0" />
                  <div style={{ position: 'absolute', bottom: 14, textAlign: 'center' }}>
                    <div style={{ fontSize: 10.5, color: '#6b6e7d', marginBottom: 1 }}>Used</div>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: '#e8e9f0' }}>{metrics.ramUsedGB} GB / 8GB</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 4 }}>
                  <span style={{ fontSize: 13, color: '#6b6e7d', fontWeight: 500, cursor: 'pointer' }}>Details</span>
                  <div className="arrow-btn">
                    <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Cache Card */}
              <CacheMetricCard
                totalMB={352}
                cacheMB={212}
                nonCacheMB={85}
                animationDelay={0.14}
              />
            </div>

            {/* Row 2: Active Users, Performance */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '13px' }}>
              {/* Active Users Card */}
              <EnhancedMetricCard
                title="Active User"
                value={`${metrics.users} K`}
                subtitle="User active right now"
                icon={<Users size={16} />}
                chart={<LineAreaChart data={metrics.userData} color="#e8316a" height={130} />}
                details={
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {['🇨🇳', '🇮🇩', '🇲🇲', '🇲🇾', '🇯🇵', '🇮🇳', '🇰🇷', '🇵🇭'].map((flag, i) => (
                      <span key={i} className="flag">{flag}</span>
                    ))}
                  </div>
                }
                horizontal
                animationDelay={0.19}
              />

              {/* Performance Card */}
              <PerformanceMetricCard
                percentage={metrics.perf}
                upSpeed={parseFloat(metrics.upSpeed)}
                downSpeed={parseFloat(metrics.downSpeed)}
                datasets={metrics.perfData}
                animationDelay={0.24}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
