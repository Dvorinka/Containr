import * as React from "react";
type ToastVariant = "default" | "destructive" | "success";
interface ToastData {
    id: string;
    title?: string;
    description?: string;
    variant?: ToastVariant;
}
interface ToastContextType {
    toasts: ToastData[];
    toast: (data: Omit<ToastData, "id">) => void;
    dismiss: (id: string) => void;
}
export declare function useToast(): ToastContextType;
export declare function Toaster({ children }: {
    children: React.ReactNode;
}): import("react/jsx-runtime").JSX.Element;
export {};
