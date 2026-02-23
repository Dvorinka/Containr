import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Moon } from 'lucide-react';
import { Button } from './button';
export function ThemeToggle() {
    return (_jsxs(Button, { variant: "ghost", size: "icon", className: "relative", title: "Dark mode only", disabled: true, children: [_jsx(Moon, { className: "h-4 w-4" }), _jsx("span", { className: "sr-only", children: "Dark mode" })] }));
}
