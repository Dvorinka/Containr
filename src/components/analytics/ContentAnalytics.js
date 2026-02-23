import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { FileText, Eye, MousePointer, ArrowUp, ArrowDown, BookOpen, Link } from 'lucide-react';
export function ContentAnalytics({ timeRange: _timeRange }) {
    // Mock data - in real implementation, this would come from Umami API
    const contentData = {
        topPages: [
            {
                url: '/dashboard',
                title: 'Dashboard',
                pageviews: 12456,
                uniquePageviews: 8234,
                avgTimeOnPage: 245,
                bounceRate: 32.1,
                exitRate: 28.4,
                trend: 'up',
                change: 12.5
            },
            {
                url: '/projects',
                title: 'Projects',
                pageviews: 9876,
                uniquePageviews: 6789,
                avgTimeOnPage: 189,
                bounceRate: 28.7,
                exitRate: 31.2,
                trend: 'up',
                change: 8.3
            },
            {
                url: '/analytics',
                title: 'Analytics',
                pageviews: 7654,
                uniquePageviews: 5432,
                avgTimeOnPage: 312,
                bounceRate: 24.1,
                exitRate: 26.8,
                trend: 'down',
                change: -3.2
            },
            {
                url: '/docs',
                title: 'Documentation',
                pageviews: 5432,
                uniquePageviews: 4321,
                avgTimeOnPage: 428,
                bounceRate: 18.9,
                exitRate: 22.3,
                trend: 'up',
                change: 15.7
            },
            {
                url: '/settings',
                title: 'Settings',
                pageviews: 3210,
                uniquePageviews: 2876,
                avgTimeOnPage: 156,
                bounceRate: 41.2,
                exitRate: 38.7,
                trend: 'up',
                change: 6.8
            }
        ],
        landingPages: [
            {
                url: '/',
                title: 'Home',
                entrances: 8765,
                bounceRate: 34.2,
                conversions: 234,
                conversionRate: 2.7
            },
            {
                url: '/blog/getting-started',
                title: 'Getting Started',
                entrances: 5432,
                bounceRate: 28.9,
                conversions: 189,
                conversionRate: 3.5
            },
            {
                url: '/features',
                title: 'Features',
                entrances: 3210,
                bounceRate: 31.5,
                conversions: 98,
                conversionRate: 3.1
            }
        ],
        exitPages: [
            {
                url: '/thank-you',
                title: 'Thank You',
                exits: 2345,
                exitRate: 78.9,
                totalPageviews: 2976
            },
            {
                url: '/pricing',
                title: 'Pricing',
                exits: 1876,
                exitRate: 45.2,
                totalPageviews: 4156
            },
            {
                url: '/contact',
                title: 'Contact',
                exits: 1543,
                exitRate: 38.7,
                totalPageviews: 3987
            }
        ],
        events: [
            {
                name: 'button_click',
                count: 12456,
                uniqueUsers: 8234,
                category: 'engagement'
            },
            {
                name: 'form_submit',
                count: 3456,
                uniqueUsers: 2876,
                category: 'conversion'
            },
            {
                name: 'video_play',
                count: 2345,
                uniqueUsers: 1987,
                category: 'engagement'
            },
            {
                name: 'download',
                count: 1234,
                uniqueUsers: 1098,
                category: 'conversion'
            }
        ]
    };
    const getTrendIcon = (trend) => {
        return trend === 'up' ? (_jsx(ArrowUp, { className: "w-3 h-3 text-green-500" })) : (_jsx(ArrowDown, { className: "w-3 h-3 text-red-500" }));
    };
    const formatDuration = (seconds) => {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes}m ${remainingSeconds}s`;
    };
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs(Card, { children: [_jsx(CardHeader, { children: _jsxs(CardTitle, { className: "flex items-center gap-2", children: [_jsx(FileText, { className: "w-5 h-5" }), "Top Pages"] }) }), _jsx(CardContent, { className: "space-y-4", children: contentData.topPages.map((page) => (_jsxs("div", { className: "border rounded-lg p-3", children: [_jsxs("div", { className: "flex items-center justify-between mb-2", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Link, { className: "w-4 h-4 text-muted-foreground" }), _jsxs("div", { children: [_jsx("h4", { className: "font-medium text-sm", children: page.title }), _jsx("p", { className: "text-xs text-muted-foreground", children: page.url })] })] }), _jsxs("div", { className: "flex items-center gap-1", children: [getTrendIcon(page.trend), _jsxs("span", { className: `text-xs ${page.trend === 'up' ? 'text-green-600' : 'text-red-600'}`, children: [Math.abs(page.change), "%"] })] })] }), _jsxs("div", { className: "grid grid-cols-2 md:grid-cols-4 gap-4 text-xs", children: [_jsxs("div", { children: [_jsx("div", { className: "text-muted-foreground", children: "Pageviews" }), _jsx("div", { className: "font-semibold", children: page.pageviews.toLocaleString() })] }), _jsxs("div", { children: [_jsx("div", { className: "text-muted-foreground", children: "Unique" }), _jsx("div", { className: "font-semibold", children: page.uniquePageviews.toLocaleString() })] }), _jsxs("div", { children: [_jsx("div", { className: "text-muted-foreground", children: "Avg. Time" }), _jsx("div", { className: "font-semibold", children: formatDuration(page.avgTimeOnPage) })] }), _jsxs("div", { children: [_jsx("div", { className: "text-muted-foreground", children: "Bounce Rate" }), _jsxs("div", { className: "font-semibold", children: [page.bounceRate, "%"] })] })] })] }, page.url))) })] }), _jsxs(Card, { children: [_jsx(CardHeader, { children: _jsxs(CardTitle, { className: "flex items-center gap-2", children: [_jsx(BookOpen, { className: "w-5 h-5" }), "Landing Pages"] }) }), _jsx(CardContent, { className: "space-y-4", children: contentData.landingPages.map((page) => (_jsxs("div", { className: "space-y-2", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("h4", { className: "font-medium text-sm", children: page.title }), _jsx("p", { className: "text-xs text-muted-foreground", children: page.url })] }), _jsx("div", { className: "text-right", children: _jsxs(Badge, { variant: page.conversionRate > 3 ? "default" : "secondary", children: [page.conversionRate, "% conversion"] }) })] }), _jsxs("div", { className: "grid grid-cols-3 gap-4 text-xs", children: [_jsxs("div", { children: [_jsx("div", { className: "text-muted-foreground", children: "Entrances" }), _jsx("div", { className: "font-semibold", children: page.entrances.toLocaleString() })] }), _jsxs("div", { children: [_jsx("div", { className: "text-muted-foreground", children: "Bounce Rate" }), _jsxs("div", { className: "font-semibold", children: [page.bounceRate, "%"] })] }), _jsxs("div", { children: [_jsx("div", { className: "text-muted-foreground", children: "Conversions" }), _jsx("div", { className: "font-semibold", children: page.conversions })] })] }), _jsx(Progress, { value: page.bounceRate, className: "h-2" })] }, page.url))) })] }), _jsxs(Card, { children: [_jsx(CardHeader, { children: _jsxs(CardTitle, { className: "flex items-center gap-2", children: [_jsx(Eye, { className: "w-5 h-5" }), "Exit Pages"] }) }), _jsx(CardContent, { className: "space-y-3", children: contentData.exitPages.map((page) => (_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("h4", { className: "font-medium text-sm", children: page.title }), _jsx("p", { className: "text-xs text-muted-foreground", children: page.url })] }), _jsxs("div", { className: "text-right", children: [_jsxs("div", { className: "font-semibold", children: [page.exitRate, "%"] }), _jsxs("div", { className: "text-xs text-muted-foreground", children: [page.exits.toLocaleString(), " exits"] })] })] }, page.url))) })] }), _jsxs(Card, { children: [_jsx(CardHeader, { children: _jsxs(CardTitle, { className: "flex items-center gap-2", children: [_jsx(MousePointer, { className: "w-5 h-5" }), "Custom Events"] }) }), _jsx(CardContent, { className: "space-y-3", children: contentData.events.map((event) => (_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("div", { className: "w-3 h-3 rounded-full bg-purple-500" }), _jsxs("div", { children: [_jsx("span", { className: "text-sm font-medium", children: event.name }), _jsx(Badge, { variant: "outline", className: "ml-2 text-xs", children: event.category })] })] }), _jsxs("div", { className: "text-right", children: [_jsx("div", { className: "font-semibold", children: event.count.toLocaleString() }), _jsxs("div", { className: "text-xs text-muted-foreground", children: [event.uniqueUsers.toLocaleString(), " users"] })] })] }, event.name))) })] })] }));
}
