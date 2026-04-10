import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  createDeployment,
  deleteService,
  getProjectById,
  getDeploymentLogs,
  getServiceById,
  listDeployments,
  listServiceLogs,
  rollbackDeployment,
} from '@/lib/api-client';
import { getDemoProjectById, getDemoServiceById } from '@/lib/demo-data';
import { formatDate, formatRelative, seededMetric } from '@/lib/time';
import {
  ArrowLeft,
  Activity,
  FileText,
  Settings,
  Sliders,
  Play,
  RotateCw,
  Trash2,
  Check,
  X,
  Loader2,
  Clock,
  Cpu,
  Layers,
  MemoryStick,
  Zap,
  Timer,
  Sparkles,
  RefreshCw,
  Box,
} from 'lucide-react';

type ServiceSection = 'metrics' | 'logs' | 'config' | 'settings';

const sectionItems: Array<{ key: ServiceSection; label: string; icon: typeof Activity }> = [
  { key: 'metrics', label: 'Metrics', icon: Activity },
  { key: 'logs', label: 'Logs', icon: FileText },
  { key: 'config', label: 'Config', icon: Sliders },
  { key: 'settings', label: 'Settings', icon: Settings },
];

function MetricCard({ label, value, hint, icon: Icon, trend }: { label: string; value: string; hint: string; icon: typeof Cpu; trend?: 'up' | 'down' | 'stable' }) {
  return (
    <div className="panel p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="w-8 h-8 rounded-[var(--radius-sm)] bg-[var(--accent-primary-soft)] flex items-center justify-center">
          <Icon size={16} className="text-[var(--accent-primary)]" />
        </div>
        {trend && (
          <div className={`text-xs ${trend === 'up' ? 'text-[var(--success)]' : trend === 'down' ? 'text-[var(--error)]' : 'text-[var(--text-tertiary)]'}`}>
            {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'}
          </div>
        )}
      </div>
      <p className="text-2xl font-semibold text-[var(--text-primary)]">{value}</p>
      <p className="text-xs text-[var(--text-muted)] mt-1">{label}</p>
      <p className="text-[10px] text-[var(--text-tertiary)] mt-0.5">{hint}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config = {
    running: { color: 'var(--success)', bg: 'var(--success-soft)', Icon: Check, animate: false },
    deployed: { color: 'var(--success)', bg: 'var(--success-soft)', Icon: Check, animate: false },
    failed: { color: 'var(--error)', bg: 'var(--error-soft)', Icon: X, animate: false },
    building: { color: 'var(--warning)', bg: 'var(--warning-soft)', Icon: Loader2, animate: true },
    pending: { color: 'var(--warning)', bg: 'var(--warning-soft)', Icon: Loader2, animate: true },
    rolling_back: { color: 'var(--warning)', bg: 'var(--warning-soft)', Icon: RefreshCw, animate: true },
    stopped: { color: 'var(--text-tertiary)', bg: 'var(--surface-muted)', Icon: Box, animate: false },
  }[status] || { color: 'var(--text-tertiary)', bg: 'var(--surface-muted)', Icon: Box, animate: false };

  const { Icon } = config;

  return (
    <div 
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
      style={{ background: config.bg, color: config.color }}
    >
      <Icon size={12} className={config.animate ? 'animate-spin' : ''} />
      {status.replace('_', ' ')}
    </div>
  );
}

export function ServiceDetailPage() {
  const { projectId = '', serviceId = '' } = useParams<{ projectId: string; serviceId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isDemoMode = searchParams.get('demo') === '1';

  const [activeSection, setActiveSection] = useState<ServiceSection>('metrics');
  const [logTail, setLogTail] = useState('100');

  const projectQuery = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => getProjectById(projectId),
    enabled: Boolean(projectId) && !isDemoMode,
  });

  const serviceQuery = useQuery({
    queryKey: ['service', serviceId],
    queryFn: () => getServiceById(serviceId),
    enabled: Boolean(serviceId) && !isDemoMode,
  });

  const deploymentsQuery = useQuery({
    queryKey: ['service-deployments', serviceId],
    queryFn: () => listDeployments(serviceId),
    enabled: Boolean(serviceId) && !isDemoMode,
    refetchInterval: 4000,
  });

  const serviceLogsQuery = useQuery({
    queryKey: ['service-logs', serviceId, logTail],
    queryFn: () => listServiceLogs(serviceId, { tail: logTail }),
    enabled: Boolean(serviceId) && !isDemoMode && activeSection === 'logs',
  });

  const latestDeployment = useMemo(() => {
    if (isDemoMode) {
      return null;
    }
    const deployments = deploymentsQuery.data ?? [];
    return deployments[0] ?? null;
  }, [deploymentsQuery.data, isDemoMode]);

  const deploymentLogsQuery = useQuery({
    queryKey: ['deployment-logs', latestDeployment?.id],
    queryFn: () => getDeploymentLogs(latestDeployment!.id, { type: 'all' }),
    enabled:
      Boolean(latestDeployment?.id) &&
      !isDemoMode &&
      activeSection === 'logs',
  });

  const deployMutation = useMutation({
    mutationFn: (trigger: 'manual' | 'restart') => createDeployment(serviceId, { trigger }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['service-deployments', serviceId] });
      queryClient.invalidateQueries({ queryKey: ['service', serviceId] });
      queryClient.invalidateQueries({ queryKey: ['project-services', projectId] });
    },
  });

  const rollbackMutation = useMutation({
    mutationFn: (deploymentId: string) => rollbackDeployment(deploymentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['service-deployments', serviceId] });
      queryClient.invalidateQueries({ queryKey: ['service', serviceId] });
      queryClient.invalidateQueries({ queryKey: ['project-services', projectId] });
    },
  });

  const deleteServiceMutation = useMutation({
    mutationFn: () => deleteService(serviceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-services', projectId] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      navigate(`/projects/${projectId}`);
    },
  });

  const project = isDemoMode ? getDemoProjectById(projectId) : projectQuery.data;
  const service = isDemoMode ? getDemoServiceById(serviceId) : serviceQuery.data;

  const metricSet = useMemo(() => {
    if (!service) {
      return null;
    }

    const cpu = seededMetric(`${service.id}:cpu`, 12, 78);
    const memory = seededMetric(`${service.id}:mem`, 24, 91);
    const req = seededMetric(`${service.id}:req`, 120, 5100);
    const latency = seededMetric(`${service.id}:lat`, 17, 210);

    return {
      cpu,
      memory,
      req,
      latency,
    };
  }, [service]);

  const deploymentSummary = useMemo(() => {
    const deployments = isDemoMode ? [] : deploymentsQuery.data ?? [];
    const total = deployments.length;
    const active = deployments.filter((deployment) =>
      ['pending', 'building', 'deploying', 'rolling_back'].includes(deployment.status),
    ).length;
    const failed = deployments.filter((deployment) => deployment.status === 'failed').length;

    return { total, active, failed };
  }, [deploymentsQuery.data, isDemoMode]);

  const canRollback = (status: string): boolean => status === 'deployed' || status === 'failed';

  if (!isDemoMode && (projectQuery.isLoading || serviceQuery.isLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center gap-3 text-[var(--text-secondary)]">
          <Loader2 size={20} className="animate-spin" />
          <span>Loading service...</span>
        </div>
      </div>
    );
  }

  if (!isDemoMode && serviceQuery.isError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="panel p-8 text-center max-w-md">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-[var(--error-soft)] flex items-center justify-center">
            <X size={24} className="text-[var(--error)]" />
          </div>
          <p className="text-lg font-medium text-[var(--text-primary)]">Failed to load service</p>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">{(serviceQuery.error as Error).message}</p>
          <button
            onClick={() => serviceQuery.refetch()}
            className="mt-6 px-4 py-2 rounded-[var(--radius-md)] border border-[var(--border-subtle)] text-sm font-medium hover:border-[var(--border-default)] transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!service || !project) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="panel p-8 text-center max-w-md">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-[var(--surface-muted)] flex items-center justify-center">
            <Box size={24} className="text-[var(--text-tertiary)]" />
          </div>
          <p className="text-lg font-medium text-[var(--text-primary)]">Service not found</p>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">This service may have been deleted.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative">
      {/* Breadcrumb - self.html exact match */}
      <div 
        className="flex items-center"
        style={{ 
          gap: '6px', 
          padding: '14px 24px 10px',
          color: '#6b6e7d',
          fontSize: '13px'
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b6e7d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
        <button 
          onClick={() => navigate(isDemoMode ? `/projects/${project.id}?demo=1` : `/projects/${project.id}`)}
          style={{ color: '#6b6e7d', textDecoration: 'none' }}
          className="hover:text-[#9295a4] transition-colors"
        >
          Servers
        </button>
        <span style={{ opacity: 0.4 }}>/</span>
        <span style={{ color: '#9295a4' }}>{service.name}</span>
      </div>

      {/* Project Header - self.html exact match */}
      <div className="flex items-center" style={{ padding: '0 24px 18px' }}>
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
            <span style={{ fontSize: '20px', fontWeight: 800, letterSpacing: '-0.5px', color: '#e8e9f0' }}>{service.name}</span>
            <span className={`badge-${service.status === 'running' ? 'active' : 'stopped'}`}>
              {service.status === 'running' && <span className="live-dot" />}
              {service.status === 'running' ? 'Active' : 'Stopped'}
            </span>
          </div>
          <div className="flex items-center" style={{ gap: '16px', marginTop: '4px' }}>
            {service.status === 'running' && (
              <a 
                href={`https://${service.name}.containr.dev`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center hover:text-[#9295a4] transition-colors"
                style={{ color: '#6b6e7d', fontSize: '12.5px', textDecoration: 'none', gap: '4px' }}
              >
                https://{service.name}.containr.dev
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                  <polyline points="15 3 21 3 21 9"/>
                  <line x1="10" y1="14" x2="21" y2="3"/>
                </svg>
              </a>
            )}
            <button 
              onClick={() => navigate(isDemoMode ? `/projects/${project.id}?demo=1` : `/projects/${project.id}`)}
              className="flex items-center hover:text-[#9295a4] transition-colors"
              style={{ color: '#6b6e7d', fontSize: '12.5px', textDecoration: 'none', gap: '4px' }}
            >
              Project Information
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </button>
          </div>
        </div>
        <div className="ml-auto flex" style={{ gap: '10px' }}>
          {!isDemoMode && (
            <>
              <button
                onClick={() => deployMutation.mutate('restart')}
                disabled={deployMutation.isPending || service.status !== 'running'}
                className={`btn-stop ${service.status !== 'running' ? 'disabled' : ''}`}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <circle cx="12" cy="12" r="10"/>
                  <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none"/>
                </svg>
                STOP
              </button>
              <button
                onClick={() => deployMutation.mutate('manual')}
                disabled={deployMutation.isPending}
                className={`btn-restart ${deployMutation.isPending ? 'disabled' : ''}`}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <polyline points="1 4 1 10 7 10"/>
                  <path d="M3.51 15a9 9 0 1 0 .49-4.5"/>
                </svg>
                RESTART
              </button>
            </>
          )}
        </div>
      </div>

      {/* Demo Mode Banner */}
      {isDemoMode && (
        <div className="mx-auto w-full max-w-[1400px] px-6 py-4">
          <div className="px-4 py-3 rounded-[var(--radius-md)] border border-[var(--warning-soft)] bg-[var(--warning-soft)]/50">
            <div className="flex items-center gap-2 text-sm text-[var(--warning)]">
              <Sparkles size={16} />
              <span>Demo mode active — using sample data for preview</span>
            </div>
          </div>
        </div>
      )}

      {/* Metrics Overview */}
      <div className="mx-auto w-full max-w-[1400px] px-6 py-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard 
            label="CPU" 
            value={`${metricSet?.cpu ?? 0}%`} 
            hint="Current utilization" 
            icon={Cpu}
            trend={metricSet && metricSet.cpu > 60 ? 'up' : metricSet && metricSet.cpu < 30 ? 'down' : 'stable'}
          />
          <MetricCard 
            label="Memory" 
            value={`${metricSet?.memory ?? 0}%`} 
            hint="Container footprint" 
            icon={MemoryStick}
            trend={metricSet && metricSet.memory > 70 ? 'up' : 'stable'}
          />
          <MetricCard 
            label="Requests" 
            value={`${metricSet?.req ?? 0}`} 
            hint="Last 60 minutes" 
            icon={Zap}
          />
          <MetricCard 
            label="Latency" 
            value={`${metricSet?.latency ?? 0}ms`} 
            hint="P95 estimate" 
            icon={Timer}
            trend={metricSet && metricSet.latency > 150 ? 'up' : 'stable'}
          />
        </div>

        {/* Deployment Summary */}
        {!isDemoMode && (
          <div className="mt-4 flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2 text-[var(--text-secondary)]">
              <span className="w-2 h-2 rounded-full bg-[var(--accent-primary)]" />
              <span>{deploymentSummary.total} deployments</span>
            </div>
            {deploymentSummary.active > 0 && (
              <div className="flex items-center gap-2 text-[var(--warning)]">
                <span className="w-2 h-2 rounded-full bg-[var(--warning)] animate-pulse" />
                <span>{deploymentSummary.active} active</span>
              </div>
            )}
            {deploymentSummary.failed > 0 && (
              <div className="flex items-center gap-2 text-[var(--error)]">
                <span className="w-2 h-2 rounded-full bg-[var(--error)]" />
                <span>{deploymentSummary.failed} failed</span>
              </div>
            )}
            {latestDeployment?.createdAt && (
              <div className="flex items-center gap-1.5 text-[var(--text-tertiary)]">
                <Clock size={12} />
                <span>Latest {formatRelative(latestDeployment.createdAt)}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tabs - self.html exact match */}
      <div 
        className="flex"
        style={{ 
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          marginBottom: '18px',
          padding: '0 24px'
        }}
      >
        {sectionItems.map((item) => {
          const active = activeSection === item.key;
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              onClick={() => setActiveSection(item.key)}
              className={`tab ${active ? 'active' : ''}`}
            >
              <Icon size={14} />
              {item.label}
            </button>
          );
        })}
      </div>

      {/* Content - self.html exact match: padding 0 24px 28px */}
      <div style={{ padding: '0 24px 28px' }}>
        {activeSection === 'metrics' && (
          <div className="space-y-6">
            {/* Metrics Grid with enhanced cards */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="panel p-5 group hover:border-[var(--accent-primary)]/30 transition-all duration-300">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="card-icon">
                      <Cpu size={18} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[var(--text-primary)]">CPU Timeline</p>
                      <p className="text-xs text-[var(--text-tertiary)]">Last 24 intervals</p>
                    </div>
                  </div>
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-xs text-[var(--text-tertiary)]">Click to expand</span>
                  </div>
                </div>
                <div className="flex h-32 items-end gap-1">
                  {Array.from({ length: 24 }).map((_, i) => {
                    const value = seededMetric(`${service.id}:cpu:${i}`, 8, 80);
                    return (
                      <div
                        key={i}
                        className="flex-1 rounded-[var(--radius-xs)] transition-all hover:opacity-80 cursor-pointer group/bar"
                        style={{
                          height: `${value}%`,
                          background: '#ff7043',
                        }}
                        title={`${value}%`}
                      />
                    );
                  })}
                </div>
              </div>

              <div className="panel p-5 group hover:border-[var(--success)]/30 transition-all duration-300">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="card-icon">
                      <Zap size={18} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[var(--text-primary)]">Request Timeline</p>
                      <p className="text-xs text-[var(--text-tertiary)]">Last 24 intervals</p>
                    </div>
                  </div>
                </div>
                <div className="flex h-32 items-end gap-1">
                  {Array.from({ length: 24 }).map((_, i) => {
                    const value = seededMetric(`${service.id}:req:${i}`, 18, 96);
                    return (
                      <div
                        key={i}
                        className="flex-1 rounded-[var(--radius-xs)] transition-all hover:opacity-80 cursor-pointer"
                        style={{
                          height: `${value}%`,
                          background: '#3dd68c',
                        }}
                        title={`${value}%`}
                      />
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Domain & Networking Panel */}
            {service.status === 'running' && (
              <div className="panel p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-[var(--radius-md)] bg-[var(--accent-primary-soft)] flex items-center justify-center">
                    <Zap size={18} className="text-[var(--accent-primary)]" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[var(--text-primary)]">Networking</p>
                    <p className="text-xs text-[var(--text-tertiary)]">Public endpoints and ports</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-[var(--surface-muted)] border border-[var(--border-subtle)]">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-[var(--success)]" />
                      <span className="text-xs text-[var(--text-secondary)]">HTTPS</span>
                    </div>
                    <a 
                      href={`https://${service.name}.containr.dev`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mono text-xs text-[var(--accent-primary)] hover:underline"
                    >
                      {service.name}.containr.dev
                    </a>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-[var(--surface-muted)] border border-[var(--border-subtle)]">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-[var(--accent-secondary)]" />
                      <span className="text-xs text-[var(--text-secondary)]">Port</span>
                    </div>
                    <span className="mono text-xs text-[var(--text-primary)]">8080 → 443</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeSection === 'logs' && (
          <div className="panel p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-[var(--radius-md)] bg-[var(--accent-primary-soft)] flex items-center justify-center">
                  <FileText size={20} className="text-[var(--accent-primary)]" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-[var(--text-primary)]">Service Logs</h2>
                  <p className="text-sm text-[var(--text-secondary)]">Container stdout/stderr output</p>
                </div>
              </div>
              {!isDemoMode && (
                <div className="flex items-center gap-3">
                  <select
                    value={logTail}
                    onChange={(e) => setLogTail(e.target.value)}
                    className="h-9 px-3 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] text-sm"
                  >
                    <option value="50">50 lines</option>
                    <option value="100">100 lines</option>
                    <option value="250">250 lines</option>
                  </select>
                  <button
                    onClick={() => {
                      serviceLogsQuery.refetch();
                      if (latestDeployment?.id) deploymentLogsQuery.refetch();
                    }}
                    className="flex items-center gap-2 h-9 px-4 rounded-[var(--radius-md)] border border-[var(--border-subtle)] text-sm font-medium hover:border-[var(--border-default)] transition-colors"
                  >
                    <RefreshCw size={14} />
                    Refresh
                  </button>
                </div>
              )}
            </div>

            <div className="mono rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-void)] p-4 text-xs text-[var(--text-secondary)] max-h-[500px] overflow-auto">
              {isDemoMode ? (
                <div className="space-y-1">
                  {Array.from({ length: 15 }).map((_, i) => (
                    <p key={i}>
                      <span className="text-[var(--text-muted)]">
                        [{service.updatedAt ? new Date(new Date(service.updatedAt).getTime() - i * 45000).toLocaleTimeString() : '--:--:--'}]
                      </span>
                      {' '}
                      <span className="text-[var(--accent-primary)]">{service.name}</span>
                      {' '}
                      <span className="text-[var(--text-tertiary)]">{i % 3 === 0 ? 'health_check=ok' : 'request=200'}</span>
                    </p>
                  ))}
                </div>
              ) : serviceLogsQuery.isLoading ? (
                <p className="text-[var(--text-muted)]">Loading logs...</p>
              ) : serviceLogsQuery.isError ? (
                <p className="text-[var(--error)]">Failed to load logs.</p>
              ) : (serviceLogsQuery.data?.length ?? 0) === 0 ? (
                <p className="text-[var(--text-muted)]">No logs available.</p>
              ) : (
                <div className="space-y-1">
                  {serviceLogsQuery.data!.map((entry, i) => (
                    <p key={`${entry.timestamp}-${i}`}>
                      <span className="text-[var(--text-muted)]">
                        [{entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString() : '--:--:--'}]
                      </span>
                      {' '}
                      <span className="text-[var(--accent-primary)]">{entry.stream}</span>
                      {' '}
                      {entry.message}
                    </p>
                  ))}
                </div>
              )}
            </div>

            {!isDemoMode && latestDeployment && (
              <div className="mt-6 panel-soft p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs uppercase tracking-wider text-[var(--text-muted)]">Latest Deployment</p>
                  <StatusBadge status={latestDeployment.status} />
                </div>
                <p className="text-xs text-[var(--text-tertiary)] mono">{latestDeployment.id}</p>
                <pre className="mono mt-3 max-h-40 overflow-auto whitespace-pre-wrap break-all text-xs text-[var(--text-secondary)]">
                  {deploymentLogsQuery.isLoading
                    ? 'Loading...'
                    : deploymentLogsQuery.isError
                    ? 'Failed to load.'
                    : deploymentLogsQuery.data?.buildLog || deploymentLogsQuery.data?.runtimeLog || '(no output)'}
                </pre>
              </div>
            )}
          </div>
        )}

        {activeSection === 'config' && (
          <div className="panel p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-[var(--radius-md)] bg-[var(--accent-primary-soft)] flex items-center justify-center">
                <Sliders size={20} className="text-[var(--accent-primary)]" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">Configuration</h2>
                <p className="text-sm text-[var(--text-secondary)]">Runtime and deployment settings</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="panel-soft p-4">
                <p className="text-xs uppercase tracking-wider text-[var(--text-muted)]">Environment</p>
                <p className="mt-2 text-sm text-[var(--text-primary)]">{service.environment ?? 'production'}</p>
              </div>
              <div className="panel-soft p-4">
                <p className="text-xs uppercase tracking-wider text-[var(--text-muted)]">Image</p>
                <p className="mono mt-2 text-sm text-[var(--text-primary)] break-all">{service.image ?? 'not set'}</p>
              </div>
              <div className="panel-soft p-4">
                <p className="text-xs uppercase tracking-wider text-[var(--text-muted)]">Command</p>
                <p className="mono mt-2 text-sm text-[var(--text-primary)] break-all">{service.command ?? 'default'}</p>
              </div>
              <div className="panel-soft p-4">
                <p className="text-xs uppercase tracking-wider text-[var(--text-muted)]">Git Branch</p>
                <p className="mono mt-2 text-sm text-[var(--text-primary)]">{service.gitBranch ?? 'not configured'}</p>
              </div>
            </div>
          </div>
        )}

        {activeSection === 'settings' && (
          <div className="panel p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-[var(--radius-md)] bg-[var(--accent-primary-soft)] flex items-center justify-center">
                <Settings size={20} className="text-[var(--accent-primary)]" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">Settings</h2>
                <p className="text-sm text-[var(--text-secondary)]">Service metadata and history</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="panel-soft p-4">
                <p className="text-xs uppercase tracking-wider text-[var(--text-muted)]">Service ID</p>
                <p className="mono mt-2 text-sm text-[var(--text-primary)] break-all">{service.id}</p>
              </div>
              <div className="panel-soft p-4">
                <p className="text-xs uppercase tracking-wider text-[var(--text-muted)]">Created</p>
                <p className="mt-2 text-sm text-[var(--text-primary)]">{formatDate(service.createdAt)}</p>
              </div>
              <div className="panel-soft p-4 md:col-span-2">
                <p className="text-xs uppercase tracking-wider text-[var(--text-muted)]">Last Update</p>
                <p className="mt-2 text-sm text-[var(--text-primary)]">{formatRelative(service.updatedAt)}</p>
              </div>
            </div>

            {!isDemoMode && (
              <div className="mt-6 pt-6 border-t border-[var(--border-subtle)]">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-medium text-[var(--text-primary)]">Deployment History</h3>
                  <button
                    onClick={() => deploymentsQuery.refetch()}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-[var(--radius-md)] border border-[var(--border-subtle)] text-xs font-medium hover:border-[var(--border-default)] transition-colors"
                  >
                    <RefreshCw size={12} />
                    Refresh
                  </button>
                </div>

                <div className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] overflow-hidden">
                  <table className="min-w-full text-xs">
                    <thead className="bg-[var(--surface-muted)]">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium uppercase tracking-wider text-[var(--text-muted)]">Status</th>
                        <th className="px-4 py-3 text-left font-medium uppercase tracking-wider text-[var(--text-muted)]">ID</th>
                        <th className="px-4 py-3 text-left font-medium uppercase tracking-wider text-[var(--text-muted)]">Image</th>
                        <th className="px-4 py-3 text-left font-medium uppercase tracking-wider text-[var(--text-muted)]">Created</th>
                        <th className="px-4 py-3 text-left font-medium uppercase tracking-wider text-[var(--text-muted)]">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-subtle)]">
                      {deploymentsQuery.isLoading ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center text-[var(--text-muted)]">
                            Loading...
                          </td>
                        </tr>
                      ) : deploymentsQuery.isError ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center text-[var(--error)]">
                            Failed to load
                          </td>
                        </tr>
                      ) : (deploymentsQuery.data?.length ?? 0) === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center text-[var(--text-muted)]">
                            No deployments yet
                          </td>
                        </tr>
                      ) : (
                        deploymentsQuery.data!.map((deployment) => (
                          <tr key={deployment.id} className="hover:bg-[var(--surface-muted)]/50 transition-colors">
                            <td className="px-4 py-3">
                              <StatusBadge status={deployment.status} />
                            </td>
                            <td className="px-4 py-3 mono text-[var(--text-secondary)]">{deployment.id}</td>
                            <td className="px-4 py-3 mono text-[var(--text-secondary)]">
                              {deployment.imageName || '—'}:{deployment.imageTag || '—'}
                            </td>
                            <td className="px-4 py-3 text-[var(--text-tertiary)]">
                              {deployment.createdAt ? formatRelative(deployment.createdAt) : '—'}
                            </td>
                            <td className="px-4 py-3">
                              <button
                                onClick={() => rollbackMutation.mutate(deployment.id)}
                                disabled={!canRollback(deployment.status) || rollbackMutation.isPending}
                                className="px-3 py-1.5 rounded-[var(--radius-sm)] border border-[var(--border-subtle)] text-xs font-medium hover:border-[var(--border-default)] disabled:opacity-50 transition-colors"
                              >
                                {rollbackMutation.isPending && rollbackMutation.variables === deployment.id ? '...' : 'Rollback'}
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Error Toasts */}
      {!isDemoMode && (deleteServiceMutation.error || deployMutation.error || rollbackMutation.error) && (
        <div className="fixed bottom-4 right-4 space-y-2">
          {deleteServiceMutation.error && (
            <div className="px-4 py-3 rounded-[var(--radius-md)] bg-[var(--error-soft)] border border-[var(--error)]/20 text-sm text-[var(--error)] shadow-lg">
              {(deleteServiceMutation.error as Error).message}
            </div>
          )}
          {deployMutation.error && (
            <div className="px-4 py-3 rounded-[var(--radius-md)] bg-[var(--error-soft)] border border-[var(--error)]/20 text-sm text-[var(--error)] shadow-lg">
              {(deployMutation.error as Error).message}
            </div>
          )}
          {rollbackMutation.error && (
            <div className="px-4 py-3 rounded-[var(--radius-md)] bg-[var(--error-soft)] border border-[var(--error)]/20 text-sm text-[var(--error)] shadow-lg">
              {(rollbackMutation.error as Error).message}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
