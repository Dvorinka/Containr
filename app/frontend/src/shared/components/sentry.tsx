import { useState, type ReactNode } from 'react';
import { ChevronDown, MoreHorizontal } from 'lucide-react';
import type { PillTone } from './sentry-utils';

export type { PillTone };

/* ============================================================
   Sentry kit — React bindings for the 23-sentry.html language.
   Every page composes these; no page invents its own chrome.
   ============================================================ */

export function Ibox({ children }: { children: ReactNode }) {
  return <span className="s-ibox">{children}</span>;
}

/* ---------- buttons ---------- */

type BtnProps = {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
  className?: string;
  type?: 'button' | 'submit';
};

export function GhostBtn({ children, onClick, disabled, title, className = '', type = 'button' }: BtnProps) {
  return (
    <button type={type} className={`s-btn-accent ${className}`} onClick={onClick} disabled={disabled} title={title}>
      {children}
    </button>
  );
}

export function QuietBtn({ children, onClick, disabled, title, className = '', type = 'button' }: BtnProps) {
  return (
    <button type={type} className={`s-btn-quiet ${className}`} onClick={onClick} disabled={disabled} title={title}>
      {children}
    </button>
  );
}

export function IconBtn({ children, onClick, disabled, title, className = '', type = 'button' }: BtnProps) {
  return (
    <button type={type} className={`s-icon-btn ${className}`} onClick={onClick} disabled={disabled} title={title}>
      {children}
    </button>
  );
}

/* Filter/sort chip with trailing chevron — the `.sel` in sentry. */
export function SelectChip({ children, onClick, title, icon }: BtnProps & { icon?: ReactNode }) {
  return (
    <button className="s-chip" onClick={onClick} title={title}>
      {icon}
      {children}
      <ChevronDown size={10} style={{ opacity: 0.55 }} />
    </button>
  );
}

/* Segmented icon buttons — chart-type switchers. */
export function Seg({ options, value, onChange }: {
  options: { key: string; icon: ReactNode; title?: string }[];
  value: string;
  onChange: (key: string) => void;
}) {
  return (
    <span className="s-seg">
      {options.map((o) => (
        <button
          key={o.key}
          className={o.key === value ? 'on' : ''}
          onClick={() => onChange(o.key)}
          title={o.title}
        >
          {o.icon}
        </button>
      ))}
    </span>
  );
}

/* ---------- stat card ---------- */

export function SStat({ icon, label, value, unit, foot, delta, extra, onMenu }: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  unit?: string;
  foot: ReactNode;
  delta?: { dir: 'up' | 'down'; text: string };
  extra?: ReactNode;
  onMenu?: () => void;
}) {
  return (
    <div className="s-stat">
      <div className="flex items-center gap-2.5 px-4 pt-4">
        <Ibox>{icon}</Ibox>
        <span className="text-[11.5px] font-medium text-[var(--text-secondary)] whitespace-nowrap">{label}</span>
        <button
          className="ml-auto text-[var(--text-tertiary)] hover:text-[var(--text-primary)] leading-none"
          onClick={onMenu}
          title="More"
        >
          <MoreHorizontal size={14} />
        </button>
      </div>
      <div className="flex items-baseline gap-1.5 px-4 mt-4">
        <span className="font-headline text-[34px] font-bold leading-none tracking-[-0.025em] text-[var(--text-primary)]">
          {value}
        </span>
        {unit && <span className="text-[12px] font-medium text-[var(--text-tertiary)]">{unit}</span>}
      </div>
      {extra && <div className="px-4 mt-3">{extra}</div>}
      <div className="s-stat-foot mt-3.5">
        <span>{foot}</span>
        {delta && <SDelta dir={delta.dir}>{delta.text}</SDelta>}
      </div>
    </div>
  );
}

export function SDelta({ dir, children }: { dir: 'up' | 'down'; children: ReactNode }) {
  return (
    <span className={`s-delta ${dir}`}>
      {dir === 'up' ? '▲' : '▼'}{children}
    </span>
  );
}

/* ---------- card ---------- */

