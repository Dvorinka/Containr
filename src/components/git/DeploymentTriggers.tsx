import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { gitApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  GitBranch, 
  Plus, 
  Settings, 
  Trash2, 
  Play, 
  Pause, 
  Rocket, 
  TestTube, 
  Package, 
  Loader2,
  ArrowRight,
  GitCommit
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface DeploymentTrigger {
  id: string;
  webhook_id: string;
  service_id: string;
  branch: string;
  environment: 'production' | 'preview' | 'development';
  auto_deploy: boolean;
  build_command?: string;
  start_command?: string;
  created_at: string;
  service?: {
    name: string;
    type: string;
  };
}

interface DeploymentTriggersProps {
  repositoryId: string;
  repositoryName: string;
  projectId: string;
}

export default function DeploymentTriggers({ repositoryId, repositoryName, projectId }: DeploymentTriggersProps) {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [triggerForm, setTriggerForm] = useState({
    webhook_id: '',
    service_id: '',
    branch: 'main',
    environment: 'preview' as 'production' | 'preview' | 'development',
    auto_deploy: false,
    build_command: '',
    start_command: ''
  });

  const queryClient = useQueryClient();

  // Mock data for triggers - in real implementation, this would come from API
  const { data: triggersData, isLoading } = useQuery({
    queryKey: ['deployment-triggers', repositoryId],
    queryFn: async () => {
      // TODO: Replace with actual API call
      return {
        triggers: [
          {
            id: 'trigger-1',
            webhook_id: 'webhook-1',
            service_id: 'service-1',
            branch: 'main',
            environment: 'production',
            auto_deploy: true,
            build_command: 'npm run build',
            start_command: 'npm start',
            created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
            service: {
              name: 'web-app',
              type: 'web'
            }
          },
          {
            id: 'trigger-2',
            webhook_id: 'webhook-1',
            service_id: 'service-2',
            branch: 'develop',
            environment: 'preview',
            auto_deploy: true,
            build_command: 'npm run build',
            start_command: 'npm start',
            created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
            service: {
              name: 'api-server',
              type: 'api'
            }
          }
        ] as DeploymentTrigger[]
      };
    },
  });

  // Mock services data - in real implementation, this would come from servicesApi
  const { data: servicesData } = useQuery({
    queryKey: ['services', projectId],
    queryFn: async () => {
      // TODO: Replace with actual API call
      return {
        services: [
          { id: 'service-1', name: 'web-app', type: 'web' },
          { id: 'service-2', name: 'api-server', type: 'api' },
          { id: 'service-3', name: 'worker', type: 'worker' }
        ]
      };
    },
  });

  // Mock webhooks data - in real implementation, this would come from gitApi
  const { data: webhooksData } = useQuery({
    queryKey: ['webhooks', repositoryId],
    queryFn: async () => {
      // TODO: Replace with actual API call
      return {
        webhooks: [
          { id: 'webhook-1', events: ['push'], active: true }
        ]
      };
    },
  });

  const createTriggerMutation = useMutation({
    mutationFn: async (data: typeof triggerForm) => {
      // TODO: Replace with actual API call
      return { id: 'new-trigger', ...data };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deployment-triggers', repositoryId] });
      setIsCreateModalOpen(false);
      setTriggerForm({
        webhook_id: '',
        service_id: '',
        branch: 'main',
        environment: 'preview',
        auto_deploy: false,
        build_command: '',
        start_command: ''
      });
    },
  });

  const triggers = triggersData?.triggers || [];
  const services = servicesData?.services || [];
  const webhooks = webhooksData?.webhooks || [];

  const handleCreateTrigger = () => {
    createTriggerMutation.mutate(triggerForm);
  };

  const getEnvironmentIcon = (environment: string) => {
    switch (environment) {
      case 'production':
        return <Rocket className="w-4 h-4 text-red-500" />;
      case 'preview':
        return <TestTube className="w-4 h-4 text-blue-500" />;
      case 'development':
        return <Package className="w-4 h-4 text-gray-500" />;
      default:
        return <Package className="w-4 h-4" />;
    }
  };

  const getEnvironmentColor = (environment: string) => {
    switch (environment) {
      case 'production':
        return 'bg-red-100 text-red-800';
      case 'preview':
        return 'bg-blue-100 text-blue-800';
      case 'development':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            {[1, 2].map(i => (
              <div key={i} className="h-32 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Deployment Triggers</h3>
          <p className="text-sm text-muted-foreground">
            Configure branch-based deployment triggers for your services
          </p>
        </div>
        <Button onClick={() => setIsCreateModalOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Create Trigger
        </Button>
      </div>

      {/* Triggers List */}
      {triggers.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <GitBranch className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No deployment triggers configured</h3>
            <p className="text-gray-600 text-center mb-4">
              Create triggers to automatically deploy your services when code is pushed to specific branches
            </p>
            <Button onClick={() => setIsCreateModalOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create Trigger
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {triggers.map((trigger) => (
            <Card key={trigger.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      trigger.auto_deploy ? 'bg-green-100' : 'bg-gray-100'
                    }`}>
                      {trigger.auto_deploy ? (
                        <Play className="w-4 h-4 text-green-600" />
                      ) : (
                        <Pause className="w-4 h-4 text-gray-600" />
                      )}
                    </div>
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        <GitBranch className="w-4 h-4" />
                        {trigger.branch}
                        <ArrowRight className="w-3 h-3 text-muted-foreground" />
                        {trigger.service?.name}
                      </CardTitle>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>{formatDistanceToNow(new Date(trigger.created_at), { addSuffix: true })}</span>
                        <span>•</span>
                        <span>Trigger ID: {trigger.id.substring(0, 8)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={getEnvironmentColor(trigger.environment)}>
                      {getEnvironmentIcon(trigger.environment)}
                      {trigger.environment}
                    </Badge>
                    <Badge variant={trigger.auto_deploy ? 'default' : 'secondary'}>
                      {trigger.auto_deploy ? 'Auto Deploy' : 'Manual'}
                    </Badge>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <Settings className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Service Info */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <Label className="text-xs font-medium">Service</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="font-medium">{trigger.service?.name}</span>
                      <Badge variant="outline" className="text-xs">
                        {trigger.service?.type}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs font-medium">Branch</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <GitBranch className="w-3 h-3" />
                      <code className="text-sm bg-muted px-2 py-1 rounded">
                        {trigger.branch}
                      </code>
                    </div>
                  </div>
                </div>

                {/* Commands */}
                {(trigger.build_command || trigger.start_command) && (
                  <div>
                    <Label className="text-xs font-medium">Commands</Label>
                    <div className="space-y-1 mt-1">
                      {trigger.build_command && (
                        <div className="text-xs">
                          <span className="font-medium">Build:</span> 
                          <code className="ml-1 bg-muted px-1 py-0.5 rounded">
                            {trigger.build_command}
                          </code>
                        </div>
                      )}
                      {trigger.start_command && (
                        <div className="text-xs">
                          <span className="font-medium">Start:</span> 
                          <code className="ml-1 bg-muted px-1 py-0.5 rounded">
                            {trigger.start_command}
                          </code>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Deployment Flow */}
                <div className="bg-muted p-3 rounded-lg">
                  <div className="flex items-center gap-2 text-sm">
                    <GitCommit className="w-4 h-4" />
                    <span>Push to {trigger.branch}</span>
                    <ArrowRight className="w-3 h-3" />
                    <span>Trigger webhook</span>
                    <ArrowRight className="w-3 h-3" />
                    <span>Deploy to {trigger.environment}</span>
                    {trigger.auto_deploy ? (
                      <>
                        <ArrowRight className="w-3 h-3" />
                        <span className="text-green-600">Auto deploy</span>
                      </>
                    ) : (
                      <>
                        <ArrowRight className="w-3 h-3" />
                        <span className="text-orange-600">Manual approval</span>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Trigger Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Create Deployment Trigger</CardTitle>
              <p className="text-sm text-muted-foreground">
                for {repositoryName}
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="webhook">Webhook</Label>
                <select
                  id="webhook"
                  value={triggerForm.webhook_id}
                  onChange={(e) => setTriggerForm({ ...triggerForm, webhook_id: e.target.value })}
                  className="mt-1 w-full p-2 border rounded-md"
                >
                  <option value="">Select webhook</option>
                  {webhooks.map((webhook) => (
                    <option key={webhook.id} value={webhook.id}>
                      Webhook {webhook.id.substring(0, 8)} ({webhook.events.join(', ')})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label htmlFor="service">Service</Label>
                <select
                  id="service"
                  value={triggerForm.service_id}
                  onChange={(e) => setTriggerForm({ ...triggerForm, service_id: e.target.value })}
                  className="mt-1 w-full p-2 border rounded-md"
                >
                  <option value="">Select service</option>
                  {services.map((service) => (
                    <option key={service.id} value={service.id}>
                      {service.name} ({service.type})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label htmlFor="branch">Branch</Label>
                <Input
                  id="branch"
                  value={triggerForm.branch}
                  onChange={(e) => setTriggerForm({ ...triggerForm, branch: e.target.value })}
                  placeholder="main"
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="environment">Environment</Label>
                <select
                  id="environment"
                  value={triggerForm.environment}
                  onChange={(e) => setTriggerForm({ ...triggerForm, environment: e.target.value as any })}
                  className="mt-1 w-full p-2 border rounded-md"
                >
                  <option value="development">Development</option>
                  <option value="preview">Preview</option>
                  <option value="production">Production</option>
                </select>
              </div>

              <div>
                <Label htmlFor="build-command">Build Command (Optional)</Label>
                <Input
                  id="build-command"
                  value={triggerForm.build_command}
                  onChange={(e) => setTriggerForm({ ...triggerForm, build_command: e.target.value })}
                  placeholder="npm run build"
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="start-command">Start Command (Optional)</Label>
                <Input
                  id="start-command"
                  value={triggerForm.start_command}
                  onChange={(e) => setTriggerForm({ ...triggerForm, start_command: e.target.value })}
                  placeholder="npm start"
                  className="mt-1"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="auto-deploy"
                  checked={triggerForm.auto_deploy}
                  onChange={(e) => setTriggerForm({ ...triggerForm, auto_deploy: e.target.checked })}
                  className="rounded"
                />
                <Label htmlFor="auto-deploy">Auto-deploy on push</Label>
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsCreateModalOpen(false);
                    setTriggerForm({
                      webhook_id: '',
                      service_id: '',
                      branch: 'main',
                      environment: 'preview',
                      auto_deploy: false,
                      build_command: '',
                      start_command: ''
                    });
                  }}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateTrigger}
                  disabled={!triggerForm.webhook_id || !triggerForm.service_id || !triggerForm.branch || createTriggerMutation.isPending}
                  className="flex-1"
                >
                  {createTriggerMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create Trigger'
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
