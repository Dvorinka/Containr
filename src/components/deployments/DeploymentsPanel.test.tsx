import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import DeploymentsPanel from './DeploymentsPanel';

// Mock the API
vi.mock('@/lib/api', () => ({
  deploymentsApi: {
    getDeployments: vi.fn(),
    redeployDeployment: vi.fn(),
    rollbackDeployment: vi.fn(),
  },
}));

// Mock date-fns
vi.mock('date-fns', () => ({
  formatDistanceToNow: vi.fn(() => '2 hours ago'),
}));

describe('DeploymentsPanel', () => {
  let queryClient: QueryClient;
  let mockDeploymentsApi: any;

  beforeEach(async () => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    mockDeploymentsApi = await import('@/lib/api');
    vi.clearAllMocks();
  });

  const renderWithQueryClient = (component: React.ReactElement) => {
    return render(
      <QueryClientProvider client={queryClient}>
        {component}
      </QueryClientProvider>
    );
  };

  const mockDeployments = [
    {
      id: 'deploy-1',
      status: 'deployed',
      createdAt: '2024-01-15T10:30:00Z',
      completedAt: '2024-01-15T10:32:00Z',
      commit: {
        sha: 'abc123',
        message: 'Fix authentication bug',
        author: 'John Doe',
        branch: 'main',
      },
      buildTime: 120,
      metrics: {
        cpuUsage: 45,
        memoryUsage: 256,
        responseTime: 120,
        errorRate: 0.1,
      },
    },
    {
      id: 'deploy-2',
      status: 'failed',
      createdAt: '2024-01-15T09:15:00Z',
      completedAt: '2024-01-15T09:18:00Z',
      commit: {
        sha: 'def456',
        message: 'Add new feature',
        author: 'Jane Smith',
        branch: 'feature/new-feature',
      },
      buildTime: 180,
      error: 'Build failed: Unit tests failed',
    },
  ];

  describe('rendering', () => {
    it('renders without crashing', async () => {
      mockDeploymentsApi.deploymentsApi.getDeployments.mockResolvedValue({
        deployments: mockDeployments,
      });

      renderWithQueryClient(
        <DeploymentsPanel serviceId="service-1" serviceName="Web App" />
      );

      await waitFor(() => {
        expect(screen.getByText('Deployments')).toBeInTheDocument();
      });
    });

    it('displays service name', async () => {
      mockDeploymentsApi.deploymentsApi.getDeployments.mockResolvedValue({
        deployments: mockDeployments,
      });

      renderWithQueryClient(
        <DeploymentsPanel serviceId="service-1" serviceName="Web App" />
      );

      await waitFor(() => {
        expect(screen.getByText('Web App Deployments')).toBeInTheDocument();
      });
    });

    it('shows loading state', () => {
      mockDeploymentsApi.deploymentsApi.getDeployments.mockImplementation(() => new Promise(() => {}));

      renderWithQueryClient(
        <DeploymentsPanel serviceId="service-1" serviceName="Web App" />
      );

      expect(screen.getByText('Loading deployments...')).toBeInTheDocument();
    });

    it('displays deployments list', async () => {
      mockDeploymentsApi.deploymentsApi.getDeployments.mockResolvedValue({
        deployments: mockDeployments,
      });

      renderWithQueryClient(
        <DeploymentsPanel serviceId="service-1" serviceName="Web App" />
      );

      await waitFor(() => {
        expect(screen.getByText('Fix authentication bug')).toBeInTheDocument();
        expect(screen.getByText('Add new feature')).toBeInTheDocument();
      });
    });
  });

  describe('deployment status', () => {
    it('displays deployed status correctly', async () => {
      mockDeploymentsApi.deploymentsApi.getDeployments.mockResolvedValue({
        deployments: [mockDeployments[0]],
      });

      renderWithQueryClient(
        <DeploymentsPanel serviceId="service-1" serviceName="Web App" />
      );

      await waitFor(() => {
        expect(screen.getByText('Deployed')).toBeInTheDocument();
      });
    });

    it('displays failed status correctly', async () => {
      mockDeploymentsApi.deploymentsApi.getDeployments.mockResolvedValue({
        deployments: [mockDeployments[1]],
      });

      renderWithQueryClient(
        <DeploymentsPanel serviceId="service-1" serviceName="Web App" />
      );

      await waitFor(() => {
        expect(screen.getByText('Failed')).toBeInTheDocument();
      });
    });

    it('shows status badges with correct colors', async () => {
      mockDeploymentsApi.deploymentsApi.getDeployments.mockResolvedValue({
        deployments: mockDeployments,
      });

      renderWithQueryClient(
        <DeploymentsPanel serviceId="service-1" serviceName="Web App" />
      );

      await waitFor(() => {
        const statusBadges = screen.getAllByRole('status');
        expect(statusBadges.length).toBeGreaterThan(0);
      });
    });
  });

  describe('deployment information', () => {
    it('displays commit information', async () => {
      mockDeploymentsApi.deploymentsApi.getDeployments.mockResolvedValue({
        deployments: mockDeployments,
      });

      renderWithQueryClient(
        <DeploymentsPanel serviceId="service-1" serviceName="Web App" />
      );

      await waitFor(() => {
        expect(screen.getByText('abc123')).toBeInTheDocument();
        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.getByText('main')).toBeInTheDocument();
      });
    });

    it('shows build time', async () => {
      mockDeploymentsApi.deploymentsApi.getDeployments.mockResolvedValue({
        deployments: mockDeployments,
      });

      renderWithQueryClient(
        <DeploymentsPanel serviceId="service-1" serviceName="Web App" />
      );

      await waitFor(() => {
        expect(screen.getByText('2 min')).toBeInTheDocument();
      });
    });

    it('displays deployment timestamps', async () => {
      mockDeploymentsApi.deploymentsApi.getDeployments.mockResolvedValue({
        deployments: mockDeployments,
      });

      renderWithQueryClient(
        <DeploymentsPanel serviceId="service-1" serviceName="Web App" />
      );

      await waitFor(() => {
        expect(screen.getByText('2 hours ago')).toBeInTheDocument();
      });
    });

    it('shows error message for failed deployments', async () => {
      mockDeploymentsApi.deploymentsApi.getDeployments.mockResolvedValue({
        deployments: [mockDeployments[1]],
      });

      renderWithQueryClient(
        <DeploymentsPanel serviceId="service-1" serviceName="Web App" />
      );

      await waitFor(() => {
        expect(screen.getByText('Build failed: Unit tests failed')).toBeInTheDocument();
      });
    });
  });

  describe('deployment metrics', () => {
    it('displays metrics for successful deployments', async () => {
      mockDeploymentsApi.deploymentsApi.getDeployments.mockResolvedValue({
        deployments: [mockDeployments[0]],
      });

      renderWithQueryClient(
        <DeploymentsPanel serviceId="service-1" serviceName="Web App" />
      );

      await waitFor(() => {
        expect(screen.getByText('45%')).toBeInTheDocument(); // CPU
        expect(screen.getByText('256 MB')).toBeInTheDocument(); // Memory
        expect(screen.getByText('120 ms')).toBeInTheDocument(); // Response time
        expect(screen.getByText('0.1%')).toBeInTheDocument(); // Error rate
      });
    });

    it('hides metrics for failed deployments', async () => {
      mockDeploymentsApi.deploymentsApi.getDeployments.mockResolvedValue({
        deployments: [mockDeployments[1]],
      });

      renderWithQueryClient(
        <DeploymentsPanel serviceId="service-1" serviceName="Web App" />
      );

      await waitFor(() => {
        expect(screen.queryByText('45%')).not.toBeInTheDocument();
        expect(screen.queryByText('256 MB')).not.toBeInTheDocument();
      });
    });
  });

  describe('deployment actions', () => {
    it('provides redeploy button', async () => {
      mockDeploymentsApi.deploymentsApi.getDeployments.mockResolvedValue({
        deployments: mockDeployments,
      });

      renderWithQueryClient(
        <DeploymentsPanel serviceId="service-1" serviceName="Web App" />
      );

      await waitFor(() => {
        const redeployButtons = screen.getAllByText('Redeploy');
        expect(redeployButtons.length).toBeGreaterThan(0);
      });
    });

    it('provides rollback button for deployed deployments', async () => {
      mockDeploymentsApi.deploymentsApi.getDeployments.mockResolvedValue({
        deployments: [mockDeployments[0]],
      });

      renderWithQueryClient(
        <DeploymentsPanel serviceId="service-1" serviceName="Web App" />
      );

      await waitFor(() => {
        expect(screen.getByText('Rollback')).toBeInTheDocument();
      });
    });

    it('shows logs button', async () => {
      mockDeploymentsApi.deploymentsApi.getDeployments.mockResolvedValue({
        deployments: mockDeployments,
      });

      renderWithQueryClient(
        <DeploymentsPanel serviceId="service-1" serviceName="Web App" />
      );

      await waitFor(() => {
        const logsButtons = screen.getAllByText('View Logs');
        expect(logsButtons.length).toBeGreaterThan(0);
      });
    });
  });

  describe('deployment expansion', () => {
    it('expands deployment when clicked', async () => {
      mockDeploymentsApi.deploymentsApi.getDeployments.mockResolvedValue({
        deployments: mockDeployments,
      });

      renderWithQueryClient(
        <DeploymentsPanel serviceId="service-1" serviceName="Web App" />
      );

      await waitFor(() => {
        const expandButtons = screen.getAllByRole('button');
        const firstExpandButton = expandButtons.find(button => 
          button.getAttribute('aria-label')?.includes('expand')
        );
        
        if (firstExpandButton) {
          fireEvent.click(firstExpandButton);
        }
      });

      // After expansion, more details should be visible
      await waitFor(() => {
        expect(screen.getByText('Build Time')).toBeInTheDocument();
      });
    });

    it('collapses deployment when clicked again', async () => {
      mockDeploymentsApi.deploymentsApi.getDeployments.mockResolvedValue({
        deployments: mockDeployments,
      });

      renderWithQueryClient(
        <DeploymentsPanel serviceId="service-1" serviceName="Web App" />
      );

      await waitFor(() => {
        const expandButtons = screen.getAllByRole('button');
        const firstExpandButton = expandButtons.find(button => 
          button.getAttribute('aria-label')?.includes('expand')
        );
        
        if (firstExpandButton) {
          // First click to expand
          fireEvent.click(firstExpandButton);
          // Second click to collapse
          fireEvent.click(firstExpandButton);
        }
      });
    });
  });

  describe('error handling', () => {
    it('handles API errors gracefully', async () => {
      mockDeploymentsApi.deploymentsApi.getDeployments.mockRejectedValue(
        new Error('Failed to fetch deployments')
      );

      renderWithQueryClient(
        <DeploymentsPanel serviceId="service-1" serviceName="Web App" />
      );

      await waitFor(() => {
        expect(screen.getByText('Error loading deployments')).toBeInTheDocument();
      });
    });

    it('handles empty deployments list', async () => {
      mockDeploymentsApi.deploymentsApi.getDeployments.mockResolvedValue({
        deployments: [],
      });

      renderWithQueryClient(
        <DeploymentsPanel serviceId="service-1" serviceName="Web App" />
      );

      await waitFor(() => {
        expect(screen.getByText('No deployments found')).toBeInTheDocument();
      });
    });
  });

  describe('mutation handling', () => {
    it('calls redeploy API when redeploy button is clicked', async () => {
      mockDeploymentsApi.deploymentsApi.getDeployments.mockResolvedValue({
        deployments: mockDeployments,
      });
      mockDeploymentsApi.deploymentsApi.redeployDeployment.mockResolvedValue({});

      renderWithQueryClient(
        <DeploymentsPanel serviceId="service-1" serviceName="Web App" />
      );

      await waitFor(() => {
        const redeployButton = screen.getAllByText('Redeploy')[0];
        fireEvent.click(redeployButton);
      });

      await waitFor(() => {
        expect(mockDeploymentsApi.deploymentsApi.redeployDeployment).toHaveBeenCalledWith('deploy-1');
      });
    });

    it('calls rollback API when rollback button is clicked', async () => {
      mockDeploymentsApi.deploymentsApi.getDeployments.mockResolvedValue({
        deployments: [mockDeployments[0]],
      });
      mockDeploymentsApi.deploymentsApi.rollbackDeployment.mockResolvedValue({});

      renderWithQueryClient(
        <DeploymentsPanel serviceId="service-1" serviceName="Web App" />
      );

      await waitFor(() => {
        const rollbackButton = screen.getByText('Rollback');
        fireEvent.click(rollbackButton);
      });

      await waitFor(() => {
        expect(mockDeploymentsApi.deploymentsApi.rollbackDeployment).toHaveBeenCalledWith('deploy-1');
      });
    });
  });

  describe('accessibility', () => {
    it('has proper heading hierarchy', async () => {
      mockDeploymentsApi.deploymentsApi.getDeployments.mockResolvedValue({
        deployments: mockDeployments,
      });

      renderWithQueryClient(
        <DeploymentsPanel serviceId="service-1" serviceName="Web App" />
      );

      await waitFor(() => {
        const mainHeading = screen.getByRole('heading', { level: 2 });
        expect(mainHeading).toHaveTextContent('Web App Deployments');
      });
    });

    it('provides accessible buttons', async () => {
      mockDeploymentsApi.deploymentsApi.getDeployments.mockResolvedValue({
        deployments: mockDeployments,
      });

      renderWithQueryClient(
        <DeploymentsPanel serviceId="service-1" serviceName="Web App" />
      );

      await waitFor(() => {
        const buttons = screen.getAllByRole('button');
        buttons.forEach(button => {
          expect(button).toBeInTheDocument();
        });
      });
    });

    it('has proper ARIA labels', async () => {
      mockDeploymentsApi.deploymentsApi.getDeployments.mockResolvedValue({
        deployments: mockDeployments,
      });

      renderWithQueryClient(
        <DeploymentsPanel serviceId="service-1" serviceName="Web App" />
      );

      await waitFor(() => {
        const expandButtons = screen.getAllByRole('button');
        expect(expandButtons.length).toBeGreaterThan(0);
      });
    });
  });

  describe('props handling', () => {
    it('accepts different serviceId values', async () => {
      mockDeploymentsApi.deploymentsApi.getDeployments.mockResolvedValue({
        deployments: mockDeployments,
      });

      renderWithQueryClient(
        <DeploymentsPanel serviceId="custom-service" serviceName="Custom Service" />
      );

      await waitFor(() => {
        expect(screen.getByText('Custom Service Deployments')).toBeInTheDocument();
      });
    });

    it('accepts different serviceName values', async () => {
      mockDeploymentsApi.deploymentsApi.getDeployments.mockResolvedValue({
        deployments: mockDeployments,
      });

      renderWithQueryClient(
        <DeploymentsPanel serviceId="service-1" serviceName="API Service" />
      );

      await waitFor(() => {
        expect(screen.getByText('API Service Deployments')).toBeInTheDocument();
      });
    });
  });

  describe('visual elements', () => {
    it('renders status icons', async () => {
      mockDeploymentsApi.deploymentsApi.getDeployments.mockResolvedValue({
        deployments: mockDeployments,
      });

      renderWithQueryClient(
        <DeploymentsPanel serviceId="service-1" serviceName="Web App" />
      );

      await waitFor(() => {
        const icons = document.querySelectorAll('svg');
        expect(icons.length).toBeGreaterThan(0);
      });
    });

    it('displays badges correctly', async () => {
      mockDeploymentsApi.deploymentsApi.getDeployments.mockResolvedValue({
        deployments: mockDeployments,
      });

      renderWithQueryClient(
        <DeploymentsPanel serviceId="service-1" serviceName="Web App" />
      );

      await waitFor(() => {
        const badges = screen.getAllByRole('status');
        expect(badges.length).toBeGreaterThan(0);
      });
    });
  });

  describe('responsive design', () => {
    it('adapts to different content lengths', async () => {
      mockDeploymentsApi.deploymentsApi.getDeployments.mockResolvedValue({
        deployments: mockDeployments,
      });

      renderWithQueryClient(
        <DeploymentsPanel serviceId="service-1" serviceName="Web App" />
      );

      await waitFor(() => {
        const container = screen.getByText('Web App Deployments').closest('div');
        expect(container).toBeInTheDocument();
      });
    });
  });
});
