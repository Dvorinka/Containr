import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { Cpu, HardDrive, Network, Activity, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
function ResourceWidget({ title, icon: Icon, metric, color, sparklineData }) {
    const trendIcon = metric.trend === 'up' ? TrendingUp : metric.trend === 'down' ? TrendingDown : Minus;
    const TrendIcon = trendIcon;
    const trendColor = metric.trend === 'up' ? 'text-green-500' : metric.trend === 'down' ? 'text-red-500' : 'text-gray-500';
    const change = metric.previous > 0
        ? ((metric.current - metric.previous) / metric.previous * 100).toFixed(1)
        : '0';
    return (_jsx(Card, { children: _jsxs(CardContent, { className: "p-4", children: [_jsxs("div", { className: "flex items-start justify-between", children: [_jsx("div", { className: `p-2 rounded-lg ${color}`, children: _jsx(Icon, { className: "w-5 h-5 text-white" }) }), _jsxs("div", { className: `flex items-center gap-1 ${trendColor}`, children: [_jsx(TrendIcon, { className: "w-4 h-4" }), _jsxs("span", { className: "text-sm font-medium", children: [Math.abs(parseFloat(change)), "%"] })] })] }), _jsxs("div", { className: "mt-3", children: [_jsxs("div", { className: "text-2xl font-bold", children: [metric.current.toFixed(1), metric.unit] }), _jsx("div", { className: "text-sm text-muted-foreground", children: title })] }), sparklineData && sparklineData.length > 0 && (_jsx("div", { className: "mt-3 h-8 flex items-end gap-0.5", children: sparklineData.map((value, index) => {
                        const height = (value / Math.max(...sparklineData)) * 100;
                        return (_jsx("div", { className: "flex-1 bg-primary/20 rounded-t", style: { height: `${height}%` } }, index));
                    }) }))] }) }));
}
function ResourceMonitor({ serviceId }) {
    const [metrics, setMetrics] = useState({
        cpu: { current: 0, previous: 0, trend: 'stable', unit: '%' },
        memory: { current: 0, previous: 0, trend: 'stable', unit: '%' },
        network: { current: 0, previous: 0, trend: 'stable', unit: ' MB/s' },
        disk: { current: 0, previous: 0, trend: 'stable', unit: ' GB' },
    });
    const [sparklines, setSparklines] = useState({
        cpu: [],
        memory: [],
        network: [],
        disk: [],
    });
    useEffect(() => {
        const fetchData = () => {
            const cpuValue = 20 + Math.random() * 60;
            const memoryValue = 30 + Math.random() * 50;
            const networkValue = Math.random() * 100;
            const diskValue = 5 + Math.random() * 20;
            setMetrics((prev) => ({
                cpu: { current: cpuValue, previous: prev.cpu.current, trend: cpuValue > prev.cpu.current ? 'up' : cpuValue < prev.cpu.current ? 'down' : 'stable', unit: '%' },
                memory: { current: memoryValue, previous: prev.memory.current, trend: memoryValue > prev.memory.current ? 'up' : memoryValue < prev.memory.current ? 'down' : 'stable', unit: '%' },
                network: { current: networkValue, previous: prev.network.current, trend: networkValue > prev.network.current ? 'up' : networkValue < prev.network.current ? 'down' : 'stable', unit: ' MB/s' },
                disk: { current: diskValue, previous: prev.disk.current, trend: diskValue > prev.disk.current ? 'up' : diskValue < prev.disk.current ? 'down' : 'stable', unit: ' GB' },
            }));
            setSparklines((prev) => ({
                cpu: [...prev.cpu.slice(-20), cpuValue],
                memory: [...prev.memory.slice(-20), memoryValue],
                network: [...prev.network.slice(-20), networkValue],
                disk: [...prev.disk.slice(-20), diskValue],
            }));
        };
        fetchData();
        const interval = setInterval(fetchData, 5000);
        return () => clearInterval(interval);
    }, [serviceId]);
    return (_jsxs("div", { className: "grid gap-4 md:grid-cols-2 lg:grid-cols-4", children: [_jsx(ResourceWidget, { title: "CPU Usage", icon: Cpu, metric: metrics.cpu, color: "bg-blue-500", sparklineData: sparklines.cpu }), _jsx(ResourceWidget, { title: "Memory", icon: HardDrive, metric: metrics.memory, color: "bg-purple-500", sparklineData: sparklines.memory }), _jsx(ResourceWidget, { title: "Network I/O", icon: Network, metric: metrics.network, color: "bg-green-500", sparklineData: sparklines.network }), _jsx(ResourceWidget, { title: "Disk Usage", icon: Activity, metric: metrics.disk, color: "bg-orange-500", sparklineData: sparklines.disk })] }));
}
function ServiceHealthIndicator({ status, lastCheck, uptime }) {
    const statusColors = {
        healthy: 'bg-green-500',
        degraded: 'bg-yellow-500',
        unhealthy: 'bg-red-500',
    };
    const statusLabels = {
        healthy: 'Healthy',
        degraded: 'Degraded',
        unhealthy: 'Unhealthy',
    };
    return (_jsx(Card, { children: _jsx(CardContent, { className: "p-4", children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("div", { className: `w-3 h-3 rounded-full ${statusColors[status]} animate-pulse` }), _jsxs("div", { children: [_jsx("div", { className: "font-medium", children: statusLabels[status] }), _jsxs("div", { className: "text-sm text-muted-foreground", children: ["Last check: ", lastCheck] })] })] }), _jsxs("div", { className: "text-right", children: [_jsxs("div", { className: "text-2xl font-bold", children: [uptime.toFixed(2), "%"] }), _jsx("div", { className: "text-sm text-muted-foreground", children: "Uptime" })] })] }) }) }));
}
function QuickStats({ stats }) {
    return (_jsxs("div", { className: "grid gap-4 md:grid-cols-4", children: [_jsx(Card, { children: _jsxs(CardContent, { className: "p-4", children: [_jsx("div", { className: "text-sm text-muted-foreground", children: "Total Services" }), _jsx("div", { className: "text-2xl font-bold", children: stats.totalServices })] }) }), _jsx(Card, { children: _jsxs(CardContent, { className: "p-4", children: [_jsx("div", { className: "text-sm text-muted-foreground", children: "Running" }), _jsx("div", { className: "text-2xl font-bold text-green-500", children: stats.runningServices })] }) }), _jsx(Card, { children: _jsxs(CardContent, { className: "p-4", children: [_jsx("div", { className: "text-sm text-muted-foreground", children: "Deployments (24h)" }), _jsx("div", { className: "text-2xl font-bold", children: stats.totalDeployments })] }) }), _jsx(Card, { children: _jsxs(CardContent, { className: "p-4", children: [_jsx("div", { className: "text-sm text-muted-foreground", children: "Active Alerts" }), _jsx("div", { className: "text-2xl font-bold text-red-500", children: stats.activeAlerts })] }) })] }));
}
