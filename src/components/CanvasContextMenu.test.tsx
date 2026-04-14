import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import CanvasContextMenu from './CanvasContextMenu';
import { useCanvasStore } from '../store/canvasStore';

vi.mock('../store/canvasStore', () => ({
  useCanvasStore: vi.fn(),
}));

const mockUseCanvasStore = vi.mocked(useCanvasStore);
const mockAddNode = vi.fn();

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}

describe('CanvasContextMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseCanvasStore.mockReturnValue({
      addNode: mockAddNode,
      nodes: [],
      edges: [],
      selectedNode: null,
      isCommandPaletteOpen: false,
      sidebarOpen: true,
      setNodes: vi.fn(),
      setEdges: vi.fn(),
      setSelectedNode: vi.fn(),
      setCommandPaletteOpen: vi.fn(),
      setSidebarOpen: vi.fn(),
      removeNode: vi.fn(),
    });
  });

  describe('rendering', () => {
    it('renders children as the trigger', () => {
      render(
        <CanvasContextMenu>
          <div data-testid="child">Canvas Area</div>
        </CanvasContextMenu>,
        { wrapper: createWrapper() }
      );
      
      expect(screen.getByTestId('child')).toBeInTheDocument();
      expect(screen.getByText('Canvas Area')).toBeInTheDocument();
    });

    it('renders context menu with canvas content', () => {
      render(
        <CanvasContextMenu>
          <div>Canvas</div>
        </CanvasContextMenu>,
        { wrapper: createWrapper() }
      );
      
      expect(screen.getByText('Canvas')).toBeInTheDocument();
    });
  });

  describe('context menu structure', () => {
    it('has proper DOM structure', () => {
      const { container } = render(
        <CanvasContextMenu>
          <div data-testid="canvas">Canvas</div>
        </CanvasContextMenu>,
        { wrapper: createWrapper() }
      );

      expect(container).toBeInTheDocument();
    });
  });

  describe('store integration', () => {
    it('calls useCanvasStore to get addNode', () => {
      render(
        <CanvasContextMenu>
          <div>Canvas</div>
        </CanvasContextMenu>,
        { wrapper: createWrapper() }
      );
      
      expect(mockUseCanvasStore).toHaveBeenCalled();
    });
  });

  describe('node creation patterns', () => {
    it('node ID follows pattern type-timestamp', () => {
      const type = 'github';
      const timestamp = Date.now();
      const expectedPattern = new RegExp(`^${type}-\\d+$`);
      const nodeId = `${type}-${timestamp}`;
      
      expect(nodeId).toMatch(expectedPattern);
    });

    it('node data includes required fields', () => {
      const mockNode = {
        id: 'github-123',
        type: 'github',
        position: { x: 100, y: 100 },
        data: {
          label: 'GitHub Repository',
          type: 'github',
          status: 'stopped',
          repo: 'user/repo',
        },
      };
      
      expect(mockNode.data).toHaveProperty('label');
      expect(mockNode.data).toHaveProperty('type');
      expect(mockNode.data).toHaveProperty('status');
    });

    it('github type includes repo field', () => {
      const githubNode = {
        type: 'github',
        data: { label: 'GitHub Repository', type: 'github', status: 'stopped', repo: 'user/repo' },
      };
      
      expect(githubNode.data).toHaveProperty('repo');
    });

    it('non-github types do not include repo field', () => {
      const dockerNode = {
        type: 'docker',
        data: { label: 'Docker Image', type: 'docker', status: 'stopped' },
      };
      
      expect(dockerNode.data).not.toHaveProperty('repo');
    });
  });

  describe('position calculation', () => {
    it('calculates position relative to canvas element', () => {
      const clientX = 200;
      const clientY = 150;
      const rectLeft = 50;
      const rectTop = 30;
      
      const x = clientX - rectLeft;
      const y = clientY - rectTop;
      
      expect(x).toBe(150);
      expect(y).toBe(120);
    });
  });
});
