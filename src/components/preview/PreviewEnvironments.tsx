import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectsApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  TestTube, 
  Plus, 
  ExternalLink, 
  Trash2, 
  RefreshCw, 
  Clock,
  GitBranch,
  Package,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Loader2,
  ArrowRight,
  Calendar,
  Settings
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface PreviewEnvironmentsProps {
  projectId: string;
}

export default function PreviewEnvironments({ projectId }: PreviewEnvironmentsProps) {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    service_id: '',
    branch_name: '',
    pr_number: '',
    ttl_hours: 24
  });

  const queryClient = useQueryClient();

  const { data: environmentsData, isLoading } = useQuery({
    queryKey: ['preview-environments', projectId],
    queryFn: () => projectsApi.getPreviewEnvironments(projectId),
  });

  const { data: servicesData } = useQuery({
    queryKey: ['services', projectId],
    queryFn: () => projectsApi.getServices(projectId),
  });

  const createEnvironmentMutation = useMutation({
    mutationFn: (data: any) => projectsApi.createPreviewEnvironment(projectId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['preview-environments', projectId] });
      setIsCreateModalOpen(false);
      setFormData({ service_id: '', branch_name: '', pr_number: '', ttl_hours: 24 });
    },
  });

  const deleteEnvironmentMutation = useMutation({
    mutationFn: (id: string) => projectsApi.deletePreviewEnvironment(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['preview-environments', projectId] });
    },
  });

  const promoteEnvironmentMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => 
      projectsApi.promotePreviewEnvironment(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['preview-environments', projectId] });
    },
  });

  const environments = environmentsData?.preview_environments || [];
  const services = servicesData?.services || [];

  const handleCreateEnvironment = () => {
    const data = {
      ...formData,
      pr_number: formData.pr_number ? parseInt(formData.pr_number) : undefined,
    };
    createEnvironmentMutation.mutate(data);
  };

  const handleDeleteEnvironment = (id: string) => {
    if (confirm('Are you sure you want to delete this preview environment?')) {
      deleteEnvironmentMutation.mutate(id);
    }
  };

  const handlePromoteEnvironment = (id: string, targetEnvironment: string) => {
    promoteEnvironmentMutation.mutate({
      id,
      data: {
        target_environment: targetEnvironment,
        create_backup: true,
      },
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'building':
        return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />;
      case 'running':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'stopped':
        return <Package className="w-4 h-4 text-gray-500" />;
      case 'expired':
        return <AlertTriangle className="w-4 h-4 text-orange-500" />;
      default:
        return <Package className="w-4 h-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'building':
        return 'bg-blue-100 text-blue-800';
      case 'running':
        return 'bg-green-100 text-green-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'stopped':
        return 'bg-gray-100 text-gray-800';
      case 'expired':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const isExpired = (expiresAt: string) => {
    return new Date(expiresAt) < new Date();
  };

  const getTimeRemaining = (expiresAt: string) => {
    const now = new Date();
    const expires = new Date(expiresAt);
    const diff = expires.getTime() - now.getTime();
    
    if (diff <= 0) return 'Expired';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    
    if (days > 0) {
      return `${days}d ${remainingHours}h remaining`;
    }
    return `${hours}h remaining`;
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-40 bg-gray-200 rounded-lg"></div>
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
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <TestTube className="w-5 h-5 text-blue-500" />
            Preview Environments
          </h3>
          <p className="text-sm text-muted-foreground">
            Automatic preview environments for your branches
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Cleanup Expired
          </Button>
          <Button onClick={() => setIsCreateModalOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Create Preview
          </Button>
        </div>
      </div>

      {/* Environments List */}
      {environments.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-4">
              <TestTube className="w-8 h-8 text-blue-500" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No preview environments</h3>
            <p className="text-gray-600 text-center mb-4">
              Create preview environments to test your branches before deploying to production
            </p>
            <Button onClick={() => setIsCreateModalOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create Preview Environment
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {environments.map((env: any) => (
            <Card key={env.id} className={`border-l-4 ${
              isExpired(env.expires_at) ? 'border-l-orange-500' : 
              env.status === 'running' ? 'border-l-green-500' : 
              env.status === 'building' ? 'border-l-blue-500' : 'border-l-red-500'
            }`}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(env.status)}
                      <div>
                        <CardTitle className="text-base">{env.environment}</CardTitle>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <GitBranch className="w-3 h-3" />
                          <span>{env.branch_name}</span>
                          {env.pr_number && (
                            <>
                              <span>•</span>
                              <span>PR #{env.pr_number}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={getStatusColor(env.status)}>
                      {env.status}
                    </Badge>
                    {isExpired(env.expires_at) && (
                      <Badge variant="outline" className="text-orange-600">
                        <AlertTriangle className="w-3 h-3 mr-1" />
                        Expired
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Service Info */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <Label className="text-xs font-medium">Service</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="font-medium">{env.service?.name}</span>
                      <Badge variant="outline" className="text-xs">
                        {env.service?.type}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs font-medium">Time Remaining</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <Clock className="w-3 h-3" />
                      <span className={isExpired(env.expires_at) ? 'text-orange-600' : ''}>
                        {getTimeRemaining(env.expires_at)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* URL */}
                {env.url && env.status === 'running' && (
                  <div>
                    <Label className="text-xs font-medium">Preview URL</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <a 
                        href={env.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 flex items-center gap-1"
                      >
                        <ExternalLink className="w-3 h-3" />
                        {env.url}
                      </a>
                    </div>
                  </div>
                )}

                {/* Timeline */}
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    <span>Created {formatDistanceToNow(new Date(env.created_at), { addSuffix: true })}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>Updated {formatDistanceToNow(new Date(env.updated_at), { addSuffix: true })}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between pt-2 border-t">
                  <div className="flex gap-2">
                    {env.status === 'running' && (
                      <>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handlePromoteEnvironment(env.id, 'production')}
                          disabled={promoteEnvironmentMutation.isPending}
                        >
                          <ArrowRight className="w-3 h-3 mr-1" />
                          Promote to Production
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handlePromoteEnvironment(env.id, 'development')}
                          disabled={promoteEnvironmentMutation.isPending}
                        >
                          <ArrowRight className="w-3 h-3 mr-1" />
                          Promote to Dev
                        </Button>
                      </>
                    )}
                    <Button variant="outline" size="sm">
                      <Settings className="w-3 h-3 mr-1" />
                      Settings
                    </Button>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 text-red-600 hover:text-red-800"
                    onClick={() => handleDeleteEnvironment(env.id)}
                    disabled={deleteEnvironmentMutation.isPending}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Preview Environment Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Create Preview Environment</CardTitle>
              <p className="text-sm text-muted-foreground">
                Set up a preview environment for your branch
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="service">Service</Label>
                <select
                  id="service"
                  value={formData.service_id}
                  onChange={(e) => setFormData({ ...formData, service_id: e.target.value })}
                  className="mt-1 w-full p-2 border rounded-md"
                >
                  <option value="">Select service</option>
                  {services.map((service: any) => (
                    <option key={service.id} value={service.id}>
                      {service.name} ({service.type})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label htmlFor="branch">Branch Name</Label>
                <Input
                  id="branch"
                  value={formData.branch_name}
                  onChange={(e) => setFormData({ ...formData, branch_name: e.target.value })}
                  placeholder="feature/new-ui"
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="pr">Pull Request Number (Optional)</Label>
                <Input
                  id="pr"
                  type="number"
                  value={formData.pr_number}
                  onChange={(e) => setFormData({ ...formData, pr_number: e.target.value })}
                  placeholder="123"
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="ttl">TTL (Hours)</Label>
                <select
                  id="ttl"
                  value={formData.ttl_hours}
                  onChange={(e) => setFormData({ ...formData, ttl_hours: parseInt(e.target.value) })}
                  className="mt-1 w-full p-2 border rounded-md"
                >
                  <option value={6}>6 hours</option>
                  <option value={12}>12 hours</option>
                  <option value={24}>24 hours</option>
                  <option value={48}>48 hours</option>
                  <option value={72}>3 days</option>
                  <option value={168}>7 days</option>
                </select>
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsCreateModalOpen(false);
                    setFormData({ service_id: '', branch_name: '', pr_number: '', ttl_hours: 24 });
                  }}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateEnvironment}
                  disabled={!formData.service_id || !formData.branch_name || createEnvironmentMutation.isPending}
                  className="flex-1"
                >
                  {createEnvironmentMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create Preview'
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
