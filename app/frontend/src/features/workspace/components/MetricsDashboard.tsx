import { useEffect, useRef, useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import { Cpu, HardDrive, ArrowDownUp, Boxes } from 'lucide-react';
import { LineMetricChart, DonutChart } from '@/shared/components';
import { getServiceMetrics, type ServiceMetrics } from '@/lib/api-client';
import { formatBytes } from '@/lib/time';

interface MetricsDashboardProps {
  services: { id: string; name: string; status: string }[];
  isDemoMode?: boolean;
}

function healthLabel(pct: number): { text: string; color: string } {
  if (pct < 50) return { text: 'Good', color: 'var(--success)' };
  if (pct < 80) return { text: 'Average', color: 'var(--warning)' };
  return { text: 'High', color: 'var(--error)' };
}

function Tile({ icon: Icon, label, children }: {
  icon: React.ElementType;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="s-card !p-0 overflow-hidden">
      <div className="s-cardhead">
        <span className="s-ibox"><Icon /></span>
        <span className="s-t">{label}</span>
      </div>
      <div className="px-4 pb-4 pt-3">{children}</div>
    </div>
  );
}

export function MetricsDashboard({ services, isDemoMode = false }: MetricsDashboardProps) {
  const liveServices = services.filter((s) => s.status === 'running');

  const metricsQueries = useQueries({
    queries: liveServices.map((service) => ({
      queryKey: ['service-metrics', service.id],
      queryFn: () => getServiceMetrics(service.id),
      enabled: !isDemoMode,
      refetchInterval: 5000,
      retry: false,
    })),
  });

  const samples = metricsQueries
    .map((q) => q.data)
    .filter((m): m is ServiceMetrics => Boolean(m) && m!.status === 'ok');

  const totalCpu = samples.reduce((sum, m) => sum + m.cpu_percent, 0);
  const avgCpu = samples.length > 0 ? totalCpu / samples.length : 0;
  const memUsed = samples.reduce((sum, m) => sum + m.memory_usage_bytes, 0);
  const memLimit = samples.reduce((sum, m) => sum + m.memory_limit_bytes, 0);
  const memPct = memLimit > 0 ? (memUsed / memLimit) * 100 : 0;
  const netRx = samples.reduce((sum, m) => sum + m.network_rx_bytes, 0);
  const netTx = samples.reduce((sum, m) => sum + m.network_tx_bytes, 0);
  const instanceCount = samples.reduce((sum, m) => sum + m.instances.length, 0);

  // Rolling history for the sparklines — accumulated from real samples.
  const [cpuHistory, setCpuHistory] = useState<number[]>([]);
  const [netHistory, setNetHistory] = useState<{ rx: number[]; tx: number[] }>({ rx: [], tx: [] });
  const lastNetRef = useRef<{ rx: number; tx: number; at: number } | null>(null);

  const samplesKey = samples.map((s) => `${s.service_id}:${s.collected_at}`).join('|');
  const avgCpuRef = avgCpu;
  const netRxRef = netRx;
  const netTxRef = netTx;
  useEffect(() => {
    if (!samplesKey) return;
    const now = Date.now();
    const prev = lastNetRef.current;
    const elapsed = prev ? Math.max(1, (now - prev.at) / 1000) : 0;
    const rxRate = prev && elapsed > 0 ? Math.max(0, (netRxRef - prev.rx) / elapsed) : 0;
    const txRate = prev && elapsed > 0 ? Math.max(0, (netTxRef - prev.tx) / elapsed) : 0;
    lastNetRef.current = { rx: netRxRef, tx: netTxRef, at: now };
    setCpuHistory((h) => [...h, Math.min(100, avgCpuRef)].slice(-24));
    setNetHistory((h) => ({ rx: [...h.rx, rxRate].slice(-24), tx: [...h.tx, txRate].slice(-24) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the samples' collected_at signature
  }, [samplesKey]);

  const cpuHealth = healthLabel(avgCpu);
  const memHealth = healthLabel(memPct);
  const reporting = samples.length;
  const noData = !isDemoMode && liveServices.length > 0 && reporting === 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <span className="v-mono text-[10.5px] uppercase tracking-[0.1em] text-[var(--text-tertiary)]">Metrics</span>
        <span className="v-mono text-[10.5px] text-[var(--text-muted)]">
          {isDemoMode
            ? 'sample data'
            : reporting > 0
              ? `${reporting} service${reporting === 1 ? '' : 's'} reporting · every 5s`
              : 'no running services'}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {/* CPU */}
        <Tile icon={Cpu} label="CPU Usage">
          <div className="font-headline text-[30px] font-bold leading-none tracking-[-0.02em] text-[var(--text-primary)]">
            {avgCpu.toFixed(1)}<span className="text-[13px] font-medium text-[var(--text-tertiary)]">%</span>
          </div>
          <div className="mt-1.5 v-mono text-[10.5px] text-[var(--text-tertiary)]">
            <span style={{ color: cpuHealth.color }}>{cpuHealth.text}</span>
            {' '}· avg across running services
          </div>
          <div style={{ height: 56, marginTop: 12 }}>
            {cpuHistory.length > 1 ? (
              <LineMetricChart data={cpuHistory} color="var(--accent-primary)" fillOpacity={0.15} showArea height={56} />
            ) : (
              <div className="h-full rounded bg-[var(--surface-muted)] opacity-40" />
            )}
          </div>
        </Tile>

        {/* Memory */}
        <Tile icon={HardDrive} label="Memory">
          <div className="font-headline text-[30px] font-bold leading-none tracking-[-0.02em] text-[var(--text-primary)]">
            {memPct.toFixed(0)}<span className="text-[13px] font-medium text-[var(--text-tertiary)]">%</span>
          </div>
          <div className="mt-1.5 v-mono text-[10.5px] text-[var(--text-tertiary)]">
            <span style={{ color: memHealth.color }}>{memHealth.text}</span>
            {' '}· {formatBytes(memUsed)} used
          </div>
          <div className="mt-2 flex justify-center">
            <DonutChart percentage={memPct} size={100} thickness={11} />
          </div>
          <div className="mt-1 text-center v-mono text-[10.5px] text-[var(--text-tertiary)]">
            {formatBytes(memUsed)} / {memLimit > 0 ? formatBytes(memLimit) : '∞'}
          </div>
        </Tile>

        {/* Network */}
        <Tile icon={ArrowDownUp} label="Network">
          <div className="font-headline text-[30px] font-bold leading-none tracking-[-0.02em] text-[var(--text-primary)]">
            {formatBytes(netRx)}
          </div>
          <div className="mt-1.5 v-mono text-[10.5px] text-[var(--text-tertiary)]">
            <span className="text-[var(--accent-primary)]">RX</span>
            {' '}total · TX {formatBytes(netTx)}
          </div>
          <div style={{ height: 56, marginTop: 12 }}>
            {netHistory.rx.length > 1 ? (
              <LineMetricChart data={netHistory.rx} color="var(--accent-primary)" fillOpacity={0.12} showArea height={56} />
            ) : (
              <div className="h-full rounded bg-[var(--surface-muted)] opacity-40" />
            )}
          </div>
          <div className="mt-2 v-mono text-[10.5px] text-[var(--text-muted)]">
            {netHistory.rx.length > 0
              ? `↓ ${formatBytes(netHistory.rx[netHistory.rx.length - 1])}/s · ↑ ${formatBytes(netHistory.tx[netHistory.tx.length - 1])}/s`
              : 'rate accumulating…'}
          </div>
        </Tile>

        {/* Instances */}
        <Tile icon={Boxes} label="Instances">
          <div className="font-headline text-[30px] font-bold leading-none tracking-[-0.02em] text-[var(--text-primary)]">
            {isDemoMode ? liveServices.length : instanceCount}
          </div>
          <div className="mt-1.5 v-mono text-[10.5px] text-[var(--text-tertiary)]">
            <span className="text-[var(--success)]">Running</span>
            {' '}across {liveServices.length} service{liveServices.length === 1 ? '' : 's'}
          </div>
          <ul className="mt-3 space-y-1.5">
            {liveServices.slice(0, 4).map((service, i) => {
              const m = samples.find((s) => s.service_id === service.id);
              return (
                <li key={service.id} className="flex items-center justify-between text-[11.5px]">
                  <span className="truncate text-[var(--text-secondary)]">
                    <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-[var(--success)] align-middle" />
                    {service.name}
                  </span>
                  <span className="v-mono text-[10.5px] text-[var(--text-muted)]">
                    {m ? `${m.cpu_percent.toFixed(1)}%` : i < 3 ? '—' : ''}
                  </span>
                </li>
              );
            })}
            {liveServices.length > 4 && (
              <li className="v-mono text-[10.5px] text-[var(--text-muted)]">+{liveServices.length - 4} more</li>
            )}
          </ul>
        </Tile>
      </div>

      {noData && (
        <p className="mt-3 v-mono text-[11px] text-[var(--text-muted)]">
          Metrics collector is not reporting yet — check that the node agent is online.
        </p>
      )}
    </div>
  );
}
