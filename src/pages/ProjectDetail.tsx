import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { deploymentsApi, projectsApi, servicesApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  ArrowLeft,
  Settings,
  GitBranch,
  Database,
  Activity,
  Calendar,
  Plus,
  TestTube,
  Server,
  Loader2,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import PreviewEnvironments from '@/components/preview/PreviewEnvironments';
import DeploymentsPanel from '@/components/deployments/DeploymentsPanel';
import EnvVariablesEditor from '@/components/deployments/EnvVariablesEditor';
import ServiceLogs from '@/components/deployments/ServiceLogs';
import type { CreateServiceRequest, Project, Service } from '@/types';

type Tab = 'overview' | 'services' | 'preview' | 'settings';

const serviceTypeOptions: Array<CreateServiceRequest['type']> = [
  'web',
  'worker',
  'database',
  'cron',
];

const serviceEnvOptions: Array<CreateServiceRequest['environment']> = [
  'production',
  'preview',
  'development',
];

export default function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [isCreateServiceOpen, setIsCreateServiceOpen] = useState(false);
  const [serviceForm, setServiceForm] = useState({
    name: '',
    type: 'web' as CreateServiceRequest['type'],
    environment: 'production' as CreateServiceRequest['environment'],
    image: '',
    command: '',
    git_repo: '',
    git_branch: 'main',
    build_path: '.',
  });

  const { data: projectData, isLoading: projectLoading, error } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => (projectId ? projectsApi.getProject(projectId) : Promise.reject(new Error('No project ID'))),
    enabled: !!projectId,
  });

  const { data: servicesData, isLoading: servicesLoading } = useQuery({
    queryKey: ['services', projectId],
    queryFn: () => (projectId ? projectsApi.getServices(projectId) : Promise.reject(new Error('No project ID'))),
    enabled: !!projectId,
  });

  const services = servicesData?.services ?? [];
  const project: Project | undefined = projectData?.project;

  useEffect(() => {
    if (services.length === 0) {
      setSelectedServiceId(null);
      return;
    }

    if (!selectedServiceId || !services.some((service) => service.id === selectedServiceId)) {
      setSelectedServiceId(services[0].id);
    }
  }, [selectedServiceId, services]);

  const selectedService = useMemo(
    () => services.find((service) => service.id === selectedServiceId) ?? null,
    [selectedServiceId, services],
  );

  const { data: deploymentCount } = useQuery({
    queryKey: ['project-deployment-count', projectId, services.map((service) => service.id).join(',')],
    queryFn: async () => {
      const counts = await Promise.all(
        services.map(async (service) => {
          const response = await deploymentsApi.getDeployments(service.id);
          return response.deployments.length;
        }),
      );
      return counts.reduce((sum, count) => sum + count, 0);
    },
    enabled: !!projectId && services.length > 0,
  });

  const createServiceMutation = useMutation({
    mutationFn: () => {
      if (!project) {
        throw new Error('Project not loaded');
      }

      return servicesApi.createService(project.id, {
        project_id: project.id,
        name: serviceForm.name.trim(),
        type: serviceForm.type,
        environment: serviceForm.environment,
        image: serviceForm.image.trim() || undefined,
        command: serviceForm.command.trim() || undefined,
        git_repo: serviceForm.git_repo.trim() || undefined,
        git_branch: serviceForm.git_branch.trim() || undefined,
        build_path: serviceForm.build_path.trim() || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services', projectId] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setIsCreateServiceOpen(false);
      setServiceForm({
        name: '',
        type: 'web',
        environment: 'production',
        image: '',
        command: '',
        git_repo: '',
        git_branch: 'main',
        build_path: '.',
      });
    },
  });

  const runningServices = services.filter((service) => service.status === 'running').length;

  if (projectLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4" />
          <div className="h-32 bg-gray-200 rounded-lg" />
        </div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <h2 className="text-2xl font-semibold text-gray-900">Project not found</h2>
          <p className="text-gray-600 mt-2">
            The project you&apos;re looking for doesn&apos;t exist or you don&apos;t have access to it.
          </p>
          <Button onClick={() => navigate('/projects')} className="mt-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Projects
          </Button>
        </div>
      </div>
    );
  }

  const tabs: Array<{ id: Tab; label: string; icon: typeof Activity }> = [
    { id: 'overview', label: 'Overview', icon: Activity },
    { id: 'services', label: 'Services', icon: Database },
    { id: 'preview', label: 'Preview Environments', icon: TestTube },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/projects')}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">{project.name}</h1>
            <p className="text-sm md:text-base text-muted-foreground">{project.description || 'No description'}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setActiveTab('settings')}>
            <Settings className="w-4 h-4 mr-2" />
            Settings
          </Button>
          <Button onClick={() => setIsCreateServiceOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Service
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Database className="w-5 h-5 text-blue-500" />
              <div>
                <div className="text-2xl font-bold">{services.length}</div>
                <div className="text-sm text-muted-foreground">Services</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <GitBranch className="w-5 h-5 text-green-500" />
              <div>
                <div className="text-2xl font-bold">{deploymentCount ?? 0}</div>
                <div className="text-sm text-muted-foreground">Deployments</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-violet-500" />
              <div>
                <div className="text-2xl font-bold">{runningServices}</div>
                <div className="text-sm text-muted-foreground">Running Services</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-orange-500" />
              <div>
                <div className="text-sm font-bold">
                  {formatDistanceToNow(new Date(project.created_at), { addSuffix: true })}
                </div>
                <div className="text-sm text-muted-foreground">Created</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="border-b">
        <nav className="flex space-x-8">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="space-y-6">
        {activeTab === 'overview' && (
          <Card>
            <CardHeader>
              <CardTitle>Project Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {services.length > 0
                  ? `This project currently has ${services.length} service(s), with ${runningServices} running.`
                  : 'No services yet. Use "Add Service" to create your first service.'}
              </p>
            </CardContent>
          </Card>
        )}

        {activeTab === 'services' && (
          <div className="space-y-6">
            {servicesLoading ? (
              <Card>
                <CardContent className="py-10 flex items-center justify-center">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </CardContent>
              </Card>
            ) : services.length === 0 ? (
              <Card>
                <CardContent className="py-10 text-center text-muted-foreground">
                  No services configured yet.
                </CardContent>
              </Card>
            ) : (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Services</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {services.map((service: Service) => (
                      <button
                        key={service.id}
                        type="button"
                        onClick={() => setSelectedServiceId(service.id)}
                        className={`w-full text-left p-3 rounded-md border transition-colors ${
                          selectedServiceId === service.id
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:bg-muted/40'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Server className="w-4 h-4 text-muted-foreground" />
                            <span className="font-medium">{service.name}</span>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {service.type} · {service.status}
                          </span>
                        </div>
                      </button>
                    ))}
                  </CardContent>
                </Card>

                {selectedService && (
                  <div className="space-y-6">
                    <DeploymentsPanel serviceId={selectedService.id} serviceName={selectedService.name} />
                    <EnvVariablesEditor serviceId={selectedService.id} />
                    <ServiceLogs serviceId={selectedService.id} serviceName={selectedService.name} />
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {activeTab === 'preview' && <PreviewEnvironments projectId={project.id} />}

        {activeTab === 'settings' && (
          <Card>
            <CardHeader>
              <CardTitle>Project Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Project settings and configuration options will be available here.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {isCreateServiceOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-lg">
            <CardHeader>
              <CardTitle>Create Service</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="service-name">Name</Label>
                <Input
                  id="service-name"
                  value={serviceForm.name}
                  onChange={(e) => setServiceForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="api-service"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="service-type">Type</Label>
                  <select
                    id="service-type"
                    className="mt-1 w-full p-2 border rounded-md bg-background"
                    value={serviceForm.type}
                    onChange={(e) =>
                      setServiceForm((prev) => ({
                        ...prev,
                        type: e.target.value as CreateServiceRequest['type'],
                      }))
                    }
                  >
                    {serviceTypeOptions.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <Label htmlFor="service-env">Environment</Label>
                  <select
                    id="service-env"
                    className="mt-1 w-full p-2 border rounded-md bg-background"
                    value={serviceForm.environment}
                    onChange={(e) =>
                      setServiceForm((prev) => ({
                        ...prev,
                        environment: e.target.value as CreateServiceRequest['environment'],
                      }))
                    }
                  >
                    {serviceEnvOptions.map((env) => (
                      <option key={env} value={env}>
                        {env}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <Label htmlFor="service-image">Image (optional)</Label>
                <Input
                  id="service-image"
                  value={serviceForm.image}
                  onChange={(e) => setServiceForm((prev) => ({ ...prev, image: e.target.value }))}
                  placeholder="nginx:latest"
                />
              </div>

              <div>
                <Label htmlFor="service-command">Command (optional)</Label>
                <Input
                  id="service-command"
                  value={serviceForm.command}
                  onChange={(e) => setServiceForm((prev) => ({ ...prev, command: e.target.value }))}
                  placeholder="npm start"
                />
              </div>

              <div>
                <Label htmlFor="service-repo">Git Repository (optional)</Label>
                <Input
                  id="service-repo"
                  value={serviceForm.git_repo}
                  onChange={(e) => setServiceForm((prev) => ({ ...prev, git_repo: e.target.value }))}
                  placeholder="org/repo"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="service-branch">Git Branch</Label>
                  <Input
                    id="service-branch"
                    value={serviceForm.git_branch}
                    onChange={(e) => setServiceForm((prev) => ({ ...prev, git_branch: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="service-build-path">Build Path</Label>
                  <Input
                    id="service-build-path"
                    value={serviceForm.build_path}
                    onChange={(e) => setServiceForm((prev) => ({ ...prev, build_path: e.target.value }))}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" onClick={() => setIsCreateServiceOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => createServiceMutation.mutate()}
                  disabled={!serviceForm.name.trim() || createServiceMutation.isPending}
                >
                  {createServiceMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4 mr-2" />
                      Create Service
                    </>
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

