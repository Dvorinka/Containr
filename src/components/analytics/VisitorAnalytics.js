import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Users, Globe, Monitor, Smartphone, Tablet, MapPin } from 'lucide-react';
export function VisitorAnalytics({ timeRange: _timeRange }) {
    // Mock data - in real implementation, this would come from Umami API
    const visitorData = {
        newVsReturning: {
            new: 68,
            returning: 32
        },
        devices: {
            desktop: 45,
            mobile: 42,
            tablet: 13
        },
        browsers: [
            { name: 'Chrome', percentage: 45, users: 20356 },
            { name: 'Safari', percentage: 28, users: 12666 },
            { name: 'Firefox', percentage: 12, users: 5428 },
            { name: 'Edge', percentage: 8, users: 3619 },
            { name: 'Others', percentage: 7, users: 3166 }
        ],
        operatingSystems: [
            { name: 'Windows', percentage: 38, users: 17189 },
            { name: 'macOS', percentage: 32, users: 14475 },
            { name: 'Android', percentage: 18, users: 8142 },
            { name: 'iOS', percentage: 10, users: 4523 },
            { name: 'Linux', percentage: 2, users: 905 }
        ],
        countries: [
            { name: 'United States', percentage: 35, users: 15832 },
            { name: 'United Kingdom', percentage: 18, users: 8142 },
            { name: 'Germany', percentage: 12, users: 5428 },
            { name: 'Canada', percentage: 8, users: 3619 },
            { name: 'France', percentage: 7, users: 3166 },
            { name: 'Others', percentage: 20, users: 9047 }
        ],
        languages: [
            { name: 'English', percentage: 45, users: 20356 },
            { name: 'German', percentage: 15, users: 6785 },
            { name: 'French', percentage: 12, users: 5428 },
            { name: 'Spanish', percentage: 10, users: 4523 },
            { name: 'Others', percentage: 18, users: 8142 }
        ]
    };
    const getDeviceIcon = (device) => {
        switch (device) {
            case 'desktop':
                return _jsx(Monitor, { className: "w-4 h-4" });
            case 'mobile':
                return _jsx(Smartphone, { className: "w-4 h-4" });
            case 'tablet':
                return _jsx(Tablet, { className: "w-4 h-4" });
            default:
                return _jsx(Monitor, { className: "w-4 h-4" });
        }
    };
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs(Card, { children: [_jsx(CardHeader, { children: _jsxs(CardTitle, { className: "flex items-center gap-2", children: [_jsx(Users, { className: "w-5 h-5" }), "New vs Returning Visitors"] }) }), _jsxs(CardContent, { className: "space-y-4", children: [_jsxs("div", { className: "space-y-3", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Badge, { variant: "secondary", children: "New" }), _jsx("span", { className: "text-sm", children: "First-time visitors" })] }), _jsxs("div", { className: "text-right", children: [_jsxs("div", { className: "font-semibold", children: [visitorData.newVsReturning.new, "%"] }), _jsxs("div", { className: "text-xs text-muted-foreground", children: [(45234 * visitorData.newVsReturning.new / 100).toLocaleString(), " visitors"] })] })] }), _jsx(Progress, { value: visitorData.newVsReturning.new, className: "h-2" })] }), _jsxs("div", { className: "space-y-3", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Badge, { variant: "outline", children: "Returning" }), _jsx("span", { className: "text-sm", children: "Repeat visitors" })] }), _jsxs("div", { className: "text-right", children: [_jsxs("div", { className: "font-semibold", children: [visitorData.newVsReturning.returning, "%"] }), _jsxs("div", { className: "text-xs text-muted-foreground", children: [(45234 * visitorData.newVsReturning.returning / 100).toLocaleString(), " visitors"] })] })] }), _jsx(Progress, { value: visitorData.newVsReturning.returning, className: "h-2" })] })] })] }), _jsxs(Card, { children: [_jsx(CardHeader, { children: _jsxs(CardTitle, { className: "flex items-center gap-2", children: [_jsx(Monitor, { className: "w-5 h-5" }), "Device Breakdown"] }) }), _jsx(CardContent, { className: "space-y-4", children: Object.entries(visitorData.devices).map(([device, percentage]) => (_jsxs("div", { className: "space-y-2", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center gap-2", children: [getDeviceIcon(device), _jsx("span", { className: "text-sm capitalize", children: device })] }), _jsxs("div", { className: "text-right", children: [_jsxs("div", { className: "font-semibold", children: [percentage, "%"] }), _jsxs("div", { className: "text-xs text-muted-foreground", children: [Math.floor(45234 * percentage / 100).toLocaleString(), " visitors"] })] })] }), _jsx(Progress, { value: percentage, className: "h-2" })] }, device))) })] }), _jsxs(Card, { children: [_jsx(CardHeader, { children: _jsxs(CardTitle, { className: "flex items-center gap-2", children: [_jsx(Globe, { className: "w-5 h-5" }), "Top Browsers"] }) }), _jsx(CardContent, { className: "space-y-3", children: visitorData.browsers.map((browser) => (_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("div", { className: "w-3 h-3 rounded-full bg-blue-500" }), _jsx("span", { className: "text-sm", children: browser.name })] }), _jsxs("div", { className: "text-right", children: [_jsxs("div", { className: "font-semibold", children: [browser.percentage, "%"] }), _jsxs("div", { className: "text-xs text-muted-foreground", children: [browser.users.toLocaleString(), " users"] })] })] }, browser.name))) })] }), _jsxs(Card, { children: [_jsx(CardHeader, { children: _jsxs(CardTitle, { className: "flex items-center gap-2", children: [_jsx(MapPin, { className: "w-5 h-5" }), "Top Countries"] }) }), _jsx(CardContent, { className: "space-y-3", children: visitorData.countries.map((country) => (_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("div", { className: "w-3 h-3 rounded-full bg-green-500" }), _jsx("span", { className: "text-sm", children: country.name })] }), _jsxs("div", { className: "text-right", children: [_jsxs("div", { className: "font-semibold", children: [country.percentage, "%"] }), _jsxs("div", { className: "text-xs text-muted-foreground", children: [country.users.toLocaleString(), " visitors"] })] })] }, country.name))) })] })] }));
}
