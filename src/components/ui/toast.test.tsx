import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Toast, ToastProvider, ToastViewport, ToastTitle, ToastDescription, ToastClose, ToastAction } from './toast';

// Mock Radix UI components
vi.mock('@radix-ui/react-toast', () => ({
  Provider: ({ children }: { children: React.ReactNode }) => <div data-testid="toast-provider">{children}</div>,
  Viewport: vi.fn(({ className, ...props }: any) => <div data-testid="toast-viewport" className={className} {...props} />),
  Root: vi.fn(({ children, className, ...props }: any) => <div data-testid="toast" className={className} {...props}>{children}</div>),
  Title: vi.fn(({ children, className, ...props }: any) => <div data-testid="toast-title" className={className} {...props}>{children}</div>),
  Description: vi.fn(({ children, className, ...props }: any) => <div data-testid="toast-description" className={className} {...props}>{children}</div>),
  Close: vi.fn(({ children, className, ...props }: any) => <button data-testid="toast-close" className={className} {...props}>{children}</button>),
  Action: vi.fn(({ children, className, ...props }: any) => <button data-testid="toast-action" className={className} {...props}>{children}</button>),
}));

// Mock lucide-react
vi.mock('lucide-react', () => ({
  X: () => <svg data-testid="close-icon" />,
}));

