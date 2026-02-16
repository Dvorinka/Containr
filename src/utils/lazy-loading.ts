import React, { lazy, type ComponentType, Suspense } from 'react';

// Simple loading component
export const LoadingFallback = ({ 
  size = 'default', 
  message = 'Loading...' 
}: { 
  size?: 'small' | 'default' | 'large';
  message?: string;
}) => {
  const sizeClasses = {
    small: 'w-4 h-4',
    default: 'w-6 h-6',
    large: 'w-8 h-8'
  };

  return React.createElement('div', { 
    className: "flex items-center justify-center p-8" 
  }, 
    React.createElement('div', { 
      className: "flex flex-col items-center gap-2" 
    }, [
      React.createElement('div', {
        className: `animate-spin text-primary ${sizeClasses[size]}`
      }),
      React.createElement('span', {
        className: "text-sm text-muted-foreground"
      }, message)
    ])
  );
};

// Enhanced lazy loading with loading states
export function createLazyComponent<T extends ComponentType<any>>(
  importFunc: () => Promise<{ default: T }>,
  options?: {
    loadingMessage?: string;
    loadingSize?: 'small' | 'default' | 'large';
  }
) {
  const LazyComponent = lazy(importFunc);
  
  return (props: any) => React.createElement(
    Suspense, 
    { 
      fallback: React.createElement(LoadingFallback, {
        message: options?.loadingMessage,
        size: options?.loadingSize
      })
    },
    React.createElement(LazyComponent, props)
  );
}

// Preload utility for critical components
export function preloadComponent(importFunc: () => Promise<{ default: ComponentType<any> }>) {
  const componentPromise = importFunc();
  
  // Preload component in background
  componentPromise.catch(() => {
    console.warn('Failed to preload component');
  });
  
  return componentPromise;
}
