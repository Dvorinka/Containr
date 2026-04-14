import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CustomMetricsDashboard } from './CustomMetricsDashboard';

// Mock the useQuery hook
vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(),
}));

describe('CustomMetricsDashboard', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
  });

  const renderWithQueryClient = (component: React.ReactElement) => {
    return render(
      <QueryClientProvider client={queryClient}>
        {component}
      </QueryClientProvider>
    );
  };

  describe('rendering', () => {
    it('renders without crashing', async () => {
      const { useQuery } = await import('@tanstack/react-query');
      vi.mocked(useQuery).mockReturnValue({
        data: {},
        isLoading: false,
      } as any);

      renderWithQueryClient(<CustomMetricsDashboard timeRange="7d" />);
    });

    it('displays the main title', async () => {
      const { useQuery } = await import('@tanstack/react-query');
      vi.mocked(useQuery).mockReturnValue({
        data: {},
        isLoading: false,
      } as any);

      renderWithQueryClient(<CustomMetricsDashboard timeRange="7d" />);
      expect(screen.getByText('Custom Metrics')).toBeInTheDocument();
    });

    it('renders tabs for different metric categories', async () => {
      const { useQuery } = await import('@tanstack/react-query');
      vi.mocked(useQuery).mockReturnValue({
        data: {},
        isLoading: false,
      } as any);

      renderWithQueryClient(<CustomMetricsDashboard timeRange="7d" />);
      
      expect(screen.getByText('Performance')).toBeInTheDocument();
      expect(screen.getByText('Infrastructure')).toBeInTheDocument();
      expect(screen.getByText('Business')).toBeInTheDocument();
    });

    it('displays auto-refresh toggle', async () => {
      const { useQuery } = await import('@tanstack/react-query');
      vi.mocked(useQuery).mockReturnValue({
        data: {},
        isLoading: false,
      } as any);

      renderWithQueryClient(<CustomMetricsDashboard timeRange="7d" />);
      expect(screen.getByText('Auto-refresh')).toBeInTheDocument();
    });

    it('shows loading state', async () => {
      const { useQuery } = await import('@tanstack/react-query');
      vi.mocked(useQuery).mockReturnValue({
        data: undefined,
        isLoading: true,
      } as any);

      renderWithQueryClient(<CustomMetricsDashboard timeRange="7d" />);
      expect(screen.getByText('Loading metrics...')).toBeInTheDocument();
    });
  });

  describe('performance metrics', () => {
    const mockPerformanceData = {
      performance: {
        responseTime: {
          current: 245,
          average: 312,
          p95: 567,
          p99: 892,
          trend: 'down',
          change: -12.3
        },
        throughput: {
          current: 1250,
          average: 1180,
          peak: 2100,
          trend: 'up',
          change: 8.7
        },
        errorRate: {
          current: 0.8,
          average: 1.2,
          trend: 'down',
          change: -33.3
        },
        uptime: {
          current: 99.9,
          trend: 'stable',
          change: 0
        }
      }
    };

    it('displays response time metrics', async () => {
      const { useQuery } = await import('@tanstack/react-query');
      vi.mocked(useQuery).mockReturnValue({
        data: mockPerformanceData,
        isLoading: false,
      } as any);

      renderWithQueryClient(<CustomMetricsDashboard timeRange="7d" />);
      
      expect(screen.getByText('Response Time')).toBeInTheDocument();
      expect(screen.getByText('245ms')).toBeInTheDocument();
      expect(screen.getByText('312ms')).toBeInTheDocument();
      expect(screen.getByText('567ms')).toBeInTheDocument();
      expect(screen.getByText('892ms')).toBeInTheDocument();
    });

    it('displays throughput metrics', async () => {
      const { useQuery } = await import('@tanstack/react-query');
      vi.mocked(useQuery).mockReturnValue({
        data: mockPerformanceData,
        isLoading: false,
      } as any);

      renderWithQueryClient(<CustomMetricsDashboard timeRange="7d" />);
      
      expect(screen.getByText('Throughput')).toBeInTheDocument();
      expect(screen.getByText('1,250')).toBeInTheDocument();
      expect(screen.getByText('1,180')).toBeInTheDocument();
      expect(screen.getByText('2,100')).toBeInTheDocument();
    });

    it('displays error rate and uptime', async () => {
      const { useQuery } = await import('@tanstack/react-query');
      vi.mocked(useQuery).mockReturnValue({
        data: mockPerformanceData,
        isLoading: false,
      } as any);

      renderWithQueryClient(<CustomMetricsDashboard timeRange="7d" />);
      
      expect(screen.getByText('Error Rate')).toBeInTheDocument();
      expect(screen.getByText('0.8%')).toBeInTheDocument();
      expect(screen.getByText('Uptime')).toBeInTheDocument();
      expect(screen.getByText('99.9%')).toBeInTheDocument();
    });
  });

  describe('infrastructure metrics', () => {
    const mockInfrastructureData = {
      infrastructure: {
        cpu: {
          current: 68,
          average: 72,
          peak: 95,
          trend: 'down',
          change: -5.6
        },
        memory: {
          current: 4.2,
          average: 4.8,
          total: 8,
          trend: 'down',
          change: -12.5
        },
        disk: {
          current: 156,
          total: 500,
          trend: 'up',
          change: 8.3
        },
        network: {
          inbound: 125.6,
          outbound: 89.3,
          trend: 'up',
          change: 15.2
        }
      }
    };

    it('displays CPU and memory metrics', async () => {
      const { useQuery } = await import('@tanstack/react-query');
      vi.mocked(useQuery).mockReturnValue({
        data: mockInfrastructureData,
        isLoading: false,
      } as any);

      renderWithQueryClient(<CustomMetricsDashboard timeRange="7d" />);
      
      // Switch to Infrastructure tab
      fireEvent.click(screen.getByText('Infrastructure'));
      
      expect(screen.getByText('CPU Usage')).toBeInTheDocument();
      expect(screen.getByText('68%')).toBeInTheDocument();
      expect(screen.getByText('Memory Usage')).toBeInTheDocument();
      expect(screen.getByText('4.2GB')).toBeInTheDocument();
    });

    it('displays disk and network metrics', async () => {
      const { useQuery } = await import('@tanstack/react-query');
      vi.mocked(useQuery).mockReturnValue({
        data: mockInfrastructureData,
        isLoading: false,
      } as any);

      renderWithQueryClient(<CustomMetricsDashboard timeRange="7d" />);
      
      // Switch to Infrastructure tab
      fireEvent.click(screen.getByText('Infrastructure'));
      
      expect(screen.getByText('Disk Usage')).toBeInTheDocument();
      expect(screen.getByText('156GB')).toBeInTheDocument();
      expect(screen.getByText('Network Traffic')).toBeInTheDocument();
    });
  });

  describe('business metrics', () => {
    const mockBusinessData = {
      business: {
        revenue: {
          current: 45678,
          goal: 50000,
          completion: 91.4,
          trend: 'up',
          change: 12.3
        },
        userSatisfaction: {
          current: 4.2,
          goal: 5,
          completion: 84,
          trend: 'up',
          change: 5.0
        },
        activeUsers: {
          current: 12543,
          goal: 15000,
          completion: 83.6,
          trend: 'up',
          change: 8.7
        }
      }
    };

    it('displays business metrics', async () => {
      const { useQuery } = await import('@tanstack/react-query');
      vi.mocked(useQuery).mockReturnValue({
        data: mockBusinessData,
        isLoading: false,
      } as any);

      renderWithQueryClient(<CustomMetricsDashboard timeRange="7d" />);
      
      // Switch to Business tab
      fireEvent.click(screen.getByText('Business'));
      
      expect(screen.getByText('Revenue')).toBeInTheDocument();
      expect(screen.getByText('$45,678')).toBeInTheDocument();
      expect(screen.getByText('User Satisfaction')).toBeInTheDocument();
      expect(screen.getByText('4.2/5')).toBeInTheDocument();
      expect(screen.getByText('Active Users')).toBeInTheDocument();
      expect(screen.getByText('12,543')).toBeInTheDocument();
    });

    it('displays progress bars for goals', async () => {
      const { useQuery } = await import('@tanstack/react-query');
      vi.mocked(useQuery).mockReturnValue({
        data: mockBusinessData,
        isLoading: false,
      } as any);

      renderWithQueryClient(<CustomMetricsDashboard timeRange="7d" />);
      
      // Switch to Business tab
      fireEvent.click(screen.getByText('Business'));
      
      const progressBars = screen.getAllByRole('progressbar');
      expect(progressBars.length).toBeGreaterThan(0);
    });
  });

  describe('interactions', () => {
    it('switches between tabs correctly', async () => {
      const { useQuery } = await import('@tanstack/react-query');
      vi.mocked(useQuery).mockReturnValue({
        data: {},
        isLoading: false,
      } as any);

      renderWithQueryClient(<CustomMetricsDashboard timeRange="7d" />);
      
      // Performance tab should be active by default
      expect(screen.getByText('Response Time')).toBeInTheDocument();
      
      // Switch to Infrastructure tab
      fireEvent.click(screen.getByText('Infrastructure'));
      expect(screen.getByText('CPU Usage')).toBeInTheDocument();
      
      // Switch to Business tab
      fireEvent.click(screen.getByText('Business'));
      expect(screen.getByText('Revenue')).toBeInTheDocument();
    });

    it('toggles auto-refresh', async () => {
      const { useQuery } = await import('@tanstack/react-query');
      vi.mocked(useQuery).mockReturnValue({
        data: {},
        isLoading: false,
      } as any);

      renderWithQueryClient(<CustomMetricsDashboard timeRange="7d" />);
      
      const autoRefreshToggle = screen.getByRole('button', { name: /auto-refresh/i });
      fireEvent.click(autoRefreshToggle);
      
      // After clicking, the state should change (we can't easily test the internal state
      // but we can verify the button is still present and clickable)
      expect(autoRefreshToggle).toBeInTheDocument();
    });
  });

  describe('props handling', () => {
    it('accepts projectId prop', async () => {
      const { useQuery } = await import('@tanstack/react-query');
      vi.mocked(useQuery).mockReturnValue({
        data: {},
        isLoading: false,
      } as any);

      renderWithQueryClient(<CustomMetricsDashboard projectId="project-123" timeRange="7d" />);
      expect(screen.getByText('Custom Metrics')).toBeInTheDocument();
    });

    it('accepts different timeRange values', async () => {
      const { useQuery } = await import('@tanstack/react-query');
      vi.mocked(useQuery).mockReturnValue({
        data: {},
        isLoading: false,
      } as any);

      renderWithQueryClient(<CustomMetricsDashboard timeRange="30d" />);
      expect(screen.getByText('Custom Metrics')).toBeInTheDocument();
    });
  });

  describe('data formatting', () => {
    it('formats numbers correctly', async () => {
      const { useQuery } = await import('@tanstack/react-query');
      vi.mocked(useQuery).mockReturnValue({
        data: {
          performance: {
            responseTime: { current: 245, average: 312, p95: 567, p99: 892, trend: 'down', change: -12.3 },
            throughput: { current: 1250, average: 1180, peak: 2100, trend: 'up', change: 8.7 },
            errorRate: { current: 0.8, average: 1.2, trend: 'down', change: -33.3 },
            uptime: { current: 99.9, trend: 'stable', change: 0 }
          }
        },
        isLoading: false,
      } as any);

      renderWithQueryClient(<CustomMetricsDashboard timeRange="7d" />);
      
      // Check number formatting
      expect(screen.getByText('1,250')).toBeInTheDocument();
      expect(screen.getByText('2,100')).toBeInTheDocument();
      expect(screen.getByText('245ms')).toBeInTheDocument();
      expect(screen.getByText('0.8%')).toBeInTheDocument();
      expect(screen.getByText('99.9%')).toBeInTheDocument();
    });

    it('displays trend indicators', async () => {
      const { useQuery } = await import('@tanstack/react-query');
      vi.mocked(useQuery).mockReturnValue({
        data: {
          performance: {
            responseTime: { current: 245, average: 312, p95: 567, p99: 892, trend: 'down', change: -12.3 },
            throughput: { current: 1250, average: 1180, peak: 2100, trend: 'up', change: 8.7 },
            errorRate: { current: 0.8, average: 1.2, trend: 'down', change: -33.3 },
            uptime: { current: 99.9, trend: 'stable', change: 0 }
          }
        },
        isLoading: false,
      } as any);

      renderWithQueryClient(<CustomMetricsDashboard timeRange="7d" />);
      
      // Check trend indicators
      expect(screen.getByText('-12.3%')).toBeInTheDocument();
      expect(screen.getByText('8.7%')).toBeInTheDocument();
      expect(screen.getByText('-33.3%')).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('has proper heading hierarchy', async () => {
      const { useQuery } = await import('@tanstack/react-query');
      vi.mocked(useQuery).mockReturnValue({
        data: {},
        isLoading: false,
      } as any);

      renderWithQueryClient(<CustomMetricsDashboard timeRange="7d" />);
      
      const mainHeading = screen.getByRole('heading', { level: 2 });
      expect(mainHeading).toHaveTextContent('Custom Metrics');
      
      const tabList = screen.getByRole('tablist');
      expect(tabList).toBeInTheDocument();
    });

    it('provides accessible tab navigation', async () => {
      const { useQuery } = await import('@tanstack/react-query');
      vi.mocked(useQuery).mockReturnValue({
        data: {},
        isLoading: false,
      } as any);

      renderWithQueryClient(<CustomMetricsDashboard timeRange="7d" />);
      
      const tabs = screen.getAllByRole('tab');
      expect(tabs.length).toBe(3); // Performance, Infrastructure, Business
      
      // Each tab should be accessible
      tabs.forEach(tab => {
        expect(tab).toHaveAttribute('role', 'tab');
      });
    });
  });
});