describe('Toast', () => {
  describe('ToastProvider', () => {
    it('renders without crashing', () => {
      render(
        <ToastProvider>
          <div>Content</div>
        </ToastProvider>
      );
    });

    it('renders children correctly', () => {
      render(
        <ToastProvider>
          <div>Provider content</div>
        </ToastProvider>
      );

      const provider = screen.getByTestId('toast-provider');
      expect(provider).toBeInTheDocument();
      expect(screen.getByText('Provider content')).toBeInTheDocument();
    });

    it('wraps content properly', () => {
      render(
        <ToastProvider>
          <ToastViewport />
        </ToastProvider>
      );

      expect(screen.getByTestId('toast-provider')).toBeInTheDocument();
      expect(screen.getByTestId('toast-viewport')).toBeInTheDocument();
    });
  });

  describe('ToastViewport', () => {
    it('renders without crashing', () => {
      render(
        <ToastProvider>
          <ToastViewport />
        </ToastProvider>
      );
    });

    it('applies default classes', () => {
      render(
        <ToastProvider>
          <ToastViewport />
        </ToastProvider>
      );

      const viewport = screen.getByTestId('toast-viewport');
      expect(viewport).toHaveClass('fixed', 'top-0', 'z-[100]', 'flex', 'max-h-screen', 'w-full', 'flex-col-reverse', 'p-4', 'sm:bottom-0', 'sm:right-0', 'sm:top-auto', 'sm:flex-col', 'md:max-w-[420px]');
    });

    it('applies custom className', () => {
      render(
        <ToastProvider>
          <ToastViewport className="custom-viewport" />
        </ToastProvider>
      );

      const viewport = screen.getByTestId('toast-viewport');
      expect(viewport).toHaveClass('custom-viewport');
    });

    it('forwards ref correctly', () => {
      const ref = { current: null };
      render(
        <ToastProvider>
          <ToastViewport ref={ref} />
        </ToastProvider>
      );

      expect(ref.current).toBeDefined();
    });

    it('passes through additional props', () => {
      render(
        <ToastProvider>
          <ToastViewport data-testid="custom-viewport" aria-label="Toast notifications">
            Content
          </ToastViewport>
        </ToastProvider>
      );

      const viewport = screen.getByTestId('custom-viewport');
      expect(viewport).toHaveAttribute('aria-label', 'Toast notifications');
    });
  });

  describe('Toast', () => {
    it('renders without crashing', () => {
      render(
        <ToastProvider>
          <Toast>Toast content</Toast>
        </ToastProvider>
      );
    });

    it('renders children correctly', () => {
      render(
        <ToastProvider>
          <Toast>Toast message</Toast>
        </ToastProvider>
      );

      const toast = screen.getByTestId('toast');
      expect(toast).toBeInTheDocument();
      expect(toast).toHaveTextContent('Toast message');
    });

    it('applies default variant classes', () => {
      render(
        <ToastProvider>
          <Toast>Default toast</Toast>
        </ToastProvider>
      );

      const toast = screen.getByTestId('toast');
      expect(toast).toHaveClass('group', 'pointer-events-auto', 'relative', 'flex', 'w-full', 'items-center', 'justify-between', 'space-x-4', 'overflow-hidden', 'rounded-md', 'border', 'p-6', 'pr-8', 'shadow-lg', 'transition-all');
    });

    it('applies destructive variant classes', () => {
      render(
        <ToastProvider>
          <Toast variant="destructive">Error toast</Toast>
        </ToastProvider>
      );

      const toast = screen.getByTestId('toast');
      expect(toast).toHaveClass('destructive', 'group', 'border-destructive', 'bg-destructive', 'text-destructive-foreground');
    });

    it('applies success variant classes', () => {
      render(
        <ToastProvider>
          <Toast variant="success">Success toast</Toast>
        </ToastProvider>
      );

      const toast = screen.getByTestId('toast');
      expect(toast).toHaveClass('border-green-500', 'bg-green-50', 'text-green-900');
    });

    it('applies custom className', () => {
      render(
        <ToastProvider>
          <Toast className="custom-toast">Content</Toast>
        </ToastProvider>
      );

      const toast = screen.getByTestId('toast');
      expect(toast).toHaveClass('custom-toast');
    });

    it('forwards ref correctly', () => {
      const ref = { current: null };
      render(
        <ToastProvider>
          <Toast ref={ref}>Content</Toast>
        </ToastProvider>
      );

      expect(ref.current).toBeDefined();
    });

    it('passes through additional props', () => {
      render(
        <ToastProvider>
          <Toast data-testid="custom-toast" aria-label="Toast notification">
            Content
          </Toast>
        </ToastProvider>
      );

      const toast = screen.getByTestId('custom-toast');
      expect(toast).toHaveAttribute('aria-label', 'Toast notification');
    });
  });

  describe('ToastTitle', () => {
    it('renders without crashing', () => {
      render(
        <ToastProvider>
          <Toast>
            <ToastTitle>Toast title</ToastTitle>
          </Toast>
        </ToastProvider>
      );
    });

    it('renders children correctly', () => {
      render(
        <ToastProvider>
          <Toast>
            <ToastTitle>Toast title text</ToastTitle>
          </Toast>
        </ToastProvider>
      );

      const title = screen.getByTestId('toast-title');
      expect(title).toBeInTheDocument();
      expect(title).toHaveTextContent('Toast title text');
    });

    it('applies default classes', () => {
      render(
        <ToastProvider>
          <Toast>
            <ToastTitle>Title</ToastTitle>
          </Toast>
        </ToastProvider>
      );

      const title = screen.getByTestId('toast-title');
      expect(title).toHaveClass('text-sm', 'font-semibold');
    });

    it('applies custom className', () => {
      render(
        <ToastProvider>
          <Toast>
            <ToastTitle className="custom-title">Title</ToastTitle>
          </Toast>
        </ToastProvider>
      );

      const title = screen.getByTestId('toast-title');
      expect(title).toHaveClass('custom-title');
    });

    it('forwards ref correctly', () => {
      const ref = { current: null };
      render(
        <ToastProvider>
          <Toast>
            <ToastTitle ref={ref}>Title</ToastTitle>
          </Toast>
        </ToastProvider>
      );

      expect(ref.current).toBeDefined();
    });
  });

  describe('ToastDescription', () => {
    it('renders without crashing', () => {
      render(
        <ToastProvider>
          <Toast>
            <ToastDescription>Toast description</ToastDescription>
          </Toast>
        </ToastProvider>
      );

      expect(screen.getByTestId('toast-description')).toBeInTheDocument();
    });

    it('renders children correctly', () => {
      render(
        <ToastProvider>
          <Toast>
            <ToastDescription>Description text</ToastDescription>
          </Toast>
        </ToastProvider>
      );

      const description = screen.getByTestId('toast-description');
      expect(description).toBeInTheDocument();
      expect(description).toHaveTextContent('Description text');
    });

    it('applies default classes', () => {
      render(
        <ToastProvider>
          <Toast>
            <ToastDescription>Description</ToastDescription>
          </Toast>
        </ToastProvider>
      );

      const description = screen.getByTestId('toast-description');
      expect(description).toHaveClass('text-sm', 'opacity-90');
    });

    it('applies custom className', () => {
      render(
        <ToastProvider>
          <Toast>
            <ToastDescription className="custom-description">Description</ToastDescription>
          </Toast>
        </ToastProvider>
      );

      const description = screen.getByTestId('toast-description');
      expect(description).toHaveClass('custom-description');
    });

    it('forwards ref correctly', () => {
      const ref = { current: null };
      render(
        <ToastProvider>
          <Toast>
            <ToastDescription ref={ref}>Description</ToastDescription>
          </Toast>
        </ToastProvider>
      );

      expect(ref.current).toBeDefined();
    });
  });

  describe('ToastClose', () => {
    it('renders without crashing', () => {
      render(
        <ToastProvider>
          <Toast>
            <ToastClose>Close</ToastClose>
          </Toast>
        </ToastProvider>
      );

      expect(screen.getByTestId('toast-close')).toBeInTheDocument();
    });

    it('renders children correctly', () => {
      render(
        <ToastProvider>
          <Toast>
            <ToastClose>Close button</ToastClose>
          </Toast>
        </ToastProvider>
      );

      const closeButton = screen.getByTestId('toast-close');
      expect(closeButton).toBeInTheDocument();
      expect(closeButton).toHaveTextContent('Close button');
    });

    it('renders as button element', () => {
      render(
        <ToastProvider>
          <Toast>
            <ToastClose>Close</ToastClose>
          </Toast>
        </ToastProvider>
      );

      const closeButton = screen.getByTestId('toast-close');
      expect(closeButton.tagName).toBe('BUTTON');
    });

    it('applies default classes', () => {
      render(
        <ToastProvider>
          <Toast>
            <ToastClose>Close</ToastClose>
          </Toast>
        </ToastProvider>
      );

      const closeButton = screen.getByTestId('toast-close');
      expect(closeButton).toHaveClass('absolute', 'right-2', 'top-2', 'rounded-md', 'p-1', 'ring-offset-background', 'transition-opacity', 'hover:opacity-100', 'focus:outline-none', 'focus:ring-2', 'focus:ring-ring', 'focus:ring-offset-2');
    });

    it('applies custom className', () => {
      render(
        <ToastProvider>
          <Toast>
            <ToastClose className="custom-close">Close</ToastClose>
          </Toast>
        </ToastProvider>
      );

      const closeButton = screen.getByTestId('toast-close');
      expect(closeButton).toHaveClass('custom-close');
    });

    it('forwards ref correctly', () => {
      const ref = { current: null };
      render(
        <ToastProvider>
          <Toast>
            <ToastClose ref={ref}>Close</ToastClose>
          </Toast>
        </ToastProvider>
      );

      expect(ref.current).toBeDefined();
    });

    it('passes through additional props', () => {
      render(
        <ToastProvider>
          <Toast>
            <ToastClose aria-label="Close toast" disabled>
              Close
            </ToastClose>
          </Toast>
        </ToastProvider>
      );

      const closeButton = screen.getByTestId('toast-close');
      expect(closeButton).toHaveAttribute('aria-label', 'Close toast');
      expect(closeButton).toBeDisabled();
    });
  });

  describe('ToastAction', () => {
    it('renders without crashing', () => {
      render(
        <ToastProvider>
          <Toast>
            <ToastAction altText="Action">Action</ToastAction>
          </Toast>
        </ToastProvider>
      );

      expect(screen.getByTestId('toast-action')).toBeInTheDocument();
    });

    it('renders children correctly', () => {
      render(
        <ToastProvider>
          <Toast>
            <ToastAction altText="Action button">Action button</ToastAction>
          </Toast>
        </ToastProvider>
      );

      const actionButton = screen.getByTestId('toast-action');
      expect(actionButton).toBeInTheDocument();
      expect(actionButton).toHaveTextContent('Action button');
    });

    it('renders as button element', () => {
      render(
        <ToastProvider>
          <Toast>
            <ToastAction altText="Action">Action</ToastAction>
          </Toast>
        </ToastProvider>
      );

      const actionButton = screen.getByTestId('toast-action');
      expect(actionButton.tagName).toBe('BUTTON');
    });

    it('applies default classes', () => {
      render(
        <ToastProvider>
          <Toast>
            <ToastAction altText="Action">Action</ToastAction>
          </Toast>
        </ToastProvider>
      );

      const actionButton = screen.getByTestId('toast-action');
      expect(actionButton).toHaveClass('rounded-sm', 'border', 'bg-transparent', 'p-1', 'font-medium', 'text-sm', 'ring-offset-background', 'transition-colors', 'hover:bg-secondary', 'focus:outline-none', 'focus:ring-2', 'focus:ring-ring', 'focus:ring-offset-2');
    });

    it('applies custom className', () => {
      render(
        <ToastProvider>
          <Toast>
            <ToastAction altText="Action" className="custom-action">Action</ToastAction>
          </Toast>
        </ToastProvider>
      );

      const actionButton = screen.getByTestId('toast-action');
      expect(actionButton).toHaveClass('custom-action');
    });

    it('forwards ref correctly', () => {
      const ref = { current: null };
      render(
        <ToastProvider>
          <Toast>
            <ToastAction altText="Action" ref={ref}>Action</ToastAction>
          </Toast>
        </ToastProvider>
      );

      expect(ref.current).toBeDefined();
    });

    it('passes through additional props', () => {
      render(
        <ToastProvider>
          <Toast>
            <ToastAction altText="Undo action" disabled>
              Undo
            </ToastAction>
          </Toast>
        </ToastProvider>
      );

      const actionButton = screen.getByTestId('toast-action');
      expect(actionButton).toHaveAttribute('altText', 'Undo action');
      expect(actionButton).toBeDisabled();
    });
  });

  describe('combined components', () => {
    it('renders complete toast structure', () => {
      render(
        <ToastProvider>
          <ToastViewport />
          <Toast>
            <ToastTitle>Success</ToastTitle>
            <ToastDescription>Operation completed successfully</ToastDescription>
            <ToastAction altText="Undo">Undo</ToastAction>
            <ToastClose>Close</ToastClose>
          </Toast>
        </ToastProvider>
      );

      expect(screen.getByTestId('toast-provider')).toBeInTheDocument();
      expect(screen.getByTestId('toast-viewport')).toBeInTheDocument();
      expect(screen.getByTestId('toast')).toBeInTheDocument();
      expect(screen.getByTestId('toast-title')).toBeInTheDocument();
      expect(screen.getByTestId('toast-description')).toBeInTheDocument();
      expect(screen.getByTestId('toast-action')).toBeInTheDocument();
      expect(screen.getByTestId('toast-close')).toBeInTheDocument();
      expect(screen.getByText('Success')).toBeInTheDocument();
      expect(screen.getByText('Operation completed successfully')).toBeInTheDocument();
      expect(screen.getByText('Undo')).toBeInTheDocument();
      expect(screen.getByText('Close')).toBeInTheDocument();
    });

    it('renders toast with different variants', () => {
      const { rerender } = render(
        <ToastProvider>
          <Toast variant="default">
            <ToastTitle>Default</ToastTitle>
          </Toast>
        </ToastProvider>
      );

      let toast = screen.getByTestId('toast');
      expect(toast).toHaveClass('border', 'bg-background', 'text-foreground');

      rerender(
        <ToastProvider>
          <Toast variant="destructive">
            <ToastTitle>Error</ToastTitle>
          </Toast>
        </ToastProvider>
      );

      toast = screen.getByTestId('toast');
      expect(toast).toHaveClass('border-destructive', 'bg-destructive', 'text-destructive-foreground');

      rerender(
        <ToastProvider>
          <Toast variant="success">
            <ToastTitle>Success</ToastTitle>
          </Toast>
        </ToastProvider>
      );

      toast = screen.getByTestId('toast');
      expect(toast).toHaveClass('border-green-500', 'bg-green-50', 'text-green-900');
    });

    it('handles multiple toasts', () => {
      render(
        <ToastProvider>
          <ToastViewport />
          <Toast>
            <ToastTitle>Toast 1</ToastTitle>
          </Toast>
          <Toast variant="destructive">
            <ToastTitle>Toast 2</ToastTitle>
          </Toast>
          <Toast variant="success">
            <ToastTitle>Toast 3</ToastTitle>
          </Toast>
        </ToastProvider>
      );

      const toasts = screen.getAllByTestId('toast');
      const titles = screen.getAllByTestId('toast-title');
      
      expect(toasts).toHaveLength(3);
      expect(titles).toHaveLength(3);
      expect(screen.getByText('Toast 1')).toBeInTheDocument();
      expect(screen.getByText('Toast 2')).toBeInTheDocument();
      expect(screen.getByText('Toast 3')).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('has proper button roles', () => {
      render(
        <ToastProvider>
          <Toast>
            <ToastAction altText="Action">Action</ToastAction>
            <ToastClose>Close</ToastClose>
          </Toast>
        </ToastProvider>
      );

      const actionButton = screen.getByTestId('toast-action');
      const closeButton = screen.getByTestId('toast-close');
      
      expect(actionButton.tagName).toBe('BUTTON');
      expect(closeButton.tagName).toBe('BUTTON');
    });

    it('maintains semantic structure', () => {
      render(
        <ToastProvider>
          <ToastViewport />
          <Toast>
            <ToastTitle>Title</ToastTitle>
            <ToastDescription>Description</ToastDescription>
          </Toast>
        </ToastProvider>
      );

      expect(screen.getByTestId('toast-provider')).toBeInTheDocument();
      expect(screen.getByTestId('toast-viewport')).toBeInTheDocument();
      expect(screen.getByTestId('toast')).toBeInTheDocument();
      expect(screen.getByTestId('toast-title')).toBeInTheDocument();
      expect(screen.getByTestId('toast-description')).toBeInTheDocument();
    });

    it('supports ARIA attributes', () => {
      render(
        <ToastProvider>
          <Toast>
            <ToastAction altText="Perform action" aria-label="Perform action">Action</ToastAction>
            <ToastClose aria-label="Dismiss notification">Close</ToastClose>
          </Toast>
        </ToastProvider>
      );

      const actionButton = screen.getByTestId('toast-action');
      const closeButton = screen.getByTestId('toast-close');
      
      expect(actionButton).toHaveAttribute('aria-label', 'Perform action');
      expect(closeButton).toHaveAttribute('aria-label', 'Dismiss notification');
    });
  });

  describe('props handling', () => {
    it('passes through data attributes', () => {
      render(
        <ToastProvider>
          <Toast data-testid="custom-toast">
            <ToastTitle data-testid="custom-title">Title</ToastTitle>
            <ToastDescription data-testid="custom-description">Description</ToastDescription>
          </Toast>
        </ToastProvider>
      );

      expect(screen.getByTestId('custom-toast')).toBeInTheDocument();
      expect(screen.getByTestId('custom-title')).toBeInTheDocument();
      expect(screen.getByTestId('custom-description')).toBeInTheDocument();
    });

    it('handles complex children', () => {
      render(
        <ToastProvider>
          <Toast>
            <ToastTitle>
              <span>Icon</span>
              <span>Title with icon</span>
            </ToastTitle>
            <ToastDescription>
              <div>
                <p>First paragraph</p>
                <p>Second paragraph</p>
              </div>
            </ToastDescription>
          </Toast>
        </ToastProvider>
      );

      expect(screen.getByText('Icon')).toBeInTheDocument();
      expect(screen.getByText('Title with icon')).toBeInTheDocument();
      expect(screen.getByText('First paragraph')).toBeInTheDocument();
      expect(screen.getByText('Second paragraph')).toBeInTheDocument();
    });
  });

  describe('styling', () => {
    it('maintains consistent base classes for Toast', () => {
      render(
        <ToastProvider>
          <Toast>Content</Toast>
        </ToastProvider>
      );

      const toast = screen.getByTestId('toast');
      expect(toast).toHaveClass('group', 'pointer-events-auto', 'relative', 'flex', 'w-full', 'items-center', 'justify-between', 'space-x-4', 'overflow-hidden', 'rounded-md', 'border', 'p-6', 'pr-8', 'shadow-lg', 'transition-all');
    });

    it('maintains consistent base classes for ToastViewport', () => {
      render(
        <ToastProvider>
          <ToastViewport />
        </ToastProvider>
      );

      const viewport = screen.getByTestId('toast-viewport');
      expect(viewport).toHaveClass('fixed', 'top-0', 'z-[100]', 'flex', 'max-h-screen', 'w-full', 'flex-col-reverse', 'p-4');
    });

    it('combines custom classes with base classes', () => {
      render(
        <ToastProvider>
          <Toast className="custom-toast">
            <ToastTitle className="custom-title">Title</ToastTitle>
            <ToastDescription className="custom-description">Description</ToastDescription>
          </Toast>
        </ToastProvider>
      );

      const toast = screen.getByTestId('toast');
      const title = screen.getByTestId('toast-title');
      const description = screen.getByTestId('toast-description');
      
      expect(toast).toHaveClass('group', 'pointer-events-auto');
      expect(toast).toHaveClass('custom-toast');
      
      expect(title).toHaveClass('text-sm', 'font-semibold');
      expect(title).toHaveClass('custom-title');
      
      expect(description).toHaveClass('text-sm', 'opacity-90');
      expect(description).toHaveClass('custom-description');
    });
  });

  describe('animation and transitions', () => {
    it('applies animation classes', () => {
      render(
        <ToastProvider>
          <Toast>Content</Toast>
        </ToastProvider>
      );

      const toast = screen.getByTestId('toast');
      expect(toast).toHaveClass('transition-all', 'data-[swipe=cancel]:translate-x-0', 'data-[state=open]:animate-in', 'data-[state=closed]:animate-out');
    });

    it('applies swipe animation classes', () => {
      render(
        <ToastProvider>
          <Toast>Content</Toast>
        </ToastProvider>
      );

      const toast = screen.getByTestId('toast');
      expect(toast).toHaveClass('data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)]', 'data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)]');
    });

    it('applies slide animation classes', () => {
      render(
        <ToastProvider>
          <Toast>Content</Toast>
        </ToastProvider>
      );

      const toast = screen.getByTestId('toast');
      expect(toast).toHaveClass('data-[state=closed]:slide-out-to-right-full', 'data-[state=open]:slide-in-from-top-full', 'data-[state=open]:sm:slide-in-from-bottom-full');
    });
  });
});
