import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import {
  Background,
  BackgroundVariant,
  MarkerType,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useNodesState,
  useReactFlow,
  useViewport,
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
import { hasCanvasMetadata, loadCanvasMetadata, saveCanvasMetadata } from '../storage';
import { computeLayeredLayout, layoutFromVariables, NODE_HEIGHT, NODE_WIDTH } from './auto-layout';
import { GroupNode, ServiceNode, type GroupNodeData, type ServiceNodeData } from './nodes';
import { serviceTypeColor, serviceTypeIcon } from './service-visuals';
import {
  Plus,
  Layers,
  Maximize2,
  Minus,
  Link2,
  Play,
  Square,
  Rocket,
  Trash2,
  ArrowUpRight,
  Globe,
  X,
  Loader2,
  Wand2,
} from 'lucide-react';

type CanvasProps = {
  projectId: string;
  services: ServiceEntity[];
  variablesByService: Record<string, ServiceVariable[]>;
  onAddService: () => void;
  onOpenService: (serviceId: string) => void;
  readOnly?: boolean;
};

type ServiceCanvasNode = Node<ServiceNodeData, 'serviceNode'>;
type GroupCanvasNode = Node<GroupNodeData, 'groupNode'>;
type CanvasNode = ServiceCanvasNode | GroupCanvasNode;
type CanvasEdge = Edge<{ reasons: string[] }>;

const GROUP_DEFAULT_WIDTH = 340;
const GROUP_DEFAULT_HEIGHT = 230;
const TRANSIENT_STATUSES = new Set(['building', 'deploying', 'pending', 'rolling_back']);

const nodeTypes: NodeTypes = {
  serviceNode: ServiceNode,
  groupNode: GroupNode,
};

type ContextMenuState = {
  serviceId: string;
  x: number;
  y: number;
} | null;

function toFlowNodes(
  metadata: ProjectCanvasMetadata,
  services: ServiceEntity[],
  onOpenService: CanvasProps['onOpenService'],
  onRenameGroup: (groupId: string, title: string) => void,
): CanvasNode[] {
  const groups = metadata.groups.map(
    (group): GroupCanvasNode => ({
      id: group.id,
      type: 'groupNode',
      data: { title: group.title, onRename: onRenameGroup },
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
        width: NODE_WIDTH,
      },
    };
  });

  return [...groups, ...serviceNodes];
}

