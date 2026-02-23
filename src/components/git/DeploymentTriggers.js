import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { GitBranch, Plus, Settings, Trash2, Play, Pause, Rocket, TestTube, Package, Loader2, ArrowRight, GitCommit } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
export default function DeploymentTriggers({ repositoryId, repositoryName, projectId }) {
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [triggerForm, setTriggerForm] = useState({
        webhook_id: '',
        service_id: '',
        branch: 'main',
        environment: 'preview',
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
                ]
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
        mutationFn: async (data) => {
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
    const getEnvironmentIcon = (environment) => {
        switch (environment) {
            case 'production':
                return _jsx(Rocket, { className: "w-4 h-4 text-red-500" });
            case 'preview':
                return _jsx(TestTube, { className: "w-4 h-4 text-blue-500" });
            case 'development':
                return _jsx(Package, { className: "w-4 h-4 text-gray-500" });
            default:
                return _jsx(Package, { className: "w-4 h-4" });
        }
    };
    const getEnvironmentColor = (environment) => {
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
        return (_jsx("div", { className: "space-y-4", children: _jsxs("div", { className: "animate-pulse", children: [_jsx("div", { className: "h-6 bg-gray-200 rounded w-1/4 mb-4" }), _jsx("div", { className: "space-y-3", children: [1, 2].map(i => (_jsx("div", { className: "h-32 bg-gray-200 rounded-lg" }, i))) })] }) }));
    }
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("h3", { className: "text-lg font-semibold", children: "Deployment Triggers" }), _jsx("p", { className: "text-sm text-muted-foreground", children: "Configure branch-based deployment triggers for your services" })] }), _jsxs(Button, { onClick: () => setIsCreateModalOpen(true), children: [_jsx(Plus, { className: "w-4 h-4 mr-2" }), "Create Trigger"] })] }), triggers.length === 0 ? (_jsx(Card, { children: _jsxs(CardContent, { className: "flex flex-col items-center justify-center py-12", children: [_jsx("div", { className: "w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4", children: _jsx(GitBranch, { className: "w-8 h-8 text-gray-400" }) }), _jsx("h3", { className: "text-lg font-semibold mb-2", children: "No deployment triggers configured" }), _jsx("p", { className: "text-gray-600 text-center mb-4", children: "Create triggers to automatically deploy your services when code is pushed to specific branches" }), _jsxs(Button, { onClick: () => setIsCreateModalOpen(true), children: [_jsx(Plus, { className: "w-4 h-4 mr-2" }), "Create Trigger"] })] }) })) : (_jsx("div", { className: "space-y-4", children: triggers.map((trigger) => (_jsxs(Card, { children: [_jsx(CardHeader, { className: "pb-3", children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("div", { className: `w-8 h-8 rounded-full flex items-center justify-center ${trigger.auto_deploy ? 'bg-green-100' : 'bg-gray-100'}`, children: trigger.auto_deploy ? (_jsx(Play, { className: "w-4 h-4 text-green-600" })) : (_jsx(Pause, { className: "w-4 h-4 text-gray-600" })) }), _jsxs("div", { children: [_jsxs(CardTitle, { className: "text-base flex items-center gap-2", children: [_jsx(GitBranch, { className: "w-4 h-4" }), trigger.branch, _jsx(ArrowRight, { className: "w-3 h-3 text-muted-foreground" }), trigger.service?.name] }), _jsxs("div", { className: "flex items-center gap-2 text-sm text-muted-foreground", children: [_jsx("span", { children: formatDistanceToNow(new Date(trigger.created_at), { addSuffix: true }) }), _jsx("span", { children: "\u2022" }), _jsxs("span", { children: ["Trigger ID: ", trigger.id.substring(0, 8)] })] })] })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsxs(Badge, { className: getEnvironmentColor(trigger.environment), children: [getEnvironmentIcon(trigger.environment), trigger.environment] }), _jsx(Badge, { variant: trigger.auto_deploy ? 'default' : 'secondary', children: trigger.auto_deploy ? 'Auto Deploy' : 'Manual' }), _jsx(Button, { variant: "ghost", size: "icon", className: "h-8 w-8", children: _jsx(Settings, { className: "w-4 h-4" }) }), _jsx(Button, { variant: "ghost", size: "icon", className: "h-8 w-8", children: _jsx(Trash2, { className: "w-4 h-4" }) })] })] }) }), _jsxs(CardContent, { className: "space-y-4", children: [_jsxs("div", { className: "grid grid-cols-2 gap-4 text-sm", children: [_jsxs("div", { children: [_jsx(Label, { className: "text-xs font-medium", children: "Service" }), _jsxs("div", { className: "flex items-center gap-2 mt-1", children: [_jsx("span", { className: "font-medium", children: trigger.service?.name }), _jsx(Badge, { variant: "outline", className: "text-xs", children: trigger.service?.type })] })] }), _jsxs("div", { children: [_jsx(Label, { className: "text-xs font-medium", children: "Branch" }), _jsxs("div", { className: "flex items-center gap-2 mt-1", children: [_jsx(GitBranch, { className: "w-3 h-3" }), _jsx("code", { className: "text-sm bg-muted px-2 py-1 rounded", children: trigger.branch })] })] })] }), (trigger.build_command || trigger.start_command) && (_jsxs("div", { children: [_jsx(Label, { className: "text-xs font-medium", children: "Commands" }), _jsxs("div", { className: "space-y-1 mt-1", children: [trigger.build_command && (_jsxs("div", { className: "text-xs", children: [_jsx("span", { className: "font-medium", children: "Build:" }), _jsx("code", { className: "ml-1 bg-muted px-1 py-0.5 rounded", children: trigger.build_command })] })), trigger.start_command && (_jsxs("div", { className: "text-xs", children: [_jsx("span", { className: "font-medium", children: "Start:" }), _jsx("code", { className: "ml-1 bg-muted px-1 py-0.5 rounded", children: trigger.start_command })] }))] })] })), _jsx("div", { className: "bg-muted p-3 rounded-lg", children: _jsxs("div", { className: "flex items-center gap-2 text-sm", children: [_jsx(GitCommit, { className: "w-4 h-4" }), _jsxs("span", { children: ["Push to ", trigger.branch] }), _jsx(ArrowRight, { className: "w-3 h-3" }), _jsx("span", { children: "Trigger webhook" }), _jsx(ArrowRight, { className: "w-3 h-3" }), _jsxs("span", { children: ["Deploy to ", trigger.environment] }), trigger.auto_deploy ? (_jsxs(_Fragment, { children: [_jsx(ArrowRight, { className: "w-3 h-3" }), _jsx("span", { className: "text-green-600", children: "Auto deploy" })] })) : (_jsxs(_Fragment, { children: [_jsx(ArrowRight, { className: "w-3 h-3" }), _jsx("span", { className: "text-orange-600", children: "Manual approval" })] }))] }) })] })] }, trigger.id))) })), isCreateModalOpen && (_jsx("div", { className: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50", children: _jsxs(Card, { className: "w-full max-w-md", children: [_jsxs(CardHeader, { children: [_jsx(CardTitle, { children: "Create Deployment Trigger" }), _jsxs("p", { className: "text-sm text-muted-foreground", children: ["for ", repositoryName] })] }), _jsxs(CardContent, { className: "space-y-4", children: [_jsxs("div", { children: [_jsx(Label, { htmlFor: "webhook", children: "Webhook" }), _jsxs("select", { id: "webhook", value: triggerForm.webhook_id, onChange: (e) => setTriggerForm({ ...triggerForm, webhook_id: e.target.value }), className: "mt-1 w-full p-2 border rounded-md", children: [_jsx("option", { value: "", children: "Select webhook" }), webhooks.map((webhook) => (_jsxs("option", { value: webhook.id, children: ["Webhook ", webhook.id.substring(0, 8), " (", webhook.events.join(', '), ")"] }, webhook.id)))] })] }), _jsxs("div", { children: [_jsx(Label, { htmlFor: "service", children: "Service" }), _jsxs("select", { id: "service", value: triggerForm.service_id, onChange: (e) => setTriggerForm({ ...triggerForm, service_id: e.target.value }), className: "mt-1 w-full p-2 border rounded-md", children: [_jsx("option", { value: "", children: "Select service" }), services.map((service) => (_jsxs("option", { value: service.id, children: [service.name, " (", service.type, ")"] }, service.id)))] })] }), _jsxs("div", { children: [_jsx(Label, { htmlFor: "branch", children: "Branch" }), _jsx(Input, { id: "branch", value: triggerForm.branch, onChange: (e) => setTriggerForm({ ...triggerForm, branch: e.target.value }), placeholder: "main", className: "mt-1" })] }), _jsxs("div", { children: [_jsx(Label, { htmlFor: "environment", children: "Environment" }), _jsxs("select", { id: "environment", value: triggerForm.environment, onChange: (e) => setTriggerForm({ ...triggerForm, environment: e.target.value }), className: "mt-1 w-full p-2 border rounded-md", children: [_jsx("option", { value: "development", children: "Development" }), _jsx("option", { value: "preview", children: "Preview" }), _jsx("option", { value: "production", children: "Production" })] })] }), _jsxs("div", { children: [_jsx(Label, { htmlFor: "build-command", children: "Build Command (Optional)" }), _jsx(Input, { id: "build-command", value: triggerForm.build_command, onChange: (e) => setTriggerForm({ ...triggerForm, build_command: e.target.value }), placeholder: "npm run build", className: "mt-1" })] }), _jsxs("div", { children: [_jsx(Label, { htmlFor: "start-command", children: "Start Command (Optional)" }), _jsx(Input, { id: "start-command", value: triggerForm.start_command, onChange: (e) => setTriggerForm({ ...triggerForm, start_command: e.target.value }), placeholder: "npm start", className: "mt-1" })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("input", { type: "checkbox", id: "auto-deploy", checked: triggerForm.auto_deploy, onChange: (e) => setTriggerForm({ ...triggerForm, auto_deploy: e.target.checked }), className: "rounded" }), _jsx(Label, { htmlFor: "auto-deploy", children: "Auto-deploy on push" })] }), _jsxs("div", { className: "flex gap-2 pt-4", children: [_jsx(Button, { variant: "outline", onClick: () => {
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
                                            }, className: "flex-1", children: "Cancel" }), _jsx(Button, { onClick: handleCreateTrigger, disabled: !triggerForm.webhook_id || !triggerForm.service_id || !triggerForm.branch || createTriggerMutation.isPending, className: "flex-1", children: createTriggerMutation.isPending ? (_jsxs(_Fragment, { children: [_jsx(Loader2, { className: "w-4 h-4 mr-2 animate-spin" }), "Creating..."] })) : ('Create Trigger') })] })] })] }) }))] }));
}
