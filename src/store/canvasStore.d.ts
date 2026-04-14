import type { Node as ReactFlowNode, Edge as ReactFlowEdge } from '@xyflow/react';
import type { ServiceNode, ServiceEdge } from '../types';
interface CanvasState {
    nodes: ReactFlowNode[];
    edges: ReactFlowEdge[];
    selectedNode: string | null;
    isCommandPaletteOpen: boolean;
    sidebarOpen: boolean;
    showEmptyCanvas: boolean;
    setNodes: (nodes: ReactFlowNode[]) => void;
    setEdges: (edges: ReactFlowEdge[]) => void;
    addNode: (node: ServiceNode) => void;
    removeNode: (nodeId: string) => void;
    updateNode: (nodeId: string, updates: Partial<ServiceNode>) => void;
    addEdge: (edge: ServiceEdge) => void;
    removeEdge: (edgeId: string) => void;
    setSelectedNode: (nodeId: string | null) => void;
    setCommandPaletteOpen: (open: boolean) => void;
    setSidebarOpen: (open: boolean) => void;
    onConnect: (params: any) => void;
}
export declare const useCanvasStore: import("zustand").UseBoundStore<import("zustand").StoreApi<CanvasState>>;
export {};
