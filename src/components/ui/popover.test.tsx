import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Popover, PopoverTrigger, PopoverContent } from './popover';

describe('Popover', () => {
  it('renders popover trigger', () => {
    render(
      <Popover>
        <PopoverTrigger>Open Popover</PopoverTrigger>
        <PopoverContent>Popover Content</PopoverContent>
      </Popover>
    );

    expect(screen.getByText('Open Popover')).toBeInTheDocument();
  });

  it('shows popover content when trigger is clicked', async () => {
    render(
      <Popover>
        <PopoverTrigger>Open Popover</PopoverTrigger>
        <PopoverContent>Popover Content</PopoverContent>
      </Popover>
    );

    const trigger = screen.getByText('Open Popover');
    await userEvent.click(trigger);

    expect(screen.getByText('Popover Content')).toBeInTheDocument();
  });

  it('hides popover content initially', () => {
    render(
      <Popover>
        <PopoverTrigger>Open Popover</PopoverTrigger>
        <PopoverContent>Popover Content</PopoverContent>
      </Popover>
    );

    expect(screen.queryByText('Popover Content')).not.toBeInTheDocument();
  });

  it('closes popover when clicking outside', async () => {
    render(
      <div>
        <Popover>
          <PopoverTrigger>Open Popover</PopoverTrigger>
          <PopoverContent>Popover Content</PopoverContent>
        </Popover>
        <div>Outside</div>
      </div>
    );

    const trigger = screen.getByText('Open Popover');
    await userEvent.click(trigger);

    expect(screen.getByText('Popover Content')).toBeInTheDocument();

    await userEvent.click(screen.getByText('Outside'));

    expect(screen.queryByText('Popover Content')).not.toBeInTheDocument();
  });

  it('renders popover with default open state', () => {
    render(
      <Popover defaultOpen>
        <PopoverTrigger>Open Popover</PopoverTrigger>
        <PopoverContent>Popover Content</PopoverContent>
      </Popover>
    );

    expect(screen.getByText('Popover Content')).toBeInTheDocument();
  });
});
