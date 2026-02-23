import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Textarea } from './textarea';

describe('Textarea', () => {
  it('renders a textarea', () => {
    render(<Textarea />);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('renders with placeholder', () => {
    render(<Textarea placeholder="Enter text" />);
    expect(screen.getByPlaceholderText('Enter text')).toBeInTheDocument();
  });

  it('renders with default value', () => {
    render(<Textarea defaultValue="Initial text" />);
    expect(screen.getByRole('textbox')).toHaveValue('Initial text');
  });

  it('can be disabled', () => {
    render(<Textarea disabled />);
    expect(screen.getByRole('textbox')).toBeDisabled();
  });

  it('applies custom className', () => {
    render(<Textarea className="custom-class" />);
    expect(screen.getByRole('textbox')).toHaveClass('custom-class');
  });

  it('handles user input', async () => {
    const user = userEvent.setup();
    render(<Textarea />);
    const textarea = screen.getByRole('textbox');
    
    await user.type(textarea, 'Hello World');
    expect(textarea).toHaveValue('Hello World');
  });

  it('calls onChange handler', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Textarea onChange={onChange} />);
    
    await user.type(screen.getByRole('textbox'), 'Test');
    expect(onChange).toHaveBeenCalled();
  });

  it('respects rows attribute', () => {
    render(<Textarea rows={5} />);
    expect(screen.getByRole('textbox')).toHaveAttribute('rows', '5');
  });

  it('respects cols attribute', () => {
    render(<Textarea cols={40} />);
    expect(screen.getByRole('textbox')).toHaveAttribute('cols', '40');
  });

  it('renders with id', () => {
    render(<Textarea id="description" />);
    expect(screen.getByRole('textbox')).toHaveAttribute('id', 'description');
  });

  it('renders with name', () => {
    render(<Textarea name="comment" />);
    expect(screen.getByRole('textbox')).toHaveAttribute('name', 'comment');
  });
});
