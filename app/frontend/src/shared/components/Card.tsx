import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';

type CardVariant = 'default' | 'elevated' | 'bordered' | 'ghost' | 'glass';

type CardProps = HTMLAttributes<HTMLDivElement> & {
  variant?: CardVariant;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  header?: ReactNode;
  footer?: ReactNode;
  hoverable?: boolean;
};

const variantStyles: Record<CardVariant, string> = {
  default: 'bg-[var(--surface-card)] border border-[var(--border-subtle)]',
  elevated: 'bg-[var(--surface-card)] shadow-lg shadow-black/40',
  bordered: 'bg-transparent border border-[var(--border-default)]',
  ghost: 'bg-[var(--surface-muted)]/50',
  glass: 'bg-[var(--surface-card)]/80 backdrop-blur-xl border border-[var(--border-subtle)]',
};

const paddingStyles: Record<'none' | 'sm' | 'md' | 'lg', string> = {
  none: '',
  sm: 'p-3',
  md: 'p-4 md:p-5',
  lg: 'p-6 md:p-8',
};

export const Card = forwardRef<HTMLDivElement, CardProps>(
  (
    {
      variant = 'default',
      padding = 'md',
      header,
      footer,
      hoverable = false,
      className = '',
      children,
      ...props
    },
    ref
  ) => {
    return (
      <div
        ref={ref}
        className={`
          rounded-[var(--radius-lg)] 
          ${variantStyles[variant]} 
          ${paddingStyles[padding]}
          ${hoverable ? 'transition-all duration-200 hover:border-[var(--border-default)] hover:shadow-xl hover:shadow-black/30 hover:-translate-y-0.5' : ''}
          ${className}
        `}
        {...props}
      >
        {header && (
          <div className="mb-4 pb-4 border-b border-[var(--border-subtle)]">{header}</div>
        )}
        {children}
        {footer && (
          <div className="mt-4 pt-4 border-t border-[var(--border-subtle)]">{footer}</div>
        )}
      </div>
    );
  }
);

Card.displayName = 'Card';

type CardHeaderProps = HTMLAttributes<HTMLDivElement> & {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
};

export function CardHeader({ title, description, icon, action, className = '', ...props }: CardHeaderProps) {
  return (
    <div className={`flex items-start justify-between gap-4 ${className}`} {...props}>
      <div className="flex items-start gap-3">
        {icon && (
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ring-1 ring-white/5" style={{ background: 'rgba(255,255,255,0.07)' }}>
            {icon}
          </div>
        )}
        <div>
          <h3 className="text-lg font-semibold text-[var(--text-primary)] tracking-tight">{title}</h3>
          {description && (
            <p className="text-sm text-[var(--text-secondary)] mt-0.5">{description}</p>
          )}
        </div>
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}
