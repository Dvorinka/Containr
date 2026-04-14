import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/components/ui/toaster';
import {
  GitBranch,
  Activity,
  Cpu,
  HardDrive,
  Network,
  Container,
  Server,
  Database,
  ArrowUpRight,
  ArrowDownRight,
  Zap,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  RefreshCw,
  Plus,
  TrendingUp,
  TrendingDown,
  Box,
  Layers,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppConfig } from '@/hooks/useAppConfig';
import { useState, useEffect } from 'react';

interface DashboardStats {
  activeServices: number;
  deploymentsThisMonth: number;
  teamMembers: number;
  uptime: number;
  cpuUsage: number;
  memoryUsage: number;
  networkIO: number;
  recentDeployments: Array<{
    name: string;
    status: 'success' | 'building' | 'failed';
    time: string;
    branch: string;
    commit: string;
    duration: string;
  }>;
  activeServicesList: Array<{
    name: string;
    status: 'running' | 'stopped' | 'building';
    cpu: string;
    memory: string;
    port: string;
  }>;
}

const statusConfig: Record<string, { 
  icon: typeof CheckCircle2; 
  color: string; 
  bg: string; 
  label: string; 
  animate?: boolean 
}> = {
  success: { 
    icon: CheckCircle2, 
    color: 'text-emerald-500', 
    bg: 'bg-emerald-500/10', 
    label: 'Live' 
  },
  building: { 
    icon: RefreshCw, 
    color: 'text-amber-500', 
    bg: 'bg-amber-500/10', 
    label: 'Building', 
    animate: true 
  },
  failed: { 
    icon: AlertCircle, 
    color: 'text-rose-500', 
    bg: 'bg-rose-500/10', 
    label: 'Failed' 
  },
};

