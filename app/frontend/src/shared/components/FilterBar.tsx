import { Search, X } from 'lucide-react';
import {
  DATE_RANGE_OPTIONS,
  type FilterConfig,
  type FilterState,
} from '@/lib/dynamic-filter';

const inputClass =
  'h-9 px-3 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)] transition-all';

// Dynamic filter bar — renders a FilterConfig schema as compact controls.
// State is owned by useDynamicFilter (URL-synced); this is a pure view.

export function FilterBar<T>({
  schema,
  filters,
  activeCount,
  active,
  updateFilter,
  removeFilter,
  clearAll,
}: {
  schema: FilterConfig<T>[];
  filters: FilterState;
  activeCount: number;
  active: { key: string; label: string; value: string; displayValue: string }[];
  updateFilter: (key: string, value: unknown) => void;
  removeFilter: (key: string, rawValue?: string) => void;
  clearAll: () => void;
}) {
  return (
    <div className="mb-5">
      <div className="flex flex-wrap items-end gap-3">
        {schema.map((config) => {
          const value = filters[config.key];
          switch (config.type) {
            case 'search':
              return (
                <div key={config.key} className="relative">
                  <Search
                    size={13}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
                  />
                  <input
                    value={String(value ?? '')}
                    onChange={(e) => updateFilter(config.key, e.target.value)}
                    placeholder={`Search ${config.label.toLowerCase()}…`}
                    className={`${inputClass} w-56 pl-8`}
                    aria-label={config.label}
                  />
                </div>
              );
            case 'select':
            case 'date-range': {
              const options =
                config.type === 'date-range'
                  ? DATE_RANGE_OPTIONS
                  : [{ value: 'all', label: `All ${config.label.toLowerCase()}` }, ...(config.options ?? [])];
              return (
                <select
                  key={config.key}
                  value={String(value ?? 'all')}
                  onChange={(e) => updateFilter(config.key, e.target.value)}
                  className={`${inputClass} w-40`}
                  aria-label={config.label}
                >
                  {options.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.count != null ? `${o.label} (${o.count})` : o.label}
                    </option>
                  ))}
                </select>
              );
            }
            case 'multiselect':
            case 'boolean':
            case 'status': {
              const selected = Array.isArray(value) ? (value as string[]) : [];
              const options =
                config.type === 'boolean'
                  ? [
                      { value: 'true', label: 'Yes' },
                      { value: 'false', label: 'No' },
                    ]
                  : (config.options ?? []);
              return (
                <div key={config.key} className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
                    {config.label}:
                  </span>
                  {options.map((o) => {
                    const on = selected.includes(o.value);
                    return (
                      <button
                        key={o.value}
                        onClick={() =>
                          updateFilter(
                            config.key,
                            on ? selected.filter((s) => s !== o.value) : [...selected, o.value],
                          )
                        }
                        className={`h-7 px-2.5 rounded-[var(--radius-sm)] text-xs font-medium border transition-colors ${
                          on
                            ? 'bg-[var(--accent-primary-soft)] border-[var(--accent-primary)]/40 text-[var(--accent-primary)]'
                            : 'border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--border-default)]'
                        }`}
                      >
                        {o.label}
                        {o.count != null && <span className="ml-1 opacity-60">{o.count}</span>}
                      </button>
                    );
                  })}
                </div>
              );
            }
            default:
              return null;
          }
        })}
        {activeCount > 0 && (
          <button
            onClick={clearAll}
            className="h-9 px-3 rounded-[var(--radius-md)] border border-[var(--border-subtle)] text-xs font-medium text-[var(--text-secondary)] hover:border-[var(--border-default)] transition-colors"
          >
            Clear ({activeCount})
          </button>
        )}
      </div>

      {active.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 mt-3">
          {active.map((a, i) => (
            <button
              key={`${a.key}-${a.value}-${i}`}
              onClick={() => removeFilter(a.key, a.value)}
              className="group inline-flex items-center gap-1.5 h-6 px-2 rounded-[var(--radius-sm)] bg-[var(--accent-primary-soft)] text-[11px] font-medium text-[var(--accent-primary)]"
            >
              <span className="opacity-70">{a.label}</span>
              {a.displayValue}
              <X size={11} className="opacity-50 group-hover:opacity-100" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
