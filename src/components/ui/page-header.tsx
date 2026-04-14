import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
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

export function PageHeader({ 
  title, 
  description, 
  action, 
  children,
  className 
}: PageHeaderProps) {
  return (
    <div className={cn(
      "flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2",
      className
    )}>
      <div className="space-y-1">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
          {title}
        </h1>
        {description && (
          <p className="text-sm md:text-base text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2">
        {children}
        {action && (
          <Button 
            onClick={action.onClick}
            className="w-full sm:w-auto gap-2 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary/80 shadow-md btn-shine"
          >
            {action.icon && <action.icon className="w-4 h-4" />}
            {action.label}
          </Button>
        )}
      </div>
    </div>
  );
}
