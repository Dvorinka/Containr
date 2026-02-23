import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import CommandPalette from './CommandPalette';
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

describe('CommandPalette', () => {
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

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('does not render when open is false', () => {
      render(<CommandPalette open={false} onClose={vi.fn()} />, { wrapper: createWrapper() });
      
      expect(screen.queryByPlaceholderText('What would you like to create?')).not.toBeInTheDocument();
    });

    it('renders when open is true', () => {
      render(<CommandPalette open={true} onClose={vi.fn()} />, { wrapper: createWrapper() });
      
      expect(screen.getByPlaceholderText('What would you like to create?')).toBeInTheDocument();
    });

    it('renders all service options', () => {
      render(<CommandPalette open={true} onClose={vi.fn()} />, { wrapper: createWrapper() });
      
      expect(screen.getByText('GitHub Repository')).toBeInTheDocument();
      expect(screen.getByText('PostgreSQL')).toBeInTheDocument();
      expect(screen.getByText('Redis')).toBeInTheDocument();
      expect(screen.getByText('Docker Image')).toBeInTheDocument();
      expect(screen.getByText('Serverless Function')).toBeInTheDocument();
      expect(screen.getByText('Storage Bucket')).toBeInTheDocument();
    });

    it('renders quick actions when search is empty', () => {
      render(<CommandPalette open={true} onClose={vi.fn()} />, { wrapper: createWrapper() });
      
      expect(screen.getByText('New Project')).toBeInTheDocument();
      expect(screen.getByText('Add Server')).toBeInTheDocument();
    });

    it('shows keyboard shortcuts hint', () => {
      render(<CommandPalette open={true} onClose={vi.fn()} />, { wrapper: createWrapper() });
      
      expect(screen.getByText('Navigate')).toBeInTheDocument();
      expect(screen.getByText('Select')).toBeInTheDocument();
      expect(screen.getByText('Close')).toBeInTheDocument();
    });
  });

  describe('keyboard interactions', () => {
    it('closes on Escape key', async () => {
      const onClose = vi.fn();
      render(<CommandPalette open={true} onClose={onClose} />, { wrapper: createWrapper() });
      
      fireEvent.keyDown(document.body, { key: 'Escape' });
      
      expect(onClose).toHaveBeenCalled();
    });

    it('closes on Cmd+K', async () => {
      const onClose = vi.fn();
      render(<CommandPalette open={true} onClose={onClose} />, { wrapper: createWrapper() });
      
      fireEvent.keyDown(document.body, { key: 'k', metaKey: true });
      
      await waitFor(() => {
        expect(onClose).toHaveBeenCalled();
      });
    });

    it('closes on Ctrl+K', async () => {
      const onClose = vi.fn();
      render(<CommandPalette open={true} onClose={onClose} />, { wrapper: createWrapper() });
      
      fireEvent.keyDown(document.body, { key: 'k', ctrlKey: true });
      
      await waitFor(() => {
        expect(onClose).toHaveBeenCalled();
      });
    });
  });

  describe('search functionality', () => {
    it('shows PostgreSQL when searching for postgres', async () => {
      render(<CommandPalette open={true} onClose={vi.fn()} />, { wrapper: createWrapper() });
      
      const input = screen.getByPlaceholderText('What would you like to create?');
      await userEvent.type(input, 'postgres');
      
      expect(screen.getByText('PostgreSQL')).toBeInTheDocument();
    });

    it('shows empty state when no results match', async () => {
      render(<CommandPalette open={true} onClose={vi.fn()} />, { wrapper: createWrapper() });
      
      const input = screen.getByPlaceholderText('What would you like to create?');
      await userEvent.type(input, 'nonexistent');
      
      expect(screen.getByText('No services found.')).toBeInTheDocument();
    });

    it('hides quick actions when searching', async () => {
      render(<CommandPalette open={true} onClose={vi.fn()} />, { wrapper: createWrapper() });
      
      const input = screen.getByPlaceholderText('What would you like to create?');
      await userEvent.type(input, 'git');
      
      expect(screen.queryByText('New Project')).not.toBeInTheDocument();
    });
  });

  describe('service selection', () => {
    it('adds node when service is selected', async () => {
      const onClose = vi.fn();
      render(<CommandPalette open={true} onClose={onClose} />, { wrapper: createWrapper() });
      
      const githubOption = screen.getByText('GitHub Repository');
      await userEvent.click(githubOption);
      
      expect(mockAddNode).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'github',
          data: expect.objectContaining({
            label: 'GitHub Repository',
            type: 'github',
          }),
        })
      );
      expect(onClose).toHaveBeenCalled();
    });

    it('generates unique node IDs', async () => {
      render(<CommandPalette open={true} onClose={vi.fn()} />, { wrapper: createWrapper() });
      
      const dockerOption = screen.getByText('Docker Image');
      await userEvent.click(dockerOption);
      
      const call = mockAddNode.mock.calls[0][0];
      expect(call.id).toMatch(/^docker-\d+$/);
    });

    it('adds repo data for GitHub type', async () => {
      render(<CommandPalette open={true} onClose={vi.fn()} />, { wrapper: createWrapper() });
      
      const githubOption = screen.getByText('GitHub Repository');
      await userEvent.click(githubOption);
      
      expect(mockAddNode).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            repo: 'user/repo',
          }),
        })
      );
    });
  });

  describe('body scroll lock', () => {
    it('locks body scroll when open', () => {
      render(<CommandPalette open={true} onClose={vi.fn()} />, { wrapper: createWrapper() });
      
      expect(document.body.style.overflow).toBe('hidden');
    });

    it('restores body scroll when closed', () => {
      const { unmount } = render(<CommandPalette open={true} onClose={vi.fn()} />, { wrapper: createWrapper() });
      
      unmount();
      
      expect(document.body.style.overflow).toBe('');
    });
  });
});
