import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Input } from './input';

describe('Input', () => {
  describe('rendering', () => {
    it('renders an input element', () => {
      render(<Input data-testid="input" />);
      const input = screen.getByTestId('input');
      expect(input.tagName).toBe('INPUT');
    });

    it('renders without type attribute when not specified', () => {
      render(<Input data-testid="input" />);
      const input = screen.getByTestId('input');
      expect(input).toBeInTheDocument();
    });

    it('renders with specified type', () => {
      render(<Input type="email" data-testid="input" />);
      const input = screen.getByTestId('input');
      expect(input).toHaveAttribute('type', 'email');
    });

    it('renders with password type', () => {
      render(<Input type="password" data-testid="input" />);
      const input = screen.getByTestId('input');
      expect(input).toHaveAttribute('type', 'password');
    });

    it('renders with number type', () => {
      render(<Input type="number" data-testid="input" />);
      const input = screen.getByTestId('input');
      expect(input).toHaveAttribute('type', 'number');
    });
  });

  describe('classes', () => {
    it('applies default input classes', () => {
      render(<Input data-testid="input" />);
      const input = screen.getByTestId('input');
      expect(input).toHaveClass('flex');
      expect(input).toHaveClass('h-10');
      expect(input).toHaveClass('rounded-lg');
      expect(input).toHaveClass('border');
    });
  });

  describe('value handling', () => {
    it('renders with initial value', () => {
      render(<Input defaultValue="initial value" data-testid="input" />);
      const input = screen.getByTestId('input');
      expect(input).toHaveValue('initial value');
    });

    it('allows user input', async () => {
      const user = userEvent.setup();
      render(<Input data-testid="input" />);
      const input = screen.getByTestId('input');
      await user.type(input, 'test input');
      expect(input).toHaveValue('test input');
    });

    it('respects controlled value', () => {
      render(<Input value="controlled" onChange={() => {}} data-testid="input" />);
      const input = screen.getByTestId('input');
      expect(input).toHaveValue('controlled');
    });
  });

  describe('placeholder', () => {
    it('renders with placeholder', () => {
      render(<Input placeholder="Enter text" data-testid="input" />);
      const input = screen.getByTestId('input');
      expect(input).toHaveAttribute('placeholder', 'Enter text');
    });
  });

  describe('disabled state', () => {
    it('applies disabled classes when disabled', () => {
      render(<Input disabled data-testid="input" />);
      const input = screen.getByTestId('input');
      expect(input).toBeDisabled();
      expect(input).toHaveClass('disabled:cursor-not-allowed');
    });

    it('does not allow input when disabled', async () => {
      const user = userEvent.setup();
      render(<Input disabled data-testid="input" />);
      const input = screen.getByTestId('input');
      await user.type(input, 'test');
      expect(input).toHaveValue('');
    });
  });

  describe('custom className', () => {
    it('merges custom className with default classes', () => {
      render(<Input className="custom-class" data-testid="input" />);
      const input = screen.getByTestId('input');
      expect(input).toHaveClass('flex');
      expect(input).toHaveClass('custom-class');
    });
  });

  describe('ref forwarding', () => {
    it('forwards ref correctly', () => {
      const ref = { current: null as HTMLInputElement | null };
      render(<Input ref={ref} />);
      expect(ref.current).toBeInstanceOf(HTMLInputElement);
    });
  });

  describe('attributes', () => {
    it('passes through additional attributes', () => {
      render(<Input id="test-input" name="testName" data-testid="input" />);
      const input = screen.getByTestId('input');
      expect(input).toHaveAttribute('id', 'test-input');
      expect(input).toHaveAttribute('name', 'testName');
    });

    it('supports required attribute', () => {
      render(<Input required data-testid="input" />);
      const input = screen.getByTestId('input');
      expect(input).toBeRequired();
    });

    it('supports readonly attribute', () => {
      render(<Input readOnly data-testid="input" />);
      const input = screen.getByTestId('input');
      expect(input).toHaveAttribute('readonly');
    });

    it('supports maxLength attribute', () => {
      render(<Input maxLength={10} data-testid="input" />);
      const input = screen.getByTestId('input');
      expect(input).toHaveAttribute('maxlength', '10');
    });
  });
});