function MetricCard({ 
  title, 
  value, 
  description, 
  icon: Icon,
  trend,
  trendValue,
  color = 'primary'
}: { 
  title: string; 
  value: string; 
  description: string;
  icon: React.ElementType;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  color?: 'emerald' | 'violet' | 'blue' | 'amber' | 'primary';
}) {
  const colorMap = {
    emerald: { text: 'text-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
    violet: { text: 'text-violet-500', bg: 'bg-violet-500/10', border: 'border-violet-500/20' },
    blue: { text: 'text-blue-500', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
    amber: { text: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
    primary: { text: 'text-primary', bg: 'bg-primary/10', border: 'border-primary/20' },
  };

  const colors = colorMap[color];

  return (
    <Card className="card-hover border-border bg-card overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-3">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-semibold tracking-tight">{value}</p>
              {trend && trendValue && (
                <span className={cn(
                  'flex items-center gap-0.5 text-xs font-medium',
                  trend === 'up' ? 'text-emerald-500' : trend === 'down' ? 'text-rose-500' : 'text-muted-foreground'
                )}>
                  {trend === 'up' && <TrendingUp className="h-3 w-3" />}
                  {trend === 'down' && <TrendingDown className="h-3 w-3" />}
                  {trendValue}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
          <div className={cn(
            'flex h-9 w-9 items-center justify-center rounded-lg border',
            colors.bg,
            colors.text,
            colors.border
          )}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ResourceBar({ 
  label, 
  value, 
  max = 100, 
  icon: Icon, 
  color = 'primary' 
}: { 
  label: string; 
  value: number; 
  max?: number;
  icon: React.ElementType;
  color?: 'primary' | 'emerald' | 'violet' | 'amber';
}) {
  const percentage = Math.min((value / max) * 100, 100);
  
  const colorMap = {
    primary: 'bg-primary',
    emerald: 'bg-emerald-500',
    violet: 'bg-violet-500',
    amber: 'bg-amber-500',
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">{label}</span>
        </div>
        <span className="font-medium tabular-nums">{value}%</span>
      </div>
      <div className="h-2 w-full rounded-full bg-surface overflow-hidden">
        <div 
          className={cn('h-full rounded-full transition-all duration-500', colorMap[color])}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { isDemoMode } = useAppConfig();
  const { toast } = useToast();
  const [stats, setStats] = useState<DashboardStats>({
    activeServices: 0,
    deploymentsThisMonth: 0,
    teamMembers: 1,
    uptime: 0,
    cpuUsage: 0,
    memoryUsage: 0,
    networkIO: 0,
    recentDeployments: [],
    activeServicesList: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/dashboard/stats');
      if (!response.ok) {
        throw new Error('Failed to fetch dashboard data');
      }
      
      const data = await response.json();
      setStats(data);
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
      
      if (!isDemoMode) {
        toast({
          title: 'Error',
          description: 'Failed to load dashboard data',
          variant: 'destructive',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    
    const interval = setInterval(fetchDashboardData, 30000);
    return () => clearInterval(interval);
  }, [isDemoMode]);

  if (loading) {
    return (
      <div className="p-6 lg:p-8">
        <div className="mx-auto max-w-[1400px] space-y-8">
          <div className="h-8 w-48 bg-surface animate-pulse rounded" />
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-28 bg-surface animate-pulse rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 lg:p-8">
        <div className="mx-auto max-w-[1400px]">
          <Card className="border-destructive/50">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 mb-4">
                <AlertCircle className="h-6 w-6 text-destructive" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Failed to load dashboard</h3>
              <p className="text-sm text-muted-foreground mb-6 max-w-sm">{error}</p>
              <Button onClick={fetchDashboardData} variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8">
      <div className="mx-auto max-w-[1400px] space-y-8">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Monitor your infrastructure and deployments
            </p>
          </div>
          <Button size="sm" className="h-9 gap-2">
            <Plus className="h-4 w-4" />
            New Deployment
          </Button>
        </div>

        {/* Metrics Grid */}
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            title="Active Services"
            value={stats.activeServices.toString()}
            description="Running containers"
            icon={Box}
            trend="up"
            trendValue="12%"
            color="emerald"
          />
          <MetricCard
            title="Deployments"
            value={stats.deploymentsThisMonth.toString()}
            description="This month"
            icon={GitBranch}
            trend="up"
            trendValue="8"
            color="violet"
          />
          <MetricCard
            title="Team Members"
            value={stats.teamMembers.toString()}
            description="Active users"
            icon={Activity}
            trend="neutral"
            trendValue="0"
            color="blue"
          />
          <MetricCard
            title="Uptime"
            value={`${stats.uptime.toFixed(1)}%`}
            description="Last 30 days"
            icon={Zap}
            trend="up"
            trendValue="0.1%"
            color="amber"
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
          {/* Resource Usage */}
          <Card className="lg:col-span-2 border-border">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-semibold">Resource Usage</CardTitle>
                  <CardDescription className="text-sm mt-0.5">Real-time infrastructure metrics</CardDescription>
                </div>
                <Badge variant="outline" className="text-xs gap-1.5 bg-emerald-500/5 border-emerald-500/20 text-emerald-500">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <ResourceBar 
                label="CPU Usage" 
                value={stats.cpuUsage} 
                icon={Cpu}
                color="primary"
              />
              <ResourceBar 
                label="Memory" 
                value={stats.memoryUsage} 
                icon={HardDrive}
                color="emerald"
              />
              <ResourceBar 
                label="Network I/O" 
                value={stats.networkIO} 
                icon={Network}
                color="violet"
              />
            </CardContent>
          </Card>

          {/* Recent Deployments */}
          <Card className="border-border">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold">Recent Deployments</CardTitle>
                <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
                  View all
                  <ArrowUpRight className="h-3 w-3" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {stats.recentDeployments.length > 0 ? (
                stats.recentDeployments.slice(0, 4).map((deployment, index) => {
                  const config = statusConfig[deployment.status];
                  return (
                    <div 
                      key={index}
                      className="flex items-center gap-3 p-3 rounded-lg bg-surface/50 hover:bg-surface transition-colors group cursor-pointer"
                    >
                      <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg', config.bg)}>
                        <config.icon className={cn('h-4 w-4', config.color, config.animate && 'animate-spin')} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium truncate">{deployment.name}</p>
                          <Badge variant="outline" className="text-[10px] h-4 px-1 font-mono bg-surface">
                            {deployment.commit.slice(0, 7)}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {deployment.branch} · {deployment.time}
                        </p>
                      </div>
                      <Badge 
                        variant="outline" 
                        className={cn('text-[10px] border-0', config.color, config.bg)}
                      >
                        {config.label}
                      </Badge>
                    </div>
                  );
                })
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-surface mb-3">
                    <GitBranch className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground">No deployments yet</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Create your first deployment</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { 
              title: 'Add Service', 
              description: 'Deploy new container', 
              icon: Server, 
              color: 'text-violet-500',
              bg: 'bg-violet-500/10',
              border: 'border-violet-500/20'
            },
            { 
              title: 'Create Database', 
              description: 'PostgreSQL or Redis', 
              icon: Database, 
              color: 'text-emerald-500',
              bg: 'bg-emerald-500/10',
              border: 'border-emerald-500/20'
            },
            { 
              title: 'Import Repository', 
              description: 'Connect GitHub', 
              icon: GitBranch, 
              color: 'text-blue-500',
              bg: 'bg-blue-500/10',
              border: 'border-blue-500/20'
            },
            { 
              title: 'Quick Deploy', 
              description: 'One-click setup', 
              icon: Zap, 
              color: 'text-amber-500',
              bg: 'bg-amber-500/10',
              border: 'border-amber-500/20'
            },
          ].map((action) => (
            <Card 
              key={action.title}
              className="card-hover card-interactive group cursor-pointer overflow-hidden border-border"
            >
              <CardContent className="p-4 flex items-center gap-4">
                <div className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-lg border transition-transform group-hover:scale-105',
                  action.bg,
                  action.color,
                  action.border
                )}>
                  <action.icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm group-hover:text-primary transition-colors">{action.title}</p>
                  <p className="text-xs text-muted-foreground">{action.description}</p>
                </div>
                <ArrowUpRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-all" />
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Active Services */}
        <Card className="border-border">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">Active Services</CardTitle>
                <CardDescription className="text-sm mt-0.5">All running containers</CardDescription>
              </div>
              <Badge variant="outline" className="text-xs gap-1.5 bg-surface border-border">
                <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
                {stats.activeServices} services
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
              {stats.activeServicesList.length > 0 ? (
                stats.activeServicesList.map((service) => (
                  <div 
                    key={service.name}
                    className="flex items-center justify-between p-4 rounded-lg bg-surface/50 hover:bg-surface transition-colors group cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <span className={cn(
                        'h-2 w-2 rounded-full shrink-0',
                        service.status === 'running' ? 'bg-emerald-500' : 'bg-amber-500'
                      )} />
                      <div>
                        <p className="font-medium text-sm">{service.name}</p>
                        <p className="text-xs text-muted-foreground font-mono">:{service.port}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <div className="hidden sm:block">
                        <span className={cn("font-medium tabular-nums", service.cpu !== '-' && "text-foreground")}>
                          {service.cpu}
                        </span>
                        <span className="ml-1">CPU</span>
                      </div>
                      <div className="hidden sm:block">
                        <span className={cn("font-medium tabular-nums", service.memory !== '-' && "text-foreground")}>
                          {service.memory}
                        </span>
                        <span className="ml-1">RAM</span>
                      </div>
                      <ArrowUpRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-primary" />
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center col-span-full">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface mb-4">
                    <Layers className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground">No active services</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Deploy your first service to get started</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
