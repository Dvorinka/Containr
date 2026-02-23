import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { PageHeader } from '@/components/ui/page-header';
import { 
  Server, 
  Cpu, 
  HardDrive, 
  MemoryStick, 
  Power, 
  PowerOff,
  Trash2,
  RefreshCw,
  Container,
  Monitor,
  Activity
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Node {
  node: string;
  status: string;
  cpu: number;
  mem: number;
  maxmem: number;
  disk: number;
  maxdisk: number;
  uptime: number;
  level: string;
  id: string;
  type: string;
}

interface VM {
  vmid: number;
  name: string;
  status: string;
  cpu: number;
  mem: number;
  maxmem: number;
  disk: number;
  maxdisk: number;
  uptime: number;
  template: boolean;
  node: string;
  type: string;
}

interface ContainerData {
  vmid: number;
  name: string;
  status: string;
  cpu: number;
  mem: number;
  maxmem: number;
  disk: number;
  maxdisk: number;
  uptime: number;
  template: boolean;
  node: string;
  type: string;
}

interface ResourceUsage {
  total_nodes: number;
  online_nodes: number;
  cpu_usage: {
    total: number;
    used: number;
    free: number;
  };
  memory_usage: {
    total: number;
    used: number;
    free: number;
  };
  disk_usage: {
    total: number;
    used: number;
    free: number;
  };
}

export default function Infrastructure() {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [vms, setVMs] = useState<VM[]>([]);
  const [containers, setContainers] = useState<ContainerData[]>([]);
  const [resourceUsage, setResourceUsage] = useState<ResourceUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const nodesResponse = await fetch('/api/proxmox/nodes');
      if (!nodesResponse.ok) throw new Error('Failed to fetch nodes');
      const nodesData = await nodesResponse.json();
      setNodes(nodesData.data || []);

      const vmsResponse = await fetch('/api/proxmox/vms');
      if (!vmsResponse.ok) throw new Error('Failed to fetch VMs');
      const vmsData = await vmsResponse.json();
      setVMs(vmsData.data || []);

      const containersResponse = await fetch('/api/proxmox/containers');
      if (!containersResponse.ok) throw new Error('Failed to fetch containers');
      const containersData = await containersResponse.json();
      setContainers(containersData.data || []);

      const resourcesResponse = await fetch('/api/proxmox/resources/usage');
      if (!resourcesResponse.ok) throw new Error('Failed to fetch resource usage');
      const resourcesData = await resourcesResponse.json();
      setResourceUsage(resourcesData.data || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleInstanceAction = async (type: 'vm' | 'container', vmid: number, action: 'start' | 'stop' | 'delete') => {
    try {
      const endpoint = type === 'vm' ? 'vms' : 'containers';
      const response = await fetch(`/api/proxmox/${endpoint}/${vmid}/${action}`, {
        method: 'POST',
      });
      
      if (!response.ok) throw new Error(`Failed to ${action} ${type}`);
      
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${action} ${type}`);
    }
  };

  const formatBytes = (bytes: number) => {
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { variant: "default" | "secondary" | "destructive" | "outline" | "live" | "error" | "building"; label: string }> = {
      'running': { variant: 'live', label: 'Running' },
      'stopped': { variant: 'secondary', label: 'Stopped' },
      'online': { variant: 'live', label: 'Online' },
      'offline': { variant: 'error', label: 'Offline' },
    };
    
    const cfg = config[status] || { variant: 'secondary' as const, label: status };
    
    return (
      <Badge variant={cfg.variant} className="text-[10px] font-medium">
        {cfg.label}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="p-4 md:p-6 lg:p-8 space-y-8">
        <PageHeader title="Infrastructure" description="Manage your Proxmox cluster" />
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-muted-foreground">Loading infrastructure...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 md:p-6 lg:p-8 space-y-6">
        <PageHeader title="Infrastructure" description="Manage your Proxmox cluster" />
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="py-8 text-center">
            <div className="text-destructive font-medium mb-2">Error: {error}</div>
            <Button onClick={fetchData} variant="outline" size="sm" className="mt-4">
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-8 animate-fade-in">
      <PageHeader 
        title="Infrastructure" 
        description="Manage your Proxmox cluster, virtual machines, and containers"
        action={{
          label: 'Refresh',
          icon: RefreshCw,
          onClick: fetchData,
        }}
      />

      {resourceUsage && (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { 
              title: 'Nodes', 
              value: `${resourceUsage.online_nodes}/${resourceUsage.total_nodes}`, 
              subtitle: 'Online',
              icon: Server, 
              gradient: 'from-violet-500/20 to-violet-500/5',
              iconBg: 'bg-violet-500/10 text-violet-500 dark:text-violet-400'
            },
            { 
              title: 'CPU Usage', 
              value: `${Math.round((resourceUsage.cpu_usage.used / resourceUsage.cpu_usage.total) * 100)}%`, 
              subtitle: 'Across all nodes',
              icon: Cpu, 
              gradient: 'from-blue-500/20 to-blue-500/5',
              iconBg: 'bg-blue-500/10 text-blue-500 dark:text-blue-400',
              progress: (resourceUsage.cpu_usage.used / resourceUsage.cpu_usage.total) * 100
            },
            { 
              title: 'Memory Usage', 
              value: `${Math.round((resourceUsage.memory_usage.used / resourceUsage.memory_usage.total) * 100)}%`, 
              subtitle: formatBytes(resourceUsage.memory_usage.used),
              icon: MemoryStick, 
              gradient: 'from-emerald-500/20 to-emerald-500/5',
              iconBg: 'bg-emerald-500/10 text-emerald-500 dark:text-emerald-400',
              progress: (resourceUsage.memory_usage.used / resourceUsage.memory_usage.total) * 100
            },
            { 
              title: 'Disk Usage', 
              value: `${Math.round((resourceUsage.disk_usage.used / resourceUsage.disk_usage.total) * 100)}%`, 
              subtitle: formatBytes(resourceUsage.disk_usage.used),
              icon: HardDrive, 
              gradient: 'from-amber-500/20 to-amber-500/5',
              iconBg: 'bg-amber-500/10 text-amber-500 dark:text-amber-400',
              progress: (resourceUsage.disk_usage.used / resourceUsage.disk_usage.total) * 100
            },
          ].map((stat, index) => (
            <Card 
              key={stat.title} 
              className={cn(
                "relative overflow-hidden card-hover card-elevated group animate-fade-in-up"
              )}
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className={cn("absolute inset-0 bg-gradient-to-br", stat.gradient)} />
              <CardContent className="relative p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className={cn("p-2 rounded-xl transition-transform group-hover:scale-110", stat.iconBg)}>
                    <stat.icon className="w-4 h-4" />
                  </div>
                  <Activity className="w-4 h-4 text-muted-foreground/50" />
                </div>
                <div className="text-2xl font-bold tracking-tight">{stat.value}</div>
                <div className="text-xs text-muted-foreground mt-1">{stat.subtitle}</div>
                {stat.progress !== undefined && (
                  <Progress value={stat.progress} className="h-1.5 mt-3" />
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Tabs defaultValue="nodes" className="space-y-6">
        <TabsList className="bg-muted/30 p-1">
          <TabsTrigger value="nodes" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Server className="w-4 h-4" />
            <span className="hidden sm:inline">Nodes</span>
          </TabsTrigger>
          <TabsTrigger value="vms" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Monitor className="w-4 h-4" />
            <span className="hidden sm:inline">Virtual Machines</span>
          </TabsTrigger>
          <TabsTrigger value="containers" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Container className="w-4 h-4" />
            <span className="hidden sm:inline">Containers</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="nodes" className="space-y-4 animate-fade-in-up">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {nodes.map((node, index) => (
              <Card key={node.id} className="card-hover card-elevated animate-fade-in-up" style={{ animationDelay: `${index * 50}ms` }}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-semibold">{node.node}</CardTitle>
                    {getStatusBadge(node.status)}
                  </div>
                  <CardDescription>Proxmox Node</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {[
                    { label: 'CPU', value: `${Math.round(node.cpu * 100)}%`, progress: node.cpu * 100, color: 'bg-blue-500' },
                    { label: 'Memory', value: `${formatBytes(node.mem)} / ${formatBytes(node.maxmem)}`, progress: (node.mem / node.maxmem) * 100, color: 'bg-emerald-500' },
                    { label: 'Disk', value: `${formatBytes(node.disk)} / ${formatBytes(node.maxdisk)}`, progress: (node.disk / node.maxdisk) * 100, color: 'bg-amber-500' },
                  ].map((item) => (
                    <div key={item.label} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">{item.label}</span>
                        <span className="font-mono text-foreground">{item.value}</span>
                      </div>
                      <Progress value={item.progress} className="h-1.5" />
                    </div>
                  ))}
                  
                  <div className="flex items-center justify-between text-xs pt-2 border-t border-border/50">
                    <span className="text-muted-foreground">Uptime</span>
                    <span className="font-medium">{formatUptime(node.uptime)}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="vms" className="space-y-4 animate-fade-in-up">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {vms.map((vm, index) => (
              <Card key={vm.vmid} className="card-hover card-elevated animate-fade-in-up" style={{ animationDelay: `${index * 50}ms` }}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-semibold">{vm.name || `VM-${vm.vmid}`}</CardTitle>
                    {getStatusBadge(vm.status)}
                  </div>
                  <CardDescription>ID: {vm.vmid} · Node: {vm.node}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {[
                    { label: 'CPU', value: `${Math.round(vm.cpu * 100)}%`, progress: vm.cpu * 100 },
                    { label: 'Memory', value: `${formatBytes(vm.mem)} / ${formatBytes(vm.maxmem)}`, progress: (vm.mem / vm.maxmem) * 100 },
                    { label: 'Disk', value: `${formatBytes(vm.disk)} / ${formatBytes(vm.maxdisk)}`, progress: (vm.disk / vm.maxdisk) * 100 },
                  ].map((item) => (
                    <div key={item.label} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">{item.label}</span>
                        <span className="font-mono text-foreground">{item.value}</span>
                      </div>
                      <Progress value={item.progress} className="h-1.5" />
                    </div>
                  ))}
                  
                  <div className="flex items-center justify-between text-xs pt-2 border-t border-border/50">
                    <span className="text-muted-foreground">Uptime</span>
                    <span className="font-medium">{formatUptime(vm.uptime)}</span>
                  </div>
                  
                  <div className="flex gap-2 pt-1">
                    {vm.status === 'stopped' ? (
                      <Button 
                        size="sm" 
                        onClick={() => handleInstanceAction('vm', vm.vmid, 'start')}
                        className="flex-1"
                      >
                        <Power className="w-3.5 h-3.5 mr-1.5" />
                        Start
                      </Button>
                    ) : (
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleInstanceAction('vm', vm.vmid, 'stop')}
                        className="flex-1"
                      >
                        <PowerOff className="w-3.5 h-3.5 mr-1.5" />
                        Stop
                      </Button>
                    )}
                    <Button 
                      size="sm" 
                      variant="ghost"
                      onClick={() => handleInstanceAction('vm', vm.vmid, 'delete')}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="containers" className="space-y-4 animate-fade-in-up">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {containers.map((container, index) => (
              <Card key={container.vmid} className="card-hover card-elevated animate-fade-in-up" style={{ animationDelay: `${index * 50}ms` }}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-semibold">{container.name || `CT-${container.vmid}`}</CardTitle>
                    {getStatusBadge(container.status)}
                  </div>
                  <CardDescription>ID: {container.vmid} · Node: {container.node}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {[
                    { label: 'CPU', value: `${Math.round(container.cpu * 100)}%`, progress: container.cpu * 100 },
                    { label: 'Memory', value: `${formatBytes(container.mem)} / ${formatBytes(container.maxmem)}`, progress: (container.mem / container.maxmem) * 100 },
                    { label: 'Disk', value: `${formatBytes(container.disk)} / ${formatBytes(container.maxdisk)}`, progress: (container.disk / container.maxdisk) * 100 },
                  ].map((item) => (
                    <div key={item.label} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">{item.label}</span>
                        <span className="font-mono text-foreground">{item.value}</span>
                      </div>
                      <Progress value={item.progress} className="h-1.5" />
                    </div>
                  ))}
                  
                  <div className="flex items-center justify-between text-xs pt-2 border-t border-border/50">
                    <span className="text-muted-foreground">Uptime</span>
                    <span className="font-medium">{formatUptime(container.uptime)}</span>
                  </div>
                  
                  <div className="flex gap-2 pt-1">
                    {container.status === 'stopped' ? (
                      <Button 
                        size="sm" 
                        onClick={() => handleInstanceAction('container', container.vmid, 'start')}
                        className="flex-1"
                      >
                        <Power className="w-3.5 h-3.5 mr-1.5" />
                        Start
                      </Button>
                    ) : (
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleInstanceAction('container', container.vmid, 'stop')}
                        className="flex-1"
                      >
                        <PowerOff className="w-3.5 h-3.5 mr-1.5" />
                        Stop
                      </Button>
                    )}
                    <Button 
                      size="sm" 
                      variant="ghost"
                      onClick={() => handleInstanceAction('container', container.vmid, 'delete')}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
