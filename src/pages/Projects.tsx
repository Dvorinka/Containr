import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { projectsApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
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
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { useToast } from '@/components/ui/toaster';
import {
  Search,
  MoreHorizontal,
  Edit,
  Trash2,
  Eye,
  GitBranch,
  Clock,
  Folder,
  ArrowUpRight,
  Sparkles,
  Server,
  Container
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import type { Project } from '@/types';

interface ProjectStats {
  service_count: number;
  deployment_count: number;
  running_services: number;
  last_deployment?: string;
}

interface ProjectWithStats extends Project {
  stats: ProjectStats;
}

export default function ProjectsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [formData, setFormData] = useState({ name: '', description: '' });
  const [currentPage, setCurrentPage] = useState(1);

  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { toast } = useToast();

  const { data: projectsData, isLoading, error } = useQuery({
    queryKey: ['projects', currentPage, searchTerm],
    queryFn: () => projectsApi.getProjects({
      page: currentPage,
      limit: 12,
      search: searchTerm
    }),
    staleTime: 30000,
    gcTime: 300000,
  });

  const createProjectMutation = useMutation({
    mutationFn: projectsApi.createProject,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setIsCreateModalOpen(false);
      setFormData({ name: '', description: '' });
      toast({ title: 'Project created', description: 'Your project has been created successfully.', variant: 'success' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message || 'Failed to create project', variant: 'destructive' });
    },
  });

  const updateProjectMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name: string; description: string } }) => 
      projectsApi.updateProject(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setIsEditModalOpen(false);
      setSelectedProject(null);
      setFormData({ name: '', description: '' });
      toast({ title: 'Project updated', description: 'Your project has been updated successfully.', variant: 'success' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message || 'Failed to update project', variant: 'destructive' });
    },
  });

  const deleteProjectMutation = useMutation({
    mutationFn: projectsApi.deleteProject,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setIsDeleteModalOpen(false);
      setSelectedProject(null);
      toast({ title: 'Project deleted', description: 'Your project has been deleted.', variant: 'success' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message || 'Failed to delete project', variant: 'destructive' });
    },
  });

  const projects = useMemo(() => {
    return projectsData?.projects || [];
  }, [projectsData?.projects]) as ProjectWithStats[];

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
  }, []);

  const handleCreateProject = useCallback(() => {
    createProjectMutation.mutate(formData);
  }, [createProjectMutation, formData]);

  const handleEditProject = useCallback(() => {
    if (selectedProject) {
      updateProjectMutation.mutate({
        id: selectedProject.id,
        data: formData
      });
    }
  }, [updateProjectMutation, selectedProject, formData]);

  const handleDeleteProject = useCallback(() => {
    if (selectedProject) {
      deleteProjectMutation.mutate(selectedProject.id);
    }
  }, [deleteProjectMutation, selectedProject]);

  const openEditModal = useCallback((project: Project) => {
    setSelectedProject(project);
    setFormData({ name: project.name, description: project.description });
    setIsEditModalOpen(true);
  }, []);

  const openDeleteModal = useCallback((project: Project) => {
    setSelectedProject(project);
    setIsDeleteModalOpen(true);
  }, []);

  const formatLastDeployment = useCallback((lastDeployment?: string) => {
    if (!lastDeployment) return 'No deployments';
    return formatDistanceToNow(new Date(lastDeployment), { addSuffix: true });
  }, []);

  const calculateUptime = useCallback((stats: ProjectStats) => {
    if (stats.service_count === 0) return '100%';
    const uptime = (stats.running_services / stats.service_count) * 100;
    return `${uptime.toFixed(1)}%`;
  }, []);

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 lg:p-8 space-y-8">
        <PageHeader title="Projects" description="Manage your projects and deploy your applications" />
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search projects..." className="pl-10" disabled />
        </div>
        <LoadingSkeleton variant="card" count={6} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 md:p-6 lg:p-8">
        <EmptyState
          icon={Folder}
          title="Error loading projects"
          description="Please check your connection and try again."
          action={{ label: 'Retry', onClick: () => queryClient.invalidateQueries({ queryKey: ['projects'] }) }}
        />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-8 animate-fade-in">
      <PageHeader
        title="Projects"
        description="Manage your projects and deploy your applications"
        action={{
          label: 'New Project',
          icon: Sparkles,
          onClick: () => setIsCreateModalOpen(true),
        }}
      />

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search projects..."
            value={searchTerm}
            onChange={handleSearchChange}
            className="pl-10 h-10"
          />
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="muted" className="gap-1.5">
            <Container className="w-3 h-3" />
            {projects.length} projects
          </Badge>
        </div>
      </div>

      {projects.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-16">
            <EmptyState
              icon={Folder}
              title={searchTerm ? 'No projects found' : 'No projects yet'}
              description={
                searchTerm 
                  ? 'Try adjusting your search terms' 
                  : 'Create your first project to get started with deployments'
              }
              action={!searchTerm ? { label: 'Create Project', onClick: () => setIsCreateModalOpen(true) } : undefined}
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((project: ProjectWithStats, index: number) => {
            const uptime = calculateUptime(project.stats);
            const lastDeployment = formatLastDeployment(project.stats.last_deployment);
            const allRunning = project.stats.running_services === project.stats.service_count;
            
            return (
              <Card 
                key={project.id} 
                className={cn(
                  "group card-hover cursor-pointer relative overflow-hidden",
                  "animate-fade-in-up"
                )}
                style={{ animationDelay: `${index * 50}ms` }}
                onClick={() => navigate(`/projects/${project.id}`)}
              >
                <div className={cn(
                  "absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity duration-300",
                  allRunning ? "from-emerald-500/5 to-transparent" : "from-amber-500/5 to-transparent"
                )} />
                
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "p-2 rounded-xl transition-transform group-hover:scale-110",
                        allRunning ? "bg-emerald-500/10" : "bg-amber-500/10"
                      )}>
                        <Folder className={cn("w-5 h-5", allRunning ? "text-emerald-500" : "text-amber-500")} />
                      </div>
                      <div className="min-w-0">
                        <CardTitle className="text-base font-semibold truncate">
                          {project.name}
                        </CardTitle>
                        <div className="flex items-center gap-2 mt-1">
                          <div className={cn(
                            "w-2 h-2 rounded-full",
                            allRunning ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
                          )} />
                          <span className={cn(
                            "text-xs font-medium",
                            allRunning ? "text-emerald-500" : "text-amber-500"
                          )}>
                            {uptime} uptime
                          </span>
                        </div>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon-sm" className="opacity-0 group-hover:opacity-100 transition-opacity">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigate(`/projects/${project.id}`); }}>
                          <Eye className="w-4 h-4 mr-2" />
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openEditModal(project); }}>
                          <Edit className="w-4 h-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          onClick={(e) => { e.stopPropagation(); openDeleteModal(project); }}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-4">
                  {project.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {project.description}
                    </p>
                  )}
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
                      <Server className="w-4 h-4 text-violet-500" />
                      <div>
                        <div className="text-sm font-semibold">{project.stats.service_count}</div>
                        <div className="text-xs text-muted-foreground">Services</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
                      <GitBranch className="w-4 h-4 text-blue-500" />
                      <div>
                        <div className="text-sm font-semibold">{project.stats.deployment_count}</div>
                        <div className="text-xs text-muted-foreground">Deploys</div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-border/50">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      <span className="text-xs">{lastDeployment}</span>
                    </div>
                    <ArrowUpRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {projectsData?.pagination && projectsData.pagination.pages > 1 && (
        <div className="flex justify-center items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground px-4">
            Page {currentPage} of {projectsData.pagination.pages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(p => Math.min(projectsData.pagination.pages, p + 1))}
            disabled={currentPage === projectsData.pagination.pages}
          >
            Next
          </Button>
        </div>
      )}

      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Project</DialogTitle>
            <DialogDescription>
              Create a new project to organize your services and deployments.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Project Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="my-awesome-project"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="A brief description of your project"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreateProject}
              disabled={!formData.name || createProjectMutation.isPending}
              className="gap-2"
            >
              <Sparkles className="w-4 h-4" />
              {createProjectMutation.isPending ? 'Creating...' : 'Create Project'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
            <DialogDescription>
              Update your project details.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Project Name</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Input
                id="edit-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsEditModalOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleEditProject}
              disabled={!formData.name || updateProjectMutation.isPending}
            >
              {updateProjectMutation.isPending ? 'Updating...' : 'Update Project'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Project</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{selectedProject?.name}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsDeleteModalOpen(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive"
              onClick={handleDeleteProject}
              disabled={deleteProjectMutation.isPending}
            >
              {deleteProjectMutation.isPending ? 'Deleting...' : 'Delete Project'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
