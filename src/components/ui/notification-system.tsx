import { cn } from "@/lib/utils";
import { useEffect, useState, createContext, useContext } from "react";
import { Card } from "./card";
import { Button } from "./button";
import { X, CheckCircle, AlertCircle, Info, AlertTriangle, XCircle } from "lucide-react";

type NotificationType = 'success' | 'error' | 'warning' | 'info';

interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
  persistent?: boolean;
}

interface NotificationContextType {
  notifications: Notification[];
  addNotification: (notification: Omit<Notification, 'id'>) => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const addNotification = (notification: Omit<Notification, 'id'>) => {
    const id = Math.random().toString(36).substr(2, 9);
    const newNotification = { ...notification, id };
    
    setNotifications(prev => [...prev, newNotification]);
    
    if (!notification.persistent && notification.duration !== 0) {
      setTimeout(() => {
        removeNotification(id);
      }, notification.duration || 5000);
    }
  };

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const clearNotifications = () => {
    setNotifications([]);
  };

  return (
    <NotificationContext.Provider value={{
      notifications,
      addNotification,
      removeNotification,
      clearNotifications,
    }}>
      {children}
      <NotificationContainer />
    </NotificationContext.Provider>
  );
}

function NotificationContainer() {
  const { notifications, removeNotification } = useNotifications();

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full">
      {notifications.map((notification) => (
        <NotificationItem
          key={notification.id}
          notification={notification}
          onClose={() => removeNotification(notification.id)}
        />
      ))}
    </div>
  );
}

interface NotificationItemProps {
  notification: Notification;
  onClose: () => void;
}

function NotificationItem({ notification, onClose }: NotificationItemProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 10);
    return () => clearTimeout(timer);
  }, []);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 300);
  };

  const getIcon = () => {
    switch (notification.type) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-emerald-500" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-amber-500" />;
      case 'info':
        return <Info className="w-5 h-5 text-blue-500" />;
    }
  };

  const getColorClasses = () => {
    switch (notification.type) {
      case 'success':
        return 'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950';
      case 'error':
        return 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950';
      case 'warning':
        return 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950';
      case 'info':
        return 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950';
    }
  };

  return (
    <Card
      className={cn(
        "transition-all duration-300 transform shadow-lg border",
        isVisible ? "translate-x-0 opacity-100" : "translate-x-full opacity-0",
        getColorClasses()
      )}
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-0.5">
            {getIcon()}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-semibold text-foreground">
              {notification.title}
            </h4>
            {notification.message && (
              <p className="text-sm text-muted-foreground mt-1">
                {notification.message}
              </p>
            )}
            {notification.action && (
              <div className="mt-3">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={notification.action.onClick}
                  className="text-xs"
                >
                  {notification.action.label}
                </Button>
              </div>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClose}
            className="flex-shrink-0 opacity-70 hover:opacity-100 transition-opacity"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}

// Toast notification system for quick messages
interface ToastProps {
  message: string;
  type?: NotificationType;
  duration?: number;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';
}

export function toast({ message, type = 'info', duration = 3000, position = 'top-right' }: ToastProps) {
  const event = new CustomEvent('show-toast', {
    detail: { message, type, duration, position }
  });
  window.dispatchEvent(event);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Array<{
    id: string;
    message: string;
    type: NotificationType;
    position: string;
  }>>([]);

  useEffect(() => {
    const handleToast = (event: CustomEvent) => {
      const { message, type, duration, position } = event.detail;
      const id = Math.random().toString(36).substr(2, 9);
      
      setToasts(prev => [...prev, { id, message, type, position }]);
      
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, duration);
    };

    window.addEventListener('show-toast', handleToast as EventListener);
    return () => window.removeEventListener('show-toast', handleToast as EventListener);
  }, []);

  const getPositionClasses = (position: string) => {
    switch (position) {
      case 'top-right':
        return 'top-4 right-4';
      case 'top-left':
        return 'top-4 left-4';
      case 'bottom-right':
        return 'bottom-4 right-4';
      case 'bottom-left':
        return 'bottom-4 left-4';
      case 'top-center':
        return 'top-4 left-1/2 transform -translate-x-1/2';
      case 'bottom-center':
        return 'bottom-4 left-1/2 transform -translate-x-1/2';
      default:
        return 'top-4 right-4';
    }
  };

  return (
    <>
      {children}
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn(
            "fixed z-50 p-4 rounded-lg shadow-lg border animate-fade-in-up",
            getPositionClasses(toast.position)
          )}
        >
          <div className="flex items-center gap-2">
            {toast.type === 'success' && <CheckCircle className="w-4 h-4 text-emerald-500" />}
            {toast.type === 'error' && <XCircle className="w-4 h-4 text-red-500" />}
            {toast.type === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-500" />}
            {toast.type === 'info' && <Info className="w-4 h-4 text-blue-500" />}
            <span className="text-sm font-medium">{toast.message}</span>
          </div>
        </div>
      ))}
    </>
  );
}

// Progress notification for long-running operations
interface ProgressNotificationProps {
  title: string;
  progress: number;
  total?: number;
  showPercentage?: boolean;
  onCancel?: () => void;
}

export function ProgressNotification({
  title,
  progress,
  total = 100,
  showPercentage = true,
  onCancel
}: ProgressNotificationProps) {
  const percentage = Math.round((progress / total) * 100);

  return (
    <Card className="shadow-lg border">
      <div className="p-4">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-semibold text-foreground">{title}</h4>
          {onCancel && (
            <Button variant="ghost" size="sm" onClick={onCancel}>
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
        <div className="space-y-2">
          <div className="w-full bg-muted rounded-full h-2">
            <div
              className="bg-primary h-2 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${percentage}%` }}
            />
          </div>
          {showPercentage && (
            <div className="text-xs text-muted-foreground text-center">
              {percentage}% ({progress} / {total})
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

// Notification hooks for common use cases
export function useSuccessToast() {
  return (message: string) => {
    toast({ message, type: 'success' });
  };
}

export function useErrorToast() {
  return (message: string) => {
    toast({ message, type: 'error', duration: 6000 });
  };
}

export function useWarningToast() {
  return (message: string) => {
    toast({ message, type: 'warning' });
  };
}

export function useInfoToast() {
  return (message: string) => {
    toast({ message, type: 'info' });
  };
}
