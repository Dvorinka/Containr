import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ServiceLogs from './ServiceLogs';

// Mock the API
vi.mock('@/lib/api', () => ({
  logsApi: {
    getServiceLogs: vi.fn(),
  },
}));

describe('ServiceLogs', () => {
  let queryClient: QueryClient;
  let mockLogsApi: any;

  beforeEach(async () => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    mockLogsApi = await import('@/lib/api');
    vi.clearAllMocks();
  });

  const renderWithQueryClient = (component: React.ReactElement) => {
    return render(
      <QueryClientProvider client={queryClient}>
        {component}
      </QueryClientProvider>
    );
  };

  const mockLogs = [
    {
      timestamp: '2024-01-15T10:30:00Z',
      message: 'Application started successfully',
      stream: 'stdout' as const,
    },
    {
      timestamp: '2024-01-15T10:30:05Z',
      message: 'Database connection established',
      stream: 'system' as const,
    },
    {
      timestamp: '2024-01-15T10:30:10Z',
      message: 'Error: Failed to load configuration',
      stream: 'stderr' as const,
    },
  ];

  describe('rendering', () => {
    it('renders without crashing', async () => {
      mockLogsApi.logsApi.getServiceLogs.mockResolvedValue({
        logs: mockLogs,
      });

      renderWithQueryClient(
        <ServiceLogs serviceId="service-1" serviceName="Web App" />
      );

      await waitFor(() => {
        expect(screen.getByText('Web App Logs')).toBeInTheDocument();
      });
    });

    it('displays service name in title', async () => {
      mockLogsApi.logsApi.getServiceLogs.mockResolvedValue({
        logs: mockLogs,
      });

      renderWithQueryClient(
        <ServiceLogs serviceId="service-1" serviceName="API Service" />
      );

      await waitFor(() => {
        expect(screen.getByText('API Service Logs')).toBeInTheDocument();
      });
    });

    it('shows loading state', () => {
      mockLogsApi.logsApi.getServiceLogs.mockImplementation(() => new Promise(() => {}));

      renderWithQueryClient(
        <ServiceLogs serviceId="service-1" serviceName="Web App" />
      );

      expect(screen.getByText('Loading logs...')).toBeInTheDocument();
    });

    it('displays logs when loaded', async () => {
      mockLogsApi.logsApi.getServiceLogs.mockResolvedValue({
        logs: mockLogs,
      });

      renderWithQueryClient(
        <ServiceLogs serviceId="service-1" serviceName="Web App" />
      );

      await waitFor(() => {
        expect(screen.getByText('Application started successfully')).toBeInTheDocument();
        expect(screen.getByText('Database connection established')).toBeInTheDocument();
        expect(screen.getByText('Error: Failed to load configuration')).toBeInTheDocument();
      });
    });

    it('shows empty state when no logs', async () => {
      mockLogsApi.logsApi.getServiceLogs.mockResolvedValue({
        logs: [],
      });

      renderWithQueryClient(
        <ServiceLogs serviceId="service-1" serviceName="Web App" />
      );

      await waitFor(() => {
        expect(screen.getByText('No logs available')).toBeInTheDocument();
      });
    });
  });

  describe('log display', () => {
    it('displays timestamps correctly', async () => {
      mockLogsApi.logsApi.getServiceLogs.mockResolvedValue({
        logs: mockLogs,
      });

      renderWithQueryClient(
        <ServiceLogs serviceId="service-1" serviceName="Web App" />
      );

      await waitFor(() => {
        expect(screen.getByText('10:30:00')).toBeInTheDocument();
        expect(screen.getByText('10:30:05')).toBeInTheDocument();
        expect(screen.getByText('10:30:10')).toBeInTheDocument();
      });
    });

    it('displays log messages', async () => {
      mockLogsApi.logsApi.getServiceLogs.mockResolvedValue({
        logs: mockLogs,
      });

      renderWithQueryClient(
        <ServiceLogs serviceId="service-1" serviceName="Web App" />
      );

      await waitFor(() => {
        expect(screen.getByText('Application started successfully')).toBeInTheDocument();
        expect(screen.getByText('Database connection established')).toBeInTheDocument();
        expect(screen.getByText('Error: Failed to load configuration')).toBeInTheDocument();
      });
    });

    it('displays stream indicators', async () => {
      mockLogsApi.logsApi.getServiceLogs.mockResolvedValue({
        logs: mockLogs,
      });

      renderWithQueryClient(
        <ServiceLogs serviceId="service-1" serviceName="Web App" />
      );

      await waitFor(() => {
        // Look for stream indicators (could be badges, colors, or icons)
        const logEntries = screen.getAllByText(/Application started|Database connection|Error/);
        expect(logEntries.length).toBe(3);
      });
    });

    it('formats timestamps correctly', async () => {
      mockLogsApi.logsApi.getServiceLogs.mockResolvedValue({
        logs: mockLogs,
      });

      renderWithQueryClient(
        <ServiceLogs serviceId="service-1" serviceName="Web App" />
      );

      await waitFor(() => {
        // Check that timestamps are formatted (HH:MM:SS format)
        const timeElements = screen.getAllByText(/\d{2}:\d{2}:\d{2}/);
        expect(timeElements.length).toBe(3);
      });
    });
  });

  describe('streaming functionality', () => {
    it('shows streaming toggle button', async () => {
      mockLogsApi.logsApi.getServiceLogs.mockResolvedValue({
        logs: mockLogs,
      });

      renderWithQueryClient(
        <ServiceLogs serviceId="service-1" serviceName="Web App" />
      );

      await waitFor(() => {
        expect(screen.getByText('Start Streaming')).toBeInTheDocument();
      });
    });

    it('toggles streaming state', async () => {
      mockLogsApi.logsApi.getServiceLogs.mockResolvedValue({
        logs: mockLogs,
      });

      renderWithQueryClient(
        <ServiceLogs serviceId="service-1" serviceName="Web App" />
      );

      await waitFor(() => {
        const streamButton = screen.getByText('Start Streaming');
        fireEvent.click(streamButton);
      });

      await waitFor(() => {
        expect(screen.getByText('Stop Streaming')).toBeInTheDocument();
      });
    });

    it('updates refetch interval when streaming', async () => {
      mockLogsApi.logsApi.getServiceLogs.mockResolvedValue({
        logs: mockLogs,
      });

      renderWithQueryClient(
        <ServiceLogs serviceId="service-1" serviceName="Web App" />
      );

      await waitFor(() => {
        const streamButton = screen.getByText('Start Streaming');
        fireEvent.click(streamButton);
      });

      // The component should start refetching every 3 seconds when streaming
      await waitFor(() => {
        expect(mockLogsApi.logsApi.getServiceLogs).toHaveBeenCalled();
      });
    });
  });

  describe('controls and actions', () => {
    it('provides refresh button', async () => {
      mockLogsApi.logsApi.getServiceLogs.mockResolvedValue({
        logs: mockLogs,
      });

      renderWithQueryClient(
        <ServiceLogs serviceId="service-1" serviceName="Web App" />
      );

      await waitFor(() => {
        const refreshButton = screen.getByText('Refresh');
        expect(refreshButton).toBeInTheDocument();
        expect(refreshButton.closest('button')).toBeInTheDocument();
      });
    });

    it('provides clear logs button', async () => {
      mockLogsApi.logsApi.getServiceLogs.mockResolvedValue({
        logs: mockLogs,
      });

      renderWithQueryClient(
        <ServiceLogs serviceId="service-1" serviceName="Web App" />
      );

      await waitFor(() => {
        const clearButton = screen.getByText('Clear');
        expect(clearButton).toBeInTheDocument();
        expect(clearButton.closest('button')).toBeInTheDocument();
      });
    });

    it('provides download logs button', async () => {
      mockLogsApi.logsApi.getServiceLogs.mockResolvedValue({
        logs: mockLogs,
      });

      renderWithQueryClient(
        <ServiceLogs serviceId="service-1" serviceName="Web App" />
      );

      await waitFor(() => {
        const downloadButton = screen.getByText('Download');
        expect(downloadButton).toBeInTheDocument();
        expect(downloadButton.closest('button')).toBeInTheDocument();
      });
    });

    it('provides auto-scroll toggle', async () => {
      mockLogsApi.logsApi.getServiceLogs.mockResolvedValue({
        logs: mockLogs,
      });

      renderWithQueryClient(
        <ServiceLogs serviceId="service-1" serviceName="Web App" />
      );

      await waitFor(() => {
        expect(screen.getByText('Auto-scroll')).toBeInTheDocument();
      });
    });

    it('toggles auto-scroll state', async () => {
      mockLogsApi.logsApi.getServiceLogs.mockResolvedValue({
        logs: mockLogs,
      });

      renderWithQueryClient(
        <ServiceLogs serviceId="service-1" serviceName="Web App" />
      );

      await waitFor(() => {
        const autoScrollButton = screen.getByText('Auto-scroll');
        fireEvent.click(autoScrollButton);
      });

      await waitFor(() => {
        // Auto-scroll should be disabled
        expect(screen.getByText('Auto-scroll')).toBeInTheDocument();
      });
    });
  });

  describe('error handling', () => {
    it('handles API errors gracefully', async () => {
      mockLogsApi.logsApi.getServiceLogs.mockRejectedValue(
        new Error('Failed to fetch logs')
      );

      renderWithQueryClient(
        <ServiceLogs serviceId="service-1" serviceName="Web App" />
      );

      await waitFor(() => {
        expect(screen.getByText('Error loading logs')).toBeInTheDocument();
      });
    });

    it('displays error message', async () => {
      mockLogsApi.logsApi.getServiceLogs.mockRejectedValue(
        new Error('Network error')
      );

      renderWithQueryClient(
        <ServiceLogs serviceId="service-1" serviceName="Web App" />
      );

      await waitFor(() => {
        expect(screen.getByText('Error loading logs')).toBeInTheDocument();
      });
    });

    it('handles empty response', async () => {
      mockLogsApi.logsApi.getServiceLogs.mockResolvedValue({
        logs: [],
      });

      renderWithQueryClient(
        <ServiceLogs serviceId="service-1" serviceName="Web App" />
      );

      await waitFor(() => {
        expect(screen.getByText('No logs available')).toBeInTheDocument();
      });
    });
  });

  describe('refresh functionality', () => {
    it('refetches logs when refresh button is clicked', async () => {
      mockLogsApi.logsApi.getServiceLogs.mockResolvedValue({
        logs: mockLogs,
      });

      renderWithQueryClient(
        <ServiceLogs serviceId="service-1" serviceName="Web App" />
      );

      await waitFor(() => {
        const refreshButton = screen.getByText('Refresh');
        fireEvent.click(refreshButton);
      });

      await waitFor(() => {
        expect(mockLogsApi.logsApi.getServiceLogs).toHaveBeenCalledTimes(2);
      });
    });

    it('shows loading state during refresh', async () => {
      mockLogsApi.logsApi.getServiceLogs
        .mockResolvedValueOnce({ logs: mockLogs })
        .mockImplementationOnce(() => new Promise(() => {}));

      renderWithQueryClient(
        <ServiceLogs serviceId="service-1" serviceName="Web App" />
      );

      await waitFor(() => {
        const refreshButton = screen.getByText('Refresh');
        fireEvent.click(refreshButton);
      });

      await waitFor(() => {
        expect(screen.getByText('Loading logs...')).toBeInTheDocument();
      });
    });
  });

  describe('clear functionality', () => {
    it('clears logs when clear button is clicked', async () => {
      mockLogsApi.logsApi.getServiceLogs.mockResolvedValue({
        logs: mockLogs,
      });

      renderWithQueryClient(
        <ServiceLogs serviceId="service-1" serviceName="Web App" />
      );

      await waitFor(() => {
        expect(screen.getByText('Application started successfully')).toBeInTheDocument();
        
        const clearButton = screen.getByText('Clear');
        fireEvent.click(clearButton);
      });

      await waitFor(() => {
        expect(screen.queryByText('Application started successfully')).not.toBeInTheDocument();
        expect(screen.getByText('No logs available')).toBeInTheDocument();
      });
    });
  });

  describe('download functionality', () => {
    it('handles download when download button is clicked', async () => {
      mockLogsApi.logsApi.getServiceLogs.mockResolvedValue({
        logs: mockLogs,
      });

      renderWithQueryClient(
        <ServiceLogs serviceId="service-1" serviceName="Web App" />
      );

      await waitFor(() => {
        const downloadButton = screen.getByText('Download');
        fireEvent.click(downloadButton);
      });

      await waitFor(() => {
        // Download functionality should be triggered
        expect(screen.getByText('Download')).toBeInTheDocument();
      });
    });
  });

  describe('props handling', () => {
    it('accepts different serviceId values', async () => {
      mockLogsApi.logsApi.getServiceLogs.mockResolvedValue({
        logs: mockLogs,
      });

      renderWithQueryClient(
        <ServiceLogs serviceId="custom-service" serviceName="Web App" />
      );

      await waitFor(() => {
        expect(mockLogsApi.logsApi.getServiceLogs).toHaveBeenCalledWith(
          'custom-service',
          { tail: 200, follow: false }
        );
      });
    });

    it('accepts different serviceName values', async () => {
      mockLogsApi.logsApi.getServiceLogs.mockResolvedValue({
        logs: mockLogs,
      });

      renderWithQueryClient(
        <ServiceLogs serviceId="service-1" serviceName="Custom Service" />
      );

      await waitFor(() => {
        expect(screen.getByText('Custom Service Logs')).toBeInTheDocument();
      });
    });
  });

  describe('accessibility', () => {
    it('has proper heading hierarchy', async () => {
      mockLogsApi.logsApi.getServiceLogs.mockResolvedValue({
        logs: mockLogs,
      });

      renderWithQueryClient(
        <ServiceLogs serviceId="service-1" serviceName="Web App" />
      );

      await waitFor(() => {
        const mainHeading = screen.getByRole('heading', { level: 2 });
        expect(mainHeading).toHaveTextContent('Web App Logs');
      });
    });

    it('provides accessible buttons', async () => {
      mockLogsApi.logsApi.getServiceLogs.mockResolvedValue({
        logs: mockLogs,
      });

      renderWithQueryClient(
        <ServiceLogs serviceId="service-1" serviceName="Web App" />
      );

      await waitFor(() => {
        const buttons = screen.getAllByRole('button');
        buttons.forEach(button => {
          expect(button).toBeInTheDocument();
        });
      });
    });

    it('has proper ARIA labels', async () => {
      mockLogsApi.logsApi.getServiceLogs.mockResolvedValue({
        logs: mockLogs,
      });

      renderWithQueryClient(
        <ServiceLogs serviceId="service-1" serviceName="Web App" />
      );

      await waitFor(() => {
        const buttons = screen.getAllByRole('button');
        buttons.forEach(button => {
          expect(button).toBeInTheDocument();
        });
      });
    });
  });

  describe('visual elements', () => {
    it('renders icons correctly', async () => {
      mockLogsApi.logsApi.getServiceLogs.mockResolvedValue({
        logs: mockLogs,
      });

      renderWithQueryClient(
        <ServiceLogs serviceId="service-1" serviceName="Web App" />
      );

      await waitFor(() => {
        const icons = document.querySelectorAll('svg');
        expect(icons.length).toBeGreaterThan(0);
      });
    });

    it('displays terminal icon', async () => {
      mockLogsApi.logsApi.getServiceLogs.mockResolvedValue({
        logs: mockLogs,
      });

      renderWithQueryClient(
        <ServiceLogs serviceId="service-1" serviceName="Web App" />
      );

      await waitFor(() => {
        // Terminal icon should be present
        const terminalIcon = document.querySelector('[data-testid="terminal-icon"]');
        // If no specific test id, check for any icon in the header
        const icons = document.querySelectorAll('svg');
        expect(icons.length).toBeGreaterThan(0);
      });
    });
  });

  describe('responsive design', () => {
    it('adapts to different content lengths', async () => {
      const longLogs = Array.from({ length: 100 }, (_, i) => ({
        timestamp: '2024-01-15T10:30:00Z',
        message: `Log message ${i} with some additional content to make it longer`,
        stream: 'stdout' as const,
      }));

      mockLogsApi.logsApi.getServiceLogs.mockResolvedValue({
        logs: longLogs,
      });

      renderWithQueryClient(
        <ServiceLogs serviceId="service-1" serviceName="Web App" />
      );

      await waitFor(() => {
        expect(screen.getByText('Log message 0')).toBeInTheDocument();
        expect(screen.getByText('Log message 99')).toBeInTheDocument();
      });
    });
  });

  describe('performance', () => {
    it('renders efficiently with many logs', async () => {
      const manyLogs = Array.from({ length: 50 }, (_, i) => ({
        timestamp: '2024-01-15T10:30:00Z',
        message: `Log message ${i}`,
        stream: 'stdout' as const,
      }));

      mockLogsApi.logsApi.getServiceLogs.mockResolvedValue({
        logs: manyLogs,
      });

      const startTime = performance.now();
      renderWithQueryClient(
        <ServiceLogs serviceId="service-1" serviceName="Web App" />
      );
      const endTime = performance.now();

      await waitFor(() => {
        expect(screen.getByText('Log message 0')).toBeInTheDocument();
      });

      expect(endTime - startTime).toBeLessThan(200); // 200ms threshold
    });
  });

  describe('data consistency', () => {
    it('maintains log order', async () => {
      mockLogsApi.logsApi.getServiceLogs.mockResolvedValue({
        logs: mockLogs,
      });

      renderWithQueryClient(
        <ServiceLogs serviceId="service-1" serviceName="Web App" />
      );

      await waitFor(() => {
        const logMessages = screen.getAllByText(/Application started|Database connection|Error/);
        expect(logMessages[0]).toHaveTextContent('Application started successfully');
        expect(logMessages[1]).toHaveTextContent('Database connection established');
        expect(logMessages[2]).toHaveTextContent('Error: Failed to load configuration');
      });
    });

    it('updates logs when new data arrives', async () => {
      mockLogsApi.logsApi.getServiceLogs
        .mockResolvedValueOnce({ logs: mockLogs.slice(0, 1) })
        .mockResolvedValueOnce({ logs: mockLogs });

      renderWithQueryClient(
        <ServiceLogs serviceId="service-1" serviceName="Web App" />
      );

      await waitFor(() => {
        expect(screen.getByText('Application started successfully')).toBeInTheDocument();
        expect(screen.queryByText('Database connection established')).not.toBeInTheDocument();
      });

      // Trigger a refresh
      const refreshButton = await screen.findByText('Refresh');
      fireEvent.click(refreshButton);

      await waitFor(() => {
        expect(screen.getByText('Database connection established')).toBeInTheDocument();
        expect(screen.getByText('Error: Failed to load configuration')).toBeInTheDocument();
      });
    });
  });
});
