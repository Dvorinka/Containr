import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Plus, 
  Settings, 
  TrendingUp, 
  TrendingDown,
  Activity,
  Cpu,
  HardDrive,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Edit,
  Trash2,
  Play,
  Pause,
  Server
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

// Types
interface ScalingPolicy {
  service_id: string;
  min_replicas: number;
  max_replicas: number;
  target_cpu: number;
  target_memory: number;
  scale_up_cooldown: string;
  scale_down_cooldown: string;
  scale_up_step: number;
  scale_down_step: number;
  metrics: string[];
  enabled: boolean;
  cost_optimization?: {
    max_cost_per_hour: number;
    prefer_efficiency: boolean;
    idle_timeout: string;
  };
}

// Mock API functions
const scalingApi = {
  getPolicies: async () => {
    // Mock data
    return {
      policies: [
        {
          service_id: 'web-service',
          min_replicas: 2,
          max_replicas: 10,
          target_cpu: 70,
          target_memory: 80,
          scale_up_cooldown: '3m',
          scale_down_cooldown: '5m',
          scale_up_step: 1,
          scale_down_step: 1,
          metrics: ['cpu', 'memory', 'requests_per_second'],
          enabled: true,
          cost_optimization: {
            max_cost_per_hour: 1.0,
            prefer_efficiency: true,
            idle_timeout: '10m'
          }
        },
        {
          service_id: 'api-service',
          min_replicas: 1,
          max_replicas: 20,
          target_cpu: 60,
          target_memory: 75,
          scale_up_cooldown: '1m',
          scale_down_cooldown: '3m',
          scale_up_step: 2,
          scale_down_step: 1,
          metrics: ['cpu', 'memory', 'requests_per_second', 'error_rate'],
          enabled: true
        }
      ]
    };
  },

  getServiceStates: async () => {
    return {
      services: [
        {
          service_id: 'web-service',
          current_replicas: 3,
          desired_replicas: 3,
          last_scale_action: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
          last_scale_direction: 'up'
        },
        {
          service_id: 'api-service',
          current_replicas: 5,
          desired_replicas: 5,
          last_scale_action: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          last_scale_direction: 'down'
        }
      ]
    };
  },

  getScalingEvents: async () => {
    return {
      events: [
        {
          id: 'evt_1',
          service_id: 'web-service',
          action: 'scale_up',
          from: 2,
          to: 3,
          reason: 'CPU usage (85%) above target (70%)',
          timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
          cost_impact: 0.01
        },
        {
          id: 'evt_2',
          service_id: 'api-service',
          action: 'scale_down',
          from: 7,
          to: 5,
          reason: 'Low request rate (10/s)',
          timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          cost_impact: -0.02
        }
      ]
    };
  },

  getStatus: async () => {
    return {
      status: {
        status: 'active',
        summary: {
          total_services: 2,
          enabled_services: 2,
          total_replicas: 8,
          services_scaling_up: 0,
          services_scaling_down: 0,
          enabled: true,
          check_interval: '30s'
        }
      }
    };
  },

  setPolicy: async (policy: ScalingPolicy) => {
    // Mock implementation
    console.log('Setting policy:', policy);
    return { message: 'Policy updated successfully', policy };
  },

  enableAutoScaler: async () => {
    return { message: 'Auto-scaler enabled', enabled: true };
  },

  disableAutoScaler: async () => {
    return { message: 'Auto-scaler disabled', enabled: false };
  }
};

