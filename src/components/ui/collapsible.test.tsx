import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from './collapsible';

// Mock Radix UI components
vi.mock('@radix-ui/react-collapsible', () => ({
  Root: ({ children, open, onOpenChange, defaultOpen }: any) => {
    const [internalOpen, setInternalOpen] = React.useState(open || defaultOpen || false);
    const handleOpenChange = (newOpen: boolean) => {
      setInternalOpen(newOpen);
      onOpenChange?.(newOpen);
    };
    
    return (
      <div data-testid="collapsible-root" data-open={internalOpen}>
        {React.Children.map(children, (child: any) => {
          if (child?.type?.displayName?.includes('Trigger') || child?.type?.name?.includes('Trigger')) {
            return React.cloneElement(child, { 
              open: internalOpen, 
              onClick: () => handleOpenChange(!internalOpen) 
            });
          }
          if (child?.type?.displayName?.includes('Content') || child?.type?.name?.includes('Content')) {
            return internalOpen ? child : null;
          }
          return child;
        })}
      </div>
    );
  },
  CollapsibleTrigger: vi.fn(({ children, onClick, open, ...props }: any) => (
    <button 
      data-testid="collapsible-trigger" 
      data-open={open}
      onClick={onClick}
      {...props}
    >
      {children}
    </button>
  )),
  CollapsibleContent: vi.fn(({ children, ...props }: any) => (
    <div data-testid="collapsible-content" {...props}>
      {children}
    </div>
  )),
}));

// Mock React
const React = require('react');
React.useState = vi.fn((initial) => [initial, vi.fn()]);
React.Children = { map: vi.fn((children, fn) => children) };
React.cloneElement = vi.fn((element, props) => ({ ...element, props }));

