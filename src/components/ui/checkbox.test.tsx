import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Checkbox } from './checkbox';

describe('Checkbox', () => {
  it('renders checkbox', () => {
    render(<Checkbox />);

    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toBeInTheDocument();
  });

  it('can be checked', async () => {
    render(<Checkbox />);

    const checkbox = screen.getByRole('checkbox');
    await userEvent.click(checkbox);

    expect(checkbox).toBeChecked();
  });

  it('can be unchecked after being checked', async () => {
    render(<Checkbox />);

    const checkbox = screen.getByRole('checkbox');
    await userEvent.click(checkbox);
    expect(checkbox).toBeChecked();

    await userEvent.click(checkbox);
    expect(checkbox).not.toBeChecked();
  });

  it('renders as checked when defaultChecked is true', () => {
    render(<Checkbox defaultChecked />);

    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toBeChecked();
  });

  it('renders as disabled when disabled prop is true', () => {
    render(<Checkbox disabled />);

    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toBeDisabled();
  });

  it('does not toggle when disabled', async () => {
    render(<Checkbox disabled />);

    const checkbox = screen.getByRole('checkbox');
    await userEvent.click(checkbox);

    expect(checkbox).not.toBeChecked();
  });

  it('accepts custom className', () => {
    const { container } = render(<Checkbox className="custom-class" />);

    const checkbox = container.querySelector('.custom-class');
    expect(checkbox).toBeInTheDocument();
  });

  it('has correct default classes', () => {
    const { container } = render(<Checkbox />);

    const checkbox = container.querySelector('[role="checkbox"]');
    expect(checkbox).toHaveClass('h-4');
    expect(checkbox).toHaveClass('w-4');
    expect(checkbox).toHaveClass('rounded-md');
  });

  it('shows check icon when checked', async () => {
    const { container } = render(<Checkbox />);

    const checkbox = screen.getByRole('checkbox');
    await userEvent.click(checkbox);

    const checkIcon = container.querySelector('svg');
    expect(checkIcon).toBeInTheDocument();
  });
});