function toFlowEdges(
  links: ReturnType<typeof inferAutoConnections>,
  positionOf: (serviceId: string) => { x: number; y: number } | undefined,
  statusOf: (serviceId: string) => string | undefined,
): CanvasEdge[] {
  return links.map((link) => {
    const source = positionOf(link.edge.sourceServiceId);
    const target = positionOf(link.edge.targetServiceId);
    // Choose handle sides by relative position so edges flow forward
    // instead of looping back through the canvas.
    const forward = !source || !target || source.x <= target.x;
    const live =
      TRANSIENT_STATUSES.has(statusOf(link.edge.sourceServiceId) ?? '') ||
      TRANSIENT_STATUSES.has(statusOf(link.edge.targetServiceId) ?? '');

    return {
      id: link.edge.id,
      source: link.edge.sourceServiceId,
      target: link.edge.targetServiceId,
      sourceHandle: forward ? 's-r' : 's-l',
      targetHandle: forward ? 't-l' : 't-r',
      animated: live,
      data: {
        reasons: link.reasons,
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: 'rgba(180, 227, 74, 0.55)',
        width: 13,
        height: 13,
      },
      style: {
        stroke: 'rgba(180, 227, 74, 0.42)',
        strokeWidth: 1.6,
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

function ZoomControls({ onTidy }: { onTidy: () => void }) {
  const { zoom } = useViewport();
  const { zoomIn, zoomOut, fitView, setViewport } = useReactFlow();

  return (
    <div className="canvas-pill flex items-center">
      <button
        type="button"
        onClick={() => zoomOut({ duration: 160 })}
        className="canvas-pill-btn"
        title="Zoom out (-)"
      >
        <Minus size={14} />
      </button>
      <button
        type="button"
        onClick={() => setViewport({ x: 0, y: 0, zoom: 1 }, { duration: 180 })}
        className="canvas-pill-btn mono w-12 text-[11px]"
        title="Reset zoom (0)"
      >
        {Math.round(zoom * 100)}%
      </button>
      <button
        type="button"
        onClick={() => zoomIn({ duration: 160 })}
        className="canvas-pill-btn"
        title="Zoom in (+)"
      >
        <Plus size={14} />
      </button>
      <div className="w-px h-4 bg-[var(--border-subtle)] mx-1" />
      <button
        type="button"
        onClick={() => fitView({ padding: 0.18, duration: 240 })}
        className="canvas-pill-btn"
        title="Fit view (F)"
      >
        <Maximize2 size={13} />
      </button>
      <button
        type="button"
        onClick={onTidy}
        className="canvas-pill-btn"
        title="Tidy layout"
      >
        <Wand2 size={13} />
      </button>
    </div>
  );
}

function CanvasInner({ projectId, services, variablesByService, onAddService, onOpenService, readOnly }: CanvasProps) {
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

  const { fitView, getInternalNode, getViewport, screenToFlowPosition, setViewport, zoomIn, zoomOut } = useReactFlow<CanvasNode, CanvasEdge>();

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
    const statusOf = (serviceId: string) => services.find((service) => service.id === serviceId)?.status;
    return toFlowEdges(inferredLinks, positionOf, statusOf).filter(
      (edge) => visibleIds.has(edge.source) && visibleIds.has(edge.target),
    );
  }, [inferredLinks, visibleIds, nodes, services]);

  const renameGroup = useCallback(
    (groupId: string, title: string) => {
      setNodes((current) =>
        current.map((node) =>
          node.id === groupId && node.type === 'groupNode' ? { ...node, data: { ...node.data, title } } : node,
        ),
      );
    },
    [setNodes],
  );

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
      setSelectedServiceId(null);
    },
    onError: actionError,
  });
  const actionPending =
    deployMutation.isPending ||
    startMutation.isPending ||
    restartMutation.isPending ||
    stopMutation.isPending ||
    deleteMutation.isPending;

  const tidyLayout = useCallback(() => {
    const positions = computeLayeredLayout(
      services,
      inferredLinks.map((link) => link.edge),
    );
    setNodes((current) =>
      current.map((node) => {
        if (node.type !== 'serviceNode' || node.parentId) {
          return node;
        }
        const next = positions.get(node.id);
        return next ? { ...node, position: next } : node;
      }),
    );
    window.setTimeout(() => void fitView({ padding: 0.18, duration: 300 }), 40);
  }, [services, inferredLinks, setNodes, fitView]);

  useEffect(() => {
    const hasStoredViewport = hasCanvasMetadata(projectId);
    const layout = hasStoredViewport ? undefined : layoutFromVariables(services, variablesByService);
    const metadata = loadCanvasMetadata(projectId, services, layout);
    const nextNodes = toFlowNodes(metadata, services, onOpenService, renameGroup);

    viewportRestoredRef.current = false;
    setNodes(nextNodes);

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        const isDefaultViewport =
          metadata.viewport.x === DEFAULT_VIEWPORT.x &&
          metadata.viewport.y === DEFAULT_VIEWPORT.y &&
          metadata.viewport.zoom === DEFAULT_VIEWPORT.zoom;

        if (!hasStoredViewport || isDefaultViewport) {
          void fitView({ padding: 0.18, duration: 120 });
        } else {
          void setViewport(metadata.viewport, { duration: 120 });
        }
        viewportRestoredRef.current = true;
      });
    });

    hydratedRef.current = true;
  }, [projectId, serviceFingerprint, onOpenService, setNodes, setViewport, fitView, services, renameGroup, variablesByService]);

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

  // Canvas keyboard shortcuts: F fit, 0 reset zoom, +/- zoom, Esc deselect.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)
      ) {
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }

      switch (event.key) {
        case 'f':
        case 'F':
          void fitView({ padding: 0.18, duration: 240 });
          break;
        case '0':
          void setViewport({ x: 0, y: 0, zoom: 1 }, { duration: 180 });
          break;
        case '=':
        case '+':
          void zoomIn({ duration: 160 });
          break;
        case '-':
        case '_':
          void zoomOut({ duration: 160 });
          break;
        case 'Escape':
          setSelectedServiceId(null);
          setContextMenu(null);
          break;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [fitView, setViewport, zoomIn, zoomOut]);

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
      const centerX = basePosition.x + NODE_WIDTH / 2;
      const centerY = basePosition.y + NODE_HEIGHT / 2;
      const targetGroup = getGroupUnderPoint(centerX, centerY, movedNode.parentId);

      if (targetGroup) {
        const groupBase = getInternalNode(targetGroup.id)?.internals.positionAbsolute ?? targetGroup.position;
        const targetWidth = typeof targetGroup.style?.width === 'number' ? targetGroup.style.width : GROUP_DEFAULT_WIDTH;
        const targetHeight = typeof targetGroup.style?.height === 'number' ? targetGroup.style.height : GROUP_DEFAULT_HEIGHT;

        const relativeX = Math.max(12, Math.min(targetWidth - NODE_WIDTH - 12, basePosition.x - groupBase.x));
        const relativeY = Math.max(30, Math.min(targetHeight - NODE_HEIGHT - 12, basePosition.y - groupBase.y));

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
        data: { title: `Group ${current.filter((node) => node.type === 'groupNode').length + 1}`, onRename: renameGroup },
        draggable: true,
        selectable: true,
        style: {
          width: GROUP_DEFAULT_WIDTH,
          height: GROUP_DEFAULT_HEIGHT,
        },
      } satisfies GroupCanvasNode,
    ]);
  }, [screenToFlowPosition, setNodes, renameGroup]);

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
  const selectedConnections = useMemo(() => {
    if (!selectedService) {
      return [];
    }
    const nameOf = (id: string) => services.find((service) => service.id === id)?.name ?? id;
    return inferredLinks
      .filter(
        (link) =>
          link.edge.sourceServiceId === selectedService.id || link.edge.targetServiceId === selectedService.id,
      )
      .map((link) => ({
        id: link.edge.id,
        outbound: link.edge.sourceServiceId === selectedService.id,
        peer: link.edge.sourceServiceId === selectedService.id ? nameOf(link.edge.targetServiceId) : nameOf(link.edge.sourceServiceId),
        peerId: link.edge.sourceServiceId === selectedService.id ? link.edge.targetServiceId : link.edge.sourceServiceId,
        reasons: link.reasons,
      }));
  }, [inferredLinks, selectedService, services]);

  const minimapNodeColor = useCallback(
    (node: CanvasNode) => {
      if (node.type === 'groupNode') {
        return 'rgba(255,255,255,0.08)';
      }
      return serviceTypeColor((node.data as ServiceNodeData).service.type);
    },
    [],
  );

  return (
    <div ref={wrapperRef} className="relative h-full min-h-0 w-full bg-[var(--bg-void)]">
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
        zoomOnDoubleClick={false}
        nodesConnectable={false}
        nodeDragThreshold={3}
        onlyRenderVisibleElements
        minZoom={0.2}
        maxZoom={2.2}
        deleteKeyCode={null}
        selectionKeyCode="Shift"
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={26} size={1.2} color="rgba(255,255,255,0.055)" />
        <MiniMap
          position="bottom-right"
          pannable
          zoomable
          nodeColor={minimapNodeColor}
          bgColor="rgba(14, 15, 18, 0.92)"
          maskColor="rgba(12, 13, 15, 0.72)"
          className="canvas-minimap hidden md:block"
        />
      </ReactFlow>

      {/* Floating: env filter + group (top-left) */}
      <div className="absolute left-4 top-4 flex items-center gap-2">
        {environments.length > 1 && (
          <div className="canvas-pill flex items-center gap-0.5 p-1">
            {['all', ...environments].map((env) => (
              <button
                key={env}
                type="button"
                onClick={() => setEnvFilter(env)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium capitalize transition-all ${
                  envFilter === env
                    ? 'bg-[var(--surface-card)] text-[var(--text-primary)] shadow-sm'
                    : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
                }`}
              >
                {env}
              </button>
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={addGroup}
          className="canvas-pill canvas-pill-btn h-8 px-3 flex items-center gap-1.5 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          title="Add group"
        >
          <Layers size={13} />
          Group
        </button>
      </div>

      {/* Floating: zoom controls (bottom-left) */}
      <div className="absolute bottom-4 left-4">
        <ZoomControls onTidy={tidyLayout} />
      </div>

      {/* Floating: hint (bottom-center) — fades once a node is selected */}
      {!selectedService && services.length > 0 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-none hidden lg:block">
          <p className="canvas-pill px-3 py-1.5 text-[10.5px] text-[var(--text-tertiary)] whitespace-nowrap">
            Click to inspect · Double-click to open · Right-click for actions · F to fit
          </p>
        </div>
      )}

      {/* Inspector (right) */}
      {selectedService && (
        <aside className="canvas-inspector absolute right-4 top-4 bottom-4 w-[300px] panel-glass flex flex-col overflow-hidden">
          <div className="flex items-center gap-3 px-4 pt-4 pb-3 border-b border-[var(--border-subtle)]">
            <div
              className="w-9 h-9 rounded-[var(--radius-md)] flex items-center justify-center flex-shrink-0"
              style={{ background: `${serviceTypeColor(selectedService.type)}1c`, color: serviceTypeColor(selectedService.type) }}
            >
              {serviceTypeIcon(selectedService.type, 16)}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-semibold text-[var(--text-primary)] truncate">{selectedService.name}</h3>
              <p className="text-[11px] text-[var(--text-tertiary)]">
                {selectedService.type} · {selectedService.environment ?? 'production'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedServiceId(null)}
              className="w-7 h-7 rounded-md flex items-center justify-center text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-muted)]"
              title="Close (Esc)"
            >
              <X size={14} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
            {selectedService.image && (
              <div>
                <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-1">Image</p>
                <p className="mono text-[11px] text-[var(--text-secondary)] break-all">{selectedService.image}</p>
              </div>
            )}
            {(selectedService.domain || selectedService.publicUrl || selectedService.port) && (
              <div>
                <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-1">Address</p>
                {selectedService.domain || selectedService.publicUrl ? (
                  <a
                    href={selectedService.domain ? `https://${selectedService.domain}` : selectedService.publicUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mono text-[11px] text-[var(--accent-primary)] hover:underline break-all"
                  >
                    {(selectedService.domain ?? selectedService.publicUrl ?? '').replace(/^https?:\/\//, '')}
                  </a>
                ) : null}
                {selectedService.port ? (
                  <p className="mono text-[11px] text-[var(--text-secondary)] mt-0.5">
                    {selectedService.name}:{selectedService.port}
                  </p>
                ) : null}
              </div>
            )}

            <div>
              <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
                Connections ({selectedConnections.length})
              </p>
              {selectedConnections.length === 0 ? (
                <p className="text-[11px] text-[var(--text-muted)]">
                  No inferred connections. Reference another service via <span className="mono">{'{{variable}}'}</span> placeholders in env vars.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {selectedConnections.map((conn) => (
                    <button
                      key={conn.id}
                      type="button"
                      onClick={() => setSelectedServiceId(conn.peerId)}
                      className="w-full text-left px-2.5 py-2 rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--surface-muted)]/40 hover:bg-[var(--surface-muted)] transition-colors"
                    >
                      <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-primary)]">
                        <Link2 size={10} className="text-[var(--accent-primary)] flex-shrink-0" />
                        <span className="truncate font-medium">{conn.outbound ? `→ ${conn.peer}` : `← ${conn.peer}`}</span>
                      </div>
                      <p className="mono text-[9.5px] text-[var(--text-tertiary)] truncate mt-0.5 pl-4">
                        {conn.reasons.join(' · ')}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-[var(--border-subtle)] px-4 py-3 space-y-2">
            <button
              type="button"
              onClick={() => onOpenService(selectedService.id)}
              className="w-full flex items-center justify-center gap-2 h-9 rounded-[var(--radius-md)] text-[var(--accent-on)] text-[13px] font-medium"
              style={{ background: 'var(--accent-primary)' }}
            >
              <ArrowUpRight size={14} />
              Open service
            </button>
            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                disabled={actionPending || readOnly}
                onClick={() => deployMutation.mutate(selectedService.id)}
                className="flex items-center justify-center gap-1 h-8 rounded-[var(--radius-sm)] border border-[var(--border-subtle)] text-[11px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-default)] transition-colors disabled:opacity-40"
              >
                {deployMutation.isPending ? <Loader2 size={11} className="animate-spin" /> : <Rocket size={11} />}
                Deploy
              </button>
              {selectedService.status !== 'running' ? (
                <button
                  type="button"
                  disabled={actionPending || readOnly}
                  onClick={() => startMutation.mutate(selectedService.id)}
                  className="flex items-center justify-center gap-1 h-8 rounded-[var(--radius-sm)] border border-[var(--border-subtle)] text-[11px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-default)] transition-colors disabled:opacity-40"
                >
                  <Play size={11} />
                  Start
                </button>
              ) : (
                <button
                  type="button"
                  disabled={actionPending || readOnly}
                  onClick={() => restartMutation.mutate(selectedService.id)}
                  className="flex items-center justify-center gap-1 h-8 rounded-[var(--radius-sm)] border border-[var(--border-subtle)] text-[11px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-default)] transition-colors disabled:opacity-40"
                >
                  {restartMutation.isPending ? <Loader2 size={11} className="animate-spin" /> : <Play size={11} />}
                  Restart
                </button>
              )}
              <button
                type="button"
                disabled={actionPending || readOnly || selectedService.status !== 'running'}
                onClick={() => stopMutation.mutate(selectedService.id)}
                className="flex items-center justify-center gap-1 h-8 rounded-[var(--radius-sm)] border border-[var(--border-subtle)] text-[11px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-default)] transition-colors disabled:opacity-40"
              >
                <Square size={11} />
                Stop
              </button>
            </div>
            <button
              type="button"
              disabled={actionPending || readOnly}
              onClick={() => {
                if (window.confirm(`Delete service "${selectedService.name}"? Its containers will be removed.`)) {
                  deleteMutation.mutate(selectedService.id);
                }
              }}
              className="w-full flex items-center justify-center gap-1.5 h-8 rounded-[var(--radius-sm)] text-[11px] font-medium text-[var(--error)] hover:bg-[var(--error-soft)] transition-colors disabled:opacity-40"
            >
              <Trash2 size={11} />
              Delete service
            </button>
          </div>
        </aside>
      )}

      {/* Empty state */}
      {services.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center pointer-events-auto">
            <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)] flex items-center justify-center">
              <Rocket size={24} className="text-[var(--accent-primary)]" />
            </div>
            <h3 className="text-base font-semibold text-[var(--text-primary)]">Deploy your first service</h3>
            <p className="text-sm text-[var(--text-tertiary)] mt-1 mb-4 max-w-xs">
              Add a service from a git repo or Docker image - it runs on a private network with the rest of this
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
          className="absolute z-50 min-w-[180px] rounded-[var(--radius-md)] border border-[var(--border-default)] panel-glass py-1"
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
          {!readOnly && (
            <>
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
            </>
          )}
        </div>
      )}
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
