import { describe, it, expect } from 'vitest';
import { cn } from './utils';

describe('utils', () => {
  describe('cn', () => {
    it('merges class names', () => {
      expect(cn('foo', 'bar')).toBe('foo bar');
    });

    it('handles conditional classes', () => {
      expect(cn('foo', false && 'bar', 'baz')).toBe('foo baz');
    });

    it('handles undefined values', () => {
      expect(cn('foo', undefined, 'bar')).toBe('foo bar');
    });

    it('handles null values', () => {
      expect(cn('foo', null, 'bar')).toBe('foo bar');
    });

    it('handles object notation', () => {
      expect(cn({ foo: true, bar: false })).toBe('foo');
    });

    it('handles array notation', () => {
      expect(cn(['foo', 'bar'])).toBe('foo bar');
    });

    it('merges tailwind classes correctly', () => {
      expect(cn('px-2 py-1', 'px-4')).toBe('py-1 px-4');
    });

    it('deduplicates conflicting tailwind classes', () => {
      expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500');
    });

    it('handles empty input', () => {
      expect(cn()).toBe('');
    });
  });
});
