import { describe, expect, it } from 'vitest';
import { parseDotenv, validateVariableRows } from './variable-utils';

describe('parseDotenv', () => {
  it('parses KEY=VAL lines and skips blanks/comments', () => {
    const rows = parseDotenv('A=1\n\n# comment\nB=two\n');
    expect(rows).toEqual([
      { key: 'A', value: '1', isSecret: false },
      { key: 'B', value: 'two', isSecret: false },
    ]);
  });

  it('strips export prefix and quotes, keeps = inside values', () => {
    const rows = parseDotenv('export A="x=y"\nB=\' spaced \'\nC=plain\n');
    expect(rows.map((r) => [r.key, r.value])).toEqual([
      ['A', 'x=y'],
      ['B', ' spaced '],
      ['C', 'plain'],
    ]);
  });

  it('ignores malformed lines without a key', () => {
    expect(parseDotenv('=novalue\njusttext\n')).toEqual([]);
  });
});

describe('validateVariableRows', () => {
  it('flags empty, invalid, and duplicate keys', () => {
    const errors = validateVariableRows([
      { key: 'OK', value: '1', isSecret: false },
      { key: '', value: 'x', isSecret: false },
      { key: '9BAD', value: 'x', isSecret: false },
      { key: 'OK', value: '2', isSecret: false },
    ]);
    expect(errors[0]).toBeUndefined();
    expect(errors[1]).toBe('Key is required');
    expect(errors[2]).toContain('Letters, digits');
    expect(errors[3]).toBe('Duplicate key');
  });
});
