// Dynamic filter framework — typed filter configs → client-side filtering
// with optional URL-state sync. Port of dflow's filter.utils pattern,
// adapted to Containr (no external date lib, searchParams-driven).
//
// A page declares a FilterConfig<T>[] schema, passes fetched data +
// schema to useDynamicFilter(), and renders <FilterBar/>. Filter state
// lives in the URL when `urlSync` is on, so filtered views are
// shareable links.

export type FilterType =
  | 'search'
  | 'select'
  | 'multiselect'
  | 'boolean'
  | 'date-range'
  | 'status';

export interface FilterOption {
  value: string;
  label: string;
  count?: number;
}

export interface FilterConfig<T> {
  key: string;
  label: string;
  type: FilterType;
  options?: FilterOption[];
  /** fields searched by type 'search' (defaults to [key]) */
  searchFields?: (keyof T & string)[];
  /** custom value accessor (defaults to item[key]) */
  accessor?: (item: T) => unknown;
}

export type FilterState = Record<string, unknown>;

const EMPTY: Record<FilterType, unknown> = {
  search: '',
  select: 'all',
  multiselect: [],
  boolean: [],
  'date-range': 'all',
  status: [],
};

export function emptyValueFor(type: FilterType): unknown {
  return structuredClone(EMPTY[type]);
}

export function emptyFilterState<T>(schema: FilterConfig<T>[]): FilterState {
  const state: FilterState = {};
  for (const c of schema) state[c.key] = structuredClone(EMPTY[c.type]);
  return state;
}

function accessorOf<T>(config: FilterConfig<T>): (item: T) => unknown {
  if (config.accessor) return config.accessor;
  return (item) => (item as Record<string, unknown>)[config.key];
}

export class FilterEngine<T> {
  constructor(
    private data: T[],
    private schema: FilterConfig<T>[],
  ) {}

  /** Fill in option lists (with counts) for configs that didn't declare them. */
  options(): FilterConfig<T>[] {
    return this.schema.map((config) => {
      if (config.options?.length) return config;
      const counts = new Map<string, number>();
      for (const item of this.data) {
        const v = accessorOf(config)(item);
        for (const each of Array.isArray(v) ? v : [v]) {
          if (each != null && each !== '') {
            const key = String(each);
            counts.set(key, (counts.get(key) ?? 0) + 1);
          }
        }
      }
      const options = [...counts.entries()]
        .map(([value, count]) => ({ value, label: formatLabel(value), count }))
        .sort((a, b) => b.count! - a.count!);
      return { ...config, options };
    });
  }

  apply(filters: FilterState): T[] {
    return this.data.filter((item) =>
      this.schema.every((config) => {
        const value = filters[config.key];
        if (value == null || value === '' || value === 'all') return true;
        if (Array.isArray(value) && value.length === 0) return true;
        return this.evaluate(item, config, value);
      }),
    );
  }

  private evaluate(item: T, config: FilterConfig<T>, value: unknown): boolean {
    const itemValue = accessorOf(config)(item);
    switch (config.type) {
      case 'search': {
        const term = String(value).toLowerCase();
        const fields = config.searchFields ?? [config.key as keyof T & string];
        return fields.some((f) =>
          String((item as Record<string, unknown>)[f] ?? '').toLowerCase().includes(term),
        );
      }
      case 'select':
        return String(itemValue) === String(value);
      case 'multiselect':
      case 'status': {
        const values = value as string[];
        if (Array.isArray(itemValue)) return itemValue.some((v) => values.includes(String(v)));
        return values.includes(String(itemValue));
      }
      case 'boolean': {
        const values = value as string[];
        return values.includes(String(Boolean(itemValue)));
      }
      case 'date-range':
        return dateInRange(itemValue, String(value));
      default:
        return true;
    }
  }

  activeCount(filters: FilterState): number {
    let n = 0;
    for (const c of this.schema) {
      const v = filters[c.key];
      if (v == null || v === '' || v === 'all') continue;
      n += Array.isArray(v) ? v.length : 1;
    }
    return n;
  }

  active(filters: FilterState): { key: string; label: string; value: string; displayValue: string }[] {
    const out: { key: string; label: string; value: string; displayValue: string }[] = [];
    const opts = this.options();
    for (const c of this.schema) {
      const v = filters[c.key];
      if (v == null || v === '' || v === 'all') continue;
      const optFor = (raw: unknown) => {
        if (c.type === 'search') return String(raw);
        if (c.type === 'date-range') {
          return DATE_RANGE_OPTIONS.find((o) => o.value === raw)?.label ?? String(raw);
        }
        return (
          opts.find((o) => o.key === c.key)?.options?.find((o) => o.value === raw)?.label ??
          formatLabel(String(raw))
        );
      };
      if (Array.isArray(v)) {
        for (const each of v) {
          out.push({ key: c.key, label: c.label, value: String(each), displayValue: optFor(each) });
        }
      } else {
        out.push({ key: c.key, label: c.label, value: String(v), displayValue: optFor(v) });
      }
    }
    return out;
  }
}

function formatLabel(value: string): string {
  if (value === 'true') return 'Yes';
  if (value === 'false') return 'No';
  return value.charAt(0).toUpperCase() + value.slice(1).replace(/[_-]/g, ' ');
}

function dateInRange(itemValue: unknown, range: string): boolean {
  if (!itemValue || range === 'all') return true;
  const date = new Date(String(itemValue));
  if (Number.isNaN(date.getTime())) return false;
  const now = new Date();
  let boundary: Date;
  switch (range) {
    case 'today':
      boundary = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case 'week': {
      const day = (now.getDay() + 6) % 7; // monday start
      boundary = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day);
      break;
    }
    case 'month':
      boundary = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case '30d':
      boundary = new Date(now.getTime() - 30 * 86400000);
      break;
    default:
      return true;
  }
  return date >= boundary;
}

export const DATE_RANGE_OPTIONS: FilterOption[] = [
  { value: 'all', label: 'All time' },
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' },
  { value: '30d', label: 'Last 30 days' },
];
