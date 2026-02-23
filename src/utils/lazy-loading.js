import React, { lazy, Suspense } from 'react';
// Simple loading component
const LoadingFallback = ({ size = 'default', message = 'Loading...' }) => {
    const sizeClasses = {
        small: 'w-4 h-4',
        default: 'w-6 h-6',
        large: 'w-8 h-8'
    };
    return React.createElement('div', {
        className: "flex items-center justify-center p-8"
    }, React.createElement('div', {
        className: "flex flex-col items-center gap-2"
    }, [
        React.createElement('div', {
            className: `animate-spin text-primary ${sizeClasses[size]}`
        }),
        React.createElement('span', {
            className: "text-sm text-muted-foreground"
        }, message)
    ]));
};
// Enhanced lazy loading with loading states
function createLazyComponent(importFunc, options) {
    const LazyComponent = lazy(importFunc);
    return (props) => React.createElement(Suspense, {
        fallback: React.createElement(LoadingFallback, {
            message: options?.loadingMessage,
            size: options?.loadingSize
        })
    }, React.createElement(LazyComponent, props));
}
// Preload utility for critical components
function preloadComponent(importFunc) {
    const componentPromise = importFunc();
    // Preload component in background
    componentPromise.catch(() => {
        console.warn('Failed to preload component');
    });
    return componentPromise;
}
