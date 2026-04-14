import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from './card';

describe('Card', () => {
  describe('rendering', () => {
    it('renders children correctly', () => {
      render(<Card data-testid="card">Card Content</Card>);
      expect(screen.getByTestId('card')).toHaveTextContent('Card Content');
    });

    it('renders as a div element', () => {
      render(<Card data-testid="card">Card</Card>);
      const card = screen.getByTestId('card');
      expect(card.tagName).toBe('DIV');
    });

    it('applies default card classes', () => {
      render(<Card data-testid="card">Card</Card>);
      const card = screen.getByTestId('card');
      expect(card).toHaveClass('rounded-xl');
      expect(card).toHaveClass('border');
      expect(card).toHaveClass('bg-card');
    });
  });

  describe('custom className', () => {
    it('merges custom className with default classes', () => {
      render(<Card className="custom-class" data-testid="card">Custom</Card>);
      const card = screen.getByTestId('card');
      expect(card).toHaveClass('rounded-xl');
      expect(card).toHaveClass('custom-class');
    });
  });

  describe('ref forwarding', () => {
    it('forwards ref correctly', () => {
      const ref = { current: null as HTMLDivElement | null };
      render(<Card ref={ref}>Ref Test</Card>);
      expect(ref.current).toBeInstanceOf(HTMLDivElement);
    });
  });
});

describe('CardHeader', () => {
  it('renders children correctly', () => {
    render(<CardHeader data-testid="header">Header Content</CardHeader>);
    expect(screen.getByTestId('header')).toHaveTextContent('Header Content');
  });

  it('applies default classes', () => {
    render(<CardHeader data-testid="header">Header</CardHeader>);
    const header = screen.getByTestId('header');
    expect(header).toHaveClass('flex');
    expect(header).toHaveClass('flex-col');
    expect(header).toHaveClass('p-6');
  });

  it('renders as a div element', () => {
    render(<CardHeader data-testid="header">Header</CardHeader>);
    expect(screen.getByTestId('header').tagName).toBe('DIV');
  });
});

describe('CardTitle', () => {
  it('renders children correctly', () => {
    render(<CardTitle>Card Title</CardTitle>);
    expect(screen.getByText('Card Title')).toBeInTheDocument();
  });

  it('renders as an h3 element', () => {
    render(<CardTitle data-testid="title">Title</CardTitle>);
    expect(screen.getByTestId('title').tagName).toBe('H3');
  });

  it('applies default classes', () => {
    render(<CardTitle data-testid="title">Title</CardTitle>);
    const title = screen.getByTestId('title');
    expect(title).toHaveClass('text-lg');
    expect(title).toHaveClass('font-semibold');
  });
});

describe('CardDescription', () => {
  it('renders children correctly', () => {
    render(<CardDescription>Card Description</CardDescription>);
    expect(screen.getByText('Card Description')).toBeInTheDocument();
  });

  it('renders as a p element', () => {
    render(<CardDescription data-testid="desc">Description</CardDescription>);
    expect(screen.getByTestId('desc').tagName).toBe('P');
  });

  it('applies default classes', () => {
    render(<CardDescription data-testid="desc">Description</CardDescription>);
    const desc = screen.getByTestId('desc');
    expect(desc).toHaveClass('text-sm');
    expect(desc).toHaveClass('text-muted-foreground');
  });
});

describe('CardContent', () => {
  it('renders children correctly', () => {
    render(<CardContent data-testid="content">Content</CardContent>);
    expect(screen.getByTestId('content')).toHaveTextContent('Content');
  });

  it('renders as a div element', () => {
    render(<CardContent data-testid="content">Content</CardContent>);
    expect(screen.getByTestId('content').tagName).toBe('DIV');
  });

  it('applies default classes', () => {
    render(<CardContent data-testid="content">Content</CardContent>);
    const content = screen.getByTestId('content');
    expect(content).toHaveClass('p-6');
    expect(content).toHaveClass('pt-0');
  });
});

describe('CardFooter', () => {
  it('renders children correctly', () => {
    render(<CardFooter data-testid="footer">Footer</CardFooter>);
    expect(screen.getByTestId('footer')).toHaveTextContent('Footer');
  });

  it('renders as a div element', () => {
    render(<CardFooter data-testid="footer">Footer</CardFooter>);
    expect(screen.getByTestId('footer').tagName).toBe('DIV');
  });

  it('applies default classes', () => {
    render(<CardFooter data-testid="footer">Footer</CardFooter>);
    const footer = screen.getByTestId('footer');
    expect(footer).toHaveClass('flex');
    expect(footer).toHaveClass('items-center');
    expect(footer).toHaveClass('p-6');
  });
});

describe('Card composition', () => {
  it('renders a complete card with all parts', () => {
    render(
      <Card data-testid="card">
        <CardHeader>
          <CardTitle>Test Title</CardTitle>
          <CardDescription>Test Description</CardDescription>
        </CardHeader>
        <CardContent>Test Content</CardContent>
        <CardFooter>Test Footer</CardFooter>
      </Card>
    );

    const card = screen.getByTestId('card');
    expect(card).toHaveTextContent('Test Title');
    expect(card).toHaveTextContent('Test Description');
    expect(card).toHaveTextContent('Test Content');
    expect(card).toHaveTextContent('Test Footer');
  });
});
