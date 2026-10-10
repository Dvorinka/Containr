import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    // Call optional error handler
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Log to error tracking service (e.g., Sentry)
    if (import.meta.env.PROD) {
      // TODO: Send to error tracking service
      console.error('Production error:', {
        error: error.toString(),
        componentStack: errorInfo.componentStack,
      });
    }
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
    });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-[var(--bg-void)] flex items-center justify-center p-4">
          <div className="s-card max-w-md w-full space-y-4">
            <div className="space-y-2">
              <h2 className="font-headline text-xl font-semibold text-[var(--text-primary)]">
                Something went wrong
              </h2>
              <p className="text-sm text-[var(--text-secondary)]">
                An unexpected error occurred. Please try refreshing the page.
              </p>
            </div>

            {import.meta.env.DEV && this.state.error && (
              <div className="s-inset">
                <p className="v-mono text-[11px] text-[var(--error)] break-all">
                  {this.state.error.toString()}
                </p>
              </div>
            )}

            <div className="flex gap-2">
              <button onClick={this.handleReset} className="s-btn-accent flex-1 justify-center">
                Try Again
              </button>
              <button onClick={() => window.location.reload()} className="s-btn-quiet flex-1 justify-center">
                Reload Page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
