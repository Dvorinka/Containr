import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Play,
  RotateCcw,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  ChevronDown,
  Terminal
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { formatDistanceToNow } from 'date-fns';
import { deploymentsApi } from '@/lib/api';

interface Deployment {
  id: string;
  service_id: string;
  commit_hash: string | null;
  status: 'pending' | 'building' | 'deploying' | 'deployed' | 'failed' | 'rolling_back';
  image_name: string;
  image_tag: string;
  build_log: string;
  runtime_log: string;
  error: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

interface DeploymentsPanelProps {
  serviceId: string;
  serviceName: string;
}

interface StatusConfig {
  color: string;
  icon: typeof Clock;
  label: string;
  animate?: boolean;
}

const statusConfig: Record<string, StatusConfig> = {
  pending: { color: 'bg-gray-500', icon: Clock, label: 'Pending' },
  building: { color: 'bg-blue-500', icon: Loader2, label: 'Building', animate: true },
  deploying: { color: 'bg-yellow-500', icon: Loader2, label: 'Deploying', animate: true },
  deployed: { color: 'bg-green-500', icon: CheckCircle, label: 'Deployed' },
  failed: { color: 'bg-red-500', icon: XCircle, label: 'Failed' },
  rolling_back: { color: 'bg-orange-500', icon: RotateCcw, label: 'Rolling Back', animate: true },
};

function _DeploymentsPanel({ serviceId, serviceName: _serviceName }: DeploymentsPanelProps) {
  const [expandedDeployment, setExpandedDeployment] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: deployments, isLoading } = useQuery({
    queryKey: ['deployments', serviceId],
    queryFn: async () => {
      const response = await deploymentsApi.getDeployments(serviceId);
      return response.deployments as Deployment[];
    },
    refetchInterval: 5000,
  });

  const createDeployment = useMutation({
    mutationFn: async (data: { commit_hash?: string; branch?: string }) => {
      const response = await deploymentsApi.createDeployment(serviceId, {
        trigger: 'manual',
        ...data,
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deployments', serviceId] });
    },
  });

  const rollbackDeployment = useMutation({
    mutationFn: async (deploymentId: string) => {
      const response = await deploymentsApi.rollbackDeployment(deploymentId);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deployments', serviceId] });
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Deployments</h3>
        <Button
          onClick={() => createDeployment.mutate({})}
          disabled={createDeployment.isPending}
          size="sm"
        >
          {createDeployment.isPending ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Play className="w-4 h-4 mr-2" />
          )}
          Deploy
        </Button>
      </div>

      {!deployments || deployments.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            No deployments yet. Click "Deploy" to create your first deployment.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {deployments.map((deployment) => {
            const config = statusConfig[deployment.status] || statusConfig.pending;
            const StatusIcon = config.icon;
            const isExpanded = expandedDeployment === deployment.id;

            return (
              <Collapsible
                key={deployment.id}
                open={isExpanded}
                onOpenChange={() => setExpandedDeployment(isExpanded ? null : deployment.id)}
              >
                <Card className={isExpanded ? 'border-primary' : ''}>
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-full ${config.color}`}>
                            <StatusIcon
                              className={`w-4 h-4 text-white ${
                                config.animate ? 'animate-spin' : ''
                              }`}
                            />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">
                                {deployment.commit_hash
                                  ? deployment.commit_hash.slice(0, 7)
                                  : 'Manual Deploy'}
                              </span>
                              <Badge variant="outline" className="text-xs">
                                {config.label}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Clock className="w-3 h-3" />
                              {formatDistanceToNow(new Date(deployment.created_at), {
                                addSuffix: true,
                              })}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {deployment.status === 'deployed' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                rollbackDeployment.mutate(deployment.id);
                              }}
                              disabled={rollbackDeployment.isPending}
                            >
                              <RotateCcw className="w-4 h-4 mr-1" />
                              Rollback
                            </Button>
                          )}
                          <ChevronDown
                            className={`w-4 h-4 transition-transform ${
                              isExpanded ? 'rotate-180' : ''
                            }`}
                          />
                        </div>
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="pt-0 pb-4">
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Image:</span>
                            <span className="ml-2 font-mono">
                              {deployment.image_name}:{deployment.image_tag}
                            </span>
                          </div>
                          {deployment.commit_hash && (
                            <div>
                              <span className="text-muted-foreground">Commit:</span>
                              <span className="ml-2 font-mono">
                                {deployment.commit_hash}
                              </span>
                            </div>
                          )}
                          {deployment.started_at && (
                            <div>
                              <span className="text-muted-foreground">Started:</span>
                              <span className="ml-2">
                                {new Date(deployment.started_at).toLocaleString()}
                              </span>
                            </div>
                          )}
                          {deployment.completed_at && (
                            <div>
                              <span className="text-muted-foreground">Completed:</span>
                              <span className="ml-2">
                                {new Date(deployment.completed_at).toLocaleString()}
                              </span>
                            </div>
                          )}
                        </div>

                        {deployment.error && (
                          <div className="p-3 bg-destructive/10 rounded-md">
                            <p className="text-sm text-destructive font-medium">Error:</p>
                            <p className="text-sm text-destructive/80 mt-1">
                              {deployment.error}
                            </p>
                          </div>
                        )}

                        <DeploymentLogs deploymentId={deployment.id} />
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DeploymentLogs({ deploymentId }: { deploymentId: string }) {
  const [activeTab, setActiveTab] = useState<'build' | 'runtime'>('build');

  const { data: logs, isLoading } = useQuery({
    queryKey: ['deployment-logs', deploymentId],
    queryFn: async () => {
      const response = await deploymentsApi.getDeployment(deploymentId);
      return response.deployment;
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="w-4 h-4 animate-spin" />
      </div>
    );
  }

  const currentLogs = activeTab === 'build' ? logs?.build_log : logs?.runtime_log;

  return (
    <div className="border rounded-md">
      <div className="flex border-b">
        <button
          onClick={() => setActiveTab('build')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'build'
              ? 'border-b-2 border-primary text-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Terminal className="w-4 h-4" />
          Build Logs
        </button>
        <button
          onClick={() => setActiveTab('runtime')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'runtime'
              ? 'border-b-2 border-primary text-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Terminal className="w-4 h-4" />
          Runtime Logs
        </button>
      </div>
      <div className="p-4 bg-muted/30 max-h-64 overflow-auto">
        <pre className="text-xs font-mono whitespace-pre-wrap">
          {currentLogs || 'No logs available'}
        </pre>
      </div>
    </div>
  );
}
