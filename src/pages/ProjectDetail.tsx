import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  addEdge,
  Background,
  Controls,
  Handle,
  MiniMap,
  NodeResizer,
  Panel,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  Activity,
  ArrowLeft,
  Box,
  Database,
  GitBranch,
  Github,
  Layers,
  Loader2,
  MoreVertical,
  Plus,
  RefreshCw,
  Settings,
  Terminal,
  Trash2,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { auditApi, deploymentsApi, gitApi, projectsApi, servicesApi, templatesApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import DeploymentsPanel from '@/components/deployments/DeploymentsPanel';
import EnvVariablesEditor from '@/components/deployments/EnvVariablesEditor';
import ServiceLogs from '@/components/deployments/ServiceLogs';
import { useToast } from '@/components/ui/toaster';
import { cn } from '@/lib/utils';
import type { CreateServiceRequest, Service, Template, TemplateVariable } from '@/types';

type AddMode = 'github' | 'docker' | 'database' | 'template';

interface ServiceNodeData extends Record<string, unknown> {
  service: Service;
  onSelect: (service: Service) => void;
  onStatusChange: (service: Service, status: Service['status']) => void;
  onDelete: (service: Service) => void;
}

interface ProjectGroupNodeData extends Record<string, unknown> {
  title: string;
  subtitle: string;
}

function serviceIcon(type: Service['type']) {
  if (type === 'database') return Database;
  if (type === 'worker' || type === 'cron') return Terminal;
  return Github;
}

function statusClass(status: Service['status']) {
  if (status === 'running') return 'bg-emerald-500 text-emerald-200 border-emerald-500/40';
  if (status === 'building') return 'bg-amber-500 text-amber-100 border-amber-500/40';
  if (status === 'failed') return 'bg-rose-500 text-rose-100 border-rose-500/40';
  return 'bg-muted text-muted-foreground border-border';
}

function ProjectGroupNode({ data }: NodeProps<Node<ProjectGroupNodeData>>) {
  return (
    <div className="h-full w-full rounded-md border border-border bg-card/40">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <div>
          <div className="text-lg font-semibold">{data.title}</div>
          <div className="text-sm text-muted-foreground">{data.subtitle}</div>
        </div>
        <MoreVertical className="h-5 w-5 text-muted-foreground" />
      </div>
    </div>
  );
}

function ServiceCanvasNode({ data, selected }: NodeProps<Node<ServiceNodeData>>) {
  const service = data.service;
  const Icon = serviceIcon(service.type);
  const isRunning = service.status === 'running';

  return (
    <div className="relative min-w-[280px]">
      <NodeResizer
        isVisible={selected}
        minWidth={260}
        minHeight={150}
        lineClassName="border-primary"
        handleClassName="h-2 w-2 rounded-sm border border-primary bg-background"
      />
      <Handle type="target" position={Position.Left} className="!h-3 !w-3 !border-border !bg-background" />
      <Handle type="source" position={Position.Right} className="!h-3 !w-3 !border-border !bg-background" />

      <div
        className={cn(
          'rounded-md border bg-background shadow-sm transition-colors',
          selected ? 'border-primary' : 'border-border hover:border-muted-foreground/50',
        )}
        onDoubleClick={() => data.onSelect(service)}
      >
        <div className="flex items-start justify-between gap-3 p-5">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-border bg-card">
              <Icon className="h-5 w-5 text-foreground" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-lg font-semibold">{service.name}</div>
              <div className="truncate text-sm text-muted-foreground">
                {service.git_repo || service.image || `${service.type} service`}
              </div>
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" onClick={(event) => event.stopPropagation()}>
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => data.onSelect(service)}>Open</DropdownMenuItem>
              <DropdownMenuItem onClick={() => data.onStatusChange(service, isRunning ? 'stopped' : 'running')}>
                {isRunning ? 'Stop' : 'Start'}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => data.onStatusChange(service, 'building')}>Redeploy</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => data.onDelete(service)} className="text-destructive focus:text-destructive">
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="grid grid-cols-3 gap-2 border-y border-border px-5 py-4 text-sm">
          <div>
            <div className="text-xs text-muted-foreground">CPU</div>
            <div className="font-mono">{service.cpu || '0.5'}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Memory</div>
            <div className="font-mono">{service.memory || '512Mi'}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Branch</div>
            <div className="truncate font-mono">{service.git_branch || '-'}</div>
          </div>
        </div>

        <div className="flex items-center justify-between px-5 py-4">
          <Badge variant="outline" className={cn('border px-2 py-0.5 capitalize', statusClass(service.status))}>
            <span className={cn('mr-2 h-2 w-2 rounded-full', isRunning ? 'bg-emerald-900' : 'bg-current')} />
            {service.status}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(service.updated_at), { addSuffix: true })}
          </span>
        </div>
      </div>
    </div>
  );
}

