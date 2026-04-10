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
import type { ServiceEntity } from '@/lib/api-client';
import { inferAutoConnections, type ServiceVariable } from '../auto-connections';
import {
  type CanvasGroup,
  type CanvasNodeLayout,
  type ProjectCanvasMetadata,
} from '../model';
import { loadCanvasMetadata, saveCanvasMetadata } from '../storage';
import { GroupNode, ServiceNode, type GroupNodeData, type ServiceNodeData } from './nodes';
import { Plus, Layers, Maximize2, RotateCcw, Box, Link2 } from 'lucide-react';

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

function toFlowEdges(links: ReturnType<typeof inferAutoConnections>): CanvasEdge[] {
  return links.map((link) => ({
    id: link.edge.id,
    source: link.edge.sourceServiceId,
    target: link.edge.targetServiceId,
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
      stroke: '#e8316a',
      strokeWidth: 2,
    },
    className: 'edge-premium',
  }));
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
  const [nodes, setNodes, onNodesChange] = useNodesState<CanvasNode>([]);
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [viewportTick, setViewportTick] = useState(0);

  const { fitView, getInternalNode, getViewport, screenToFlowPosition, setViewport } = useReactFlow<CanvasNode, CanvasEdge>();

  const serviceFingerprint = useMemo(
    () => services.map((service) => service.id).sort().join('|'),
    [services],
  );
  const inferredLinks = useMemo(
    () => inferAutoConnections(services, variablesByService),
    [services, variablesByService],
  );
  const edges = useMemo(() => toFlowEdges(inferredLinks), [inferredLinks]);

  useEffect(() => {
    const metadata = loadCanvasMetadata(projectId, services);
    const nextNodes = toFlowNodes(metadata, services, onOpenService);

    setNodes(nextNodes);

    window.requestAnimationFrame(() => {
      setViewport(metadata.viewport, { duration: 120 });
    });

    hydratedRef.current = true;
  }, [projectId, serviceFingerprint, onOpenService, setNodes, setViewport, services]);

  useEffect(() => {
    if (!hydratedRef.current) {
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
          className="flex items-center gap-2 h-9 px-4 rounded-lg text-white text-sm font-medium shadow-lg hover:shadow-xl transition-all duration-200"
          style={{ background: '#e8316a' }}
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
      <div ref={wrapperRef} className="subtle-grid h-[66vh] min-h-[420px] bg-[var(--bg-void)]">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onPaneClick={() => setSelectedServiceId(null)}
          onNodeClick={(_event, node) => {
            if (node.type === 'serviceNode') {
              setSelectedServiceId(node.id);
            }
          }}
          onNodeDoubleClick={(_event, node) => {
            if (node.type === 'serviceNode') {
              onOpenService(node.id);
            }
          }}
          onNodeDragStop={onNodeDragStop}
          onMoveEnd={() => setViewportTick((value) => value + 1)}
          fitView
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
            Click a service to select • Double-click to open • Drag to reposition • Connections auto-inferred from variables
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
