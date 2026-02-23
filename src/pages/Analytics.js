import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Download, Calendar } from 'lucide-react';
import { AnalyticsOverview } from '@/components/analytics/AnalyticsOverview';
import { VisitorAnalytics } from '@/components/analytics/VisitorAnalytics';
import { TrafficAnalytics } from '@/components/analytics/TrafficAnalytics';
import { ContentAnalytics } from '@/components/analytics/ContentAnalytics';
import { RealTimeAnalytics } from '@/components/analytics/RealTimeAnalytics';
import { CustomMetricsDashboard } from '@/components/analytics/CustomMetricsDashboard';
export default function AnalyticsPage() {
    const [timeRange, setTimeRange] = useState('7d');
    const [_selectedMetric, _setSelectedMetric] = useState('visitors');
    const timeRanges = [
        { value: '24h', label: '24 Hours' },
        { value: '7d', label: '7 Days' },
        { value: '30d', label: '30 Days' },
        { value: '90d', label: '90 Days' },
        { value: '1y', label: '1 Year' }
    ];
    return (_jsxs("div", { className: "p-4 md:p-6 space-y-6", children: [_jsxs("div", { className: "flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-2xl md:text-3xl font-bold text-foreground", children: "Analytics" }), _jsx("p", { className: "text-sm md:text-base text-muted-foreground", children: "Monitor your application performance and user behavior" })] }), _jsxs("div", { className: "flex gap-2", children: [_jsxs(Button, { variant: "outline", size: "sm", children: [_jsx(Download, { className: "w-4 h-4 mr-2" }), "Export"] }), _jsxs(Button, { size: "sm", children: [_jsx(Calendar, { className: "w-4 h-4 mr-2" }), "Schedule Report"] })] })] }), _jsx("div", { className: "flex flex-wrap gap-2", children: timeRanges.map((range) => (_jsx(Button, { variant: timeRange === range.value ? "default" : "outline", size: "sm", onClick: () => setTimeRange(range.value), children: range.label }, range.value))) }), _jsx(AnalyticsOverview, { timeRange: timeRange }), _jsx(CustomMetricsDashboard, { timeRange: timeRange }), _jsxs(Tabs, { defaultValue: "visitors", className: "space-y-6", children: [_jsxs(TabsList, { className: "grid w-full grid-cols-2 lg:grid-cols-4", children: [_jsx(TabsTrigger, { value: "visitors", children: "Visitors" }), _jsx(TabsTrigger, { value: "traffic", children: "Traffic Sources" }), _jsx(TabsTrigger, { value: "content", children: "Content" }), _jsx(TabsTrigger, { value: "realtime", children: "Real-time" })] }), _jsx(TabsContent, { value: "visitors", children: _jsx(VisitorAnalytics, { timeRange: timeRange }) }), _jsx(TabsContent, { value: "traffic", children: _jsx(TrafficAnalytics, { timeRange: timeRange }) }), _jsx(TabsContent, { value: "content", children: _jsx(ContentAnalytics, { timeRange: timeRange }) }), _jsx(TabsContent, { value: "realtime", children: _jsx(RealTimeAnalytics, {}) })] })] }));
}
