import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ScrollArea, ScrollBar } from './scroll-area';

describe('ScrollArea', () => {
  it('renders scroll area with children', () => {
    render(
      <ScrollArea>
        <div>Content</div>
      </ScrollArea>
    );

    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('renders with custom className', () => {
    const { container } = render(
      <ScrollArea className="custom-class">
        <div>Content</div>
      </ScrollArea>
    );

    const scrollArea = container.querySelector('.custom-class');
    expect(scrollArea).toBeInTheDocument();
  });

  it('renders multiple children', () => {
    render(
      <ScrollArea>
        <div>Item 1</div>
        <div>Item 2</div>
        <div>Item 3</div>
      </ScrollArea>
    );

    expect(screen.getByText('Item 1')).toBeInTheDocument();
    expect(screen.getByText('Item 2')).toBeInTheDocument();
    expect(screen.getByText('Item 3')).toBeInTheDocument();
  });
});

describe('ScrollBar', () => {
  it('renders with ScrollArea', () => {
    const { container } = render(
      <ScrollArea>
        <div>Content</div>
        <ScrollBar />
      </ScrollArea>
    );

    expect(container.firstChild).toBeInTheDocument();
  });

  it('renders horizontal scrollbar', () => {
    const { container } = render(
      <ScrollArea>
        <div>Content</div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    );

    expect(container.firstChild).toBeInTheDocument();
  });
});
