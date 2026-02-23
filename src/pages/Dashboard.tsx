import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { PageHeader } from '@/components/ui/page-header';
import {
  GitBranch,
  Activity,
  Users,
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
  RefreshCw
} from 'lucide-react';
import { cn } from '@/lib/utils';

const infrastructureStats = [
  {
    title: 'Active Services',
    value: '12',
    description: 'Running containers',
    icon: Container,
    trend: { value: '+2', direction: 'up' as 'up' | 'down' | 'neutral' },
    status: 'success' as 'success' | 'warning' | 'danger' | 'neutral',
    gradient: 'from-emerald-500/20 via-emerald-500/10 to-transparent',
    iconBg: 'bg-emerald-500/10 text-emerald-500 dark:text-emerald-400',
    ringColor: 'ring-emerald-500/20',
  },
  {
    title: 'Deployments',
    value: '48',
    description: 'This month',
    icon: GitBranch,
    trend: { value: '+8', direction: 'up' as 'up' | 'down' | 'neutral' },
    status: 'success' as 'success' | 'warning' | 'danger' | 'neutral',
    gradient: 'from-violet-500/20 via-violet-500/10 to-transparent',
    iconBg: 'bg-violet-500/10 text-violet-500 dark:text-violet-400',
    ringColor: 'ring-violet-500/20',
  },
  {
    title: 'Team Members',
    value: '6',
    description: 'Active users',
    icon: Users,
    trend: { value: '0', direction: 'neutral' as 'up' | 'down' | 'neutral' },
    status: 'neutral' as 'success' | 'warning' | 'danger' | 'neutral',
    gradient: 'from-blue-500/20 via-blue-500/10 to-transparent',
    iconBg: 'bg-blue-500/10 text-blue-500 dark:text-blue-400',
    ringColor: 'ring-blue-500/20',
  },
  {
    title: 'Uptime',
    value: '99.9%',
    description: 'Last 30 days',
    icon: Activity,
    trend: { value: '+0.1%', direction: 'up' as 'up' | 'down' | 'neutral' },
    status: 'success' as 'success' | 'warning' | 'danger' | 'neutral',
    gradient: 'from-amber-500/20 via-amber-500/10 to-transparent',
    iconBg: 'bg-amber-500/10 text-amber-500 dark:text-amber-400',
    ringColor: 'ring-amber-500/20',
  },
];

const resourceStats = [
  { 
    title: 'CPU Usage', 
    value: '34%', 
    max: 100,
    icon: Cpu, 
    color: 'text-blue-500 dark:text-blue-400',
    bg: 'bg-blue-500/10',
    progressColor: 'bg-gradient-to-r from-blue-500 to-blue-400',
  },
  { 
    title: 'Memory', 
    value: '2.4 GB', 
    max: 8,
    current: 2.4,
    icon: HardDrive, 
    color: 'text-emerald-500 dark:text-emerald-400',
    bg: 'bg-emerald-500/10',
    progressColor: 'bg-gradient-to-r from-emerald-500 to-emerald-400',
  },
  { 
    title: 'Network I/O', 
    value: '124 MB/s', 
    icon: Network, 
    color: 'text-violet-500 dark:text-violet-400',
    bg: 'bg-violet-500/10',
    progressColor: 'bg-gradient-to-r from-violet-500 to-violet-400',
  },
];

const recentDeployments = [
  { 
    name: 'api-gateway', 
    status: 'success', 
    time: '2 min ago',
    branch: 'main',
    commit: 'a1b2c3d',
    duration: '12s',
  },
  { 
    name: 'web-frontend', 
    status: 'building', 
    time: '5 min ago',
    branch: 'feature/auth',
    commit: 'e4f5g6h',
    duration: '~45s',
  },
  { 
    name: 'worker-service', 
    status: 'success', 
    time: '1 hour ago',
    branch: 'main',
    commit: 'i7j8k9l',
    duration: '28s',
  },
  { 
    name: 'redis-cache', 
    status: 'failed', 
    time: '3 hours ago',
    branch: 'main',
    commit: 'm0n1o2p',
    duration: '8s',
  },
];

