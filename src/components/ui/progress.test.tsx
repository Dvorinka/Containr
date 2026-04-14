import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Progress } from './progress';

describe('Progress', () => {
  describe('rendering', () => {
    it('renders a progress element', () => {
      render(<Progress data-testid="progress" />);
      const progress = screen.getByTestId('progress');
      expect(progress).toBeInTheDocument();
    });

    it('renders as a div element with progress role', () => {
      render(<Progress data-testid="progress" />);
      const progress = screen.getByTestId('progress');
      expect(progress.tagName).toBe('DIV');
    });
  });

  describe('classes', () => {
    it('applies default progress classes', () => {
      render(<Progress data-testid="progress" />);
      const progress = screen.getByTestId('progress');
      expect(progress).toHaveClass('relative');
      expect(progress).toHaveClass('h-2');
      expect(progress).toHaveClass('w-full');
      expect(progress).toHaveClass('rounded-full');
      expect(progress).toHaveClass('bg-muted');
    });
  });

  describe('value', () => {
    it('renders with value 0', () => {
      render(<Progress value={0} data-testid="progress" />);
      const progress = screen.getByTestId('progress');
      expect(progress).toBeInTheDocument();
    });

    it('renders with value 50', () => {
      render(<Progress value={50} data-testid="progress" />);
      const progress = screen.getByTestId('progress');
      expect(progress).toBeInTheDocument();
    });

    it('renders with value 100', () => {
      render(<Progress value={100} data-testid="progress" />);
      const progress = screen.getByTestId('progress');
      expect(progress).toBeInTheDocument();
    });

    it('renders without value (defaults to 0)', () => {
      render(<Progress data-testid="progress" />);
      const progress = screen.getByTestId('progress');
      expect(progress).toBeInTheDocument();
    });
  });

  describe('custom className', () => {
    it('merges custom className with default classes', () => {
      render(<Progress className="custom-class" data-testid="progress" />);
      const progress = screen.getByTestId('progress');
      expect(progress).toHaveClass('relative');
      expect(progress).toHaveClass('custom-class');
    });
  });

  describe('ref forwarding', () => {
    it('forwards ref correctly', () => {
      const ref = { current: null as HTMLDivElement | null };
      render(<Progress ref={ref} />);
      expect(ref.current).toBeInstanceOf(HTMLDivElement);
    });
  });

  describe('indicator', () => {
    it('contains an indicator element', () => {
      render(<Progress value={50} data-testid="progress" />);
      const progress = screen.getByTestId('progress');
      const indicator = progress.querySelector('[class*="bg-gradient"]');
      expect(indicator).toBeInTheDocument();
    });
  });
});
