import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Label } from './label';

describe('Label', () => {
  describe('rendering', () => {
    it('renders children correctly', () => {
      render(<Label>Label Text</Label>);
      expect(screen.getByText('Label Text')).toBeInTheDocument();
    });

    it('renders as a label element', () => {
      render(<Label data-testid="label">Label</Label>);
      const label = screen.getByTestId('label');
      expect(label.tagName).toBe('LABEL');
    });
  });

  describe('classes', () => {
    it('applies default label classes', () => {
      render(<Label data-testid="label">Label</Label>);
      const label = screen.getByTestId('label');
      expect(label).toHaveClass('text-sm');
      expect(label).toHaveClass('font-medium');
    });
  });

  describe('htmlFor attribute', () => {
    it('supports htmlFor attribute', () => {
      render(<Label htmlFor="input-id">Label</Label>);
      const label = screen.getByText('Label');
      expect(label).toHaveAttribute('for', 'input-id');
    });
  });

  describe('custom className', () => {
    it('merges custom className with default classes', () => {
      render(<Label className="custom-class" data-testid="label">Custom</Label>);
      const label = screen.getByTestId('label');
      expect(label).toHaveClass('text-sm');
      expect(label).toHaveClass('custom-class');
    });
  });

  describe('ref forwarding', () => {
    it('forwards ref correctly', () => {
      const ref = { current: null as HTMLLabelElement | null };
      render(<Label ref={ref}>Ref Test</Label>);
      expect(ref.current).toBeInstanceOf(HTMLLabelElement);
    });
  });

  describe('accessibility', () => {
    it('is associated with form control via htmlFor', () => {
      render(
        <>
          <Label htmlFor="email">Email</Label>
          <input id="email" type="email" />
        </>
      );
      const label = screen.getByText('Email');
      expect(label).toHaveAttribute('for', 'email');
    });
  });
});
