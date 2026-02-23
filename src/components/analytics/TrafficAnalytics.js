import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Search, Globe, ExternalLink, MousePointer, TrendingUp, ArrowUp, ArrowDown } from 'lucide-react';
export function TrafficAnalytics({ timeRange: _timeRange }) {
    // Mock data - in real implementation, this would come from Umami API
    const trafficData = {
        sources: [
            {
                name: 'Organic Search',
                percentage: 35,
                visitors: 15832,
                trend: 'up',
                change: 12.5
            },
            {
                name: 'Direct Traffic',
                percentage: 28,
                visitors: 12666,
                trend: 'up',
                change: 8.3
            },
            {
                name: 'Social Media',
                percentage: 18,
                visitors: 8142,
                trend: 'down',
                change: -3.2
            },
            {
                name: 'Referral',
                percentage: 12,
                visitors: 5428,
                trend: 'up',
                change: 15.7
            },
            {
                name: 'Email Marketing',
                percentage: 4,
                visitors: 1809,
                trend: 'up',
                change: 22.1
            },
            {
                name: 'Paid Search',
                percentage: 3,
                visitors: 1357,
                trend: 'down',
                change: -8.9
            }
        ],
        referrers: [
            { name: 'google.com', visitors: 12456, percentage: 27.5 },
            { name: 'github.com', visitors: 8234, percentage: 18.2 },
            { name: 'stackoverflow.com', visitors: 5423, percentage: 12.0 },
            { name: 'twitter.com', visitors: 3612, percentage: 8.0 },
            { name: 'linkedin.com', visitors: 2891, percentage: 6.4 },
            { name: 'Others', visitors: 12618, percentage: 27.9 }
        ],
        campaigns: [
            {
                name: 'Summer Launch 2024',
                visitors: 8234,
                conversionRate: 4.2,
                revenue: 12456
            },
            {
                name: 'Product Update',
                visitors: 5423,
                conversionRate: 3.8,
                revenue: 8234
            },
            {
                name: 'Newsletter Signup',
                visitors: 3612,
                conversionRate: 2.1,
                revenue: 2891
            },
            {
                name: 'Social Media Push',
                visitors: 2891,
                conversionRate: 1.8,
                revenue: 1567
            }
        ],
        keywords: [
            { name: 'container orchestration', visitors: 3421, percentage: 12.3 },
            { name: 'paas platform', visitors: 2891, percentage: 10.4 },
            { name: 'docker deployment', visitors: 2456, percentage: 8.8 },
            { name: 'self-hosted analytics', visitors: 1987, percentage: 7.1 },
            { name: 'railway alternative', visitors: 1654, percentage: 5.9 }
        ]
    };
    const getTrendIcon = (trend) => {
        return trend === 'up' ? (_jsx(ArrowUp, { className: "w-3 h-3 text-green-500" })) : (_jsx(ArrowDown, { className: "w-3 h-3 text-red-500" }));
    };
    const getSourceIcon = (source) => {
        if (source.includes('Search'))
            return _jsx(Search, { className: "w-4 h-4" });
        if (source.includes('Direct'))
            return _jsx(MousePointer, { className: "w-4 h-4" });
        if (source.includes('Social'))
            return _jsx(Globe, { className: "w-4 h-4" });
        if (source.includes('Referral'))
            return _jsx(ExternalLink, { className: "w-4 h-4" });
        return _jsx(TrendingUp, { className: "w-4 h-4" });
    };
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs(Card, { children: [_jsx(CardHeader, { children: _jsxs(CardTitle, { className: "flex items-center gap-2", children: [_jsx(TrendingUp, { className: "w-5 h-5" }), "Traffic Sources"] }) }), _jsx(CardContent, { className: "space-y-4", children: trafficData.sources.map((source) => (_jsxs("div", { className: "space-y-2", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center gap-2", children: [getSourceIcon(source.name), _jsx("span", { className: "text-sm font-medium", children: source.name }), _jsxs("div", { className: "flex items-center gap-1", children: [getTrendIcon(source.trend), _jsxs("span", { className: `text-xs ${source.trend === 'up' ? 'text-green-600' : 'text-red-600'}`, children: [Math.abs(source.change), "%"] })] })] }), _jsxs("div", { className: "text-right", children: [_jsxs("div", { className: "font-semibold", children: [source.percentage, "%"] }), _jsxs("div", { className: "text-xs text-muted-foreground", children: [source.visitors.toLocaleString(), " visitors"] })] })] }), _jsx(Progress, { value: source.percentage, className: "h-2" })] }, source.name))) })] }), _jsxs(Card, { children: [_jsx(CardHeader, { children: _jsxs(CardTitle, { className: "flex items-center gap-2", children: [_jsx(ExternalLink, { className: "w-5 h-5" }), "Top Referrers"] }) }), _jsx(CardContent, { className: "space-y-3", children: trafficData.referrers.map((referrer) => (_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("div", { className: "w-3 h-3 rounded-full bg-blue-500" }), _jsx("span", { className: "text-sm", children: referrer.name })] }), _jsxs("div", { className: "text-right", children: [_jsxs("div", { className: "font-semibold", children: [referrer.percentage, "%"] }), _jsxs("div", { className: "text-xs text-muted-foreground", children: [referrer.visitors.toLocaleString(), " visitors"] })] })] }, referrer.name))) })] }), _jsxs(Card, { children: [_jsx(CardHeader, { children: _jsxs(CardTitle, { className: "flex items-center gap-2", children: [_jsx(TrendingUp, { className: "w-5 h-5" }), "Campaign Performance"] }) }), _jsx(CardContent, { className: "space-y-4", children: trafficData.campaigns.map((campaign) => (_jsxs("div", { className: "border rounded-lg p-3", children: [_jsxs("div", { className: "flex items-center justify-between mb-2", children: [_jsx("h4", { className: "font-medium text-sm", children: campaign.name }), _jsxs(Badge, { variant: "secondary", children: [campaign.conversionRate, "% conversion"] })] }), _jsxs("div", { className: "grid grid-cols-2 gap-4 text-xs", children: [_jsxs("div", { children: [_jsx("div", { className: "text-muted-foreground", children: "Visitors" }), _jsx("div", { className: "font-semibold", children: campaign.visitors.toLocaleString() })] }), _jsxs("div", { children: [_jsx("div", { className: "text-muted-foreground", children: "Revenue" }), _jsxs("div", { className: "font-semibold", children: ["$", campaign.revenue.toLocaleString()] })] })] })] }, campaign.name))) })] }), _jsxs(Card, { children: [_jsx(CardHeader, { children: _jsxs(CardTitle, { className: "flex items-center gap-2", children: [_jsx(Search, { className: "w-5 h-5" }), "Top Search Keywords"] }) }), _jsx(CardContent, { className: "space-y-3", children: trafficData.keywords.map((keyword) => (_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("div", { className: "w-3 h-3 rounded-full bg-green-500" }), _jsx("span", { className: "text-sm", children: keyword.name })] }), _jsxs("div", { className: "text-right", children: [_jsxs("div", { className: "font-semibold", children: [keyword.percentage, "%"] }), _jsxs("div", { className: "text-xs text-muted-foreground", children: [keyword.visitors.toLocaleString(), " visitors"] })] })] }, keyword.name))) })] })] }));
}
