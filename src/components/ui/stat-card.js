import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown } from 'lucide-react';
const statusColors = {
    success: 'text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400',
    warning: 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-400',
    danger: 'text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400',
    neutral: 'text-muted-foreground bg-muted',
};
const statusDots = {
    success: 'bg-green-500',
    warning: 'bg-yellow-500',
    danger: 'bg-red-500',
    neutral: 'bg-gray-400',
};
function StatCard({ title, value, description, icon: Icon, trend, status = 'neutral', className, }) {
    return (_jsx(Card, { className: cn("relative overflow-hidden", className), children: _jsxs(CardContent, { className: "p-6", children: [_jsxs("div", { className: "flex items-start justify-between", children: [_jsxs("div", { className: "space-y-2", children: [_jsx("p", { className: "text-sm font-medium text-muted-foreground", children: title }), _jsxs("div", { className: "flex items-baseline gap-2", children: [_jsx("p", { className: "text-2xl font-bold tracking-tight", children: value }), trend && (_jsxs(Badge, { variant: trend.direction === 'up' ? 'default' : 'destructive', className: cn("text-xs", trend.direction === 'up'
                                                ? 'bg-green-100 text-green-800 hover:bg-green-100'
                                                : trend.direction === 'down'
                                                    ? 'bg-red-100 text-red-800 hover:bg-red-100'
                                                    : 'bg-gray-100 text-gray-800 hover:bg-gray-100'), children: [trend.direction === 'up' ? (_jsx(TrendingUp, { className: "w-3 h-3 mr-1" })) : trend.direction === 'down' ? (_jsx(TrendingDown, { className: "w-3 h-3 mr-1" })) : null, trend.value] }))] }), description && (_jsx("p", { className: "text-xs text-muted-foreground", children: description }))] }), Icon && (_jsx("div", { className: cn("p-2 rounded-lg", statusColors[status]), children: _jsx(Icon, { className: "w-5 h-5" }) }))] }), status !== 'neutral' && (_jsx("div", { className: "absolute bottom-0 left-0 right-0 h-1", children: _jsx("div", { className: cn("h-full w-full", statusDots[status]) }) }))] }) }));
}
