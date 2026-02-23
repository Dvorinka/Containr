import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
export function EmptyState({ icon: Icon, title, description, action, className, }) {
    return (_jsxs("div", { className: cn("flex flex-col items-center justify-center py-12 px-4 text-center", className), children: [Icon && (_jsx("div", { className: "mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4", children: _jsx(Icon, { className: "w-8 h-8 text-muted-foreground" }) })), _jsx("h3", { className: "text-lg font-semibold text-foreground mb-2", children: title }), description && (_jsx("p", { className: "text-sm text-muted-foreground max-w-sm mb-4", children: description })), action && (_jsx(Button, { onClick: action.onClick, children: action.label }))] }));
}
