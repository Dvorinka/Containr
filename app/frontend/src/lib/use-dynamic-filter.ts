import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  emptyFilterState,
  emptyValueFor,
  FilterEngine,
  type FilterConfig,
  type FilterState,
} from '@/lib/dynamic-filter';

// Filter state lives in `?f.<key>=...` search params — filtered views are
// shareable links. Arrays join with commas.

function stateFromParams<T>(schema: FilterConfig<T>[], params: URLSearchParams): FilterState {
  const state = emptyFilterState(schema);
  for (const c of schema) {
    const raw = params.get(`f.${c.key}`);
    if (raw == null) continue;
    switch (c.type) {
      case 'multiselect':
      case 'boolean':
      case 'status':
        state[c.key] = raw.split(',').filter(Boolean);
        break;
      default:
        state[c.key] = raw;
    }
  }
  return state;
}

function stateToParams<T>(schema: FilterConfig<T>[], state: FilterState): URLSearchParams {
  const params = new URLSearchParams();
  const empty = emptyFilterState(schema);
  for (const c of schema) {
    const v = state[c.key];
    if (v == null || v === '' || v === 'all') continue;
    if (Array.isArray(v) && v.length === 0) continue;
    if (JSON.stringify(v) === JSON.stringify(empty[c.key])) continue;
    params.set(`f.${c.key}`, Array.isArray(v) ? v.join(',') : String(v));
  }
  return params;
}

/** URL-backed filter state — usable before any data is fetched. */
export function useFilterState<T>(schema: FilterConfig<T>[]) {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(() => stateFromParams(schema, searchParams), [schema, searchParams]);

  const setFilters = useCallback(
    (updater: (prev: FilterState) => FilterState) => {
      const next = updater(filters);
      setSearchParams((prev) => {
        const merged = new URLSearchParams(prev);
        for (const key of [...merged.keys()]) {
          if (key.startsWith('f.')) merged.delete(key);
        }
        stateToParams(schema, next).forEach((v, k) => merged.set(k, v));
        return merged;
      }, { replace: true });
    },
    [filters, schema, setSearchParams],
  );

  const updateFilter = useCallback(
    (key: string, value: unknown) => setFilters((prev) => ({ ...prev, [key]: value })),
    [setFilters],
  );
  const clearAll = useCallback(
    () => setFilters(() => emptyFilterState(schema)),
    [setFilters, schema],
  );
  const removeFilter = useCallback(
    (key: string, rawValue?: string) =>
      setFilters((prev) => {
        const v = prev[key];
        if (Array.isArray(v) && rawValue !== undefined) {
          return { ...prev, [key]: v.filter((x) => String(x) !== rawValue) };
        }
        const config = schema.find((c) => c.key === key);
        return config ? { ...prev, [key]: emptyValueFor(config.type) } : prev;
      }),
    [setFilters, schema],
  );

  return { filters, updateFilter, removeFilter, clearAll };
}

/** Full client-side filter: URL state + engine over `data`. */
export function useDynamicFilter<T>({ data, schema }: { data: T[]; schema: FilterConfig<T>[] }) {
  const state = useFilterState(schema);
  const engine = useMemo(() => new FilterEngine(data, schema), [data, schema]);

  return {
    filteredData: useMemo(() => engine.apply(state.filters), [engine, state.filters]),
    filters: state.filters,
    schema: useMemo(() => engine.options(), [engine]),
    activeCount: useMemo(() => engine.activeCount(state.filters), [engine, state.filters]),
    active: useMemo(() => engine.active(state.filters), [engine, state.filters]),
    updateFilter: state.updateFilter,
    removeFilter: state.removeFilter,
    clearAll: state.clearAll,
  };
}
