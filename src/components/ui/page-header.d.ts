import type { LucideIcon } from 'lucide-react';
interface PageHeaderProps {
    title: string;
    description?: string;
    action?: {
        label: string;
        onClick?: () => void;
        icon?: LucideIcon;
    };
    children?: React.ReactNode;
    className?: string;
}
export declare function PageHeader({ title, description, action, children, className }: PageHeaderProps): import("react/jsx-runtime").JSX.Element;
export {};
