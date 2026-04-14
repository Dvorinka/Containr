import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from './dropdown-menu';

// Mock Radix UI components
vi.mock('@radix-ui/react-dropdown-menu', () => ({
  Root: ({ children }: { children: React.ReactNode }) => <div data-testid="dropdown-root">{children}</div>,
  Trigger: vi.fn(({ children, ...props }: any) => <button data-testid="dropdown-trigger" {...props}>{children}</button>),
  Portal: ({ children }: { children: React.ReactNode }) => <div data-testid="dropdown-portal">{children}</div>,
  Content: vi.fn(({ children, className, sideOffset, ...props }: any) => (
    <div data-testid="dropdown-content" className={className} data-side-offset={sideOffset} {...props}>
      {children}
    </div>
  )),
  Item: vi.fn(({ children, className, inset, ...props }: any) => (
    <div data-testid="dropdown-item" className={className} data-inset={inset} {...props}>
      {children}
    </div>
  )),
  Separator: vi.fn(({ className, ...props }: any) => <hr data-testid="dropdown-separator" className={className} {...props} />),
}));

describe('DropdownMenu', () => {
  describe('DropdownMenuTrigger', () => {
    it('renders without crashing', () => {
      render(
        <DropdownMenu>
          <DropdownMenuTrigger>Open menu</DropdownMenuTrigger>
        </DropdownMenu>
      );
    });

    it('renders children correctly', () => {
      render(
        <DropdownMenu>
          <DropdownMenuTrigger>Menu trigger</DropdownMenuTrigger>
        </DropdownMenu>
      );

      const trigger = screen.getByTestId('dropdown-trigger');
      expect(trigger).toBeInTheDocument();
      expect(trigger).toHaveTextContent('Menu trigger');
    });

    it('renders as button element', () => {
      render(
        <DropdownMenu>
          <DropdownMenuTrigger>Trigger</DropdownMenuTrigger>
        </DropdownMenu>
      );

      const trigger = screen.getByTestId('dropdown-trigger');
      expect(trigger.tagName).toBe('BUTTON');
    });

    it('passes through additional props', () => {
      render(
        <DropdownMenu>
          <DropdownMenuTrigger aria-label="Menu" disabled>
            Trigger
          </DropdownMenuTrigger>
        </DropdownMenu>
      );

      const trigger = screen.getByTestId('dropdown-trigger');
      expect(trigger).toHaveAttribute('aria-label', 'Menu');
      expect(trigger).toBeDisabled();
    });
  });

  describe('DropdownMenuContent', () => {
    it('renders without crashing', () => {
      render(
        <DropdownMenu open>
          <DropdownMenuTrigger>Trigger</DropdownMenuTrigger>
          <DropdownMenuContent>Content</DropdownMenuContent>
        </DropdownMenu>
      );
    });

    it('renders portal wrapper', () => {
      render(
        <DropdownMenu open>
          <DropdownMenuTrigger>Trigger</DropdownMenuTrigger>
          <DropdownMenuContent>Content</DropdownMenuContent>
        </DropdownMenu>
      );

      expect(screen.getByTestId('dropdown-portal')).toBeInTheDocument();
      expect(screen.getByTestId('dropdown-content')).toBeInTheDocument();
    });

    it('renders children correctly', () => {
      render(
        <DropdownMenu open>
          <DropdownMenuTrigger>Trigger</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>Item 1</DropdownMenuItem>
            <DropdownMenuItem>Item 2</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );

      const content = screen.getByTestId('dropdown-content');
      expect(content).toBeInTheDocument();
      expect(screen.getByText('Item 1')).toBeInTheDocument();
      expect(screen.getByText('Item 2')).toBeInTheDocument();
    });

    it('applies default sideOffset', () => {
      render(
        <DropdownMenu open>
          <DropdownMenuTrigger>Trigger</DropdownMenuTrigger>
          <DropdownMenuContent>Content</DropdownMenuContent>
        </DropdownMenu>
      );

      const content = screen.getByTestId('dropdown-content');
      expect(content).toHaveAttribute('data-side-offset', '4');
    });

    it('applies custom sideOffset', () => {
      render(
        <DropdownMenu open>
          <DropdownMenuTrigger>Trigger</DropdownMenuTrigger>
          <DropdownMenuContent sideOffset={8}>Content</DropdownMenuContent>
        </DropdownMenu>
      );

      const content = screen.getByTestId('dropdown-content');
      expect(content).toHaveAttribute('data-side-offset', '8');
    });

    it('applies default classes', () => {
      render(
        <DropdownMenu open>
          <DropdownMenuTrigger>Trigger</DropdownMenuTrigger>
          <DropdownMenuContent>Content</DropdownMenuContent>
        </DropdownMenu>
      );

      const content = screen.getByTestId('dropdown-content');
      expect(content).toHaveClass('z-50', 'min-w-[8rem]', 'overflow-hidden', 'rounded-md', 'border', 'bg-popover', 'p-1');
    });

    it('applies custom className', () => {
      render(
        <DropdownMenu open>
          <DropdownMenuTrigger>Trigger</DropdownMenuTrigger>
          <DropdownMenuContent className="custom-content">Content</DropdownMenuContent>
        </DropdownMenu>
      );

      const content = screen.getByTestId('dropdown-content');
      expect(content).toHaveClass('custom-content');
    });

    it('forwards ref correctly', () => {
      const ref = { current: null };
      render(
        <DropdownMenu open>
          <DropdownMenuTrigger>Trigger</DropdownMenuTrigger>
          <DropdownMenuContent ref={ref}>Content</DropdownMenuContent>
        </DropdownMenu>
      );

      expect(ref.current).toBeDefined();
    });
  });

  describe('DropdownMenuItem', () => {
    it('renders without crashing', () => {
      render(
        <DropdownMenu open>
          <DropdownMenuTrigger>Trigger</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>Menu item</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    });

    it('renders children correctly', () => {
      render(
        <DropdownMenu open>
          <DropdownMenuTrigger>Trigger</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>Menu item</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );

      const item = screen.getByTestId('dropdown-item');
      expect(item).toBeInTheDocument();
      expect(item).toHaveTextContent('Menu item');
    });

    it('applies default classes', () => {
      render(
        <DropdownMenu open>
          <DropdownMenuTrigger>Trigger</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>Item</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );

      const item = screen.getByTestId('dropdown-item');
      expect(item).toHaveClass('relative', 'flex', 'cursor-default', 'select-none', 'items-center', 'rounded-sm', 'px-2', 'py-1.5', 'text-sm');
    });

    it('applies custom className', () => {
      render(
        <DropdownMenu open>
          <DropdownMenuTrigger>Trigger</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem className="custom-item">Item</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );

      const item = screen.getByTestId('dropdown-item');
      expect(item).toHaveClass('custom-item');
    });

    it('applies inset styling when inset prop is true', () => {
      render(
        <DropdownMenu open>
          <DropdownMenuTrigger>Trigger</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem inset>Inset item</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );

      const item = screen.getByTestId('dropdown-item');
      expect(item).toHaveAttribute('data-inset', 'true');
    });

    it('passes through additional props', () => {
      render(
        <DropdownMenu open>
          <DropdownMenuTrigger>Trigger</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem disabled data-value="item1">
              Disabled item
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );

      const item = screen.getByTestId('dropdown-item');
      expect(item).toHaveAttribute('data-value', 'item1');
      expect(item).toBeDisabled();
    });

    it('forwards ref correctly', () => {
      const ref = { current: null };
      render(
        <DropdownMenu open>
          <DropdownMenuTrigger>Trigger</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem ref={ref}>Item</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );

      expect(ref.current).toBeDefined();
    });
  });

  describe('DropdownMenuSeparator', () => {
    it('renders without crashing', () => {
      render(
        <DropdownMenu open>
          <DropdownMenuTrigger>Trigger</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>Item 1</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Item 2</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    });

    it('renders as hr element', () => {
      render(
        <DropdownMenu open>
          <DropdownMenuTrigger>Trigger</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuSeparator />
          </DropdownMenuContent>
        </DropdownMenu>
      );

      const separator = screen.getByTestId('dropdown-separator');
      expect(separator.tagName).toBe('HR');
    });

    it('applies default classes', () => {
      render(
        <DropdownMenu open>
          <DropdownMenuTrigger>Trigger</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuSeparator />
          </DropdownMenuContent>
        </DropdownMenu>
      );

      const separator = screen.getByTestId('dropdown-separator');
      expect(separator).toHaveClass('mx-1', 'my-1', 'h-px', 'bg-muted');
    });

    it('applies custom className', () => {
      render(
        <DropdownMenu open>
          <DropdownMenuTrigger>Trigger</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuSeparator className="custom-separator" />
          </DropdownMenuContent>
        </DropdownMenu>
      );

      const separator = screen.getByTestId('dropdown-separator');
      expect(separator).toHaveClass('custom-separator');
    });

    it('forwards ref correctly', () => {
      const ref = { current: null };
      render(
        <DropdownMenu open>
          <DropdownMenuTrigger>Trigger</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuSeparator ref={ref} />
          </DropdownMenuContent>
        </DropdownMenu>
      );

      expect(ref.current).toBeDefined();
    });
  });

  describe('combined components', () => {
    it('renders complete dropdown menu structure', () => {
      render(
        <DropdownMenu>
          <DropdownMenuTrigger>Open menu</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>Profile</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Settings</DropdownMenuItem>
            <DropdownMenuItem inset>Nested item</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Logout</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );

      expect(screen.getByTestId('dropdown-root')).toBeInTheDocument();
      expect(screen.getByTestId('dropdown-trigger')).toBeInTheDocument();
      expect(screen.getByTestId('dropdown-trigger')).toHaveTextContent('Open menu');
      expect(screen.getByText('Profile')).toBeInTheDocument();
      expect(screen.getByText('Settings')).toBeInTheDocument();
      expect(screen.getByText('Nested item')).toBeInTheDocument();
      expect(screen.getByText('Logout')).toBeInTheDocument();
      expect(screen.getAllByTestId('dropdown-separator')).toHaveLength(2);
    });

    it('handles multiple dropdown menus', () => {
      render(
        <div>
          <DropdownMenu>
            <DropdownMenuTrigger>Menu 1</DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem>Item 1</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger>Menu 2</DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem>Item 2</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      );

      const triggers = screen.getAllByTestId('dropdown-trigger');
      expect(triggers).toHaveLength(2);
      expect(triggers[0]).toHaveTextContent('Menu 1');
      expect(triggers[1]).toHaveTextContent('Menu 2');
      expect(screen.getByText('Item 1')).toBeInTheDocument();
      expect(screen.getByText('Item 2')).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('has proper button role for trigger', () => {
      render(
        <DropdownMenu>
          <DropdownMenuTrigger>Menu</DropdownMenuTrigger>
        </DropdownMenu>
      );

      const trigger = screen.getByTestId('dropdown-trigger');
      expect(trigger.tagName).toBe('BUTTON');
    });

    it('maintains semantic structure', () => {
      render(
        <DropdownMenu open>
          <DropdownMenuTrigger>Menu</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>Item 1</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Item 2</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );

      expect(screen.getByTestId('dropdown-root')).toBeInTheDocument();
      expect(screen.getByTestId('dropdown-content')).toBeInTheDocument();
      expect(screen.getAllByTestId('dropdown-item')).toHaveLength(2);
      expect(screen.getByTestId('dropdown-separator')).toBeInTheDocument();
    });
  });

  describe('props handling', () => {
    it('passes through data attributes', () => {
      render(
        <DropdownMenu>
          <DropdownMenuTrigger data-testid="custom-trigger">Menu</DropdownMenuTrigger>
          <DropdownMenuContent data-testid="custom-content">
            <DropdownMenuItem data-testid="custom-item">Item</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );

      expect(screen.getByTestId('custom-trigger')).toBeInTheDocument();
      expect(screen.getByTestId('custom-content')).toBeInTheDocument();
      expect(screen.getByTestId('custom-item')).toBeInTheDocument();
    });

    it('handles complex children', () => {
      render(
        <DropdownMenu open>
          <DropdownMenuTrigger>Menu</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>
              <span>Icon</span>
              <span>Text</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );

      expect(screen.getByText('Icon')).toBeInTheDocument();
      expect(screen.getByText('Text')).toBeInTheDocument();
    });
  });

  describe('styling', () => {
    it('maintains consistent base classes for content', () => {
      render(
        <DropdownMenu open>
          <DropdownMenuTrigger>Menu</DropdownMenuTrigger>
          <DropdownMenuContent>Content</DropdownMenuContent>
        </DropdownMenu>
      );

      const content = screen.getByTestId('dropdown-content');
      expect(content).toHaveClass('z-50', 'min-w-[8rem]', 'overflow-hidden', 'rounded-md', 'border', 'bg-popover', 'p-1', 'text-popover-foreground', 'shadow-md');
    });

    it('maintains consistent base classes for items', () => {
      render(
        <DropdownMenu open>
          <DropdownMenuTrigger>Menu</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>Item</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );

      const item = screen.getByTestId('dropdown-item');
      expect(item).toHaveClass('relative', 'flex', 'cursor-default', 'select-none', 'items-center', 'rounded-sm', 'px-2', 'py-1.5', 'text-sm', 'outline-none', 'transition-colors');
    });

    it('combines custom classes with base classes', () => {
      render(
        <DropdownMenu open>
          <DropdownMenuTrigger>Menu</DropdownMenuTrigger>
          <DropdownMenuContent className="custom-content">
            <DropdownMenuItem className="custom-item">Item</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );

      const content = screen.getByTestId('dropdown-content');
      const item = screen.getByTestId('dropdown-item');
      
      expect(content).toHaveClass('z-50', 'min-w-[8rem]');
      expect(content).toHaveClass('custom-content');
      
      expect(item).toHaveClass('relative', 'flex');
      expect(item).toHaveClass('custom-item');
    });
  });
});
