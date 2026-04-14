import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LoadingSkeleton } from './loading-skeleton';

// Mock the Skeleton component
vi.mock('@/components/ui/skeleton', () => ({
  Skeleton: ({ className, ...props }: any) => <div data-testid="skeleton" className={className} {...props} />,
}));

describe('LoadingSkeleton', () => {
  describe('rendering', () => {
    it('renders without crashing', () => {
      render(<LoadingSkeleton />);
    });

    it('renders default variant (card)', () => {
      render(<LoadingSkeleton />);
      expect(screen.getByTestId('skeleton')).toBeInTheDocument();
    });

    it('renders with custom className', () => {
      render(<LoadingSkeleton className="custom-class" />);
      const container = screen.getByTestId('skeleton').closest('div');
      expect(container).toHaveClass('custom-class');
    });
  });

  describe('card variant', () => {
    it('renders card skeleton structure', () => {
      render(<LoadingSkeleton variant="card" />);
      const skeletons = screen.getAllByTestId('skeleton');
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('renders correct number of card skeletons', () => {
      render(<LoadingSkeleton variant="card" count={2} />);
      const skeletons = screen.getAllByTestId('skeleton');
      // Each card has 5 skeleton elements, so 2 cards = 10 skeletons
      expect(skeletons.length).toBe(10);
    });

    it('applies card container classes', () => {
      render(<LoadingSkeleton variant="card" />);
      const container = screen.getByTestId('skeleton').closest('div');
      expect(container).toHaveClass('grid', 'gap-4', 'md:grid-cols-2', 'lg:grid-cols-3');
    });

    it('renders card skeleton elements with correct classes', () => {
      render(<LoadingSkeleton variant="card" />);
      const skeletons = screen.getAllByTestId('skeleton');
      
      // Check for expected skeleton classes in card variant
      const classes = skeletons.map(s => s.className);
      expect(classes.some(c => c.includes('h-4 w-1/3'))).toBe(true);
      expect(classes.some(c => c.includes('h-8 w-1/2'))).toBe(true);
      expect(classes.some(c => c.includes('h-4 w-16'))).toBe(true);
      expect(classes.some(c => c.includes('h-9 flex-1'))).toBe(true);
    });

    it('wraps cards in proper structure', () => {
      render(<LoadingSkeleton variant="card" />);
      const container = screen.getByTestId('skeleton').closest('div');
      const cardContainer = container?.querySelector('.rounded-lg.border.bg-card');
      expect(cardContainer).toBeInTheDocument();
    });
  });

  describe('list variant', () => {
    it('renders list skeleton structure', () => {
      render(<LoadingSkeleton variant="list" />);
      const skeletons = screen.getAllByTestId('skeleton');
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('renders correct number of list skeletons', () => {
      render(<LoadingSkeleton variant="list" count={3} />);
      const skeletons = screen.getAllByTestId('skeleton');
      // Each list item has 4 skeleton elements, so 3 items = 12 skeletons
      expect(skeletons.length).toBe(12);
    });

    it('applies list container classes', () => {
      render(<LoadingSkeleton variant="list" />);
      const container = screen.getByTestId('skeleton').closest('div');
      expect(container).toHaveClass('space-y-3');
    });

    it('renders list skeleton elements with correct classes', () => {
      render(<LoadingSkeleton variant="list" />);
      const skeletons = screen.getAllByTestId('skeleton');
      
      // Check for expected skeleton classes in list variant
      const classes = skeletons.map(s => s.className);
      expect(classes.some(c => c.includes('h-10 w-10 rounded-full'))).toBe(true);
      expect(classes.some(c => c.includes('h-4 w-1/3'))).toBe(true);
      expect(classes.some(c => c.includes('h-3 w-1/2'))).toBe(true);
      expect(classes.some(c => c.includes('h-8 w-20'))).toBe(true);
    });

    it('wraps list items in proper structure', () => {
      render(<LoadingSkeleton variant="list" />);
      const container = screen.getByTestId('skeleton').closest('div');
      const listItem = container?.querySelector('.flex.items-center.gap-4');
      expect(listItem).toBeInTheDocument();
    });
  });

  describe('table variant', () => {
    it('renders table skeleton structure', () => {
      render(<LoadingSkeleton variant="table" />);
      const skeletons = screen.getAllByTestId('skeleton');
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('renders correct number of table skeletons', () => {
      render(<LoadingSkeleton variant="table" count={2} />);
      const skeletons = screen.getAllByTestId('skeleton');
      // Header has 4 skeletons + 2 rows with 4 skeletons each = 12 total
      expect(skeletons.length).toBe(12);
    });

    it('applies table container classes', () => {
      render(<LoadingSkeleton variant="table" />);
      const container = screen.getByTestId('skeleton').closest('div');
      expect(container).toHaveClass('rounded-lg', 'border');
    });

    it('renders table header skeleton', () => {
      render(<LoadingSkeleton variant="table" />);
      const container = screen.getByTestId('skeleton').closest('div');
      const header = container?.querySelector('.p-4.border-b');
      expect(header).toBeInTheDocument();
    });

    it('renders table row skeletons', () => {
      render(<LoadingSkeleton variant="table" count={1} />);
      const container = screen.getByTestId('skeleton').closest('div');
      const rows = container?.querySelectorAll('.p-4.border-b');
      expect(rows).toHaveLength(2); // Header + 1 row
    });

    it('renders table skeleton elements with correct classes', () => {
      render(<LoadingSkeleton variant="table" />);
      const skeletons = screen.getAllByTestId('skeleton');
      
      // Check for expected skeleton classes in table variant
      const classes = skeletons.map(s => s.className);
      expect(classes.some(c => c.includes('h-4 flex-1'))).toBe(true);
    });
  });

  describe('text variant', () => {
    it('renders text skeleton structure', () => {
      render(<LoadingSkeleton variant="text" />);
      const skeletons = screen.getAllByTestId('skeleton');
      expect(skeletons.length).toBe(3);
    });

    it('applies text container classes', () => {
      render(<LoadingSkeleton variant="text" />);
      const container = screen.getByTestId('skeleton').closest('div');
      expect(container).toHaveClass('space-y-2');
    });

    it('renders text skeleton elements with correct classes', () => {
      render(<LoadingSkeleton variant="text" />);
      const skeletons = screen.getAllByTestId('skeleton');
      
      expect(skeletons[0]).toHaveClass('h-4 w-full');
      expect(skeletons[1]).toHaveClass('h-4 w-3/4');
      expect(skeletons[2]).toHaveClass('h-4 w-1/2');
    });
  });

  describe('count prop', () => {
    it('respects count prop for card variant', () => {
      render(<LoadingSkeleton variant="card" count={1} />);
      const skeletons = screen.getAllByTestId('skeleton');
      expect(skeletons.length).toBe(5); // 1 card with 5 skeleton elements
    });

    it('respects count prop for list variant', () => {
      render(<LoadingSkeleton variant="list" count={1} />);
      const skeletons = screen.getAllByTestId('skeleton');
      expect(skeletons.length).toBe(4); // 1 list item with 4 skeleton elements
    });

    it('respects count prop for table variant', () => {
      render(<LoadingSkeleton variant="table" count={1} />);
      const skeletons = screen.getAllByTestId('skeleton');
      expect(skeletons.length).toBe(8); // Header (4) + 1 row (4)
    });

    it('uses default count when not specified', () => {
      render(<LoadingSkeleton variant="card" />);
      const skeletons = screen.getAllByTestId('skeleton');
      expect(skeletons.length).toBe(15); // 3 cards with 5 skeleton elements each
    });

    it('handles zero count', () => {
      render(<LoadingSkeleton variant="card" count={0} />);
      const skeletons = screen.getAllByTestId('skeleton');
      expect(skeletons.length).toBe(0);
    });
  });

  describe('className prop', () => {
    it('applies custom className to card variant', () => {
      render(<LoadingSkeleton variant="card" className="custom-card" />);
      const container = screen.getByTestId('skeleton').closest('div');
      expect(container).toHaveClass('custom-card');
    });

    it('applies custom className to list variant', () => {
      render(<LoadingSkeleton variant="list" className="custom-list" />);
      const container = screen.getByTestId('skeleton').closest('div');
      expect(container).toHaveClass('custom-list');
    });

    it('applies custom className to table variant', () => {
      render(<LoadingSkeleton variant="table" className="custom-table" />);
      const container = screen.getByTestId('skeleton').closest('div');
      expect(container).toHaveClass('custom-table');
    });

    it('applies custom className to text variant', () => {
      render(<LoadingSkeleton variant="text" className="custom-text" />);
      const container = screen.getByTestId('skeleton').closest('div');
      expect(container).toHaveClass('custom-text');
    });

    it('combines custom className with default classes', () => {
      render(<LoadingSkeleton variant="card" className="custom" />);
      const container = screen.getByTestId('skeleton').closest('div');
      expect(container).toHaveClass('grid', 'gap-4', 'md:grid-cols-2', 'lg:grid-cols-3', 'custom');
    });
  });

  describe('accessibility', () => {
    it('has proper semantic structure', () => {
      render(<LoadingSkeleton variant="card" />);
      const skeletons = screen.getAllByTestId('skeleton');
      expect(skeletons.length).toBeGreaterThan(0);
      
      // Skeletons should be div elements (not decorative elements that need aria labels)
      skeletons.forEach(skeleton => {
        expect(skeleton.tagName).toBe('DIV');
      });
    });

    it('maintains proper DOM hierarchy', () => {
      render(<LoadingSkeleton variant="card" />);
      const container = screen.getByTestId('skeleton').closest('div');
      const cardContainer = container?.querySelector('.rounded-lg.border.bg-card');
      
      expect(container).toBeInTheDocument();
      expect(cardContainer).toBeInTheDocument();
      expect(container && cardContainer && container.contains(cardContainer)).toBe(true);
    });
  });

  describe('responsive behavior', () => {
    it('applies responsive grid classes for card variant', () => {
      render(<LoadingSkeleton variant="card" />);
      const container = screen.getByTestId('skeleton').closest('div');
      expect(container).toHaveClass('md:grid-cols-2', 'lg:grid-cols-3');
    });

    it('maintains layout consistency across variants', () => {
      const { rerender } = render(<LoadingSkeleton variant="card" />);
      const cardSkeletons = screen.getAllByTestId('skeleton');
      
      rerender(<LoadingSkeleton variant="list" />);
      const listSkeletons = screen.getAllByTestId('skeleton');
      
      rerender(<LoadingSkeleton variant="text" />);
      const textSkeletons = screen.getAllByTestId('skeleton');
      
      expect(cardSkeletons.length).toBeGreaterThan(0);
      expect(listSkeletons.length).toBeGreaterThan(0);
      expect(textSkeletons.length).toBeGreaterThan(0);
    });
  });

  describe('edge cases', () => {
    it('handles large count values', () => {
      render(<LoadingSkeleton variant="card" count={10} />);
      const skeletons = screen.getAllByTestId('skeleton');
      expect(skeletons.length).toBe(50); // 10 cards with 5 skeleton elements each
    });

    it('handles invalid variant gracefully', () => {
      // @ts-expect-error - Testing invalid variant
      render(<LoadingSkeleton variant="invalid" as any />);
      // Should render text variant as fallback
      const skeletons = screen.getAllByTestId('skeleton');
      expect(skeletons.length).toBe(3);
    });

    it('handles empty className', () => {
      render(<LoadingSkeleton className="" />);
      const container = screen.getByTestId('skeleton').closest('div');
      expect(container).toBeInTheDocument();
    });
  });

  describe('visual consistency', () => {
    it('maintains consistent skeleton sizing patterns', () => {
      render(<LoadingSkeleton variant="card" />);
      const skeletons = screen.getAllByTestId('skeleton');
      
      // Check that skeletons have consistent sizing patterns
      const heightClasses = skeletons.map(s => s.className).filter(c => c.includes('h-'));
      expect(heightClasses.length).toBeGreaterThan(0);
      
      // Should have various heights for visual hierarchy
      expect(heightClasses.some(c => c.includes('h-4'))).toBe(true);
      expect(heightClasses.some(c => c.includes('h-8'))).toBe(true);
      expect(heightClasses.some(c => c.includes('h-9'))).toBe(true);
    });

    it('maintains consistent spacing patterns', () => {
      render(<LoadingSkeleton variant="card" />);
      const container = screen.getByTestId('skeleton').closest('div');
      
      // Should have gap classes for spacing
      expect(container).toHaveClass('gap-4');
    });
  });
});
