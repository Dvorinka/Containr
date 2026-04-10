import * as ToastPrimitive from '@radix-ui/react-toast';
import { createContext, useContext, useState, ReactNode } from 'react';
import { IconX, IconCheck, IconAlertCircle, IconInfoCircle } from '@tabler/icons-react';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
}

interface ToastContextValue {
  showToast: (type: ToastType, title: string, description?: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
}

interface ToastProviderProps {
  children: ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = (type: ToastType, title: string, description?: string) => {
    const id = Math.random().toString(36).substring(7);
    setToasts((prev) => [...prev, { id, type, title, description }]);

    // Auto-dismiss after 5 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 5000);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  };

  const getIcon = (type: ToastType) => {
    switch (type) {
      case 'success':
        return <IconCheck className="w-5 h-5 text-green-500" />;
      case 'error':
        return <IconAlertCircle className="w-5 h-5 text-red-500" />;
      case 'warning':
        return <IconAlertCircle className="w-5 h-5 text-yellow-500" />;
      case 'info':
        return <IconInfoCircle className="w-5 h-5 text-blue-500" />;
    }
  };

  const getBorderColor = (type: ToastType) => {
    switch (type) {
      case 'success':
        return 'border-green-500/50';
      case 'error':
        return 'border-red-500/50';
      case 'warning':
        return 'border-yellow-500/50';
      case 'info':
        return 'border-blue-500/50';
    }
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      <ToastPrimitive.Provider swipeDirection="right">
        {children}
        {toasts.map((toast) => (
          <ToastPrimitive.Root
            key={toast.id}
            className={`bg-[var(--bg-primary)] border ${getBorderColor(toast.type)} rounded-lg shadow-lg p-4 flex items-start gap-3 min-w-[300px] max-w-[420px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-right-full data-[state=open]:slide-in-from-top-full data-[state=open]:sm:slide-in-from-bottom-full`}
            onOpenChange={(open) => {
              if (!open) removeToast(toast.id);
            }}
          >
            {getIcon(toast.type)}
            <div className="flex-1 space-y-1">
              <ToastPrimitive.Title className="text-sm font-medium text-[var(--text-primary)]">
                {toast.title}
              </ToastPrimitive.Title>
              {toast.description && (
                <ToastPrimitive.Description className="text-xs text-[var(--text-secondary)]">
                  {toast.description}
                </ToastPrimitive.Description>
              )}
            </div>
            <ToastPrimitive.Close className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
              <IconX className="w-4 h-4" />
            </ToastPrimitive.Close>
          </ToastPrimitive.Root>
        ))}
        <ToastPrimitive.Viewport className="fixed top-0 right-0 flex flex-col p-6 gap-2 w-full max-w-[420px] m-0 list-none z-[100] outline-none" />
      </ToastPrimitive.Provider>
    </ToastContext.Provider>
  );
}
