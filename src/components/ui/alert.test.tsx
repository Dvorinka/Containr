import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Alert, AlertTitle, AlertDescription } from './alert';

describe('Alert', () => {
  describe('rendering', () => {
    it('renders without crashing', () => {
      render(<Alert>Alert message</Alert>);
    });

    it('renders with default variant', () => {
      render(<Alert>Default alert</Alert>);
      const alert = screen.getByRole('alert');
      expect(alert).toBeInTheDocument();
      expect(alert).toHaveClass('bg-background', 'text-foreground');
    });

    it('renders with destructive variant', () => {
      render(<Alert variant="destructive">Error alert</Alert>);
      const alert = screen.getByRole('alert');
      expect(alert).toBeInTheDocument();
      expect(alert).toHaveClass('border-destructive/50', 'text-destructive');
    });

    it('renders children correctly', () => {
      render(<Alert>Test alert content</Alert>);
      expect(screen.getByText('Test alert content')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      render(<Alert className="custom-class">Alert</Alert>);
      const alert = screen.getByRole('alert');
      expect(alert).toHaveClass('custom-class');
    });

    it('forwards ref correctly', () => {
      const ref = { current: null };
      render(<Alert ref={ref}>Alert</Alert>);
      expect(ref.current).toBeInstanceOf(HTMLDivElement);
    });

    it('has correct role attribute', () => {
      render(<Alert>Alert</Alert>);
      const alert = screen.getByRole('alert');
      expect(alert).toBeInTheDocument();
    });
  });

  describe('AlertTitle', () => {
    it('renders without crashing', () => {
      render(<AlertTitle>Alert title</AlertTitle>);
    });

    it('renders as h5 element', () => {
      render(<AlertTitle>Alert title</AlertTitle>);
      const title = screen.getByText('Alert title');
      expect(title.tagName).toBe('H5');
    });

    it('applies default classes', () => {
      render(<AlertTitle>Alert title</AlertTitle>);
      const title = screen.getByText('Alert title');
      expect(title).toHaveClass('mb-1', 'font-medium', 'leading-none', 'tracking-tight');
    });

    it('applies custom className', () => {
      render(<AlertTitle className="custom-title">Alert title</AlertTitle>);
      const title = screen.getByText('Alert title');
      expect(title).toHaveClass('custom-title');
    });

    it('forwards ref correctly', () => {
      const ref = { current: null };
      render(<AlertTitle ref={ref}>Alert title</AlertTitle>);
      expect(ref.current).toBeInstanceOf(HTMLHeadingElement);
    });
  });

  describe('AlertDescription', () => {
    it('renders without crashing', () => {
      render(<AlertDescription>Alert description</AlertDescription>);
    });

    it('renders as div element', () => {
      render(<AlertDescription>Alert description</AlertDescription>);
      const description = screen.getByText('Alert description');
      expect(description.tagName).toBe('DIV');
    });

    it('applies default classes', () => {
      render(<AlertDescription>Alert description</AlertDescription>);
      const description = screen.getByText('Alert description');
      expect(description).toHaveClass('text-sm');
    });

    it('applies custom className', () => {
      render(<AlertDescription className="custom-description">Alert description</AlertDescription>);
      const description = screen.getByText('Alert description');
      expect(description).toHaveClass('custom-description');
    });

    it('forwards ref correctly', () => {
      const ref = { current: null };
      render(<AlertDescription ref={ref}>Alert description</AlertDescription>);
      expect(ref.current).toBeInstanceOf(HTMLDivElement);
    });
  });

  describe('combined components', () => {
    it('renders complete alert structure', () => {
      render(
        <Alert>
          <AlertTitle>Warning</AlertTitle>
          <AlertDescription>This is a warning message</AlertDescription>
        </Alert>
      );

      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('Warning')).toBeInTheDocument();
      expect(screen.getByText('This is a warning message')).toBeInTheDocument();
    });

    it('renders alert with icon and content', () => {
      render(
        <Alert>
          <svg data-testid="alert-icon" />
          <AlertTitle>Success</AlertTitle>
          <AlertDescription>Operation completed successfully</AlertDescription>
        </Alert>
      );

      expect(screen.getByTestId('alert-icon')).toBeInTheDocument();
      expect(screen.getByText('Success')).toBeInTheDocument();
      expect(screen.getByText('Operation completed successfully')).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('has proper ARIA role', () => {
      render(<Alert>Important message</Alert>);
      const alert = screen.getByRole('alert');
      expect(alert).toBeInTheDocument();
    });

    it('maintains semantic structure', () => {
      render(
        <Alert>
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>Something went wrong</AlertDescription>
        </Alert>
      );

      const alert = screen.getByRole('alert');
      const title = screen.getByRole('heading', { level: 5 });
      const description = screen.getByText('Something went wrong');

      expect(alert).toContainElement(title);
      expect(alert).toContainElement(description);
    });
  });

  describe('variants', () => {
    it('applies correct styles for default variant', () => {
      render(<Alert variant="default">Default alert</Alert>);
      const alert = screen.getByRole('alert');
      expect(alert).toHaveClass('bg-background', 'text-foreground');
      expect(alert).not.toHaveClass('border-destructive/50', 'text-destructive');
    });

    it('applies correct styles for destructive variant', () => {
      render(<Alert variant="destructive">Destructive alert</Alert>);
      const alert = screen.getByRole('alert');
      expect(alert).toHaveClass('border-destructive/50', 'text-destructive');
      expect(alert).not.toHaveClass('bg-background', 'text-foreground');
    });
  });

  describe('props handling', () => {
    it('passes through additional props', () => {
      render(<Alert data-testid="custom-alert" aria-label="Custom alert">Alert</Alert>);
      const alert = screen.getByTestId('custom-alert');
      expect(alert).toHaveAttribute('aria-label', 'Custom alert');
    });

    it('handles empty children', () => {
      render(<Alert></Alert>);
      const alert = screen.getByRole('alert');
      expect(alert).toBeInTheDocument();
      expect(alert).toBeEmptyDOMElement();
    });

    it('handles complex children', () => {
      render(
        <Alert>
          <div>
            <span>Nested content</span>
            <p>Paragraph content</p>
          </div>
        </Alert>
      );

      const alert = screen.getByRole('alert');
      expect(screen.getByText('Nested content')).toBeInTheDocument();
      expect(screen.getByText('Paragraph content')).toBeInTheDocument();
      expect(alert).toContainElement(screen.getByText('Nested content'));
    });
  });

  describe('styling', () => {
    it('maintains consistent base classes', () => {
      render(<Alert>Alert</Alert>);
      const alert = screen.getByRole('alert');
      expect(alert).toHaveClass('relative', 'w-full', 'rounded-lg', 'border', 'p-4');
    });

    it('combines variant and custom classes correctly', () => {
      render(
        <Alert variant="destructive" className="custom-alert">
          Alert
        </Alert>
      );
      const alert = screen.getByRole('alert');
      expect(alert).toHaveClass('relative', 'w-full', 'rounded-lg', 'border', 'p-4');
      expect(alert).toHaveClass('border-destructive/50', 'text-destructive');
      expect(alert).toHaveClass('custom-alert');
    });
  });
});
