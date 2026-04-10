import { useState } from 'react';
import { 
  Cpu, 
  MemoryStick, 
  Zap, 
  Users, 
  Activity,
  TrendingUp,
  Database
} from 'lucide-react';
import {
  LineChart,
  LineAreaChart,
  MultiLineChart,
  DonutChart,
  BarChart,
  EnhancedMetricCard,
  CacheMetricCard,
  PerformanceMetricCard,
  useToast
} from '@/shared/components';

// Sample data
const sampleLineData = [12, 19, 15, 25, 22, 30, 28, 35, 32, 38, 35, 42, 38, 45, 42, 48, 45, 52, 48, 55, 52, 58, 55, 60];
const sampleAreaData = [40, 45, 42, 50, 48, 55, 52, 60, 58, 65, 62, 70, 68, 75, 72];
const sampleBarData = [20, 35, 28, 45, 38, 52, 48, 60, 55, 68, 62, 75, 70, 82, 78, 88, 85, 92, 88, 95, 92, 98, 95, 100];

export function ComponentShowcase() {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'charts' | 'cards' | 'ui'>('charts');

  const handleCardClick = (name: string) => {
    showToast(`${name} clicked!`, 'info');
  };

  return (
    <div className="min-h-screen p-8" style={{ background: '#16171c' }}>
      <div className="ambient-glow" />
      
      <div className="max-w-7xl mx-auto relative z-10">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div 
              className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ background: '#e8316a' }}
            >
              <Activity size={24} className="text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-[var(--text-primary)]">
                Component Showcase
              </h1>
              <p className="text-sm text-[var(--text-secondary)]">
                Production-grade components matching self.html design
              </p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-[var(--border-subtle)] gap-1">
            <button
              onClick={() => setActiveTab('charts')}
              className={`tab ${activeTab === 'charts' ? 'active' : ''}`}
            >
              <Activity size={14} />
              Charts
            </button>
            <button
              onClick={() => setActiveTab('cards')}
              className={`tab ${activeTab === 'cards' ? 'active' : ''}`}
            >
              <Cpu size={14} />
              Metric Cards
            </button>
            <button
              onClick={() => setActiveTab('ui')}
              className={`tab ${activeTab === 'ui' ? 'active' : ''}`}
            >
              <Zap size={14} />
              UI Elements
            </button>
          </div>
        </div>

        {/* Charts Tab */}
        {activeTab === 'charts' && (
          <div className="space-y-8">
            <section>
              <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4">
                Line Charts
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="panel p-6">
                  <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-4">
                    Basic Line Chart (CPU Style)
                  </h3>
                  <LineChart 
                    data={sampleLineData} 
                    color="#ff7043" 
                    height={120}
                    showDots={true}
                    smooth={true}
                  />
                </div>
                <div className="panel p-6">
                  <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-4">
                    Line Chart (No Dots)
                  </h3>
                  <LineChart 
                    data={sampleLineData} 
                    color="#6c8ef0" 
                    height={120}
                    showDots={false}
                    smooth={true}
                  />
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4">
                Area Charts
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="panel p-6">
                  <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-4">
                    Area Chart (Active Users Style)
                  </h3>
                  <LineAreaChart 
                    data={sampleAreaData} 
                    color="#e8316a"
                    fillOpacity={0.15}
                    height={150}
                  />
                </div>
                <div className="panel p-6">
                  <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-4">
                    Area Chart (Success Color)
                  </h3>
                  <LineAreaChart 
                    data={sampleAreaData} 
                    color="#3dd68c"
                    fillOpacity={0.2}
                    height={150}
                  />
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4">
                Multi-Line & Bar Charts
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="panel p-6">
                  <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-4">
                    Multi-Line Chart (Performance Style)
                  </h3>
                  <MultiLineChart 
                    datasets={[
                      { data: sampleLineData.map(v => v + 10), color: '#6c8ef0', fillOpacity: 0.15 },
                      { data: sampleLineData, color: '#9c7ef0', fillOpacity: 0.15 }
                    ]}
                    height={120}
                  />
                </div>
                <div className="panel p-6">
                  <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-4">
                    Bar Chart (Timeline Style)
                  </h3>
                  <BarChart 
                    data={sampleBarData} 
                    color="#3dd68c"
                    height={120}
                    gap={2}
                  />
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4">
                Donut Charts
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="panel p-6 flex flex-col items-center">
                  <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-4">
                    RAM Usage (65%)
                  </h3>
                  <DonutChart percentage={65} color="#9c7ef0" size={160} />
                </div>
                <div className="panel p-6 flex flex-col items-center">
                  <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-4">
                    Disk Usage (82%)
                  </h3>
                  <DonutChart percentage={82} color="#ff7043" size={160} />
                </div>
                <div className="panel p-6 flex flex-col items-center">
                  <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-4">
                    Network (45%)
                  </h3>
                  <DonutChart percentage={45} color="#6c8ef0" size={160} />
                </div>
              </div>
            </section>
          </div>
        )}

        {/* Metric Cards Tab */}
        {activeTab === 'cards' && (
          <div className="space-y-8">
            <section>
              <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4">
                Standard Metric Cards
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                <EnhancedMetricCard
                  title="CPU Usage"
                  value="12%"
                  subtitle="Daily usage"
                  status="good"
                  statusText="Good"
                  icon={<Cpu size={16} />}
                  chart={<LineChart data={sampleLineData} color="#ff7043" height={76} />}
                  onClick={() => handleCardClick('CPU Usage')}
                  animationDelay={0.04}
                />
                <EnhancedMetricCard
                  title="Memory"
                  value="65%"
                  subtitle="Container footprint"
                  status="average"
                  statusText="Average"
                  icon={<MemoryStick size={16} />}
                  chart={<LineChart data={sampleLineData.map(v => v + 20)} color="#9c7ef0" height={76} />}
                  onClick={() => handleCardClick('Memory')}
                  animationDelay={0.09}
                />
                <EnhancedMetricCard
                  title="Requests"
                  value="2.4K"
                  subtitle="Last 60 minutes"
                  icon={<Zap size={16} />}
                  chart={<BarChart data={sampleBarData} color="#3dd68c" height={76} gap={2} />}
                  onClick={() => handleCardClick('Requests')}
                  animationDelay={0.14}
                />
              </div>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4">
                Horizontal Layout Cards
              </h2>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <EnhancedMetricCard
                  title="Active Users"
                  value="475 K"
                  subtitle="Users active right now"
                  icon={<Users size={16} />}
                  chart={<LineAreaChart data={sampleAreaData} color="#e8316a" height={130} />}
                  details={
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {['🇨🇳', '🇮🇩', '🇲🇲', '🇲🇾', '🇯🇵', '🇮🇳', '🇰🇷', '🇵🇭'].map((flag, i) => (
                        <span key={i} className="flag">{flag}</span>
                      ))}
                    </div>
                  }
                  horizontal
                  onClick={() => handleCardClick('Active Users')}
                  animationDelay={0.04}
                />
                <EnhancedMetricCard
                  title="Database Queries"
                  value="12.5K"
                  subtitle="Queries per minute"
                  icon={<Database size={16} />}
                  chart={<LineAreaChart data={sampleAreaData.map(v => v + 10)} color="#6c8ef0" height={130} />}
                  details={
                    <div className="flex items-center gap-3 text-xs">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-[var(--success)]" />
                        <span className="text-[var(--text-secondary)]">Read: 8.2K</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-[var(--warning)]" />
                        <span className="text-[var(--text-secondary)]">Write: 4.3K</span>
                      </div>
                    </div>
                  }
                  horizontal
                  onClick={() => handleCardClick('Database Queries')}
                  animationDelay={0.09}
                />
              </div>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4">
                Specialized Cards
              </h2>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <CacheMetricCard
                  totalMB={352}
                  cacheMB={212}
                  nonCacheMB={85}
                  onClick={() => handleCardClick('Cache')}
                  animationDelay={0.04}
                />
                <PerformanceMetricCard
                  percentage={89}
                  upSpeed={10.4}
                  downSpeed={5.2}
                  datasets={[
                    { data: sampleLineData.map(v => v + 20), color: '#6c8ef0', fillOpacity: 0.15 },
                    { data: sampleLineData.map(v => v + 10), color: '#9c7ef0', fillOpacity: 0.15 }
                  ]}
                  onClick={() => handleCardClick('Performance')}
                  animationDelay={0.09}
                />
              </div>
            </section>
          </div>
        )}

        {/* UI Elements Tab */}
        {activeTab === 'ui' && (
          <div className="space-y-8">
            <section>
              <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4">
                Badges & Indicators
              </h2>
              <div className="panel p-6 space-y-4">
                <div className="flex items-center gap-4 flex-wrap">
                  <span className="badge-active">
                    <span className="live-dot" />
                    Active
                  </span>
                  <span className="badge-stopped">Stopped</span>
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--success-soft)] text-[var(--success)] text-xs font-medium">
                    <div className="w-2 h-2 rounded-full bg-[var(--success)]" />
                    Healthy
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--warning-soft)] text-[var(--warning)] text-xs font-medium">
                    <div className="w-2 h-2 rounded-full bg-[var(--warning)]" />
                    Degraded
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--error-soft)] text-[var(--error)] text-xs font-medium">
                    <div className="w-2 h-2 rounded-full bg-[var(--error)]" />
                    Critical
                  </div>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4">
                Buttons
              </h2>
              <div className="panel p-6 space-y-4">
                <div className="flex items-center gap-4 flex-wrap">
                  <button className="btn-stop">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                      <circle cx="12" cy="12" r="10"/>
                      <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none"/>
                    </svg>
                    STOP
                  </button>
                  <button className="btn-restart">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                      <polyline points="1 4 1 10 7 10"/>
                      <path d="M3.51 15a9 9 0 1 0 .49-4.5"/>
                    </svg>
                    RESTART
                  </button>
                  <div className="arrow-btn">
                    <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </div>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4">
                Pills & Tabs
              </h2>
              <div className="panel p-6 space-y-6">
                <div>
                  <p className="text-sm text-[var(--text-secondary)] mb-3">Pill Group</p>
                  <div className="pill-group">
                    <div className="pill active">Day</div>
                    <div className="pill">Month</div>
                    <div className="pill">Year</div>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-[var(--text-secondary)] mb-3">Tabs</p>
                  <div className="flex border-b border-[var(--border-subtle)]">
                    <button className="tab active">
                      <Activity size={14} />
                      Metrics
                    </button>
                    <button className="tab">
                      <Zap size={14} />
                      Requests
                    </button>
                    <button className="tab">
                      <TrendingUp size={14} />
                      Analytics
                    </button>
                  </div>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4">
                Search & Input
              </h2>
              <div className="panel p-6 space-y-4">
                <div className="search-box">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b6e7d" strokeWidth="2" strokeLinecap="round">
                    <circle cx="11" cy="11" r="8"/>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                  </svg>
                  <input type="text" placeholder="Search logs..." />
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4">
                Toast Notifications
              </h2>
              <div className="panel p-6">
                <div className="flex gap-3 flex-wrap">
                  <button
                    onClick={() => showToast('Operation completed successfully!', 'success')}
                    className="px-4 py-2 rounded-lg bg-[var(--success-soft)] text-[var(--success)] text-sm font-medium hover:bg-[var(--success-soft)]/80 transition-colors"
                  >
                    Show Success
                  </button>
                  <button
                    onClick={() => showToast('This is an informational message', 'info')}
                    className="px-4 py-2 rounded-lg bg-[var(--info-soft)] text-[var(--info)] text-sm font-medium hover:bg-[var(--info-soft)]/80 transition-colors"
                  >
                    Show Info
                  </button>
                  <button
                    onClick={() => showToast('Warning: Please check your settings', 'warning')}
                    className="px-4 py-2 rounded-lg bg-[var(--warning-soft)] text-[var(--warning)] text-sm font-medium hover:bg-[var(--warning-soft)]/80 transition-colors"
                  >
                    Show Warning
                  </button>
                  <button
                    onClick={() => showToast('Error: Operation failed', 'error')}
                    className="px-4 py-2 rounded-lg bg-[var(--error-soft)] text-[var(--error)] text-sm font-medium hover:bg-[var(--error-soft)]/80 transition-colors"
                  >
                    Show Error
                  </button>
                </div>
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
