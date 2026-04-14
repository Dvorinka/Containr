import React, { useEffect, useState, createContext, useContext, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface AccessibilityContextType {
  announceMessage: (message: string, priority?: 'polite' | 'assertive') => void;
  focusElement: (selector: string) => void;
  trapFocus: (containerRef: React.RefObject<HTMLElement | null>) => () => void;
  skipToContent: () => void;
  highContrast: boolean;
  reducedMotion: boolean;
  screenReader: boolean;
  keyboardNavigation: boolean;
  toggleHighContrast: () => void;
  toggleReducedMotion: () => void;
  toggleKeyboardNavigation: () => void;
}

const AccessibilityContext = createContext<AccessibilityContextType | undefined>(undefined);

export function useAccessibility() {
  const context = useContext(AccessibilityContext);
  if (!context) {
    throw new Error('useAccessibility must be used within an AccessibilityProvider');
  }
  return context;
}

export function AccessibilityProvider({ children }: { children: ReactNode }) {
  const [highContrast, setHighContrast] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [screenReader, setScreenReader] = useState(false);
  const [keyboardNavigation, setKeyboardNavigation] = useState(false);

  useEffect(() => {
    // Check for reduced motion preference
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(motionQuery.matches);
    
    const handleMotionChange = (e: MediaQueryListEvent) => {
      setReducedMotion(e.matches);
    };
    motionQuery.addEventListener('change', handleMotionChange);

    // Check for high contrast preference
    const contrastQuery = window.matchMedia('(prefers-contrast: high)');
    setHighContrast(contrastQuery.matches);
    
    const handleContrastChange = (e: MediaQueryListEvent) => {
      setHighContrast(e.matches);
    };
    contrastQuery.addEventListener('change', handleContrastChange);

    // Detect screen reader usage
    const handleScreenReaderDetection = () => {
      setScreenReader(true);
    };
    
    // Add screen reader detection (common technique)
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        setKeyboardNavigation(true);
      }
    });

    window.addEventListener('mousedown', () => {
      setKeyboardNavigation(false);
    });

    return () => {
      motionQuery.removeEventListener('change', handleMotionChange);
      contrastQuery.removeEventListener('change', handleContrastChange);
    };
  }, []);

  const announceMessage = (message: string, priority: 'polite' | 'assertive' = 'polite') => {
    const announcement = document.createElement('div');
    announcement.setAttribute('aria-live', priority);
    announcement.setAttribute('aria-atomic', 'true');
    announcement.className = 'sr-only';
    announcement.textContent = message;
    
    document.body.appendChild(announcement);
    
    setTimeout(() => {
      document.body.removeChild(announcement);
    }, 1000);
  };

  const focusElement = (selector: string) => {
    const element = document.querySelector(selector) as HTMLElement;
    if (element) {
      element.focus();
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const trapFocus = (containerRef: React.RefObject<HTMLElement | null>) => {
    const container = containerRef.current;
    if (!container) return () => {};

    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    ) as NodeListOf<HTMLElement>;
    
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          lastElement.focus();
          e.preventDefault();
        }
      } else {
        if (document.activeElement === lastElement) {
          firstElement.focus();
          e.preventDefault();
        }
      }
    };

    container.addEventListener('keydown', handleTabKey);
    firstElement?.focus();

    return () => {
      container.removeEventListener('keydown', handleTabKey);
    };
  };

  const skipToContent = () => {
    const mainContent = document.querySelector('main, [role="main"], #main-content');
    if (mainContent) {
      (mainContent as HTMLElement).focus();
      mainContent.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const toggleHighContrast = () => {
    setHighContrast(!highContrast);
    document.documentElement.classList.toggle('high-contrast');
  };

  const toggleReducedMotion = () => {
    setReducedMotion(!reducedMotion);
    document.documentElement.classList.toggle('reduce-motion');
  };

  const toggleKeyboardNavigation = () => {
    setKeyboardNavigation(!keyboardNavigation);
    document.documentElement.classList.toggle('keyboard-nav');
  };

  return (
    <AccessibilityContext.Provider value={{
      announceMessage,
      focusElement,
      trapFocus,
      skipToContent,
      highContrast,
      reducedMotion,
      screenReader,
      keyboardNavigation,
      toggleHighContrast,
      toggleReducedMotion,
      toggleKeyboardNavigation,
    }}>
      {children}
    </AccessibilityContext.Provider>
  );
}

// Skip to content button component
export function SkipToContentButton() {
  const { skipToContent } = useAccessibility();

  return (
    <button
      onClick={skipToContent}
      className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 z-50 bg-primary text-primary-foreground px-4 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
    >
      Skip to main content
    </button>
  );
}

// Focus outline component for keyboard navigation
export function FocusOutline({ children, className }: { children: ReactNode; className?: string }) {
  const { keyboardNavigation } = useAccessibility();

  return (
    <div className={cn(
      keyboardNavigation && "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      className
    )}>
      {children}
    </div>
  );
}

// ARIA live region for announcements
export function LiveRegion() {
  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="sr-only"
      id="accessibility-live-region"
    />
  );
}

