import type { LucideIcon } from 'lucide-react';
interface EmptyStateProps {
    icon?: LucideIcon;
    title: string;
    description?: string;
    action?: {
        label: string;
        onClick: () => void;
    };
    className?: string;
}
export declare function EmptyState({ icon: Icon, title, description, action, className, }: EmptyStateProps): import("react/jsx-runtime").JSX.Element;
export {};
