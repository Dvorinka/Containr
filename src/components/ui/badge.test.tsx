import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Badge, badgeVariants } from './badge';

describe('Badge', () => {
  describe('rendering', () => {
    it('renders children correctly', () => {
      render(<Badge>Test Badge</Badge>);
      expect(screen.getByText('Test Badge')).toBeInTheDocument();
    });

    it('renders as a div element', () => {
      render(<Badge data-testid="badge">Badge</Badge>);
      const badge = screen.getByTestId('badge');
      expect(badge.tagName).toBe('DIV');
    });

    it('applies default variant classes', () => {
      render(<Badge data-testid="badge">Default</Badge>);
      const badge = screen.getByTestId('badge');
      expect(badge).toHaveClass('inline-flex');
      expect(badge).toHaveClass('rounded-md');
    });
  });

  describe('variants', () => {
    it('applies secondary variant classes', () => {
      render(<Badge variant="secondary" data-testid="badge">Secondary</Badge>);
      const badge = screen.getByTestId('badge');
      expect(badge).toHaveClass('bg-secondary');
      expect(badge).toHaveClass('text-secondary-foreground');
    });

    it('applies destructive variant classes', () => {
      render(<Badge variant="destructive" data-testid="badge">Destructive</Badge>);
      const badge = screen.getByTestId('badge');
      expect(badge).toHaveClass('bg-destructive');
      expect(badge).toHaveClass('text-destructive-foreground');
    });

    it('applies outline variant classes', () => {
      render(<Badge variant="outline" data-testid="badge">Outline</Badge>);
      const badge = screen.getByTestId('badge');
      expect(badge).toHaveClass('bg-background');
      expect(badge).toHaveClass('text-foreground');
    });

    it('applies success variant classes', () => {
      render(<Badge variant="success" data-testid="badge">Success</Badge>);
      const badge = screen.getByTestId('badge');
      expect(badge).toHaveClass('bg-success/10');
      expect(badge).toHaveClass('text-success');
    });

    it('applies warning variant classes', () => {
      render(<Badge variant="warning" data-testid="badge">Warning</Badge>);
      const badge = screen.getByTestId('badge');
      expect(badge).toHaveClass('bg-warning/10');
      expect(badge).toHaveClass('text-warning');
    });

    it('applies info variant classes', () => {
      render(<Badge variant="info" data-testid="badge">Info</Badge>);
      const badge = screen.getByTestId('badge');
      expect(badge).toHaveClass('bg-info/10');
      expect(badge).toHaveClass('text-info');
    });

    it('applies live variant classes', () => {
      render(<Badge variant="live" data-testid="badge">Live</Badge>);
      const badge = screen.getByTestId('badge');
      expect(badge).toHaveClass('bg-emerald-500/10');
      expect(badge).toHaveClass('text-emerald-600');
    });

    it('applies building variant classes', () => {
      render(<Badge variant="building" data-testid="badge">Building</Badge>);
      const badge = screen.getByTestId('badge');
      expect(badge).toHaveClass('bg-amber-500/10');
      expect(badge).toHaveClass('text-amber-600');
    });

    it('applies error variant classes', () => {
      render(<Badge variant="error" data-testid="badge">Error</Badge>);
      const badge = screen.getByTestId('badge');
      expect(badge).toHaveClass('bg-red-500/10');
      expect(badge).toHaveClass('text-red-600');
    });
  });

  describe('custom className', () => {
    it('merges custom className with default classes', () => {
      render(<Badge className="custom-class" data-testid="badge">Custom</Badge>);
      const badge = screen.getByTestId('badge');
      expect(badge).toHaveClass('inline-flex');
      expect(badge).toHaveClass('custom-class');
    });
  });

  describe('badgeVariants', () => {
    it('returns default classes when no variant specified', () => {
      const classes = badgeVariants({});
      expect(classes).toContain('inline-flex');
      expect(classes).toContain('bg-primary');
    });

    it('returns variant classes when variant specified', () => {
      const classes = badgeVariants({ variant: 'secondary' });
      expect(classes).toContain('bg-secondary');
    });
  });
});