const statusConfig: Record<string, { icon: typeof CheckCircle2; color: string; bg: string; label: string; animate?: boolean }> = {
  success: { icon: CheckCircle2, color: 'text-emerald-500 dark:text-emerald-400', bg: 'bg-emerald-500/10 dark:bg-emerald-500/20', label: 'Live' },
  building: { icon: RefreshCw, color: 'text-amber-500 dark:text-amber-400', bg: 'bg-amber-500/10 dark:bg-amber-500/20', label: 'Building', animate: true },
  failed: { icon: AlertCircle, color: 'text-red-500 dark:text-red-400', bg: 'bg-red-500/10 dark:bg-red-500/20', label: 'Failed' },
};

export default function Dashboard() {
  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-8 animate-fade-in">
      <PageHeader
        title="Dashboard"
        description="Monitor your infrastructure and deployments"
        action={{
          label: 'New Deployment',
          icon: Sparkles,
          onClick: () => {},
        }}
      />

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {infrastructureStats.map((stat, index) => (
          <Card 
            key={stat.title} 
            className={cn(
              "relative overflow-hidden card-hover card-elevated group",
              "animate-fade-in-up"
            )}
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <div className={cn("absolute inset-0 bg-gradient-to-br", stat.gradient)} />
            <CardContent className="relative p-5">
              <div className="flex items-start justify-between">
                <div className="space-y-2.5">
                  <p className="text-sm font-medium text-muted-foreground">
                    {stat.title}
                  </p>
                  <div className="flex items-baseline gap-2.5">
                    <p className="text-3xl font-bold tracking-tight">
                      {stat.value}
                    </p>
                    {stat.trend && (
                      <Badge 
                        variant="outline"
                        className={cn(
                          "font-mono text-[10px] px-1.5 py-0.5",
                          stat.trend.direction === 'up' 
                            ? 'border-emerald-500/30 text-emerald-500 dark:text-emerald-400 bg-emerald-500/10' 
                            : stat.trend.direction === 'down'
                            ? 'border-red-500/30 text-red-500 dark:text-red-400 bg-red-500/10'
                            : 'border-muted-foreground/30 text-muted-foreground'
                        )}
                      >
                        {stat.trend.direction === 'up' && <ArrowUpRight className="w-2.5 h-2.5 mr-0.5" />}
                        {stat.trend.direction === 'down' && <ArrowDownRight className="w-2.5 h-2.5 mr-0.5" />}
                        {stat.trend.value}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {stat.description}
                  </p>
                </div>
                <div className={cn(
                  "p-2.5 rounded-xl transition-all duration-300 group-hover:scale-110 group-hover:rotate-3",
                  stat.iconBg,
                  "ring-2",
                  stat.ringColor
                )}>
                  <stat.icon className="w-5 h-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
        <Card className="lg:col-span-2 card-hover card-elevated">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">Resource Usage</CardTitle>
                <CardDescription>Real-time infrastructure metrics</CardDescription>
              </div>
              <Badge variant="outline" className="text-[10px] font-medium gap-1.5 bg-emerald-500/5 border-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {resourceStats.map((stat) => (
              <div key={stat.title} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className={cn("p-2 rounded-lg", stat.bg)}>
                      <stat.icon className={cn("w-4 h-4", stat.color)} />
                    </div>
                    <span className="text-sm font-medium">{stat.title}</span>
                  </div>
                  <span className={cn("text-sm font-mono font-medium tabular-nums", stat.color)}>
                    {stat.value}
                  </span>
                </div>
                {stat.max && (
                  <div className="h-2 bg-muted/50 rounded-full overflow-hidden">
                    <Progress 
                      value={stat.current ? (stat.current / stat.max) * 100 : parseInt(stat.value)} 
                      className="h-2"
                    />
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="card-hover card-elevated">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">Recent Deployments</CardTitle>
              <Button variant="ghost" size="sm" className="text-xs h-7 px-2.5 hover:bg-muted/50">
                View All
                <ArrowUpRight className="w-3 h-3 ml-1" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentDeployments.map((deployment, index) => {
              const config = statusConfig[deployment.status as keyof typeof statusConfig];
              return (
                <div 
                  key={index}
                  className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-all duration-200 cursor-pointer group"
                >
                  <div className={cn("p-2 rounded-lg", config.bg)}>
                    <config.icon className={cn("w-4 h-4", config.color, config.animate && "animate-spin")} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">{deployment.name}</p>
                      <Badge variant="outline" className="text-[10px] h-4 px-1 font-mono bg-muted/50 border-border/50">
                        {deployment.commit}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {deployment.branch} · {deployment.time}
                    </p>
                  </div>
                  <Badge 
                    variant="outline" 
                    className={cn("text-[10px] font-medium", config.color, config.bg, "border-0")}
                  >
                    {config.label}
                  </Badge>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { title: 'Add Server', description: 'Connect new node', icon: Server, gradient: 'from-violet-500/20 to-violet-500/5', iconColor: 'text-violet-500 dark:text-violet-400' },
          { title: 'Create Database', description: 'PostgreSQL, Redis, etc.', icon: Database, gradient: 'from-emerald-500/20 to-emerald-500/5', iconColor: 'text-emerald-500 dark:text-emerald-400' },
          { title: 'Import Project', description: 'From GitHub', icon: GitBranch, gradient: 'from-blue-500/20 to-blue-500/5', iconColor: 'text-blue-500 dark:text-blue-400' },
          { title: 'Quick Deploy', description: 'One-click setup', icon: Zap, gradient: 'from-amber-500/20 to-amber-500/5', iconColor: 'text-amber-500 dark:text-amber-400' },
        ].map((action, index) => (
          <Card 
            key={action.title}
            className="card-hover card-interactive group cursor-pointer overflow-hidden animate-fade-in-up"
            style={{ animationDelay: `${(infrastructureStats.length + index) * 50}ms` }}
          >
            <CardContent className="p-5 flex items-center gap-4">
              <div className={cn(
                "p-3 rounded-xl bg-gradient-to-br transition-all duration-300 group-hover:scale-110",
                action.gradient
              )}>
                <action.icon className={cn("w-5 h-5", action.iconColor)} />
              </div>
              <div>
                <p className="font-semibold text-sm">{action.title}</p>
                <p className="text-xs text-muted-foreground">{action.description}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="card-hover card-elevated">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold">Active Services</CardTitle>
              <CardDescription>All running containers across your infrastructure</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="gap-1.5 text-[10px] font-medium bg-emerald-500/5 border-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                12 Running
              </Badge>
              <Badge variant="outline" className="gap-1.5 text-[10px] font-medium bg-amber-500/5 border-amber-500/20 text-amber-600 dark:text-amber-400">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                2 Building
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2.5 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
            {[
              { name: 'api-gateway', status: 'running', cpu: '12%', memory: '256MB', port: '3000' },
              { name: 'web-frontend', status: 'running', cpu: '8%', memory: '128MB', port: '8080' },
              { name: 'worker-service', status: 'running', cpu: '45%', memory: '512MB', port: '4000' },
              { name: 'redis-cache', status: 'running', cpu: '3%', memory: '64MB', port: '6379' },
              { name: 'postgres-db', status: 'running', cpu: '15%', memory: '1.2GB', port: '5432' },
              { name: 'auth-service', status: 'building', cpu: '-', memory: '-', port: '5000' },
            ].map((service) => (
              <div 
                key={service.name}
                className="flex items-center justify-between p-3.5 rounded-xl bg-muted/30 hover:bg-muted/50 transition-all duration-200 cursor-pointer group"
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-2 h-2 rounded-full",
                    service.status === 'running' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                  )} />
                  <div>
                    <p className="font-medium text-sm">{service.name}</p>
                    <p className="text-[10px] text-muted-foreground font-mono">:{service.port}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <div className="hidden sm:block tabular-nums">
                    <span className={cn("font-medium", service.cpu !== '-' && "text-foreground")}>{service.cpu}</span>
                    <span className="ml-1 opacity-60">CPU</span>
                  </div>
                  <div className="hidden sm:block tabular-nums">
                    <span className={cn("font-medium", service.memory !== '-' && "text-foreground")}>{service.memory}</span>
                    <span className="ml-1 opacity-60">RAM</span>
                  </div>
                  <ArrowUpRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-primary" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
