import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Play, RotateCcw, Clock, CheckCircle, XCircle, Loader2, ChevronDown, Terminal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { formatDistanceToNow } from 'date-fns';
import { deploymentsApi } from '@/lib/api';
const statusConfig = {
    pending: { color: 'bg-gray-500', icon: Clock, label: 'Pending' },
    building: { color: 'bg-blue-500', icon: Loader2, label: 'Building', animate: true },
    deploying: { color: 'bg-yellow-500', icon: Loader2, label: 'Deploying', animate: true },
    deployed: { color: 'bg-green-500', icon: CheckCircle, label: 'Deployed' },
    failed: { color: 'bg-red-500', icon: XCircle, label: 'Failed' },
    rolling_back: { color: 'bg-orange-500', icon: RotateCcw, label: 'Rolling Back', animate: true },
};
function DeploymentsPanel({ serviceId, serviceName: _serviceName }) {
    const [expandedDeployment, setExpandedDeployment] = useState(null);
    const queryClient = useQueryClient();
    const { data: deployments, isLoading } = useQuery({
        queryKey: ['deployments', serviceId],
        queryFn: async () => {
            const response = await deploymentsApi.getDeployments(serviceId);
            return response.deployments;
        },
        refetchInterval: 5000,
    });
    const createDeployment = useMutation({
        mutationFn: async (data) => {
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
        mutationFn: async (deploymentId) => {
            const response = await deploymentsApi.rollbackDeployment(deploymentId);
            return response;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['deployments', serviceId] });
        },
    });
    if (isLoading) {
        return (_jsx(Card, { children: _jsx(CardContent, { className: "p-6", children: _jsx("div", { className: "flex items-center justify-center", children: _jsx(Loader2, { className: "w-6 h-6 animate-spin text-muted-foreground" }) }) }) }));
    }
    return (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("h3", { className: "text-lg font-semibold", children: "Deployments" }), _jsxs(Button, { onClick: () => createDeployment.mutate({}), disabled: createDeployment.isPending, size: "sm", children: [createDeployment.isPending ? (_jsx(Loader2, { className: "w-4 h-4 mr-2 animate-spin" })) : (_jsx(Play, { className: "w-4 h-4 mr-2" })), "Deploy"] })] }), !deployments || deployments.length === 0 ? (_jsx(Card, { children: _jsx(CardContent, { className: "p-6 text-center text-muted-foreground", children: "No deployments yet. Click \"Deploy\" to create your first deployment." }) })) : (_jsx("div", { className: "space-y-2", children: deployments.map((deployment) => {
                    const config = statusConfig[deployment.status] || statusConfig.pending;
                    const StatusIcon = config.icon;
                    const isExpanded = expandedDeployment === deployment.id;
                    return (_jsx(Collapsible, { open: isExpanded, onOpenChange: () => setExpandedDeployment(isExpanded ? null : deployment.id), children: _jsxs(Card, { className: isExpanded ? 'border-primary' : '', children: [_jsx(CollapsibleTrigger, { asChild: true, children: _jsx(CardHeader, { className: "cursor-pointer hover:bg-muted/50 transition-colors py-3", children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("div", { className: `p-2 rounded-full ${config.color}`, children: _jsx(StatusIcon, { className: `w-4 h-4 text-white ${config.animate ? 'animate-spin' : ''}` }) }), _jsxs("div", { children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "font-medium", children: deployment.commit_hash
                                                                                ? deployment.commit_hash.slice(0, 7)
                                                                                : 'Manual Deploy' }), _jsx(Badge, { variant: "outline", className: "text-xs", children: config.label })] }), _jsxs("div", { className: "flex items-center gap-2 text-sm text-muted-foreground", children: [_jsx(Clock, { className: "w-3 h-3" }), formatDistanceToNow(new Date(deployment.created_at), {
                                                                            addSuffix: true,
                                                                        })] })] })] }), _jsxs("div", { className: "flex items-center gap-2", children: [deployment.status === 'deployed' && (_jsxs(Button, { variant: "ghost", size: "sm", onClick: (e) => {
                                                                e.stopPropagation();
                                                                rollbackDeployment.mutate(deployment.id);
                                                            }, disabled: rollbackDeployment.isPending, children: [_jsx(RotateCcw, { className: "w-4 h-4 mr-1" }), "Rollback"] })), _jsx(ChevronDown, { className: `w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}` })] })] }) }) }), _jsx(CollapsibleContent, { children: _jsx(CardContent, { className: "pt-0 pb-4", children: _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "grid grid-cols-2 gap-4 text-sm", children: [_jsxs("div", { children: [_jsx("span", { className: "text-muted-foreground", children: "Image:" }), _jsxs("span", { className: "ml-2 font-mono", children: [deployment.image_name, ":", deployment.image_tag] })] }), deployment.commit_hash && (_jsxs("div", { children: [_jsx("span", { className: "text-muted-foreground", children: "Commit:" }), _jsx("span", { className: "ml-2 font-mono", children: deployment.commit_hash })] })), deployment.started_at && (_jsxs("div", { children: [_jsx("span", { className: "text-muted-foreground", children: "Started:" }), _jsx("span", { className: "ml-2", children: new Date(deployment.started_at).toLocaleString() })] })), deployment.completed_at && (_jsxs("div", { children: [_jsx("span", { className: "text-muted-foreground", children: "Completed:" }), _jsx("span", { className: "ml-2", children: new Date(deployment.completed_at).toLocaleString() })] }))] }), deployment.error && (_jsxs("div", { className: "p-3 bg-destructive/10 rounded-md", children: [_jsx("p", { className: "text-sm text-destructive font-medium", children: "Error:" }), _jsx("p", { className: "text-sm text-destructive/80 mt-1", children: deployment.error })] })), _jsx(DeploymentLogs, { deploymentId: deployment.id })] }) }) })] }) }, deployment.id));
                }) }))] }));
}
function DeploymentLogs({ deploymentId }) {
    const [activeTab, setActiveTab] = useState('build');
    const { data: logs, isLoading } = useQuery({
        queryKey: ['deployment-logs', deploymentId],
        queryFn: async () => {
            const response = await deploymentsApi.getDeployment(deploymentId);
            return response.deployment;
        },
    });
    if (isLoading) {
        return (_jsx("div", { className: "flex items-center justify-center p-4", children: _jsx(Loader2, { className: "w-4 h-4 animate-spin" }) }));
    }
    const currentLogs = activeTab === 'build' ? logs?.build_log : logs?.runtime_log;
    return (_jsxs("div", { className: "border rounded-md", children: [_jsxs("div", { className: "flex border-b", children: [_jsxs("button", { onClick: () => setActiveTab('build'), className: `flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${activeTab === 'build'
                            ? 'border-b-2 border-primary text-primary'
                            : 'text-muted-foreground hover:text-foreground'}`, children: [_jsx(Terminal, { className: "w-4 h-4" }), "Build Logs"] }), _jsxs("button", { onClick: () => setActiveTab('runtime'), className: `flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${activeTab === 'runtime'
                            ? 'border-b-2 border-primary text-primary'
                            : 'text-muted-foreground hover:text-foreground'}`, children: [_jsx(Terminal, { className: "w-4 h-4" }), "Runtime Logs"] })] }), _jsx("div", { className: "p-4 bg-muted/30 max-h-64 overflow-auto", children: _jsx("pre", { className: "text-xs font-mono whitespace-pre-wrap", children: currentLogs || 'No logs available' }) })] }));
}
