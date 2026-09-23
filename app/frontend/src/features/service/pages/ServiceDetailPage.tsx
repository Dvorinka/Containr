import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import {
  createDeployment,
  deleteService,
  getProjectById,
  getDeploymentLogs,
  getServiceById,
  getServiceMetrics,
  listDeployments,
  listServiceLogs,
  listServiceVariables,
  listCronJobs,
  createCronJob,
  updateCronJob,
  deleteCronJob,
  listCronExecutions,
  triggerCronJob,
  listPreviewEnvironments,
  createPreviewEnvironment,
  deletePreviewEnvironment,
  promotePreviewEnvironment,
  getScalingPolicy,
  setScalingPolicy,
  deleteScalingPolicy,
  getServiceScalingState,
  manualScaleService,
  execInService,
  rollbackDeployment,
  updateServiceVariables,
  updateService,
  restartService,
  stopService,
  getServiceRuntime,
  type CronJobEntity,
} from '@/lib/api-client';
import { getDemoProjectById, getDemoServiceById, getDemoCronJobsByService } from '@/lib/demo-data';
import { useDemoMode } from '@/lib/demo-mode';
import { useAuthSession } from '@/lib/use-auth-session';
import { getCurrentUserProfile } from '@/lib/api-client';
import { parseDotenv, validateVariableRows, type VariableDraft } from '../variable-utils';
import { formatBytes, formatDate, formatRelative, seededMetric } from '@/lib/time';
import { EnhancedMetricCard, LineAreaChart, DonutChart } from '@/shared/components';
import {
  Activity,
  FileText,
  Settings,
  Sliders,
  KeyRound,
  Plus,
  Trash2,
  ClipboardPaste,
  Save,
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
  Play,
  ChevronDown,
  GitPullRequest,
  ExternalLink,
  Terminal,
} from 'lucide-react';

type ServiceSection = 'metrics' | 'logs' | 'config' | 'variables' | 'cron' | 'previews' | 'scaling' | 'console' | 'settings';

// Sections marked manageOnly are hidden from anonymous visitors — they
// expose authenticated or owner-scoped data (logs, variables, exec).
const sectionItems: Array<{ key: ServiceSection; label: string; icon: typeof Activity; manageOnly?: boolean }> = [
  { key: 'metrics', label: 'Metrics', icon: Activity },
  { key: 'logs', label: 'Logs', icon: FileText, manageOnly: true },
  { key: 'config', label: 'Config', icon: Sliders },
  { key: 'variables', label: 'Variables', icon: KeyRound, manageOnly: true },
  { key: 'cron', label: 'Cron', icon: Clock },
  { key: 'previews', label: 'Previews', icon: GitPullRequest },
  { key: 'scaling', label: 'Scaling', icon: Layers },
  { key: 'console', label: 'Console', icon: Terminal, manageOnly: true },
  { key: 'settings', label: 'Settings', icon: Settings, manageOnly: true },
];

function metricStatus(percent: number): 'good' | 'average' | 'warning' {
  if (percent < 50) return 'good';
  if (percent < 80) return 'average';
  return 'warning';
}

