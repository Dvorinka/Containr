import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Skeleton } from './skeleton';

describe('Skeleton', () => {
  it('renders skeleton element', () => {
    const { container } = render(<Skeleton />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it('applies default animation class', () => {
    const { container } = render(<Skeleton />);
    expect(container.firstChild).toHaveClass('animate-pulse');
  });

  it('applies default background class', () => {
    const { container } = render(<Skeleton />);
    expect(container.firstChild).toHaveClass('bg-muted');
  });

  it('applies custom className', () => {
    const { container } = render(<Skeleton className="h-4 w-32" />);
    expect(container.firstChild).toHaveClass('h-4');
    expect(container.firstChild).toHaveClass('w-32');
  });

  it('renders with custom width', () => {
    const { container } = render(<Skeleton className="w-full" />);
    expect(container.firstChild).toHaveClass('w-full');
  });

  it('renders with custom height', () => {
    const { container } = render(<Skeleton className="h-12" />);
    expect(container.firstChild).toHaveClass('h-12');
  });

  it('renders circular skeleton', () => {
    const { container } = render(<Skeleton className="rounded-full h-12 w-12" />);
    expect(container.firstChild).toHaveClass('rounded-full');
  });
});
