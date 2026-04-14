import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PageHeader } from './page-header';
import { Plus } from 'lucide-react';

describe('PageHeader', () => {
  it('renders title', () => {
    render(<PageHeader title="Test Title" />);
    expect(screen.getByText('Test Title')).toBeInTheDocument();
  });

  it('renders description when provided', () => {
    render(<PageHeader title="Title" description="Test description" />);
    expect(screen.getByText('Test description')).toBeInTheDocument();
  });

  it('does not render description when not provided', () => {
    render(<PageHeader title="Title" />);
    expect(screen.queryByText('Test description')).not.toBeInTheDocument();
  });

  it('renders action button when provided', () => {
    render(
      <PageHeader 
        title="Title" 
        action={{ label: 'Add New', onClick: vi.fn() }}
      />
    );
    expect(screen.getByRole('button', { name: 'Add New' })).toBeInTheDocument();
  });

  it('renders action button with icon', () => {
    render(
      <PageHeader 
        title="Title" 
        action={{ label: 'Add New', onClick: vi.fn(), icon: Plus }}
      />
    );
    expect(screen.getByRole('button', { name: 'Add New' })).toBeInTheDocument();
  });

  it('renders children', () => {
    render(
      <PageHeader title="Title">
        <span>Child content</span>
      </PageHeader>
    );
    expect(screen.getByText('Child content')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<PageHeader title="Title" className="custom-class" />);
    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('does not render action button when not provided', () => {
    render(<PageHeader title="Title" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
