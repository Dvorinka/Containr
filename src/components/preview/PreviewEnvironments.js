import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectsApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TestTube, Plus, ExternalLink, Trash2, RefreshCw, Clock, GitBranch, Package, AlertTriangle, CheckCircle, XCircle, Loader2, ArrowRight, Calendar, Settings } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
export default function PreviewEnvironments({ projectId }) {
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
        mutationFn: (data) => projectsApi.createPreviewEnvironment(projectId, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['preview-environments', projectId] });
            setIsCreateModalOpen(false);
            setFormData({ service_id: '', branch_name: '', pr_number: '', ttl_hours: 24 });
        },
    });
    const deleteEnvironmentMutation = useMutation({
        mutationFn: (id) => projectsApi.deletePreviewEnvironment(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['preview-environments', projectId] });
        },
    });
    const promoteEnvironmentMutation = useMutation({
        mutationFn: ({ id, data }) => projectsApi.promotePreviewEnvironment(id, data),
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
    const handleDeleteEnvironment = (id) => {
        if (confirm('Are you sure you want to delete this preview environment?')) {
            deleteEnvironmentMutation.mutate(id);
        }
    };
    const handlePromoteEnvironment = (id, targetEnvironment) => {
        promoteEnvironmentMutation.mutate({
            id,
            data: {
                target_environment: targetEnvironment,
                create_backup: true,
            },
        });
    };
    const getStatusIcon = (status) => {
        switch (status) {
            case 'building':
                return _jsx(Loader2, { className: "w-4 h-4 animate-spin text-blue-500" });
            case 'running':
                return _jsx(CheckCircle, { className: "w-4 h-4 text-green-500" });
            case 'failed':
                return _jsx(XCircle, { className: "w-4 h-4 text-red-500" });
            case 'stopped':
                return _jsx(Package, { className: "w-4 h-4 text-gray-500" });
            case 'expired':
                return _jsx(AlertTriangle, { className: "w-4 h-4 text-orange-500" });
            default:
                return _jsx(Package, { className: "w-4 h-4" });
        }
    };
    const getStatusColor = (status) => {
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
    const isExpired = (expiresAt) => {
        return new Date(expiresAt) < new Date();
    };
    const getTimeRemaining = (expiresAt) => {
        const now = new Date();
        const expires = new Date(expiresAt);
        const diff = expires.getTime() - now.getTime();
        if (diff <= 0)
            return 'Expired';
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const days = Math.floor(hours / 24);
        const remainingHours = hours % 24;
        if (days > 0) {
            return `${days}d ${remainingHours}h remaining`;
        }
        return `${hours}h remaining`;
    };
    if (isLoading) {
        return (_jsx("div", { className: "space-y-4", children: _jsxs("div", { className: "animate-pulse", children: [_jsx("div", { className: "h-6 bg-gray-200 rounded w-1/4 mb-4" }), _jsx("div", { className: "space-y-3", children: [1, 2, 3].map(i => (_jsx("div", { className: "h-40 bg-gray-200 rounded-lg" }, i))) })] }) }));
    }
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsxs("h3", { className: "text-lg font-semibold flex items-center gap-2", children: [_jsx(TestTube, { className: "w-5 h-5 text-blue-500" }), "Preview Environments"] }), _jsx("p", { className: "text-sm text-muted-foreground", children: "Automatic preview environments for your branches" })] }), _jsxs("div", { className: "flex gap-2", children: [_jsxs(Button, { variant: "outline", size: "sm", children: [_jsx(RefreshCw, { className: "w-4 h-4 mr-2" }), "Cleanup Expired"] }), _jsxs(Button, { onClick: () => setIsCreateModalOpen(true), children: [_jsx(Plus, { className: "w-4 h-4 mr-2" }), "Create Preview"] })] })] }), environments.length === 0 ? (_jsx(Card, { children: _jsxs(CardContent, { className: "flex flex-col items-center justify-center py-12", children: [_jsx("div", { className: "w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-4", children: _jsx(TestTube, { className: "w-8 h-8 text-blue-500" }) }), _jsx("h3", { className: "text-lg font-semibold mb-2", children: "No preview environments" }), _jsx("p", { className: "text-gray-600 text-center mb-4", children: "Create preview environments to test your branches before deploying to production" }), _jsxs(Button, { onClick: () => setIsCreateModalOpen(true), children: [_jsx(Plus, { className: "w-4 h-4 mr-2" }), "Create Preview Environment"] })] }) })) : (_jsx("div", { className: "space-y-4", children: environments.map((env) => (_jsxs(Card, { className: `border-l-4 ${isExpired(env.expires_at) ? 'border-l-orange-500' :
                        env.status === 'running' ? 'border-l-green-500' :
                            env.status === 'building' ? 'border-l-blue-500' : 'border-l-red-500'}`, children: [_jsx(CardHeader, { className: "pb-3", children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsx("div", { className: "flex items-center gap-3", children: _jsxs("div", { className: "flex items-center gap-2", children: [getStatusIcon(env.status), _jsxs("div", { children: [_jsx(CardTitle, { className: "text-base", children: env.environment }), _jsxs("div", { className: "flex items-center gap-2 text-sm text-muted-foreground", children: [_jsx(GitBranch, { className: "w-3 h-3" }), _jsx("span", { children: env.branch_name }), env.pr_number && (_jsxs(_Fragment, { children: [_jsx("span", { children: "\u2022" }), _jsxs("span", { children: ["PR #", env.pr_number] })] }))] })] })] }) }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Badge, { className: getStatusColor(env.status), children: env.status }), isExpired(env.expires_at) && (_jsxs(Badge, { variant: "outline", className: "text-orange-600", children: [_jsx(AlertTriangle, { className: "w-3 h-3 mr-1" }), "Expired"] }))] })] }) }), _jsxs(CardContent, { className: "space-y-4", children: [_jsxs("div", { className: "grid grid-cols-2 gap-4 text-sm", children: [_jsxs("div", { children: [_jsx(Label, { className: "text-xs font-medium", children: "Service" }), _jsxs("div", { className: "flex items-center gap-2 mt-1", children: [_jsx("span", { className: "font-medium", children: env.service?.name }), _jsx(Badge, { variant: "outline", className: "text-xs", children: env.service?.type })] })] }), _jsxs("div", { children: [_jsx(Label, { className: "text-xs font-medium", children: "Time Remaining" }), _jsxs("div", { className: "flex items-center gap-2 mt-1", children: [_jsx(Clock, { className: "w-3 h-3" }), _jsx("span", { className: isExpired(env.expires_at) ? 'text-orange-600' : '', children: getTimeRemaining(env.expires_at) })] })] })] }), env.url && env.status === 'running' && (_jsxs("div", { children: [_jsx(Label, { className: "text-xs font-medium", children: "Preview URL" }), _jsx("div", { className: "flex items-center gap-2 mt-1", children: _jsxs("a", { href: env.url, target: "_blank", rel: "noopener noreferrer", className: "text-blue-600 hover:text-blue-800 flex items-center gap-1", children: [_jsx(ExternalLink, { className: "w-3 h-3" }), env.url] }) })] })), _jsxs("div", { className: "flex items-center gap-4 text-xs text-muted-foreground", children: [_jsxs("div", { className: "flex items-center gap-1", children: [_jsx(Calendar, { className: "w-3 h-3" }), _jsxs("span", { children: ["Created ", formatDistanceToNow(new Date(env.created_at), { addSuffix: true })] })] }), _jsxs("div", { className: "flex items-center gap-1", children: [_jsx(Clock, { className: "w-3 h-3" }), _jsxs("span", { children: ["Updated ", formatDistanceToNow(new Date(env.updated_at), { addSuffix: true })] })] })] }), _jsxs("div", { className: "flex items-center justify-between pt-2 border-t", children: [_jsxs("div", { className: "flex gap-2", children: [env.status === 'running' && (_jsxs(_Fragment, { children: [_jsxs(Button, { variant: "outline", size: "sm", onClick: () => handlePromoteEnvironment(env.id, 'production'), disabled: promoteEnvironmentMutation.isPending, children: [_jsx(ArrowRight, { className: "w-3 h-3 mr-1" }), "Promote to Production"] }), _jsxs(Button, { variant: "outline", size: "sm", onClick: () => handlePromoteEnvironment(env.id, 'development'), disabled: promoteEnvironmentMutation.isPending, children: [_jsx(ArrowRight, { className: "w-3 h-3 mr-1" }), "Promote to Dev"] })] })), _jsxs(Button, { variant: "outline", size: "sm", children: [_jsx(Settings, { className: "w-3 h-3 mr-1" }), "Settings"] })] }), _jsx(Button, { variant: "ghost", size: "icon", className: "h-8 w-8 text-red-600 hover:text-red-800", onClick: () => handleDeleteEnvironment(env.id), disabled: deleteEnvironmentMutation.isPending, children: _jsx(Trash2, { className: "w-4 h-4" }) })] })] })] }, env.id))) })), isCreateModalOpen && (_jsx("div", { className: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50", children: _jsxs(Card, { className: "w-full max-w-md", children: [_jsxs(CardHeader, { children: [_jsx(CardTitle, { children: "Create Preview Environment" }), _jsx("p", { className: "text-sm text-muted-foreground", children: "Set up a preview environment for your branch" })] }), _jsxs(CardContent, { className: "space-y-4", children: [_jsxs("div", { children: [_jsx(Label, { htmlFor: "service", children: "Service" }), _jsxs("select", { id: "service", value: formData.service_id, onChange: (e) => setFormData({ ...formData, service_id: e.target.value }), className: "mt-1 w-full p-2 border rounded-md", children: [_jsx("option", { value: "", children: "Select service" }), services.map((service) => (_jsxs("option", { value: service.id, children: [service.name, " (", service.type, ")"] }, service.id)))] })] }), _jsxs("div", { children: [_jsx(Label, { htmlFor: "branch", children: "Branch Name" }), _jsx(Input, { id: "branch", value: formData.branch_name, onChange: (e) => setFormData({ ...formData, branch_name: e.target.value }), placeholder: "feature/new-ui", className: "mt-1" })] }), _jsxs("div", { children: [_jsx(Label, { htmlFor: "pr", children: "Pull Request Number (Optional)" }), _jsx(Input, { id: "pr", type: "number", value: formData.pr_number, onChange: (e) => setFormData({ ...formData, pr_number: e.target.value }), placeholder: "123", className: "mt-1" })] }), _jsxs("div", { children: [_jsx(Label, { htmlFor: "ttl", children: "TTL (Hours)" }), _jsxs("select", { id: "ttl", value: formData.ttl_hours, onChange: (e) => setFormData({ ...formData, ttl_hours: parseInt(e.target.value) }), className: "mt-1 w-full p-2 border rounded-md", children: [_jsx("option", { value: 6, children: "6 hours" }), _jsx("option", { value: 12, children: "12 hours" }), _jsx("option", { value: 24, children: "24 hours" }), _jsx("option", { value: 48, children: "48 hours" }), _jsx("option", { value: 72, children: "3 days" }), _jsx("option", { value: 168, children: "7 days" })] })] }), _jsxs("div", { className: "flex gap-2 pt-4", children: [_jsx(Button, { variant: "outline", onClick: () => {
                                                setIsCreateModalOpen(false);
                                                setFormData({ service_id: '', branch_name: '', pr_number: '', ttl_hours: 24 });
                                            }, className: "flex-1", children: "Cancel" }), _jsx(Button, { onClick: handleCreateEnvironment, disabled: !formData.service_id || !formData.branch_name || createEnvironmentMutation.isPending, className: "flex-1", children: createEnvironmentMutation.isPending ? (_jsxs(_Fragment, { children: [_jsx(Loader2, { className: "w-4 h-4 mr-2 animate-spin" }), "Creating..."] })) : ('Create Preview') })] })] })] }) }))] }));
}
