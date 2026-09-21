import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import {
  Background,
  MarkerType,
  ReactFlow,
  ReactFlowProvider,
  useNodesState,
  useReactFlow,
  type Edge,
  type Node,
  type NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ServiceEntity } from '@/lib/api-client';
import {
  createDeployment,
  deleteService,
  restartService,
  startService,
  stopService,
} from '@/lib/api-client';
import { useToast } from '@/shared/hooks/use-toast';
import { inferAutoConnections, type ServiceVariable } from '../auto-connections';
import {
  DEFAULT_VIEWPORT,
  type CanvasGroup,
  type CanvasNodeLayout,
  type ProjectCanvasMetadata,
} from '../model';
import { canvasStorageKey, loadCanvasMetadata, saveCanvasMetadata } from '../storage';
import { GroupNode, ServiceNode, type GroupNodeData, type ServiceNodeData } from './nodes';
import {
  Plus,
  Layers,
  Maximize2,
  RotateCcw,
  Box,
  Link2,
  Play,
  Square,
  Rocket,
  Trash2,
  ArrowUpRight,
  Globe,
} from 'lucide-react';

type CanvasProps = {
  projectId: string;
  services: ServiceEntity[];
  variablesByService: Record<string, ServiceVariable[]>;
  onAddService: () => void;
  onOpenService: (serviceId: string) => void;
};

type ServiceCanvasNode = Node<ServiceNodeData, 'serviceNode'>;
type GroupCanvasNode = Node<GroupNodeData, 'groupNode'>;
type CanvasNode = ServiceCanvasNode | GroupCanvasNode;
type CanvasEdge = Edge<{ reasons: string[] }>;

const SERVICE_NODE_WIDTH = 210;
const SERVICE_NODE_HEIGHT = 96;
const GROUP_DEFAULT_WIDTH = 340;
const GROUP_DEFAULT_HEIGHT = 230;

const nodeTypes: NodeTypes = {
  serviceNode: ServiceNode,
  groupNode: GroupNode,
};

type ContextMenuState = {
  serviceId: string;
  x: number;
  y: number;
} | null;

function toFlowNodes(metadata: ProjectCanvasMetadata, services: ServiceEntity[], onOpenService: CanvasProps['onOpenService']): CanvasNode[] {
  const groups = metadata.groups.map(
    (group): GroupCanvasNode => ({
      id: group.id,
      type: 'groupNode',
      data: { title: group.title },
      position: group.position,
      draggable: true,
      selectable: true,
      style: {
        width: group.width,
        height: group.height,
      },
    }),
  );

  const layoutMap = new Map(metadata.nodes.map((layout) => [layout.serviceId, layout]));
  const groupIds = new Set(groups.map((group) => group.id));

  const serviceNodes = services.map((service): ServiceCanvasNode => {
    const layout = layoutMap.get(service.id);
    const parentId = layout?.groupId && groupIds.has(layout.groupId) ? layout.groupId : undefined;

    return {
      id: service.id,
      type: 'serviceNode',
      position: layout?.position ?? { x: 0, y: 0 },
      parentId,
      extent: parentId ? 'parent' : undefined,
      data: {
        service,
        selected: false,
        onOpen: onOpenService,
      },
      draggable: true,
      selectable: true,
      style: {
        width: SERVICE_NODE_WIDTH,
      },
    };
  });

  return [...groups, ...serviceNodes];
}

function toFlowEdges(
  links: ReturnType<typeof inferAutoConnections>,
  positionOf: (serviceId: string) => { x: number; y: number } | undefined,
): CanvasEdge[] {
  return links.map((link) => {
    const source = positionOf(link.edge.sourceServiceId);
    const target = positionOf(link.edge.targetServiceId);
    // Choose handle sides by relative position so edges flow forward
    // instead of looping back through the canvas.
    const forward = !source || !target || source.x <= target.x;

    return {
      id: link.edge.id,
      source: link.edge.sourceServiceId,
      target: link.edge.targetServiceId,
      sourceHandle: forward ? 's-r' : 's-l',
      targetHandle: forward ? 't-l' : 't-r',
      animated: false,
      data: {
        reasons: link.reasons,
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: 'var(--accent-secondary)',
        width: 14,
        height: 14,
      },
      style: {
        stroke: 'var(--accent-primary)',
        strokeWidth: 2,
      },
      className: 'edge-premium',
    };
  });
}

