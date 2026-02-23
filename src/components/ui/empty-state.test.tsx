import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EmptyState } from './empty-state';
import { Inbox } from 'lucide-react';

describe('EmptyState', () => {
  it('renders title', () => {
    render(<EmptyState title="No items found" />);
    expect(screen.getByText('No items found')).toBeInTheDocument();
  });

  it('renders description when provided', () => {
    render(<EmptyState title="No items" description="Add your first item" />);
    expect(screen.getByText('Add your first item')).toBeInTheDocument();
  });

  it('does not render description when not provided', () => {
    render(<EmptyState title="No items" />);
    expect(screen.queryByText('Add your first item')).not.toBeInTheDocument();
  });

  it('renders icon when provided', () => {
    const { container } = render(<EmptyState title="No items" icon={Inbox} />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('does not render icon when not provided', () => {
    const { container } = render(<EmptyState title="No items" />);
    expect(container.querySelector('svg')).not.toBeInTheDocument();
  });

  it('renders action button when provided', () => {
    render(
      <EmptyState 
        title="No items" 
        action={{ label: 'Add Item', onClick: vi.fn() }}
      />
    );
    expect(screen.getByRole('button', { name: 'Add Item' })).toBeInTheDocument();
  });

  it('does not render action button when not provided', () => {
    render(<EmptyState title="No items" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<EmptyState title="No items" className="custom-class" />);
    expect(container.firstChild).toHaveClass('custom-class');
  });
});
