import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { gitApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, Github, GitBranch, Link, Settings, Eye, Trash2, Webhook, GitPullRequest, CheckCircle, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import WebhookManager from '@/components/git/WebhookManager';
export default function GitIntegrationPage() {
    const [searchTerm, setSearchTerm] = useState('');
    const [isProviderModalOpen, setIsProviderModalOpen] = useState(false);
    const [isRepoModalOpen, setIsRepoModalOpen] = useState(false);
    const [selectedProvider, setSelectedProvider] = useState(null);
    const [selectedRepository, setSelectedRepository] = useState(null);
    const [providerForm, setProviderForm] = useState({
        name: 'github',
        display_name: '',
        access_token: ''
    });
    const [repoForm, setRepoForm] = useState({
        provider_id: '',
        repo_full_name: ''
    });
    const queryClient = useQueryClient();
    // Queries
    const { data: providersData, isLoading: providersLoading } = useQuery({
        queryKey: ['git-providers'],
        queryFn: gitApi.getProviders,
    });
    const { data: reposData, isLoading: reposLoading } = useQuery({
        queryKey: ['git-repositories'],
        queryFn: () => gitApi.getConnectedRepositories(),
    });
    // Mutations
    const createProviderMutation = useMutation({
        mutationFn: gitApi.createProvider,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['git-providers'] });
            setIsProviderModalOpen(false);
            setProviderForm({ name: 'github', display_name: '', access_token: '' });
        },
    });
    const connectRepoMutation = useMutation({
        mutationFn: gitApi.connectRepository,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['git-repositories'] });
            setIsRepoModalOpen(false);
            setRepoForm({ provider_id: '', repo_full_name: '' });
        },
    });
    const providers = providersData?.providers || [];
    const repositories = reposData?.repositories || [];
    const filteredRepos = repositories.filter(repo => repo.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        repo.full_name.toLowerCase().includes(searchTerm.toLowerCase()));
    const handleCreateProvider = () => {
        createProviderMutation.mutate(providerForm);
    };
    const handleConnectRepository = () => {
        connectRepoMutation.mutate(repoForm);
    };
    const openRepoModal = (provider) => {
        setSelectedProvider(provider);
        setRepoForm({ provider_id: provider.id, repo_full_name: '' });
        setIsRepoModalOpen(true);
    };
    const getProviderIcon = (name) => {
        switch (name) {
            case 'github':
                return _jsx(Github, { className: "w-5 h-5" });
            case 'gitlab':
                return _jsx(GitBranch, { className: "w-5 h-5" });
            case 'bitbucket':
                return _jsx(GitPullRequest, { className: "w-5 h-5" });
            default:
                return _jsx(GitBranch, { className: "w-5 h-5" });
        }
    };
    const getProviderColor = (name) => {
        switch (name) {
            case 'github':
                return 'bg-gray-800';
            case 'gitlab':
                return 'bg-orange-500';
            case 'bitbucket':
                return 'bg-blue-500';
            default:
                return 'bg-gray-500';
        }
    };
    if (providersLoading || reposLoading) {
        return (_jsx("div", { className: "p-6", children: _jsxs("div", { className: "animate-pulse space-y-4", children: [_jsx("div", { className: "h-8 bg-gray-200 rounded w-1/4" }), _jsx("div", { className: "grid gap-4 md:grid-cols-2", children: [1, 2, 3, 4].map(i => (_jsx("div", { className: "h-48 bg-gray-200 rounded-lg" }, i))) })] }) }));
    }
    return (_jsxs("div", { className: "p-6 space-y-6", children: [_jsxs("div", { className: "flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-2xl md:text-3xl font-bold text-foreground", children: "Git Integration" }), _jsx("p", { className: "text-sm md:text-base text-muted-foreground", children: "Connect your Git providers and repositories for seamless deployments" })] }), _jsxs(Button, { onClick: () => setIsProviderModalOpen(true), className: "w-full sm:w-auto", children: [_jsx(Plus, { className: "w-4 h-4 mr-2" }), "Add Git Provider"] })] }), _jsxs("div", { className: "space-y-4", children: [_jsx("h2", { className: "text-lg font-semibold", children: "Connected Git Providers" }), providers.length === 0 ? (_jsx(Card, { children: _jsxs(CardContent, { className: "flex flex-col items-center justify-center py-12", children: [_jsx("div", { className: "w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4", children: _jsx(Github, { className: "w-8 h-8 text-gray-400" }) }), _jsx("h3", { className: "text-lg font-semibold mb-2", children: "No Git providers connected" }), _jsx("p", { className: "text-gray-600 text-center mb-4", children: "Connect your GitHub, GitLab, or Bitbucket account to start deploying from your repositories" }), _jsxs(Button, { onClick: () => setIsProviderModalOpen(true), children: [_jsx(Plus, { className: "w-4 h-4 mr-2" }), "Connect Git Provider"] })] }) })) : (_jsx("div", { className: "grid gap-4 md:grid-cols-2 lg:grid-cols-3", children: providers.map((provider) => (_jsxs(Card, { className: "group hover:shadow-lg transition-all duration-200", children: [_jsx(CardHeader, { className: "pb-3", children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("div", { className: `w-10 h-10 rounded-lg ${getProviderColor(provider.name)} flex items-center justify-center text-white`, children: getProviderIcon(provider.name) }), _jsxs("div", { children: [_jsx(CardTitle, { className: "text-lg", children: provider.display_name }), _jsx(Badge, { variant: "outline", className: "text-xs", children: provider.name })] })] }), _jsxs(Button, { variant: "outline", size: "sm", onClick: () => openRepoModal(provider), children: [_jsx(Link, { className: "w-3 h-3 mr-1" }), "Connect Repo"] })] }) }), _jsx(CardContent, { children: _jsxs("div", { className: "text-sm text-muted-foreground", children: ["Connected ", formatDistanceToNow(new Date(provider.created_at), { addSuffix: true })] }) })] }, provider.id))) }))] }), _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4", children: [_jsx("h2", { className: "text-lg font-semibold", children: "Connected Repositories" }), _jsxs("div", { className: "relative", children: [_jsx(Search, { className: "absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" }), _jsx(Input, { placeholder: "Search repositories...", value: searchTerm, onChange: (e) => setSearchTerm(e.target.value), className: "pl-10 w-full sm:w-64" })] })] }), filteredRepos.length === 0 ? (_jsx(Card, { children: _jsxs(CardContent, { className: "flex flex-col items-center justify-center py-12", children: [_jsx("div", { className: "w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4", children: _jsx(GitBranch, { className: "w-8 h-8 text-gray-400" }) }), _jsx("h3", { className: "text-lg font-semibold mb-2", children: searchTerm ? 'No repositories found' : 'No repositories connected' }), _jsx("p", { className: "text-gray-600 text-center mb-4", children: searchTerm
                                        ? 'Try adjusting your search terms'
                                        : 'Connect repositories from your Git providers to enable deployments' }), providers.length > 0 && !searchTerm && (_jsxs(Button, { onClick: () => openRepoModal(providers[0]), children: [_jsx(Plus, { className: "w-4 h-4 mr-2" }), "Connect Repository"] }))] }) })) : (_jsx("div", { className: "grid gap-4 md:grid-cols-2", children: filteredRepos.map((repo) => (_jsxs(Card, { className: "group hover:shadow-lg transition-all duration-200", children: [_jsx(CardHeader, { className: "pb-3", children: _jsxs("div", { className: "flex items-start justify-between", children: [_jsxs("div", { className: "flex-1", children: [_jsxs("div", { className: "flex items-center gap-2 mb-2", children: [getProviderIcon(repo.provider.name), _jsx(CardTitle, { className: "text-lg font-semibold truncate", children: repo.name }), repo.is_private && (_jsx(Badge, { variant: "secondary", className: "text-xs", children: "Private" }))] }), _jsx("p", { className: "text-sm text-muted-foreground font-mono", children: repo.full_name }), repo.description && (_jsx("p", { className: "text-sm text-muted-foreground mt-1 line-clamp-2", children: repo.description }))] }), _jsxs("div", { className: "flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity", children: [_jsx(Button, { variant: "ghost", size: "icon", className: "h-8 w-8", children: _jsx(Settings, { className: "w-4 h-4" }) }), _jsx(Button, { variant: "ghost", size: "icon", className: "h-8 w-8", children: _jsx(Trash2, { className: "w-4 h-4" }) })] })] }) }), _jsxs(CardContent, { className: "space-y-3", children: [_jsxs("div", { className: "flex items-center justify-between text-sm", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(GitBranch, { className: "w-3 h-3" }), _jsxs("span", { children: ["Default: ", repo.default_branch] })] }), _jsxs("div", { className: "flex items-center gap-1", children: [_jsx(CheckCircle, { className: "w-3 h-3 text-green-500" }), _jsx("span", { className: "text-green-600", children: "Connected" })] })] }), _jsxs("div", { className: "flex gap-2 pt-2", children: [_jsxs(Button, { variant: "outline", size: "sm", className: "flex-1", children: [_jsx(Eye, { className: "w-3 h-3 mr-1" }), "View"] }), _jsxs(Button, { size: "sm", className: "flex-1", onClick: () => setSelectedRepository(repo), children: [_jsx(Webhook, { className: "w-3 h-3 mr-1" }), "Webhooks"] })] })] })] }, repo.id))) }))] }), isProviderModalOpen && (_jsx("div", { className: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50", children: _jsxs(Card, { className: "w-full max-w-md", children: [_jsx(CardHeader, { children: _jsx(CardTitle, { children: "Connect Git Provider" }) }), _jsxs(CardContent, { className: "space-y-4", children: [_jsxs("div", { children: [_jsx(Label, { htmlFor: "provider", children: "Provider" }), _jsxs("select", { id: "provider", value: providerForm.name, onChange: (e) => setProviderForm({ ...providerForm, name: e.target.value }), className: "mt-1 w-full p-2 border rounded-md", children: [_jsx("option", { value: "github", children: "GitHub" }), _jsx("option", { value: "gitlab", children: "GitLab" }), _jsx("option", { value: "bitbucket", children: "Bitbucket" })] })] }), _jsxs("div", { children: [_jsx(Label, { htmlFor: "display-name", children: "Display Name" }), _jsx(Input, { id: "display-name", value: providerForm.display_name, onChange: (e) => setProviderForm({ ...providerForm, display_name: e.target.value }), placeholder: "My GitHub Account", className: "mt-1" })] }), _jsxs("div", { children: [_jsx(Label, { htmlFor: "access-token", children: "Access Token" }), _jsx(Input, { id: "access-token", type: "password", value: providerForm.access_token, onChange: (e) => setProviderForm({ ...providerForm, access_token: e.target.value }), placeholder: "ghp_xxxxxxxxxxxx", className: "mt-1" }), _jsx("p", { className: "text-xs text-muted-foreground mt-1", children: "Generate a personal access token with repository permissions" })] }), _jsxs("div", { className: "flex gap-2 pt-4", children: [_jsx(Button, { variant: "outline", onClick: () => {
                                                setIsProviderModalOpen(false);
                                                setProviderForm({ name: 'github', display_name: '', access_token: '' });
                                            }, className: "flex-1", children: "Cancel" }), _jsx(Button, { onClick: handleCreateProvider, disabled: !providerForm.display_name || !providerForm.access_token || createProviderMutation.isPending, className: "flex-1", children: createProviderMutation.isPending ? (_jsxs(_Fragment, { children: [_jsx(Loader2, { className: "w-4 h-4 mr-2 animate-spin" }), "Connecting..."] })) : ('Connect Provider') })] })] })] }) })), isRepoModalOpen && selectedProvider && (_jsx("div", { className: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50", children: _jsxs(Card, { className: "w-full max-w-md", children: [_jsxs(CardHeader, { children: [_jsx(CardTitle, { children: "Connect Repository" }), _jsxs("p", { className: "text-sm text-muted-foreground", children: ["from ", selectedProvider.display_name] })] }), _jsxs(CardContent, { className: "space-y-4", children: [_jsxs("div", { children: [_jsx(Label, { htmlFor: "repo-full-name", children: "Repository Name" }), _jsx(Input, { id: "repo-full-name", value: repoForm.repo_full_name, onChange: (e) => setRepoForm({ ...repoForm, repo_full_name: e.target.value }), placeholder: "owner/repository-name", className: "mt-1" }), _jsx("p", { className: "text-xs text-muted-foreground mt-1", children: "Enter the full repository name (e.g., \"username/my-repo\")" })] }), _jsxs("div", { className: "flex gap-2 pt-4", children: [_jsx(Button, { variant: "outline", onClick: () => {
                                                setIsRepoModalOpen(false);
                                                setRepoForm({ provider_id: '', repo_full_name: '' });
                                            }, className: "flex-1", children: "Cancel" }), _jsx(Button, { onClick: handleConnectRepository, disabled: !repoForm.repo_full_name || connectRepoMutation.isPending, className: "flex-1", children: connectRepoMutation.isPending ? (_jsxs(_Fragment, { children: [_jsx(Loader2, { className: "w-4 h-4 mr-2 animate-spin" }), "Connecting..."] })) : ('Connect Repository') })] })] })] }) })), selectedRepository && (_jsx("div", { className: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50", children: _jsxs("div", { className: "bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-auto", children: [_jsx("div", { className: "p-6 border-b", children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("h2", { className: "text-xl font-semibold", children: "Webhook Management" }), _jsx("p", { className: "text-sm text-muted-foreground", children: selectedRepository.full_name })] }), _jsx(Button, { variant: "outline", onClick: () => setSelectedRepository(null), children: "Close" })] }) }), _jsx("div", { className: "p-6", children: _jsx(WebhookManager, { repositoryId: selectedRepository.id, repositoryName: selectedRepository.full_name, projectId: "project-1" // TODO: Get actual project ID
                             }) })] }) }))] }));
}
