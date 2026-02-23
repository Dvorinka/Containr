import { create } from 'zustand';
import { addEdge } from '@xyflow/react';
const initialNodes = [
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
const initialEdges = [];
export const useCanvasStore = create((set, get) => ({
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
        const newNode = {
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
        nodes: state.nodes.map(node => node.id === nodeId
            ? { ...node, data: { ...node.data, ...updates.data } }
            : node),
    })),
    addEdge: (serviceEdge) => set((state) => {
        const newEdge = {
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
        const newEdge = {
            id: `${params.source}-${params.target}`,
            source: params.source,
            target: params.target,
            type: 'animated',
            animated: true,
        };
        return { edges: addEdge(newEdge, state.edges) };
    }),
}));
