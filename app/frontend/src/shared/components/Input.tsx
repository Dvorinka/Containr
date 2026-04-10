import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';

type InputVariant = 'default' | 'error' | 'success';

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  variant?: InputVariant;
  icon?: ReactNode;
  iconPosition?: 'left' | 'right';
  hint?: string;
  label?: string;
}

const variantStyles: Record<InputVariant, string> = {
  default: 'border-[var(--border-subtle)] focus:border-[var(--accent-primary)]',
  error: 'border-[var(--error)] focus:border-[var(--error)]',
  success: 'border-[var(--success)] focus:border-[var(--success)]',
};

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      variant = 'default',
      icon,
      iconPosition = 'left',
      hint,
      label,
      className = '',
      ...props
    },
    ref
  ) => {
    return (
      <div className={className}>
        {label && (
          <label className="block text-xs font-medium uppercase tracking-wider text-[var(--text-muted)] mb-2">
            {label}
          </label>
        )}
        <div className="relative">
          {icon && iconPosition === 'left' && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]">
              {icon}
            </div>
          )}
          <input
            ref={ref}
            className={`
              w-full h-10 px-3 rounded-[var(--radius-md)]
              border bg-[var(--surface-muted)] text-sm
              placeholder:text-[var(--text-muted)]
              transition-colors duration-200
              focus:outline-none
              ${variantStyles[variant]}
              ${icon && iconPosition === 'left' ? 'pl-10' : ''}
              ${icon && iconPosition === 'right' ? 'pr-10' : ''}
            `}
            {...props}
          />
          {icon && iconPosition === 'right' && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]">
              {icon}
            </div>
          )}
        </div>
        {hint && (
          <p className={`mt-1.5 text-xs ${variant === 'error' ? 'text-[var(--error)]' : 'text-[var(--text-muted)]'}`}>
            {hint}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  variant?: InputVariant;
  hint?: string;
  label?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      variant = 'default',
      hint,
      label,
      className = '',
      ...props
    },
    ref
  ) => {
    return (
      <div className={className}>
        {label && (
          <label className="block text-xs font-medium uppercase tracking-wider text-[var(--text-muted)] mb-2">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          className={`
            w-full px-3 py-2 rounded-[var(--radius-md)]
            border bg-[var(--surface-muted)] text-sm
            placeholder:text-[var(--text-muted)]
            transition-colors duration-200
            focus:outline-none
            ${variantStyles[variant]}
          `}
          {...props}
        />
        {hint && (
          <p className={`mt-1.5 text-xs ${variant === 'error' ? 'text-[var(--error)]' : 'text-[var(--text-muted)]'}`}>
            {hint}
          </p>
        )}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  variant?: 'default' | 'error';
  hint?: string;
  label?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      variant = 'default',
      hint,
      label,
      className = '',
      ...props
    },
    ref
  ) => {
    return (
      <div className={className}>
        {label && (
          <label className="block text-xs font-medium uppercase tracking-wider text-[var(--text-muted)] mb-2">
            {label}
          </label>
        )}
        <select
          ref={ref}
          className={`
            w-full h-10 px-3 rounded-[var(--radius-md)]
            border bg-[var(--surface-muted)] text-sm
            transition-colors duration-200
            focus:outline-none
            ${variant === 'error' ? 'border-[var(--error)]' : 'border-[var(--border-subtle)] focus:border-[var(--accent-primary)]'}
          `}
          {...props}
        />
        {hint && (
          <p className={`mt-1.5 text-xs ${variant === 'error' ? 'text-[var(--error)]' : 'text-[var(--text-muted)]'}`}>
            {hint}
          </p>
        )}
      </div>
    );
  }
);

Select.displayName = 'Select';
