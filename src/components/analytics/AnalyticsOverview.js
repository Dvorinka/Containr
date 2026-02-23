import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';
import { analyticsApi } from '@/lib/api';
import { TrendingUp, Users, Eye, MousePointer, Clock, Activity, ArrowUp, ArrowDown } from 'lucide-react';
export function AnalyticsOverview({ timeRange }) {
    const { data: overviewData, isLoading, error } = useQuery({
        queryKey: ['analytics-overview', timeRange],
        queryFn: () => analyticsApi.getOverview(timeRange),
        refetchInterval: 30000, // Refresh every 30 seconds
    });
    if (isLoading) {
        return (_jsx("div", { className: "grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6", children: [1, 2, 3, 4, 5, 6].map((i) => (_jsxs(Card, { className: "animate-pulse", children: [_jsxs(CardHeader, { className: "flex flex-row items-center justify-between space-y-0 pb-2", children: [_jsx("div", { className: "h-4 bg-gray-200 rounded w-20" }), _jsx("div", { className: "h-4 w-4 bg-gray-200 rounded" })] }), _jsxs(CardContent, { children: [_jsx("div", { className: "h-8 bg-gray-200 rounded w-16 mb-2" }), _jsx("div", { className: "h-4 bg-gray-200 rounded w-24" })] })] }, i))) }));
    }
    if (error) {
        return (_jsx(Card, { children: _jsx(CardContent, { className: "p-6", children: _jsx("div", { className: "text-center text-red-600", children: "Failed to load analytics data. Please try again later." }) }) }));
    }
    const metrics = [
        {
            title: 'Unique Visitors',
            value: overviewData?.visitors.current.toLocaleString() || '0',
            change: overviewData?.visitors.change || 0,
            trend: overviewData?.visitors.trend || 'up',
            icon: Users,
            format: 'number'
        },
        {
            title: 'Page Views',
            value: overviewData?.pageviews.current.toLocaleString() || '0',
            change: overviewData?.pageviews.change || 0,
            trend: overviewData?.pageviews.trend || 'up',
            icon: Eye,
            format: 'number'
        },
        {
            title: 'Sessions',
            value: overviewData?.sessions.current.toLocaleString() || '0',
            change: overviewData?.sessions.change || 0,
            trend: overviewData?.sessions.trend || 'up',
            icon: MousePointer,
            format: 'number'
        },
        {
            title: 'Bounce Rate',
            value: `${overviewData?.bounceRate.current || 0}%`,
            change: overviewData?.bounceRate.change || 0,
            trend: overviewData?.bounceRate.trend || 'up',
            icon: Activity,
            format: 'percentage'
        },
        {
            title: 'Session Duration',
            value: overviewData ?
                `${Math.floor(overviewData.sessionDuration.current / 60)}m ${overviewData.sessionDuration.current % 60}s` :
                '0m 0s',
            change: overviewData?.sessionDuration.change || 0,
            trend: overviewData?.sessionDuration.trend || 'up',
            icon: Clock,
            format: 'duration'
        },
        {
            title: 'Conversion Rate',
            value: `${overviewData?.conversionRate.current || 0}%`,
            change: overviewData?.conversionRate.change || 0,
            trend: overviewData?.conversionRate.trend || 'up',
            icon: TrendingUp,
            format: 'percentage'
        }
    ];
    const getTrendIcon = (trend) => {
        return trend === 'up' ? (_jsx(ArrowUp, { className: "w-4 h-4 text-green-500" })) : (_jsx(ArrowDown, { className: "w-4 h-4 text-red-500" }));
    };
    const getTrendColor = (trend) => {
        return trend === 'up' ? 'text-green-600' : 'text-red-600';
    };
    return (_jsx("div", { className: "grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6", children: metrics.map((metric) => (_jsxs(Card, { className: "relative overflow-hidden", children: [_jsxs(CardHeader, { className: "flex flex-row items-center justify-between space-y-0 pb-2", children: [_jsx(CardTitle, { className: "text-sm font-medium text-muted-foreground", children: metric.title }), _jsx(metric.icon, { className: "h-4 w-4 text-muted-foreground" })] }), _jsxs(CardContent, { children: [_jsx("div", { className: "text-2xl font-bold", children: metric.value }), _jsxs("div", { className: "flex items-center space-x-1 text-xs", children: [getTrendIcon(metric.trend), _jsxs("span", { className: getTrendColor(metric.trend), children: [Math.abs(metric.change), "%"] }), _jsx("span", { className: "text-muted-foreground", children: "from last period" })] })] })] }, metric.title))) }));
}