export function SCard({ icon, title, accent, trail, children, pad = true, className = '' }: {
  icon?: ReactNode;
  title?: ReactNode;
  accent?: ReactNode;
  trail?: ReactNode;
  children: ReactNode;
  pad?: boolean;
  className?: string;
}) {
  return (
    <div className={`s-card ${className}`}>
      {(title !== undefined || icon) && (
        <div className="s-cardhead">
          {icon && <Ibox>{icon}</Ibox>}
          <span className="s-t">{title}{accent && <> <span className="s-ta">{accent}</span></>}</span>
          {trail && <span className="s-trail">{trail}</span>}
        </div>
      )}
      <div className={pad ? 'px-4 pb-4' : ''}>{children}</div>
    </div>
  );
}

/* ---------- ticks / bars ---------- */

export function Ticks({ pct, count = 56, warn = false }: { pct: number; count?: number; warn?: boolean }) {
  const on = Math.round((Math.max(0, Math.min(100, pct)) / 100) * count);
  return (
    <span className="s-ticks" role="img" aria-label={`${pct}%`}>
      {Array.from({ length: count }, (_, i) => (
        <i key={i} className={i < on ? (warn ? 'warn' : 'on') : ''} />
      ))}
    </span>
  );
}

/* Ascending mini bar glyph used inside table metric cells. */
export function MiniBars({ tone = 'var(--accent-primary)' }: { tone?: string }) {
  return (
    <span className="inline-flex items-end gap-[1.5px] h-3" aria-hidden>
      {[9, 5, 12, 7].map((h, i) => (
        <i key={i} className="w-[2.5px] rounded-[0.5px]" style={{ height: h, background: tone }} />
      ))}
    </span>
  );
}

/* ---------- status pill ---------- */

const PILL_CLS: Record<PillTone, string> = {
  ok: 'text-[var(--success)] bg-[var(--success-soft)] border-[color-mix(in_srgb,var(--success)_16%,transparent)]',
  warn: 'text-[var(--warning)] bg-[var(--warning-soft)] border-[color-mix(in_srgb,var(--warning)_16%,transparent)]',
  err: 'text-[var(--error)] bg-[var(--error-soft)] border-[color-mix(in_srgb,var(--error)_16%,transparent)]',
  info: 'text-[var(--info)] bg-[var(--info-soft)] border-[color-mix(in_srgb,var(--info)_16%,transparent)]',
  off: 'text-[var(--text-tertiary)] bg-[var(--tint-06)] border-[var(--border-subtle)]',
};

export function SPill({ tone, children }: { tone: PillTone; children: ReactNode }) {
  return (
    <span className={`inline-block text-[10.5px] font-medium rounded-[5px] px-2 py-[3.5px] border ${PILL_CLS[tone]}`}>
      {children}
    </span>
  );
}

/* ---------- inset callout ---------- */

export function SAnomaly({ icon, title, items }: { icon?: ReactNode; title: ReactNode; items: ReactNode[] }) {
  return (
    <div className="s-inset">
      <div className="flex items-center gap-2 pb-2 mb-2 border-b border-[var(--border-subtle)] text-[11.5px] text-[var(--text-secondary)]">
        {icon}
        <span>{title}</span>
      </div>
      {items.map((it, i) => (
        <div key={i} className="s-anomaly-item">{it}</div>
      ))}
    </div>
  );
}

/* ---------- data table (inset header bar, sortable) ---------- */

export type SCol<T> = {
  key: string;
  label: ReactNode;
  width?: string;
  sortable?: boolean;
  sortValue?: (row: T) => string | number;
  render: (row: T) => ReactNode;
};

const CARET = (
  <svg viewBox="0 0 7 10" width="7" height="10" className="shrink-0">
    <path d="M3.5 .8 5.8 3.6H1.2zM3.5 9.2 1.2 6.4h4.6z" fill="currentColor" opacity="0.45" />
  </svg>
);

