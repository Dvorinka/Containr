import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { agentsApi } from '@/lib/agents';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Server, 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  Eye, 
  Cpu,
  HardDrive,
  MemoryStick,
  Network,
  Activity,
  Settings,
  RefreshCw,
  Play,
  Square,
  RotateCcw,
  Container
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { NodeAgent, ContainerInstance } from '@/types/agent';

export default function NodeAgentsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<NodeAgent | null>(null);
  const [selectedContainer, setSelectedContainer] = useState<ContainerInstance | null>(null);

  const { data: agents, isLoading, error, refetch } = useQuery({
    queryKey: ['agents'],
    queryFn: () => agentsApi.getAgents().then(res => res.agents),
    refetchInterval: 30000,
  });

  const deleteAgentMutation = useMutation({
    mutationFn: agentsApi.deleteAgent,
    onSuccess: () => {
      refetch();
    },
  });

  const containerActionMutation = useMutation({
    mutationFn: ({ agentId, containerId, action }: { 
      agentId: string; 
      containerId: string; 
      action: 'start' | 'stop' | 'restart' | 'remove' 
    }) => {
      switch (action) {
        case 'start':
          return agentsApi.startContainer(agentId, containerId);
        case 'stop':
          return agentsApi.stopContainer(agentId, containerId);
        case 'restart':
          return agentsApi.restartContainer(agentId, containerId);
        case 'remove':
          return agentsApi.removeContainer(agentId, containerId);
        default:
          throw new Error(`Unknown action: ${action}`);
      }
    },
    onSuccess: () => {
      refetch();
    },
  });

  const filteredAgents = agents?.filter(agent =>
    agent.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    agent.hostname.toLowerCase().includes(searchTerm.toLowerCase()) ||
    agent.ip_address.includes(searchTerm)
  ) || [];

  const getStatusColor = (status: NodeAgent['status']) => {
    switch (status) {
      case 'online': return 'bg-green-500';
      case 'offline': return 'bg-red-500';
      case 'connecting': return 'bg-yellow-500';
      case 'error': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusBadge = (status: NodeAgent['status']) => {
    switch (status) {
      case 'online': return <Badge className="bg-green-100 text-green-800">Online</Badge>;
      case 'offline': return <Badge className="bg-red-100 text-red-800">Offline</Badge>;
      case 'connecting': return <Badge className="bg-yellow-100 text-yellow-800">Connecting</Badge>;
      case 'error': return <Badge className="bg-red-100 text-red-800">Error</Badge>;
      default: return <Badge className="bg-gray-100 text-gray-800">Unknown</Badge>;
    }
  };

  const getContainerStatusBadge = (status: string) => {
    switch (status) {
      case 'running': return <Badge className="bg-green-100 text-green-800">Running</Badge>;
      case 'stopped': return <Badge className="bg-gray-100 text-gray-800">Stopped</Badge>;
      case 'paused': return <Badge className="bg-yellow-100 text-yellow-800">Paused</Badge>;
      case 'restarting': return <Badge className="bg-blue-100 text-blue-800">Restarting</Badge>;
      default: return <Badge className="bg-gray-100 text-gray-800">{status}</Badge>;
    }
  };

  const formatBytes = (bytes: number) => {
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const handleContainerAction = (agentId: string, containerId: string, action: 'start' | 'stop' | 'restart' | 'remove') => {
    if (action === 'remove' && !confirm('Are you sure you want to remove this container? This action cannot be undone.')) {
      return;
    }
    containerActionMutation.mutate({ agentId, containerId, action });
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="h-64 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <h2 className="text-2xl font-semibold text-gray-900">Error loading node agents</h2>
          <p className="text-gray-600 mt-2">Please check your connection and try again.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Node Agents</h1>
          <p className="text-sm md:text-base text-muted-foreground">
            Manage container orchestration agents across your infrastructure
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => setIsCreateModalOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Agent
          </Button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="Search agents..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Agents Grid */}
      {filteredAgents.length === 0 ? (
        <div className="text-center py-12">
          <div className="mx-auto w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <Server className="w-12 h-12 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {searchTerm ? 'No agents found' : 'No node agents yet'}
          </h3>
          <p className="text-gray-600 mb-4">
            {searchTerm 
              ? 'Try adjusting your search terms' 
              : 'Add your first node agent to start orchestrating containers'
            }
          </p>
          {!searchTerm && (
            <Button onClick={() => setIsCreateModalOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Agent
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
          {filteredAgents.map((agent) => (
            <Card key={agent.id} className="group hover:shadow-lg transition-all duration-200">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <div className={`w-2 h-2 rounded-full ${getStatusColor(agent.status)} animate-pulse`} />
                      <CardTitle className="text-lg font-semibold truncate">
                        {agent.name}
                      </CardTitle>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {agent.hostname} ({agent.ip_address})
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      {getStatusBadge(agent.status)}
                      <Badge variant="outline" className="text-xs">
                        v{agent.version}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setSelectedAgent(agent)}
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => deleteAgentMutation.mutate(agent.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Resource Usage */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-blue-500" />
                    <div className="flex-1">
                      <div className="flex justify-between text-sm mb-1">
                        <span>CPU</span>
                        <span>{agent.resources.cpu.usage.toFixed(1)}%</span>
                      </div>
                      <Progress value={agent.resources.cpu.usage} className="h-2" />
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <MemoryStick className="w-4 h-4 text-green-500" />
                    <div className="flex-1">
                      <div className="flex justify-between text-sm mb-1">
                        <span>Memory</span>
                        <span>{((agent.resources.memory.used / agent.resources.memory.total) * 100).toFixed(1)}%</span>
                      </div>
                      <Progress value={(agent.resources.memory.used / agent.resources.memory.total) * 100} className="h-2" />
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <HardDrive className="w-4 h-4 text-orange-500" />
                    <div className="flex-1">
                      <div className="flex justify-between text-sm mb-1">
                        <span>Storage</span>
                        <span>{((agent.resources.storage.used / agent.resources.storage.total) * 100).toFixed(1)}%</span>
                      </div>
                      <Progress value={(agent.resources.storage.used / agent.resources.storage.total) * 100} className="h-2" />
                    </div>
                  </div>
                </div>

                {/* Agent Info */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="font-medium">{agent.capabilities.max_containers}</div>
                    <div className="text-xs text-muted-foreground">Max Containers</div>
                  </div>
                  <div>
                    <div className="font-medium">{agent.capabilities.container_runtimes.join(', ')}</div>
                    <div className="text-xs text-muted-foreground">Runtimes</div>
                  </div>
                </div>

                {/* Last Heartbeat */}
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <Activity className="w-3 h-3 text-muted-foreground" />
                    <span className="text-muted-foreground">
                      Last seen {formatDistanceToNow(new Date(agent.last_heartbeat), { addSuffix: true })}
                    </span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 pt-2">
                  <Button variant="outline" size="sm" className="flex-1">
                    <Settings className="w-3 h-3 mr-1" />
                    Configure
                  </Button>
                  <Button size="sm" className="flex-1">
                    <Container className="w-3 h-3 mr-1" />
                    Containers
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Agent Detail Modal */}
      {selectedAgent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${getStatusColor(selectedAgent.status)}`} />
                    {selectedAgent.name}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    {selectedAgent.hostname} ({selectedAgent.ip_address}:{selectedAgent.port})
                  </p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setSelectedAgent(null)}>
                  <Eye className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Resources Overview */}
              <div>
                <h3 className="text-lg font-semibold mb-4">Resource Usage</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Cpu className="w-5 h-5 text-blue-500" />
                        <span className="font-medium">CPU</span>
                      </div>
                      <div className="text-2xl font-bold">{selectedAgent.resources.cpu.usage.toFixed(1)}%</div>
                      <div className="text-sm text-muted-foreground">
                        {selectedAgent.resources.cpu.allocation} allocated / {selectedAgent.resources.cpu.cores} cores
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <MemoryStick className="w-5 h-5 text-green-500" />
                        <span className="font-medium">Memory</span>
                      </div>
                      <div className="text-2xl font-bold">{formatBytes(selectedAgent.resources.memory.used)}</div>
                      <div className="text-sm text-muted-foreground">
                        {formatBytes(selectedAgent.resources.memory.allocated)} allocated / {formatBytes(selectedAgent.resources.memory.total)} total
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <HardDrive className="w-5 h-5 text-orange-500" />
                        <span className="font-medium">Storage</span>
                      </div>
                      <div className="text-2xl font-bold">{formatBytes(selectedAgent.resources.storage.used)}</div>
                      <div className="text-sm text-muted-foreground">
                        {formatBytes(selectedAgent.resources.storage.allocated)} allocated / {formatBytes(selectedAgent.resources.storage.total)} total
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* Capabilities */}
              <div>
                <h3 className="text-lg font-semibold mb-4">Capabilities</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium">Container Runtimes</Label>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {selectedAgent.capabilities.container_runtimes.map(runtime => (
                        <Badge key={runtime} variant="secondary">{runtime}</Badge>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Supported Architectures</Label>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {selectedAgent.capabilities.supported_architectures.map(arch => (
                        <Badge key={arch} variant="secondary">{arch}</Badge>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Network Plugins</Label>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {selectedAgent.capabilities.network_plugins.map(plugin => (
                        <Badge key={plugin} variant="secondary">{plugin}</Badge>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Features</Label>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {selectedAgent.capabilities.features.map(feature => (
                        <Badge key={feature} variant="secondary">{feature}</Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Network Interfaces */}
              <div>
                <h3 className="text-lg font-semibold mb-4">Network Interfaces</h3>
                <div className="space-y-2">
                  {selectedAgent.resources.network.interfaces.map(iface => (
                    <Card key={iface.name}>
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Network className="w-4 h-4 text-blue-500" />
                            <span className="font-medium">{iface.name}</span>
                            <Badge variant={iface.status === 'up' ? 'default' : 'secondary'}>
                              {iface.status}
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {iface.ip_address} • {iface.speed} Mbps
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
