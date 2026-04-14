import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import {
  ArrowUpRight,
  Grid2X2,
  List,
  MoreHorizontal,
  Plus,
  Search,
  Server,
  Trash2,
  Pencil,
  Layers,
} from 'lucide-react';
import { projectsApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { EmptyState } from '@/components/ui/empty-state';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { useToast } from '@/components/ui/toaster';
import { cn } from '@/lib/utils';
import type { Project } from '@/types';

interface ProjectStats {
  service_count: number;
  deployment_count: number;
  running_services: number;
  last_deployment?: string | null;
}

interface ProjectWithStats extends Project {
  stats?: ProjectStats;
}

const emptyStats: ProjectStats = {
  service_count: 0,
  deployment_count: 0,
  running_services: 0,
  last_deployment: null,
};

function ProjectPreview({ stats }: { stats: ProjectStats }) {
  const total = Math.max(stats.service_count, 4);
  const cells = Array.from({ length: Math.min(total, 6) });

  return (
    <div className="relative h-32 overflow-hidden rounded-lg border border-border bg-surface/50">
      <div className="absolute inset-0 opacity-30"
        style={{
          backgroundImage: 'radial-gradient(circle, rgb(var(--border)) 1px, transparent 1px)',
          backgroundSize: '20px 20px'
        }}
      />
      <div className="relative mx-auto grid h-full max-w-[200px] grid-cols-3 place-content-center gap-2 p-4">
        {cells.map((_, index) => {
          const isRunning = index < stats.running_services;
          return (
            <div
              key={index}
              className={cn(
                'flex aspect-square items-center justify-center rounded-md border bg-card shadow-sm transition-all',
                isRunning 
                  ? 'border-emerald-500/40 shadow-emerald-500/10' 
                  : 'border-border text-muted-foreground'
              )}
            >
              <Server className={cn('h-4 w-4', isRunning ? 'text-emerald-500' : 'text-muted-foreground')} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function Projects() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<ProjectWithStats | null>(null);
  const [deletingProject, setDeletingProject] = useState<ProjectWithStats | null>(null);
  const [formData, setFormData] = useState({ name: '', description: '' });

  const { data, isLoading, error } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsApi.getProjects({ limit: 100 }),
  });

  const projects = useMemo(() => data?.projects ?? [], [data?.projects]) as ProjectWithStats[];
  const filteredProjects = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return projects;
    return projects.filter((project) =>
      [project.name, project.description].some((value) => value?.toLowerCase().includes(term)),
    );
  }, [projects, searchTerm]);

  const createProject = useMutation({
    mutationFn: () => projectsApi.createProject(formData),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setIsCreateOpen(false);
      setFormData({ name: '', description: '' });
      navigate(`/projects/${response.project.id}`);
    },
    onError: (err: Error) => {
      toast({ title: 'Could not create project', description: err.message, variant: 'destructive' });
    },
  });

  const updateProject = useMutation({
    mutationFn: () => {
      if (!editingProject) throw new Error('No project selected');
      return projectsApi.updateProject(editingProject.id, formData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setEditingProject(null);
      setFormData({ name: '', description: '' });
    },
    onError: (err: Error) => {
      toast({ title: 'Could not update project', description: err.message, variant: 'destructive' });
    },
  });

  const deleteProject = useMutation({
    mutationFn: () => {
      if (!deletingProject) throw new Error('No project selected');
      return projectsApi.deleteProject(deletingProject.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setDeletingProject(null);
    },
    onError: (err: Error) => {
      toast({ title: 'Could not delete project', description: err.message, variant: 'destructive' });
    },
  });

  const openEdit = (project: ProjectWithStats) => {
    setEditingProject(project);
    setFormData({ name: project.name, description: project.description || '' });
  };

  if (isLoading) {
    return (
      <div className="p-6 lg:p-8">
        <div className="mx-auto max-w-[1400px]">
          <LoadingSkeleton variant="card" count={6} />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 lg:p-8">
        <div className="mx-auto max-w-[1400px]">
          <EmptyState
            icon={Grid2X2}
            title="Projects did not load"
            description="Check the API connection and try again."
            action={{ label: 'Retry', onClick: () => queryClient.invalidateQueries({ queryKey: ['projects'] }) }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8">
      <div className="mx-auto max-w-[1400px] space-y-8">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage your containerized applications
            </p>
          </div>

          <Button onClick={() => setIsCreateOpen(true)} className="gap-2 h-9">
            <Plus className="h-4 w-4" />
            New Project
          </Button>
        </div>

        {/* Toolbar */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search projects..."
              className="h-9 pl-9 bg-surface border-border"
            />
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {filteredProjects.length} {filteredProjects.length === 1 ? 'project' : 'projects'}
            </span>
            <div className="h-4 w-px bg-border" />
            <div className="flex rounded-md border border-border bg-surface p-0.5">
              <Button 
                variant={view === 'grid' ? 'secondary' : 'ghost'} 
                size="icon" 
                className="h-7 w-7"
                onClick={() => setView('grid')}
              >
                <Grid2X2 className="h-4 w-4" />
              </Button>
              <Button 
                variant={view === 'list' ? 'secondary' : 'ghost'} 
                size="icon" 
                className="h-7 w-7"
                onClick={() => setView('list')}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Content */}
        {filteredProjects.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-20">
              <EmptyState
                icon={Layers}
                title={searchTerm ? 'No matching projects' : 'No projects yet'}
                description={searchTerm ? 'Try another search term.' : 'Create your first project to get started.'}
                action={!searchTerm ? { label: 'Create Project', onClick: () => setIsCreateOpen(true) } : undefined}
              />
            </CardContent>
          </Card>
        ) : view === 'grid' ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredProjects.map((project, index) => {
              const stats = project.stats ?? emptyStats;
              const online = stats.service_count > 0 && stats.running_services === stats.service_count;
              const hasServices = stats.service_count > 0;
              const lastActivity = stats.last_deployment
                ? formatDistanceToNow(new Date(stats.last_deployment), { addSuffix: true })
                : formatDistanceToNow(new Date(project.updated_at), { addSuffix: true });

              return (
                <Card
                  key={project.id}
                  className={cn(
                    'group cursor-pointer overflow-hidden border-border bg-card transition-all duration-200',
                    'hover:border-border-subtle hover:shadow-lg'
                  )}
                  style={{ animationDelay: `${index * 50}ms` }}
                  onClick={() => navigate(`/projects/${project.id}`)}
                >
                  <CardContent className="p-5 space-y-4">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate text-base font-semibold tracking-tight">{project.name}</h3>
                        <p className="mt-0.5 line-clamp-1 text-sm text-muted-foreground">
                          {project.description || 'No description'}
                        </p>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(event) => event.stopPropagation()}>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={(event) => { event.stopPropagation(); openEdit(project); }}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={(event) => { event.stopPropagation(); setDeletingProject(project); }}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    {/* Preview */}
                    <ProjectPreview stats={stats} />

                    {/* Footer */}
                    <div className="flex items-center justify-between pt-2">
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          'h-2 w-2 rounded-full',
                          hasServices 
                            ? online ? 'bg-emerald-500' : 'bg-amber-500'
                            : 'bg-muted-foreground'
                        )} />
                        <span className="text-xs text-muted-foreground">
                          {hasServices 
                            ? `${stats.running_services}/${stats.service_count} online`
                            : 'No services'
                          }
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{lastActivity}</span>
                        <ArrowUpRight className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            {filteredProjects.map((project, index) => {
              const stats = project.stats ?? emptyStats;
              const online = stats.service_count > 0 && stats.running_services === stats.service_count;
              
              return (
                <button
                  key={project.id}
                  type="button"
                  onClick={() => navigate(`/projects/${project.id}`)}
                  className={cn(
                    'flex w-full items-center justify-between px-5 py-4 text-left transition-colors',
                    'hover:bg-surface-hover',
                    index !== filteredProjects.length - 1 && 'border-b border-border'
                  )}
                >
                  <div className="min-w-0 flex items-center gap-4">
                    <div className={cn(
                      'h-2 w-2 rounded-full shrink-0',
                      stats.service_count > 0
                        ? online ? 'bg-emerald-500' : 'bg-amber-500'
                        : 'bg-muted-foreground'
                    )} />
                    <div>
                      <div className="font-medium text-sm">{project.name}</div>
                      <div className="text-xs text-muted-foreground">{project.description || 'No description'}</div>
                    </div>
                  </div>
                  <div className="hidden sm:flex items-center gap-4 text-sm">
                    <Badge variant="outline" className="text-xs">
                      {stats.service_count} {stats.service_count === 1 ? 'service' : 'services'}
                    </Badge>
                    <span className="text-muted-foreground text-xs">
                      {stats.running_services} online
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Create Dialog */}
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Create Project</DialogTitle>
              <DialogDescription>
                Create a new project to organize your services and deployments.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="project-name">Name</Label>
                <Input 
                  id="project-name" 
                  value={formData.name} 
                  onChange={(event) => setFormData({ ...formData, name: event.target.value })} 
                  placeholder="my-project"
                  className="h-9"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="project-description">Description</Label>
                <Input 
                  id="project-description" 
                  value={formData.description} 
                  onChange={(event) => setFormData({ ...formData, description: event.target.value })} 
                  placeholder="Production environment"
                  className="h-9"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setIsCreateOpen(false)} className="h-9">
                Cancel
              </Button>
              <Button 
                onClick={() => createProject.mutate()} 
                disabled={!formData.name.trim() || createProject.isPending}
                className="h-9"
              >
                {createProject.isPending ? 'Creating...' : 'Create Project'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Dialog */}
        <Dialog open={!!editingProject} onOpenChange={(open) => !open && setEditingProject(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Project</DialogTitle>
              <DialogDescription>Update project details.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-project-name">Name</Label>
                <Input 
                  id="edit-project-name" 
                  value={formData.name} 
                  onChange={(event) => setFormData({ ...formData, name: event.target.value })}
                  className="h-9"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-project-description">Description</Label>
                <Input 
                  id="edit-project-description" 
                  value={formData.description} 
                  onChange={(event) => setFormData({ ...formData, description: event.target.value })}
                  className="h-9"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setEditingProject(null)} className="h-9">
                Cancel
              </Button>
              <Button 
                onClick={() => updateProject.mutate()} 
                disabled={!formData.name.trim() || updateProject.isPending}
                className="h-9"
              >
                {updateProject.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Dialog */}
        <Dialog open={!!deletingProject} onOpenChange={(open) => !open && setDeletingProject(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Delete Project</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete <span className="font-medium">{deletingProject?.name}</span>?
                This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setDeletingProject(null)} className="h-9">
                Cancel
              </Button>
              <Button 
                variant="destructive" 
                onClick={() => deleteProject.mutate()} 
                disabled={deleteProject.isPending}
                className="h-9"
              >
                {deleteProject.isPending ? 'Deleting...' : 'Delete'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
