/* Non-component helpers for the Sentry kit — kept out of sentry.tsx so the
   component file stays fast-refresh clean. */

export type PillTone = 'ok' | 'warn' | 'err' | 'off' | 'info';

export function statusTone(status: string): PillTone {
  const s = status.toLowerCase();
  if (['running', 'healthy', 'online', 'active', 'deployed', 'succeeded', 'success', 'live'].includes(s)) return 'ok';
  if (['degraded', 'warning', 'building', 'deploying', 'pending', 'scheduled', 'queued', 'sleeping'].includes(s)) return 'warn';
  if (['failed', 'critical', 'error', 'offline', 'stopped'].includes(s)) return s === 'stopped' || s === 'offline' ? 'off' : 'err';
  return 'info';
}

/* CSS var color helper for charts. */
export function cssVar(name: string, fallback = ''): string {
  if (typeof window === 'undefined') return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}
