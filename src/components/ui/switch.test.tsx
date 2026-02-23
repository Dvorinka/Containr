import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Switch } from './switch';

describe('Switch', () => {
  it('renders a switch', () => {
    render(<Switch />);
    expect(screen.getByRole('switch')).toBeInTheDocument();
  });

  it('can be checked', async () => {
    const user = userEvent.setup();
    render(<Switch />);
    const switchEl = screen.getByRole('switch');
    
    await user.click(switchEl);
    expect(switchEl).toBeChecked();
  });

  it('can be unchecked', async () => {
    const user = userEvent.setup();
    render(<Switch defaultChecked />);
    const switchEl = screen.getByRole('switch');
    
    await user.click(switchEl);
    expect(switchEl).not.toBeChecked();
  });

  it('respects defaultChecked prop', () => {
    render(<Switch defaultChecked />);
    expect(screen.getByRole('switch')).toBeChecked();
  });

  it('respects checked prop in controlled mode', () => {
    render(<Switch checked onCheckedChange={() => {}} />);
    expect(screen.getByRole('switch')).toBeChecked();
  });

  it('respects disabled prop', () => {
    render(<Switch disabled />);
    expect(screen.getByRole('switch')).toBeDisabled();
  });

  it('applies custom className', () => {
    render(<Switch className="custom-class" />);
    expect(screen.getByRole('switch')).toHaveClass('custom-class');
  });

  it('calls onCheckedChange when toggled', async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    render(<Switch onCheckedChange={onCheckedChange} />);
    
    await user.click(screen.getByRole('switch'));
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it('renders with id', () => {
    render(<Switch id="test-switch" />);
    expect(screen.getByRole('switch')).toHaveAttribute('id', 'test-switch');
  });
});
