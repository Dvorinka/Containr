import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Cpu, HardDrive, Clock, TrendingUp, TrendingDown, AlertTriangle, CheckCircle, Activity, Zap, MemoryStick, Network, Timer, Users } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
export function CustomMetricsDashboard({ projectId, timeRange }) {
    const [selectedMetric, setSelectedMetric] = useState('performance');
    const [autoRefresh, setAutoRefresh] = useState(true);
    // Mock custom metrics data - in real implementation, this would come from your monitoring system
    const { data: metricsData, isLoading } = useQuery({
        queryKey: ['custom-metrics', projectId, timeRange],
        queryFn: async () => {
            // This would integrate with your monitoring system (Prometheus, Grafana, etc.)
            return {
                performance: {
                    responseTime: {
                        current: 245,
                        average: 312,
                        p95: 567,
                        p99: 892,
                        trend: 'down',
                        change: -12.3
                    },
                    throughput: {
                        current: 1250,
                        average: 1180,
                        peak: 2340,
                        trend: 'up',
                        change: 8.7
                    },
                    errorRate: {
                        current: 0.2,
                        average: 0.3,
                        trend: 'down',
                        change: -33.3
                    },
                    availability: {
                        current: 99.95,
                        average: 99.91,
                        trend: 'up',
                        change: 0.04
                    }
                },
                infrastructure: {
                    cpu: {
                        current: 45.2,
                        average: 52.8,
                        peak: 78.9,
                        trend: 'down',
                        change: -14.5
                    },
                    memory: {
                        current: 62.7,
                        average: 68.4,
                        peak: 85.2,
                        trend: 'down',
                        change: -8.3
                    },
                    disk: {
                        current: 34.8,
                        average: 38.1,
                        peak: 45.6,
                        trend: 'stable',
                        change: -8.7
                    },
                    network: {
                        inbound: 125.6,
                        outbound: 89.3,
                        trend: 'up',
                        change: 15.2
                    }
                },
                business: {
                    conversions: {
                        current: 156,
                        goal: 200,
                        completion: 78,
                        trend: 'up',
                        change: 12.5
                    },
                    revenue: {
                        current: 45678,
                        goal: 50000,
                        completion: 91.4,
                        trend: 'up',
                        change: 8.9
                    },
                    userSatisfaction: {
                        current: 4.6,
                        goal: 4.8,
                        completion: 95.8,
                        trend: 'stable',
                        change: 0
                    },
                    activeUsers: {
                        current: 12845,
                        goal: 15000,
                        completion: 85.6,
                        trend: 'up',
                        change: 6.2
                    }
                }
            };
        },
        refetchInterval: autoRefresh ? 30000 : false,
    });
    const getTrendIcon = (trend) => {
        switch (trend) {
            case 'up':
                return _jsx(TrendingUp, { className: "w-4 h-4 text-green-500" });
            case 'down':
                return _jsx(TrendingDown, { className: "w-4 h-4 text-red-500" });
            default:
                return _jsx(Activity, { className: "w-4 h-4 text-gray-500" });
        }
    };
    const getStatusColor = (value, thresholds) => {
        if (value <= thresholds.good)
            return 'text-green-600';
        if (value <= thresholds.warning)
            return 'text-yellow-600';
        return 'text-red-600';
    };
    const getStatusBadge = (value, thresholds) => {
        if (value <= thresholds.good)
            return _jsx(Badge, { variant: "default", className: "bg-green-500", children: "Good" });
        if (value <= thresholds.warning)
            return _jsx(Badge, { variant: "secondary", className: "bg-yellow-500", children: "Warning" });
        return _jsx(Badge, { variant: "destructive", children: "Critical" });
    };
    if (isLoading) {
        return (_jsx("div", { className: "space-y-6", children: _jsx("div", { className: "grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4", children: [1, 2, 3, 4].map((i) => (_jsxs(Card, { className: "animate-pulse", children: [_jsx(CardHeader, { className: "pb-2", children: _jsx("div", { className: "h-4 bg-gray-200 rounded w-24" }) }), _jsxs(CardContent, { children: [_jsx("div", { className: "h-8 bg-gray-200 rounded w-16 mb-2" }), _jsx("div", { className: "h-4 bg-gray-200 rounded w-20" })] })] }, i))) }) }));
    }
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4", children: [_jsxs("div", { children: [_jsx("h3", { className: "text-lg font-semibold", children: "Custom Metrics" }), _jsx("p", { className: "text-sm text-muted-foreground", children: "Monitor your application performance and business KPIs" })] }), _jsxs("div", { className: "flex gap-2", children: [_jsxs(Button, { variant: autoRefresh ? "default" : "outline", size: "sm", onClick: () => setAutoRefresh(!autoRefresh), children: [_jsx(Activity, { className: "w-4 h-4 mr-2" }), "Auto-refresh"] }), _jsxs(Button, { variant: "outline", size: "sm", children: [_jsx(Timer, { className: "w-4 h-4 mr-2" }), "Set Alerts"] })] })] }), _jsxs(Tabs, { value: selectedMetric, onValueChange: setSelectedMetric, children: [_jsxs(TabsList, { className: "grid w-full grid-cols-3", children: [_jsx(TabsTrigger, { value: "performance", children: "Performance" }), _jsx(TabsTrigger, { value: "infrastructure", children: "Infrastructure" }), _jsx(TabsTrigger, { value: "business", children: "Business KPIs" })] }), _jsx(TabsContent, { value: "performance", className: "space-y-6", children: _jsxs("div", { className: "grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4", children: [_jsxs(Card, { children: [_jsxs(CardHeader, { className: "flex flex-row items-center justify-between space-y-0 pb-2", children: [_jsx(CardTitle, { className: "text-sm font-medium", children: "Response Time" }), _jsx(Clock, { className: "h-4 w-4 text-muted-foreground" })] }), _jsxs(CardContent, { children: [_jsxs("div", { className: "text-2xl font-bold", children: [metricsData?.performance.responseTime.current, "ms"] }), _jsxs("div", { className: "flex items-center space-x-1 text-xs", children: [getTrendIcon(metricsData?.performance.responseTime.trend || 'stable'), _jsxs("span", { className: getStatusColor(metricsData?.performance.responseTime.current || 0, { good: 200, warning: 500 }), children: [Math.abs(metricsData?.performance.responseTime.change || 0), "%"] })] }), _jsxs("div", { className: "mt-2 space-y-1 text-xs text-muted-foreground", children: [_jsxs("div", { children: ["Avg: ", metricsData?.performance.responseTime.average, "ms"] }), _jsxs("div", { children: ["P95: ", metricsData?.performance.responseTime.p95, "ms"] }), _jsxs("div", { children: ["P99: ", metricsData?.performance.responseTime.p99, "ms"] })] }), _jsx("div", { className: "mt-2", children: getStatusBadge(metricsData?.performance.responseTime.current || 0, { good: 200, warning: 500 }) })] })] }), _jsxs(Card, { children: [_jsxs(CardHeader, { className: "flex flex-row items-center justify-between space-y-0 pb-2", children: [_jsx(CardTitle, { className: "text-sm font-medium", children: "Throughput" }), _jsx(Zap, { className: "h-4 w-4 text-muted-foreground" })] }), _jsxs(CardContent, { children: [_jsx("div", { className: "text-2xl font-bold", children: metricsData?.performance.throughput.current.toLocaleString() }), _jsxs("div", { className: "flex items-center space-x-1 text-xs", children: [getTrendIcon(metricsData?.performance.throughput.trend || 'stable'), _jsxs("span", { className: "text-green-600", children: [Math.abs(metricsData?.performance.throughput.change || 0), "%"] })] }), _jsxs("div", { className: "mt-2 space-y-1 text-xs text-muted-foreground", children: [_jsxs("div", { children: ["Avg: ", metricsData?.performance.throughput.average.toLocaleString(), "/min"] }), _jsxs("div", { children: ["Peak: ", metricsData?.performance.throughput.peak.toLocaleString(), "/min"] })] }), _jsx("div", { className: "mt-2", children: _jsx(Badge, { variant: "default", className: "bg-green-500", children: "Healthy" }) })] })] }), _jsxs(Card, { children: [_jsxs(CardHeader, { className: "flex flex-row items-center justify-between space-y-0 pb-2", children: [_jsx(CardTitle, { className: "text-sm font-medium", children: "Error Rate" }), _jsx(AlertTriangle, { className: "h-4 w-4 text-muted-foreground" })] }), _jsxs(CardContent, { children: [_jsxs("div", { className: "text-2xl font-bold", children: [metricsData?.performance.errorRate.current, "%"] }), _jsxs("div", { className: "flex items-center space-x-1 text-xs", children: [getTrendIcon(metricsData?.performance.errorRate.trend || 'stable'), _jsxs("span", { className: "text-green-600", children: [Math.abs(metricsData?.performance.errorRate.change || 0), "%"] })] }), _jsxs("div", { className: "mt-2 space-y-1 text-xs text-muted-foreground", children: [_jsxs("div", { children: ["Avg: ", metricsData?.performance.errorRate.average, "%"] }), _jsxs("div", { children: ["Target: ", '<1%'] })] }), _jsx("div", { className: "mt-2", children: getStatusBadge(metricsData?.performance.errorRate.current || 0, { good: 1, warning: 5 }) })] })] }), _jsxs(Card, { children: [_jsxs(CardHeader, { className: "flex flex-row items-center justify-between space-y-0 pb-2", children: [_jsx(CardTitle, { className: "text-sm font-medium", children: "Availability" }), _jsx(CheckCircle, { className: "h-4 w-4 text-muted-foreground" })] }), _jsxs(CardContent, { children: [_jsxs("div", { className: "text-2xl font-bold", children: [metricsData?.performance.availability.current, "%"] }), _jsxs("div", { className: "flex items-center space-x-1 text-xs", children: [getTrendIcon(metricsData?.performance.availability.trend || 'stable'), _jsxs("span", { className: "text-green-600", children: [Math.abs(metricsData?.performance.availability.change || 0), "%"] })] }), _jsxs("div", { className: "mt-2 space-y-1 text-xs text-muted-foreground", children: [_jsxs("div", { children: ["Avg: ", metricsData?.performance.availability.average, "%"] }), _jsxs("div", { children: ["Target: ", '>99.9%'] })] }), _jsx("div", { className: "mt-2", children: getStatusBadge(100 - (metricsData?.performance.availability.current || 0), { good: 0.1, warning: 0.5 }) })] })] })] }) }), _jsx(TabsContent, { value: "infrastructure", className: "space-y-6", children: _jsxs("div", { className: "grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4", children: [_jsxs(Card, { children: [_jsxs(CardHeader, { className: "flex flex-row items-center justify-between space-y-0 pb-2", children: [_jsx(CardTitle, { className: "text-sm font-medium", children: "CPU Usage" }), _jsx(Cpu, { className: "h-4 w-4 text-muted-foreground" })] }), _jsxs(CardContent, { children: [_jsxs("div", { className: "text-2xl font-bold", children: [metricsData?.infrastructure.cpu.current, "%"] }), _jsxs("div", { className: "flex items-center space-x-1 text-xs", children: [getTrendIcon(metricsData?.infrastructure.cpu.trend || 'stable'), _jsxs("span", { className: "text-green-600", children: [Math.abs(metricsData?.infrastructure.cpu.change || 0), "%"] })] }), _jsx("div", { className: "mt-2", children: _jsx(Progress, { value: metricsData?.infrastructure.cpu.current, className: "h-2" }) }), _jsxs("div", { className: "mt-2 space-y-1 text-xs text-muted-foreground", children: [_jsxs("div", { children: ["Avg: ", metricsData?.infrastructure.cpu.average, "%"] }), _jsxs("div", { children: ["Peak: ", metricsData?.infrastructure.cpu.peak, "%"] })] })] })] }), _jsxs(Card, { children: [_jsxs(CardHeader, { className: "flex flex-row items-center justify-between space-y-0 pb-2", children: [_jsx(CardTitle, { className: "text-sm font-medium", children: "Memory Usage" }), _jsx(MemoryStick, { className: "h-4 w-4 text-muted-foreground" })] }), _jsxs(CardContent, { children: [_jsxs("div", { className: "text-2xl font-bold", children: [metricsData?.infrastructure.memory.current, "%"] }), _jsxs("div", { className: "flex items-center space-x-1 text-xs", children: [getTrendIcon(metricsData?.infrastructure.memory.trend || 'stable'), _jsxs("span", { className: "text-green-600", children: [Math.abs(metricsData?.infrastructure.memory.change || 0), "%"] })] }), _jsx("div", { className: "mt-2", children: _jsx(Progress, { value: metricsData?.infrastructure.memory.current, className: "h-2" }) }), _jsxs("div", { className: "mt-2 space-y-1 text-xs text-muted-foreground", children: [_jsxs("div", { children: ["Avg: ", metricsData?.infrastructure.memory.average, "%"] }), _jsxs("div", { children: ["Peak: ", metricsData?.infrastructure.memory.peak, "%"] })] })] })] }), _jsxs(Card, { children: [_jsxs(CardHeader, { className: "flex flex-row items-center justify-between space-y-0 pb-2", children: [_jsx(CardTitle, { className: "text-sm font-medium", children: "Disk Usage" }), _jsx(HardDrive, { className: "h-4 w-4 text-muted-foreground" })] }), _jsxs(CardContent, { children: [_jsxs("div", { className: "text-2xl font-bold", children: [metricsData?.infrastructure.disk.current, "%"] }), _jsxs("div", { className: "flex items-center space-x-1 text-xs", children: [getTrendIcon(metricsData?.infrastructure.disk.trend || 'stable'), _jsxs("span", { className: "text-green-600", children: [Math.abs(metricsData?.infrastructure.disk.change || 0), "%"] })] }), _jsx("div", { className: "mt-2", children: _jsx(Progress, { value: metricsData?.infrastructure.disk.current, className: "h-2" }) }), _jsxs("div", { className: "mt-2 space-y-1 text-xs text-muted-foreground", children: [_jsxs("div", { children: ["Avg: ", metricsData?.infrastructure.disk.average, "%"] }), _jsxs("div", { children: ["Peak: ", metricsData?.infrastructure.disk.peak, "%"] })] })] })] }), _jsxs(Card, { children: [_jsxs(CardHeader, { className: "flex flex-row items-center justify-between space-y-0 pb-2", children: [_jsx(CardTitle, { className: "text-sm font-medium", children: "Network Traffic" }), _jsx(Network, { className: "h-4 w-4 text-muted-foreground" })] }), _jsxs(CardContent, { children: [_jsxs("div", { className: "text-2xl font-bold", children: ["\u2193", metricsData?.infrastructure.network.inbound, "Mbps"] }), _jsxs("div", { className: "flex items-center space-x-1 text-xs", children: [getTrendIcon(metricsData?.infrastructure.network.trend || 'stable'), _jsxs("span", { className: "text-green-600", children: [Math.abs(metricsData?.infrastructure.network.change || 0), "%"] })] }), _jsxs("div", { className: "mt-2 space-y-1 text-xs text-muted-foreground", children: [_jsxs("div", { children: ["Inbound: ", metricsData?.infrastructure.network.inbound, "Mbps"] }), _jsxs("div", { children: ["Outbound: ", metricsData?.infrastructure.network.outbound, "Mbps"] })] })] })] })] }) }), _jsx(TabsContent, { value: "business", className: "space-y-6", children: _jsxs("div", { className: "grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4", children: [_jsxs(Card, { children: [_jsxs(CardHeader, { className: "flex flex-row items-center justify-between space-y-0 pb-2", children: [_jsx(CardTitle, { className: "text-sm font-medium", children: "Conversions" }), _jsx(TrendingUp, { className: "h-4 w-4 text-muted-foreground" })] }), _jsxs(CardContent, { children: [_jsx("div", { className: "text-2xl font-bold", children: metricsData?.business.conversions.current }), _jsxs("div", { className: "flex items-center space-x-1 text-xs", children: [getTrendIcon(metricsData?.business.conversions.trend || 'stable'), _jsxs("span", { className: "text-green-600", children: [Math.abs(metricsData?.business.conversions.change || 0), "%"] })] }), _jsx("div", { className: "mt-2", children: _jsx(Progress, { value: metricsData?.business.conversions.completion, className: "h-2" }) }), _jsxs("div", { className: "mt-2 space-y-1 text-xs text-muted-foreground", children: [_jsxs("div", { children: ["Goal: ", metricsData?.business.conversions.goal] }), _jsxs("div", { children: ["Completion: ", metricsData?.business.conversions.completion, "%"] })] })] })] }), _jsxs(Card, { children: [_jsxs(CardHeader, { className: "flex flex-row items-center justify-between space-y-0 pb-2", children: [_jsx(CardTitle, { className: "text-sm font-medium", children: "Revenue" }), _jsx(TrendingUp, { className: "h-4 w-4 text-muted-foreground" })] }), _jsxs(CardContent, { children: [_jsxs("div", { className: "text-2xl font-bold", children: ["$", (metricsData?.business.revenue.current || 0).toLocaleString()] }), _jsxs("div", { className: "flex items-center space-x-1 text-xs", children: [getTrendIcon(metricsData?.business.revenue.trend || 'stable'), _jsxs("span", { className: "text-green-600", children: [Math.abs(metricsData?.business.revenue.change || 0), "%"] })] }), _jsx("div", { className: "mt-2", children: _jsx(Progress, { value: metricsData?.business.revenue.completion, className: "h-2" }) }), _jsxs("div", { className: "mt-2 space-y-1 text-xs text-muted-foreground", children: [_jsxs("div", { children: ["Goal: $", (metricsData?.business.revenue.goal || 0).toLocaleString()] }), _jsxs("div", { children: ["Completion: ", metricsData?.business.revenue.completion, "%"] })] })] })] }), _jsxs(Card, { children: [_jsxs(CardHeader, { className: "flex flex-row items-center justify-between space-y-0 pb-2", children: [_jsx(CardTitle, { className: "text-sm font-medium", children: "User Satisfaction" }), _jsx(CheckCircle, { className: "h-4 w-4 text-muted-foreground" })] }), _jsxs(CardContent, { children: [_jsxs("div", { className: "text-2xl font-bold", children: [metricsData?.business.userSatisfaction.current, "/5"] }), _jsxs("div", { className: "flex items-center space-x-1 text-xs", children: [getTrendIcon(metricsData?.business.userSatisfaction.trend || 'stable'), _jsxs("span", { className: "text-gray-600", children: [Math.abs(metricsData?.business.userSatisfaction.change || 0), "%"] })] }), _jsx("div", { className: "mt-2", children: _jsx(Progress, { value: (metricsData?.business.userSatisfaction.current || 0) * 20, className: "h-2" }) }), _jsxs("div", { className: "mt-2 space-y-1 text-xs text-muted-foreground", children: [_jsxs("div", { children: ["Goal: ", metricsData?.business.userSatisfaction.goal, "/5"] }), _jsxs("div", { children: ["Completion: ", metricsData?.business.userSatisfaction.completion, "%"] })] })] })] }), _jsxs(Card, { children: [_jsxs(CardHeader, { className: "flex flex-row items-center justify-between space-y-0 pb-2", children: [_jsx(CardTitle, { className: "text-sm font-medium", children: "Active Users" }), _jsx(Users, { className: "h-4 w-4 text-muted-foreground" })] }), _jsxs(CardContent, { children: [_jsx("div", { className: "text-2xl font-bold", children: (metricsData?.business.activeUsers.current || 0).toLocaleString() }), _jsxs("div", { className: "flex items-center space-x-1 text-xs", children: [getTrendIcon(metricsData?.business.activeUsers.trend || 'stable'), _jsxs("span", { className: "text-green-600", children: [Math.abs(metricsData?.business.activeUsers.change || 0), "%"] })] }), _jsx("div", { className: "mt-2", children: _jsx(Progress, { value: metricsData?.business.activeUsers.completion, className: "h-2" }) }), _jsxs("div", { className: "mt-2 space-y-1 text-xs text-muted-foreground", children: [_jsxs("div", { children: ["Goal: ", (metricsData?.business.activeUsers.goal || 0).toLocaleString()] }), _jsxs("div", { children: ["Completion: ", metricsData?.business.activeUsers.completion, "%"] })] })] })] })] }) })] })] }));
}
