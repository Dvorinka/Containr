import { useCallback, useMemo, useState } from 'react';
import {
  Background,
  BackgroundVariant,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Database, GitBranch, Package, Timer, Trash2, X } from 'lucide-react';
import {
  canvasFromConfig,
  configFromCanvas,
  newServiceKey,
  validateGraph,
  type BuilderNode,
  type BuilderService,
  type BuilderServiceType,
} from './builder-model';

type ServiceBuilderNode = Node<{ svc: BuilderService }, 'tplService'>;

const TYPE_META: Record<BuilderServiceType, { label: string; icon: typeof Package; cls: string }> = {
  web: { label: 'Web', icon: Package, cls: 'text-[var(--accent-primary)]' },
  worker: { label: 'Worker', icon: GitBranch, cls: 'text-[var(--info,#5eb3f6)]' },
  cron: { label: 'Cron', icon: Timer, cls: 'text-[var(--warning)]' },
  database: { label: 'Database', icon: Database, cls: 'text-[var(--success,#7bd88a)]' },
};

const DATABASE_ENGINES = ['postgresql', 'mysql', 'mariadb', 'mongodb', 'redis', 'dragonfly', 'clickhouse'];

function ServiceBuilderNodeView({ data, selected }: NodeProps<ServiceBuilderNode>) {
  const meta = TYPE_META[data.svc.type] ?? TYPE_META.web;
  const Icon = meta.icon;
  return (
    <div
      className={`relative w-[210px] rounded-[var(--radius-md)] border bg-[var(--bg-elevated)] px-3 py-2.5 shadow-sm transition-colors ${
        selected ? 'border-[var(--accent-primary)]' : 'border-[var(--border-subtle)]'
      }`}
    >
      <Handle type="target" position={Position.Left} className="!h-2.5 !w-2.5 !border-[var(--border-default)] !bg-[var(--bg-base)]" />
      <Handle type="source" position={Position.Right} className="!h-2.5 !w-2.5 !border-[var(--border-default)] !bg-[var(--bg-base)]" />
      <div className="flex items-center gap-2">
        <Icon size={14} className={meta.cls} />
        <span className="truncate text-[12.5px] font-semibold text-[var(--text-primary)]">
          {data.svc.name || data.svc.key}
        </span>
      </div>
      <div className="mt-1 flex items-center justify-between gap-2">
        <span className="text-[10.5px] uppercase tracking-wide text-[var(--text-tertiary)]">{meta.label}</span>
        <span className="mono max-w-[120px] truncate text-[10.5px] text-[var(--text-secondary)]">
          {data.svc.runtime || data.svc.repo || '—'}
        </span>
      </div>
    </div>
  );
}

const nodeTypes = { tplService: ServiceBuilderNodeView };

// Edges run dependency → dependent: connecting A → B means "B depends_on A".
export function TemplateBuilder(props: {
  config: Record<string, unknown>;
  onApply: (config: Record<string, unknown>) => void;
  onCancel: () => void;
}) {
  return (
    <ReactFlowProvider>
      <BuilderInner {...props} />
    </ReactFlowProvider>
  );
}

