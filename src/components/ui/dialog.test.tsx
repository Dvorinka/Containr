import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription } from './dialog';

// Mock Radix UI components
vi.mock('@radix-ui/react-dialog', () => ({
  Root: ({ children }: { children: React.ReactNode }) => <div data-testid="dialog-root">{children}</div>,
  Portal: ({ children }: { children: React.ReactNode }) => <div data-testid="dialog-portal">{children}</div>,
  Overlay: vi.fn(({ className, ...props }: any) => <div data-testid="dialog-overlay" className={className} {...props} />),
  Content: vi.fn(({ children, className, ...props }: any) => <div data-testid="dialog-content" className={className} {...props}>{children}</div>),
  Close: vi.fn(({ children, className, ...props }: any) => <button data-testid="dialog-close" className={className} {...props}>{children}</button>),
  Title: vi.fn(({ children, className, ...props }: any) => <h2 data-testid="dialog-title" className={className} {...props}>{children}</h2>),
  Description: vi.fn(({ children, className, ...props }: any) => <p data-testid="dialog-description" className={className} {...props}>{children}</p>),
}));

// Mock lucide-react
vi.mock('lucide-react', () => ({
  X: () => <svg data-testid="close-icon" />,
}));

describe('Dialog', () => {
  describe('DialogContent', () => {
    it('renders without crashing', () => {
      render(
        <Dialog open>
          <DialogContent>Dialog content</DialogContent>
        </Dialog>
      );
    });

    it('renders portal and overlay', () => {
      render(
        <Dialog open>
          <DialogContent>Content</DialogContent>
        </Dialog>
      );

      expect(screen.getByTestId('dialog-portal')).toBeInTheDocument();
      expect(screen.getByTestId('dialog-overlay')).toBeInTheDocument();
    });

    it('renders children correctly', () => {
      render(
        <Dialog open>
          <DialogContent>Test content</DialogContent>
        </Dialog>
      );

      const content = screen.getByTestId('dialog-content');
      expect(content).toBeInTheDocument();
      expect(content).toHaveTextContent('Test content');
    });

    it('applies default classes', () => {
      render(
        <Dialog open>
          <DialogContent>Content</DialogContent>
        </Dialog>
      );

      const content = screen.getByTestId('dialog-content');
      expect(content).toHaveClass('fixed', 'left-[50%]', 'top-[50%]', 'z-50', 'grid', 'w-full', 'max-w-lg');
    });

    it('applies custom className', () => {
      render(
        <Dialog open>
          <DialogContent className="custom-dialog">Content</DialogContent>
        </Dialog>
      );

      const content = screen.getByTestId('dialog-content');
      expect(content).toHaveClass('custom-dialog');
    });

    it('renders close button', () => {
      render(
        <Dialog open>
          <DialogContent>Content</DialogContent>
        </Dialog>
      );

      expect(screen.getByTestId('dialog-close')).toBeInTheDocument();
      expect(screen.getByTestId('close-icon')).toBeInTheDocument();
      expect(screen.getByText('Close')).toBeInTheDocument();
    });

    it('forwards ref correctly', () => {
      const ref = { current: null };
      render(
        <Dialog open>
          <DialogContent ref={ref}>Content</DialogContent>
        </Dialog>
      );

      expect(ref.current).toBeDefined();
    });
  });

  describe('DialogHeader', () => {
    it('renders without crashing', () => {
      render(<DialogHeader>Header content</DialogHeader>);
    });

    it('renders children correctly', () => {
      render(<DialogHeader>Header content</DialogHeader>);
      expect(screen.getByText('Header content')).toBeInTheDocument();
    });

    it('applies default classes', () => {
      render(<DialogHeader>Header</DialogHeader>);
      const header = screen.getByText('Header').parentElement;
      expect(header).toHaveClass('flex', 'flex-col', 'space-y-1.5', 'text-center', 'sm:text-left');
    });

    it('applies custom className', () => {
      render(<DialogHeader className="custom-header">Header</DialogHeader>);
      const header = screen.getByText('Header').parentElement;
      expect(header).toHaveClass('custom-header');
    });
  });

  describe('DialogFooter', () => {
    it('renders without crashing', () => {
      render(<DialogFooter>Footer content</DialogFooter>);
    });

    it('renders children correctly', () => {
      render(<DialogFooter>Footer content</DialogFooter>);
      expect(screen.getByText('Footer content')).toBeInTheDocument();
    });

    it('applies default classes', () => {
      render(<DialogFooter>Footer</DialogFooter>);
      const footer = screen.getByText('Footer').parentElement;
      expect(footer).toHaveClass('flex', 'flex-col-reverse', 'sm:flex-row', 'sm:justify-end', 'sm:space-x-2');
    });

    it('applies custom className', () => {
      render(<DialogFooter className="custom-footer">Footer</DialogFooter>);
      const footer = screen.getByText('Footer').parentElement;
      expect(footer).toHaveClass('custom-footer');
    });
  });

  describe('DialogTitle', () => {
    it('renders without crashing', () => {
      render(<DialogTitle>Dialog title</DialogTitle>);
    });

    it('renders children correctly', () => {
      render(<DialogTitle>Dialog title</DialogTitle>);
      expect(screen.getByText('Dialog title')).toBeInTheDocument();
    });

    it('applies default classes', () => {
      render(<DialogTitle>Dialog title</DialogTitle>);
      const title = screen.getByTestId('dialog-title');
      expect(title).toHaveClass('text-lg', 'font-semibold', 'leading-none', 'tracking-tight');
    });

    it('applies custom className', () => {
      render(<DialogTitle className="custom-title">Dialog title</DialogTitle>);
      const title = screen.getByTestId('dialog-title');
      expect(title).toHaveClass('custom-title');
    });
  });

  describe('DialogDescription', () => {
    it('renders without crashing', () => {
      render(<DialogDescription>Dialog description</DialogDescription>);
    });

    it('renders children correctly', () => {
      render(<DialogDescription>Dialog description</DialogDescription>);
      expect(screen.getByText('Dialog description')).toBeInTheDocument();
    });

    it('applies default classes', () => {
      render(<DialogDescription>Dialog description</DialogDescription>);
      const description = screen.getByTestId('dialog-description');
      expect(description).toHaveClass('text-sm', 'text-muted-foreground');
    });

    it('applies custom className', () => {
      render(<DialogDescription className="custom-description">Dialog description</DialogDescription>);
      const description = screen.getByTestId('dialog-description');
      expect(description).toHaveClass('custom-description');
    });
  });

  describe('combined components', () => {
    it('renders complete dialog structure', () => {
      render(
        <Dialog open>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Dialog Title</DialogTitle>
              <DialogDescription>Dialog description</DialogDescription>
            </DialogHeader>
            <div>Dialog content</div>
            <DialogFooter>
              <button>Cancel</button>
              <button>Confirm</button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      );

      expect(screen.getByTestId('dialog-root')).toBeInTheDocument();
      expect(screen.getByTestId('dialog-portal')).toBeInTheDocument();
      expect(screen.getByTestId('dialog-overlay')).toBeInTheDocument();
      expect(screen.getByTestId('dialog-content')).toBeInTheDocument();
      expect(screen.getByTestId('dialog-title')).toBeInTheDocument();
      expect(screen.getByTestId('dialog-description')).toBeInTheDocument();
      expect(screen.getByText('Dialog Title')).toBeInTheDocument();
      expect(screen.getByText('Dialog description')).toBeInTheDocument();
      expect(screen.getByText('Dialog content')).toBeInTheDocument();
      expect(screen.getByText('Cancel')).toBeInTheDocument();
      expect(screen.getByText('Confirm')).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('has proper semantic structure', () => {
      render(
        <Dialog open>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Important Dialog</DialogTitle>
              <DialogDescription>This is an important message</DialogDescription>
            </DialogHeader>
          </DialogContent>
        </Dialog>
      );

      const title = screen.getByRole('heading', { level: 2 });
      const description = screen.getByText('This is an important message');
      
      expect(title).toBeInTheDocument();
      expect(title).toHaveTextContent('Important Dialog');
      expect(description).toBeInTheDocument();
    });

    it('has accessible close button', () => {
      render(
        <Dialog open>
          <DialogContent>Content</DialogContent>
        </Dialog>
      );

      const closeButton = screen.getByTestId('dialog-close');
      expect(closeButton).toBeInTheDocument();
      expect(screen.getByText('Close')).toBeInTheDocument();
    });
  });

  describe('props handling', () => {
    it('passes through additional props to DialogContent', () => {
      render(
        <Dialog open>
          <DialogContent data-testid="custom-content" aria-label="Custom dialog">
            Content
          </DialogContent>
        </Dialog>
      );

      const content = screen.getByTestId('custom-content');
      expect(content).toHaveAttribute('aria-label', 'Custom dialog');
    });

    it('handles complex children', () => {
      render(
        <Dialog open>
          <DialogContent>
            <div>
              <span>Nested content</span>
              <p>Paragraph content</p>
            </div>
          </DialogContent>
        </Dialog>
      );

      expect(screen.getByText('Nested content')).toBeInTheDocument();
      expect(screen.getByText('Paragraph content')).toBeInTheDocument();
    });
  });

  describe('styling', () => {
    it('maintains consistent base classes for DialogContent', () => {
      render(
        <Dialog open>
          <DialogContent>Content</DialogContent>
        </Dialog>
      );

      const content = screen.getByTestId('dialog-content');
      expect(content).toHaveClass('fixed', 'left-[50%]', 'top-[50%]', 'z-50', 'grid', 'w-full', 'max-w-lg', 'translate-x-[-50%]', 'translate-y-[-50%]');
    });

    it('combines custom classes with base classes', () => {
      render(
        <Dialog open>
          <DialogContent className="custom-content">Content</DialogContent>
        </Dialog>
      );

      const content = screen.getByTestId('dialog-content');
      expect(content).toHaveClass('fixed', 'left-[50%]', 'top-[50%]', 'z-50');
      expect(content).toHaveClass('custom-content');
    });
  });

  describe('DialogOverlay', () => {
    it('applies correct base classes', () => {
      render(
        <Dialog open>
          <DialogContent>Content</DialogContent>
        </Dialog>
      );

      const overlay = screen.getByTestId('dialog-overlay');
      expect(overlay).toHaveClass('fixed', 'inset-0', 'z-50', 'bg-black/80');
    });
  });
});