function buildMetadataFromFlow(nodes: CanvasNode[], viewport: { x: number; y: number; zoom: number }): ProjectCanvasMetadata {
  const groups: CanvasGroup[] = [];
  const layouts: CanvasNodeLayout[] = [];

  for (const node of nodes) {
    if (node.type === 'groupNode') {
      const width = typeof node.style?.width === 'number' ? node.style.width : GROUP_DEFAULT_WIDTH;
      const height = typeof node.style?.height === 'number' ? node.style.height : GROUP_DEFAULT_HEIGHT;
      groups.push({
        id: node.id,
        title: node.data.title,
        position: node.position,
        width,
        height,
      });
      continue;
    }

    if (node.type === 'serviceNode') {
      layouts.push({
        serviceId: node.id,
        position: node.position,
        groupId: node.parentId,
      });
    }
  }

  return {
    groups,
    nodes: layouts,
    edges: [],
    viewport,
  };
}

function CanvasInner({ projectId, services, variablesByService, onAddService, onOpenService }: CanvasProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const persistTimeout = useRef<number | null>(null);
  const hydratedRef = useRef(false);
  const viewportRestoredRef = useRef(false);
  const [nodes, setNodes, onNodesChange] = useNodesState<CanvasNode>([]);
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [viewportTick, setViewportTick] = useState(0);
  const [envFilter, setEnvFilter] = useState<string>('all');
  const [contextMenu, setContextMenu] = useState<ContextMenuState>(null);
  const queryClient = useQueryClient();
  const toast = useToast();

  const { fitView, getInternalNode, getViewport, screenToFlowPosition, setViewport } = useReactFlow<CanvasNode, CanvasEdge>();

  const environments = useMemo(() => {
    const envs = new Set(services.map((service) => service.environment ?? 'production'));
    return Array.from(envs).sort();
  }, [services]);

  const visibleServices = useMemo(
    () => (envFilter === 'all' ? services : services.filter((service) => (service.environment ?? 'production') === envFilter)),
    [services, envFilter],
  );
  const visibleIds = useMemo(() => new Set(visibleServices.map((service) => service.id)), [visibleServices]);

  const serviceFingerprint = useMemo(
    () => services.map((service) => service.id).sort().join('|'),
    [services],
  );
  const inferredLinks = useMemo(
    () => inferAutoConnections(services, variablesByService),
    [services, variablesByService],
  );
  const edges = useMemo(() => {
    const positionOf = (serviceId: string) => nodes.find((node) => node.id === serviceId)?.position;
    return toFlowEdges(inferredLinks, positionOf).filter(
      (edge) => visibleIds.has(edge.source) && visibleIds.has(edge.target),
    );
  }, [inferredLinks, visibleIds, nodes]);

  const invalidateServices = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['project-services', projectId] });
    void queryClient.invalidateQueries({ queryKey: ['service-runtime'] });
  }, [projectId, queryClient]);

  const actionError = (error: unknown) =>
    toast.showToast(error instanceof Error ? error.message : 'Action failed', 'error');

  const deployMutation = useMutation({
    mutationFn: (serviceId: string) => createDeployment(serviceId, { trigger: 'manual' }),
    onSuccess: () => {
      toast.showToast('Deployment started', 'success');
      invalidateServices();
    },
    onError: actionError,
  });
  const startMutation = useMutation({
    mutationFn: (serviceId: string) => startService(serviceId),
    onSuccess: () => {
      toast.showToast('Service started', 'success');
      invalidateServices();
    },
    onError: actionError,
  });
  const restartMutation = useMutation({
    mutationFn: (serviceId: string) => restartService(serviceId),
    onSuccess: () => {
      toast.showToast('Service restarted', 'success');
      invalidateServices();
    },
    onError: actionError,
  });
  const stopMutation = useMutation({
    mutationFn: (serviceId: string) => stopService(serviceId),
    onSuccess: () => {
      toast.showToast('Service stopped', 'success');
      invalidateServices();
    },
    onError: actionError,
  });
  const deleteMutation = useMutation({
    mutationFn: (serviceId: string) => deleteService(serviceId),
    onSuccess: () => {
      toast.showToast('Service deleted', 'success');
      invalidateServices();
    },
    onError: actionError,
  });
  const actionPending =
    deployMutation.isPending ||
    startMutation.isPending ||
    restartMutation.isPending ||
    stopMutation.isPending ||
    deleteMutation.isPending;

  useEffect(() => {
    const hasStoredViewport = localStorage.getItem(canvasStorageKey(projectId)) !== null;
    const metadata = loadCanvasMetadata(projectId, services);
    const nextNodes = toFlowNodes(metadata, services, onOpenService);

    viewportRestoredRef.current = false;
    setNodes(nextNodes);

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        const isDefaultViewport =
          metadata.viewport.x === DEFAULT_VIEWPORT.x &&
          metadata.viewport.y === DEFAULT_VIEWPORT.y &&
          metadata.viewport.zoom === DEFAULT_VIEWPORT.zoom;

        if (!hasStoredViewport || isDefaultViewport) {
          void fitView({ padding: 0.15, duration: 120 });
        } else {
          void setViewport(metadata.viewport, { duration: 120 });
        }
        viewportRestoredRef.current = true;
      });
    });

    hydratedRef.current = true;
  }, [projectId, serviceFingerprint, onOpenService, setNodes, setViewport, fitView, services]);

  useEffect(() => {
    if (!hydratedRef.current || !viewportRestoredRef.current) {
      return;
    }

    if (persistTimeout.current) {
      window.clearTimeout(persistTimeout.current);
    }

    persistTimeout.current = window.setTimeout(() => {
      const metadata = buildMetadataFromFlow(nodes, getViewport());
      saveCanvasMetadata(projectId, metadata);
    }, 150);

    return () => {
      if (persistTimeout.current) {
        window.clearTimeout(persistTimeout.current);
      }
    };
  }, [getViewport, nodes, projectId, viewportTick]);

  useEffect(() => {
    setNodes((prev) =>
      prev.map((node) => {
        if (node.type !== 'serviceNode') {
          return node;
        }

        return {
          ...node,
          data: {
            ...node.data,
            selected: node.id === selectedServiceId,
          },
        };
      }),
    );
  }, [selectedServiceId, setNodes]);

  const getGroupUnderPoint = useCallback((x: number, y: number, ignoreGroupId?: string) => {
    for (const node of nodes) {
      if (node.type !== 'groupNode' || node.id === ignoreGroupId) {
        continue;
      }

      const width = typeof node.style?.width === 'number' ? node.style.width : GROUP_DEFAULT_WIDTH;
      const height = typeof node.style?.height === 'number' ? node.style.height : GROUP_DEFAULT_HEIGHT;
      const base = getInternalNode(node.id)?.internals.positionAbsolute ?? node.position;

      if (x >= base.x && x <= base.x + width && y >= base.y && y <= base.y + height) {
        return node;
      }
    }

    return null;
  }, [getInternalNode, nodes]);

  const onNodeDragStop = useCallback(
    (_event: MouseEvent, movedNode: CanvasNode) => {
      if (movedNode.type !== 'serviceNode') {
        return;
      }

      const basePosition = getInternalNode(movedNode.id)?.internals.positionAbsolute ?? movedNode.position;
      const centerX = basePosition.x + SERVICE_NODE_WIDTH / 2;
      const centerY = basePosition.y + SERVICE_NODE_HEIGHT / 2;
      const targetGroup = getGroupUnderPoint(centerX, centerY, movedNode.parentId);

      if (targetGroup) {
        const groupBase = getInternalNode(targetGroup.id)?.internals.positionAbsolute ?? targetGroup.position;
        const targetWidth = typeof targetGroup.style?.width === 'number' ? targetGroup.style.width : GROUP_DEFAULT_WIDTH;
        const targetHeight = typeof targetGroup.style?.height === 'number' ? targetGroup.style.height : GROUP_DEFAULT_HEIGHT;

        const relativeX = Math.max(12, Math.min(targetWidth - SERVICE_NODE_WIDTH - 12, basePosition.x - groupBase.x));
        const relativeY = Math.max(30, Math.min(targetHeight - SERVICE_NODE_HEIGHT - 12, basePosition.y - groupBase.y));

        setNodes((current) =>
          current.map((node) => {
            if (node.id !== movedNode.id || node.type !== 'serviceNode') {
              return node;
            }

            return {
              ...node,
              parentId: targetGroup.id,
              extent: 'parent',
              position: { x: relativeX, y: relativeY },
            };
          }),
        );

        return;
      }

      if (!movedNode.parentId) {
        return;
      }

      setNodes((current) =>
        current.map((node) => {
          if (node.id !== movedNode.id || node.type !== 'serviceNode') {
            return node;
          }

          return {
            ...node,
            parentId: undefined,
            extent: undefined,
            position: {
              x: basePosition.x,
              y: basePosition.y,
            },
          };
        }),
      );
    },
    [getGroupUnderPoint, getInternalNode, setNodes],
  );

  const addGroup = useCallback(() => {
    const bounds = wrapperRef.current?.getBoundingClientRect();
    const center = bounds
      ? screenToFlowPosition({
          x: bounds.left + bounds.width / 2,
          y: bounds.top + bounds.height / 2,
        })
      : { x: 180, y: 140 };

    const id = `group-${Date.now()}`;

    setNodes((current) => [
      ...current,
      {
        id,
        type: 'groupNode',
        position: {
          x: center.x - GROUP_DEFAULT_WIDTH / 2,
          y: center.y - GROUP_DEFAULT_HEIGHT / 2,
        },
        data: { title: `Group ${current.filter((node) => node.type === 'groupNode').length + 1}` },
        draggable: true,
        selectable: true,
        style: {
          width: GROUP_DEFAULT_WIDTH,
          height: GROUP_DEFAULT_HEIGHT,
        },
      } satisfies GroupCanvasNode,
    ]);
  }, [screenToFlowPosition, setNodes]);

  // Env filter hides nodes via React Flow's `hidden` flag — positions and
  // persisted layout stay intact for services outside the current filter.
  const renderedNodes = useMemo(
    () =>
      nodes.map((node) =>
        node.type === 'serviceNode' && !visibleIds.has(node.id) ? { ...node, hidden: true } : node,
      ),
    [nodes, visibleIds],
  );

  const onNodeContextMenu = useCallback(
    (event: MouseEvent, node: CanvasNode) => {
      if (node.type !== 'serviceNode') {
        return;
      }
      event.preventDefault();
      const bounds = wrapperRef.current?.getBoundingClientRect();
      setSelectedServiceId(node.id);
      const menuW = 190;
      const menuH = 230;
      const x = Math.min(event.clientX - (bounds?.left ?? 0), Math.max(0, (bounds?.width ?? 0) - menuW));
      const y = Math.min(event.clientY - (bounds?.top ?? 0), Math.max(0, (bounds?.height ?? 0) - menuH));
      setContextMenu({ serviceId: node.id, x, y });
    },
    [],
  );

  const contextService = contextMenu ? services.find((service) => service.id === contextMenu.serviceId) ?? null : null;

  const selectedService = services.find((service) => service.id === selectedServiceId) ?? null;
  const selectedServiceLinkCount = selectedService
    ? inferredLinks.filter(
        (link) =>
          link.edge.sourceServiceId === selectedService.id || link.edge.targetServiceId === selectedService.id,
      ).length
    : 0;

  return (
    <div className="panel overflow-hidden">
      {/* Toolbar - Railway-inspired premium design */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--border-subtle)] bg-[var(--bg-base)]/60 backdrop-blur-xl px-4 py-3">
        <button
          type="button"
          onClick={onAddService}
          className="flex items-center gap-2 h-9 px-4 rounded-lg text-[var(--accent-on)] text-sm font-medium shadow-lg hover:shadow-xl transition-all duration-200"
          style={{ background: 'var(--accent-primary)' }}
        >
          <Plus size={15} />
          Add Service
        </button>
        <div className="w-px h-5 bg-[var(--border-subtle)] mx-1" />
        <button
          type="button"
          onClick={addGroup}
          className="flex items-center gap-2 h-9 px-3 rounded-lg bg-[var(--surface-card)] border border-[var(--border-subtle)] text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-card-hover)] hover:border-[var(--border-default)] transition-all"
        >
          <Layers size={14} />
          Group
        </button>

        {environments.length > 1 && (
          <>
            <div className="w-px h-5 bg-[var(--border-subtle)] mx-1" />
            <div className="flex items-center gap-1 rounded-lg bg-[var(--surface-muted)] border border-[var(--border-subtle)] p-1">
              {['all', ...environments].map((env) => (
                <button
                  key={env}
                  type="button"
                  onClick={() => setEnvFilter(env)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium capitalize transition-all ${
                    envFilter === env
                      ? 'bg-[var(--surface-card)] text-[var(--text-primary)] shadow-sm'
                      : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
                  }`}
                >
                  {env}
                </button>
              ))}
            </div>
          </>
        )}

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => fitView({ padding: 0.2, duration: 240 })}
            className="w-9 h-9 rounded-lg flex items-center justify-center text-[var(--text-tertiary)] hover:text-white hover:bg-[var(--surface-card)] border border-transparent hover:border-[var(--border-subtle)] transition-all"
            title="Fit View"
          >
            <Maximize2 size={16} />
          </button>
          <button
            type="button"
            onClick={() => setViewport({ x: 0, y: 0, zoom: 1 }, { duration: 180 })}
            className="w-9 h-9 rounded-lg flex items-center justify-center text-[var(--text-tertiary)] hover:text-white hover:bg-[var(--surface-card)] border border-transparent hover:border-[var(--border-subtle)] transition-all"
            title="Reset View"
          >
            <RotateCcw size={16} />
          </button>
        </div>

        <div className="flex items-center gap-4 px-3 py-1.5 rounded-full bg-[var(--surface-muted)] border border-[var(--border-subtle)]">
          <div className="flex items-center gap-1.5 text-xs text-[var(--text-tertiary)]">
            <Box size={12} />
            <span className="font-medium">{services.length}</span>
          </div>
          <div className="w-px h-3 bg-[var(--border-subtle)]" />
          <div className="flex items-center gap-1.5 text-xs text-[var(--text-tertiary)]">
            <Link2 size={12} />
            <span className="font-medium">{edges.length}</span>
          </div>
        </div>
      </div>

      {/* Canvas */}
      <div ref={wrapperRef} className="subtle-grid h-[66vh] min-h-[420px] bg-[var(--bg-void)] relative">
        <ReactFlow
          nodes={renderedNodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onPaneClick={() => {
            setSelectedServiceId(null);
            setContextMenu(null);
          }}
          onMoveStart={() => setContextMenu(null)}
          onNodeClick={(_event, node) => {
            setContextMenu(null);
            if (node.type === 'serviceNode') {
              setSelectedServiceId(node.id);
            }
          }}
          onNodeDoubleClick={(_event, node) => {
            if (node.type === 'serviceNode') {
              onOpenService(node.id);
            }
          }}
          onNodeContextMenu={onNodeContextMenu}
          onNodeDragStop={onNodeDragStop}
          onMoveEnd={() => setViewportTick((value) => value + 1)}
          panOnDrag
          zoomOnScroll
          minZoom={0.25}
          maxZoom={2.3}
          deleteKeyCode={null}
          proOptions={{ hideAttribution: true }}
        >
          {/* SVG Definitions for premium edge styling */}
          <svg style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>
            <defs />
          </svg>
          <Background color="rgba(255,255,255,0.05)" gap={28} />
        </ReactFlow>

        {/* Empty state */}
        {services.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center pointer-events-auto">
              <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)] flex items-center justify-center">
                <Rocket size={24} className="text-[var(--accent-primary)]" />
              </div>
              <h3 className="text-base font-semibold text-[var(--text-primary)]">Deploy your first service</h3>
              <p className="text-sm text-[var(--text-tertiary)] mt-1 mb-4 max-w-xs">
                Add a service from a git repo or Docker image — it runs on a private network with the rest of this
                project.
              </p>
              <button
                type="button"
                onClick={onAddService}
                className="inline-flex items-center gap-2 h-9 px-4 rounded-lg text-[var(--accent-on)] text-sm font-medium shadow-lg"
                style={{ background: 'var(--accent-primary)' }}
              >
                <Plus size={15} />
                Add Service
              </button>
            </div>
          </div>
        )}

        {/* Node context menu */}
        {contextMenu && contextService && (
          <div
            className="absolute z-50 min-w-[180px] rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-card)] shadow-2xl py-1"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <div className="px-3 py-1.5 border-b border-[var(--border-subtle)] mb-1">
              <p className="text-xs font-semibold text-[var(--text-primary)] truncate">{contextService.name}</p>
              <p className="text-[10px] text-[var(--text-tertiary)]">{contextService.status}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setContextMenu(null);
                onOpenService(contextService.id);
              }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)] transition-colors"
            >
              <ArrowUpRight size={13} />
              Open service
            </button>
            {(contextService.domain || contextService.publicUrl) && (
              <a
                href={contextService.domain ? `https://${contextService.domain}` : contextService.publicUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)] transition-colors"
              >
                <Globe size={13} />
                Visit {(contextService.domain ?? contextService.publicUrl ?? '').replace(/^https?:\/\//, '')}
              </a>
            )}
            <button
              type="button"
              disabled={actionPending}
              onClick={() => {
                setContextMenu(null);
                deployMutation.mutate(contextService.id);
              }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-50"
            >
              <Rocket size={13} />
              Deploy
            </button>
            {contextService.status !== 'running' && (
              <button
                type="button"
                disabled={actionPending}
                onClick={() => {
                  setContextMenu(null);
                  startMutation.mutate(contextService.id);
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-50"
              >
                <Play size={13} />
                Start
              </button>
            )}
            <button
              type="button"
              disabled={actionPending || contextService.status !== 'running'}
              onClick={() => {
                setContextMenu(null);
                restartMutation.mutate(contextService.id);
              }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-50"
            >
              <Play size={13} />
              Restart
            </button>
            <button
              type="button"
              disabled={actionPending || contextService.status !== 'running'}
              onClick={() => {
                setContextMenu(null);
                stopMutation.mutate(contextService.id);
              }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-50"
            >
              <Square size={13} />
              Stop
            </button>
            <div className="border-t border-[var(--border-subtle)] mt-1 pt-1">
              <button
                type="button"
                disabled={actionPending}
                onClick={() => {
                  setContextMenu(null);
                  if (window.confirm(`Delete service "${contextService.name}"? Its containers will be removed.`)) {
                    deleteMutation.mutate(contextService.id);
                  }
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-[var(--error)] hover:bg-[var(--error-soft)] transition-colors disabled:opacity-50"
              >
                <Trash2 size={13} />
                Delete
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-[var(--border-subtle)] bg-[var(--bg-base)]/60 backdrop-blur-xl px-4 py-3">
        {selectedService ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[var(--surface-card)] border border-[var(--border-subtle)] flex items-center justify-center">
                <Box size={14} className="text-[var(--accent-primary)]" />
              </div>
              <div>
                <span className="text-sm font-medium text-[var(--text-primary)]">{selectedService.name}</span>
                <span className="ml-2 text-xs text-[var(--text-tertiary)]">({selectedService.type})</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--surface-muted)] text-xs text-[var(--text-tertiary)]">
              <Link2 size={10} />
              <span>{selectedServiceLinkCount} connection{selectedServiceLinkCount !== 1 ? 's' : ''}</span>
            </div>
          </div>
        ) : (
          <p className="text-xs text-[var(--text-tertiary)] text-center">
            Click to select • Double-click to open • Right-click for actions • Connections auto-inferred from variables
          </p>
        )}
      </div>
    </div>
  );
}

export function ProjectCanvas(props: CanvasProps) {
  return (
    <ReactFlowProvider>
      <CanvasInner {...props} />
    </ReactFlowProvider>
  );
}
