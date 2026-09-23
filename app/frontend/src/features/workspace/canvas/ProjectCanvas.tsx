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
import { ServiceInspector, type InspectorGroup } from './inspector';
import { serviceAccent } from './service-visuals';
import {
  Plus,
  Layers,
  Maximize2,
  Minus,
  Play,
  Square,
  Rocket,
  Trash2,
  ArrowUpRight,
  Globe,
  Wand2,
  Pencil,
  Ungroup,
} from 'lucide-react';


type CanvasProps = {
  projectId: string;
  services: ServiceEntity[];
  variablesByService: Record<string, ServiceVariable[]>;
  onAddService: () => void;
  onOpenService: (serviceId: string) => void;
  onOpenSection?: (serviceId: string, section: string) => void;
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
  kind: 'service' | 'group' | 'pane';
  targetId?: string;
  x: number;
  y: number;
  flowX?: number;
  flowY?: number;
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

const GROUP_PAD_X = 28;
const GROUP_PAD_TOP = 56;
const GROUP_PAD_BOTTOM = 24;
const GROUP_ROW_GAP = 16;

// Where an incoming service lands inside a group frame. If the point already
// fits inside the padded area, honour it. Otherwise append beneath the lowest
// member and grow the frame just enough — keeps groups compact instead of
// ballooning the frame to wherever the node used to sit.
function groupSlot(
  nodes: CanvasNode[],
  groupId: string,
  group: CanvasNode,
  desiredX: number,
  desiredY: number,
  ignoreServiceId?: string,
): { x: number; y: number; width: number; height: number } {
  const width = typeof group.style?.width === 'number' ? group.style.width : GROUP_DEFAULT_WIDTH;
  const height = typeof group.style?.height === 'number' ? group.style.height : GROUP_DEFAULT_HEIGHT;

  const fits =
    desiredX >= GROUP_PAD_X &&
    desiredY >= GROUP_PAD_TOP &&
    desiredX + NODE_WIDTH <= width - GROUP_PAD_X &&
    desiredY + NODE_HEIGHT <= height - GROUP_PAD_BOTTOM;

  if (fits) {
    return { x: desiredX, y: desiredY, width, height };
  }

  let bottom = GROUP_PAD_TOP - GROUP_ROW_GAP;
  for (const node of nodes) {
    if (node.type === 'serviceNode' && node.parentId === groupId && node.id !== ignoreServiceId) {
      bottom = Math.max(bottom, node.position.y + NODE_HEIGHT);
    }
  }

  const x = GROUP_PAD_X;
  const y = bottom + GROUP_ROW_GAP;
  return {
    x,
    y,
    width: Math.max(width, x + NODE_WIDTH + GROUP_PAD_X),
    height: Math.max(height, y + NODE_HEIGHT + GROUP_PAD_BOTTOM),
  };
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

function CanvasInner({ projectId, services, variablesByService, onAddService, onOpenService, onOpenSection, readOnly }: CanvasProps) {
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

        setNodes((current) => {
          const slot = groupSlot(
            current,
            targetGroup.id,
            targetGroup,
            basePosition.x - groupBase.x,
            basePosition.y - groupBase.y,
            movedNode.id,
          );

          return current.map((node) => {
            if (node.id === targetGroup.id && node.type === 'groupNode') {
              return { ...node, style: { ...node.style, width: slot.width, height: slot.height } };
            }
            if (node.id === movedNode.id && node.type === 'serviceNode') {
              return {
                ...node,
                parentId: targetGroup.id,
                extent: 'parent' as const,
                position: { x: slot.x, y: slot.y },
              };
            }
            return node;
          });
        });

        return;
      }

      if (!movedNode.parentId) {
        return;
      }

      // Still inside its own frame — keep membership, the relative move stands.
      const parent = nodes.find((entry) => entry.id === movedNode.parentId && entry.type === 'groupNode');
      if (parent) {
        const parentAbs = getInternalNode(parent.id)?.internals.positionAbsolute ?? parent.position;
        const parentW = typeof parent.style?.width === 'number' ? parent.style.width : GROUP_DEFAULT_WIDTH;
        const parentH = typeof parent.style?.height === 'number' ? parent.style.height : GROUP_DEFAULT_HEIGHT;
        const inside =
          centerX >= parentAbs.x &&
          centerX <= parentAbs.x + parentW &&
          centerY >= parentAbs.y &&
          centerY <= parentAbs.y + parentH;
        if (inside) {
          return;
        }
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
    [getGroupUnderPoint, getInternalNode, nodes, setNodes],
  );

  const addGroup = useCallback(
    (at?: { x: number; y: number }) => {
      const bounds = wrapperRef.current?.getBoundingClientRect();
      const center =
        at ??
        (bounds
          ? screenToFlowPosition({
              x: bounds.left + bounds.width / 2,
              y: bounds.top + bounds.height / 2,
            })
          : { x: 180, y: 140 });

      const id = `group-${Date.now()}`;

      setNodes((current) => [
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
        // Groups must precede their children in the array — keep it first.
        ...current,
      ]);

      return id;
    },
    [screenToFlowPosition, setNodes, renameGroup],
  );

  // Move a service node in/out of a group — mirrors the drag-drop math so
  // assignment via the inspector lands identically to dropping the node on a
  // group frame.
  const assignToGroup = useCallback(
    (serviceId: string, groupId: string | null) => {
      const node = nodes.find((entry) => entry.id === serviceId && entry.type === 'serviceNode');
      if (!node || node.parentId === (groupId ?? undefined)) {
        return;
      }
      const abs = getInternalNode(serviceId)?.internals.positionAbsolute ?? node.position;

      if (groupId === null) {
        setNodes((current) =>
          current.map((entry) =>
            entry.id === serviceId && entry.type === 'serviceNode'
              ? { ...entry, parentId: undefined, extent: undefined, position: abs }
              : entry,
          ),
        );
        return;
      }

      setNodes((current) => {
        const group = current.find((entry) => entry.id === groupId && entry.type === 'groupNode');
        if (!group) {
          return current;
        }
        const groupAbs = getInternalNode(groupId)?.internals.positionAbsolute ?? group.position;
        const slot = groupSlot(current, groupId, group, abs.x - groupAbs.x, abs.y - groupAbs.y);

        return current.map((entry) => {
          if (entry.id === groupId && entry.type === 'groupNode') {
            return { ...entry, style: { ...entry.style, width: slot.width, height: slot.height } };
          }
          if (entry.id === serviceId && entry.type === 'serviceNode') {
            return { ...entry, parentId: groupId, extent: 'parent' as const, position: { x: slot.x, y: slot.y } };
          }
          return entry;
        });
      });
    },
    [getInternalNode, nodes, setNodes],
  );

  // Create a group frame wrapped around the service and adopt the node into it.
  const newGroupForService = useCallback(
    (serviceId: string) => {
      const node = nodes.find((entry) => entry.id === serviceId && entry.type === 'serviceNode');
      if (!node) {
        return;
      }
      const abs = getInternalNode(serviceId)?.internals.positionAbsolute ?? node.position;
      const groupId = `group-${Date.now()}`;

      setNodes((current) => [
        // Parent precedes the child in the array.
        {
          id: groupId,
          type: 'groupNode',
          position: { x: abs.x - GROUP_PAD_X, y: abs.y - GROUP_PAD_TOP },
          data: {
            title: `Group ${current.filter((entry) => entry.type === 'groupNode').length + 1}`,
            onRename: renameGroup,
          },
          draggable: true,
          selectable: true,
          style: {
            width: NODE_WIDTH + GROUP_PAD_X * 2,
            height: NODE_HEIGHT + GROUP_PAD_TOP + GROUP_PAD_BOTTOM,
          },
        } satisfies GroupCanvasNode,
        ...current.map((entry) =>
          entry.id === serviceId && entry.type === 'serviceNode'
            ? {
                ...entry,
                parentId: groupId,
                extent: 'parent' as const,
                position: { x: GROUP_PAD_X, y: GROUP_PAD_TOP },
              }
            : entry,
        ),
      ]);
    },
    [getInternalNode, nodes, renameGroup, setNodes],
  );

  const deleteGroup = useCallback(
    (groupId: string) => {
      setNodes((current) => {
        const unparented = current.map((entry) => {
          if (entry.type !== 'serviceNode' || entry.parentId !== groupId) {
            return entry;
          }
          const abs = getInternalNode(entry.id)?.internals.positionAbsolute ?? entry.position;
          return { ...entry, parentId: undefined, extent: undefined, position: abs };
        });
        return unparented.filter((entry) => entry.id !== groupId);
      });
      setContextMenu(null);
    },
    [getInternalNode, setNodes],
  );

  const requestGroupRename = useCallback(
    (groupId: string) => {
      setNodes((current) =>
        current.map((entry) =>
          entry.id === groupId && entry.type === 'groupNode'
            ? { ...entry, data: { ...entry.data, renameNonce: (entry.data.renameNonce ?? 0) + 1 } }
            : entry,
        ),
      );
    },
    [setNodes],
  );

  // Env filter hides nodes via React Flow's `hidden` flag — positions and
  // persisted layout stay intact for services outside the current filter.
  const renderedNodes = useMemo(
    () =>
      nodes.map((node) =>
        node.type === 'serviceNode' && !visibleIds.has(node.id) ? { ...node, hidden: true } : node,
      ),
    [nodes, visibleIds],
  );

  const menuPosition = useCallback((clientX: number, clientY: number, menuW = 190, menuH = 240) => {
    const bounds = wrapperRef.current?.getBoundingClientRect();
    const x = Math.min(clientX - (bounds?.left ?? 0), Math.max(0, (bounds?.width ?? 0) - menuW));
    const y = Math.min(clientY - (bounds?.top ?? 0), Math.max(0, (bounds?.height ?? 0) - menuH));
    return { x, y };
  }, []);

  const onNodeContextMenu = useCallback(
    (event: MouseEvent, node: CanvasNode) => {
      event.preventDefault();
      if (node.type === 'serviceNode') {
        setSelectedServiceId(node.id);
        setContextMenu({ kind: 'service', targetId: node.id, ...menuPosition(event.clientX, event.clientY) });
      } else if (node.type === 'groupNode') {
        setContextMenu({ kind: 'group', targetId: node.id, ...menuPosition(event.clientX, event.clientY, 190, 140) });
      }
    },
    [menuPosition],
  );

  const onPaneContextMenu = useCallback(
    (event: MouseEvent | globalThis.MouseEvent) => {
      event.preventDefault();
      const flow = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      setContextMenu({ kind: 'pane', ...menuPosition(event.clientX, event.clientY, 200, 170), flowX: flow.x, flowY: flow.y });
    },
    [menuPosition, screenToFlowPosition],
  );

  const contextService =
    contextMenu?.kind === 'service' && contextMenu.targetId
      ? services.find((service) => service.id === contextMenu.targetId) ?? null
      : null;
  const contextGroup =
    contextMenu?.kind === 'group' && contextMenu.targetId
      ? nodes.find(
          (node): node is GroupCanvasNode => node.id === contextMenu.targetId && node.type === 'groupNode',
        ) ?? null
      : null;
  const inspectorGroups: InspectorGroup[] = useMemo(
    () =>
      nodes
        .filter((node): node is GroupCanvasNode => node.type === 'groupNode')
        .map((node) => ({ id: node.id, title: node.data.title })),
    [nodes],
  );
  const selectedNode = selectedServiceId ? nodes.find((node) => node.id === selectedServiceId) : undefined;

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
      return serviceAccent((node.data as ServiceNodeData).service);
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
        onPaneContextMenu={onPaneContextMenu}
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
          onClick={() => addGroup()}
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
        <ServiceInspector
          service={selectedService}
          variables={variablesByService[selectedService.id] ?? []}
          connections={selectedConnections}
          groups={inspectorGroups}
          groupId={selectedNode?.parentId}
          readOnly={readOnly}
          actions={{
            deploy: () => deployMutation.mutate(selectedService.id),
            start: () => startMutation.mutate(selectedService.id),
            restart: () => restartMutation.mutate(selectedService.id),
            stop: () => stopMutation.mutate(selectedService.id),
            remove: () => {
              if (window.confirm(`Delete service "${selectedService.name}"? Its containers will be removed.`)) {
                deleteMutation.mutate(selectedService.id);
              }
            },
            pending: actionPending,
            deployPending: deployMutation.isPending,
            restartPending: restartMutation.isPending,
          }}
          onClose={() => setSelectedServiceId(null)}
          onOpenService={onOpenService}
          onOpenSection={(serviceId, section) =>
            onOpenSection ? onOpenSection(serviceId, section) : onOpenService(serviceId)
          }
          onSelectPeer={setSelectedServiceId}
          onAssignGroup={assignToGroup}
          onNewGroupFor={newGroupForService}
        />
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

      {/* Context menus — service node, group frame, or empty pane */}
      {contextMenu && (
        <div
          className="absolute z-50 min-w-[180px] rounded-[var(--radius-md)] border border-[var(--border-default)] panel-glass py-1"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          {contextMenu.kind === 'pane' && (
            <>
              <button
                type="button"
                onClick={() => {
                  setContextMenu(null);
                  onAddService();
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)] transition-colors"
              >
                <Plus size={13} />
                Add service
              </button>
              <button
                type="button"
                onClick={() => {
                  const at =
                    contextMenu.flowX !== undefined && contextMenu.flowY !== undefined
                      ? { x: contextMenu.flowX, y: contextMenu.flowY }
                      : undefined;
                  setContextMenu(null);
                  addGroup(at);
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)] transition-colors"
              >
                <Layers size={13} />
                Add group here
              </button>
              <div className="border-t border-[var(--border-subtle)] mt-1 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setContextMenu(null);
                    tidyLayout();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)] transition-colors"
                >
                  <Wand2 size={13} />
                  Tidy layout
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setContextMenu(null);
                    void fitView({ padding: 0.18, duration: 240 });
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)] transition-colors"
                >
                  <Maximize2 size={13} />
                  Fit view
                </button>
              </div>
            </>
          )}

          {contextMenu.kind === 'group' && contextGroup && (
            <>
              <div className="px-3 py-1.5 border-b border-[var(--border-subtle)] mb-1">
                <p className="text-xs font-semibold text-[var(--text-primary)] truncate">{contextGroup.data.title}</p>
                <p className="text-[10px] text-[var(--text-tertiary)]">Group</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  const id = contextGroup.id;
                  setContextMenu(null);
                  requestGroupRename(id);
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)] transition-colors"
              >
                <Pencil size={13} />
                Rename
              </button>
              <div className="border-t border-[var(--border-subtle)] mt-1 pt-1">
                <button
                  type="button"
                  onClick={() => deleteGroup(contextGroup.id)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-[var(--error)] hover:bg-[var(--error-soft)] transition-colors"
                >
                  <Ungroup size={13} />
                  Ungroup (keep services)
                </button>
              </div>
            </>
          )}

          {contextMenu.kind === 'service' && contextService && (
            <>
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
