import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AnalyticsOverview } from './AnalyticsOverview';

vi.mock('@/lib/api', () => ({
  analyticsApi: {
    getOverview: vi.fn(),
  },
}));

import { analyticsApi } from '@/lib/api';

const mockAnalyticsApi = vi.mocked(analyticsApi);

const mockOverviewData = {
  visitors: { current: 12500, previous: 11000, change: 12, trend: 'up' as const },
  pageviews: { current: 45000, previous: 42000, change: 8, trend: 'up' as const },
  sessions: { current: 8900, previous: 8500, change: 5, trend: 'up' as const },
  bounceRate: { current: 35, previous: 38, change: -3, trend: 'down' as const },
  sessionDuration: { current: 180, previous: 165, change: 10, trend: 'up' as const },
  conversionRate: { current: 4.5, previous: 4.0, change: 0.5, trend: 'up' as const },
};

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

describe('AnalyticsOverview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('loading state', () => {
    it('shows loading skeleton cards', () => {
      mockAnalyticsApi.getOverview.mockImplementation(() => new Promise(() => {}));
      
      render(<AnalyticsOverview timeRange="7d" />, { wrapper: createWrapper() });
      
      const skeletonCards = document.querySelectorAll('.animate-pulse');
      expect(skeletonCards.length).toBe(6);
    });
  });

  describe('error state', () => {
    it('shows error message when query fails', async () => {
      mockAnalyticsApi.getOverview.mockRejectedValue(new Error('Failed to fetch'));
      
      render(<AnalyticsOverview timeRange="7d" />, { wrapper: createWrapper() });
      
      await waitFor(() => {
        expect(screen.getByText('Failed to load analytics data. Please try again later.')).toBeInTheDocument();
      });
    });
  });

  describe('success state', () => {
    beforeEach(() => {
      mockAnalyticsApi.getOverview.mockResolvedValue(mockOverviewData);
    });

    it('renders all metric cards', async () => {
      render(<AnalyticsOverview timeRange="7d" />, { wrapper: createWrapper() });
      
      await waitFor(() => {
        expect(screen.getByText('Unique Visitors')).toBeInTheDocument();
        expect(screen.getByText('Page Views')).toBeInTheDocument();
        expect(screen.getByText('Sessions')).toBeInTheDocument();
        expect(screen.getByText('Bounce Rate')).toBeInTheDocument();
        expect(screen.getByText('Session Duration')).toBeInTheDocument();
        expect(screen.getByText('Conversion Rate')).toBeInTheDocument();
      });
    });

    it('displays formatted visitor count', async () => {
      render(<AnalyticsOverview timeRange="7d" />, { wrapper: createWrapper() });
      
      await waitFor(() => {
        expect(screen.getByText('12,500')).toBeInTheDocument();
      });
    });

    it('displays formatted page views', async () => {
      render(<AnalyticsOverview timeRange="7d" />, { wrapper: createWrapper() });
      
      await waitFor(() => {
        expect(screen.getByText('45,000')).toBeInTheDocument();
      });
    });

    it('displays formatted bounce rate', async () => {
      render(<AnalyticsOverview timeRange="7d" />, { wrapper: createWrapper() });
      
      await waitFor(() => {
        expect(screen.getByText('35%')).toBeInTheDocument();
      });
    });

    it('displays formatted session duration', async () => {
      render(<AnalyticsOverview timeRange="7d" />, { wrapper: createWrapper() });
      
      await waitFor(() => {
        expect(screen.getByText('3m 0s')).toBeInTheDocument();
      });
    });

    it('displays formatted conversion rate', async () => {
      render(<AnalyticsOverview timeRange="7d" />, { wrapper: createWrapper() });
      
      await waitFor(() => {
        expect(screen.getByText('4.5%')).toBeInTheDocument();
      });
    });

    it('displays change percentage', async () => {
      render(<AnalyticsOverview timeRange="7d" />, { wrapper: createWrapper() });
      
      await waitFor(() => {
        expect(screen.getByText('12%')).toBeInTheDocument();
      });
    });

    it('displays "from last period" text', async () => {
      render(<AnalyticsOverview timeRange="7d" />, { wrapper: createWrapper() });
      
      await waitFor(() => {
        const lastPeriodTexts = screen.getAllByText('from last period');
        expect(lastPeriodTexts.length).toBe(6);
      });
    });
  });

  describe('API calls', () => {
    it('calls getOverview with correct timeRange', async () => {
      mockAnalyticsApi.getOverview.mockResolvedValue(mockOverviewData);
      
      render(<AnalyticsOverview timeRange="30d" />, { wrapper: createWrapper() });
      
      await waitFor(() => {
        expect(mockAnalyticsApi.getOverview).toHaveBeenCalledWith('30d');
      });
    });
  });

  describe('trend indicators', () => {
    beforeEach(() => {
      mockAnalyticsApi.getOverview.mockResolvedValue(mockOverviewData);
    });

    it('shows up arrow for upward trend', async () => {
      render(<AnalyticsOverview timeRange="7d" />, { wrapper: createWrapper() });
      
      await waitFor(() => {
        expect(screen.getByText('Unique Visitors')).toBeInTheDocument();
      });
      
      const upArrows = document.querySelectorAll('.text-green-500');
      expect(upArrows.length).toBeGreaterThan(0);
    });
  });
});
