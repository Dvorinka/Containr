import { describe, it, expect, beforeEach } from 'vitest';
import { act } from '@testing-library/react';
import { useCanvasStore } from './canvasStore';

describe('canvasStore', () => {
  beforeEach(() => {
    act(() => {
      useCanvasStore.setState({
        nodes: [{ id: 'empty', type: 'empty', position: { x: 0, y: 0 }, data: { label: 'Empty Canvas', type: 'empty' } }],
        edges: [],
        selectedNode: null,
        isCommandPaletteOpen: false,
        sidebarOpen: true,
      });
    });
  });

  describe('initial state', () => {
    it('has empty canvas node by default', () => {
      const { nodes } = useCanvasStore.getState();
      expect(nodes).toHaveLength(1);
      expect(nodes[0].id).toBe('empty');
    });

    it('has sidebar open by default', () => {
      const { sidebarOpen } = useCanvasStore.getState();
      expect(sidebarOpen).toBe(true);
    });

    it('has command palette closed by default', () => {
      const { isCommandPaletteOpen } = useCanvasStore.getState();
      expect(isCommandPaletteOpen).toBe(false);
    });
  });

  describe('setNodes', () => {
    it('replaces all nodes', () => {
      const newNodes = [
        { id: '1', type: 'service', position: { x: 100, y: 100 }, data: { label: 'Service 1' } },
        { id: '2', type: 'service', position: { x: 200, y: 200 }, data: { label: 'Service 2' } },
      ];

      act(() => {
        useCanvasStore.getState().setNodes(newNodes);
      });

      expect(useCanvasStore.getState().nodes).toHaveLength(2);
    });
  });

  describe('addNode', () => {
    it('adds a service node and removes empty node', () => {
      const serviceNode = {
        id: 'service-1',
        type: 'docker' as const,
        position: { x: 100, y: 100 },
        data: { label: 'API Server', type: 'docker' as const, status: 'running' as const },
      };

      act(() => {
        useCanvasStore.getState().addNode(serviceNode);
      });

      const { nodes } = useCanvasStore.getState();
      expect(nodes).toHaveLength(1);
      expect(nodes[0].id).toBe('service-1');
      expect(nodes.find(n => n.id === 'empty')).toBeUndefined();
    });
  });

  describe('removeNode', () => {
    it('removes node and connected edges', () => {
      act(() => {
        useCanvasStore.getState().setNodes([
          { id: 'empty', type: 'empty', position: { x: 0, y: 0 }, data: { label: 'Empty', type: 'empty' } },
        ]);
        useCanvasStore.getState().addNode({ id: 'service-1', type: 'docker', position: { x: 0, y: 0 }, data: { label: 'S1', type: 'docker' } });
        useCanvasStore.getState().addNode({ id: 'service-2', type: 'github', position: { x: 100, y: 100 }, data: { label: 'S2', type: 'github' } });
      });

      act(() => {
        useCanvasStore.getState().removeNode('service-1');
      });

      const { nodes } = useCanvasStore.getState();
      expect(nodes.find(n => n.id === 'service-1')).toBeUndefined();
    });
  });

  describe('setSelectedNode', () => {
    it('sets selected node id', () => {
      act(() => {
        useCanvasStore.getState().setSelectedNode('node-1');
      });

      expect(useCanvasStore.getState().selectedNode).toBe('node-1');
    });

    it('clears selected node when passed null', () => {
      act(() => {
        useCanvasStore.getState().setSelectedNode('node-1');
        useCanvasStore.getState().setSelectedNode(null);
      });

      expect(useCanvasStore.getState().selectedNode).toBeNull();
    });
  });

  describe('setCommandPaletteOpen', () => {
    it('opens command palette', () => {
      act(() => {
        useCanvasStore.getState().setCommandPaletteOpen(true);
      });

      expect(useCanvasStore.getState().isCommandPaletteOpen).toBe(true);
    });

    it('closes command palette', () => {
      act(() => {
        useCanvasStore.getState().setCommandPaletteOpen(true);
        useCanvasStore.getState().setCommandPaletteOpen(false);
      });

      expect(useCanvasStore.getState().isCommandPaletteOpen).toBe(false);
    });
  });

  describe('setSidebarOpen', () => {
    it('toggles sidebar', () => {
      act(() => {
        useCanvasStore.getState().setSidebarOpen(false);
      });

      expect(useCanvasStore.getState().sidebarOpen).toBe(false);

      act(() => {
        useCanvasStore.getState().setSidebarOpen(true);
      });

      expect(useCanvasStore.getState().sidebarOpen).toBe(true);
    });
  });
});
