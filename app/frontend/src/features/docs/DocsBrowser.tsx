import { useEffect, useMemo, useState } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { BookOpen, CloudOff, FileText, Search } from 'lucide-react';
import { initialDocs, syncDocs, type DocEntry, type DocsState } from './docs-store';

marked.setOptions({ gfm: true, breaks: false });

function renderMarkdown(markdown: string): string {
  const html = marked.parse(markdown, { async: false });
  return DOMPurify.sanitize(typeof html === 'string' ? html : '', {
    USE_PROFILES: { html: true },
  });
}

function excerpt(markdown: string, length = 140): string {
  const text = markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[#>*`\-[\]()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > length ? `${text.slice(0, length)}…` : text;
}

export function DocsBrowser() {
  const [state, setState] = useState<DocsState>(() => initialDocs());
  const [query, setQuery] = useState('');
  const [selectedPath, setSelectedPath] = useState<string | null>(null);

  useEffect(() => {
    syncDocs(setState);
  }, []);

  const docs = state.docs;

  const sections = useMemo(() => {
    const grouped = new Map<string, DocEntry[]>();
    for (const doc of docs) {
      const list = grouped.get(doc.section) ?? [];
      list.push(doc);
      grouped.set(doc.section, list);
    }
    return [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [docs]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return docs.filter(
      (doc) =>
        doc.title.toLowerCase().includes(q) ||
        doc.path.toLowerCase().includes(q) ||
        doc.markdown.toLowerCase().includes(q),
    );
  }, [docs, query]);

  const selected = useMemo(
    () => docs.find((doc) => doc.path === selectedPath) ?? null,
    [docs, selectedPath],
  );

  const selectedHtml = useMemo(
    () => (selected ? renderMarkdown(selected.markdown) : ''),
    [selected],
  );

  const sourceBadge =
    state.source === 'github'
      ? { label: 'live · github', cls: 'text-[var(--success)]' }
      : state.source === 'cache'
        ? { label: `cached · ${state.syncedAt ? new Date(state.syncedAt).toLocaleDateString() : 'offline'}`, cls: 'text-[var(--warning)]' }
        : { label: 'bundled copy', cls: 'text-[var(--text-tertiary)]' };

  return (
    <div className="flex min-h-[480px] overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-card)]">
      <div className="flex w-[300px] shrink-0 flex-col border-r border-[var(--border-subtle)] max-md:w-full">
        <div className="border-b border-[var(--border-subtle)] p-3">
          <div className="flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-2.5 py-1.5">
            <Search size={13} className="shrink-0 text-[var(--text-tertiary)]" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search docs…"
              className="w-full bg-transparent text-[13px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-tertiary)]"
            />
          </div>
          <div className="mt-2 flex items-center justify-between px-0.5">
            <span className={`text-[10.5px] font-medium uppercase tracking-wider ${sourceBadge.cls}`}>
              {sourceBadge.label}
            </span>
            <span className="text-[10.5px] text-[var(--text-tertiary)]">{docs.length} docs</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {filtered ? (
            filtered.length > 0 ? (
              filtered.map((doc) => (
                <DocListItem key={doc.path} doc={doc} active={doc.path === selectedPath} onSelect={setSelectedPath} showSection />
              ))
            ) : (
              <p className="px-2 py-6 text-center text-xs text-[var(--text-tertiary)]">No docs match “{query}”.</p>
            )
          ) : (
            sections.map(([section, entries]) => (
              <div key={section} className="mb-3">
                <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                  {section}
                </p>
                {entries.map((doc) => (
                  <DocListItem key={doc.path} doc={doc} active={doc.path === selectedPath} onSelect={setSelectedPath} />
                ))}
              </div>
            ))
          )}
        </div>
      </div>

      <div className="min-w-0 flex-1 overflow-y-auto max-md:hidden">
        {selected ? (
          <article className="docs-article px-8 py-6">
            <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-[var(--text-tertiary)]">
              {selected.section} / {selected.path}
            </p>
            <div dangerouslySetInnerHTML={{ __html: selectedHtml }} />
          </article>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
            <BookOpen size={28} className="text-[var(--text-tertiary)]" />
            <p className="text-sm font-medium text-[var(--text-secondary)]">Select a document</p>
            <p className="max-w-sm text-xs leading-relaxed text-[var(--text-tertiary)]">
              Documentation is bundled with the app and refreshes from GitHub in the background.
              {!state.syncedAt ? ' Currently showing the bundled copy.' : ''}
            </p>
            {state.source !== 'github' ? (
              <p className="flex items-center gap-1.5 text-[11px] text-[var(--text-tertiary)]">
                <CloudOff size={12} /> Offline-safe — updates apply automatically when a connection is available.
              </p>
            ) : null}
          </div>
        )}
      </div>

      {/* Mobile: tapping a doc replaces the list */}
      {selected ? (
        <div className="fixed inset-0 z-50 flex flex-col bg-[var(--bg-base)] md:hidden">
          <div className="flex items-center gap-2 border-b border-[var(--border-subtle)] p-3">
            <button
              type="button"
              onClick={() => setSelectedPath(null)}
              className="rounded-[var(--radius-md)] px-2.5 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
            >
              ← Back
            </button>
            <span className="truncate text-xs text-[var(--text-tertiary)]">{selected.title}</span>
          </div>
          <article className="docs-article flex-1 overflow-y-auto px-5 py-4">
            <div dangerouslySetInnerHTML={{ __html: selectedHtml }} />
          </article>
        </div>
      ) : null}
    </div>
  );
}

function DocListItem({
  doc,
  active,
  onSelect,
  showSection = false,
}: {
  doc: DocEntry;
  active: boolean;
  onSelect: (path: string) => void;
  showSection?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(doc.path)}
      className={`mb-0.5 w-full rounded-[var(--radius-md)] px-2.5 py-2 text-left transition-colors ${
        active
          ? 'bg-[var(--accent-primary-soft)] text-[var(--accent-primary)]'
          : 'text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]'
      }`}
    >
      <span className="flex items-center gap-2">
        <FileText size={13} className="shrink-0 opacity-60" />
        <span className="truncate text-[13px] font-medium">{doc.title}</span>
      </span>
      <span className="mt-0.5 block truncate pl-5 text-[11px] text-[var(--text-tertiary)]">
        {showSection ? `${doc.section} · ` : ''}{excerpt(doc.markdown, 80)}
      </span>
    </button>
  );
}
