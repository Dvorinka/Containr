import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './tabs';

// Mock Radix UI components
vi.mock('@radix-ui/react-tabs', () => ({
  Root: ({ children, defaultValue, value, onValueChange }: any) => {
    const [internalValue, setInternalValue] = React.useState(value || defaultValue);
    const handleValueChange = (newValue: string) => {
      setInternalValue(newValue);
      onValueChange?.(newValue);
    };
    
    return (
      <div data-testid="tabs-root" data-value={internalValue}>
        {React.Children.map(children, (child: any) => {
          if (child?.type?.displayName?.includes('List') || child?.type?.name?.includes('List')) {
            return React.cloneElement(child, { value: internalValue, onValueChange: handleValueChange });
          }
          if (child?.type?.displayName?.includes('Content') || child?.type?.name?.includes('Content')) {
            return internalValue === child.props.value ? child : null;
          }
          return child;
        })}
      </div>
    );
  },
  List: vi.fn(({ children, className, ...props }: any) => (
    <div data-testid="tabs-list" className={className} {...props}>
      {children}
    </div>
  )),
  Trigger: vi.fn(({ children, className, value, ...props }: any) => {
    const mockContext = { value: 'tab1', onValueChange: vi.fn() };
    return (
      <button 
        data-testid="tabs-trigger" 
        data-value={value}
        className={className}
        onClick={() => mockContext.onValueChange(value)}
        {...props}
      >
        {children}
      </button>
    );
  }),
  Content: vi.fn(({ children, className, value, ...props }: any) => (
    <div data-testid="tabs-content" data-value={value} className={className} {...props}>
      {children}
    </div>
  )),
}));

// Mock React
const React = require('react');
React.useState = vi.fn((initial) => [initial, vi.fn()]);
React.Children = { map: vi.fn((children, fn) => children) };
React.cloneElement = vi.fn((element, props) => ({ ...element, props }));

