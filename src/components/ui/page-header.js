import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
export function PageHeader({ title, description, action, children, className }) {
    return (_jsxs("div", { className: cn("flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2", className), children: [_jsxs("div", { className: "space-y-1", children: [_jsx("h1", { className: "text-2xl md:text-3xl font-bold tracking-tight text-foreground", children: title }), description && (_jsx("p", { className: "text-sm md:text-base text-muted-foreground", children: description }))] }), _jsxs("div", { className: "flex items-center gap-2", children: [children, action && (_jsxs(Button, { onClick: action.onClick, className: "w-full sm:w-auto gap-2 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary/80 shadow-md btn-shine", children: [action.icon && _jsx(action.icon, { className: "w-4 h-4" }), action.label] }))] })] }));
}