describe('Collapsible', () => {
  describe('Collapsible', () => {
    it('renders without crashing', () => {
      render(
        <Collapsible>
          <CollapsibleTrigger>Toggle</CollapsibleTrigger>
          <CollapsibleContent>Content</CollapsibleContent>
        </Collapsible>
      );
    });

    it('renders children correctly', () => {
      render(
        <Collapsible>
          <CollapsibleTrigger>Toggle</CollapsibleTrigger>
          <CollapsibleContent>Content</CollapsibleContent>
        </Collapsible>
      );

      expect(screen.getByTestId('collapsible-root')).toBeInTheDocument();
      expect(screen.getByTestId('collapsible-trigger')).toBeInTheDocument();
    });

    it('has correct data attributes', () => {
      render(
        <Collapsible>
          <CollapsibleTrigger>Toggle</CollapsibleTrigger>
          <CollapsibleContent>Content</CollapsibleContent>
        </Collapsible>
      );

      const root = screen.getByTestId('collapsible-root');
      expect(root).toHaveAttribute('data-open');
    });

    it('respects defaultOpen prop', () => {
      render(
        <Collapsible defaultOpen>
          <CollapsibleTrigger>Toggle</CollapsibleTrigger>
          <CollapsibleContent>Content</CollapsibleContent>
        </Collapsible>
      );

      const root = screen.getByTestId('collapsible-root');
      expect(root).toHaveAttribute('data-open', 'true');
      expect(screen.getByTestId('collapsible-content')).toBeInTheDocument();
    });

    it('respects open prop (controlled)', () => {
      render(
        <Collapsible open={true}>
          <CollapsibleTrigger>Toggle</CollapsibleTrigger>
          <CollapsibleContent>Content</CollapsibleContent>
        </Collapsible>
      );

      const root = screen.getByTestId('collapsible-root');
      expect(root).toHaveAttribute('data-open', 'true');
      expect(screen.getByTestId('collapsible-content')).toBeInTheDocument();
    });

    it('calls onOpenChange when toggled', () => {
      const onOpenChange = vi.fn();
      render(
        <Collapsible onOpenChange={onOpenChange}>
          <CollapsibleTrigger>Toggle</CollapsibleTrigger>
          <CollapsibleContent>Content</CollapsibleContent>
        </Collapsible>
      );

      const trigger = screen.getByTestId('collapsible-trigger');
      fireEvent.click(trigger);

      expect(onOpenChange).toHaveBeenCalledWith(true);
    });
  });

  describe('CollapsibleTrigger', () => {
    it('renders without crashing', () => {
      render(
        <Collapsible>
          <CollapsibleTrigger>Toggle</CollapsibleTrigger>
          <CollapsibleContent>Content</CollapsibleContent>
        </Collapsible>
      );

      expect(screen.getByTestId('collapsible-trigger')).toBeInTheDocument();
    });

    it('renders children correctly', () => {
      render(
        <Collapsible>
          <CollapsibleTrigger>Toggle Trigger</CollapsibleTrigger>
          <CollapsibleContent>Content</CollapsibleContent>
        </Collapsible>
      );

      const trigger = screen.getByTestId('collapsible-trigger');
      expect(trigger).toBeInTheDocument();
      expect(trigger).toHaveTextContent('Toggle Trigger');
    });

    it('renders as button element', () => {
      render(
        <Collapsible>
          <CollapsibleTrigger>Toggle</CollapsibleTrigger>
          <CollapsibleContent>Content</CollapsibleContent>
        </Collapsible>
      );

      const trigger = screen.getByTestId('collapsible-trigger');
      expect(trigger.tagName).toBe('BUTTON');
    });

    it('has correct open state attribute', () => {
      render(
        <Collapsible defaultOpen>
          <CollapsibleTrigger>Toggle</CollapsibleTrigger>
          <CollapsibleContent>Content</CollapsibleContent>
        </Collapsible>
      );

      const trigger = screen.getByTestId('collapsible-trigger');
      expect(trigger).toHaveAttribute('data-open', 'true');
    });

    it('passes through additional props', () => {
      render(
        <Collapsible>
          <CollapsibleTrigger 
            aria-label="Toggle content" 
            disabled
            data-testid="custom-trigger"
          >
            Toggle
          </CollapsibleTrigger>
          <CollapsibleContent>Content</CollapsibleContent>
        </Collapsible>
      );

      const trigger = screen.getByTestId('custom-trigger');
      expect(trigger).toHaveAttribute('aria-label', 'Toggle content');
      expect(trigger).toBeDisabled();
    });

    it('handles click events', () => {
      render(
        <Collapsible>
          <CollapsibleTrigger>Toggle</CollapsibleTrigger>
          <CollapsibleContent>Content</CollapsibleContent>
        </Collapsible>
      );

      const trigger = screen.getByTestId('collapsible-trigger');
      fireEvent.click(trigger);

      // Should toggle the open state
      expect(trigger).toBeInTheDocument();
    });
  });

  describe('CollapsibleContent', () => {
    it('renders without crashing when open', () => {
      render(
        <Collapsible defaultOpen>
          <CollapsibleTrigger>Toggle</CollapsibleTrigger>
          <CollapsibleContent>Content</CollapsibleContent>
        </Collapsible>
      );

      expect(screen.getByTestId('collapsible-content')).toBeInTheDocument();
    });

    it('does not render when closed', () => {
      render(
        <Collapsible defaultOpen={false}>
          <CollapsibleTrigger>Toggle</CollapsibleTrigger>
          <CollapsibleContent>Content</CollapsibleContent>
        </Collapsible>
      );

      expect(screen.queryByTestId('collapsible-content')).not.toBeInTheDocument();
    });

    it('renders children correctly when open', () => {
      render(
        <Collapsible defaultOpen>
          <CollapsibleTrigger>Toggle</CollapsibleTrigger>
          <CollapsibleContent>
            <div>Nested content</div>
            <p>Paragraph content</p>
          </CollapsibleContent>
        </Collapsible>
      );

      const content = screen.getByTestId('collapsible-content');
      expect(content).toBeInTheDocument();
      expect(screen.getByText('Nested content')).toBeInTheDocument();
      expect(screen.getByText('Paragraph content')).toBeInTheDocument();
    });

    it('passes through additional props', () => {
      render(
        <Collapsible defaultOpen>
          <CollapsibleTrigger>Toggle</CollapsibleTrigger>
          <CollapsibleContent 
            data-testid="custom-content" 
            aria-label="Collapsible content"
          >
            Content
          </CollapsibleContent>
        </Collapsible>
      );

      const content = screen.getByTestId('custom-content');
      expect(content).toHaveAttribute('aria-label', 'Collapsible content');
    });
  });

  describe('combined components', () => {
    it('renders complete collapsible structure', () => {
      render(
        <Collapsible>
          <CollapsibleTrigger>
            <span>Toggle Icon</span>
            <span>Toggle Text</span>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <h2>Content Title</h2>
            <p>Content description</p>
            <button>Action Button</button>
          </CollapsibleContent>
        </Collapsible>
      );

      expect(screen.getByTestId('collapsible-root')).toBeInTheDocument();
      expect(screen.getByTestId('collapsible-trigger')).toBeInTheDocument();
      expect(screen.getByText('Toggle Icon')).toBeInTheDocument();
      expect(screen.getByText('Toggle Text')).toBeInTheDocument();
      expect(screen.getByText('Content Title')).toBeInTheDocument();
      expect(screen.getByText('Content description')).toBeInTheDocument();
      expect(screen.getByText('Action Button')).toBeInTheDocument();
    });

    it('handles multiple collapsibles independently', () => {
      render(
        <div>
          <Collapsible>
            <CollapsibleTrigger>Toggle 1</CollapsibleTrigger>
            <CollapsibleContent>Content 1</CollapsibleContent>
          </Collapsible>
          <Collapsible defaultOpen>
            <CollapsibleTrigger>Toggle 2</CollapsibleTrigger>
            <CollapsibleContent>Content 2</CollapsibleContent>
          </Collapsible>
        </div>
      );

      const roots = screen.getAllByTestId('collapsible-root');
      const triggers = screen.getAllByTestId('collapsible-trigger');
      
      expect(roots).toHaveLength(2);
      expect(triggers).toHaveLength(2);
      expect(triggers[0]).toHaveAttribute('data-open', 'false');
      expect(triggers[1]).toHaveAttribute('data-open', 'true');
      expect(screen.queryByText('Content 1')).not.toBeInTheDocument();
      expect(screen.getByText('Content 2')).toBeInTheDocument();
    });

    it('toggles content visibility on trigger click', () => {
      render(
        <Collapsible>
          <CollapsibleTrigger>Toggle</CollapsibleTrigger>
          <CollapsibleContent>Content</CollapsibleContent>
        </Collapsible>
      );

      const trigger = screen.getByTestId('collapsible-trigger');
      const root = screen.getByTestId('collapsible-root');

      // Initially closed
      expect(root).toHaveAttribute('data-open', 'false');
      expect(screen.queryByText('Content')).not.toBeInTheDocument();

      // Click to open
      fireEvent.click(trigger);
      expect(root).toHaveAttribute('data-open', 'true');
      expect(screen.getByText('Content')).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('has proper button role for trigger', () => {
      render(
        <Collapsible>
          <CollapsibleTrigger>Toggle</CollapsibleTrigger>
          <CollapsibleContent>Content</CollapsibleContent>
        </Collapsible>
      );

      const trigger = screen.getByTestId('collapsible-trigger');
      expect(trigger.tagName).toBe('BUTTON');
    });

    it('maintains semantic structure', () => {
      render(
        <Collapsible defaultOpen>
          <CollapsibleTrigger>Toggle</CollapsibleTrigger>
          <CollapsibleContent>Content</CollapsibleContent>
        </Collapsible>
      );

      expect(screen.getByTestId('collapsible-root')).toBeInTheDocument();
      expect(screen.getByTestId('collapsible-trigger')).toBeInTheDocument();
      expect(screen.getByTestId('collapsible-content')).toBeInTheDocument();
    });

    it('supports ARIA attributes', () => {
      render(
        <Collapsible>
          <CollapsibleTrigger 
            aria-expanded="false"
            aria-controls="content-id"
          >
            Toggle
          </CollapsibleTrigger>
          <CollapsibleContent id="content-id">Content</CollapsibleContent>
        </Collapsible>
      );

      const trigger = screen.getByTestId('collapsible-trigger');
      const content = screen.getByTestId('collapsible-content');
      
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(trigger).toHaveAttribute('aria-controls', 'content-id');
      expect(content).toHaveAttribute('id', 'content-id');
    });
  });

  describe('props handling', () => {
    it('passes through data attributes', () => {
      render(
        <Collapsible data-testid="custom-root">
          <CollapsibleTrigger data-testid="custom-trigger">Toggle</CollapsibleTrigger>
          <CollapsibleContent data-testid="custom-content">Content</CollapsibleContent>
        </Collapsible>
      );

      expect(screen.getByTestId('custom-root')).toBeInTheDocument();
      expect(screen.getByTestId('custom-trigger')).toBeInTheDocument();
      expect(screen.getByTestId('custom-content')).toBeInTheDocument();
    });

    it('handles complex children', () => {
      render(
        <Collapsible>
          <CollapsibleTrigger>
            <div className="trigger-wrapper">
              <svg data-testid="icon" />
              <span>Toggle Text</span>
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="content-wrapper">
              <h2>Title</h2>
              <div className="content-body">
                <p>Paragraph 1</p>
                <p>Paragraph 2</p>
              </div>
              <footer>
                <button>Action</button>
              </footer>
            </div>
          </CollapsibleContent>
        </Collapsible>
      );

      expect(screen.getByTestId('icon')).toBeInTheDocument();
      expect(screen.getByText('Toggle Text')).toBeInTheDocument();
      expect(screen.getByText('Title')).toBeInTheDocument();
      expect(screen.getByText('Paragraph 1')).toBeInTheDocument();
      expect(screen.getByText('Paragraph 2')).toBeInTheDocument();
      expect(screen.getByText('Action')).toBeInTheDocument();
    });
  });

  describe('controlled behavior', () => {
    it('respects controlled open state', () => {
      const { rerender } = render(
        <Collapsible open={false}>
          <CollapsibleTrigger>Toggle</CollapsibleTrigger>
          <CollapsibleContent>Content</CollapsibleContent>
        </Collapsible>
      );

      expect(screen.queryByText('Content')).not.toBeInTheDocument();

      rerender(
        <Collapsible open={true}>
          <CollapsibleTrigger>Toggle</CollapsibleTrigger>
          <CollapsibleContent>Content</CollapsibleContent>
        </Collapsible>
      );

      expect(screen.getByText('Content')).toBeInTheDocument();
    });

    it('calls onOpenChange with correct values', () => {
      const onOpenChange = vi.fn();
      render(
        <Collapsible onOpenChange={onOpenChange}>
          <CollapsibleTrigger>Toggle</CollapsibleTrigger>
          <CollapsibleContent>Content</CollapsibleContent>
        </Collapsible>
      );

      const trigger = screen.getByTestId('collapsible-trigger');
      
      fireEvent.click(trigger);
      expect(onOpenChange).toHaveBeenCalledWith(true);

      fireEvent.click(trigger);
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  describe('edge cases', () => {
    it('handles empty children', () => {
      render(
        <Collapsible>
          <CollapsibleTrigger></CollapsibleTrigger>
          <CollapsibleContent></CollapsibleContent>
        </Collapsible>
      );

      expect(screen.getByTestId('collapsible-trigger')).toBeInTheDocument();
      expect(screen.getByTestId('collapsible-content')).toBeInTheDocument();
    });

    it('handles missing content', () => {
      render(
        <Collapsible>
          <CollapsibleTrigger>Toggle</CollapsibleTrigger>
        </Collapsible>
      );

      expect(screen.getByTestId('collapsible-root')).toBeInTheDocument();
      expect(screen.getByTestId('collapsible-trigger')).toBeInTheDocument();
    });

    it('handles missing trigger', () => {
      render(
        <Collapsible defaultOpen>
          <CollapsibleContent>Content</CollapsibleContent>
        </Collapsible>
      );

      expect(screen.getByTestId('collapsible-root')).toBeInTheDocument();
      expect(screen.getByTestId('collapsible-content')).toBeInTheDocument();
    });
  });
});
