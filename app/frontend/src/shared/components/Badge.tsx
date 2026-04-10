import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';

type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info' | 'neutral';
type BadgeSize = 'sm' | 'md' | 'lg';

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant;
  size?: BadgeSize;
  icon?: ReactNode;
  dot?: boolean;
}

const variantStyles: Record<BadgeVariant, { bg: string; color: string; dot: string }> = {
  default: {
    bg: 'bg-[var(--accent-primary-soft)]',
    color: 'text-[var(--accent-primary)]',
    dot: 'bg-[var(--accent-primary)]',
  },
  success: {
    bg: 'bg-[var(--success-soft)]',
    color: 'text-[var(--success)]',
    dot: 'bg-[var(--success)]',
  },
  warning: {
    bg: 'bg-[var(--warning-soft)]',
    color: 'text-[var(--warning)]',
    dot: 'bg-[var(--warning)]',
  },
  error: {
    bg: 'bg-[var(--error-soft)]',
    color: 'text-[var(--error)]',
    dot: 'bg-[var(--error)]',
  },
  info: {
    bg: 'bg-[var(--info-soft)]',
    color: 'text-[var(--info)]',
    dot: 'bg-[var(--info)]',
  },
  neutral: {
    bg: 'bg-[var(--surface-muted)]',
    color: 'text-[var(--text-secondary)]',
    dot: 'bg-[var(--text-tertiary)]',
  },
};

const sizeStyles: Record<BadgeSize, string> = {
  sm: 'px-2 py-0.5 text-[10px] gap-1',
  md: 'px-2.5 py-1 text-xs gap-1.5',
  lg: 'px-3 py-1.5 text-sm gap-2',
};

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  (
    {
      variant = 'default',
      size = 'md',
      icon,
      dot = false,
      className = '',
      children,
      ...props
    },
    ref
  ) => {
    const styles = variantStyles[variant];

    return (
      <span
        ref={ref}
        className={`
          inline-flex items-center font-medium rounded-full
          ${styles.bg} ${styles.color} ${sizeStyles[size]}
          ${className}
        `}
        {...props}
      >
        {dot && (
          <span className={`w-1.5 h-1.5 rounded-full ${styles.dot}`} />
        )}
        {icon}
        {children}
      </span>
    );
  }
);

Badge.displayName = 'Badge';

type StatusBadgeProps = HTMLAttributes<HTMLSpanElement> & {
  status: 'running' | 'success' | 'failed' | 'pending' | 'cancelled';
  size?: BadgeSize;
}

const statusConfig: Record<StatusBadgeProps['status'], { variant: BadgeVariant; label: string }> = {
  running: { variant: 'warning', label: 'Running' },
  success: { variant: 'success', label: 'Success' },
  failed: { variant: 'error', label: 'Failed' },
  pending: { variant: 'neutral', label: 'Pending' },
  cancelled: { variant: 'neutral', label: 'Cancelled' },
};

export function StatusBadge({ status, size = 'md', className = '', ...props }: StatusBadgeProps) {
  const config = statusConfig[status];
  return (
    <Badge variant={config.variant} size={size} dot className={className} {...props}>
      {config.label}
    </Badge>
  );
}