const statusLabel = { good: 'Good', average: 'Average', warning: 'High' } as const;

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
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isDemoMode = useDemoMode();
  const sessionQuery = useAuthSession({ enabled: !isDemoMode });
  const signedIn = isDemoMode || Boolean(sessionQuery.data);
  const profileQuery = useQuery({
    queryKey: ['user-profile'],
    queryFn: getCurrentUserProfile,
    enabled: signedIn && !isDemoMode,
    retry: false,
  });
  const isAdmin = Boolean(profileQuery.data?.isAdmin);

  const [activeSection, setActiveSection] = useState<ServiceSection>('metrics');
  const [logTail, setLogTail] = useState('100');
  const [varDrafts, setVarDrafts] = useState<VariableDraft[] | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [logDeploymentId, setLogDeploymentId] = useState<string | null>(null);

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

  const variablesQuery = useQuery({
    queryKey: ['service-variables', serviceId],
    queryFn: () => listServiceVariables(serviceId),
    enabled: Boolean(serviceId) && !isDemoMode && activeSection === 'variables',
  });

  const saveVariablesMutation = useMutation({
    mutationFn: (rows: VariableDraft[]) =>
      updateServiceVariables(
        serviceId,
        rows.map((row) => ({ key: row.key.trim(), value: row.value, is_secret: row.isSecret })),
      ),
    onSuccess: (data) => {
      queryClient.setQueryData(['service-variables', serviceId], data);
      setVarDrafts(null);
    },
  });

  // --- Cron jobs ---
  const [cronForm, setCronForm] = useState<{
    name: string; schedule: string; command: string; timezone: string; enabled: boolean; retention: number;
  } | null>(null);
  const [editingCronId, setEditingCronId] = useState<string | null>(null);
  const [historyCronId, setHistoryCronId] = useState<string | null>(null);

  const cronJobsQuery = useQuery({
    queryKey: ['service-cron-jobs', serviceId],
    queryFn: () => listCronJobs(serviceId),
    enabled: Boolean(serviceId) && !isDemoMode && activeSection === 'cron',
  });
  const cronExecutionsQuery = useQuery({
    queryKey: ['cron-executions', historyCronId],
    queryFn: () => listCronExecutions(historyCronId as string),
    enabled: Boolean(historyCronId) && !isDemoMode && activeSection === 'cron',
  });
  const invalidateCron = () => queryClient.invalidateQueries({ queryKey: ['service-cron-jobs', serviceId] });

  const saveCronMutation = useMutation({
    mutationFn: async () => {
      if (!cronForm) return;
      const payload = {
        name: cronForm.name.trim(),
        schedule: cronForm.schedule.trim(),
        command: cronForm.command.trim(),
        timezone: cronForm.timezone.trim() || 'UTC',
        enabled: cronForm.enabled,
        retention: cronForm.retention,
      };
      if (editingCronId) {
        await updateCronJob(editingCronId, payload);
      } else {
        await createCronJob({ project_id: projectId, service_id: serviceId, ...payload });
      }
    },
    onSuccess: () => {
      setCronForm(null);
      setEditingCronId(null);
      invalidateCron();
    },
  });
  const deleteCronMutation = useMutation({
    mutationFn: (id: string) => deleteCronJob(id),
    onSuccess: invalidateCron,
  });
  const toggleCronMutation = useMutation({
    mutationFn: (job: CronJobEntity) => updateCronJob(job.id as string, { enabled: !job.enabled }),
    onSuccess: invalidateCron,
  });

  // --- Preview environments ---
  const [previewForm, setPreviewForm] = useState<{ branch: string; prNumber: string; ttlHours: string } | null>(null);
  const previewsQuery = useQuery({
    queryKey: ['project-preview-envs', projectId],
    queryFn: () => listPreviewEnvironments(projectId),
    enabled: Boolean(projectId) && !isDemoMode && activeSection === 'previews',
    refetchInterval: 15_000,
  });
  const invalidatePreviews = () => queryClient.invalidateQueries({ queryKey: ['project-preview-envs', projectId] });
  const createPreviewMutation = useMutation({
    mutationFn: async () => {
      if (!previewForm) return;
      await createPreviewEnvironment(projectId, {
        project_id: projectId,
        service_id: serviceId,
        branch_name: previewForm.branch.trim(),
        pr_number: previewForm.prNumber ? Number(previewForm.prNumber) : undefined,
        ttl_hours: previewForm.ttlHours ? Number(previewForm.ttlHours) : undefined,
      });
    },
    onSuccess: () => { setPreviewForm(null); invalidatePreviews(); },
  });
  const deletePreviewMutation = useMutation({
    mutationFn: (id: string) => deletePreviewEnvironment(id),
    onSuccess: invalidatePreviews,
  });
  const promotePreviewMutation = useMutation({
    mutationFn: (id: string) => promotePreviewEnvironment(id, { target_environment: 'production' }),
    onSuccess: invalidatePreviews,
  });
  const previews = (previewsQuery.data ?? []).filter((p) => p.service_id === serviceId);

  // --- Scaling ---
  const [scalingForm, setScalingForm] = useState<{
    min: string; max: string; targetCpu: string; targetMemory: string; enabled: boolean;
  } | null>(null);
  const [scaleReplicas, setScaleReplicas] = useState('');
  const scalingPolicyQuery = useQuery({
    queryKey: ['scaling-policy', serviceId],
    queryFn: () => getScalingPolicy(serviceId),
    enabled: Boolean(serviceId) && !isDemoMode && activeSection === 'scaling',
  });
  const scalingStateQuery = useQuery({
    queryKey: ['scaling-state', serviceId],
    queryFn: () => getServiceScalingState(serviceId),
    enabled: Boolean(serviceId) && !isDemoMode && activeSection === 'scaling',
    refetchInterval: 15_000,
  });
  const invalidateScaling = () => {
    queryClient.invalidateQueries({ queryKey: ['scaling-policy', serviceId] });
    queryClient.invalidateQueries({ queryKey: ['scaling-state', serviceId] });
  };
  const saveScalingMutation = useMutation({
    mutationFn: async () => {
      if (!scalingForm) return;
      await setScalingPolicy({
        service_id: serviceId,
        min_replicas: Number(scalingForm.min) || 1,
        max_replicas: Number(scalingForm.max) || 1,
        target_cpu: Number(scalingForm.targetCpu) || 70,
        target_memory: Number(scalingForm.targetMemory) || 80,
        enabled: scalingForm.enabled,
      });
    },
    onSuccess: () => { setScalingForm(null); invalidateScaling(); },
  });
  const deleteScalingMutation = useMutation({
    mutationFn: () => deleteScalingPolicy(serviceId),
    onSuccess: invalidateScaling,
  });
  const manualScaleMutation = useMutation({
    mutationFn: (replicas: number) => manualScaleService(serviceId, replicas),
    onSuccess: () => {
      invalidateScaling();
      queryClient.invalidateQueries({ queryKey: ['service-runtime', serviceId] });
      queryClient.invalidateQueries({ queryKey: ['project-services'] });
    },
  });

  // --- Console ---
  const [consoleInput, setConsoleInput] = useState('');
  const [consoleHistory, setConsoleHistory] = useState<
    Array<{ command: string; output: string; exitCode: number; error: string }>
  >([]);
  const execMutation = useMutation({
    mutationFn: (command: string) => execInService(serviceId, command),
    onSuccess: (result, command) => {
      setConsoleHistory((prev) => [
        { command, output: result.output ?? '', exitCode: result.exit_code ?? 0, error: result.error ?? '' },
        ...prev,
      ]);
      setConsoleInput('');
    },
  });
  const triggerCronMutation = useMutation({
    mutationFn: (id: string) => triggerCronJob(id),
    onSuccess: () => {
      window.setTimeout(() => {
        invalidateCron();
        if (historyCronId) queryClient.invalidateQueries({ queryKey: ['cron-executions', historyCronId] });
      }, 2500);
    },
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

  const logsDeployment =
    (deploymentsQuery.data ?? []).find((d) => d.id === logDeploymentId) ?? latestDeployment;

  const deploymentLogsQuery = useQuery({
    queryKey: ['deployment-logs', logsDeployment?.id],
    queryFn: () => getDeploymentLogs(logsDeployment!.id, { type: 'all' }),
    enabled:
      Boolean(logsDeployment?.id) &&
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

  const invalidateService = () => {
    queryClient.invalidateQueries({ queryKey: ['service', serviceId] });
    queryClient.invalidateQueries({ queryKey: ['service-runtime', serviceId] });
    queryClient.invalidateQueries({ queryKey: ['project-services', projectId] });
  };

  const restartMutation = useMutation({
    mutationFn: () => restartService(serviceId),
    onSuccess: invalidateService,
  });
  const stopMutation = useMutation({
    mutationFn: () => stopService(serviceId),
    onSuccess: invalidateService,
  });
  const updateServiceMutation = useMutation({
    mutationFn: (input: Parameters<typeof updateService>[1]) => updateService(serviceId, input),
    onSuccess: () => {
      setNetworkForm(null);
      invalidateService();
    },
  });

  const runtimeQuery = useQuery({
    queryKey: ['service-runtime', serviceId],
    queryFn: () => getServiceRuntime(serviceId),
    enabled: Boolean(serviceId) && !isDemoMode,
    refetchInterval: 10_000,
  });

  const [networkForm, setNetworkForm] = useState<{
    port: string; domain: string; healthcheckPath: string; restartPolicy: string; replicas: string;
  } | null>(null);

  const project = isDemoMode ? getDemoProjectById(projectId) : projectQuery.data;
  const service = isDemoMode ? getDemoServiceById(serviceId) : serviceQuery.data;

  const varRows: VariableDraft[] = useMemo(
    () =>
      varDrafts ??
      (variablesQuery.data ?? []).map((v) => ({ key: v.key, value: v.value, isSecret: v.isSecret })),
    [varDrafts, variablesQuery.data],
  );
  const varErrors = useMemo(() => validateVariableRows(varRows), [varRows]);
  const varDirty = varDrafts !== null;
  const updateVarRow = (index: number, patch: Partial<VariableDraft>) =>
    setVarDrafts(varRows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  const removeVarRow = (index: number) => setVarDrafts(varRows.filter((_, i) => i !== index));
  const applyBulkPaste = () => {
    const parsed = parseDotenv(bulkText);
    if (parsed.length === 0) return;
    const merged = [...varRows];
    for (const row of parsed) {
      const existing = merged.findIndex((r) => r.key === row.key);
      if (existing >= 0) {
        merged[existing] = { ...merged[existing], value: row.value };
      } else {
        merged.push(row);
      }
    }
    setVarDrafts(merged);
    setBulkText('');
    setBulkOpen(false);
  };

  const metricsQuery = useQuery({
    queryKey: ['service-metrics', serviceId],
    queryFn: () => getServiceMetrics(serviceId),
    enabled: !isDemoMode && Boolean(serviceId),
    refetchInterval: 5000,
  });

  // Accumulate live samples into a small history for the timeline charts.
  const [metricHistory, setMetricHistory] = useState<{ cpu: number[]; memory: number[]; net: number[] }>({ cpu: [], memory: [], net: [] });
  const lastNetSampleRef = useRef<{ rx: number; at: number } | null>(null);
  useEffect(() => {
    const sample = metricsQuery.data;
    if (!sample || sample.status !== 'ok') {
      return;
    }
    const memPercent = sample.memory_limit_bytes > 0
      ? (sample.memory_usage_bytes / sample.memory_limit_bytes) * 100
      : 0;
    const now = Date.now();
    const previous = lastNetSampleRef.current;
    const elapsedSec = previous ? Math.max(1, (now - previous.at) / 1000) : 0;
    const rxRate = previous && elapsedSec > 0
      ? Math.max(0, (sample.network_rx_bytes - previous.rx) / elapsedSec)
      : 0;
    lastNetSampleRef.current = { rx: sample.network_rx_bytes, at: now };
    // eslint-disable-next-line react-hooks/set-state-in-effect -- accumulating polled samples is a legitimate sync-to-external pattern
    setMetricHistory((prev) => ({
      cpu: [...prev.cpu, Math.min(100, sample.cpu_percent)].slice(-24),
      memory: [...prev.memory, Math.min(100, memPercent)].slice(-24),
      net: [...prev.net, rxRate].slice(-24),
    }));
  }, [metricsQuery.data]);

  const liveMetrics = isDemoMode ? null : metricsQuery.data ?? null;
  const hasLiveTelemetry = Boolean(liveMetrics && liveMetrics.status === 'ok' && liveMetrics.instances.length > 0);
  const runningInstances = liveMetrics?.instances.filter((instance) => instance.state === 'running').length ?? 0;
  const memoryPercent = liveMetrics && liveMetrics.memory_limit_bytes > 0
    ? (liveMetrics.memory_usage_bytes / liveMetrics.memory_limit_bytes) * 100
    : 0;

  // Demo mode renders seeded values so the layout can be previewed without a backend.
  const metricSet = useMemo(() => {
    if (!service || !isDemoMode) {
      return null;
    }

    return {
      cpu: seededMetric(`${service.id}:cpu`, 12, 78),
      memory: seededMetric(`${service.id}:mem`, 24, 91),
      req: seededMetric(`${service.id}:req`, 120, 5100),
      latency: seededMetric(`${service.id}:lat`, 17, 210),
    };
  }, [service, isDemoMode]);

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
          color: 'var(--text-tertiary)',
          fontSize: '13px'
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
        <button 
          onClick={() => navigate(isDemoMode ? `/projects/${project.id}?demo=1` : `/projects/${project.id}`)}
          style={{ color: 'var(--text-tertiary)', textDecoration: 'none' }}
          className="hover:text-[var(--text-secondary)] transition-colors"
        >
          Servers
        </button>
        <span style={{ opacity: 0.4 }}>/</span>
        <span style={{ color: 'var(--text-secondary)' }}>{service.name}</span>
      </div>

      {/* Project Header - self.html exact match */}
      <div className="flex items-center" style={{ padding: '0 24px 18px' }}>
        <div 
          className="rounded-[13px] flex items-center justify-center flex-shrink-0"
          style={{ 
            width: '46px', 
            height: '46px', 
            background: 'var(--accent-primary)',
            marginRight: '14px'
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/>
          </svg>
        </div>
        <div>
          <div className="flex items-center" style={{ gap: '10px' }}>
            <span style={{ fontSize: '20px', fontWeight: 800, letterSpacing: '-0.5px', color: 'var(--text-primary)' }}>{service.name}</span>
            <span
              className={`badge-${service.status === 'running' ? 'active' : service.status === 'degraded' ? 'degraded' : 'stopped'}`}
            >
              {service.status === 'running' && <span className="live-dot" />}
              {service.status === 'running' ? 'Active' : service.status === 'degraded' ? 'Degraded' : 'Stopped'}
            </span>
          </div>
          <div className="flex items-center" style={{ gap: '16px', marginTop: '4px' }}>
            {(service.publicUrl || service.domain) && (
              <a
                href={service.publicUrl ?? `https://${service.domain}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center hover:text-[var(--text-secondary)] transition-colors"
                style={{ color: 'var(--text-tertiary)', fontSize: '12.5px', textDecoration: 'none', gap: '4px' }}
              >
                {service.publicUrl ?? `https://${service.domain}`}
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                  <polyline points="15 3 21 3 21 9"/>
                  <line x1="10" y1="14" x2="21" y2="3"/>
                </svg>
              </a>
            )}
            <button 
              onClick={() => navigate(isDemoMode ? `/projects/${project.id}?demo=1` : `/projects/${project.id}`)}
              className="flex items-center hover:text-[var(--text-secondary)] transition-colors"
              style={{ color: 'var(--text-tertiary)', fontSize: '12.5px', textDecoration: 'none', gap: '4px' }}
            >
              Project Information
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </button>
          </div>
        </div>
        <div className="ml-auto flex" style={{ gap: '10px' }}>
          {!isDemoMode && signedIn && (
            <>
              <button
                onClick={() => stopMutation.mutate()}
                disabled={stopMutation.isPending || (service.status !== 'running' && service.status !== 'degraded')}
                className={`btn-stop ${service.status !== 'running' && service.status !== 'degraded' ? 'disabled' : ''}`}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <circle cx="12" cy="12" r="10"/>
                  <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none"/>
                </svg>
                {stopMutation.isPending ? 'STOPPING…' : 'STOP'}
              </button>
              <button
                onClick={() => restartMutation.mutate()}
                disabled={restartMutation.isPending || (service.status !== 'running' && service.status !== 'degraded')}
                className={`btn-restart ${service.status !== 'running' && service.status !== 'degraded' ? 'disabled' : ''}`}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <polyline points="1 4 1 10 7 10"/>
                  <path d="M3.51 15a9 9 0 1 0 .49-4.5"/>
                </svg>
                {restartMutation.isPending ? 'RESTARTING…' : 'RESTART'}
              </button>
              <button
                onClick={() => deployMutation.mutate('manual')}
                disabled={deployMutation.isPending}
                className={`btn-restart ${deployMutation.isPending ? 'disabled' : ''}`}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/>
                  <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/>
                </svg>
                {deployMutation.isPending ? 'DEPLOYING…' : 'DEPLOY'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Demo Mode Banner */}
      {isDemoMode && (
        <div className="w-full px-8 py-4">
          <div className="px-4 py-3 rounded-[var(--radius-md)] border border-[var(--warning-soft)] bg-[var(--warning-soft)]/50">
            <div className="flex items-center gap-2 text-sm text-[var(--warning)]">
              <Sparkles size={16} />
              <span>Demo mode active — using sample data for preview</span>
            </div>
          </div>
        </div>
      )}

      {/* Metrics Overview */}
      <div className="w-full px-8 py-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <EnhancedMetricCard
            title="CPU Usage"
            icon={<Cpu size={18} />}
            value={isDemoMode ? `${metricSet?.cpu ?? 0}%` : hasLiveTelemetry ? `${liveMetrics!.cpu_percent.toFixed(1)}%` : '—'}
            status={metricStatus(isDemoMode ? metricSet?.cpu ?? 0 : liveMetrics?.cpu_percent ?? 0)}
            statusText={isDemoMode || hasLiveTelemetry ? statusLabel[metricStatus(isDemoMode ? metricSet?.cpu ?? 0 : liveMetrics?.cpu_percent ?? 0)] : ''}
            subtitle={isDemoMode ? 'Current utilization' : hasLiveTelemetry ? `${runningInstances} running container${runningInstances === 1 ? '' : 's'}` : 'No running containers'}
            chart={
              <LineAreaChart
                data={isDemoMode
                  ? Array.from({ length: 24 }, (_, i) => seededMetric(`${service.id}:cpu:${i}`, 8, 80))
                  : metricHistory.cpu.length > 0 ? metricHistory.cpu : [0]}
                color="var(--accent-primary)"
                height={72}
              />
            }
          />
          <EnhancedMetricCard
            title="Memory"
            icon={<MemoryStick size={18} />}
            value={isDemoMode ? `${metricSet?.memory ?? 0}%` : hasLiveTelemetry ? `${memoryPercent.toFixed(0)}%` : '—'}
            status={metricStatus(isDemoMode ? metricSet?.memory ?? 0 : memoryPercent)}
            statusText={isDemoMode || hasLiveTelemetry ? statusLabel[metricStatus(isDemoMode ? metricSet?.memory ?? 0 : memoryPercent)] : ''}
            subtitle={isDemoMode ? 'Container footprint' : hasLiveTelemetry ? `${formatBytes(liveMetrics!.memory_usage_bytes)} used` : 'No running containers'}
            chart={
              <div className="relative mx-auto" style={{ width: 150 }}>
                <DonutChart percentage={isDemoMode ? metricSet?.memory ?? 0 : memoryPercent} color="var(--warning)" size={150} thickness={14} />
                <div className="absolute inset-x-0 bottom-0 text-center">
                  <div className="text-[10px] uppercase tracking-wide text-[var(--text-tertiary)]">Used</div>
                  <div className="text-sm font-bold text-[var(--text-primary)]">
                    {isDemoMode
                      ? `${((8 * (metricSet?.memory ?? 0)) / 100).toFixed(1)} GB / 8 GB`
                      : hasLiveTelemetry
                        ? `${formatBytes(liveMetrics!.memory_usage_bytes)} / ${formatBytes(liveMetrics!.memory_limit_bytes)}`
                        : '—'}
                  </div>
                </div>
              </div>
            }
          />
          <EnhancedMetricCard
            title="Network"
            icon={<Zap size={18} />}
            value={isDemoMode ? `${metricSet?.req ?? 0}` : hasLiveTelemetry ? formatBytes(liveMetrics!.network_rx_bytes) : '—'}
            status="good"
            statusText={isDemoMode || hasLiveTelemetry ? 'RX' : ''}
            subtitle={isDemoMode ? 'Requests, last 60 minutes' : hasLiveTelemetry ? `TX ${formatBytes(liveMetrics!.network_tx_bytes)}` : 'No traffic recorded'}
            chart={
              <LineAreaChart
                data={isDemoMode
                  ? Array.from({ length: 24 }, (_, i) => seededMetric(`${service.id}:net:${i}`, 15, 70))
                  : metricHistory.net.length > 0 ? metricHistory.net : [0]}
                color="var(--info)"
                height={72}
              />
            }
          />
          <EnhancedMetricCard
            title="Instances"
            icon={<Timer size={18} />}
            value={isDemoMode ? `${metricSet?.latency ?? 0}ms` : hasLiveTelemetry ? `${runningInstances}` : '0'}
            statusText={hasLiveTelemetry || isDemoMode ? 'Running' : ''}
            status="good"
            subtitle={isDemoMode ? 'P95 latency estimate' : hasLiveTelemetry ? `${liveMetrics!.instances.length} container${liveMetrics!.instances.length === 1 ? '' : 's'} discovered` : 'Deploy to create containers'}
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
          borderBottom: '1px solid var(--border-subtle)',
          marginBottom: '18px',
          padding: '0 24px'
        }}
      >
        {sectionItems.filter((item) => signedIn || !item.manageOnly).map((item) => {
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
            {!isDemoMode && !hasLiveTelemetry && (
              <div className="panel p-8 text-center">
                <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-[var(--surface-muted)] flex items-center justify-center">
                  <Activity size={22} className="text-[var(--text-tertiary)]" />
                </div>
                <p className="text-base font-medium text-[var(--text-primary)]">No telemetry yet</p>
                <p className="mt-2 text-sm text-[var(--text-secondary)]">
                  {liveMetrics?.status === 'docker_unavailable'
                    ? 'Docker is not reachable on this host, so container metrics cannot be collected.'
                    : 'Metrics appear once this service has running containers. Deploy it to start collecting.'}
                </p>
              </div>
            )}
            {(isDemoMode || hasLiveTelemetry) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="panel p-5 group hover:border-[var(--accent-primary)]/30 transition-all duration-300">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="card-icon">
                      <Cpu size={18} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[var(--text-primary)]">CPU Timeline</p>
                      <p className="text-xs text-[var(--text-tertiary)]">
                        {isDemoMode ? 'Last 24 intervals' : 'Live samples · every 5s'}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex h-32 items-end gap-1">
                  {isDemoMode
                    ? Array.from({ length: 24 }).map((_, i) => {
                        const value = seededMetric(`${service.id}:cpu:${i}`, 8, 80);
                        return (
                          <div
                            key={i}
                            className="flex-1 rounded-[var(--radius-sm)] transition-all hover:opacity-80 cursor-pointer"
                            style={{ height: `${value}%`, background: 'var(--accent-primary)' }}
                            title={`${value}%`}
                          />
                        );
                      })
                    : metricHistory.cpu.map((value, i) => (
                        <div
                          key={i}
                          className="flex-1 rounded-[var(--radius-sm)] transition-all hover:opacity-80"
                          style={{ height: `${Math.max(3, value)}%`, background: 'var(--accent-primary)' }}
                          title={`${value.toFixed(1)}%`}
                        />
                      ))}
                  {!isDemoMode && metricHistory.cpu.length === 0 && (
                    <p className="self-center text-xs text-[var(--text-muted)]">Collecting first sample...</p>
                  )}
                </div>
              </div>

              <div className="panel p-5 group hover:border-[var(--success)]/30 transition-all duration-300">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="card-icon">
                      <MemoryStick size={18} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[var(--text-primary)]">Memory Timeline</p>
                      <p className="text-xs text-[var(--text-tertiary)]">
                        {isDemoMode ? 'Last 24 intervals' : 'Live samples · every 5s'}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex h-32 items-end gap-1">
                  {isDemoMode
                    ? Array.from({ length: 24 }).map((_, i) => {
                        const value = seededMetric(`${service.id}:req:${i}`, 18, 96);
                        return (
                          <div
                            key={i}
                            className="flex-1 rounded-[var(--radius-sm)] transition-all hover:opacity-80 cursor-pointer"
                            style={{ height: `${value}%`, background: 'var(--success)' }}
                            title={`${value}%`}
                          />
                        );
                      })
                    : metricHistory.memory.map((value, i) => (
                        <div
                          key={i}
                          className="flex-1 rounded-[var(--radius-sm)] transition-all hover:opacity-80"
                          style={{ height: `${Math.max(3, value)}%`, background: 'var(--success)' }}
                          title={`${value.toFixed(1)}%`}
                        />
                      ))}
                  {!isDemoMode && metricHistory.memory.length === 0 && (
                    <p className="self-center text-xs text-[var(--text-muted)]">Collecting first sample...</p>
                  )}
                </div>
              </div>
            </div>
            )}

            {/* Instance list — real container states */}
            {!isDemoMode && hasLiveTelemetry && (
              <div className="panel p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="card-icon">
                    <Layers size={18} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[var(--text-primary)]">Instances</p>
                    <p className="text-xs text-[var(--text-tertiary)]">Containers backing this service</p>
                  </div>
                </div>
                <div className="space-y-2">
                  {liveMetrics!.instances.map((instance) => (
                    <div
                      key={instance.container_id}
                      className="flex items-center justify-between p-3 rounded-lg bg-[var(--surface-muted)] border border-[var(--border-subtle)]"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${instance.state === 'running' ? 'bg-[var(--success)]' : 'bg-[var(--text-muted)]'}`} />
                        <span className="mono text-xs text-[var(--text-primary)] truncate">{instance.name}</span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-[var(--text-tertiary)] flex-shrink-0">
                        <span className="mono">{instance.cpu_percent.toFixed(1)}% CPU</span>
                        <span className="mono">{formatBytes(instance.memory_usage_bytes)}</span>
                        <span>{instance.started_at ? `up ${formatRelative(instance.started_at).replace(' ago', '')}` : instance.state}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

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
                      if (logsDeployment?.id) deploymentLogsQuery.refetch();
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

            {!isDemoMode && logsDeployment && (
              <div className="mt-6 panel-soft p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs uppercase tracking-wider text-[var(--text-muted)]">
                    {logsDeployment.id === latestDeployment?.id ? 'Latest Deployment' : 'Deployment'}
                  </p>
                  <div className="flex items-center gap-3">
                    {logsDeployment.id !== latestDeployment?.id && (
                      <button
                        onClick={() => setLogDeploymentId(null)}
                        className="text-xs text-[var(--accent-primary)] hover:underline"
                      >
                        Show latest
                      </button>
                    )}
                    <StatusBadge status={logsDeployment.status} />
                  </div>
                </div>
                <p className="text-xs text-[var(--text-tertiary)] mono">{logsDeployment.id}</p>
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

        {activeSection === 'variables' && (
          <div className="panel p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-[var(--radius-md)] bg-[var(--accent-primary-soft)] flex items-center justify-center">
                  <KeyRound size={20} className="text-[var(--accent-primary)]" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-[var(--text-primary)]">Environment Variables</h2>
                  <p className="text-sm text-[var(--text-secondary)]">
                    Runtime values injected at deploy. Reference another service's variable with{' '}
                    <code className="mono text-[var(--accent-primary)]">{'${{service.KEY}}'}</code> — e.g.{' '}
                    <code className="mono text-[var(--accent-primary)]">{'${{postgres.POSTGRES_PASSWORD}}'}</code>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setBulkOpen((open) => !open)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-[var(--radius-md)] border border-[var(--border-subtle)] text-xs font-medium text-[var(--text-secondary)] hover:border-[var(--border-default)] transition-colors"
                >
                  <ClipboardPaste size={12} />
                  Paste .env
                </button>
                <button
                  onClick={() => setVarDrafts([...varRows, { key: '', value: '', isSecret: false }])}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-[var(--radius-md)] border border-[var(--border-subtle)] text-xs font-medium text-[var(--text-secondary)] hover:border-[var(--border-default)] transition-colors"
                >
                  <Plus size={12} />
                  Add variable
                </button>
                <button
                  onClick={() => saveVariablesMutation.mutate(varRows)}
                  disabled={!varDirty || Object.keys(varErrors).length > 0 || saveVariablesMutation.isPending}
                  className="flex items-center gap-2 px-4 py-1.5 rounded-[var(--radius-md)] text-xs font-medium text-[var(--accent-on)] shadow transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: 'var(--accent-primary)' }}
                >
                  {saveVariablesMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                  Save
                </button>
              </div>
            </div>

            {bulkOpen && (
              <div className="mb-4 panel-soft p-4">
                <label className="block text-xs font-medium uppercase tracking-wider text-[var(--text-muted)] mb-2">
                  Paste .env contents
                </label>
                <textarea
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                  rows={6}
                  placeholder={'DATABASE_URL=postgres://...\nAPI_KEY=secret\n# comments are ignored'}
                  className="w-full px-3 py-2 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] mono text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)] transition-all"
                />
                <div className="mt-3 flex justify-end gap-2">
                  <button
                    onClick={() => { setBulkOpen(false); setBulkText(''); }}
                    className="px-3 py-1.5 rounded-[var(--radius-md)] border border-[var(--border-subtle)] text-xs font-medium text-[var(--text-secondary)] hover:border-[var(--border-default)] transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={applyBulkPaste}
                    className="px-3 py-1.5 rounded-[var(--radius-md)] text-xs font-medium text-[var(--accent-on)] transition-all"
                    style={{ background: 'var(--accent-primary)' }}
                  >
                    Import {parseDotenv(bulkText).length > 0 ? `${parseDotenv(bulkText).length} variables` : ''}
                  </button>
                </div>
              </div>
            )}

            {variablesQuery.isLoading ? (
              <div className="flex items-center justify-center py-12 text-[var(--text-muted)]">
                <Loader2 size={20} className="animate-spin" />
              </div>
            ) : varRows.length === 0 ? (
              <div className="panel-soft p-8 text-center">
                <p className="text-sm text-[var(--text-secondary)]">No variables configured.</p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">Add rows or paste a .env file to get started.</p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="grid grid-cols-[1fr_1fr_auto_auto] gap-2 px-1">
                  <span className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">Key</span>
                  <span className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">Value</span>
                  <span className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">Secret</span>
                  <span />
                </div>
                {varRows.map((row, i) => (
                  <div key={i}>
                    <div className="grid grid-cols-[1fr_1fr_auto_auto] gap-2 items-center">
                      <input
                        value={row.key}
                        onChange={(e) => updateVarRow(i, { key: e.target.value })}
                        placeholder="KEY"
                        className={`h-10 px-3 rounded-[var(--radius-md)] border bg-[var(--surface-muted)] mono text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:ring-1 transition-all ${
                          varErrors[i]
                            ? 'border-[var(--error)] focus:border-[var(--error)] focus:ring-[var(--error)]'
                            : 'border-[var(--border-subtle)] focus:border-[var(--accent-primary)] focus:ring-[var(--accent-primary)]'
                        }`}
                      />
                      <input
                        value={row.value}
                        onChange={(e) => updateVarRow(i, { value: e.target.value })}
                        type={row.isSecret ? 'password' : 'text'}
                        placeholder="value"
                        autoComplete="off"
                        className="h-10 px-3 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] mono text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)] transition-all"
                      />
                      <button
                        type="button"
                        title={row.isSecret ? 'Secret — value masked on save' : 'Mark as secret'}
                        onClick={() => updateVarRow(i, { isSecret: !row.isSecret })}
                        className={`w-10 h-10 rounded-[var(--radius-md)] border flex items-center justify-center transition-colors ${
                          row.isSecret
                            ? 'border-[var(--accent-primary)] bg-[var(--accent-primary-soft)] text-[var(--accent-primary)]'
                            : 'border-[var(--border-subtle)] text-[var(--text-muted)] hover:border-[var(--border-default)]'
                        }`}
                      >
                        <KeyRound size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeVarRow(i)}
                        className="w-10 h-10 rounded-[var(--radius-md)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-muted)] hover:border-[var(--error)] hover:text-[var(--error)] transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    {varErrors[i] && (
                      <p className="mt-1 px-1 text-xs text-[var(--error)]">{varErrors[i]}</p>
                    )}
                  </div>
                ))}
              </div>
            )}

            <p className="mt-4 text-xs text-[var(--text-muted)]">
              Secret values are stored encrypted and masked as ******** in responses. Leaving a masked
              value unchanged keeps the stored secret; editing replaces it. Saving replaces the full set.
            </p>
            {saveVariablesMutation.isError && (
              <p className="mt-2 text-xs text-[var(--error)]">
                {saveVariablesMutation.error instanceof Error
                  ? saveVariablesMutation.error.message
                  : 'Failed to save variables'}
              </p>
            )}
          </div>
        )}

        {activeSection === 'cron' && (
          <div className="panel p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-[var(--radius-md)] bg-[var(--accent-primary-soft)] flex items-center justify-center">
                  <Clock size={20} className="text-[var(--accent-primary)]" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-[var(--text-primary)]">Cron Jobs</h2>
                  <p className="text-sm text-[var(--text-secondary)]">Scheduled commands executed inside the service container</p>
                </div>
              </div>
              {signedIn ? (
              <button
                onClick={() => { setEditingCronId(null); setCronForm({ name: '', schedule: '', command: '', timezone: 'UTC', enabled: true, retention: 30 }); }}
                className="flex items-center gap-2 px-3 py-1.5 rounded-[var(--radius-md)] border border-[var(--border-subtle)] text-xs font-medium text-[var(--text-secondary)] hover:border-[var(--border-default)] transition-colors"
              >
                <Plus size={12} />
                New job
              </button>
              ) : null}
            </div>

            {cronForm && (
              <div className="mb-4 panel-soft p-4 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    value={cronForm.name}
                    onChange={(e) => setCronForm({ ...cronForm, name: e.target.value })}
                    placeholder="Name (e.g. Nightly backup)"
                    className="px-3 py-2 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)] transition-all"
                  />
                  <input
                    value={cronForm.schedule}
                    onChange={(e) => setCronForm({ ...cronForm, schedule: e.target.value })}
                    placeholder="Schedule (e.g. 0 3 * * * or @daily)"
                    className="px-3 py-2 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] mono text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)] transition-all"
                  />
                </div>
                <input
                  value={cronForm.command}
                  onChange={(e) => setCronForm({ ...cronForm, command: e.target.value })}
                  placeholder="Command (runs via sh -c inside the container)"
                  className="w-full px-3 py-2 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] mono text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)] transition-all"
                />
                <div className="flex flex-wrap items-center gap-3">
                  <input
                    value={cronForm.timezone}
                    onChange={(e) => setCronForm({ ...cronForm, timezone: e.target.value })}
                    placeholder="Timezone"
                    className="w-32 px-3 py-2 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-primary)] transition-all"
                  />
                  <label className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
                    <input type="number" min={1} value={cronForm.retention}
                      onChange={(e) => setCronForm({ ...cronForm, retention: Number(e.target.value) || 30 })}
                      className="w-16 px-2 py-1.5 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] text-xs text-[var(--text-primary)]" />
                    runs kept
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
                    <input type="checkbox" checked={cronForm.enabled}
                      onChange={(e) => setCronForm({ ...cronForm, enabled: e.target.checked })} />
                    Enabled
                  </label>
                  <div className="ml-auto flex gap-2">
                    <button
                      onClick={() => { setCronForm(null); setEditingCronId(null); }}
                      className="px-3 py-1.5 rounded-[var(--radius-md)] border border-[var(--border-subtle)] text-xs font-medium text-[var(--text-secondary)] hover:border-[var(--border-default)] transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => saveCronMutation.mutate()}
                      disabled={!cronForm.name.trim() || !cronForm.schedule.trim() || !cronForm.command.trim() || saveCronMutation.isPending}
                      className="flex items-center gap-2 px-4 py-1.5 rounded-[var(--radius-md)] text-xs font-medium text-[var(--accent-on)] transition-all disabled:opacity-50"
                      style={{ background: 'var(--accent-primary)' }}
                    >
                      {saveCronMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                      {editingCronId ? 'Save job' : 'Create job'}
                    </button>
                  </div>
                </div>
                {saveCronMutation.isError && (
                  <p className="text-xs text-[var(--error)]">
                    {saveCronMutation.error instanceof Error ? saveCronMutation.error.message : 'Failed to save job'}
                  </p>
                )}
              </div>
            )}

            {cronJobsQuery.isLoading ? (
              <div className="flex items-center justify-center py-12 text-[var(--text-muted)]">
                <Loader2 size={20} className="animate-spin" />
              </div>
            ) : (isDemoMode ? getDemoCronJobsByService(serviceId) : cronJobsQuery.data ?? []).length === 0 ? (
              <div className="panel-soft p-8 text-center">
                <p className="text-sm text-[var(--text-secondary)]">No cron jobs configured.</p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">Create a job to run commands on a schedule inside this service's container.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {(isDemoMode ? getDemoCronJobsByService(serviceId) : cronJobsQuery.data ?? []).map((job) => (
                  <div key={job.id} className="panel-soft p-3">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => signedIn && toggleCronMutation.mutate(job)}
                        title={job.enabled ? 'Disable' : 'Enable'}
                        disabled={!signedIn}
                        className={`w-8 h-5 rounded-full relative transition-colors shrink-0 ${job.enabled ? 'bg-[var(--accent-primary)]' : 'bg-[var(--border-default)]'} disabled:opacity-60 disabled:cursor-not-allowed`}
                      >
                        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${job.enabled ? 'left-3.5' : 'left-0.5'}`} />
                      </button>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-[var(--text-primary)] truncate">{job.name}</span>
                          <span className="mono text-xs text-[var(--text-muted)]">{job.schedule}</span>
                        </div>
                        <p className="mono text-xs text-[var(--text-tertiary)] truncate">{job.command}</p>
                        <p className="text-xs text-[var(--text-muted)]">
                          {job.next_run_at ? `next ${formatRelative(job.next_run_at)}` : 'not scheduled'}
                          {job.last_status ? ` · last ${job.last_status}` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {signedIn ? (
                          <button onClick={() => triggerCronMutation.mutate(job.id as string)} title="Run now"
                            disabled={triggerCronMutation.isPending}
                            className="p-1.5 rounded-[var(--radius-md)] text-[var(--text-secondary)] hover:text-[var(--accent-primary)] hover:bg-[var(--accent-primary-soft)] transition-colors disabled:opacity-50">
                            <Play size={13} />
                          </button>
                        ) : null}
                        <button onClick={() => setHistoryCronId(historyCronId === job.id ? null : (job.id as string))} title="History"
                          className="p-1.5 rounded-[var(--radius-md)] text-[var(--text-secondary)] hover:text-[var(--accent-primary)] hover:bg-[var(--accent-primary-soft)] transition-colors">
                          <ChevronDown size={13} className={historyCronId === job.id ? 'rotate-180 transition-transform' : 'transition-transform'} />
                        </button>
                        {signedIn ? (
                          <>
                        <button
                          onClick={() => { setEditingCronId(job.id as string); setCronForm({ name: job.name ?? '', schedule: job.schedule ?? '', command: job.command ?? '', timezone: job.timezone ?? 'UTC', enabled: job.enabled ?? true, retention: job.retention ?? 30 }); }}
                          title="Edit"
                          className="p-1.5 rounded-[var(--radius-md)] text-[var(--text-secondary)] hover:text-[var(--accent-primary)] hover:bg-[var(--accent-primary-soft)] transition-colors">
                          <Sliders size={13} />
                        </button>
                        <button
                          onClick={() => { if (window.confirm(`Delete cron job "${job.name}"?`)) deleteCronMutation.mutate(job.id as string); }}
                          title="Delete"
                          className="p-1.5 rounded-[var(--radius-md)] text-[var(--text-secondary)] hover:text-[var(--error)] hover:bg-[var(--error-soft)] transition-colors">
                          <Trash2 size={13} />
                        </button>
                          </>
                        ) : null}
                      </div>
                    </div>
                    {historyCronId === job.id && (
                      <div className="mt-3 border-t border-[var(--border-subtle)] pt-3">
                        {cronExecutionsQuery.isLoading ? (
                          <p className="text-xs text-[var(--text-muted)]">Loading history…</p>
                        ) : (cronExecutionsQuery.data ?? []).length === 0 ? (
                          <p className="text-xs text-[var(--text-muted)]">No executions yet.</p>
                        ) : (
                          <div className="space-y-2">
                            {(cronExecutionsQuery.data ?? []).slice(0, 10).map((ex) => (
                              <div key={ex.id} className="text-xs">
                                <div className="flex items-center gap-2">
                                  <span className={`inline-block w-1.5 h-1.5 rounded-full ${ex.status === 'success' ? 'bg-[var(--success)]' : ex.status === 'running' ? 'bg-[var(--warning)]' : 'bg-[var(--error)]'}`} />
                                  <span className="text-[var(--text-secondary)]">{formatRelative(ex.started_at)}</span>
                                  <span className="text-[var(--text-muted)]">{ex.status}</span>
                                </div>
                                {(ex.output || ex.error) && (
                                  <pre className="mono mt-1 ml-3.5 whitespace-pre-wrap break-all text-[var(--text-tertiary)]">{ex.output || ex.error}</pre>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeSection === 'previews' && (
          <div className="panel p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-[var(--radius-md)] bg-[var(--accent-primary-soft)] flex items-center justify-center">
                  <GitPullRequest size={20} className="text-[var(--accent-primary)]" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-[var(--text-primary)]">Preview Environments</h2>
                  <p className="text-sm text-[var(--text-secondary)]">Ephemeral per-branch deployments of this service</p>
                </div>
              </div>
              {signedIn ? (
              <button
                onClick={() => setPreviewForm({ branch: '', prNumber: '', ttlHours: '72' })}
                className="flex items-center gap-2 px-3 py-1.5 rounded-[var(--radius-md)] border border-[var(--border-subtle)] text-xs font-medium text-[var(--text-secondary)] hover:border-[var(--border-default)] transition-colors"
              >
                <Plus size={12} /> New preview
              </button>
              ) : null}
            </div>

            {previewForm && (
              <div className="mb-6 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-4 space-y-3">
                <div className="flex flex-wrap items-end gap-3">
                  <label className="flex flex-col gap-1 text-xs text-[var(--text-muted)]">
                    Branch
                    <input
                      value={previewForm.branch}
                      onChange={(e) => setPreviewForm({ ...previewForm, branch: e.target.value })}
                      placeholder="feature/my-branch"
                      className="w-52 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-card)] px-2 py-1.5 text-xs text-[var(--text-primary)]"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs text-[var(--text-muted)]">
                    PR number (optional)
                    <input
                      value={previewForm.prNumber}
                      onChange={(e) => setPreviewForm({ ...previewForm, prNumber: e.target.value })}
                      placeholder="123"
                      className="w-24 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-card)] px-2 py-1.5 text-xs text-[var(--text-primary)]"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs text-[var(--text-muted)]">
                    TTL hours
                    <input
                      value={previewForm.ttlHours}
                      onChange={(e) => setPreviewForm({ ...previewForm, ttlHours: e.target.value })}
                      placeholder="72"
                      className="w-24 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-card)] px-2 py-1.5 text-xs text-[var(--text-primary)]"
                    />
                  </label>
                  <button
                    onClick={() => createPreviewMutation.mutate()}
                    disabled={!previewForm.branch.trim() || createPreviewMutation.isPending}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-md)] bg-[var(--accent-primary)] text-[var(--accent-on)] text-xs font-medium disabled:opacity-40"
                  >
                    {createPreviewMutation.isPending ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />} Create
                  </button>
                  <button
                    onClick={() => setPreviewForm(null)}
                    className="px-3 py-1.5 rounded-[var(--radius-md)] border border-[var(--border-subtle)] text-xs text-[var(--text-secondary)] hover:border-[var(--border-default)]"
                  >
                    Cancel
                  </button>
                </div>
                {createPreviewMutation.isError && (
                  <p className="text-xs text-[var(--error)]">
                    {createPreviewMutation.error instanceof Error ? createPreviewMutation.error.message : 'Create failed'}
                  </p>
                )}
              </div>
            )}

            {previewsQuery.isLoading ? (
              <p className="text-sm text-[var(--text-muted)]">Loading previews…</p>
            ) : previews.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)]">No preview environments for this service.</p>
            ) : (
              <div className="space-y-2">
                {previews.map((env) => (
                  <div key={env.id} className="flex flex-wrap items-center gap-3 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-[var(--text-primary)]">{env.environment}</span>
                        <StatusBadge status={env.status ?? 'stopped'} />
                      </div>
                      <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                        {env.branch_name}
                        {env.pr_number ? ` · PR #${env.pr_number}` : ''}
                        {env.expires_at ? ` · expires ${formatRelative(env.expires_at)}` : ''}
                      </p>
                    </div>
                    {env.url && env.status === 'running' && (
                      <a
                        href={env.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 text-xs text-[var(--accent-primary)] hover:underline"
                      >
                        <ExternalLink size={11} /> Open
                      </a>
                    )}
                    {env.status === 'running' && signedIn && (
                      <button
                        onClick={() => { if (window.confirm('Promote this preview to production?')) promotePreviewMutation.mutate(env.id ?? ''); }}
                        disabled={promotePreviewMutation.isPending}
                        className="px-2.5 py-1.5 rounded-[var(--radius-md)] border border-[var(--border-subtle)] text-xs text-[var(--text-secondary)] hover:border-[var(--border-default)] disabled:opacity-40"
                      >
                        Promote
                      </button>
                    )}
                    {signedIn ? (
                    <button
                      onClick={() => { if (window.confirm(`Delete preview ${env.environment}?`)) deletePreviewMutation.mutate(env.id ?? ''); }}
                      disabled={deletePreviewMutation.isPending}
                      className="px-2.5 py-1.5 rounded-[var(--radius-md)] border border-[var(--border-subtle)] text-xs text-[var(--error)] hover:border-[var(--error)] disabled:opacity-40"
                    >
                      Delete
                    </button>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
            {(deletePreviewMutation.isError || promotePreviewMutation.isError) && (
              <p className="mt-3 text-xs text-[var(--error)]">
                {((deletePreviewMutation.error ?? promotePreviewMutation.error) as Error)?.message ?? 'Operation failed'}
              </p>
            )}
          </div>
        )}

        {activeSection === 'scaling' && (
          <div className="panel p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-[var(--radius-md)] bg-[var(--accent-primary-soft)] flex items-center justify-center">
                  <Layers size={20} className="text-[var(--accent-primary)]" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-[var(--text-primary)]">Scaling</h2>
                  <p className="text-sm text-[var(--text-secondary)]">Replica policy and manual scaling</p>
                </div>
              </div>
            </div>

            {scalingPolicyQuery.isLoading ? (
              <p className="text-sm text-[var(--text-secondary)]">Loading…</p>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                  <div className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] p-3">
                    <p className="text-xs text-[var(--text-tertiary)] uppercase tracking-wide">Replicas</p>
                    <p className="text-xl font-semibold text-[var(--text-primary)]">
                      {scalingStateQuery.data?.CurrentReplicas ??
                        runtimeQuery.data?.containers.filter((c) => c.state === 'running').length ??
                        '—'}
                      <span className="text-sm font-normal text-[var(--text-secondary)]">
                        {' '}/ {scalingStateQuery.data?.DesiredReplicas ?? runtimeQuery.data?.desired ?? service?.replicas ?? '—'} desired
                      </span>
                    </p>
                  </div>
                  <div className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] p-3">
                    <p className="text-xs text-[var(--text-tertiary)] uppercase tracking-wide">Policy</p>
                    <p className="text-xl font-semibold text-[var(--text-primary)]">
                      {scalingPolicyQuery.data ? `${scalingPolicyQuery.data.min_replicas}–${scalingPolicyQuery.data.max_replicas}` : 'None'}
                    </p>
                  </div>
                  <div className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] p-3">
                    <p className="text-xs text-[var(--text-tertiary)] uppercase tracking-wide">Autoscaling</p>
                    <p className="text-xl font-semibold text-[var(--text-primary)]">
                      {scalingPolicyQuery.data?.enabled ? 'On' : 'Off'}
                    </p>
                  </div>
                  <div className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] p-3">
                    <p className="text-xs text-[var(--text-tertiary)] uppercase tracking-wide">Last action</p>
                    <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                      {scalingStateQuery.data?.LastScaleDirection ?? '—'}
                    </p>
                  </div>
                </div>

                {scalingForm === null ? (
                  <div className="flex flex-wrap items-end gap-3">
                    <div>
                      <label className="block text-xs text-[var(--text-tertiary)] mb-1">Manual replicas</label>
                      <input
                        type="number"
                        min={1}
                        max={20}
                        value={scaleReplicas}
                        onChange={(e) => setScaleReplicas(e.target.value)}
                        className="w-28 px-3 py-2 rounded-[var(--radius-md)] bg-[var(--surface-muted)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)]"
                        placeholder="e.g. 3"
                      />
                    </div>
                    {isAdmin ? (
                    <>
                    <button
                      type="button"
                      disabled={manualScaleMutation.isPending || !scaleReplicas}
                      onClick={() => manualScaleMutation.mutate(Number(scaleReplicas))}
                      className="px-4 py-2 rounded-[var(--radius-md)] bg-[var(--accent-primary)] text-[var(--accent-on)] text-sm font-medium disabled:opacity-50"
                    >
                      {manualScaleMutation.isPending ? 'Scaling…' : 'Scale'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setScalingForm({
                        min: String(scalingPolicyQuery.data?.min_replicas ?? 1),
                        max: String(scalingPolicyQuery.data?.max_replicas ?? 3),
                        targetCpu: String(scalingPolicyQuery.data?.target_cpu ?? 70),
                        targetMemory: String(scalingPolicyQuery.data?.target_memory ?? 80),
                        enabled: scalingPolicyQuery.data?.enabled ?? true,
                      })}
                      className="px-4 py-2 rounded-[var(--radius-md)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)]"
                    >
                      {scalingPolicyQuery.data ? 'Edit policy' : 'Create policy'}
                    </button>
                    {scalingPolicyQuery.data?.enabled && (
                      <button
                        type="button"
                        disabled={deleteScalingMutation.isPending}
                        onClick={() => { if (window.confirm('Disable autoscaling for this service?')) deleteScalingMutation.mutate(); }}
                        className="px-4 py-2 rounded-[var(--radius-md)] border border-[var(--error)] text-sm text-[var(--error)] disabled:opacity-50"
                      >
                        Disable policy
                      </button>
                    )}
                    </>
                    ) : (
                      <span className="self-center text-xs text-[var(--text-tertiary)]">Scaling policy changes are admin-only.</span>
                    )}
                  </div>
                ) : (
                  <div className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] p-4 space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {([
                        ['Min replicas', 'min'],
                        ['Max replicas', 'max'],
                        ['Target CPU %', 'targetCpu'],
                        ['Target memory %', 'targetMemory'],
                      ] as const).map(([label, field]) => (
                        <div key={field}>
                          <label className="block text-xs text-[var(--text-tertiary)] mb-1">{label}</label>
                          <input
                            type="number"
                            min={field === 'min' || field === 'max' ? 1 : 0}
                            value={scalingForm[field]}
                            onChange={(e) => setScalingForm({ ...scalingForm, [field]: e.target.value })}
                            className="w-full px-3 py-2 rounded-[var(--radius-md)] bg-[var(--surface-muted)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)]"
                          />
                        </div>
                      ))}
                    </div>
                    <label className="flex items-center gap-2 text-sm text-[var(--text-primary)]">
                      <input
                        type="checkbox"
                        checked={scalingForm.enabled}
                        onChange={(e) => setScalingForm({ ...scalingForm, enabled: e.target.checked })}
                      />
                      Enable autoscaling
                    </label>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        disabled={saveScalingMutation.isPending}
                        onClick={() => saveScalingMutation.mutate()}
                        className="px-4 py-2 rounded-[var(--radius-md)] bg-[var(--accent-primary)] text-[var(--accent-on)] text-sm font-medium disabled:opacity-50"
                      >
                        {saveScalingMutation.isPending ? 'Saving…' : 'Save policy'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setScalingForm(null)}
                        className="px-4 py-2 rounded-[var(--radius-md)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)]"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {(saveScalingMutation.isError || deleteScalingMutation.isError || manualScaleMutation.isError || scalingPolicyQuery.isError || scalingStateQuery.isError) && (
                  <p className="mt-3 text-xs text-[var(--error)]">
                    {((saveScalingMutation.error ?? deleteScalingMutation.error ?? manualScaleMutation.error ?? scalingPolicyQuery.error ?? scalingStateQuery.error) as Error)?.message ?? 'Operation failed'}
                  </p>
                )}
                {!scalingStateQuery.data && !scalingStateQuery.isLoading && (
                  <p className="mt-3 text-xs text-[var(--text-tertiary)]">
                    No scaling state yet — create a policy or scale manually to register this service with the autoscaler.
                  </p>
                )}
              </>
            )}
          </div>
        )}

        {activeSection === 'console' && (
          <div className="panel p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-[var(--radius-md)] bg-[var(--accent-primary-soft)] flex items-center justify-center">
                <Terminal size={20} className="text-[var(--accent-primary)]" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">Console</h2>
                <p className="text-sm text-[var(--text-secondary)]">One-off commands via docker exec — 30s limit, 64KB output cap</p>
              </div>
            </div>

            <form
              className="flex items-center gap-2 mb-4"
              onSubmit={(e) => {
                e.preventDefault();
                const cmd = consoleInput.trim();
                if (cmd && !execMutation.isPending) execMutation.mutate(cmd);
              }}
            >
              <span className="text-sm font-mono text-[var(--accent-primary)]">$</span>
              <input
                value={consoleInput}
                onChange={(e) => setConsoleInput(e.target.value)}
                placeholder="e.g. env | sort | head -20"
                disabled={execMutation.isPending}
                className="flex-1 px-3 py-2 rounded-[var(--radius-md)] bg-[var(--surface-muted)] border border-[var(--border-subtle)] text-sm font-mono text-[var(--text-primary)] disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={execMutation.isPending || !consoleInput.trim()}
                className="px-4 py-2 rounded-[var(--radius-md)] bg-[var(--accent-primary)] text-[var(--accent-on)] text-sm font-medium disabled:opacity-50"
              >
                {execMutation.isPending ? 'Running…' : 'Run'}
              </button>
            </form>

            {execMutation.isError && (
              <p className="mb-4 text-xs text-[var(--error)]">
                {(execMutation.error as Error)?.message ?? 'Command failed'}
              </p>
            )}

            {consoleHistory.length === 0 ? (
              <p className="text-xs text-[var(--text-tertiary)]">
                Commands run inside the service's running container as its default user. No interactive shell — stdout/stderr is captured and returned.
              </p>
            ) : (
              <div className="space-y-3">
                {consoleHistory.map((entry, i) => (
                  <div key={i} className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-3">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-mono text-[var(--text-primary)]">$ {entry.command}</p>
                      <span className={`text-xs font-mono ${entry.exitCode === 0 && !entry.error ? 'text-[var(--success)]' : 'text-[var(--error)]'}`}>
                        {entry.error ? 'error' : `exit ${entry.exitCode}`}
                      </span>
                    </div>
                    {(entry.output || entry.error) && (
                      <pre className="text-xs font-mono text-[var(--text-secondary)] whitespace-pre-wrap break-all max-h-64 overflow-y-auto">
                        {entry.output}{entry.error ? `\n${entry.error}` : ''}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            )}
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
                  <h3 className="text-sm font-medium text-[var(--text-primary)]">Networking</h3>
                  {networkForm === null && (
                    <button
                      type="button"
                      onClick={() =>
                        setNetworkForm({
                          port: service.port ? String(service.port) : '',
                          domain: service.domain ?? '',
                          healthcheckPath: service.healthcheckPath ?? '',
                          restartPolicy: service.restartPolicy ?? 'unless-stopped',
                          replicas: String(service.replicas ?? 1),
                        })
                      }
                      className="px-3 py-1.5 rounded-[var(--radius-md)] border border-[var(--border-subtle)] text-xs font-medium hover:border-[var(--border-default)] transition-colors"
                    >
                      Edit
                    </button>
                  )}
                </div>

                {runtimeQuery.data && (
                  <div className="mb-4 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-muted)]/40 p-3">
                    <div className="flex items-center gap-4 text-xs">
                      <span className="text-[var(--text-tertiary)]">
                        Live: <span className="text-[var(--text-primary)] font-medium">{runtimeQuery.data.containers.filter((c) => c.state === 'running').length}/{runtimeQuery.data.desired}</span> replicas
                      </span>
                      <span className="text-[var(--text-tertiary)]">
                        Internal: <span className="mono text-[var(--text-primary)]">{service.name}{service.port ? `:${service.port}` : ''}</span>
                      </span>
                      {runtimeQuery.data.urls.map((url) => (
                        <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="mono text-[var(--accent-primary)] hover:underline">
                          {url}
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {networkForm === null ? (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] p-3">
                      <p className="text-[var(--text-tertiary)] uppercase tracking-wide">Port</p>
                      <p className="mt-1 text-sm font-medium text-[var(--text-primary)]">{service.port || '—'}</p>
                    </div>
                    <div className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] p-3">
                      <p className="text-[var(--text-tertiary)] uppercase tracking-wide">Domain</p>
                      <p className="mt-1 text-sm font-medium text-[var(--text-primary)] truncate">{service.domain || '—'}</p>
                    </div>
                    <div className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] p-3">
                      <p className="text-[var(--text-tertiary)] uppercase tracking-wide">Replicas</p>
                      <p className="mt-1 text-sm font-medium text-[var(--text-primary)]">{service.replicas ?? 1}</p>
                    </div>
                    <div className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] p-3">
                      <p className="text-[var(--text-tertiary)] uppercase tracking-wide">Restart</p>
                      <p className="mt-1 text-sm font-medium text-[var(--text-primary)]">{service.restartPolicy || 'unless-stopped'}</p>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] p-4 space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs text-[var(--text-tertiary)] mb-1">Container port</label>
                        <input
                          type="number"
                          min={0}
                          max={65535}
                          value={networkForm.port}
                          onChange={(e) => setNetworkForm({ ...networkForm, port: e.target.value })}
                          placeholder="e.g. 3000"
                          className="w-full px-3 py-2 rounded-[var(--radius-md)] bg-[var(--surface-muted)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)]"
                        />
                        <p className="mt-1 text-[10px] text-[var(--text-tertiary)]">Published on the host; routed via Traefik when a domain is set</p>
                      </div>
                      <div>
                        <label className="block text-xs text-[var(--text-tertiary)] mb-1">Domain</label>
                        <input
                          value={networkForm.domain}
                          onChange={(e) => setNetworkForm({ ...networkForm, domain: e.target.value })}
                          placeholder="app.example.com"
                          className="w-full px-3 py-2 rounded-[var(--radius-md)] bg-[var(--surface-muted)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-[var(--text-tertiary)] mb-1">Health check path</label>
                        <input
                          value={networkForm.healthcheckPath}
                          onChange={(e) => setNetworkForm({ ...networkForm, healthcheckPath: e.target.value })}
                          placeholder="/health"
                          className="w-full px-3 py-2 rounded-[var(--radius-md)] bg-[var(--surface-muted)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-[var(--text-tertiary)] mb-1">Replicas</label>
                        <input
                          type="number"
                          min={1}
                          max={20}
                          value={networkForm.replicas}
                          onChange={(e) => setNetworkForm({ ...networkForm, replicas: e.target.value })}
                          className="w-full px-3 py-2 rounded-[var(--radius-md)] bg-[var(--surface-muted)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-[var(--text-tertiary)] mb-1">Restart policy</label>
                        <select
                          value={networkForm.restartPolicy}
                          onChange={(e) => setNetworkForm({ ...networkForm, restartPolicy: e.target.value })}
                          className="w-full px-3 py-2 rounded-[var(--radius-md)] bg-[var(--surface-muted)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)]"
                        >
                          <option value="unless-stopped">unless-stopped</option>
                          <option value="always">always</option>
                          <option value="on-failure">on-failure</option>
                          <option value="no">no</option>
                        </select>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={updateServiceMutation.isPending}
                        onClick={() =>
                          updateServiceMutation.mutate({
                            port: Number(networkForm.port) || 0,
                            domain: networkForm.domain,
                            healthcheck_path: networkForm.healthcheckPath,
                            restart_policy: networkForm.restartPolicy,
                            replicas: Math.max(1, Math.min(20, Number(networkForm.replicas) || 1)),
                          })
                        }
                        className="px-4 py-2 rounded-[var(--radius-md)] bg-[var(--accent-primary)] text-[var(--accent-on)] text-sm font-medium disabled:opacity-50"
                      >
                        {updateServiceMutation.isPending ? 'Saving…' : 'Save'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setNetworkForm(null)}
                        className="px-4 py-2 rounded-[var(--radius-md)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)]"
                      >
                        Cancel
                      </button>
                      <p className="text-[10px] text-[var(--text-tertiary)]">Takes effect on next deploy or redeploy</p>
                    </div>
                    {updateServiceMutation.isError && (
                      <p className="text-xs text-[var(--error)]">{(updateServiceMutation.error as Error).message}</p>
                    )}
                  </div>
                )}
              </div>
            )}

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
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => {
                                    setLogDeploymentId(deployment.id);
                                    setActiveSection('logs');
                                  }}
                                  className="px-3 py-1.5 rounded-[var(--radius-sm)] border border-[var(--border-subtle)] text-xs font-medium hover:border-[var(--border-default)] transition-colors"
                                >
                                  Logs
                                </button>
                                <button
                                  onClick={() => {
                                    if (window.confirm(`Rollback to deployment ${deployment.id.slice(0, 8)}?`)) {
                                      rollbackMutation.mutate(deployment.id);
                                    }
                                  }}
                                  disabled={!canRollback(deployment.status) || rollbackMutation.isPending}
                                  className="px-3 py-1.5 rounded-[var(--radius-sm)] border border-[var(--border-subtle)] text-xs font-medium hover:border-[var(--border-default)] disabled:opacity-50 transition-colors"
                                >
                                  {rollbackMutation.isPending && rollbackMutation.variables === deployment.id ? '...' : 'Rollback'}
                                </button>
                              </div>
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
