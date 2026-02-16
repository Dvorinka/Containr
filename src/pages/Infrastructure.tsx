import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { 
  Server, 
  Cpu, 
  HardDrive, 
  MemoryStick, 
  Power, 
  PowerOff,
  Trash2,
  RefreshCw
} from 'lucide-react';

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

interface Container {
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
  const [containers, setContainers] = useState<Container[]>([]);
  const [resourceUsage, setResourceUsage] = useState<ResourceUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Fetch nodes
      const nodesResponse = await fetch('/api/proxmox/nodes');
      if (!nodesResponse.ok) throw new Error('Failed to fetch nodes');
      const nodesData = await nodesResponse.json();
      setNodes(nodesData.data || []);

      // Fetch VMs
      const vmsResponse = await fetch('/api/proxmox/vms');
      if (!vmsResponse.ok) throw new Error('Failed to fetch VMs');
      const vmsData = await vmsResponse.json();
      setVMs(vmsData.data || []);

      // Fetch containers
      const containersResponse = await fetch('/api/proxmox/containers');
      if (!containersResponse.ok) throw new Error('Failed to fetch containers');
      const containersData = await containersResponse.json();
      setContainers(containersData.data || []);

      // Fetch resource usage
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
      
      // Refresh data after action
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
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      'running': 'default',
      'stopped': 'secondary',
      'online': 'default',
      'offline': 'destructive',
    };
    
    return (
      <Badge variant={variants[status] || 'secondary'}>
        {status}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Infrastructure</h1>
          <Button onClick={fetchData} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="text-red-600">Error: {error}</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Infrastructure</h1>
          <p className="text-muted-foreground">
            Manage your Proxmox cluster, virtual machines, and containers
          </p>
        </div>
        <Button onClick={fetchData} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Resource Overview */}
      {resourceUsage && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Nodes</CardTitle>
              <Server className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{resourceUsage.online_nodes}/{resourceUsage.total_nodes}</div>
              <p className="text-xs text-muted-foreground">Online nodes</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">CPU Usage</CardTitle>
              <Cpu className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{Math.round((resourceUsage.cpu_usage.used / resourceUsage.cpu_usage.total) * 100)}%</div>
              <Progress value={(resourceUsage.cpu_usage.used / resourceUsage.cpu_usage.total) * 100} className="mt-2" />
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Memory Usage</CardTitle>
              <MemoryStick className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{Math.round((resourceUsage.memory_usage.used / resourceUsage.memory_usage.total) * 100)}%</div>
              <Progress value={(resourceUsage.memory_usage.used / resourceUsage.memory_usage.total) * 100} className="mt-2" />
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Disk Usage</CardTitle>
              <HardDrive className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{Math.round((resourceUsage.disk_usage.used / resourceUsage.disk_usage.total) * 100)}%</div>
              <Progress value={(resourceUsage.disk_usage.used / resourceUsage.disk_usage.total) * 100} className="mt-2" />
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="nodes" className="space-y-4">
        <TabsList>
          <TabsTrigger value="nodes">Nodes</TabsTrigger>
          <TabsTrigger value="vms">Virtual Machines</TabsTrigger>
          <TabsTrigger value="containers">Containers</TabsTrigger>
        </TabsList>

        <TabsContent value="nodes" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {nodes.map((node) => (
              <Card key={node.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{node.node}</CardTitle>
                    {getStatusBadge(node.status)}
                  </div>
                  <CardDescription>Proxmox Node</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span>CPU</span>
                    <span>{Math.round(node.cpu * 100)}%</span>
                  </div>
                  <Progress value={node.cpu * 100} />
                  
                  <div className="flex items-center justify-between text-sm">
                    <span>Memory</span>
                    <span>{formatBytes(node.mem)} / {formatBytes(node.maxmem)}</span>
                  </div>
                  <Progress value={(node.mem / node.maxmem) * 100} />
                  
                  <div className="flex items-center justify-between text-sm">
                    <span>Disk</span>
                    <span>{formatBytes(node.disk)} / {formatBytes(node.maxdisk)}</span>
                  </div>
                  <Progress value={(node.disk / node.maxdisk) * 100} />
                  
                  <div className="flex items-center justify-between text-sm">
                    <span>Uptime</span>
                    <span>{formatUptime(node.uptime)}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="vms" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {vms.map((vm) => (
              <Card key={vm.vmid}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{vm.name || `VM-${vm.vmid}`}</CardTitle>
                    {getStatusBadge(vm.status)}
                  </div>
                  <CardDescription>ID: {vm.vmid} • Node: {vm.node}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span>CPU</span>
                    <span>{Math.round(vm.cpu * 100)}%</span>
                  </div>
                  <Progress value={vm.cpu * 100} />
                  
                  <div className="flex items-center justify-between text-sm">
                    <span>Memory</span>
                    <span>{formatBytes(vm.mem)} / {formatBytes(vm.maxmem)}</span>
                  </div>
                  <Progress value={(vm.mem / vm.maxmem) * 100} />
                  
                  <div className="flex items-center justify-between text-sm">
                    <span>Disk</span>
                    <span>{formatBytes(vm.disk)} / {formatBytes(vm.maxdisk)}</span>
                  </div>
                  <Progress value={(vm.disk / vm.maxdisk) * 100} />
                  
                  <div className="flex items-center justify-between text-sm">
                    <span>Uptime</span>
                    <span>{formatUptime(vm.uptime)}</span>
                  </div>
                  
                  <div className="flex gap-2 pt-2">
                    {vm.status === 'stopped' ? (
                      <Button 
                        size="sm" 
                        onClick={() => handleInstanceAction('vm', vm.vmid, 'start')}
                      >
                        <Power className="h-4 w-4 mr-1" />
                        Start
                      </Button>
                    ) : (
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleInstanceAction('vm', vm.vmid, 'stop')}
                      >
                        <PowerOff className="h-4 w-4 mr-1" />
                        Stop
                      </Button>
                    )}
                    <Button 
                      size="sm" 
                      variant="destructive"
                      onClick={() => handleInstanceAction('vm', vm.vmid, 'delete')}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="containers" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {containers.map((container) => (
              <Card key={container.vmid}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{container.name || `CT-${container.vmid}`}</CardTitle>
                    {getStatusBadge(container.status)}
                  </div>
                  <CardDescription>ID: {container.vmid} • Node: {container.node}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span>CPU</span>
                    <span>{Math.round(container.cpu * 100)}%</span>
                  </div>
                  <Progress value={container.cpu * 100} />
                  
                  <div className="flex items-center justify-between text-sm">
                    <span>Memory</span>
                    <span>{formatBytes(container.mem)} / {formatBytes(container.maxmem)}</span>
                  </div>
                  <Progress value={(container.mem / container.maxmem) * 100} />
                  
                  <div className="flex items-center justify-between text-sm">
                    <span>Disk</span>
                    <span>{formatBytes(container.disk)} / {formatBytes(container.maxdisk)}</span>
                  </div>
                  <Progress value={(container.disk / container.maxdisk) * 100} />
                  
                  <div className="flex items-center justify-between text-sm">
                    <span>Uptime</span>
                    <span>{formatUptime(container.uptime)}</span>
                  </div>
                  
                  <div className="flex gap-2 pt-2">
                    {container.status === 'stopped' ? (
                      <Button 
                        size="sm" 
                        onClick={() => handleInstanceAction('container', container.vmid, 'start')}
                      >
                        <Power className="h-4 w-4 mr-1" />
                        Start
                      </Button>
                    ) : (
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleInstanceAction('container', container.vmid, 'stop')}
                      >
                        <PowerOff className="h-4 w-4 mr-1" />
                        Stop
                      </Button>
                    )}
                    <Button 
                      size="sm" 
                      variant="destructive"
                      onClick={() => handleInstanceAction('container', container.vmid, 'delete')}
                    >
                      <Trash2 className="h-4 w-4" />
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