const nodeTypes = {
  service: ServiceCanvasNode,
  projectGroup: ProjectGroupNode,
};

function parseTemplateVariables(template: Template | undefined): TemplateVariable[] {
  if (!template) return [];
  if (Array.isArray(template.variables)) return template.variables;
  if (typeof template.variables === 'string') {
    try {
      const parsed = JSON.parse(template.variables);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function variableKey(variable: TemplateVariable) {
  return variable.key || variable.name || variable.label;
}

function toInitialNodes(
  services: Service[],
  callbacks: Pick<ServiceNodeData, 'onSelect' | 'onStatusChange' | 'onDelete'>,
): Node[] {
  const appServices = services.filter((service) => service.type !== 'database');
  const dataServices = services.filter((service) => service.type === 'database');

  const groups: Node[] = [
    {
      id: 'group-applications',
      type: 'projectGroup',
      position: { x: 120, y: 220 },
      data: { title: 'Applications', subtitle: `${appServices.length} services` },
      style: { width: 560, height: Math.max(280, Math.ceil(appServices.length / 2) * 190 + 110), zIndex: -1 },
      selectable: false,
      draggable: true,
    },
    {
      id: 'group-data',
      type: 'projectGroup',
      position: { x: 760, y: 220 },
      data: { title: 'Data', subtitle: `${dataServices.length} services` },
      style: { width: 560, height: Math.max(280, Math.ceil(dataServices.length / 2) * 190 + 110), zIndex: -1 },
      selectable: false,
      draggable: true,
    },
  ];

  const serviceNodes = services.map((service, index) => {
    const isData = service.type === 'database';
    const localIndex = isData ? dataServices.findIndex((item) => item.id === service.id) : appServices.findIndex((item) => item.id === service.id);
    const parentId = isData ? 'group-data' : 'group-applications';
    return {
      id: service.id,
      type: 'service',
      parentId,
      extent: 'parent' as const,
      position: {
        x: 40 + (localIndex % 2) * 270,
        y: 86 + Math.floor(localIndex / 2) * 190,
      },
      data: { service, ...callbacks },
      style: { width: 250, minHeight: 150 },
      selected: index === 0,
    };
  });

  return [...groups, ...serviceNodes];
}

function toInitialEdges(services: Service[]): Edge[] {
  const apps = services.filter((service) => service.type !== 'database');
  const databases = services.filter((service) => service.type === 'database');
  if (apps.length === 0 || databases.length === 0) return [];

  return apps.slice(0, 4).map((service, index) => ({
    id: `edge-${service.id}-${databases[index % databases.length].id}`,
    source: service.id,
    target: databases[index % databases.length].id,
    type: 'smoothstep',
    animated: service.status === 'running',
    style: { stroke: '#6b7280', strokeDasharray: '6 6' },
  }));
}

export default function ProjectDetail() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [addMode, setAddMode] = useState<AddMode>('github');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [serviceForm, setServiceForm] = useState({
    name: '',
    type: 'web' as CreateServiceRequest['type'],
    environment: 'production' as CreateServiceRequest['environment'],
    image: '',
    command: '',
    git_repo: '',
    git_branch: 'main',
    build_path: '.',
    template_id: '',
  });
  const [templateVariables, setTemplateVariables] = useState<Record<string, string>>({});

  const { data: projectData, isLoading: projectLoading, error: projectError } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => (projectId ? projectsApi.getProject(projectId) : Promise.reject(new Error('No project ID'))),
    enabled: !!projectId,
  });

  const { data: servicesData, isLoading: servicesLoading } = useQuery({
    queryKey: ['services', projectId],
    queryFn: () => (projectId ? projectsApi.getServices(projectId) : Promise.reject(new Error('No project ID'))),
    enabled: !!projectId,
  });

  const { data: templatesData } = useQuery({
    queryKey: ['templates'],
    queryFn: () => templatesApi.getTemplates(),
  });

  const { data: reposData } = useQuery({
    queryKey: ['connected-repositories'],
    queryFn: () => gitApi.getConnectedRepositories({ limit: 100 }),
  });

  const selectedRepository = reposData?.repositories.find((repo) => repo.full_name === serviceForm.git_repo);
  const { data: branchesData } = useQuery({
    queryKey: ['repository-branches', selectedRepository?.id],
    queryFn: () => gitApi.getRepositoryBranches(selectedRepository!.id),
    enabled: !!selectedRepository?.id,
  });

  const selectedTemplate = templatesData?.templates.find((template) => template.id === serviceForm.template_id);
  const services = servicesData?.services ?? [];
  const project = projectData?.project;

  const selectService = useCallback((service: Service) => {
    setSelectedService(service);
  }, []);

  const updateStatus = useMutation({
    mutationFn: ({ service, status }: { service: Service; status: Service['status'] }) =>
      servicesApi.updateService(service.id, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['services', projectId] }),
    onError: (err: Error) => toast({ title: 'Service update failed', description: err.message, variant: 'destructive' }),
  });

  const deleteService = useMutation({
    mutationFn: (service: Service) => servicesApi.deleteService(service.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services', projectId] });
      setSelectedService(null);
    },
    onError: (err: Error) => toast({ title: 'Service delete failed', description: err.message, variant: 'destructive' }),
  });

  const handleStatusChange = useCallback(
    (service: Service, status: Service['status']) => {
      updateStatus.mutate({ service, status });
    },
    [updateStatus.mutate],
  );

  const handleDeleteService = useCallback(
    (service: Service) => {
      deleteService.mutate(service);
    },
    [deleteService.mutate],
  );

  const serviceCallbacks = useMemo(
    () => ({
      onSelect: selectService,
      onStatusChange: handleStatusChange,
      onDelete: handleDeleteService,
    }),
    [handleDeleteService, handleStatusChange, selectService],
  );

  useEffect(() => {
    setNodes(toInitialNodes(services, serviceCallbacks));
    setEdges(toInitialEdges(services));
    setSelectedService((current) => {
      if (services.length === 0) return null;
      if (!current) return services[0];
      return services.find((service) => service.id === current.id) ?? services[0];
    });
  }, [serviceCallbacks, services, setEdges, setNodes]);

  const deploymentCountQuery = useQuery({
    queryKey: ['project-deployment-count', projectId, services.map((service) => service.id).join(',')],
    queryFn: async () => {
      const counts = await Promise.all(services.map((service) => deploymentsApi.getDeployments(service.id)));
      return counts.reduce((sum, response) => sum + response.deployments.length, 0);
    },
    enabled: services.length > 0,
  });

  const auditQuery = useQuery({
    queryKey: ['audit-logs', selectedService?.id],
    queryFn: () => (selectedService ? auditApi.getResourceAuditLogs('service', selectedService.id) : Promise.resolve({ audit_logs: [] })),
    enabled: !!selectedService,
  });

  const createService = useMutation<unknown, Error>({
    mutationFn: () => {
      if (!projectId) throw new Error('Project is not loaded');

      if (addMode === 'template') {
        if (!serviceForm.template_id) throw new Error('Select a template');
        return templatesApi.deployTemplate(serviceForm.template_id, {
          project_id: projectId,
          name: serviceForm.name,
          variables: templateVariables,
        });
      }

      return servicesApi.createService(projectId, {
        project_id: projectId,
        name: serviceForm.name,
        type: serviceForm.type,
        environment: serviceForm.environment,
        image: addMode === 'docker' || addMode === 'database' ? serviceForm.image : undefined,
        command: serviceForm.command || undefined,
        git_repo: addMode === 'github' ? serviceForm.git_repo : undefined,
        git_branch: addMode === 'github' ? serviceForm.git_branch : undefined,
        build_path: addMode === 'github' ? serviceForm.build_path : undefined,
        cpu: addMode === 'database' ? '1' : '0.5',
        memory: addMode === 'database' ? '1Gi' : '512Mi',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services', projectId] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setIsAddOpen(false);
      setServiceForm({
        name: '',
        type: 'web',
        environment: 'production',
        image: '',
        command: '',
        git_repo: '',
        git_branch: 'main',
        build_path: '.',
        template_id: '',
      });
      setTemplateVariables({});
    },
    onError: (err: Error) => toast({ title: 'Service creation failed', description: err.message, variant: 'destructive' }),
  });

  const openAdd = (mode: AddMode) => {
    setAddMode(mode);
    setContextMenu(null);
    setIsAddOpen(true);
    setServiceForm((previous) => ({
      ...previous,
      type: mode === 'database' ? 'database' : 'web',
      image: mode === 'docker' ? previous.image : '',
    }));
  };

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((existingEdges) => addEdge({ ...connection, animated: true, type: 'smoothstep', style: { strokeDasharray: '6 6' } }, existingEdges));
    },
    [setEdges],
  );

  if (projectLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (projectError || !project) {
    return (
      <div className="p-8">
        <Card>
          <CardContent className="space-y-4 p-8">
            <h1 className="text-2xl font-semibold">Project not found</h1>
            <Button variant="outline" onClick={() => navigate('/projects')}>
              <ArrowLeft className="h-4 w-4" />
              Back to Projects
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const running = services.filter((service) => service.status === 'running').length;

  return (
    <div className="relative h-full min-h-[calc(100vh-4rem)] overflow-hidden bg-background">
      <div className="absolute left-0 right-0 top-0 z-20 flex h-16 items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur">
        <div className="flex min-w-0 items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/projects')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0">
            <div className="truncate text-xl font-semibold">{project.name}</div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>production</span>
              <span>/</span>
              <span>{services.length} services</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            {running} online
          </Badge>
          <Button onClick={() => openAdd('github')} className="gap-2">
            <Plus className="h-4 w-4" />
            Add
          </Button>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 top-16 z-20 flex w-16 flex-col items-center border-r border-border bg-background/90 py-5">
        <Button variant="secondary" size="icon" title="Canvas">
          <Layers className="h-5 w-5" />
        </Button>
        <Button variant="ghost" size="icon" title="Activity" onClick={() => setSelectedService(selectedService || services[0] || null)}>
          <Activity className="h-5 w-5" />
        </Button>
        <Button variant="ghost" size="icon" title="Settings">
          <Settings className="h-5 w-5" />
        </Button>
      </div>

      <div
        className="absolute inset-0 top-16"
        onContextMenu={(event) => {
          event.preventDefault();
          setContextMenu({ x: event.clientX, y: event.clientY });
        }}
        onClick={() => contextMenu && setContextMenu(null)}
      >
        <ReactFlowProvider>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            fitView
            minZoom={0.35}
            maxZoom={1.6}
            nodesDraggable
            elementsSelectable
            className="railway-flow"
            proOptions={{ hideAttribution: true }}
          >
            <Background gap={32} size={2} color="rgb(82 82 91)" />
            <Controls position="bottom-left" className="!left-20 !bottom-6" />
            <MiniMap position="bottom-right" nodeColor="#27272a" maskColor="rgb(0 0 0 / 0.55)" />
            <Panel position="top-left" className="!left-20 !top-5">
              {servicesLoading ? (
                <Badge variant="outline" className="gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Loading services
                </Badge>
              ) : services.length === 0 ? (
                <Card className="max-w-sm">
                  <CardContent className="space-y-4 p-5">
                    <Box className="h-6 w-6 text-muted-foreground" />
                    <div>
                      <h2 className="font-semibold">No services yet</h2>
                      <p className="mt-1 text-sm text-muted-foreground">Add GitHub, Docker, database, or template services to build this project.</p>
                    </div>
                    <Button size="sm" onClick={() => openAdd('github')}>Add service</Button>
                  </CardContent>
                </Card>
              ) : null}
            </Panel>
          </ReactFlow>
        </ReactFlowProvider>
      </div>

      {contextMenu && (
        <div
          className="fixed z-50 w-56 overflow-hidden rounded-md border border-border bg-popover shadow-xl"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <div className="border-b border-border px-3 py-2 text-xs font-semibold uppercase text-muted-foreground">Add Service</div>
          {[
            { mode: 'github' as const, icon: Github, label: 'GitHub Repository' },
            { mode: 'docker' as const, icon: Box, label: 'Docker Image' },
            { mode: 'database' as const, icon: Database, label: 'Database' },
            { mode: 'template' as const, icon: Layers, label: 'Template' },
          ].map((item) => (
            <button
              key={item.mode}
              type="button"
              onClick={() => openAdd(item.mode)}
              className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-secondary"
            >
              <item.icon className="h-4 w-4 text-muted-foreground" />
              {item.label}
            </button>
          ))}
        </div>
      )}

      {selectedService && (
        <div className="absolute bottom-0 right-0 top-16 z-30 w-full overflow-auto border-l border-border bg-background shadow-xl md:w-[460px]">
          <div className="sticky top-0 z-10 border-b border-border bg-background p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-2xl font-semibold">{selectedService.name}</div>
                <div className="mt-1 truncate text-sm text-muted-foreground">
                  {selectedService.git_repo || selectedService.image || selectedService.type}
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setSelectedService(null)}>x</Button>
            </div>
          </div>

          <Tabs defaultValue="activity" className="p-5">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="activity">Activity</TabsTrigger>
              <TabsTrigger value="deploys">Deploys</TabsTrigger>
              <TabsTrigger value="vars">Vars</TabsTrigger>
              <TabsTrigger value="logs">Logs</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>

            <TabsContent value="activity" className="space-y-3 pt-4">
              {(auditQuery.data?.audit_logs ?? []).length === 0 ? (
                <div className="rounded-md border border-border p-4 text-sm text-muted-foreground">No activity recorded for this service yet.</div>
              ) : (
                auditQuery.data?.audit_logs.map((log) => (
                  <div key={log.id} className="rounded-md border border-border p-4">
                    <div className="font-medium capitalize">{log.action}</div>
                    <div className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                    </div>
                  </div>
                ))
              )}
            </TabsContent>
            <TabsContent value="deploys" className="pt-4">
              <DeploymentsPanel serviceId={selectedService.id} serviceName={selectedService.name} />
            </TabsContent>
            <TabsContent value="vars" className="pt-4">
              <EnvVariablesEditor serviceId={selectedService.id} />
            </TabsContent>
            <TabsContent value="logs" className="pt-4">
              <ServiceLogs serviceId={selectedService.id} serviceName={selectedService.name} />
            </TabsContent>
            <TabsContent value="settings" className="space-y-4 pt-4">
              <Button
                variant={selectedService.status === 'running' ? 'outline' : 'default'}
                onClick={() => updateStatus.mutate({ service: selectedService, status: selectedService.status === 'running' ? 'stopped' : 'running' })}
              >
                {selectedService.status === 'running' ? 'Stop service' : 'Start service'}
              </Button>
              <Button variant="outline" onClick={() => updateStatus.mutate({ service: selectedService, status: 'building' })}>
                <RefreshCw className="h-4 w-4" />
                Redeploy
              </Button>
              <Button variant="destructive" onClick={() => deleteService.mutate(selectedService)}>
                Delete service
              </Button>
            </TabsContent>
          </Tabs>
        </div>
      )}

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Add Service</DialogTitle>
            <DialogDescription>Create a service from GitHub, Docker, a database, or a template.</DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-4 gap-2">
            {[
              { mode: 'github' as const, label: 'GitHub' },
              { mode: 'docker' as const, label: 'Docker' },
              { mode: 'database' as const, label: 'Database' },
              { mode: 'template' as const, label: 'Template' },
            ].map((item) => (
              <Button key={item.mode} variant={addMode === item.mode ? 'secondary' : 'outline'} size="sm" onClick={() => openAdd(item.mode)}>
                {item.label}
              </Button>
            ))}
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="service-name">Name</Label>
              <Input id="service-name" value={serviceForm.name} onChange={(event) => setServiceForm({ ...serviceForm, name: event.target.value })} placeholder="backend" />
            </div>

            {addMode === 'github' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="service-repo">Repository</Label>
                  <select
                    id="service-repo"
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={serviceForm.git_repo}
                    onChange={(event) => setServiceForm({ ...serviceForm, git_repo: event.target.value })}
                  >
                    <option value="">Select connected repository</option>
                    {(reposData?.repositories ?? []).map((repo) => (
                      <option key={repo.id} value={repo.full_name}>{repo.full_name}</option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="service-branch">Branch</Label>
                    <select
                      id="service-branch"
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={serviceForm.git_branch}
                      onChange={(event) => setServiceForm({ ...serviceForm, git_branch: event.target.value })}
                    >
                      <option value={serviceForm.git_branch}>{serviceForm.git_branch || 'main'}</option>
                      {(branchesData?.branches ?? []).map((branch) => (
                        <option key={branch.name} value={branch.name}>{branch.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="service-path">Build path</Label>
                    <Input id="service-path" value={serviceForm.build_path} onChange={(event) => setServiceForm({ ...serviceForm, build_path: event.target.value })} />
                  </div>
                </div>
              </>
            )}

            {addMode === 'docker' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="service-image">Docker image</Label>
                  <Input id="service-image" value={serviceForm.image} onChange={(event) => setServiceForm({ ...serviceForm, image: event.target.value })} placeholder="ghcr.io/org/app:latest" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="service-command">Command</Label>
                  <Input id="service-command" value={serviceForm.command} onChange={(event) => setServiceForm({ ...serviceForm, command: event.target.value })} placeholder="optional" />
                </div>
              </>
            )}

            {addMode === 'database' && (
              <div className="space-y-2">
                <Label htmlFor="database-kind">Database</Label>
                <select
                  id="database-kind"
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={serviceForm.image}
                  onChange={(event) => setServiceForm({ ...serviceForm, image: event.target.value })}
                >
                  <option value="">Select database</option>
                  <option value="postgres:16">PostgreSQL</option>
                  <option value="redis:7">Redis</option>
                  <option value="mysql:8">MySQL</option>
                </select>
              </div>
            )}

            {addMode === 'template' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="service-template">Template</Label>
                  <select
                    id="service-template"
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={serviceForm.template_id}
                    onChange={(event) => {
                      const template = templatesData?.templates.find((item) => item.id === event.target.value);
                      setServiceForm({ ...serviceForm, template_id: event.target.value, name: serviceForm.name || template?.name || '' });
                      setTemplateVariables(
                        parseTemplateVariables(template).reduce<Record<string, string>>((acc, variable) => {
                          acc[variableKey(variable)] = variable.default || '';
                          return acc;
                        }, {}),
                      );
                    }}
                  >
                    <option value="">Select template</option>
                    {(templatesData?.templates ?? []).map((template) => (
                      <option key={template.id} value={template.id}>{template.name}</option>
                    ))}
                  </select>
                </div>
                {parseTemplateVariables(selectedTemplate).map((variable) => {
                  const key = variableKey(variable);
                  return (
                    <div className="space-y-2" key={key}>
                      <Label htmlFor={`template-var-${key}`}>{variable.label || key}</Label>
                      <Input
                        id={`template-var-${key}`}
                        type={variable.secret ? 'password' : 'text'}
                        value={templateVariables[key] ?? ''}
                        onChange={(event) => setTemplateVariables((previous) => ({ ...previous, [key]: event.target.value }))}
                      />
                    </div>
                  );
                })}
              </>
            )}

            {addMode !== 'template' && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="service-env">Environment</Label>
                  <select id="service-env" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={serviceForm.environment} onChange={(event) => setServiceForm({ ...serviceForm, environment: event.target.value as CreateServiceRequest['environment'] })}>
                    <option value="production">production</option>
                    <option value="preview">preview</option>
                    <option value="development">development</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="service-type">Type</Label>
                  <select id="service-type" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={serviceForm.type} onChange={(event) => setServiceForm({ ...serviceForm, type: event.target.value as CreateServiceRequest['type'] })}>
                    <option value="web">web</option>
                    <option value="worker">worker</option>
                    <option value="database">database</option>
                    <option value="cron">cron</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsAddOpen(false)}>Cancel</Button>
            <Button onClick={() => createService.mutate()} disabled={!serviceForm.name.trim() || createService.isPending}>
              {createService.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="pointer-events-none absolute bottom-6 left-24 z-10 text-xs text-muted-foreground">
        {deploymentCountQuery.data ?? 0} deployments tracked
      </div>
    </div>
  );
}
