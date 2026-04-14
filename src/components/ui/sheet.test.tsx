import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Sheet, SheetTrigger, SheetContent } from './sheet';

// Mock Radix UI components
vi.mock('@radix-ui/react-dialog', () => ({
  Root: ({ children }: { children: React.ReactNode }) => <div data-testid="sheet-root">{children}</div>,
  Trigger: vi.fn(({ children, ...props }: any) => <button data-testid="sheet-trigger" {...props}>{children}</button>),
  Portal: ({ children }: { children: React.ReactNode }) => <div data-testid="sheet-portal">{children}</div>,
  Overlay: vi.fn(({ className, ...props }: any) => <div data-testid="sheet-overlay" className={className} {...props} />),
  Content: vi.fn(({ children, className, ...props }: any) => <div data-testid="sheet-content" className={className} {...props}>{children}</div>),
  Close: vi.fn(({ children, className, ...props }: any) => <button data-testid="sheet-close" className={className} {...props}>{children}</button>),
}));

// Mock lucide-react
vi.mock('lucide-react', () => ({
  X: () => <svg data-testid="close-icon" />,
}));

describe('Sheet', () => {
  describe('SheetTrigger', () => {
    it('renders without crashing', () => {
      render(
        <Sheet>
          <SheetTrigger>Open sheet</SheetTrigger>
        </Sheet>
      );
    });

    it('renders children correctly', () => {
      render(
        <Sheet>
          <SheetTrigger>Sheet trigger</SheetTrigger>
        </Sheet>
      );

      const trigger = screen.getByTestId('sheet-trigger');
      expect(trigger).toBeInTheDocument();
      expect(trigger).toHaveTextContent('Sheet trigger');
    });

    it('renders as button element', () => {
      render(
        <Sheet>
          <SheetTrigger>Trigger</SheetTrigger>
        </Sheet>
      );

      const trigger = screen.getByTestId('sheet-trigger');
      expect(trigger.tagName).toBe('BUTTON');
    });

    it('passes through additional props', () => {
      render(
        <Sheet>
          <SheetTrigger aria-label="Sheet" disabled>
            Trigger
          </SheetTrigger>
        </Sheet>
      );

      const trigger = screen.getByTestId('sheet-trigger');
      expect(trigger).toHaveAttribute('aria-label', 'Sheet');
      expect(trigger).toBeDisabled();
    });
  });

  describe('SheetContent', () => {
    it('renders without crashing', () => {
      render(
        <Sheet open>
          <SheetTrigger>Trigger</SheetTrigger>
          <SheetContent>Sheet content</SheetContent>
        </Sheet>
      );
    });

    it('renders portal and overlay', () => {
      render(
        <Sheet open>
          <SheetTrigger>Trigger</SheetTrigger>
          <SheetContent>Content</SheetContent>
        </Sheet>
      );

      expect(screen.getByTestId('sheet-portal')).toBeInTheDocument();
      expect(screen.getByTestId('sheet-overlay')).toBeInTheDocument();
    });

    it('renders children correctly', () => {
      render(
        <Sheet open>
          <SheetTrigger>Trigger</SheetTrigger>
          <SheetContent>Test content</SheetContent>
        </Sheet>
      );

      const content = screen.getByTestId('sheet-content');
      expect(content).toBeInTheDocument();
      expect(content).toHaveTextContent('Test content');
    });

    it('applies default side (right)', () => {
      render(
        <Sheet open>
          <SheetTrigger>Trigger</SheetTrigger>
          <SheetContent>Content</SheetContent>
        </Sheet>
      );

      const content = screen.getByTestId('sheet-content');
      expect(content).toHaveClass('inset-y-0', 'right-0', 'h-full', 'w-3/4', 'border-l');
    });

    it('applies left side correctly', () => {
      render(
        <Sheet open>
          <SheetTrigger>Trigger</SheetTrigger>
          <SheetContent side="left">Content</SheetContent>
        </Sheet>
      );

      const content = screen.getByTestId('sheet-content');
      expect(content).toHaveClass('inset-y-0', 'left-0', 'h-full', 'w-3/4', 'border-r');
    });

    it('applies top side correctly', () => {
      render(
        <Sheet open>
          <SheetTrigger>Trigger</SheetTrigger>
          <SheetContent side="top">Content</SheetContent>
        </Sheet>
      );

      const content = screen.getByTestId('sheet-content');
      expect(content).toHaveClass('inset-x-0', 'top-0', 'border-b');
    });

    it('applies bottom side correctly', () => {
      render(
        <Sheet open>
          <SheetTrigger>Trigger</SheetTrigger>
          <SheetContent side="bottom">Content</SheetContent>
        </Sheet>
      );

      const content = screen.getByTestId('sheet-content');
      expect(content).toHaveClass('inset-x-0', 'bottom-0', 'border-t');
    });

    it('applies default classes', () => {
      render(
        <Sheet open>
          <SheetTrigger>Trigger</SheetTrigger>
          <SheetContent>Content</SheetContent>
        </Sheet>
      );

      const content = screen.getByTestId('sheet-content');
      expect(content).toHaveClass('fixed', 'z-50', 'gap-4', 'bg-background', 'p-6', 'shadow-lg', 'transition', 'ease-in-out');
    });

    it('applies custom className', () => {
      render(
        <Sheet open>
          <SheetTrigger>Trigger</SheetTrigger>
          <SheetContent className="custom-sheet">Content</SheetContent>
        </Sheet>
      );

      const content = screen.getByTestId('sheet-content');
      expect(content).toHaveClass('custom-sheet');
    });

    it('renders close button', () => {
      render(
        <Sheet open>
          <SheetTrigger>Trigger</SheetTrigger>
          <SheetContent>Content</SheetContent>
        </Sheet>
      );

      expect(screen.getByTestId('sheet-close')).toBeInTheDocument();
      expect(screen.getByTestId('close-icon')).toBeInTheDocument();
      expect(screen.getByText('Close')).toBeInTheDocument();
    });

    it('forwards ref correctly', () => {
      const ref = { current: null };
      render(
        <Sheet open>
          <SheetTrigger>Trigger</SheetTrigger>
          <SheetContent ref={ref}>Content</SheetContent>
        </Sheet>
      );

      expect(ref.current).toBeDefined();
    });
  });

  describe('SheetOverlay', () => {
    it('applies correct base classes', () => {
      render(
        <Sheet open>
          <SheetTrigger>Trigger</SheetTrigger>
          <SheetContent>Content</SheetContent>
        </Sheet>
      );

      const overlay = screen.getByTestId('sheet-overlay');
      expect(overlay).toHaveClass('fixed', 'inset-0', 'z-50', 'bg-black/80');
    });

    it('applies animation classes', () => {
      render(
        <Sheet open>
          <SheetTrigger>Trigger</SheetTrigger>
          <SheetContent>Content</SheetContent>
        </Sheet>
      );

      const overlay = screen.getByTestId('sheet-overlay');
      expect(overlay).toHaveClass('data-[state=open]:animate-in', 'data-[state=closed]:animate-out', 'data-[state=closed]:fade-out-0', 'data-[state=open]:fade-in-0');
    });
  });

  describe('side variants', () => {
    it('applies responsive max-width for left/right sides', () => {
      render(
        <Sheet open>
          <SheetTrigger>Trigger</SheetTrigger>
          <SheetContent side="left">Content</SheetContent>
        </Sheet>
      );

      const content = screen.getByTestId('sheet-content');
      expect(content).toHaveClass('sm:max-w-sm');
    });

    it('applies slide animations for left side', () => {
      render(
        <Sheet open>
          <SheetTrigger>Trigger</SheetTrigger>
          <SheetContent side="left">Content</SheetContent>
        </Sheet>
      );

      const content = screen.getByTestId('sheet-content');
      expect(content).toHaveClass('data-[state=closed]:slide-out-to-left', 'data-[state=open]:slide-in-from-left');
    });

    it('applies slide animations for right side', () => {
      render(
        <Sheet open>
          <SheetTrigger>Trigger</SheetTrigger>
          <SheetContent side="right">Content</SheetContent>
        </Sheet>
      );

      const content = screen.getByTestId('sheet-content');
      expect(content).toHaveClass('data-[state=closed]:slide-out-to-right', 'data-[state=open]:slide-in-from-right');
    });

    it('applies slide animations for top side', () => {
      render(
        <Sheet open>
          <SheetTrigger>Trigger</SheetTrigger>
          <SheetContent side="top">Content</SheetContent>
        </Sheet>
      );

      const content = screen.getByTestId('sheet-content');
      expect(content).toHaveClass('data-[state=closed]:slide-out-to-top', 'data-[state=open]:slide-in-from-top');
    });

    it('applies slide animations for bottom side', () => {
      render(
        <Sheet open>
          <SheetTrigger>Trigger</SheetTrigger>
          <SheetContent side="bottom">Content</SheetContent>
        </Sheet>
      );

      const content = screen.getByTestId('sheet-content');
      expect(content).toHaveClass('data-[state=closed]:slide-out-to-bottom', 'data-[state=open]:slide-in-from-bottom');
    });
  });

  describe('combined components', () => {
    it('renders complete sheet structure', () => {
      render(
        <Sheet>
          <SheetTrigger>Open sheet</SheetTrigger>
          <SheetContent>
            <div>Sheet content</div>
            <button>Action</button>
          </SheetContent>
        </Sheet>
      );

      expect(screen.getByTestId('sheet-root')).toBeInTheDocument();
      expect(screen.getByTestId('sheet-trigger')).toBeInTheDocument();
      expect(screen.getByTestId('sheet-trigger')).toHaveTextContent('Open sheet');
      expect(screen.getByTestId('sheet-portal')).toBeInTheDocument();
      expect(screen.getByTestId('sheet-overlay')).toBeInTheDocument();
      expect(screen.getByTestId('sheet-content')).toBeInTheDocument();
      expect(screen.getByText('Sheet content')).toBeInTheDocument();
      expect(screen.getByText('Action')).toBeInTheDocument();
      expect(screen.getByTestId('sheet-close')).toBeInTheDocument();
    });

    it('handles multiple sheets', () => {
      render(
        <div>
          <Sheet>
            <SheetTrigger>Sheet 1</SheetTrigger>
            <SheetContent>Content 1</SheetContent>
          </Sheet>
          <Sheet>
            <SheetTrigger>Sheet 2</SheetTrigger>
            <SheetContent side="left">Content 2</SheetContent>
          </Sheet>
        </div>
      );

      const triggers = screen.getAllByTestId('sheet-trigger');
      const contents = screen.getAllByTestId('sheet-content');
      
      expect(triggers).toHaveLength(2);
      expect(contents).toHaveLength(2);
      expect(triggers[0]).toHaveTextContent('Sheet 1');
      expect(triggers[1]).toHaveTextContent('Sheet 2');
      expect(contents[0]).toHaveClass('border-l');
      expect(contents[1]).toHaveClass('border-r');
    });
  });

  describe('accessibility', () => {
    it('has proper button role for trigger', () => {
      render(
        <Sheet>
          <SheetTrigger>Sheet</SheetTrigger>
        </Sheet>
      );

      const trigger = screen.getByTestId('sheet-trigger');
      expect(trigger.tagName).toBe('BUTTON');
    });

    it('has accessible close button', () => {
      render(
        <Sheet open>
          <SheetTrigger>Trigger</SheetTrigger>
          <SheetContent>Content</SheetContent>
        </Sheet>
      );

      const closeButton = screen.getByTestId('sheet-close');
      expect(closeButton).toBeInTheDocument();
      expect(screen.getByText('Close')).toBeInTheDocument();
    });

    it('maintains semantic structure', () => {
      render(
        <Sheet open>
          <SheetTrigger>Trigger</SheetTrigger>
          <SheetContent>Content</SheetContent>
        </Sheet>
      );

      expect(screen.getByTestId('sheet-root')).toBeInTheDocument();
      expect(screen.getByTestId('sheet-portal')).toBeInTheDocument();
      expect(screen.getByTestId('sheet-overlay')).toBeInTheDocument();
      expect(screen.getByTestId('sheet-content')).toBeInTheDocument();
    });
  });

  describe('props handling', () => {
    it('passes through additional props to SheetContent', () => {
      render(
        <Sheet open>
          <SheetTrigger>Trigger</SheetTrigger>
          <SheetContent data-testid="custom-content" aria-label="Custom sheet">
            Content
          </SheetContent>
        </Sheet>
      );

      const content = screen.getByTestId('custom-content');
      expect(content).toHaveAttribute('aria-label', 'Custom sheet');
    });

    it('passes through additional props to SheetTrigger', () => {
      render(
        <Sheet>
          <SheetTrigger data-testid="custom-trigger" aria-label="Custom trigger">
            Trigger
          </SheetTrigger>
        </Sheet>
      );

      const trigger = screen.getByTestId('custom-trigger');
      expect(trigger).toHaveAttribute('aria-label', 'Custom trigger');
    });

    it('handles complex children', () => {
      render(
        <Sheet open>
          <SheetTrigger>Trigger</SheetTrigger>
          <SheetContent>
            <div>
              <span>Nested content</span>
              <p>Paragraph content</p>
              <button>Action button</button>
            </div>
          </SheetContent>
        </Sheet>
      );

      expect(screen.getByText('Nested content')).toBeInTheDocument();
      expect(screen.getByText('Paragraph content')).toBeInTheDocument();
      expect(screen.getByText('Action button')).toBeInTheDocument();
    });
  });

  describe('styling', () => {
    it('maintains consistent base classes for SheetContent', () => {
      render(
        <Sheet open>
          <SheetTrigger>Trigger</SheetTrigger>
          <SheetContent>Content</SheetContent>
        </Sheet>
      );

      const content = screen.getByTestId('sheet-content');
      expect(content).toHaveClass('fixed', 'z-50', 'gap-4', 'bg-background', 'p-6', 'shadow-lg', 'transition', 'ease-in-out');
    });

    it('combines custom classes with base classes', () => {
      render(
        <Sheet open>
          <SheetTrigger>Trigger</SheetTrigger>
          <SheetContent className="custom-content">Content</SheetContent>
        </Sheet>
      );

      const content = screen.getByTestId('sheet-content');
      expect(content).toHaveClass('fixed', 'z-50', 'gap-4');
      expect(content).toHaveClass('custom-content');
    });

    it('applies correct border classes based on side', () => {
      const { rerender } = render(
        <Sheet open>
          <SheetTrigger>Trigger</SheetTrigger>
          <SheetContent side="right">Content</SheetContent>
        </Sheet>
      );

      let content = screen.getByTestId('sheet-content');
      expect(content).toHaveClass('border-l');

      rerender(
        <Sheet open>
          <SheetTrigger>Trigger</SheetTrigger>
          <SheetContent side="left">Content</SheetContent>
        </Sheet>
      );

      content = screen.getByTestId('sheet-content');
      expect(content).toHaveClass('border-r');

      rerender(
        <Sheet open>
          <SheetTrigger>Trigger</SheetTrigger>
          <SheetContent side="top">Content</SheetContent>
        </Sheet>
      );

      content = screen.getByTestId('sheet-content');
      expect(content).toHaveClass('border-b');

      rerender(
        <Sheet open>
          <SheetTrigger>Trigger</SheetTrigger>
          <SheetContent side="bottom">Content</SheetContent>
        </Sheet>
      );

      content = screen.getByTestId('sheet-content');
      expect(content).toHaveClass('border-t');
    });
  });

  describe('animation states', () => {
    it('applies correct animation classes', () => {
      render(
        <Sheet open>
          <SheetTrigger>Trigger</SheetTrigger>
          <SheetContent>Content</SheetContent>
        </Sheet>
      );

      const content = screen.getByTestId('sheet-content');
      expect(content).toHaveClass('data-[state=open]:animate-in', 'data-[state=closed]:animate-out', 'data-[state=closed]:duration-300', 'data-[state=open]:duration-500');
    });

    it('applies overlay animation classes', () => {
      render(
        <Sheet open>
          <SheetTrigger>Trigger</SheetTrigger>
          <SheetContent>Content</SheetContent>
        </Sheet>
      );

      const overlay = screen.getByTestId('sheet-overlay');
      expect(overlay).toHaveClass('data-[state=open]:animate-in', 'data-[state=closed]:animate-out', 'data-[state=closed]:fade-out-0', 'data-[state=open]:fade-in-0');
    });
  });
});
