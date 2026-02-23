import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { projectsApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, } from '@/components/ui/dropdown-menu';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { useToast } from '@/components/ui/toaster';
import { Search, MoreHorizontal, Edit, Trash2, Eye, GitBranch, Clock, Folder, ArrowUpRight, Sparkles, Server, Container } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
export default function ProjectsPage() {
    const [searchTerm, setSearchTerm] = useState('');
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [selectedProject, setSelectedProject] = useState(null);
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
        onError: (error) => {
            toast({ title: 'Error', description: error.message || 'Failed to create project', variant: 'destructive' });
        },
    });
    const updateProjectMutation = useMutation({
        mutationFn: ({ id, data }) => projectsApi.updateProject(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['projects'] });
            setIsEditModalOpen(false);
            setSelectedProject(null);
            setFormData({ name: '', description: '' });
            toast({ title: 'Project updated', description: 'Your project has been updated successfully.', variant: 'success' });
        },
        onError: (error) => {
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
        onError: (error) => {
            toast({ title: 'Error', description: error.message || 'Failed to delete project', variant: 'destructive' });
        },
    });
    const projects = useMemo(() => {
        return projectsData?.projects || [];
    }, [projectsData?.projects]);
    const handleSearchChange = useCallback((e) => {
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
    const openEditModal = useCallback((project) => {
        setSelectedProject(project);
        setFormData({ name: project.name, description: project.description });
        setIsEditModalOpen(true);
    }, []);
    const openDeleteModal = useCallback((project) => {
        setSelectedProject(project);
        setIsDeleteModalOpen(true);
    }, []);
    const formatLastDeployment = useCallback((lastDeployment) => {
        if (!lastDeployment)
            return 'No deployments';
        return formatDistanceToNow(new Date(lastDeployment), { addSuffix: true });
    }, []);
    const calculateUptime = useCallback((stats) => {
        if (stats.service_count === 0)
            return '100%';
        const uptime = (stats.running_services / stats.service_count) * 100;
        return `${uptime.toFixed(1)}%`;
    }, []);
    if (isLoading) {
        return (_jsxs("div", { className: "p-4 md:p-6 lg:p-8 space-y-8", children: [_jsx(PageHeader, { title: "Projects", description: "Manage your projects and deploy your applications" }), _jsxs("div", { className: "relative max-w-sm", children: [_jsx(Search, { className: "absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" }), _jsx(Input, { placeholder: "Search projects...", className: "pl-10", disabled: true })] }), _jsx(LoadingSkeleton, { variant: "card", count: 6 })] }));
    }
    if (error) {
        return (_jsx("div", { className: "p-4 md:p-6 lg:p-8", children: _jsx(EmptyState, { icon: Folder, title: "Error loading projects", description: "Please check your connection and try again.", action: { label: 'Retry', onClick: () => queryClient.invalidateQueries({ queryKey: ['projects'] }) } }) }));
    }
    return (_jsxs("div", { className: "p-4 md:p-6 lg:p-8 space-y-8 animate-fade-in", children: [_jsx(PageHeader, { title: "Projects", description: "Manage your projects and deploy your applications", action: {
                    label: 'New Project',
                    icon: Sparkles,
                    onClick: () => setIsCreateModalOpen(true),
                } }), _jsxs("div", { className: "flex flex-col sm:flex-row gap-4", children: [_jsxs("div", { className: "relative max-w-sm flex-1", children: [_jsx(Search, { className: "absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" }), _jsx(Input, { placeholder: "Search projects...", value: searchTerm, onChange: handleSearchChange, className: "pl-10 h-10" })] }), _jsx("div", { className: "flex items-center gap-2", children: _jsxs(Badge, { variant: "muted", className: "gap-1.5", children: [_jsx(Container, { className: "w-3 h-3" }), projects.length, " projects"] }) })] }), projects.length === 0 ? (_jsx(Card, { className: "border-dashed", children: _jsx(CardContent, { className: "py-16", children: _jsx(EmptyState, { icon: Folder, title: searchTerm ? 'No projects found' : 'No projects yet', description: searchTerm
                            ? 'Try adjusting your search terms'
                            : 'Create your first project to get started with deployments', action: !searchTerm ? { label: 'Create Project', onClick: () => setIsCreateModalOpen(true) } : undefined }) }) })) : (_jsx("div", { className: "grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3", children: projects.map((project, index) => {
                    const uptime = calculateUptime(project.stats);
                    const lastDeployment = formatLastDeployment(project.stats.last_deployment);
                    const allRunning = project.stats.running_services === project.stats.service_count;
                    return (_jsxs(Card, { className: cn("group card-hover cursor-pointer relative overflow-hidden", "animate-fade-in-up"), style: { animationDelay: `${index * 50}ms` }, onClick: () => navigate(`/projects/${project.id}`), children: [_jsx("div", { className: cn("absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity duration-300", allRunning ? "from-emerald-500/5 to-transparent" : "from-amber-500/5 to-transparent") }), _jsx(CardHeader, { className: "pb-3", children: _jsxs("div", { className: "flex items-start justify-between", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("div", { className: cn("p-2 rounded-xl transition-transform group-hover:scale-110", allRunning ? "bg-emerald-500/10" : "bg-amber-500/10"), children: _jsx(Folder, { className: cn("w-5 h-5", allRunning ? "text-emerald-500" : "text-amber-500") }) }), _jsxs("div", { className: "min-w-0", children: [_jsx(CardTitle, { className: "text-base font-semibold truncate", children: project.name }), _jsxs("div", { className: "flex items-center gap-2 mt-1", children: [_jsx("div", { className: cn("w-2 h-2 rounded-full", allRunning ? "bg-emerald-500 animate-pulse" : "bg-amber-500") }), _jsxs("span", { className: cn("text-xs font-medium", allRunning ? "text-emerald-500" : "text-amber-500"), children: [uptime, " uptime"] })] })] })] }), _jsxs(DropdownMenu, { children: [_jsx(DropdownMenuTrigger, { asChild: true, onClick: (e) => e.stopPropagation(), children: _jsx(Button, { variant: "ghost", size: "icon-sm", className: "opacity-0 group-hover:opacity-100 transition-opacity", children: _jsx(MoreHorizontal, { className: "w-4 h-4" }) }) }), _jsxs(DropdownMenuContent, { align: "end", className: "w-40", children: [_jsxs(DropdownMenuItem, { onClick: (e) => { e.stopPropagation(); navigate(`/projects/${project.id}`); }, children: [_jsx(Eye, { className: "w-4 h-4 mr-2" }), "View Details"] }), _jsxs(DropdownMenuItem, { onClick: (e) => { e.stopPropagation(); openEditModal(project); }, children: [_jsx(Edit, { className: "w-4 h-4 mr-2" }), "Edit"] }), _jsx(DropdownMenuSeparator, {}), _jsxs(DropdownMenuItem, { onClick: (e) => { e.stopPropagation(); openDeleteModal(project); }, className: "text-destructive focus:text-destructive", children: [_jsx(Trash2, { className: "w-4 h-4 mr-2" }), "Delete"] })] })] })] }) }), _jsxs(CardContent, { className: "space-y-4", children: [project.description && (_jsx("p", { className: "text-sm text-muted-foreground line-clamp-2", children: project.description })), _jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsxs("div", { className: "flex items-center gap-2 p-2 rounded-lg bg-muted/30", children: [_jsx(Server, { className: "w-4 h-4 text-violet-500" }), _jsxs("div", { children: [_jsx("div", { className: "text-sm font-semibold", children: project.stats.service_count }), _jsx("div", { className: "text-xs text-muted-foreground", children: "Services" })] })] }), _jsxs("div", { className: "flex items-center gap-2 p-2 rounded-lg bg-muted/30", children: [_jsx(GitBranch, { className: "w-4 h-4 text-blue-500" }), _jsxs("div", { children: [_jsx("div", { className: "text-sm font-semibold", children: project.stats.deployment_count }), _jsx("div", { className: "text-xs text-muted-foreground", children: "Deploys" })] })] })] }), _jsxs("div", { className: "flex items-center justify-between pt-2 border-t border-border/50", children: [_jsxs("div", { className: "flex items-center gap-1.5 text-muted-foreground", children: [_jsx(Clock, { className: "w-3 h-3" }), _jsx("span", { className: "text-xs", children: lastDeployment })] }), _jsx(ArrowUpRight, { className: "w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" })] })] })] }, project.id));
                }) })), projectsData?.pagination && projectsData.pagination.pages > 1 && (_jsxs("div", { className: "flex justify-center items-center gap-2", children: [_jsx(Button, { variant: "outline", size: "sm", onClick: () => setCurrentPage(p => Math.max(1, p - 1)), disabled: currentPage === 1, children: "Previous" }), _jsxs("span", { className: "text-sm text-muted-foreground px-4", children: ["Page ", currentPage, " of ", projectsData.pagination.pages] }), _jsx(Button, { variant: "outline", size: "sm", onClick: () => setCurrentPage(p => Math.min(projectsData.pagination.pages, p + 1)), disabled: currentPage === projectsData.pagination.pages, children: "Next" })] })), _jsx(Dialog, { open: isCreateModalOpen, onOpenChange: setIsCreateModalOpen, children: _jsxs(DialogContent, { className: "sm:max-w-md", children: [_jsxs(DialogHeader, { children: [_jsx(DialogTitle, { children: "Create New Project" }), _jsx(DialogDescription, { children: "Create a new project to organize your services and deployments." })] }), _jsxs("div", { className: "space-y-4 py-4", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "name", children: "Project Name" }), _jsx(Input, { id: "name", value: formData.name, onChange: (e) => setFormData({ ...formData, name: e.target.value }), placeholder: "my-awesome-project" })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "description", children: "Description" }), _jsx(Input, { id: "description", value: formData.description, onChange: (e) => setFormData({ ...formData, description: e.target.value }), placeholder: "A brief description of your project" })] })] }), _jsxs(DialogFooter, { children: [_jsx(Button, { variant: "ghost", onClick: () => setIsCreateModalOpen(false), children: "Cancel" }), _jsxs(Button, { onClick: handleCreateProject, disabled: !formData.name || createProjectMutation.isPending, className: "gap-2", children: [_jsx(Sparkles, { className: "w-4 h-4" }), createProjectMutation.isPending ? 'Creating...' : 'Create Project'] })] })] }) }), _jsx(Dialog, { open: isEditModalOpen, onOpenChange: setIsEditModalOpen, children: _jsxs(DialogContent, { className: "sm:max-w-md", children: [_jsxs(DialogHeader, { children: [_jsx(DialogTitle, { children: "Edit Project" }), _jsx(DialogDescription, { children: "Update your project details." })] }), _jsxs("div", { className: "space-y-4 py-4", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "edit-name", children: "Project Name" }), _jsx(Input, { id: "edit-name", value: formData.name, onChange: (e) => setFormData({ ...formData, name: e.target.value }) })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "edit-description", children: "Description" }), _jsx(Input, { id: "edit-description", value: formData.description, onChange: (e) => setFormData({ ...formData, description: e.target.value }) })] })] }), _jsxs(DialogFooter, { children: [_jsx(Button, { variant: "ghost", onClick: () => setIsEditModalOpen(false), children: "Cancel" }), _jsx(Button, { onClick: handleEditProject, disabled: !formData.name || updateProjectMutation.isPending, children: updateProjectMutation.isPending ? 'Updating...' : 'Update Project' })] })] }) }), _jsx(Dialog, { open: isDeleteModalOpen, onOpenChange: setIsDeleteModalOpen, children: _jsxs(DialogContent, { className: "sm:max-w-md", children: [_jsxs(DialogHeader, { children: [_jsx(DialogTitle, { children: "Delete Project" }), _jsxs(DialogDescription, { children: ["Are you sure you want to delete \"", selectedProject?.name, "\"? This action cannot be undone."] })] }), _jsxs(DialogFooter, { children: [_jsx(Button, { variant: "ghost", onClick: () => setIsDeleteModalOpen(false), children: "Cancel" }), _jsx(Button, { variant: "destructive", onClick: handleDeleteProject, disabled: deleteProjectMutation.isPending, children: deleteProjectMutation.isPending ? 'Deleting...' : 'Delete Project' })] })] }) })] }));
}