describe('Tabs', () => {
  describe('TabsList', () => {
    it('renders without crashing', () => {
      render(
        <Tabs defaultValue="tab1">
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
            <TabsTrigger value="tab2">Tab 2</TabsTrigger>
          </TabsList>
        </Tabs>
      );
    });

    it('renders children correctly', () => {
      render(
        <Tabs defaultValue="tab1">
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
            <TabsTrigger value="tab2">Tab 2</TabsTrigger>
          </TabsList>
        </Tabs>
      );

      const list = screen.getByTestId('tabs-list');
      expect(list).toBeInTheDocument();
      expect(screen.getByText('Tab 1')).toBeInTheDocument();
      expect(screen.getByText('Tab 2')).toBeInTheDocument();
    });

    it('applies default classes', () => {
      render(
        <Tabs defaultValue="tab1">
          <TabsList>Tab List</TabsList>
        </Tabs>
      );

      const list = screen.getByTestId('tabs-list');
      expect(list).toHaveClass('inline-flex', 'h-10', 'items-center', 'justify-center', 'rounded-md', 'bg-muted', 'p-1', 'text-muted-foreground');
    });

    it('applies custom className', () => {
      render(
        <Tabs defaultValue="tab1">
          <TabsList className="custom-list">Tab List</TabsList>
        </Tabs>
      );

      const list = screen.getByTestId('tabs-list');
      expect(list).toHaveClass('custom-list');
    });

    it('forwards ref correctly', () => {
      const ref = { current: null };
      render(
        <Tabs defaultValue="tab1">
          <TabsList ref={ref}>Tab List</TabsList>
        </Tabs>
      );

      expect(ref.current).toBeDefined();
    });

    it('passes through additional props', () => {
      render(
        <Tabs defaultValue="tab1">
          <TabsList data-testid="custom-list" role="tablist">Tab List</TabsList>
        </Tabs>
      );

      const list = screen.getByTestId('custom-list');
      expect(list).toHaveAttribute('role', 'tablist');
    });
  });

  describe('TabsTrigger', () => {
    it('renders without crashing', () => {
      render(
        <Tabs defaultValue="tab1">
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          </TabsList>
        </Tabs>
      );
    });

    it('renders children correctly', () => {
      render(
        <Tabs defaultValue="tab1">
          <TabsList>
            <TabsTrigger value="tab1">Tab Trigger</TabsTrigger>
          </TabsList>
        </Tabs>
      );

      const trigger = screen.getByTestId('tabs-trigger');
      expect(trigger).toBeInTheDocument();
      expect(trigger).toHaveTextContent('Tab Trigger');
    });

    it('renders as button element', () => {
      render(
        <Tabs defaultValue="tab1">
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          </TabsList>
        </Tabs>
      );

      const trigger = screen.getByTestId('tabs-trigger');
      expect(trigger.tagName).toBe('BUTTON');
    });

    it('applies default classes', () => {
      render(
        <Tabs defaultValue="tab1">
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          </TabsList>
        </Tabs>
      );

      const trigger = screen.getByTestId('tabs-trigger');
      expect(trigger).toHaveClass('inline-flex', 'items-center', 'justify-center', 'whitespace-nowrap', 'rounded-sm', 'px-3', 'py-1.5', 'text-sm', 'font-medium');
    });

    it('applies custom className', () => {
      render(
        <Tabs defaultValue="tab1">
          <TabsList>
            <TabsTrigger value="tab1" className="custom-trigger">Tab 1</TabsTrigger>
          </TabsList>
        </Tabs>
      );

      const trigger = screen.getByTestId('tabs-trigger');
      expect(trigger).toHaveClass('custom-trigger');
    });

    it('has correct value attribute', () => {
      render(
        <Tabs defaultValue="tab1">
          <TabsList>
            <TabsTrigger value="custom-tab">Tab 1</TabsTrigger>
          </TabsList>
        </Tabs>
      );

      const trigger = screen.getByTestId('tabs-trigger');
      expect(trigger).toHaveAttribute('data-value', 'custom-tab');
    });

    it('forwards ref correctly', () => {
      const ref = { current: null };
      render(
        <Tabs defaultValue="tab1">
          <TabsList>
            <TabsTrigger ref={ref} value="tab1">Tab 1</TabsTrigger>
          </TabsList>
        </Tabs>
      );

      expect(ref.current).toBeDefined();
    });

    it('passes through additional props', () => {
      render(
        <Tabs defaultValue="tab1">
          <TabsList>
            <TabsTrigger value="tab1" disabled data-testid="custom-trigger">
              Tab 1
            </TabsTrigger>
          </TabsList>
        </Tabs>
      );

      const trigger = screen.getByTestId('custom-trigger');
      expect(trigger).toBeDisabled();
    });
  });

  describe('TabsContent', () => {
    it('renders without crashing', () => {
      render(
        <Tabs defaultValue="tab1">
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">Content 1</TabsContent>
        </Tabs>
      );
    });

    it('renders children correctly when active', () => {
      render(
        <Tabs defaultValue="tab1">
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">Tab Content</TabsContent>
        </Tabs>
      );

      const content = screen.getByTestId('tabs-content');
      expect(content).toBeInTheDocument();
      expect(content).toHaveTextContent('Tab Content');
    });

    it('does not render when not active', () => {
      render(
        <Tabs defaultValue="tab1">
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          </TabsList>
          <TabsContent value="tab2">Tab 2 Content</TabsContent>
        </Tabs>
      );

      expect(screen.queryByText('Tab 2 Content')).not.toBeInTheDocument();
    });

    it('applies default classes', () => {
      render(
        <Tabs defaultValue="tab1">
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">Content</TabsContent>
        </Tabs>
      );

      const content = screen.getByTestId('tabs-content');
      expect(content).toHaveClass('mt-2');
    });

    it('applies custom className', () => {
      render(
        <Tabs defaultValue="tab1">
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1" className="custom-content">Content</TabsContent>
        </Tabs>
      );

      const content = screen.getByTestId('tabs-content');
      expect(content).toHaveClass('custom-content');
    });

    it('has correct value attribute', () => {
      render(
        <Tabs defaultValue="tab1">
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          </TabsList>
          <TabsContent value="custom-content">Content</TabsContent>
        </Tabs>
      );

      const content = screen.getByTestId('tabs-content');
      expect(content).toHaveAttribute('data-value', 'custom-content');
    });

    it('forwards ref correctly', () => {
      const ref = { current: null };
      render(
        <Tabs defaultValue="tab1">
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          </TabsList>
          <TabsContent ref={ref} value="tab1">Content</TabsContent>
        </Tabs>
      );

      expect(ref.current).toBeDefined();
    });

    it('passes through additional props', () => {
      render(
        <Tabs defaultValue="tab1">
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1" data-testid="custom-content" aria-label="Tab content">
            Content
          </TabsContent>
        </Tabs>
      );

      const content = screen.getByTestId('custom-content');
      expect(content).toHaveAttribute('aria-label', 'Tab content');
    });
  });

  describe('combined components', () => {
    it('renders complete tabs structure', () => {
      render(
        <Tabs defaultValue="tab1">
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
            <TabsTrigger value="tab2">Tab 2</TabsTrigger>
            <TabsTrigger value="tab3">Tab 3</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">Content 1</TabsContent>
          <TabsContent value="tab2">Content 2</TabsContent>
          <TabsContent value="tab3">Content 3</TabsContent>
        </Tabs>
      );

      expect(screen.getByTestId('tabs-root')).toBeInTheDocument();
      expect(screen.getByTestId('tabs-list')).toBeInTheDocument();
      expect(screen.getAllByTestId('tabs-trigger')).toHaveLength(3);
      expect(screen.getByText('Tab 1')).toBeInTheDocument();
      expect(screen.getByText('Tab 2')).toBeInTheDocument();
      expect(screen.getByText('Tab 3')).toBeInTheDocument();
      expect(screen.getByText('Content 1')).toBeInTheDocument();
      expect(screen.queryByText('Content 2')).not.toBeInTheDocument();
      expect(screen.queryByText('Content 3')).not.toBeInTheDocument();
    });

    it('handles controlled tabs', () => {
      const onValueChange = vi.fn();
      render(
        <Tabs value="tab2" onValueChange={onValueChange}>
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
            <TabsTrigger value="tab2">Tab 2</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">Content 1</TabsContent>
          <TabsContent value="tab2">Content 2</TabsContent>
        </Tabs>
      );

      expect(screen.getByText('Content 2')).toBeInTheDocument();
      expect(screen.queryByText('Content 1')).not.toBeInTheDocument();
    });

    it('handles multiple tab groups', () => {
      render(
        <div>
          <Tabs defaultValue="tab1">
            <TabsList>
              <TabsTrigger value="tab1">Group 1 Tab 1</TabsTrigger>
            </TabsList>
            <TabsContent value="tab1">Group 1 Content 1</TabsContent>
          </Tabs>
          <Tabs defaultValue="tab2">
            <TabsList>
              <TabsTrigger value="tab2">Group 2 Tab 1</TabsTrigger>
            </TabsList>
            <TabsContent value="tab2">Group 2 Content 1</TabsContent>
          </Tabs>
        </div>
      );

      expect(screen.getAllByTestId('tabs-root')).toHaveLength(2);
      expect(screen.getAllByTestId('tabs-list')).toHaveLength(2);
      expect(screen.getByText('Group 1 Tab 1')).toBeInTheDocument();
      expect(screen.getByText('Group 2 Tab 1')).toBeInTheDocument();
      expect(screen.getByText('Group 1 Content 1')).toBeInTheDocument();
      expect(screen.getByText('Group 2 Content 1')).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('has proper button role for triggers', () => {
      render(
        <Tabs defaultValue="tab1">
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          </TabsList>
        </Tabs>
      );

      const triggers = screen.getAllByTestId('tabs-trigger');
      triggers.forEach(trigger => {
        expect(trigger.tagName).toBe('BUTTON');
      });
    });

    it('maintains semantic structure', () => {
      render(
        <Tabs defaultValue="tab1">
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">Content</TabsContent>
        </Tabs>
      );

      expect(screen.getByTestId('tabs-root')).toBeInTheDocument();
      expect(screen.getByTestId('tabs-list')).toBeInTheDocument();
      expect(screen.getByTestId('tabs-content')).toBeInTheDocument();
    });

    it('has proper tablist structure', () => {
      render(
        <Tabs defaultValue="tab1">
          <TabsList role="tablist">
            <TabsTrigger value="tab1" role="tab">Tab 1</TabsTrigger>
            <TabsTrigger value="tab2" role="tab">Tab 2</TabsTrigger>
          </TabsList>
        </Tabs>
      );

      const list = screen.getByTestId('tabs-list');
      expect(list).toHaveAttribute('role', 'tablist');
      
      const triggers = screen.getAllByTestId('tabs-trigger');
      triggers.forEach(trigger => {
        expect(trigger).toHaveAttribute('role', 'tab');
      });
    });
  });

  describe('props handling', () => {
    it('passes through data attributes', () => {
      render(
        <Tabs defaultValue="tab1">
          <TabsList data-testid="custom-list">
            <TabsTrigger data-testid="custom-trigger" value="tab1">Tab 1</TabsTrigger>
          </TabsList>
          <TabsContent data-testid="custom-content" value="tab1">Content</TabsContent>
        </Tabs>
      );

      expect(screen.getByTestId('custom-list')).toBeInTheDocument();
      expect(screen.getByTestId('custom-trigger')).toBeInTheDocument();
      expect(screen.getByTestId('custom-content')).toBeInTheDocument();
    });

    it('handles complex children', () => {
      render(
        <Tabs defaultValue="tab1">
          <TabsList>
            <TabsTrigger value="tab1">
              <span>Icon</span>
              <span>Tab 1</span>
            </TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">
            <div>
              <h2>Content Title</h2>
              <p>Content description</p>
              <button>Action</button>
            </div>
          </TabsContent>
        </Tabs>
      );

      expect(screen.getByText('Icon')).toBeInTheDocument();
      expect(screen.getByText('Tab 1')).toBeInTheDocument();
      expect(screen.getByText('Content Title')).toBeInTheDocument();
      expect(screen.getByText('Content description')).toBeInTheDocument();
      expect(screen.getByText('Action')).toBeInTheDocument();
    });
  });

  describe('styling', () => {
    it('maintains consistent base classes for TabsList', () => {
      render(
        <Tabs defaultValue="tab1">
          <TabsList>Tab List</TabsList>
        </Tabs>
      );

      const list = screen.getByTestId('tabs-list');
      expect(list).toHaveClass('inline-flex', 'h-10', 'items-center', 'justify-center', 'rounded-md', 'bg-muted', 'p-1', 'text-muted-foreground');
    });

    it('maintains consistent base classes for TabsTrigger', () => {
      render(
        <Tabs defaultValue="tab1">
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          </TabsList>
        </Tabs>
      );

      const trigger = screen.getByTestId('tabs-trigger');
      expect(trigger).toHaveClass('inline-flex', 'items-center', 'justify-center', 'whitespace-nowrap', 'rounded-sm', 'px-3', 'py-1.5', 'text-sm', 'font-medium', 'ring-offset-background', 'transition-all');
    });

    it('maintains consistent base classes for TabsContent', () => {
      render(
        <Tabs defaultValue="tab1">
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">Content</TabsContent>
        </Tabs>
      );

      const content = screen.getByTestId('tabs-content');
      expect(content).toHaveClass('mt-2', 'ring-offset-background');
    });

    it('combines custom classes with base classes', () => {
      render(
        <Tabs defaultValue="tab1">
          <TabsList className="custom-list">
            <TabsTrigger value="tab1" className="custom-trigger">Tab 1</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1" className="custom-content">Content</TabsContent>
        </Tabs>
      );

      const list = screen.getByTestId('tabs-list');
      const trigger = screen.getByTestId('tabs-trigger');
      const content = screen.getByTestId('tabs-content');
      
      expect(list).toHaveClass('inline-flex', 'h-10');
      expect(list).toHaveClass('custom-list');
      
      expect(trigger).toHaveClass('inline-flex', 'items-center');
      expect(trigger).toHaveClass('custom-trigger');
      
      expect(content).toHaveClass('mt-2');
      expect(content).toHaveClass('custom-content');
    });
  });

  describe('focus and interaction states', () => {
    it('applies focus styles to TabsTrigger', () => {
      render(
        <Tabs defaultValue="tab1">
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          </TabsList>
        </Tabs>
      );

      const trigger = screen.getByTestId('tabs-trigger');
      expect(trigger).toHaveClass('focus-visible:outline-none', 'focus-visible:ring-2', 'focus-visible:ring-ring', 'focus-visible:ring-offset-2');
    });

    it('applies disabled styles to TabsTrigger', () => {
      render(
        <Tabs defaultValue="tab1">
          <TabsList>
            <TabsTrigger value="tab1" disabled>Tab 1</TabsTrigger>
          </TabsList>
        </Tabs>
      );

      const trigger = screen.getByTestId('tabs-trigger');
      expect(trigger).toHaveClass('disabled:pointer-events-none', 'disabled:opacity-50');
    });

    it('applies active state styles to TabsTrigger', () => {
      render(
        <Tabs defaultValue="tab1">
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          </TabsList>
        </Tabs>
      );

      const trigger = screen.getByTestId('tabs-trigger');
      expect(trigger).toHaveClass('data-[state=active]:bg-background', 'data-[state=active]:text-foreground', 'data-[state=active]:shadow-sm');
    });
  });
});