// Screen reader only text component
export function SrOnly({ children }: { children: ReactNode }) {
  return (
    <span className="sr-only">
      {children}
    </span>
  );
}

// Accessible button component with proper ARIA support
export interface AccessibleButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  loadingText?: string;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
  description?: string;
}

export function AccessibleButton({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  loadingText = 'Loading...',
  iconLeft,
  iconRight,
  description,
  disabled,
  className,
  ...props
}: AccessibleButtonProps) {
  const { announceMessage } = useAccessibility();

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (loading || disabled) return;
    
    // Announce button action for screen readers
    if (description) {
      announceMessage(description);
    }
    
    props.onClick?.(e);
  };

  const variantClasses = {
    primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
    secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
    outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
    ghost: 'hover:bg-accent hover:text-accent-foreground',
  };

  const sizeClasses = {
    sm: 'h-8 px-3 text-sm',
    md: 'h-10 px-4 py-2',
    lg: 'h-12 px-6 text-lg',
  };

  return (
    <button
      className={cn(
        'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      disabled={disabled || loading}
      aria-describedby={description ? 'button-description' : undefined}
      aria-busy={loading}
      onClick={handleClick}
      {...props}
    >
      {loading && (
        <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      )}
      {!loading && iconLeft && <div className="mr-2">{iconLeft}</div>}
      {loading ? loadingText : children}
      {!loading && iconRight && <div className="ml-2">{iconRight}</div>}
      {description && (
        <div id="button-description" className="sr-only">
          {description}
        </div>
      )}
    </button>
  );
}

// Accessible form field component
export interface AccessibleFieldProps {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
}

export function AccessibleField({ label, error, hint, required, children }: AccessibleFieldProps) {
  const fieldId = `field-${Math.random().toString(36).substr(2, 9)}`;
  const errorId = error ? `${fieldId}-error` : undefined;
  const hintId = hint ? `${fieldId}-hint` : undefined;

  return (
    <div className="space-y-2">
      <label
        htmlFor={fieldId}
        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
      >
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <div className="relative">
        {React.cloneElement(children as React.ReactElement<any>, {
          id: fieldId,
          'aria-describedby': [errorId, hintId].filter(Boolean).join(' '),
          'aria-invalid': error ? 'true' : 'false',
          'aria-required': required,
        } as any)}
      </div>
      {hint && (
        <p id={hintId} className="text-sm text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-sm text-red-500 flex items-center gap-1" role="alert">
          <span aria-hidden="true">⚠</span>
          {error}
        </p>
      )}
    </div>
  );
}

// Accessible modal component
export interface AccessibleModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export function AccessibleModal({ isOpen, onClose, title, children, size = 'md' }: AccessibleModalProps) {
  const { trapFocus, announceMessage } = useAccessibility();
  const modalRef = useRef<HTMLDivElement>(null);
  const titleId = `modal-title-${Math.random().toString(36).substr(2, 9)}`;

  useEffect(() => {
    if (isOpen) {
      announceMessage(`Modal opened: ${title}`);
      const cleanup = trapFocus(modalRef);
      
      // Prevent body scroll
      document.body.style.overflow = 'hidden';
      
      return () => {
        cleanup();
        document.body.style.overflow = '';
      };
    }
  }, [isOpen, title, trapFocus]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      
      {/* Modal */}
      <div
        ref={modalRef}
        className={cn(
          'relative w-full rounded-lg border bg-background shadow-lg',
          sizeClasses[size],
          'mx-4 my-4 max-h-[90vh] overflow-auto'
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={handleKeyDown}
      >
        <div className="flex items-center justify-between p-6 border-b">
          <h2 id={titleId} className="text-lg font-semibold">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none"
            aria-label="Close modal"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>
        
        <div className="p-6">
          {children}
        </div>
      </div>
    </div>
  );
}

// Accessible tooltip component
export interface AccessibleTooltipProps {
  content: string;
  children: ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
}

export function AccessibleTooltip({ content, children, side = 'top' }: AccessibleTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const tooltipId = `tooltip-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <div className="relative inline-block">
      <div
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        onFocus={() => setIsVisible(true)}
        onBlur={() => setIsVisible(false)}
        aria-describedby={isVisible ? tooltipId : undefined}
      >
        {children}
      </div>
      
      {isVisible && (
        <div
          id={tooltipId}
          role="tooltip"
          className={cn(
            'absolute z-50 px-2 py-1 text-sm bg-popover text-popover-foreground border rounded-md shadow-md',
            side === 'top' && 'bottom-full left-1/2 transform -translate-x-1/2 mb-2',
            side === 'bottom' && 'top-full left-1/2 transform -translate-x-1/2 mt-2',
            side === 'left' && 'right-full top-1/2 transform -translate-y-1/2 mr-2',
            side === 'right' && 'left-full top-1/2 transform -translate-y-1/2 ml-2',
          )}
        >
          {content}
        </div>
      )}
    </div>
  );
}
