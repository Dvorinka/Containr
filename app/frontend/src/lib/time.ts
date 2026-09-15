export function formatRelative(iso?: string): string {
  if (!iso) {
    return 'n/a';
  }

  const timestamp = Date.parse(iso);
  if (Number.isNaN(timestamp)) {
    return 'n/a';
  }

  const diffMs = Date.now() - timestamp;
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diffMs < minute) {
    return 'just now';
  }
  if (diffMs < hour) {
    return `${Math.floor(diffMs / minute)}m ago`;
  }
  if (diffMs < day) {
    return `${Math.floor(diffMs / hour)}h ago`;
  }
  return `${Math.floor(diffMs / day)}d ago`;
}

export function formatDate(iso?: string): string {
  if (!iso) {
    return 'n/a';
  }
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) {
    return 'n/a';
  }
  return dt.toLocaleString();
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '0 B';
  }
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / Math.pow(1024, index);
  return `${value >= 100 ? Math.round(value) : value.toFixed(1)} ${units[index]}`;
}

export function seededMetric(seed: string, min: number, max: number): number {
  let hash = 0;
  for (let idx = 0; idx < seed.length; idx += 1) {
    hash = (hash * 31 + seed.charCodeAt(idx)) & 0xffffffff;
  }

  const ratio = Math.abs(hash) % 10_000 / 10_000;
  return Math.round(min + (max - min) * ratio);
}
