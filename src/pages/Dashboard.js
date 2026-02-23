import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { PageHeader } from '@/components/ui/page-header';
import { GitBranch, Activity, Users, Cpu, HardDrive, Network, Container, Server, Database, ArrowUpRight, ArrowDownRight, Zap, AlertCircle, CheckCircle2, Sparkles, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
const infrastructureStats = [
    {
        title: 'Active Services',
        value: '12',
        description: 'Running containers',
        icon: Container,
        trend: { value: '+2', direction: 'up' },
        status: 'success',
        gradient: 'from-emerald-500/20 via-emerald-500/10 to-transparent',
        iconBg: 'bg-emerald-500/10 text-emerald-500 dark:text-emerald-400',
        ringColor: 'ring-emerald-500/20',
    },
    {
        title: 'Deployments',
        value: '48',
        description: 'This month',
        icon: GitBranch,
        trend: { value: '+8', direction: 'up' },
        status: 'success',
        gradient: 'from-violet-500/20 via-violet-500/10 to-transparent',
        iconBg: 'bg-violet-500/10 text-violet-500 dark:text-violet-400',
        ringColor: 'ring-violet-500/20',
    },
    {
        title: 'Team Members',
        value: '6',
        description: 'Active users',
        icon: Users,
        trend: { value: '0', direction: 'neutral' },
        status: 'neutral',
        gradient: 'from-blue-500/20 via-blue-500/10 to-transparent',
        iconBg: 'bg-blue-500/10 text-blue-500 dark:text-blue-400',
        ringColor: 'ring-blue-500/20',
    },
    {
        title: 'Uptime',
        value: '99.9%',
        description: 'Last 30 days',
        icon: Activity,
        trend: { value: '+0.1%', direction: 'up' },
        status: 'success',
        gradient: 'from-amber-500/20 via-amber-500/10 to-transparent',
        iconBg: 'bg-amber-500/10 text-amber-500 dark:text-amber-400',
        ringColor: 'ring-amber-500/20',
    },
];
const resourceStats = [
    {
        title: 'CPU Usage',
        value: '34%',
        max: 100,
        icon: Cpu,
        color: 'text-blue-500 dark:text-blue-400',
        bg: 'bg-blue-500/10',
        progressColor: 'bg-gradient-to-r from-blue-500 to-blue-400',
    },
    {
        title: 'Memory',
        value: '2.4 GB',
        max: 8,
        current: 2.4,
        icon: HardDrive,
        color: 'text-emerald-500 dark:text-emerald-400',
        bg: 'bg-emerald-500/10',
        progressColor: 'bg-gradient-to-r from-emerald-500 to-emerald-400',
    },
    {
        title: 'Network I/O',
        value: '124 MB/s',
        icon: Network,
        color: 'text-violet-500 dark:text-violet-400',
        bg: 'bg-violet-500/10',
        progressColor: 'bg-gradient-to-r from-violet-500 to-violet-400',
    },
];
const recentDeployments = [
    {
        name: 'api-gateway',
        status: 'success',
        time: '2 min ago',
        branch: 'main',
        commit: 'a1b2c3d',
        duration: '12s',
    },
    {
        name: 'web-frontend',
        status: 'building',
        time: '5 min ago',
        branch: 'feature/auth',
        commit: 'e4f5g6h',
        duration: '~45s',
    },
    {
        name: 'worker-service',
        status: 'success',
        time: '1 hour ago',
        branch: 'main',
        commit: 'i7j8k9l',
        duration: '28s',
    },
    {
        name: 'redis-cache',
        status: 'failed',
        time: '3 hours ago',
        branch: 'main',
        commit: 'm0n1o2p',
        duration: '8s',
    },
];
const statusConfig = {
    success: { icon: CheckCircle2, color: 'text-emerald-500 dark:text-emerald-400', bg: 'bg-emerald-500/10 dark:bg-emerald-500/20', label: 'Live' },
    building: { icon: RefreshCw, color: 'text-amber-500 dark:text-amber-400', bg: 'bg-amber-500/10 dark:bg-amber-500/20', label: 'Building', animate: true },
    failed: { icon: AlertCircle, color: 'text-red-500 dark:text-red-400', bg: 'bg-red-500/10 dark:bg-red-500/20', label: 'Failed' },
};
export default function Dashboard() {
    return (_jsxs("div", { className: "p-4 md:p-6 lg:p-8 space-y-8 animate-fade-in", children: [_jsx(PageHeader, { title: "Dashboard", description: "Monitor your infrastructure and deployments", action: {
                    label: 'New Deployment',
                    icon: Sparkles,
                    onClick: () => { },
                } }), _jsx("div", { className: "grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4", children: infrastructureStats.map((stat, index) => (_jsxs(Card, { className: cn("relative overflow-hidden card-hover card-elevated group", "animate-fade-in-up"), style: { animationDelay: `${index * 50}ms` }, children: [_jsx("div", { className: cn("absolute inset-0 bg-gradient-to-br", stat.gradient) }), _jsx(CardContent, { className: "relative p-5", children: _jsxs("div", { className: "flex items-start justify-between", children: [_jsxs("div", { className: "space-y-2.5", children: [_jsx("p", { className: "text-sm font-medium text-muted-foreground", children: stat.title }), _jsxs("div", { className: "flex items-baseline gap-2.5", children: [_jsx("p", { className: "text-3xl font-bold tracking-tight", children: stat.value }), stat.trend && (_jsxs(Badge, { variant: "outline", className: cn("font-mono text-[10px] px-1.5 py-0.5", stat.trend.direction === 'up'
                                                            ? 'border-emerald-500/30 text-emerald-500 dark:text-emerald-400 bg-emerald-500/10'
                                                            : stat.trend.direction === 'down'
                                                                ? 'border-red-500/30 text-red-500 dark:text-red-400 bg-red-500/10'
                                                                : 'border-muted-foreground/30 text-muted-foreground'), children: [stat.trend.direction === 'up' && _jsx(ArrowUpRight, { className: "w-2.5 h-2.5 mr-0.5" }), stat.trend.direction === 'down' && _jsx(ArrowDownRight, { className: "w-2.5 h-2.5 mr-0.5" }), stat.trend.value] }))] }), _jsx("p", { className: "text-xs text-muted-foreground", children: stat.description })] }), _jsx("div", { className: cn("p-2.5 rounded-xl transition-all duration-300 group-hover:scale-110 group-hover:rotate-3", stat.iconBg, "ring-2", stat.ringColor), children: _jsx(stat.icon, { className: "w-5 h-5" }) })] }) })] }, stat.title))) }), _jsxs("div", { className: "grid gap-6 grid-cols-1 lg:grid-cols-3", children: [_jsxs(Card, { className: "lg:col-span-2 card-hover card-elevated", children: [_jsx(CardHeader, { className: "pb-3", children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx(CardTitle, { className: "text-base font-semibold", children: "Resource Usage" }), _jsx(CardDescription, { children: "Real-time infrastructure metrics" })] }), _jsxs(Badge, { variant: "outline", className: "text-[10px] font-medium gap-1.5 bg-emerald-500/5 border-emerald-500/20 text-emerald-600 dark:text-emerald-400", children: [_jsx("span", { className: "w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" }), "Live"] })] }) }), _jsx(CardContent, { className: "space-y-5", children: resourceStats.map((stat) => (_jsxs("div", { className: "space-y-2", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center gap-2.5", children: [_jsx("div", { className: cn("p-2 rounded-lg", stat.bg), children: _jsx(stat.icon, { className: cn("w-4 h-4", stat.color) }) }), _jsx("span", { className: "text-sm font-medium", children: stat.title })] }), _jsx("span", { className: cn("text-sm font-mono font-medium tabular-nums", stat.color), children: stat.value })] }), stat.max && (_jsx("div", { className: "h-2 bg-muted/50 rounded-full overflow-hidden", children: _jsx(Progress, { value: stat.current ? (stat.current / stat.max) * 100 : parseInt(stat.value), className: "h-2" }) }))] }, stat.title))) })] }), _jsxs(Card, { className: "card-hover card-elevated", children: [_jsx(CardHeader, { className: "pb-3", children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsx(CardTitle, { className: "text-base font-semibold", children: "Recent Deployments" }), _jsxs(Button, { variant: "ghost", size: "sm", className: "text-xs h-7 px-2.5 hover:bg-muted/50", children: ["View All", _jsx(ArrowUpRight, { className: "w-3 h-3 ml-1" })] })] }) }), _jsx(CardContent, { className: "space-y-2", children: recentDeployments.map((deployment, index) => {
                                    const config = statusConfig[deployment.status];
                                    return (_jsxs("div", { className: "flex items-center gap-3 p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-all duration-200 cursor-pointer group", children: [_jsx("div", { className: cn("p-2 rounded-lg", config.bg), children: _jsx(config.icon, { className: cn("w-4 h-4", config.color, config.animate && "animate-spin") }) }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("p", { className: "text-sm font-medium truncate", children: deployment.name }), _jsx(Badge, { variant: "outline", className: "text-[10px] h-4 px-1 font-mono bg-muted/50 border-border/50", children: deployment.commit })] }), _jsxs("p", { className: "text-xs text-muted-foreground mt-0.5", children: [deployment.branch, " \u00B7 ", deployment.time] })] }), _jsx(Badge, { variant: "outline", className: cn("text-[10px] font-medium", config.color, config.bg, "border-0"), children: config.label })] }, index));
                                }) })] })] }), _jsx("div", { className: "grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4", children: [
                    { title: 'Add Server', description: 'Connect new node', icon: Server, gradient: 'from-violet-500/20 to-violet-500/5', iconColor: 'text-violet-500 dark:text-violet-400' },
                    { title: 'Create Database', description: 'PostgreSQL, Redis, etc.', icon: Database, gradient: 'from-emerald-500/20 to-emerald-500/5', iconColor: 'text-emerald-500 dark:text-emerald-400' },
                    { title: 'Import Project', description: 'From GitHub', icon: GitBranch, gradient: 'from-blue-500/20 to-blue-500/5', iconColor: 'text-blue-500 dark:text-blue-400' },
                    { title: 'Quick Deploy', description: 'One-click setup', icon: Zap, gradient: 'from-amber-500/20 to-amber-500/5', iconColor: 'text-amber-500 dark:text-amber-400' },
                ].map((action, index) => (_jsx(Card, { className: "card-hover card-interactive group cursor-pointer overflow-hidden animate-fade-in-up", style: { animationDelay: `${(infrastructureStats.length + index) * 50}ms` }, children: _jsxs(CardContent, { className: "p-5 flex items-center gap-4", children: [_jsx("div", { className: cn("p-3 rounded-xl bg-gradient-to-br transition-all duration-300 group-hover:scale-110", action.gradient), children: _jsx(action.icon, { className: cn("w-5 h-5", action.iconColor) }) }), _jsxs("div", { children: [_jsx("p", { className: "font-semibold text-sm", children: action.title }), _jsx("p", { className: "text-xs text-muted-foreground", children: action.description })] })] }) }, action.title))) }), _jsxs(Card, { className: "card-hover card-elevated", children: [_jsx(CardHeader, { children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx(CardTitle, { className: "text-base font-semibold", children: "Active Services" }), _jsx(CardDescription, { children: "All running containers across your infrastructure" })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsxs(Badge, { variant: "outline", className: "gap-1.5 text-[10px] font-medium bg-emerald-500/5 border-emerald-500/20 text-emerald-600 dark:text-emerald-400", children: [_jsx("span", { className: "w-1.5 h-1.5 rounded-full bg-emerald-500" }), "12 Running"] }), _jsxs(Badge, { variant: "outline", className: "gap-1.5 text-[10px] font-medium bg-amber-500/5 border-amber-500/20 text-amber-600 dark:text-amber-400", children: [_jsx("span", { className: "w-1.5 h-1.5 rounded-full bg-amber-500" }), "2 Building"] })] })] }) }), _jsx(CardContent, { children: _jsx("div", { className: "grid gap-2.5 grid-cols-1 md:grid-cols-2 xl:grid-cols-3", children: [
                                { name: 'api-gateway', status: 'running', cpu: '12%', memory: '256MB', port: '3000' },
                                { name: 'web-frontend', status: 'running', cpu: '8%', memory: '128MB', port: '8080' },
                                { name: 'worker-service', status: 'running', cpu: '45%', memory: '512MB', port: '4000' },
                                { name: 'redis-cache', status: 'running', cpu: '3%', memory: '64MB', port: '6379' },
                                { name: 'postgres-db', status: 'running', cpu: '15%', memory: '1.2GB', port: '5432' },
                                { name: 'auth-service', status: 'building', cpu: '-', memory: '-', port: '5000' },
                            ].map((service) => (_jsxs("div", { className: "flex items-center justify-between p-3.5 rounded-xl bg-muted/30 hover:bg-muted/50 transition-all duration-200 cursor-pointer group", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("div", { className: cn("w-2 h-2 rounded-full", service.status === 'running' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500') }), _jsxs("div", { children: [_jsx("p", { className: "font-medium text-sm", children: service.name }), _jsxs("p", { className: "text-[10px] text-muted-foreground font-mono", children: [":", service.port] })] })] }), _jsxs("div", { className: "flex items-center gap-4 text-xs text-muted-foreground", children: [_jsxs("div", { className: "hidden sm:block tabular-nums", children: [_jsx("span", { className: cn("font-medium", service.cpu !== '-' && "text-foreground"), children: service.cpu }), _jsx("span", { className: "ml-1 opacity-60", children: "CPU" })] }), _jsxs("div", { className: "hidden sm:block tabular-nums", children: [_jsx("span", { className: cn("font-medium", service.memory !== '-' && "text-foreground"), children: service.memory }), _jsx("span", { className: "ml-1 opacity-60", children: "RAM" })] }), _jsx(ArrowUpRight, { className: "w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-primary" })] })] }, service.name))) }) })] })] }));
}
