import { createContext, useContext } from 'react';

export type ToastType = 'success' | 'info' | 'warning' | 'error';

export interface ToastContextValue {
  showToast: (first: ToastType | string, second: ToastType | string, description?: string) => void;
}

export const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
}
