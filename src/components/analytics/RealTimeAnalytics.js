import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Activity, Users, Eye, MousePointer, Monitor, Smartphone, Clock, TrendingUp, MapPin } from 'lucide-react';
export function RealTimeAnalytics() {
    const [_currentTime, setCurrentTime] = useState(new Date());
    const [activeUsers, setActiveUsers] = useState(127);
    const [currentVisitors, setCurrentVisitors] = useState(34);
    // Mock real-time data - in real implementation, this would update from WebSocket/API
    const [realTimeData, _setRealTimeData] = useState({
        onlineUsers: 127,
        currentVisitors: 34,
        pageviews: [
            { url: '/dashboard', title: 'Dashboard', count: 12, percentage: 35 },
            { url: '/projects', title: 'Projects', count: 8, percentage: 24 },
            { url: '/analytics', title: 'Analytics', count: 6, percentage: 18 },
            { url: '/docs', title: 'Documentation', count: 4, percentage: 12 },
            { url: '/settings', title: 'Settings', count: 4, percentage: 11 }
        ],
        locations: [
            { country: 'United States', count: 8, percentage: 24 },
            { country: 'United Kingdom', count: 6, percentage: 18 },
            { country: 'Germany', count: 4, percentage: 12 },
            { country: 'Canada', count: 3, percentage: 9 },
            { country: 'France', count: 3, percentage: 9 },
            { country: 'Others', count: 6, percentage: 28 }
        ],
        devices: [
            { type: 'desktop', count: 18, percentage: 53 },
            { type: 'mobile', count: 12, percentage: 35 },
            { type: 'tablet', count: 4, percentage: 12 }
        ],
        recentActivity: [
            {
                type: 'page_view',
                user: 'User 1234',
                page: '/dashboard',
                location: 'United States',
                device: 'desktop',
                timestamp: new Date(Date.now() - 2 * 60 * 1000)
            },
            {
                type: 'page_view',
                user: 'User 5678',
                page: '/projects',
                location: 'United Kingdom',
                device: 'mobile',
                timestamp: new Date(Date.now() - 5 * 60 * 1000)
            },
            {
                type: 'event',
                user: 'User 9012',
                page: '/analytics',
                location: 'Germany',
                device: 'desktop',
                event: 'button_click',
                timestamp: new Date(Date.now() - 8 * 60 * 1000)
            },
            {
                type: 'page_view',
                user: 'User 3456',
                page: '/docs',
                location: 'Canada',
                device: 'tablet',
                timestamp: new Date(Date.now() - 12 * 60 * 1000)
            },
            {
                type: 'conversion',
                user: 'User 7890',
                page: '/pricing',
                location: 'France',
                device: 'mobile',
                event: 'form_submit',
                timestamp: new Date(Date.now() - 15 * 60 * 1000)
            }
        ]
    });
    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());
            // Simulate real-time updates
            setActiveUsers(prev => prev + Math.floor(Math.random() * 5) - 2);
            setCurrentVisitors(prev => prev + Math.floor(Math.random() * 3) - 1);
        }, 5000);
        return () => clearInterval(timer);
    }, []);
    const formatTimeAgo = (timestamp) => {
        const seconds = Math.floor((Date.now() - timestamp.getTime()) / 1000);
        if (seconds < 60)
            return 'just now';
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60)
            return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        return `${hours}h ago`;
    };
    const getActivityIcon = (type) => {
        switch (type) {
            case 'page_view':
                return _jsx(Eye, { className: "w-4 h-4 text-blue-500" });
            case 'event':
                return _jsx(MousePointer, { className: "w-4 h-4 text-purple-500" });
            case 'conversion':
                return _jsx(TrendingUp, { className: "w-4 h-4 text-green-500" });
            default:
                return _jsx(Activity, { className: "w-4 h-4 text-gray-500" });
        }
    };
    const getDeviceIcon = (device) => {
        switch (device) {
            case 'desktop':
                return _jsx(Monitor, { className: "w-3 h-3" });
            case 'mobile':
                return _jsx(Smartphone, { className: "w-3 h-3" });
            case 'tablet':
                return _jsx(Activity, { className: "w-3 h-3" });
            default:
                return _jsx(Monitor, { className: "w-3 h-3" });
        }
    };
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4", children: [_jsxs(Card, { children: [_jsxs(CardHeader, { className: "flex flex-row items-center justify-between space-y-0 pb-2", children: [_jsx(CardTitle, { className: "text-sm font-medium", children: "Online Users" }), _jsx(Users, { className: "h-4 w-4 text-muted-foreground" })] }), _jsxs(CardContent, { children: [_jsx("div", { className: "text-2xl font-bold", children: activeUsers }), _jsx("p", { className: "text-xs text-muted-foreground", children: "Active now" })] })] }), _jsxs(Card, { children: [_jsxs(CardHeader, { className: "flex flex-row items-center justify-between space-y-0 pb-2", children: [_jsx(CardTitle, { className: "text-sm font-medium", children: "Current Visitors" }), _jsx(Eye, { className: "h-4 w-4 text-muted-foreground" })] }), _jsxs(CardContent, { children: [_jsx("div", { className: "text-2xl font-bold", children: currentVisitors }), _jsx("p", { className: "text-xs text-muted-foreground", children: "On site now" })] })] }), _jsxs(Card, { children: [_jsxs(CardHeader, { className: "flex flex-row items-center justify-between space-y-0 pb-2", children: [_jsx(CardTitle, { className: "text-sm font-medium", children: "Pageviews/min" }), _jsx(Activity, { className: "h-4 w-4 text-muted-foreground" })] }), _jsxs(CardContent, { children: [_jsx("div", { className: "text-2xl font-bold", children: "47" }), _jsx("p", { className: "text-xs text-muted-foreground", children: "Last 5 minutes" })] })] }), _jsxs(Card, { children: [_jsxs(CardHeader, { className: "flex flex-row items-center justify-between space-y-0 pb-2", children: [_jsx(CardTitle, { className: "text-sm font-medium", children: "Avg. Duration" }), _jsx(Clock, { className: "h-4 w-4 text-muted-foreground" })] }), _jsxs(CardContent, { children: [_jsx("div", { className: "text-2xl font-bold", children: "3:24" }), _jsx("p", { className: "text-xs text-muted-foreground", children: "Current session" })] })] })] }), _jsxs("div", { className: "grid gap-6 grid-cols-1 lg:grid-cols-2", children: [_jsxs(Card, { children: [_jsx(CardHeader, { children: _jsxs(CardTitle, { className: "flex items-center gap-2", children: [_jsx(Eye, { className: "w-5 h-5" }), "Top Pages Now"] }) }), _jsx(CardContent, { className: "space-y-3", children: realTimeData.pageviews.map((page) => (_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("div", { className: "w-3 h-3 rounded-full bg-blue-500" }), _jsxs("div", { children: [_jsx("span", { className: "text-sm font-medium", children: page.title }), _jsx("p", { className: "text-xs text-muted-foreground", children: page.url })] })] }), _jsxs("div", { className: "text-right", children: [_jsx("div", { className: "font-semibold", children: page.count }), _jsxs("div", { className: "text-xs text-muted-foreground", children: [page.percentage, "%"] })] })] }, page.url))) })] }), _jsxs(Card, { children: [_jsx(CardHeader, { children: _jsxs(CardTitle, { className: "flex items-center gap-2", children: [_jsx(MapPin, { className: "w-5 h-5" }), "Live Locations"] }) }), _jsx(CardContent, { className: "space-y-3", children: realTimeData.locations.map((location) => (_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("div", { className: "w-3 h-3 rounded-full bg-green-500" }), _jsx("span", { className: "text-sm", children: location.country })] }), _jsxs("div", { className: "text-right", children: [_jsx("div", { className: "font-semibold", children: location.count }), _jsxs("div", { className: "text-xs text-muted-foreground", children: [location.percentage, "%"] })] })] }, location.country))) })] }), _jsxs(Card, { children: [_jsx(CardHeader, { children: _jsxs(CardTitle, { className: "flex items-center gap-2", children: [_jsx(Monitor, { className: "w-5 h-5" }), "Live Devices"] }) }), _jsx(CardContent, { className: "space-y-3", children: realTimeData.devices.map((device) => (_jsxs("div", { className: "space-y-2", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center gap-2", children: [getDeviceIcon(device.type), _jsx("span", { className: "text-sm capitalize", children: device.type })] }), _jsxs("div", { className: "text-right", children: [_jsx("div", { className: "font-semibold", children: device.count }), _jsxs("div", { className: "text-xs text-muted-foreground", children: [device.percentage, "%"] })] })] }), _jsx(Progress, { value: device.percentage, className: "h-2" })] }, device.type))) })] }), _jsxs(Card, { children: [_jsx(CardHeader, { children: _jsxs(CardTitle, { className: "flex items-center gap-2", children: [_jsx(Activity, { className: "w-5 h-5" }), "Live Activity Feed"] }) }), _jsx(CardContent, { className: "space-y-3", children: realTimeData.recentActivity.map((activity, index) => (_jsxs("div", { className: "flex items-start gap-3 border-b pb-2 last:border-0", children: [getActivityIcon(activity.type), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "text-sm font-medium", children: activity.user }), _jsx(Badge, { variant: "outline", className: "text-xs", children: activity.location }), _jsx("div", { className: "flex items-center gap-1", children: getDeviceIcon(activity.device) })] }), _jsxs("p", { className: "text-xs text-muted-foreground", children: [activity.type === 'page_view' && `Viewed ${activity.page}`, activity.type === 'event' && `Triggered ${activity.event} on ${activity.page}`, activity.type === 'conversion' && `Converted on ${activity.page}`] }), _jsx("p", { className: "text-xs text-muted-foreground", children: formatTimeAgo(activity.timestamp) })] })] }, index))) })] })] })] }));
}