export function STable<T extends { id?: string | number }>({ cols, rows, rowKey, selectable, onRowClick }: {
  cols: SCol<T>[];
  rows: T[];
  rowKey?: (row: T, i: number) => string | number;
  selectable?: boolean;
  onRowClick?: (row: T) => void;
}) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<1 | -1>(1);
  const [checked, setChecked] = useState<Set<number>>(new Set());

  const allCols: SCol<T>[] = selectable
    ? [{ key: '$sel', label: '', width: '30px', render: () => null }, ...cols]
    : cols;
  const template = allCols.map((c) => c.width ?? '1fr').join(' ');

  const sorted = [...rows];
  const sc = cols.find((c) => c.key === sortKey);
  if (sc?.sortValue) {
    sorted.sort((a, b) => {
      const x = sc.sortValue!(a); const y = sc.sortValue!(b);
      return (x > y ? 1 : x < y ? -1 : 0) * sortDir;
    });
  }

  const toggleAll = () =>
    setChecked(checked.size === rows.length ? new Set() : new Set(rows.map((_, i) => i)));

  return (
    <div className="s-dt pb-2.5">
      <div className="s-dt-head" style={{ gridTemplateColumns: template }}>
        {allCols.map((c) =>
          c.key === '$sel' ? (
            <span key="$sel" className="s-dt-h">
              <span className={`s-ck ${checked.size === rows.length && rows.length > 0 ? 'on' : ''}`} onClick={toggleAll} />
            </span>
          ) : (
            <span
              key={c.key}
              className={`s-dt-h ${c.sortable !== false ? 'sortable' : ''} ${sortKey === c.key ? 'on' : ''}`}
              onClick={() => {
                if (c.sortable === false) return;
                setSortDir(sortKey === c.key ? (sortDir === 1 ? -1 : 1) : 1);
                setSortKey(c.key);
              }}
            >
              {c.label}{c.sortable !== false && CARET}
            </span>
          ),
        )}
      </div>
      {sorted.map((row, i) => {
        const key = rowKey ? rowKey(row, i) : row.id ?? i;
        const ri = rows.indexOf(row);
        return (
          <div
            key={key}
            className={`s-dt-row ${onRowClick ? 'clickable' : ''}`}
            style={{ gridTemplateColumns: template }}
            onClick={() => onRowClick?.(row)}
          >
            {allCols.map((c) =>
              c.key === '$sel' ? (
                <span key="$sel">
                  <span
                    className={`s-ck ${checked.has(ri) ? 'on' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setChecked((prev) => {
                        const n = new Set(prev);
                        if (n.has(ri)) n.delete(ri); else n.add(ri);
                        return n;
                      });
                    }}
                  />
                </span>
              ) : (
                <span key={c.key} className="min-w-0">{c.render(row)}</span>
              ),
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ---------- page header (Welcome back … + actions) ---------- */

export function SPageHead({ title, titleAccent, sub, subAccent, actions }: {
  title: ReactNode;
  titleAccent?: ReactNode;
  sub?: ReactNode;
  subAccent?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-4 mb-5 flex-wrap">
      <div>
        <h1 className="font-headline text-[24px] font-bold tracking-[-0.02em] text-[var(--text-primary)]">
          {title}{titleAccent && <> <em className="not-italic text-[var(--accent-primary)]">{titleAccent}</em></>}
        </h1>
        {sub && (
          <div className="text-[12px] text-[var(--text-tertiary)] mt-[3px]">
            {sub}{subAccent && <> <b className="text-[var(--accent-primary)] font-semibold">{subAccent}</b></>}
          </div>
        )}
      </div>
      {actions && <div className="ml-auto flex items-center gap-2.5">{actions}</div>}
    </div>
  );
}

/* Section label — small caps with accent square. */
export function SSection({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-3 mt-1">
      <div className="flex items-center gap-2 text-[10.5px] font-medium uppercase tracking-[0.1em] text-[var(--text-tertiary)]">
        <span className="w-[5px] h-[5px] rounded-[1px] bg-[var(--accent-primary)]" />
        {children}
      </div>
      {right && <span className="v-mono text-[10.5px] text-[var(--text-muted)]">{right}</span>}
    </div>
  );
}

/* Legend row for charts. */
export function SLegend({ items }: { items: { color: string; label: string }[] }) {
  return (
    <div className="flex gap-5 px-4 pb-2.5 pt-0.5 text-[11.5px] font-medium text-[var(--text-secondary)]">
      {items.map((it) => (
        <span key={it.label}>
          <i className="inline-block w-[7px] h-[7px] rounded-[1.5px] mr-2" style={{ background: it.color }} />
          {it.label}
        </span>
      ))}
    </div>
  );
}


