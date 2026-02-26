import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import Layout from './Layout';

vi.mock('../store/canvasStore', () => ({
  useCanvasStore: vi.fn(),
}));

vi.mock('../hooks/useAuth', () => ({
  useAuth: vi.fn(),
}));

vi.mock('./CommandPalette', () => ({
  default: ({ open, onClose }: { open: boolean; onClose: () => void }) => (
    open ? <div data-testid="command-palette">Command Palette</div> : null
  ),
}));

import { useCanvasStore } from '../store/canvasStore';
import { useAuth } from '../hooks/useAuth';

const mockUseCanvasStore = vi.mocked(useCanvasStore);
const mockUseAuth = vi.mocked(useAuth);

const mockSetCommandPaletteOpen = vi.fn();
const mockSetSidebarOpen = vi.fn();
const mockLogout = vi.fn();
const mockNavigate = vi.fn();

function createWrapper(initialRoute = '/') {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialRoute]}>
        {children}
      </MemoryRouter>
    </QueryClientProvider>
  );
}

const createMockStore = () => ({
  isCommandPaletteOpen: false,
  setCommandPaletteOpen: mockSetCommandPaletteOpen,
  sidebarOpen: true,
  setSidebarOpen: mockSetSidebarOpen,
  addNode: vi.fn(),
  nodes: [],
  edges: [],
  selectedNode: null,
  setNodes: vi.fn(),
  setEdges: vi.fn(),
  setSelectedNode: vi.fn(),
  removeNode: vi.fn(),
});

const createMockAuth = (overrides = {}) => ({
  user: { id: '1', name: 'Test User', email: 'test@example.com', created_at: '', updated_at: '' },
  isLoading: false,
  isAuthenticating: false,
  isAuthenticated: true,
  login: vi.fn(),
  register: vi.fn(),
  logout: mockLogout,
  ...overrides,
});

describe('Layout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseCanvasStore.mockReturnValue(createMockStore());
    mockUseAuth.mockReturnValue(createMockAuth());
    vi.mock('react-router-dom', async () => {
      const actual = await vi.importActual('react-router-dom');
      return {
        ...actual,
        useNavigate: () => mockNavigate,
      };
    });
  });

  describe('rendering', () => {
    it('renders sidebar with logo', () => {
      render(<Layout />, { wrapper: createWrapper() });
      
      expect(screen.getAllByText('Containr').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Self-hosted PaaS').length).toBeGreaterThan(0);
    });

    it('renders navigation items', () => {
      render(<Layout />, { wrapper: createWrapper() });
      
      expect(screen.getAllByText('Dashboard').length).toBeGreaterThan(0);
      expect(screen.getByText('Projects')).toBeInTheDocument();
      expect(screen.getByText('Analytics')).toBeInTheDocument();
      expect(screen.getByText('Git Integration')).toBeInTheDocument();
      expect(screen.getByText('Infrastructure')).toBeInTheDocument();
      expect(screen.getAllByText('Settings').length).toBeGreaterThan(0);
    });

    it('renders user avatar with initials', () => {
      render(<Layout />, { wrapper: createWrapper() });
      
      expect(screen.getByText('T')).toBeInTheDocument();
    });

    it('renders documentation section', () => {
      render(<Layout />, { wrapper: createWrapper() });
      
      expect(screen.getByText('Documentation')).toBeInTheDocument();
      expect(screen.getByText('Learn how to deploy your first service')).toBeInTheDocument();
    });

    it('renders quick search button', () => {
      render(<Layout />, { wrapper: createWrapper() });
      
      expect(screen.getByText('Quick Search')).toBeInTheDocument();
    });

    it('renders new deployment button', () => {
      render(<Layout />, { wrapper: createWrapper() });
      
      expect(screen.getAllByText('New Deployment').length).toBeGreaterThan(0);
    });
  });

  describe('page title', () => {
    it('shows Dashboard as default title', () => {
      render(<Layout />, { wrapper: createWrapper() });
      
      expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
    });

    it('shows Projects title on projects page', () => {
      render(<Layout />, { wrapper: createWrapper('/projects') });
      
      expect(screen.getByRole('heading', { name: 'Projects' })).toBeInTheDocument();
    });

    it('shows Analytics title on analytics page', () => {
      render(<Layout />, { wrapper: createWrapper('/analytics') });
      
      expect(screen.getByRole('heading', { name: 'Analytics' })).toBeInTheDocument();
    });
  });

  describe('status badge', () => {
    it('shows operational status on dashboard', () => {
      render(<Layout />, { wrapper: createWrapper() });
      
      expect(screen.getByText('All systems operational')).toBeInTheDocument();
    });

    it('hides operational status on other pages', () => {
      render(<Layout />, { wrapper: createWrapper('/projects') });
      
      expect(screen.queryByText('All systems operational')).not.toBeInTheDocument();
    });
  });

  describe('command palette', () => {
    it('opens command palette when quick search clicked', () => {
      render(<Layout />, { wrapper: createWrapper() });
      
      const quickSearchButton = screen.getByText('Quick Search');
      fireEvent.click(quickSearchButton);
      
      expect(mockSetCommandPaletteOpen).toHaveBeenCalledWith(true);
    });

    it('opens command palette when new deployment clicked', () => {
      render(<Layout />, { wrapper: createWrapper() });
      
      const newDeploymentButton = screen.getByText('New Deployment');
      fireEvent.click(newDeploymentButton);
      
      expect(mockSetCommandPaletteOpen).toHaveBeenCalledWith(true);
    });
  });

  describe('sidebar toggle', () => {
    it('toggles sidebar when menu button clicked', () => {
      render(<Layout />, { wrapper: createWrapper() });
      
      const toggleButtons = screen.getAllByRole('button').filter(btn => {
        const svg = btn.querySelector('svg');
        return svg && (svg.classList.contains('lucide-x') || svg.classList.contains('lucide-menu'));
      });
      
      expect(toggleButtons.length).toBeGreaterThan(0);
    });
  });

  describe('user dropdown', () => {
    it('displays user avatar in header', () => {
      render(<Layout />, { wrapper: createWrapper() });
      
      expect(screen.getByText('T')).toBeInTheDocument();
    });

    it('displays fallback when user has no name', () => {
      mockUseAuth.mockReturnValue(createMockAuth({
        user: { id: '1', name: '', email: 'user@test.com', created_at: '', updated_at: '' },
      }));
      
      render(<Layout />, { wrapper: createWrapper() });
      
      expect(screen.getByText('u')).toBeInTheDocument();
    });
  });

  describe('navigation badges', () => {
    it('shows count badges on navigation items', () => {
      render(<Layout />, { wrapper: createWrapper() });
      
      expect(screen.getByText('12')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
      expect(screen.getByText('5')).toBeInTheDocument();
    });

    it('shows Beta badge on Canvas', () => {
      render(<Layout />, { wrapper: createWrapper() });
      
      expect(screen.getByText('Beta')).toBeInTheDocument();
    });
  });

  describe('section grouping', () => {
    it('renders navigation sections', () => {
      render(<Layout />, { wrapper: createWrapper() });
      
      expect(screen.getByText('Overview')).toBeInTheDocument();
      expect(screen.getByText('Build')).toBeInTheDocument();
      expect(screen.getByText('Deploy')).toBeInTheDocument();
      expect(screen.getByText('Resources')).toBeInTheDocument();
      expect(screen.getAllByText('Security').length).toBeGreaterThan(0);
    });
  });
});
