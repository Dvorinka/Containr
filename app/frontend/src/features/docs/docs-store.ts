import { bundledDocs, type BundledDoc } from '@/generated/docs-snapshot';

export type DocEntry = BundledDoc;

export type DocsState = {
  docs: DocEntry[];
  source: 'bundled' | 'cache' | 'github';
  syncedAt: string | null;
};

const CACHE_KEY = 'containr.docs.v1';
const REPO = 'Dvorinka/Containr';
const BRANCH = 'main';
const SKIP_DIRS = new Set(['archive', 'design', 'superpowers']);

type CachePayload = { syncedAt: string; docs: DocEntry[] };

function readCache(): CachePayload | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachePayload;
    if (!Array.isArray(parsed.docs) || typeof parsed.syncedAt !== 'string') return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(payload: CachePayload) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
  } catch {
    // Storage full or unavailable — bundled docs still cover us.
  }
}

function titleOf(markdown: string, fallback: string): string {
  const match = markdown.match(/^#\s+(.+)$/m);
  if (match) return match[1].replace(/[#*`]/g, '').trim();
  return fallback
    .replace(/\.md$/i, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

type GitHubTreeEntry = { path?: string; type?: string };

async function fetchGitHubDocs(signal: AbortSignal): Promise<DocEntry[]> {
  const treeRes = await fetch(
    `https://api.github.com/repos/${REPO}/git/trees/${BRANCH}?recursive=1`,
    { signal, headers: { Accept: 'application/vnd.github+json' } },
  );
  if (!treeRes.ok) throw new Error(`tree fetch failed: ${treeRes.status}`);
  const tree = (await treeRes.json()) as { tree?: GitHubTreeEntry[]; truncated?: boolean };

  const paths = (tree.tree ?? [])
    .filter(
      (e) =>
        e.type === 'blob' &&
        typeof e.path === 'string' &&
        e.path.startsWith('docs/') &&
        e.path.toLowerCase().endsWith('.md') &&
        !e.path.split('/').some((seg, i) => i > 0 && SKIP_DIRS.has(seg)),
    )
    .map((e) => e.path as string);

  const docs = await Promise.all(
    paths.map(async (path) => {
      const res = await fetch(
        `https://raw.githubusercontent.com/${REPO}/${BRANCH}/${path}`,
        { signal },
      );
      if (!res.ok) throw new Error(`doc fetch failed: ${path}`);
      const markdown = await res.text();
      const rel = path.slice('docs/'.length);
      return {
        path: rel,
        section: rel.includes('/') ? rel.split('/')[0] : 'docs',
        title: titleOf(markdown, rel.split('/').pop() ?? rel),
        markdown,
      };
    }),
  );
  return docs;
}

/**
 * Synchronous initial state — cache wins over the bundled snapshot so a
 * previously synced copy survives offline reloads.
 */
export function initialDocs(): DocsState {
  const cached = readCache();
  return cached
    ? { docs: cached.docs, source: 'cache', syncedAt: cached.syncedAt }
    : { docs: bundledDocs, source: 'bundled', syncedAt: null };
}

/**
 * Background GitHub sync. `onUpdate` fires when fresh content lands so the
 * UI can re-render without a reload; failures keep the current copy.
 */
export function syncDocs(onUpdate: (state: DocsState) => void): void {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  fetchGitHubDocs(controller.signal)
    .then((docs) => {
      const syncedAt = new Date().toISOString();
      writeCache({ syncedAt, docs });
      onUpdate({ docs, source: 'github', syncedAt });
    })
    .catch(() => {
      // Offline or rate-limited — bundled/cache copy already displayed.
    })
    .finally(() => clearTimeout(timeout));
}