export default function ScalingPage() {
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [isPolicyModalOpen, setIsPolicyModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    min_replicas: 1,
    max_replicas: 10,
    target_cpu: 70,
    target_memory: 80,
    scale_up_cooldown: '3m',
    scale_down_cooldown: '5m',
    scale_up_step: 1,
    scale_down_step: 1,
    enabled: true
  });

  const queryClient = useQueryClient();

  const { data: policiesData, isLoading: policiesLoading } = useQuery({
    queryKey: ['scaling-policies'],
    queryFn: scalingApi.getPolicies,
  });

  const { data: servicesData, isLoading: servicesLoading } = useQuery({
    queryKey: ['scaling-services'],
    queryFn: scalingApi.getServiceStates,
  });

  const { data: eventsData, isLoading: eventsLoading } = useQuery({
    queryKey: ['scaling-events'],
    queryFn: scalingApi.getScalingEvents,
  });

  const { data: statusData, isLoading: statusLoading } = useQuery({
    queryKey: ['scaling-status'],
    queryFn: scalingApi.getStatus,
  });

  const setPolicyMutation = useMutation({
    mutationFn: scalingApi.setPolicy,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scaling-policies'] });
      setIsPolicyModalOpen(false);
    },
  });

  const enableAutoScalerMutation = useMutation({
    mutationFn: scalingApi.enableAutoScaler,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scaling-status'] });
    },
  });

  const disableAutoScalerMutation = useMutation({
    mutationFn: scalingApi.disableAutoScaler,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scaling-status'] });
    },
  });

  const policies = policiesData?.policies || [];
  const services = servicesData?.services || [];
  const events = eventsData?.events || [];
  const status = statusData?.status;

  const handleSetPolicy = () => {
    if (selectedService) {
      setPolicyMutation.mutate({
        service_id: selectedService,
        ...formData,
        metrics: ['cpu', 'memory', 'requests_per_second'] // Default metrics
      });
    }
  };

  const openPolicyModal = (serviceId?: string) => {
    if (serviceId) {
      const policy = policies.find(p => p.service_id === serviceId);
      if (policy) {
        setFormData({
          min_replicas: policy.min_replicas,
          max_replicas: policy.max_replicas,
          target_cpu: policy.target_cpu,
          target_memory: policy.target_memory,
          scale_up_cooldown: policy.scale_up_cooldown,
          scale_down_cooldown: policy.scale_down_cooldown,
          scale_up_step: policy.scale_up_step,
          scale_down_step: policy.scale_down_step,
          enabled: policy.enabled
        });
      }
    }
    setSelectedService(serviceId || null);
    setIsPolicyModalOpen(true);
  };

  const getStatusColor = (enabled: boolean) => {
    return enabled ? 'text-green-600' : 'text-red-600';
  };

  const getStatusIcon = (enabled: boolean) => {
    return enabled ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />;
  };

  const getActionIcon = (action: string) => {
    return action === 'scale_up' ? <TrendingUp className="w-4 h-4 text-green-500" /> : <TrendingDown className="w-4 h-4 text-red-500" />;
  };

  if (policiesLoading || servicesLoading || eventsLoading || statusLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="h-32 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Auto-Scaling</h1>
          <p className="text-sm md:text-base text-muted-foreground">
            Manage automatic scaling policies for your services
          </p>
        </div>
        <div className="flex gap-2">
          {status?.summary?.enabled ? (
            <Button 
              variant="outline"
              onClick={() => disableAutoScalerMutation.mutate()}
              disabled={disableAutoScalerMutation.isPending}
            >
              <Pause className="w-4 h-4 mr-2" />
              Disable
            </Button>
          ) : (
            <Button 
              onClick={() => enableAutoScalerMutation.mutate()}
              disabled={enableAutoScalerMutation.isPending}
            >
              <Play className="w-4 h-4 mr-2" />
              Enable
            </Button>
          )}
          <Button onClick={() => openPolicyModal()}>
            <Plus className="w-4 h-4 mr-2" />
            New Policy
          </Button>
        </div>
      </div>

      {/* Status Overview */}
      {status && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-blue-500" />
                <div>
                  <div className="text-2xl font-bold">{status.summary.total_services}</div>
                  <div className="text-sm text-muted-foreground">Total Services</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-500" />
                <div>
                  <div className="text-2xl font-bold">{status.summary.enabled_services}</div>
                  <div className="text-sm text-muted-foreground">Enabled Services</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Server className="w-5 h-5 text-purple-500" />
                <div>
                  <div className="text-2xl font-bold">{status.summary.total_replicas}</div>
                  <div className="text-sm text-muted-foreground">Total Replicas</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                {getStatusIcon(status.summary.enabled)}
                <div>
                  <div className={`text-2xl font-bold ${getStatusColor(status.summary.enabled)}`}>
                    {status.summary.enabled ? 'Active' : 'Inactive'}
                  </div>
                  <div className="text-sm text-muted-foreground">Auto-Scaler Status</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content */}
      <Tabs defaultValue="policies" className="space-y-4">
        <TabsList>
          <TabsTrigger value="policies">Policies</TabsTrigger>
          <TabsTrigger value="services">Services</TabsTrigger>
          <TabsTrigger value="events">Events</TabsTrigger>
        </TabsList>

        <TabsContent value="policies" className="space-y-4">
          <div className="grid gap-4">
            {policies.map((policy) => (
              <Card key={policy.service_id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">{policy.service_id}</CardTitle>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant={policy.enabled ? 'default' : 'secondary'}>
                          {policy.enabled ? 'Enabled' : 'Disabled'}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {policy.min_replicas}-{policy.max_replicas} replicas
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="icon" onClick={() => openPolicyModal(policy.service_id)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <div className="flex items-center gap-2">
                      <Cpu className="w-4 h-4 text-blue-500" />
                      <div>
                        <div className="text-sm font-medium">Target CPU</div>
                        <div className="text-lg font-bold">{policy.target_cpu}%</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <HardDrive className="w-4 h-4 text-green-500" />
                      <div>
                        <div className="text-sm font-medium">Target Memory</div>
                        <div className="text-lg font-bold">{policy.target_memory}%</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-purple-500" />
                      <div>
                        <div className="text-sm font-medium">Scale Up</div>
                        <div className="text-lg font-bold">+{policy.scale_up_step} ({policy.scale_up_cooldown})</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <TrendingDown className="w-4 h-4 text-orange-500" />
                      <div>
                        <div className="text-sm font-medium">Scale Down</div>
                        <div className="text-lg font-bold">-{policy.scale_down_step} ({policy.scale_down_cooldown})</div>
                      </div>
                    </div>
                  </div>
                  
                  {policy.metrics && (
                    <div>
                      <div className="text-sm font-medium mb-2">Metrics</div>
                      <div className="flex flex-wrap gap-1">
                        {policy.metrics.map((metric) => (
                          <Badge key={metric} variant="outline" className="text-xs">
                            {metric}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="services" className="space-y-4">
          <div className="grid gap-4">
            {services.map((service) => (
              <Card key={service.service_id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">{service.service_id}</CardTitle>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-sm text-muted-foreground">
                          {service.current_replicas} replicas
                        </span>
                        {service.last_scale_direction && (
                          <div className="flex items-center gap-1">
                            {getActionIcon(service.last_scale_direction)}
                            <span className="text-sm text-muted-foreground">
                              {formatDistanceToNow(new Date(service.last_scale_action), { addSuffix: true })}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    <Button variant="outline" onClick={() => openPolicyModal(service.service_id)}>
                      <Settings className="w-4 h-4 mr-2" />
                      Configure
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">Current:</span>
                      <span className="text-lg font-bold">{service.current_replicas}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">Desired:</span>
                      <span className="text-lg font-bold">{service.desired_replicas}</span>
                    </div>
                    {service.current_replicas !== service.desired_replicas && (
                      <Badge variant="outline" className="text-orange-600">
                        <AlertTriangle className="w-3 h-3 mr-1" />
                        Scaling in progress
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="events" className="space-y-4">
          <div className="space-y-2">
            {events.map((event) => (
              <Card key={event.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {getActionIcon(event.action)}
                      <div>
                        <div className="font-medium">{event.service_id}</div>
                        <div className="text-sm text-muted-foreground">{event.reason}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">
                        {event.from} → {event.to} replicas
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {formatDistanceToNow(new Date(event.timestamp), { addSuffix: true })}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Policy Modal */}
      {isPolicyModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle>
                {selectedService ? 'Edit Scaling Policy' : 'Create Scaling Policy'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {selectedService && (
                <div>
                  <Label>Service</Label>
                  <Input value={selectedService} disabled className="mt-1" />
                </div>
              )}
              
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="min-replicas">Min Replicas</Label>
                  <Input
                    id="min-replicas"
                    type="number"
                    min="1"
                    value={formData.min_replicas}
                    onChange={(e) => setFormData({ ...formData, min_replicas: parseInt(e.target.value) })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="max-replicas">Max Replicas</Label>
                  <Input
                    id="max-replicas"
                    type="number"
                    min="1"
                    value={formData.max_replicas}
                    onChange={(e) => setFormData({ ...formData, max_replicas: parseInt(e.target.value) })}
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="target-cpu">Target CPU (%)</Label>
                  <Input
                    id="target-cpu"
                    type="number"
                    min="1"
                    max="100"
                    value={formData.target_cpu}
                    onChange={(e) => setFormData({ ...formData, target_cpu: parseInt(e.target.value) })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="target-memory">Target Memory (%)</Label>
                  <Input
                    id="target-memory"
                    type="number"
                    min="1"
                    max="100"
                    value={formData.target_memory}
                    onChange={(e) => setFormData({ ...formData, target_memory: parseInt(e.target.value) })}
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="scale-up-step">Scale Up Step</Label>
                  <Input
                    id="scale-up-step"
                    type="number"
                    min="1"
                    value={formData.scale_up_step}
                    onChange={(e) => setFormData({ ...formData, scale_up_step: parseInt(e.target.value) })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="scale-down-step">Scale Down Step</Label>
                  <Input
                    id="scale-down-step"
                    type="number"
                    min="1"
                    value={formData.scale_down_step}
                    onChange={(e) => setFormData({ ...formData, scale_down_step: parseInt(e.target.value) })}
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="scale-up-cooldown">Scale Up Cooldown</Label>
                  <Input
                    id="scale-up-cooldown"
                    value={formData.scale_up_cooldown}
                    onChange={(e) => setFormData({ ...formData, scale_up_cooldown: e.target.value })}
                    placeholder="3m"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="scale-down-cooldown">Scale Down Cooldown</Label>
                  <Input
                    id="scale-down-cooldown"
                    value={formData.scale_down_cooldown}
                    onChange={(e) => setFormData({ ...formData, scale_down_cooldown: e.target.value })}
                    placeholder="5m"
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="enabled"
                  checked={formData.enabled}
                  onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                />
                <Label htmlFor="enabled">Enable this policy</Label>
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsPolicyModalOpen(false);
                    setSelectedService(null);
                  }}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSetPolicy}
                  disabled={setPolicyMutation.isPending}
                  className="flex-1"
                >
                  {setPolicyMutation.isPending ? 'Saving...' : 'Save Policy'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
