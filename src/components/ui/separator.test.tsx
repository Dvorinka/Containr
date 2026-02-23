import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Separator } from './separator';

describe('Separator', () => {
  it('renders a horizontal separator by default', () => {
    const { container } = render(<Separator />);
    expect(container.firstChild).toBeInTheDocument();
    expect(container.firstChild).toHaveClass('h-[1px]');
  });

  it('renders a vertical separator when specified', () => {
    const { container } = render(<Separator orientation="vertical" />);
    expect(container.firstChild).toHaveClass('w-[1px]');
  });

  it('applies custom className', () => {
    const { container } = render(<Separator className="custom-class" />);
    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('has decorative role by default', () => {
    render(<Separator />);
    expect(screen.getByRole('none')).toBeInTheDocument();
  });

  it('can be non-decorative', () => {
    render(<Separator decorative={false} />);
    expect(screen.getByRole('separator')).toBeInTheDocument();
  });

  it('accepts orientation prop', () => {
    const { container } = render(<Separator orientation="horizontal" />);
    expect(container.firstChild).toHaveClass('h-[1px]');
  });
});
