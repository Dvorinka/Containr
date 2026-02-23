import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import * as React from "react";
import { Toast, ToastClose, ToastDescription, ToastProvider, ToastTitle, ToastViewport, } from "@/components/ui/toast";
const ToastContext = React.createContext(undefined);
export function useToast() {
    const context = React.useContext(ToastContext);
    if (!context) {
        throw new Error("useToast must be used within a Toaster");
    }
    return context;
}
export function Toaster({ children }) {
    const [toasts, setToasts] = React.useState([]);
    const toast = React.useCallback((data) => {
        const id = Math.random().toString(36).substr(2, 9);
        setToasts((prev) => [...prev, { ...data, id }]);
        setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== id));
        }, 5000);
    }, []);
    const dismiss = React.useCallback((id) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);
    return (_jsx(ToastContext.Provider, { value: { toasts, toast, dismiss }, children: _jsxs(ToastProvider, { children: [children, toasts.map((t) => (_jsxs(Toast, { variant: t.variant, children: [_jsxs("div", { className: "grid gap-1", children: [t.title && _jsx(ToastTitle, { children: t.title }), t.description && _jsx(ToastDescription, { children: t.description })] }), _jsx(ToastClose, { onClick: () => dismiss(t.id) })] }, t.id))), _jsx(ToastViewport, {})] }) }));
}
