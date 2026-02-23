import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { PageHeader } from '@/components/ui/page-header';
import { Server, Cpu, HardDrive, MemoryStick, Power, PowerOff, Trash2, RefreshCw, Container, Monitor, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';
export default function Infrastructure() {
    const [nodes, setNodes] = useState([]);
    const [vms, setVMs] = useState([]);
    const [containers, setContainers] = useState([]);
    const [resourceUsage, setResourceUsage] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            const nodesResponse = await fetch('/api/proxmox/nodes');
            if (!nodesResponse.ok)
                throw new Error('Failed to fetch nodes');
            const nodesData = await nodesResponse.json();
            setNodes(nodesData.data || []);
            const vmsResponse = await fetch('/api/proxmox/vms');
            if (!vmsResponse.ok)
                throw new Error('Failed to fetch VMs');
            const vmsData = await vmsResponse.json();
            setVMs(vmsData.data || []);
            const containersResponse = await fetch('/api/proxmox/containers');
            if (!containersResponse.ok)
                throw new Error('Failed to fetch containers');
            const containersData = await containersResponse.json();
            setContainers(containersData.data || []);
            const resourcesResponse = await fetch('/api/proxmox/resources/usage');
            if (!resourcesResponse.ok)
                throw new Error('Failed to fetch resource usage');
            const resourcesData = await resourcesResponse.json();
            setResourceUsage(resourcesData.data || null);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred');
        }
        finally {
            setLoading(false);
        }
    };
    useEffect(() => {
        fetchData();
    }, []);
    const handleInstanceAction = async (type, vmid, action) => {
        try {
            const endpoint = type === 'vm' ? 'vms' : 'containers';
            const response = await fetch(`/api/proxmox/${endpoint}/${vmid}/${action}`, {
                method: 'POST',
            });
            if (!response.ok)
                throw new Error(`Failed to ${action} ${type}`);
            await fetchData();
        }
        catch (err) {
            setError(err instanceof Error ? err.message : `Failed to ${action} ${type}`);
        }
    };
    const formatBytes = (bytes) => {
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        if (bytes === 0)
            return '0 B';
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    };
    const formatUptime = (seconds) => {
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        if (days > 0)
            return `${days}d ${hours}h`;
        if (hours > 0)
            return `${hours}h ${minutes}m`;
        return `${minutes}m`;
    };
    const getStatusBadge = (status) => {
        const config = {
            'running': { variant: 'live', label: 'Running' },
            'stopped': { variant: 'secondary', label: 'Stopped' },
            'online': { variant: 'live', label: 'Online' },
            'offline': { variant: 'error', label: 'Offline' },
        };
        const cfg = config[status] || { variant: 'secondary', label: status };
        return (_jsx(Badge, { variant: cfg.variant, className: "text-[10px] font-medium", children: cfg.label }));
    };
    if (loading) {
        return (_jsxs("div", { className: "p-4 md:p-6 lg:p-8 space-y-8", children: [_jsx(PageHeader, { title: "Infrastructure", description: "Manage your Proxmox cluster" }), _jsx("div", { className: "flex items-center justify-center h-64", children: _jsxs("div", { className: "flex flex-col items-center gap-3", children: [_jsx("div", { className: "w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" }), _jsx("span", { className: "text-sm text-muted-foreground", children: "Loading infrastructure..." })] }) })] }));
    }
    if (error) {
        return (_jsxs("div", { className: "p-4 md:p-6 lg:p-8 space-y-6", children: [_jsx(PageHeader, { title: "Infrastructure", description: "Manage your Proxmox cluster" }), _jsx(Card, { className: "border-destructive/30 bg-destructive/5", children: _jsxs(CardContent, { className: "py-8 text-center", children: [_jsxs("div", { className: "text-destructive font-medium mb-2", children: ["Error: ", error] }), _jsxs(Button, { onClick: fetchData, variant: "outline", size: "sm", className: "mt-4", children: [_jsx(RefreshCw, { className: "w-4 h-4 mr-2" }), "Retry"] })] }) })] }));
    }
    return (_jsxs("div", { className: "p-4 md:p-6 lg:p-8 space-y-8 animate-fade-in", children: [_jsx(PageHeader, { title: "Infrastructure", description: "Manage your Proxmox cluster, virtual machines, and containers", action: {
                    label: 'Refresh',
                    icon: RefreshCw,
                    onClick: fetchData,
                } }), resourceUsage && (_jsx("div", { className: "grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4", children: [
                    {
                        title: 'Nodes',
                        value: `${resourceUsage.online_nodes}/${resourceUsage.total_nodes}`,
                        subtitle: 'Online',
                        icon: Server,
                        gradient: 'from-violet-500/20 to-violet-500/5',
                        iconBg: 'bg-violet-500/10 text-violet-500 dark:text-violet-400'
                    },
                    {
                        title: 'CPU Usage',
                        value: `${Math.round((resourceUsage.cpu_usage.used / resourceUsage.cpu_usage.total) * 100)}%`,
                        subtitle: 'Across all nodes',
                        icon: Cpu,
                        gradient: 'from-blue-500/20 to-blue-500/5',
                        iconBg: 'bg-blue-500/10 text-blue-500 dark:text-blue-400',
                        progress: (resourceUsage.cpu_usage.used / resourceUsage.cpu_usage.total) * 100
                    },
                    {
                        title: 'Memory Usage',
                        value: `${Math.round((resourceUsage.memory_usage.used / resourceUsage.memory_usage.total) * 100)}%`,
                        subtitle: formatBytes(resourceUsage.memory_usage.used),
                        icon: MemoryStick,
                        gradient: 'from-emerald-500/20 to-emerald-500/5',
                        iconBg: 'bg-emerald-500/10 text-emerald-500 dark:text-emerald-400',
                        progress: (resourceUsage.memory_usage.used / resourceUsage.memory_usage.total) * 100
                    },
                    {
                        title: 'Disk Usage',
                        value: `${Math.round((resourceUsage.disk_usage.used / resourceUsage.disk_usage.total) * 100)}%`,
                        subtitle: formatBytes(resourceUsage.disk_usage.used),
                        icon: HardDrive,
                        gradient: 'from-amber-500/20 to-amber-500/5',
                        iconBg: 'bg-amber-500/10 text-amber-500 dark:text-amber-400',
                        progress: (resourceUsage.disk_usage.used / resourceUsage.disk_usage.total) * 100
                    },
                ].map((stat, index) => (_jsxs(Card, { className: cn("relative overflow-hidden card-hover card-elevated group animate-fade-in-up"), style: { animationDelay: `${index * 50}ms` }, children: [_jsx("div", { className: cn("absolute inset-0 bg-gradient-to-br", stat.gradient) }), _jsxs(CardContent, { className: "relative p-5", children: [_jsxs("div", { className: "flex items-start justify-between mb-3", children: [_jsx("div", { className: cn("p-2 rounded-xl transition-transform group-hover:scale-110", stat.iconBg), children: _jsx(stat.icon, { className: "w-4 h-4" }) }), _jsx(Activity, { className: "w-4 h-4 text-muted-foreground/50" })] }), _jsx("div", { className: "text-2xl font-bold tracking-tight", children: stat.value }), _jsx("div", { className: "text-xs text-muted-foreground mt-1", children: stat.subtitle }), stat.progress !== undefined && (_jsx(Progress, { value: stat.progress, className: "h-1.5 mt-3" }))] })] }, stat.title))) })), _jsxs(Tabs, { defaultValue: "nodes", className: "space-y-6", children: [_jsxs(TabsList, { className: "bg-muted/30 p-1", children: [_jsxs(TabsTrigger, { value: "nodes", className: "gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm", children: [_jsx(Server, { className: "w-4 h-4" }), _jsx("span", { className: "hidden sm:inline", children: "Nodes" })] }), _jsxs(TabsTrigger, { value: "vms", className: "gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm", children: [_jsx(Monitor, { className: "w-4 h-4" }), _jsx("span", { className: "hidden sm:inline", children: "Virtual Machines" })] }), _jsxs(TabsTrigger, { value: "containers", className: "gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm", children: [_jsx(Container, { className: "w-4 h-4" }), _jsx("span", { className: "hidden sm:inline", children: "Containers" })] })] }), _jsx(TabsContent, { value: "nodes", className: "space-y-4 animate-fade-in-up", children: _jsx("div", { className: "grid gap-4 md:grid-cols-2 lg:grid-cols-3", children: nodes.map((node, index) => (_jsxs(Card, { className: "card-hover card-elevated animate-fade-in-up", style: { animationDelay: `${index * 50}ms` }, children: [_jsxs(CardHeader, { className: "pb-3", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx(CardTitle, { className: "text-base font-semibold", children: node.node }), getStatusBadge(node.status)] }), _jsx(CardDescription, { children: "Proxmox Node" })] }), _jsxs(CardContent, { className: "space-y-3", children: [[
                                                { label: 'CPU', value: `${Math.round(node.cpu * 100)}%`, progress: node.cpu * 100, color: 'bg-blue-500' },
                                                { label: 'Memory', value: `${formatBytes(node.mem)} / ${formatBytes(node.maxmem)}`, progress: (node.mem / node.maxmem) * 100, color: 'bg-emerald-500' },
                                                { label: 'Disk', value: `${formatBytes(node.disk)} / ${formatBytes(node.maxdisk)}`, progress: (node.disk / node.maxdisk) * 100, color: 'bg-amber-500' },
                                            ].map((item) => (_jsxs("div", { className: "space-y-1.5", children: [_jsxs("div", { className: "flex items-center justify-between text-xs", children: [_jsx("span", { className: "text-muted-foreground", children: item.label }), _jsx("span", { className: "font-mono text-foreground", children: item.value })] }), _jsx(Progress, { value: item.progress, className: "h-1.5" })] }, item.label))), _jsxs("div", { className: "flex items-center justify-between text-xs pt-2 border-t border-border/50", children: [_jsx("span", { className: "text-muted-foreground", children: "Uptime" }), _jsx("span", { className: "font-medium", children: formatUptime(node.uptime) })] })] })] }, node.id))) }) }), _jsx(TabsContent, { value: "vms", className: "space-y-4 animate-fade-in-up", children: _jsx("div", { className: "grid gap-4 md:grid-cols-2 lg:grid-cols-3", children: vms.map((vm, index) => (_jsxs(Card, { className: "card-hover card-elevated animate-fade-in-up", style: { animationDelay: `${index * 50}ms` }, children: [_jsxs(CardHeader, { className: "pb-3", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx(CardTitle, { className: "text-base font-semibold", children: vm.name || `VM-${vm.vmid}` }), getStatusBadge(vm.status)] }), _jsxs(CardDescription, { children: ["ID: ", vm.vmid, " \u00B7 Node: ", vm.node] })] }), _jsxs(CardContent, { className: "space-y-3", children: [[
                                                { label: 'CPU', value: `${Math.round(vm.cpu * 100)}%`, progress: vm.cpu * 100 },
                                                { label: 'Memory', value: `${formatBytes(vm.mem)} / ${formatBytes(vm.maxmem)}`, progress: (vm.mem / vm.maxmem) * 100 },
                                                { label: 'Disk', value: `${formatBytes(vm.disk)} / ${formatBytes(vm.maxdisk)}`, progress: (vm.disk / vm.maxdisk) * 100 },
                                            ].map((item) => (_jsxs("div", { className: "space-y-1.5", children: [_jsxs("div", { className: "flex items-center justify-between text-xs", children: [_jsx("span", { className: "text-muted-foreground", children: item.label }), _jsx("span", { className: "font-mono text-foreground", children: item.value })] }), _jsx(Progress, { value: item.progress, className: "h-1.5" })] }, item.label))), _jsxs("div", { className: "flex items-center justify-between text-xs pt-2 border-t border-border/50", children: [_jsx("span", { className: "text-muted-foreground", children: "Uptime" }), _jsx("span", { className: "font-medium", children: formatUptime(vm.uptime) })] }), _jsxs("div", { className: "flex gap-2 pt-1", children: [vm.status === 'stopped' ? (_jsxs(Button, { size: "sm", onClick: () => handleInstanceAction('vm', vm.vmid, 'start'), className: "flex-1", children: [_jsx(Power, { className: "w-3.5 h-3.5 mr-1.5" }), "Start"] })) : (_jsxs(Button, { size: "sm", variant: "outline", onClick: () => handleInstanceAction('vm', vm.vmid, 'stop'), className: "flex-1", children: [_jsx(PowerOff, { className: "w-3.5 h-3.5 mr-1.5" }), "Stop"] })), _jsx(Button, { size: "sm", variant: "ghost", onClick: () => handleInstanceAction('vm', vm.vmid, 'delete'), className: "text-destructive hover:text-destructive hover:bg-destructive/10", children: _jsx(Trash2, { className: "w-3.5 h-3.5" }) })] })] })] }, vm.vmid))) }) }), _jsx(TabsContent, { value: "containers", className: "space-y-4 animate-fade-in-up", children: _jsx("div", { className: "grid gap-4 md:grid-cols-2 lg:grid-cols-3", children: containers.map((container, index) => (_jsxs(Card, { className: "card-hover card-elevated animate-fade-in-up", style: { animationDelay: `${index * 50}ms` }, children: [_jsxs(CardHeader, { className: "pb-3", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx(CardTitle, { className: "text-base font-semibold", children: container.name || `CT-${container.vmid}` }), getStatusBadge(container.status)] }), _jsxs(CardDescription, { children: ["ID: ", container.vmid, " \u00B7 Node: ", container.node] })] }), _jsxs(CardContent, { className: "space-y-3", children: [[
                                                { label: 'CPU', value: `${Math.round(container.cpu * 100)}%`, progress: container.cpu * 100 },
                                                { label: 'Memory', value: `${formatBytes(container.mem)} / ${formatBytes(container.maxmem)}`, progress: (container.mem / container.maxmem) * 100 },
                                                { label: 'Disk', value: `${formatBytes(container.disk)} / ${formatBytes(container.maxdisk)}`, progress: (container.disk / container.maxdisk) * 100 },
                                            ].map((item) => (_jsxs("div", { className: "space-y-1.5", children: [_jsxs("div", { className: "flex items-center justify-between text-xs", children: [_jsx("span", { className: "text-muted-foreground", children: item.label }), _jsx("span", { className: "font-mono text-foreground", children: item.value })] }), _jsx(Progress, { value: item.progress, className: "h-1.5" })] }, item.label))), _jsxs("div", { className: "flex items-center justify-between text-xs pt-2 border-t border-border/50", children: [_jsx("span", { className: "text-muted-foreground", children: "Uptime" }), _jsx("span", { className: "font-medium", children: formatUptime(container.uptime) })] }), _jsxs("div", { className: "flex gap-2 pt-1", children: [container.status === 'stopped' ? (_jsxs(Button, { size: "sm", onClick: () => handleInstanceAction('container', container.vmid, 'start'), className: "flex-1", children: [_jsx(Power, { className: "w-3.5 h-3.5 mr-1.5" }), "Start"] })) : (_jsxs(Button, { size: "sm", variant: "outline", onClick: () => handleInstanceAction('container', container.vmid, 'stop'), className: "flex-1", children: [_jsx(PowerOff, { className: "w-3.5 h-3.5 mr-1.5" }), "Stop"] })), _jsx(Button, { size: "sm", variant: "ghost", onClick: () => handleInstanceAction('container', container.vmid, 'delete'), className: "text-destructive hover:text-destructive hover:bg-destructive/10", children: _jsx(Trash2, { className: "w-3.5 h-3.5" }) })] })] })] }, container.vmid))) }) })] })] }));
}