function BuilderInner({
  config,
  onApply,
  onCancel,
}: {
  config: Record<string, unknown>;
  onApply: (config: Record<string, unknown>) => void;
  onCancel: () => void;
}) {
  const { screenToFlowPosition } = useReactFlow();
  const initial = useMemo(() => canvasFromConfig(config), [config]);
  const [services, setServices] = useState<Map<string, BuilderService>>(
    () => new Map(initial.map((n) => [n.key, { ...n.service }])),
  );
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>(
    () => Object.fromEntries(initial.map((n) => [n.key, n.position])),
  );
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const flowNodes: ServiceBuilderNode[] = useMemo(
    () =>
      [...services.values()].map((svc) => ({
        id: svc.key,
        type: 'tplService' as const,
        position: positions[svc.key] ?? { x: 0, y: 0 },
        data: { svc },
        selected: svc.key === selectedKey,
      })),
    [services, positions, selectedKey],
  );

  const flowEdges: Edge[] = useMemo(
    () =>
      [...services.values()].flatMap((svc) =>
        (svc.depends_on ?? [])
          .filter((dep) => services.has(dep))
          .map((dep) => ({
            id: `${dep}->${svc.key}`,
            source: dep,
            target: svc.key,
            markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14, color: 'rgba(180,227,74,0.55)' },
            style: { stroke: 'rgba(180,227,74,0.42)', strokeWidth: 1.6 },
            className: 'edge-premium',
          })),
      ),
    [services],
  );

  const builderNodes: BuilderNode[] = useMemo(
    () =>
      [...services.values()].map((svc) => ({
        key: svc.key,
        service: svc,
        position: positions[svc.key] ?? { x: 0, y: 0 },
      })),
    [services, positions],
  );
  const errors = useMemo(() => validateGraph(builderNodes), [builderNodes]);

  const patchService = useCallback((key: string, patch: Partial<BuilderService>) => {
    setServices((prev) => {
      const svc = prev.get(key);
      if (!svc) return prev;
      const next = new Map(prev);
      next.set(key, { ...svc, ...patch });
      return next;
    });
  }, []);

  const addService = useCallback((type: BuilderServiceType, position?: { x: number; y: number }) => {
    setServices((prev) => {
      const key = newServiceKey(type, new Set(prev.keys()));
      const next = new Map(prev);
      next.set(key, {
        key,
        type,
        runtime: type === 'database' ? 'postgresql' : undefined,
      });
      setPositions((pos) => ({ ...pos, [key]: position ?? { x: 80, y: 40 + (next.size - 1) * 150 } }));
      setSelectedKey(key);
      return next;
    });
  }, []);

  const removeService = useCallback((key: string) => {
    setServices((prev) => {
      const next = new Map(prev);
      next.delete(key);
      for (const svc of next.values()) {
        svc.depends_on = svc.depends_on?.filter((d) => d !== key);
      }
      return next;
    });
    setPositions((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setSelectedKey((cur) => (cur === key ? null : cur));
  }, []);

  const onConnect = useCallback(
    (conn: Connection) => {
      if (!conn.source || !conn.target || conn.source === conn.target) return;
      const target = services.get(conn.target);
      if (!target) return;
      patchService(conn.target, {
        depends_on: [...new Set([...(target.depends_on ?? []), conn.source])],
      });
    },
    [patchService, services],
  );

  const onNodesChange = useCallback(
    (changes: NodeChange<ServiceBuilderNode>[]) => {
      for (const ch of changes) {
        if (ch.type === 'position' && ch.position) {
          setPositions((prev) => ({ ...prev, [ch.id]: ch.position! }));
        } else if (ch.type === 'remove') {
          removeService(ch.id);
        } else if (ch.type === 'select') {
          if (ch.selected) setSelectedKey(ch.id);
        }
      }
    },
    [removeService],
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange<Edge>[]) => {
      for (const ch of changes) {
        if (ch.type !== 'remove') continue;
        const edge = flowEdges.find((e) => e.id === ch.id);
        if (!edge) continue;
        const svc = services.get(edge.target);
        if (svc) {
          patchService(edge.target, {
            depends_on: (svc.depends_on ?? []).filter((d) => d !== edge.source),
          });
        }
      }
    },
    [flowEdges, patchService, services],
  );

  const selected = selectedKey ? services.get(selectedKey) : null;

  return (
    <div className="flex min-h-0 flex-1">
      <div className="relative flex-1">
        <div className="absolute left-3 top-3 z-10 flex gap-1.5">
          {(['web', 'database', 'cron', 'worker'] as const).map((t) => {
            const meta = TYPE_META[t];
            const Icon = meta.icon;
            return (
              <button
                key={t}
                type="button"
                onClick={() => addService(t)}
                className="canvas-pill inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                <Icon size={12} className={meta.cls} />
                {meta.label}
              </button>
            );
          })}
        </div>
        <ReactFlow
          nodes={flowNodes}
          edges={flowEdges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onPaneClick={() => setSelectedKey(null)}
          onDoubleClick={(e) => {
            if ((e.target as HTMLElement).closest('.react-flow__node')) return;
            addService('web', screenToFlowPosition({ x: e.clientX, y: e.clientY }));
          }}
          fitView
          deleteKeyCode={['Backspace', 'Delete']}
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={22} size={1.2} color="rgba(255,255,255,0.07)" />
        </ReactFlow>
        <div className="canvas-pill absolute bottom-3 left-3 z-10 px-3 py-1.5 text-[10.5px] text-[var(--text-tertiary)]">
          drag = move · connect handles = depends_on · double-click = add web · Del = remove
        </div>
      </div>

      <div className="flex w-[290px] shrink-0 flex-col border-l border-[var(--border-subtle)]">
        {selected ? (
          <Inspector
            key={selected.key}
            svc={selected}
            onPatch={(patch) => patchService(selected.key, patch)}
            onRemove={() => removeService(selected.key)}
          />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
            <Package size={22} className="text-[var(--text-tertiary)]" />
            <p className="text-xs text-[var(--text-tertiary)]">
              Select a node to edit it, or add one from the toolbar.
            </p>
          </div>
        )}
        <div className="border-t border-[var(--border-subtle)] p-3">
          {errors.length > 0 ? (
            <div className="mb-2 max-h-[90px] overflow-y-auto rounded-[var(--radius-sm)] bg-[var(--error-soft)] px-3 py-2">
              {errors.map((e) => (
                <p key={e} className="text-[11px] text-[var(--error)]">• {e}</p>
              ))}
            </div>
          ) : null}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 rounded-[var(--radius-md)] px-3 py-2 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
            >
              Back to JSON
            </button>
            <button
              type="button"
              disabled={errors.length > 0 || services.size === 0}
              onClick={() => onApply(configFromCanvas(builderNodes, config))}
              className="flex-1 rounded-[var(--radius-md)] bg-[var(--accent-primary)] px-3 py-2 text-xs font-semibold text-[var(--accent-on)] disabled:opacity-50"
            >
              Apply to JSON
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const FIELD_CLS =
  'w-full rounded-[var(--radius-sm)] border border-[var(--border-default)] bg-[var(--bg-void)] px-2.5 py-1.5 text-[12px] text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)]';
const LABEL_CLS = 'mb-1 block text-[10.5px] font-medium uppercase tracking-wide text-[var(--text-tertiary)]';

function Inspector({
  svc,
  onPatch,
  onRemove,
}: {
  svc: BuilderService;
  onPatch: (patch: Partial<BuilderService>) => void;
  onRemove: () => void;
}) {
  const envText = Object.entries(svc.environment ?? {})
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');
  const volText = (svc.volumes ?? []).map((v) => `${v.source}:${v.target}${v.read_only ? ':ro' : ''}`).join('\n');
  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[12px] font-semibold text-[var(--text-primary)]">{svc.key}</span>
        <button
          type="button"
          onClick={onRemove}
          className="flex items-center gap-1 rounded-[var(--radius-sm)] px-2 py-1 text-[11px] text-[var(--error)] hover:bg-[var(--error-soft)]"
        >
          <Trash2 size={12} /> Remove
        </button>
      </div>

      <label className={LABEL_CLS}>Key</label>
      <input className={FIELD_CLS} value={svc.key} disabled title="Key is the node id — cannot be renamed" />

      <label className={`${LABEL_CLS} mt-3`}>Display name</label>
      <input className={FIELD_CLS} value={svc.name ?? ''} onChange={(e) => onPatch({ name: e.target.value || undefined })} placeholder="optional" />

      <label className={`${LABEL_CLS} mt-3`}>Type</label>
      <select
        className={FIELD_CLS}
        value={svc.type}
        onChange={(e) => onPatch({ type: e.target.value as BuilderServiceType })}
      >
        <option value="web">Web</option>
        <option value="worker">Worker</option>
        <option value="cron">Cron</option>
        <option value="database">Database</option>
      </select>

      {svc.type === 'database' ? (
        <>
          <label className={`${LABEL_CLS} mt-3`}>Engine</label>
          <select className={FIELD_CLS} value={svc.runtime ?? 'postgresql'} onChange={(e) => onPatch({ runtime: e.target.value })}>
            {DATABASE_ENGINES.map((eng) => (
              <option key={eng} value={eng}>{eng}</option>
            ))}
          </select>
        </>
      ) : (
        <>
          <label className={`${LABEL_CLS} mt-3`}>Image (runtime)</label>
          <input className={FIELD_CLS} value={svc.runtime ?? ''} onChange={(e) => onPatch({ runtime: e.target.value || undefined })} placeholder="nginx:latest" />
          <label className={`${LABEL_CLS} mt-3`}>Git repo</label>
          <input className={FIELD_CLS} value={svc.repo ?? ''} onChange={(e) => onPatch({ repo: e.target.value || undefined })} placeholder="owner/repo or clone URL" />
          {svc.repo ? (
            <>
              <label className={`${LABEL_CLS} mt-3`}>Branch</label>
              <input className={FIELD_CLS} value={svc.branch ?? ''} onChange={(e) => onPatch({ branch: e.target.value || undefined })} placeholder="main" />
              <label className={`${LABEL_CLS} mt-3`}>Build command</label>
              <input className={FIELD_CLS} value={svc.build_command ?? ''} onChange={(e) => onPatch({ build_command: e.target.value || undefined })} />
            </>
          ) : null}
          <label className={`${LABEL_CLS} mt-3`}>Start command</label>
          <input className={FIELD_CLS} value={svc.start_command ?? ''} onChange={(e) => onPatch({ start_command: e.target.value || undefined })} />
        </>
      )}

      {svc.type === 'web' ? (
        <>
          <label className={`${LABEL_CLS} mt-3`}>Port</label>
          <input
            className={FIELD_CLS}
            type="number"
            value={svc.port ?? ''}
            onChange={(e) => onPatch({ port: e.target.value ? Number(e.target.value) : undefined })}
          />
          <label className={`${LABEL_CLS} mt-3`}>Health check path</label>
          <input className={FIELD_CLS} value={svc.health_check ?? ''} onChange={(e) => onPatch({ health_check: e.target.value || undefined })} placeholder="/health" />
        </>
      ) : null}

      <label className={`${LABEL_CLS} mt-3`}>Environment (KEY=value, one per line)</label>
      <textarea
        className={`${FIELD_CLS} mono min-h-[70px] resize-y`}
        defaultValue={envText}
        spellCheck={false}
        onBlur={(e) => {
          const env: Record<string, string> = {};
          for (const line of e.target.value.split('\n')) {
            const idx = line.indexOf('=');
            if (idx > 0) env[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
          }
          onPatch({ environment: Object.keys(env).length ? env : undefined });
        }}
        placeholder={'DATABASE_URL={{service.db.url}}\nSECRET={{secret}}'}
      />

      <label className={`${LABEL_CLS} mt-3`}>Volumes (source:target[:ro], one per line)</label>
      <textarea
        className={`${FIELD_CLS} mono min-h-[50px] resize-y`}
        defaultValue={volText}
        spellCheck={false}
        onBlur={(e) => {
          const vols = e.target.value
            .split('\n')
            .map((l) => l.trim())
            .filter(Boolean)
            .map((l) => {
              const [source, target, ro] = l.split(':');
              return { source, target, read_only: ro === 'ro' || undefined };
            })
            .filter((v) => v.source && v.target);
          onPatch({ volumes: vols.length ? vols : undefined });
        }}
        placeholder={'data:/var/lib/app\n./config:/etc/app:ro'}
      />

      {(svc.depends_on ?? []).length > 0 ? (
        <div className="mt-3">
          <span className={LABEL_CLS}>Depends on</span>
          <div className="flex flex-wrap gap-1">
            {svc.depends_on!.map((dep) => (
              <span key={dep} className="inline-flex items-center gap-1 rounded-full bg-[var(--surface-muted)] px-2 py-0.5 text-[11px] text-[var(--text-secondary)]">
                {dep}
                <button
                  type="button"
                  onClick={() => onPatch({ depends_on: (svc.depends_on ?? []).filter((d) => d !== dep) })}
                  className="text-[var(--text-tertiary)] hover:text-[var(--error)]"
                >
                  <X size={10} />
                </button>
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
