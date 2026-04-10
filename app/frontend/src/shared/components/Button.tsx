import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
type ButtonSize = 'sm' | 'md' | 'lg';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
  iconPosition?: 'left' | 'right';
};

const variantStyles: Record<ButtonVariant, string> = {
  primary: 'text-white shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]',
  secondary: 'border border-[var(--border-subtle)] bg-[var(--surface-card)] text-[var(--text-primary)] hover:border-[var(--border-default)] hover:bg-[var(--surface-card-hover)] active:scale-[0.98]',
  ghost: 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-muted)] active:scale-[0.98]',
  danger: 'border border-[var(--error-soft)] text-[var(--error)] hover:bg-[var(--error-soft)] hover:shadow-lg hover:shadow-[var(--error-glow)] active:scale-[0.98]',
  success: 'border border-[var(--success-soft)] text-[var(--success)] hover:bg-[var(--success-soft)] hover:shadow-lg hover:shadow-[var(--success-glow)] active:scale-[0.98]',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5 rounded-lg',
  md: 'h-10 px-4 text-sm gap-2 rounded-[var(--radius-md)]',
  lg: 'h-12 px-6 text-base gap-2.5 rounded-xl',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      icon,
      iconPosition = 'left',
      className = '',
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        className={`
          inline-flex items-center justify-center font-semibold
          transition-all duration-200 ease-out
          disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-base)]
          ${variantStyles[variant]}
          ${sizeStyles[size]}
          ${className}
        `}
        style={variant === 'primary' ? { background: '#e8316a' } : undefined}
        {...props}
      >
        {loading ? (
          <Loader2 size={size === 'sm' ? 14 : size === 'md' ? 16 : 18} className="animate-spin" />
        ) : (
          <>
            {icon && iconPosition === 'left' && icon}
            {children}
            {icon && iconPosition === 'right' && icon}
          </>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';
