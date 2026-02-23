import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { agentsApi } from '@/lib/agents';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Server, Plus, Search, Trash2, Eye, Cpu, HardDrive, MemoryStick, Network, Activity, Settings, RefreshCw, Container } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
export default function NodeAgentsPage() {
    const [searchTerm, setSearchTerm] = useState('');
    const [_isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [selectedAgent, setSelectedAgent] = useState(null);
    const [_selectedContainer, _setSelectedContainer] = useState(null);
    const { data: agents, isLoading, error, refetch } = useQuery({
        queryKey: ['agents'],
        queryFn: () => agentsApi.getAgents().then(res => res.agents),
        refetchInterval: 30000,
    });
    const deleteAgentMutation = useMutation({
        mutationFn: agentsApi.deleteAgent,
        onSuccess: () => {
            refetch();
        },
    });
    const containerActionMutation = useMutation({
        mutationFn: ({ agentId, containerId, action }) => {
            switch (action) {
                case 'start':
                    return agentsApi.startContainer(agentId, containerId);
                case 'stop':
                    return agentsApi.stopContainer(agentId, containerId);
                case 'restart':
                    return agentsApi.restartContainer(agentId, containerId);
                case 'remove':
                    return agentsApi.removeContainer(agentId, containerId);
                default:
                    throw new Error(`Unknown action: ${action}`);
            }
        },
        onSuccess: () => {
            refetch();
        },
    });
    const filteredAgents = agents?.filter(agent => agent.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        agent.hostname.toLowerCase().includes(searchTerm.toLowerCase()) ||
        agent.ip_address.includes(searchTerm)) || [];
    const getStatusColor = (status) => {
        switch (status) {
            case 'online': return 'bg-green-500';
            case 'offline': return 'bg-red-500';
            case 'connecting': return 'bg-yellow-500';
            case 'error': return 'bg-red-500';
            default: return 'bg-gray-500';
        }
    };
    const getStatusBadge = (status) => {
        switch (status) {
            case 'online': return _jsx(Badge, { className: "bg-green-100 text-green-800", children: "Online" });
            case 'offline': return _jsx(Badge, { className: "bg-red-100 text-red-800", children: "Offline" });
            case 'connecting': return _jsx(Badge, { className: "bg-yellow-100 text-yellow-800", children: "Connecting" });
            case 'error': return _jsx(Badge, { className: "bg-red-100 text-red-800", children: "Error" });
            default: return _jsx(Badge, { className: "bg-gray-100 text-gray-800", children: "Unknown" });
        }
    };
    const _getContainerStatusBadge = (status) => {
        switch (status) {
            case 'running': return _jsx(Badge, { className: "bg-green-100 text-green-800", children: "Running" });
            case 'stopped': return _jsx(Badge, { className: "bg-gray-100 text-gray-800", children: "Stopped" });
            case 'paused': return _jsx(Badge, { className: "bg-yellow-100 text-yellow-800", children: "Paused" });
            case 'restarting': return _jsx(Badge, { className: "bg-blue-100 text-blue-800", children: "Restarting" });
            default: return _jsx(Badge, { className: "bg-gray-100 text-gray-800", children: status });
        }
    };
    const formatBytes = (bytes) => {
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        if (bytes === 0)
            return '0 B';
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    };
    const _handleContainerAction = (agentId, containerId, action) => {
        if (action === 'remove' && !confirm('Are you sure you want to remove this container? This action cannot be undone.')) {
            return;
        }
        containerActionMutation.mutate({ agentId, containerId, action });
    };
    if (isLoading) {
        return (_jsx("div", { className: "p-6", children: _jsxs("div", { className: "animate-pulse space-y-4", children: [_jsx("div", { className: "h-8 bg-gray-200 rounded w-1/4" }), _jsx("div", { className: "grid gap-4 md:grid-cols-2 lg:grid-cols-3", children: [1, 2, 3, 4, 5, 6].map(i => (_jsx("div", { className: "h-64 bg-gray-200 rounded-lg" }, i))) })] }) }));
    }
    if (error) {
        return (_jsx("div", { className: "p-6", children: _jsxs("div", { className: "text-center py-12", children: [_jsx("h2", { className: "text-2xl font-semibold text-gray-900", children: "Error loading node agents" }), _jsx("p", { className: "text-gray-600 mt-2", children: "Please check your connection and try again." })] }) }));
    }
    return (_jsxs("div", { className: "p-6 space-y-6", children: [_jsxs("div", { className: "flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-2xl md:text-3xl font-bold text-foreground", children: "Node Agents" }), _jsx("p", { className: "text-sm md:text-base text-muted-foreground", children: "Manage container orchestration agents across your infrastructure" })] }), _jsxs("div", { className: "flex gap-2", children: [_jsxs(Button, { variant: "outline", onClick: () => refetch(), children: [_jsx(RefreshCw, { className: "w-4 h-4 mr-2" }), "Refresh"] }), _jsxs(Button, { onClick: () => setIsCreateModalOpen(true), children: [_jsx(Plus, { className: "w-4 h-4 mr-2" }), "Add Agent"] })] })] }), _jsx("div", { className: "flex flex-col sm:flex-row gap-4", children: _jsxs("div", { className: "relative flex-1", children: [_jsx(Search, { className: "absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" }), _jsx(Input, { placeholder: "Search agents...", value: searchTerm, onChange: (e) => setSearchTerm(e.target.value), className: "pl-10" })] }) }), filteredAgents.length === 0 ? (_jsxs("div", { className: "text-center py-12", children: [_jsx("div", { className: "mx-auto w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4", children: _jsx(Server, { className: "w-12 h-12 text-gray-400" }) }), _jsx("h3", { className: "text-lg font-semibold text-gray-900 mb-2", children: searchTerm ? 'No agents found' : 'No node agents yet' }), _jsx("p", { className: "text-gray-600 mb-4", children: searchTerm
                            ? 'Try adjusting your search terms'
                            : 'Add your first node agent to start orchestrating containers' }), !searchTerm && (_jsxs(Button, { onClick: () => setIsCreateModalOpen(true), children: [_jsx(Plus, { className: "w-4 h-4 mr-2" }), "Add Agent"] }))] })) : (_jsx("div", { className: "grid gap-6 lg:grid-cols-2 xl:grid-cols-3", children: filteredAgents.map((agent) => (_jsxs(Card, { className: "group hover:shadow-lg transition-all duration-200", children: [_jsx(CardHeader, { className: "pb-3", children: _jsxs("div", { className: "flex items-start justify-between", children: [_jsxs("div", { className: "flex-1", children: [_jsxs("div", { className: "flex items-center gap-2 mb-1", children: [_jsx("div", { className: `w-2 h-2 rounded-full ${getStatusColor(agent.status)} animate-pulse` }), _jsx(CardTitle, { className: "text-lg font-semibold truncate", children: agent.name })] }), _jsxs("p", { className: "text-sm text-muted-foreground", children: [agent.hostname, " (", agent.ip_address, ")"] }), _jsxs("div", { className: "flex items-center gap-2 mt-2", children: [getStatusBadge(agent.status), _jsxs(Badge, { variant: "outline", className: "text-xs", children: ["v", agent.version] })] })] }), _jsxs("div", { className: "flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity", children: [_jsx(Button, { variant: "ghost", size: "icon", className: "h-8 w-8", onClick: () => setSelectedAgent(agent), children: _jsx(Eye, { className: "w-4 h-4" }) }), _jsx(Button, { variant: "ghost", size: "icon", className: "h-8 w-8", onClick: () => deleteAgentMutation.mutate(agent.id), children: _jsx(Trash2, { className: "w-4 h-4" }) })] })] }) }), _jsxs(CardContent, { className: "space-y-4", children: [_jsxs("div", { className: "space-y-3", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Cpu, { className: "w-4 h-4 text-blue-500" }), _jsxs("div", { className: "flex-1", children: [_jsxs("div", { className: "flex justify-between text-sm mb-1", children: [_jsx("span", { children: "CPU" }), _jsxs("span", { children: [agent.resources.cpu.usage.toFixed(1), "%"] })] }), _jsx(Progress, { value: agent.resources.cpu.usage, className: "h-2" })] })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx(MemoryStick, { className: "w-4 h-4 text-green-500" }), _jsxs("div", { className: "flex-1", children: [_jsxs("div", { className: "flex justify-between text-sm mb-1", children: [_jsx("span", { children: "Memory" }), _jsxs("span", { children: [((agent.resources.memory.used / agent.resources.memory.total) * 100).toFixed(1), "%"] })] }), _jsx(Progress, { value: (agent.resources.memory.used / agent.resources.memory.total) * 100, className: "h-2" })] })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx(HardDrive, { className: "w-4 h-4 text-orange-500" }), _jsxs("div", { className: "flex-1", children: [_jsxs("div", { className: "flex justify-between text-sm mb-1", children: [_jsx("span", { children: "Storage" }), _jsxs("span", { children: [((agent.resources.storage.used / agent.resources.storage.total) * 100).toFixed(1), "%"] })] }), _jsx(Progress, { value: (agent.resources.storage.used / agent.resources.storage.total) * 100, className: "h-2" })] })] })] }), _jsxs("div", { className: "grid grid-cols-2 gap-4 text-sm", children: [_jsxs("div", { children: [_jsx("div", { className: "font-medium", children: agent.capabilities.max_containers }), _jsx("div", { className: "text-xs text-muted-foreground", children: "Max Containers" })] }), _jsxs("div", { children: [_jsx("div", { className: "font-medium", children: agent.capabilities.container_runtimes.join(', ') }), _jsx("div", { className: "text-xs text-muted-foreground", children: "Runtimes" })] })] }), _jsx("div", { className: "flex items-center justify-between text-sm", children: _jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Activity, { className: "w-3 h-3 text-muted-foreground" }), _jsxs("span", { className: "text-muted-foreground", children: ["Last seen ", formatDistanceToNow(new Date(agent.last_heartbeat), { addSuffix: true })] })] }) }), _jsxs("div", { className: "flex gap-2 pt-2", children: [_jsxs(Button, { variant: "outline", size: "sm", className: "flex-1", children: [_jsx(Settings, { className: "w-3 h-3 mr-1" }), "Configure"] }), _jsxs(Button, { size: "sm", className: "flex-1", children: [_jsx(Container, { className: "w-3 h-3 mr-1" }), "Containers"] })] })] })] }, agent.id))) })), selectedAgent && (_jsx("div", { className: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50", children: _jsxs(Card, { className: "w-full max-w-4xl max-h-[90vh] overflow-y-auto", children: [_jsx(CardHeader, { children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsxs(CardTitle, { className: "flex items-center gap-2", children: [_jsx("div", { className: `w-3 h-3 rounded-full ${getStatusColor(selectedAgent.status)}` }), selectedAgent.name] }), _jsxs("p", { className: "text-sm text-muted-foreground mt-1", children: [selectedAgent.hostname, " (", selectedAgent.ip_address, ":", selectedAgent.port, ")"] })] }), _jsx(Button, { variant: "ghost", size: "icon", onClick: () => setSelectedAgent(null), children: _jsx(Eye, { className: "w-4 h-4" }) })] }) }), _jsxs(CardContent, { className: "space-y-6", children: [_jsxs("div", { children: [_jsx("h3", { className: "text-lg font-semibold mb-4", children: "Resource Usage" }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-4", children: [_jsx(Card, { children: _jsxs(CardContent, { className: "p-4", children: [_jsxs("div", { className: "flex items-center gap-2 mb-2", children: [_jsx(Cpu, { className: "w-5 h-5 text-blue-500" }), _jsx("span", { className: "font-medium", children: "CPU" })] }), _jsxs("div", { className: "text-2xl font-bold", children: [selectedAgent.resources.cpu.usage.toFixed(1), "%"] }), _jsxs("div", { className: "text-sm text-muted-foreground", children: [selectedAgent.resources.cpu.allocation, " allocated / ", selectedAgent.resources.cpu.cores, " cores"] })] }) }), _jsx(Card, { children: _jsxs(CardContent, { className: "p-4", children: [_jsxs("div", { className: "flex items-center gap-2 mb-2", children: [_jsx(MemoryStick, { className: "w-5 h-5 text-green-500" }), _jsx("span", { className: "font-medium", children: "Memory" })] }), _jsx("div", { className: "text-2xl font-bold", children: formatBytes(selectedAgent.resources.memory.used) }), _jsxs("div", { className: "text-sm text-muted-foreground", children: [formatBytes(selectedAgent.resources.memory.allocated), " allocated / ", formatBytes(selectedAgent.resources.memory.total), " total"] })] }) }), _jsx(Card, { children: _jsxs(CardContent, { className: "p-4", children: [_jsxs("div", { className: "flex items-center gap-2 mb-2", children: [_jsx(HardDrive, { className: "w-5 h-5 text-orange-500" }), _jsx("span", { className: "font-medium", children: "Storage" })] }), _jsx("div", { className: "text-2xl font-bold", children: formatBytes(selectedAgent.resources.storage.used) }), _jsxs("div", { className: "text-sm text-muted-foreground", children: [formatBytes(selectedAgent.resources.storage.allocated), " allocated / ", formatBytes(selectedAgent.resources.storage.total), " total"] })] }) })] })] }), _jsxs("div", { children: [_jsx("h3", { className: "text-lg font-semibold mb-4", children: "Capabilities" }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsx(Label, { className: "text-sm font-medium", children: "Container Runtimes" }), _jsx("div", { className: "flex flex-wrap gap-2 mt-1", children: selectedAgent.capabilities.container_runtimes.map(runtime => (_jsx(Badge, { variant: "secondary", children: runtime }, runtime))) })] }), _jsxs("div", { children: [_jsx(Label, { className: "text-sm font-medium", children: "Supported Architectures" }), _jsx("div", { className: "flex flex-wrap gap-2 mt-1", children: selectedAgent.capabilities.supported_architectures.map(arch => (_jsx(Badge, { variant: "secondary", children: arch }, arch))) })] }), _jsxs("div", { children: [_jsx(Label, { className: "text-sm font-medium", children: "Network Plugins" }), _jsx("div", { className: "flex flex-wrap gap-2 mt-1", children: selectedAgent.capabilities.network_plugins.map(plugin => (_jsx(Badge, { variant: "secondary", children: plugin }, plugin))) })] }), _jsxs("div", { children: [_jsx(Label, { className: "text-sm font-medium", children: "Features" }), _jsx("div", { className: "flex flex-wrap gap-2 mt-1", children: selectedAgent.capabilities.features.map(feature => (_jsx(Badge, { variant: "secondary", children: feature }, feature))) })] })] })] }), _jsxs("div", { children: [_jsx("h3", { className: "text-lg font-semibold mb-4", children: "Network Interfaces" }), _jsx("div", { className: "space-y-2", children: selectedAgent.resources.network.interfaces.map(iface => (_jsx(Card, { children: _jsx(CardContent, { className: "p-3", children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Network, { className: "w-4 h-4 text-blue-500" }), _jsx("span", { className: "font-medium", children: iface.name }), _jsx(Badge, { variant: iface.status === 'up' ? 'default' : 'secondary', children: iface.status })] }), _jsxs("div", { className: "text-sm text-muted-foreground", children: [iface.ip_address, " \u2022 ", iface.speed, " Mbps"] })] }) }) }, iface.name))) })] })] })] }) }))] }));
}
