import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button, buttonVariants } from './button';

describe('Button', () => {
  describe('rendering', () => {
    it('renders children correctly', () => {
      render(<Button>Click me</Button>);
      expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument();
    });

    it('renders as a button element by default', () => {
      render(<Button data-testid="button">Button</Button>);
      const button = screen.getByTestId('button');
      expect(button.tagName).toBe('BUTTON');
    });

    it('applies default variant and size classes', () => {
      render(<Button data-testid="button">Default</Button>);
      const button = screen.getByTestId('button');
      expect(button).toHaveClass('bg-primary');
      expect(button).toHaveClass('h-10');
    });
  });

  describe('variants', () => {
    it('applies destructive variant classes', () => {
      render(<Button variant="destructive" data-testid="button">Destructive</Button>);
      const button = screen.getByTestId('button');
      expect(button).toHaveClass('bg-destructive');
      expect(button).toHaveClass('text-destructive-foreground');
    });

    it('applies outline variant classes', () => {
      render(<Button variant="outline" data-testid="button">Outline</Button>);
      const button = screen.getByTestId('button');
      expect(button).toHaveClass('border');
      expect(button).toHaveClass('bg-background');
    });

    it('applies secondary variant classes', () => {
      render(<Button variant="secondary" data-testid="button">Secondary</Button>);
      const button = screen.getByTestId('button');
      expect(button).toHaveClass('bg-secondary');
      expect(button).toHaveClass('text-secondary-foreground');
    });

    it('applies ghost variant classes', () => {
      render(<Button variant="ghost" data-testid="button">Ghost</Button>);
      const button = screen.getByTestId('button');
      expect(button).toHaveClass('hover:bg-muted/50');
    });

    it('applies link variant classes', () => {
      render(<Button variant="link" data-testid="button">Link</Button>);
      const button = screen.getByTestId('button');
      expect(button).toHaveClass('text-primary');
      expect(button).toHaveClass('underline-offset-4');
    });

    it('applies success variant classes', () => {
      render(<Button variant="success" data-testid="button">Success</Button>);
      const button = screen.getByTestId('button');
      expect(button).toHaveClass('bg-success');
    });

    it('applies warning variant classes', () => {
      render(<Button variant="warning" data-testid="button">Warning</Button>);
      const button = screen.getByTestId('button');
      expect(button).toHaveClass('bg-warning');
    });

    it('applies glow variant classes', () => {
      render(<Button variant="glow" data-testid="button">Glow</Button>);
      const button = screen.getByTestId('button');
      expect(button).toHaveClass('shadow-glow');
    });

    it('applies gradient variant classes', () => {
      render(<Button variant="gradient" data-testid="button">Gradient</Button>);
      const button = screen.getByTestId('button');
      expect(button).toHaveClass('bg-gradient-to-r');
    });
  });

  describe('sizes', () => {
    it('applies sm size classes', () => {
      render(<Button size="sm" data-testid="button">Small</Button>);
      const button = screen.getByTestId('button');
      expect(button).toHaveClass('h-9');
      expect(button).toHaveClass('px-3');
    });

    it('applies lg size classes', () => {
      render(<Button size="lg" data-testid="button">Large</Button>);
      const button = screen.getByTestId('button');
      expect(button).toHaveClass('h-11');
      expect(button).toHaveClass('px-8');
    });

    it('applies xl size classes', () => {
      render(<Button size="xl" data-testid="button">Extra Large</Button>);
      const button = screen.getByTestId('button');
      expect(button).toHaveClass('h-12');
      expect(button).toHaveClass('px-10');
    });

    it('applies icon size classes', () => {
      render(<Button size="icon" data-testid="button">Icon</Button>);
      const button = screen.getByTestId('button');
      expect(button).toHaveClass('h-10');
      expect(button).toHaveClass('w-10');
    });

    it('applies icon-sm size classes', () => {
      render(<Button size="icon-sm" data-testid="button">Icon Small</Button>);
      const button = screen.getByTestId('button');
      expect(button).toHaveClass('h-8');
      expect(button).toHaveClass('w-8');
    });

    it('applies icon-lg size classes', () => {
      render(<Button size="icon-lg" data-testid="button">Icon Large</Button>);
      const button = screen.getByTestId('button');
      expect(button).toHaveClass('h-12');
      expect(button).toHaveClass('w-12');
    });
  });

  describe('asChild', () => {
    it('renders as Slot when asChild is true', () => {
      render(
        <Button asChild>
          <a href="/test">Link Button</a>
        </Button>
      );
      const link = screen.getByRole('link', { name: 'Link Button' });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute('href', '/test');
      expect(link).toHaveClass('bg-primary');
    });
  });

  describe('disabled state', () => {
    it('applies disabled classes when disabled', () => {
      render(<Button disabled data-testid="button">Disabled</Button>);
      const button = screen.getByTestId('button');
      expect(button).toBeDisabled();
      expect(button).toHaveClass('disabled:opacity-50');
    });

    it('does not trigger onClick when disabled', async () => {
      const user = userEvent.setup();
      let clicked = false;
      render(
        <Button disabled onClick={() => { clicked = true; }}>
          Disabled
        </Button>
      );
      const button = screen.getByRole('button', { name: 'Disabled' });
      await user.click(button);
      expect(clicked).toBe(false);
    });
  });

  describe('custom className', () => {
    it('merges custom className with default classes', () => {
      render(<Button className="custom-class" data-testid="button">Custom</Button>);
      const button = screen.getByTestId('button');
      expect(button).toHaveClass('bg-primary');
      expect(button).toHaveClass('custom-class');
    });
  });

  describe('buttonVariants', () => {
    it('returns default classes when no options specified', () => {
      const classes = buttonVariants({});
      expect(classes).toContain('inline-flex');
      expect(classes).toContain('bg-primary');
    });

    it('returns variant classes when variant specified', () => {
      const classes = buttonVariants({ variant: 'destructive' });
      expect(classes).toContain('bg-destructive');
    });

    it('returns size classes when size specified', () => {
      const classes = buttonVariants({ size: 'lg' });
      expect(classes).toContain('h-11');
    });
  });

  describe('ref forwarding', () => {
    it('forwards ref correctly', () => {
      const ref = { current: null as HTMLButtonElement | null };
      render(<Button ref={ref}>Ref Test</Button>);
      expect(ref.current).toBeInstanceOf(HTMLButtonElement);
    });
  });
});
