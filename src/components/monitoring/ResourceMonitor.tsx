import { useState, useEffect } from 'react';
import { 
  Cpu, 
  HardDrive, 
  Network, 
  Activity,
  TrendingUp,
  TrendingDown,
  Minus
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface MetricData {
  current: number;
  previous: number;
  trend: 'up' | 'down' | 'stable';
  unit: string;
}

interface MetricsState {
  cpu: MetricData;
  memory: MetricData;
  network: MetricData;
  disk: MetricData;
}

interface ResourceWidgetProps {
  title: string;
  icon: typeof Cpu;
  metric: MetricData;
  color: string;
  sparklineData?: number[];
}

function ResourceWidget({ title, icon: Icon, metric, color, sparklineData }: ResourceWidgetProps) {
  const trendIcon = metric.trend === 'up' ? TrendingUp : metric.trend === 'down' ? TrendingDown : Minus;
  const TrendIcon = trendIcon;
  const trendColor = metric.trend === 'up' ? 'text-green-500' : metric.trend === 'down' ? 'text-red-500' : 'text-gray-500';

  const change = metric.previous > 0 
    ? ((metric.current - metric.previous) / metric.previous * 100).toFixed(1)
    : '0';

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className={`p-2 rounded-lg ${color}`}>
            <Icon className="w-5 h-5 text-white" />
          </div>
          <div className={`flex items-center gap-1 ${trendColor}`}>
            <TrendIcon className="w-4 h-4" />
            <span className="text-sm font-medium">{Math.abs(parseFloat(change))}%</span>
          </div>
        </div>
        <div className="mt-3">
          <div className="text-2xl font-bold">
            {metric.current.toFixed(1)}{metric.unit}
          </div>
          <div className="text-sm text-muted-foreground">{title}</div>
        </div>
        {sparklineData && sparklineData.length > 0 && (
          <div className="mt-3 h-8 flex items-end gap-0.5">
            {sparklineData.map((value, index) => {
              const height = (value / Math.max(...sparklineData)) * 100;
              return (
                <div
                  key={index}
                  className="flex-1 bg-primary/20 rounded-t"
                  style={{ height: `${height}%` }}
                />
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface ResourceMonitorProps {
  serviceId?: string;
}

function _ResourceMonitor({ serviceId }: ResourceMonitorProps) {
  const [metrics, setMetrics] = useState<MetricsState>({
    cpu: { current: 0, previous: 0, trend: 'stable', unit: '%' },
    memory: { current: 0, previous: 0, trend: 'stable', unit: '%' },
    network: { current: 0, previous: 0, trend: 'stable', unit: ' MB/s' },
    disk: { current: 0, previous: 0, trend: 'stable', unit: ' GB' },
  });
  const [sparklines, setSparklines] = useState({
    cpu: [] as number[],
    memory: [] as number[],
    network: [] as number[],
    disk: [] as number[],
  });

  useEffect(() => {
    const fetchData = () => {
      const cpuValue = 20 + Math.random() * 60;
      const memoryValue = 30 + Math.random() * 50;
      const networkValue = Math.random() * 100;
      const diskValue = 5 + Math.random() * 20;

      setMetrics((prev) => ({
        cpu: { current: cpuValue, previous: prev.cpu.current, trend: cpuValue > prev.cpu.current ? 'up' : cpuValue < prev.cpu.current ? 'down' : 'stable', unit: '%' },
        memory: { current: memoryValue, previous: prev.memory.current, trend: memoryValue > prev.memory.current ? 'up' : memoryValue < prev.memory.current ? 'down' : 'stable', unit: '%' },
        network: { current: networkValue, previous: prev.network.current, trend: networkValue > prev.network.current ? 'up' : networkValue < prev.network.current ? 'down' : 'stable', unit: ' MB/s' },
        disk: { current: diskValue, previous: prev.disk.current, trend: diskValue > prev.disk.current ? 'up' : diskValue < prev.disk.current ? 'down' : 'stable', unit: ' GB' },
      }));

      setSparklines((prev) => ({
        cpu: [...prev.cpu.slice(-20), cpuValue],
        memory: [...prev.memory.slice(-20), memoryValue],
        network: [...prev.network.slice(-20), networkValue],
        disk: [...prev.disk.slice(-20), diskValue],
      }));
    };

    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [serviceId]);

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <ResourceWidget
        title="CPU Usage"
        icon={Cpu}
        metric={metrics.cpu}
        color="bg-blue-500"
        sparklineData={sparklines.cpu}
      />
      <ResourceWidget
        title="Memory"
        icon={HardDrive}
        metric={metrics.memory}
        color="bg-purple-500"
        sparklineData={sparklines.memory}
      />
      <ResourceWidget
        title="Network I/O"
        icon={Network}
        metric={metrics.network}
        color="bg-green-500"
        sparklineData={sparklines.network}
      />
      <ResourceWidget
        title="Disk Usage"
        icon={Activity}
        metric={metrics.disk}
        color="bg-orange-500"
        sparklineData={sparklines.disk}
      />
    </div>
  );
}

interface ServiceHealthIndicatorProps {
  status: 'healthy' | 'degraded' | 'unhealthy';
  lastCheck: string;
  uptime: number;
}

function _ServiceHealthIndicator({ status, lastCheck, uptime }: ServiceHealthIndicatorProps) {
  const statusColors = {
    healthy: 'bg-green-500',
    degraded: 'bg-yellow-500',
    unhealthy: 'bg-red-500',
  };

  const statusLabels = {
    healthy: 'Healthy',
    degraded: 'Degraded',
    unhealthy: 'Unhealthy',
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${statusColors[status]} animate-pulse`} />
            <div>
              <div className="font-medium">{statusLabels[status]}</div>
              <div className="text-sm text-muted-foreground">
                Last check: {lastCheck}
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold">{uptime.toFixed(2)}%</div>
            <div className="text-sm text-muted-foreground">Uptime</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface QuickStatsProps {
  stats: {
    totalServices: number;
    runningServices: number;
    totalDeployments: number;
    activeAlerts: number;
  };
}

function _QuickStats({ stats }: QuickStatsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-4">
      <Card>
        <CardContent className="p-4">
          <div className="text-sm text-muted-foreground">Total Services</div>
          <div className="text-2xl font-bold">{stats.totalServices}</div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="text-sm text-muted-foreground">Running</div>
          <div className="text-2xl font-bold text-green-500">{stats.runningServices}</div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="text-sm text-muted-foreground">Deployments (24h)</div>
          <div className="text-2xl font-bold">{stats.totalDeployments}</div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="text-sm text-muted-foreground">Active Alerts</div>
          <div className="text-2xl font-bold text-red-500">{stats.activeAlerts}</div>
        </CardContent>
      </Card>
    </div>
  );
}
