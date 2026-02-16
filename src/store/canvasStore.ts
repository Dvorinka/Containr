import { create } from 'zustand';
import type { Node as ReactFlowNode, Edge as ReactFlowEdge } from '@xyflow/react';
import { addEdge } from '@xyflow/react';
import type { ServiceNode, ServiceEdge } from '../types';

interface CanvasState {
  nodes: ReactFlowNode[];
  edges: ReactFlowEdge[];
  selectedNode: string | null;
  isCommandPaletteOpen: boolean;
  sidebarOpen: boolean;
  
  // Computed
  showEmptyCanvas: boolean;
  
  // Actions
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

const initialNodes: ReactFlowNode[] = [
  {
    id: 'empty',
    type: 'empty',
    position: { x: 0, y: 0 },
    data: { 
      label: 'Empty Canvas', 
      type: 'empty' 
    },
  },
];

const initialEdges: ReactFlowEdge[] = [];

export const useCanvasStore = create<CanvasState>((set, get) => ({
  nodes: initialNodes,
  edges: initialEdges,
  selectedNode: null,
  isCommandPaletteOpen: false,
  sidebarOpen: true,
  
  get showEmptyCanvas() {
    const serviceNodes = get().nodes.filter(node => node.type === 'service');
    return serviceNodes.length === 0;
  },

  setNodes: (nodes) => set({ nodes }),
  
  setEdges: (edges) => set({ edges }),

  addNode: (serviceNode) => set((state) => {
    const newNode: ReactFlowNode = {
      id: serviceNode.id,
      type: 'service',
      position: serviceNode.position,
      data: serviceNode.data,
    };
    
    // Remove empty node if it exists and add the new service node
    const filteredNodes = state.nodes.filter(node => node.id !== 'empty');
    return { nodes: [...filteredNodes, newNode] };
  }),

  removeNode: (nodeId) => set((state) => {
    const filteredNodes = state.nodes.filter(node => node.id !== nodeId);
    const filteredEdges = state.edges.filter(edge => edge.source !== nodeId && edge.target !== nodeId);
    
    // Add empty node back if no service nodes remain
    const serviceNodes = filteredNodes.filter(node => node.type === 'service');
    const finalNodes = serviceNodes.length === 0 
      ? [{ id: 'empty', type: 'empty', position: { x: 0, y: 0 }, data: { label: 'Empty Canvas', type: 'empty' } }]
      : filteredNodes;
    
    return { nodes: finalNodes, edges: filteredEdges };
  }),

  updateNode: (nodeId, updates) => set((state) => ({
    nodes: state.nodes.map(node => 
      node.id === nodeId 
        ? { ...node, data: { ...node.data, ...updates.data } }
        : node
    ),
  })),

  addEdge: (serviceEdge) => set((state) => {
    const newEdge: ReactFlowEdge = {
      id: serviceEdge.id,
      source: serviceEdge.source,
      target: serviceEdge.target,
      type: serviceEdge.type || 'animated',
      animated: serviceEdge.animated ?? true,
    };
    return { edges: addEdge(newEdge, state.edges) };
  }),

  removeEdge: (edgeId) => set((state) => ({
    edges: state.edges.filter(edge => edge.id !== edgeId),
  })),

  setSelectedNode: (nodeId) => set({ selectedNode: nodeId }),

  setCommandPaletteOpen: (open) => set({ isCommandPaletteOpen: open }),

  setSidebarOpen: (open) => set({ sidebarOpen: open }),

  onConnect: (params) => set((state) => {
    const newEdge: ReactFlowEdge = {
      id: `${params.source}-${params.target}`,
      source: params.source,
      target: params.target,
      type: 'animated',
      animated: true,
    };
    return { edges: addEdge(newEdge, state.edges) };
  }),
}));
