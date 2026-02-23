import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { gitApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Webhook, Plus, Settings, Trash2, Eye, EyeOff, Copy, CheckCircle, AlertTriangle, Loader2, GitBranch, GitPullRequest, GitCommit } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import DeploymentTriggers from './DeploymentTriggers';
export default function WebhookManager({ repositoryId, repositoryName, projectId }) {
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [showSecret, setShowSecret] = useState(null);
    const [activeTab, setActiveTab] = useState('webhooks');
    const [webhookForm, setWebhookForm] = useState({
        repo_id: repositoryId,
        events: ['push'],
        branch: ''
    });
    const queryClient = useQueryClient();
    // Mock webhook data for now - in real implementation, this would come from an API
    const { data: webhooksData, isLoading } = useQuery({
        queryKey: ['webhooks', repositoryId],
        queryFn: async () => {
            // TODO: Replace with actual API call
            return {
                webhooks: [
                    {
                        id: 'webhook-1',
                        repo_id: repositoryId,
                        events: ['push', 'pull_request'],
                        active: true,
                        branch_filter: 'main',
                        created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
                        remote_webhook_id: 'remote-123'
                    }
                ]
            };
        },
    });
    const createWebhookMutation = useMutation({
        mutationFn: gitApi.createWebhook,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['webhooks', repositoryId] });
            setIsCreateModalOpen(false);
            setWebhookForm({ repo_id: repositoryId, events: ['push'], branch: '' });
        },
    });
    const webhooks = webhooksData?.webhooks || [];
    const handleCreateWebhook = () => {
        createWebhookMutation.mutate({
            repo_id: webhookForm.repo_id,
            events: webhookForm.events,
            branch: webhookForm.branch || undefined
        });
    };
    const getEventIcon = (event) => {
        switch (event) {
            case 'push':
                return _jsx(GitCommit, { className: "w-4 h-4" });
            case 'pull_request':
                return _jsx(GitPullRequest, { className: "w-4 h-4" });
            default:
                return _jsx(GitBranch, { className: "w-4 h-4" });
        }
    };
    const getEventLabel = (event) => {
        switch (event) {
            case 'push':
                return 'Push';
            case 'pull_request':
                return 'Pull Request';
            case 'release':
                return 'Release';
            default:
                return event;
        }
    };
    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
    };
    if (isLoading) {
        return (_jsx("div", { className: "space-y-4", children: _jsxs("div", { className: "animate-pulse", children: [_jsx("div", { className: "h-6 bg-gray-200 rounded w-1/4 mb-4" }), _jsx("div", { className: "space-y-3", children: [1, 2].map(i => (_jsx("div", { className: "h-32 bg-gray-200 rounded-lg" }, i))) })] }) }));
    }
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("h3", { className: "text-lg font-semibold", children: "Git Configuration" }), _jsxs("p", { className: "text-sm text-muted-foreground", children: ["Configure webhooks and deployment triggers for ", repositoryName] })] }), activeTab === 'webhooks' && (_jsxs(Button, { onClick: () => setIsCreateModalOpen(true), children: [_jsx(Plus, { className: "w-4 h-4 mr-2" }), "Create Webhook"] }))] }), _jsxs("div", { className: "flex gap-1 bg-muted rounded-lg p-1", children: [_jsxs(Button, { variant: activeTab === 'webhooks' ? 'default' : 'ghost', size: "sm", onClick: () => setActiveTab('webhooks'), children: [_jsx(Webhook, { className: "w-4 h-4 mr-2" }), "Webhooks"] }), _jsxs(Button, { variant: activeTab === 'triggers' ? 'default' : 'ghost', size: "sm", onClick: () => setActiveTab('triggers'), children: [_jsx(GitBranch, { className: "w-4 h-4 mr-2" }), "Deployment Triggers"] })] }), activeTab === 'webhooks' && (_jsx("div", { children: webhooks.length === 0 ? (_jsx(Card, { children: _jsxs(CardContent, { className: "flex flex-col items-center justify-center py-12", children: [_jsx("div", { className: "w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4", children: _jsx(Webhook, { className: "w-8 h-8 text-gray-400" }) }), _jsx("h3", { className: "text-lg font-semibold mb-2", children: "No webhooks configured" }), _jsx("p", { className: "text-gray-600 text-center mb-4", children: "Create a webhook to automatically trigger deployments when you push to your repository" }), _jsxs(Button, { onClick: () => setIsCreateModalOpen(true), children: [_jsx(Plus, { className: "w-4 h-4 mr-2" }), "Create Webhook"] })] }) })) : (_jsx("div", { className: "space-y-4", children: webhooks.map((webhook) => (_jsxs(Card, { children: [_jsx(CardHeader, { className: "pb-3", children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("div", { className: `w-8 h-8 rounded-full flex items-center justify-center ${webhook.active ? 'bg-green-100' : 'bg-gray-100'}`, children: webhook.active ? (_jsx(CheckCircle, { className: "w-4 h-4 text-green-600" })) : (_jsx(AlertTriangle, { className: "w-4 h-4 text-gray-600" })) }), _jsxs("div", { children: [_jsx(CardTitle, { className: "text-base", children: "Webhook" }), _jsxs("div", { className: "flex items-center gap-2 text-sm text-muted-foreground", children: [_jsxs("span", { children: ["ID: ", webhook.id.substring(0, 8)] }), _jsx("span", { children: "\u2022" }), _jsx("span", { children: formatDistanceToNow(new Date(webhook.created_at), { addSuffix: true }) })] })] })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Badge, { variant: webhook.active ? 'default' : 'secondary', children: webhook.active ? 'Active' : 'Inactive' }), _jsx(Button, { variant: "ghost", size: "icon", className: "h-8 w-8", children: _jsx(Settings, { className: "w-4 h-4" }) }), _jsx(Button, { variant: "ghost", size: "icon", className: "h-8 w-8", children: _jsx(Trash2, { className: "w-4 h-4" }) })] })] }) }), _jsxs(CardContent, { className: "space-y-4", children: [_jsxs("div", { children: [_jsx(Label, { className: "text-sm font-medium", children: "Events" }), _jsx("div", { className: "flex flex-wrap gap-2 mt-2", children: webhook.events.map((event) => (_jsxs(Badge, { variant: "outline", className: "flex items-center gap-1", children: [getEventIcon(event), getEventLabel(event)] }, event))) })] }), webhook.branch_filter && (_jsxs("div", { children: [_jsx(Label, { className: "text-sm font-medium", children: "Branch Filter" }), _jsxs("div", { className: "flex items-center gap-2 mt-1", children: [_jsx(GitBranch, { className: "w-4 h-4 text-muted-foreground" }), _jsx("code", { className: "text-sm bg-muted px-2 py-1 rounded", children: webhook.branch_filter })] })] })), _jsxs("div", { children: [_jsx(Label, { className: "text-sm font-medium", children: "Webhook URL" }), _jsxs("div", { className: "flex items-center gap-2 mt-1", children: [_jsx("code", { className: "text-sm bg-muted px-2 py-1 rounded flex-1 truncate", children: `https://your-domain.com/api/v1/webhooks/git/${repositoryId}` }), _jsx(Button, { variant: "outline", size: "sm", onClick: () => copyToClipboard(`https://your-domain.com/api/v1/webhooks/git/${repositoryId}`), children: _jsx(Copy, { className: "w-3 h-3" }) })] })] }), _jsxs("div", { children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx(Label, { className: "text-sm font-medium", children: "Webhook Secret" }), _jsx(Button, { variant: "ghost", size: "sm", onClick: () => setShowSecret(showSecret === webhook.id ? null : webhook.id), children: showSecret === webhook.id ? (_jsx(EyeOff, { className: "w-3 h-3" })) : (_jsx(Eye, { className: "w-3 h-3" })) })] }), _jsxs("div", { className: "flex items-center gap-2 mt-1", children: [_jsx("code", { className: "text-sm bg-muted px-2 py-1 rounded flex-1 truncate", children: showSecret === webhook.id
                                                            ? 'webhook-secret-' + webhook.id.substring(0, 8)
                                                            : '••••••••••••••••' }), _jsx(Button, { variant: "outline", size: "sm", onClick: () => copyToClipboard('webhook-secret-' + webhook.id.substring(0, 8)), children: _jsx(Copy, { className: "w-3 h-3" }) })] })] })] })] }, webhook.id))) })) })), activeTab === 'triggers' && projectId && (_jsx(DeploymentTriggers, { repositoryId: repositoryId, repositoryName: repositoryName, projectId: projectId })), isCreateModalOpen && (_jsx("div", { className: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50", children: _jsxs(Card, { className: "w-full max-w-md", children: [_jsxs(CardHeader, { children: [_jsx(CardTitle, { children: "Create Webhook" }), _jsxs("p", { className: "text-sm text-muted-foreground", children: ["for ", repositoryName] })] }), _jsxs(CardContent, { className: "space-y-4", children: [_jsxs("div", { children: [_jsx(Label, { children: "Events" }), _jsx("div", { className: "space-y-2 mt-2", children: ['push', 'pull_request', 'release'].map((event) => (_jsxs("label", { className: "flex items-center gap-2", children: [_jsx("input", { type: "checkbox", checked: webhookForm.events.includes(event), onChange: (e) => {
                                                            if (e.target.checked) {
                                                                setWebhookForm({ ...webhookForm, events: [...webhookForm.events, event] });
                                                            }
                                                            else {
                                                                setWebhookForm({
                                                                    ...webhookForm,
                                                                    events: webhookForm.events.filter(e => e !== event)
                                                                });
                                                            }
                                                        }, className: "rounded" }), _jsxs("div", { className: "flex items-center gap-2", children: [getEventIcon(event), getEventLabel(event)] })] }, event))) })] }), _jsxs("div", { children: [_jsx(Label, { htmlFor: "branch", children: "Branch Filter (Optional)" }), _jsx(Input, { id: "branch", value: webhookForm.branch, onChange: (e) => setWebhookForm({ ...webhookForm, branch: e.target.value }), placeholder: "main", className: "mt-1" }), _jsx("p", { className: "text-xs text-muted-foreground mt-1", children: "Only trigger deployments for this branch" })] }), _jsxs("div", { className: "bg-muted p-3 rounded-lg", children: [_jsx("p", { className: "text-sm font-medium mb-2", children: "Webhook will be created with:" }), _jsxs("ul", { className: "text-xs text-muted-foreground space-y-1", children: [_jsxs("li", { children: ["\u2022 URL: https://your-domain.com/api/v1/webhooks/git/", repositoryId] }), _jsx("li", { children: "\u2022 Auto-generated secret for security" }), _jsx("li", { children: "\u2022 SSL verification enabled" }), _jsx("li", { children: "\u2022 Content type: application/json" })] })] }), _jsxs("div", { className: "flex gap-2 pt-4", children: [_jsx(Button, { variant: "outline", onClick: () => {
                                                setIsCreateModalOpen(false);
                                                setWebhookForm({ repo_id: repositoryId, events: ['push'], branch: '' });
                                            }, className: "flex-1", children: "Cancel" }), _jsx(Button, { onClick: handleCreateWebhook, disabled: webhookForm.events.length === 0 || createWebhookMutation.isPending, className: "flex-1", children: createWebhookMutation.isPending ? (_jsxs(_Fragment, { children: [_jsx(Loader2, { className: "w-4 h-4 mr-2 animate-spin" }), "Creating..."] })) : ('Create Webhook') })] })] })] }) }))] }));
}
