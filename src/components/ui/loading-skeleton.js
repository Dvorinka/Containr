import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
export function LoadingSkeleton({ variant = 'card', count = 3, className }) {
    if (variant === 'card') {
        return (_jsx("div", { className: cn("grid gap-4 md:grid-cols-2 lg:grid-cols-3", className), children: Array.from({ length: count }).map((_, i) => (_jsxs("div", { className: "rounded-lg border bg-card p-6 space-y-3", children: [_jsx(Skeleton, { className: "h-4 w-1/3" }), _jsx(Skeleton, { className: "h-8 w-1/2" }), _jsxs("div", { className: "flex gap-4", children: [_jsx(Skeleton, { className: "h-4 w-16" }), _jsx(Skeleton, { className: "h-4 w-16" })] }), _jsxs("div", { className: "flex gap-2 pt-2", children: [_jsx(Skeleton, { className: "h-9 flex-1" }), _jsx(Skeleton, { className: "h-9 flex-1" })] })] }, i))) }));
    }
    if (variant === 'list') {
        return (_jsx("div", { className: cn("space-y-3", className), children: Array.from({ length: count }).map((_, i) => (_jsxs("div", { className: "flex items-center gap-4 p-4 rounded-lg border bg-card", children: [_jsx(Skeleton, { className: "h-10 w-10 rounded-full" }), _jsxs("div", { className: "flex-1 space-y-2", children: [_jsx(Skeleton, { className: "h-4 w-1/3" }), _jsx(Skeleton, { className: "h-3 w-1/2" })] }), _jsx(Skeleton, { className: "h-8 w-20" })] }, i))) }));
    }
    if (variant === 'table') {
        return (_jsxs("div", { className: cn("rounded-lg border", className), children: [_jsx("div", { className: "p-4 border-b", children: _jsx("div", { className: "flex gap-4", children: Array.from({ length: 4 }).map((_, i) => (_jsx(Skeleton, { className: "h-4 flex-1" }, i))) }) }), Array.from({ length: count }).map((_, i) => (_jsx("div", { className: "p-4 border-b last:border-0", children: _jsx("div", { className: "flex gap-4", children: Array.from({ length: 4 }).map((_, j) => (_jsx(Skeleton, { className: "h-4 flex-1" }, j))) }) }, i)))] }));
    }
    return (_jsxs("div", { className: cn("space-y-2", className), children: [_jsx(Skeleton, { className: "h-4 w-full" }), _jsx(Skeleton, { className: "h-4 w-3/4" }), _jsx(Skeleton, { className: "h-4 w-1/2" })] }));
}
