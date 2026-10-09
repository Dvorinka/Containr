import { describe, expect, it } from 'vitest';
import {
  emptyFilterState,
  FilterEngine,
  type FilterConfig,
} from '@/lib/dynamic-filter';

interface Row {
  status: string;
  name: string;
  labels: string[];
  createdAt: string;
}

const ROWS: Row[] = [
  { status: 'success', name: 'web-api', labels: ['prod'], createdAt: new Date().toISOString() },
  { status: 'failed', name: 'worker', labels: [], createdAt: '2020-01-01T00:00:00Z' },
  { status: 'running', name: 'web-admin', labels: ['prod', 'canary'], createdAt: '2020-06-01T00:00:00Z' },
];

const SCHEMA: FilterConfig<Row>[] = [
  { key: 'q', label: 'Search', type: 'search', searchFields: ['name'] },
  { key: 'status', label: 'Status', type: 'select' },
  { key: 'labels', label: 'Labels', type: 'multiselect' },
  { key: 'createdAt', label: 'Time', type: 'date-range' },
];

const f = (over: Partial<Record<string, unknown>>) => ({
  ...emptyFilterState(SCHEMA),
  ...over,
});

describe('FilterEngine', () => {
  it('passes everything on an empty filter state', () => {
    expect(new FilterEngine(ROWS, SCHEMA).apply(f({}))).toHaveLength(3);
  });

  it('searches across configured fields case-insensitively', () => {
    const engine = new FilterEngine(ROWS, SCHEMA);
    expect(engine.apply(f({ q: 'WEB' })).map((r) => r.name)).toEqual(['web-api', 'web-admin']);
    expect(engine.apply(f({ q: 'worker' }))).toHaveLength(1);
  });

  it('select matches exactly and "all" is a no-op', () => {
    const engine = new FilterEngine(ROWS, SCHEMA);
    expect(engine.apply(f({ status: 'failed' }))).toHaveLength(1);
    expect(engine.apply(f({ status: 'all' }))).toHaveLength(3);
  });

  it('multiselect intersects array values', () => {
    const engine = new FilterEngine(ROWS, SCHEMA);
    expect(engine.apply(f({ labels: ['canary'] })).map((r) => r.name)).toEqual(['web-admin']);
  });

  it('date-range bounds by preset', () => {
    const engine = new FilterEngine(ROWS, SCHEMA);
    expect(engine.apply(f({ createdAt: 'today' })).map((r) => r.name)).toEqual(['web-api']);
    expect(engine.apply(f({ createdAt: 'all' }))).toHaveLength(3);
  });

  it('combines filters conjunctively', () => {
    const engine = new FilterEngine(ROWS, SCHEMA);
    expect(engine.apply(f({ q: 'web', status: 'running' })).map((r) => r.name)).toEqual(['web-admin']);
  });

  it('derives options with counts from data', () => {
    const opts = new FilterEngine(ROWS, SCHEMA).options().find((c) => c.key === 'status');
    expect(opts?.options?.find((o) => o.value === 'success')?.count).toBe(1);
    expect(opts?.options?.map((o) => o.value).sort()).toEqual(['failed', 'running', 'success']);
  });

  it('counts active filters and lists them with raw + display values', () => {
    const engine = new FilterEngine(ROWS, SCHEMA);
    const state = f({ status: 'failed', q: 'w' });
    expect(engine.activeCount(state)).toBe(2);
    const active = engine.active(state);
    expect(active.find((a) => a.key === 'status')).toMatchObject({ value: 'failed', displayValue: 'Failed' });
    expect(active.find((a) => a.key === 'q')).toMatchObject({ displayValue: 'w' });
  });
});
