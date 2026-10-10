import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listProjectVariables, updateProjectVariables } from '@/lib/api-client';
import { Loader2, Plus, Save, Trash2, KeyRound } from 'lucide-react';
import { QuietBtn } from '@/shared/components/sentry';

type Row = { key: string; value: string; isSecret: boolean };

// SharedVariablesSection edits project-level variables referenced from
// service env values as ${{shared.KEY}}.
export function SharedVariablesSection({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient();
  const [drafts, setDrafts] = useState<Row[] | null>(null);

  const varsQuery = useQuery({
    queryKey: ['project-variables', projectId],
    queryFn: () => listProjectVariables(projectId),
  });

  const saveMutation = useMutation({
    mutationFn: (rows: Row[]) =>
      updateProjectVariables(
        projectId,
        rows
          .filter((r) => r.key.trim())
          .map((r) => ({ key: r.key.trim(), value: r.value, is_secret: r.isSecret })),
      ),
    onSuccess: () => {
      setDrafts(null);
      queryClient.invalidateQueries({ queryKey: ['project-variables', projectId] });
    },
  });

  const rows: Row[] = drafts ?? (varsQuery.data ?? []).map((v) => ({ key: v.key, value: v.value, isSecret: v.isSecret }));
  const dirty = drafts !== null;

  const updateRow = (i: number, patch: Partial<Row>) => {
    const next = rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r));
    setDrafts(next);
  };

  return (
    <div className="mt-6 pt-6 border-t border-[var(--border-subtle)]">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="s-t">Shared Variables</h3>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            Reference from any service as{' '}
            <code className="v-mono text-[var(--accent-primary)]">{'${{shared.KEY}}'}</code>. Applied on next
            deploy/redeploy — not live-updated.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <QuietBtn onClick={() => setDrafts([...rows, { key: '', value: '', isSecret: false }])}>
            <Plus size={12} />
            Add
          </QuietBtn>
          <button
            onClick={() => saveMutation.mutate(rows)}
            disabled={!dirty || saveMutation.isPending}
            className="s-btn-accent disabled:opacity-50"
            
          >
            {saveMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
            Save
          </button>
        </div>
      </div>

      {varsQuery.isLoading ? (
        <div className="flex items-center justify-center py-6 text-[var(--text-muted)]">
          <Loader2 size={16} className="animate-spin" />
        </div>
      ) : rows.length === 0 ? (
        <p className="text-xs text-[var(--text-muted)]">No shared variables.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((row, i) => (
            <div key={i} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto] gap-2 items-center">
              <input
                value={row.key}
                onChange={(e) => updateRow(i, { key: e.target.value })}
                placeholder="KEY"
                className="h-9 px-3 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] v-mono text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)] transition-all"
              />
              <input
                value={row.value}
                onChange={(e) => updateRow(i, { value: e.target.value })}
                type={row.isSecret ? 'password' : 'text'}
                placeholder="value"
                autoComplete="off"
                className="h-9 px-3 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] v-mono text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)] transition-all"
              />
              <button
                type="button"
                title={row.isSecret ? 'Secret — masked on save' : 'Mark as secret'}
                onClick={() => updateRow(i, { isSecret: !row.isSecret })}
                className={`w-9 h-9 rounded-lg border flex items-center justify-center transition-colors ${
                  row.isSecret
                    ? 'border-[var(--accent-primary)] bg-[var(--accent-primary-soft)] text-[var(--accent-primary)]'
                    : 'border-[var(--border-subtle)] text-[var(--text-muted)] hover:border-[var(--border-default)]'
                }`}
              >
                <KeyRound size={12} />
              </button>
              <button
                type="button"
                onClick={() => setDrafts(rows.filter((_, idx) => idx !== i))}
                className="w-9 h-9 rounded-lg border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-muted)] hover:border-[var(--error)] hover:text-[var(--error)] transition-colors"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
      {saveMutation.isError && (
        <p className="mt-2 text-xs text-[var(--error)]">
          {saveMutation.error instanceof Error ? saveMutation.error.message : 'Failed to save shared variables'}
        </p>
      )}
    </div>
  );
}
