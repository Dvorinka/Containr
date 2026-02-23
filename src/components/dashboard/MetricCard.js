import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, FileText, BarChart3 } from 'lucide-react';
import { useState } from 'react';
function MetricCard({ title, value, trend, timePeriods = ['1D', '1W', '1M', '3M', '6M', '1Y'], actionLabel = 'Report', children, selectedPeriod = '1W', onPeriodChange }) {
    const [currentPeriod, setCurrentPeriod] = useState(selectedPeriod);
    const handlePeriodChange = (period) => {
        setCurrentPeriod(period);
        onPeriodChange?.(period);
    };
    return (_jsx(Card, { className: "w-full shadow-sm border-0 ring-1 ring-inset ring-border/20", children: _jsxs(CardContent, { className: "p-5 space-y-5", children: [_jsxs("div", { className: "flex items-start gap-2", children: [_jsxs("div", { className: "flex-1", children: [_jsx("div", { className: "text-sm text-muted-foreground font-medium", children: title }), _jsxs("div", { className: "mt-1 flex items-center gap-2", children: [_jsx("div", { className: "text-2xl font-bold text-foreground", children: value }), trend && (_jsxs(Badge, { variant: trend.direction === 'up' ? 'default' : 'destructive', className: `h-5 gap-1.5 px-2 text-xs font-medium ${trend.direction === 'up'
                                                ? 'bg-green-100 text-green-800 border-green-200'
                                                : 'bg-red-100 text-red-800 border-red-200'}`, children: [trend.direction === 'up' ? (_jsx(TrendingUp, { className: "w-3 h-3" })) : (_jsx(TrendingDown, { className: "w-3 h-3" })), trend.value] }))] })] }), _jsxs(Button, { variant: "outline", size: "sm", className: "h-7 gap-2.5 px-2 text-xs hover:bg-muted/50 transition-colors", children: [actionLabel === 'Report' ? _jsx(FileText, { className: "w-3 h-3" }) : _jsx(BarChart3, { className: "w-3 h-3" }), actionLabel] })] }), children && (_jsxs(_Fragment, { children: [_jsx("div", { className: "w-full h-px bg-border/20" }), children] })), timePeriods && (_jsxs(_Fragment, { children: [_jsx("div", { className: "w-full h-px bg-border/20" }), _jsx("div", { className: "flex gap-0.5", role: "radiogroup", children: timePeriods.map((period) => (_jsx(Button, { variant: currentPeriod === period ? 'default' : 'ghost', size: "sm", onClick: () => handlePeriodChange(period), className: `h-6 px-3 text-xs first:rounded-l-md last:rounded-r-md transition-colors ${currentPeriod === period
                                    ? 'bg-primary text-primary-foreground'
                                    : 'hover:bg-muted/50 text-muted-foreground'}`, children: period }, period))) })] }))] }) }));
}
