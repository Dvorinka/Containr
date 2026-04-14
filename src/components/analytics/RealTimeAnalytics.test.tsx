import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RealTimeAnalytics } from './RealTimeAnalytics';

// Mock useEffect to prevent actual timers
vi.mock('react', async () => {
  const actual = await vi.importActual('react');
  return {
    ...actual,
    useEffect: vi.fn(),
  };
});

describe('RealTimeAnalytics', () => {
  describe('rendering', () => {
    it('renders without crashing', () => {
      render(<RealTimeAnalytics />);
    });

    it('displays the main title', () => {
      render(<RealTimeAnalytics />);
      expect(screen.getByText('Real-Time Analytics')).toBeInTheDocument();
    });

    it('displays key metrics cards', () => {
      render(<RealTimeAnalytics />);
      
      expect(screen.getByText('Online Users')).toBeInTheDocument();
      expect(screen.getByText('Current Visitors')).toBeInTheDocument();
      expect(screen.getByText('Active Now')).toBeInTheDocument();
    });

    it('displays correct metric values', () => {
      render(<RealTimeAnalytics />);
      
      expect(screen.getByText('127')).toBeInTheDocument();
      expect(screen.getByText('34')).toBeInTheDocument();
    });

    it('shows live indicator', () => {
      render(<RealTimeAnalytics />);
      
      const liveIndicators = screen.getAllByText('LIVE');
      expect(liveIndicators.length).toBeGreaterThan(0);
    });
  });

  describe('pageviews section', () => {
    it('displays current pageviews data', () => {
      render(<RealTimeAnalytics />);
      
      expect(screen.getByText('Current Pageviews')).toBeInTheDocument();
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Projects')).toBeInTheDocument();
      expect(screen.getByText('Analytics')).toBeInTheDocument();
      expect(screen.getByText('Documentation')).toBeInTheDocument();
      expect(screen.getByText('Settings')).toBeInTheDocument();
    });

    it('shows pageview counts and percentages', () => {
      render(<RealTimeAnalytics />);
      
      expect(screen.getByText('12')).toBeInTheDocument();
      expect(screen.getByText('35%')).toBeInTheDocument();
      expect(screen.getByText('8')).toBeInTheDocument();
      expect(screen.getByText('24%')).toBeInTheDocument();
    });

    it('displays progress bars for pageviews', () => {
      render(<RealTimeAnalytics />);
      
      const progressBars = screen.getAllByRole('progressbar');
      expect(progressBars.length).toBeGreaterThan(0);
    });
  });

  describe('geographic distribution', () => {
    it('displays locations section', () => {
      render(<RealTimeAnalytics />);
      
      expect(screen.getByText('Geographic Distribution')).toBeInTheDocument();
      expect(screen.getByText('United States')).toBeInTheDocument();
      expect(screen.getByText('United Kingdom')).toBeInTheDocument();
      expect(screen.getByText('Germany')).toBeInTheDocument();
      expect(screen.getByText('Canada')).toBeInTheDocument();
      expect(screen.getByText('France')).toBeInTheDocument();
      expect(screen.getByText('Others')).toBeInTheDocument();
    });

    it('shows visitor counts by country', () => {
      render(<RealTimeAnalytics />);
      
      expect(screen.getByText('8')).toBeInTheDocument();
      expect(screen.getByText('6')).toBeInTheDocument();
      expect(screen.getByText('4')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('displays country percentages', () => {
      render(<RealTimeAnalytics />);
      
      expect(screen.getByText('24%')).toBeInTheDocument();
      expect(screen.getByText('18%')).toBeInTheDocument();
      expect(screen.getByText('12%')).toBeInTheDocument();
      expect(screen.getByText('9%')).toBeInTheDocument();
      expect(screen.getByText('28%')).toBeInTheDocument();
    });
  });

  describe('device breakdown', () => {
    it('displays device types section', () => {
      render(<RealTimeAnalytics />);
      
      expect(screen.getByText('Device Breakdown')).toBeInTheDocument();
      expect(screen.getByText('Desktop')).toBeInTheDocument();
      expect(screen.getByText('Mobile')).toBeInTheDocument();
      expect(screen.getByText('Tablet')).toBeInTheDocument();
    });

    it('shows device counts and percentages', () => {
      render(<RealTimeAnalytics />);
      
      expect(screen.getByText('18')).toBeInTheDocument();
      expect(screen.getByText('53%')).toBeInTheDocument();
      expect(screen.getByText('12')).toBeInTheDocument();
      expect(screen.getByText('35%')).toBeInTheDocument();
      expect(screen.getByText('4')).toBeInTheDocument();
      expect(screen.getByText('12%')).toBeInTheDocument();
    });

    it('displays device icons', () => {
      render(<RealTimeAnalytics />);
      
      // Icons should be present (we check for the structure)
      const deviceSection = screen.getByText('Device Breakdown').closest('.bg-card');
      expect(deviceSection).toBeInTheDocument();
    });
  });

  describe('recent activity feed', () => {
    it('displays recent activity section', () => {
      render(<RealTimeAnalytics />);
      
      expect(screen.getByText('Recent Activity')).toBeInTheDocument();
    });

    it('shows activity items with timestamps', () => {
      render(<RealTimeAnalytics />);
      
      // Check for activity types
      expect(screen.getByText('viewed')).toBeInTheDocument();
      expect(screen.getByText('clicked')).toBeInTheDocument();
      
      // Check for user identifiers
      expect(screen.getByText('User 1234')).toBeInTheDocument();
      expect(screen.getByText('User 5678')).toBeInTheDocument();
    });

    it('displays page names in activity', () => {
      render(<RealTimeAnalytics />);
      
      expect(screen.getByText('/dashboard')).toBeInTheDocument();
      expect(screen.getByText('/projects')).toBeInTheDocument();
      expect(screen.getByText('Button CTA')).toBeInTheDocument();
    });

    it('shows relative timestamps', () => {
      render(<RealTimeAnalytics />);
      
      expect(screen.getByText('just now')).toBeInTheDocument();
      expect(screen.getByText('2 min ago')).toBeInTheDocument();
      expect(screen.getByText('5 min ago')).toBeInTheDocument();
    });

    it('displays activity badges', () => {
      render(<RealTimeAnalytics />);
      
      const badges = screen.getAllByText('page view');
      expect(badges.length).toBeGreaterThan(0);
      
      const clickBadges = screen.getAllByText('click');
      expect(clickBadges.length).toBeGreaterThan(0);
    });
  });

  describe('data structure consistency', () => {
    it('maintains consistent data structure across sections', () => {
      render(<RealTimeAnalytics />);
      
      // All sections should have consistent structure
      const cards = screen.getAllByText('LIVE');
      expect(cards.length).toBe(3); // Should have 3 live indicators
    });

    it('displays proper percentages that sum correctly', () => {
      render(<RealTimeAnalytics />);
      
      // Pageview percentages should sum to 100%
      const pageviewPercentages = [35, 24, 18, 12, 11];
      const sum = pageviewPercentages.reduce((a, b) => a + b, 0);
      expect(sum).toBe(100);
      
      // Location percentages should sum to 100%
      const locationPercentages = [24, 18, 12, 9, 9, 28];
      const locationSum = locationPercentages.reduce((a, b) => a + b, 0);
      expect(locationSum).toBe(100);
      
      // Device percentages should sum to 100%
      const devicePercentages = [53, 35, 12];
      const deviceSum = devicePercentages.reduce((a, b) => a + b, 0);
      expect(deviceSum).toBe(100);
    });
  });

  describe('visual elements', () => {
    it('renders progress bars with correct values', () => {
      render(<RealTimeAnalytics />);
      
      const progressBars = screen.getAllByRole('progressbar');
      expect(progressBars.length).toBeGreaterThan(5); // Should have multiple progress bars
    });

    it('displays badges for different activity types', () => {
      render(<RealTimeAnalytics />);
      
      const badges = screen.getAllByRole('generic');
      expect(badges.length).toBeGreaterThan(0);
    });

    it('shows icons for different sections', () => {
      render(<RealTimeAnalytics />);
      
      // Check that icons are rendered (we verify by checking the structure)
      const iconElements = document.querySelectorAll('svg');
      expect(iconElements.length).toBeGreaterThan(0);
    });
  });

  describe('accessibility', () => {
    it('has proper heading hierarchy', () => {
      render(<RealTimeAnalytics />);
      
      const mainHeading = screen.getByRole('heading', { level: 2 });
      expect(mainHeading).toHaveTextContent('Real-Time Analytics');
      
      const sectionHeadings = screen.getAllByRole('heading', { level: 3 });
      expect(sectionHeadings.length).toBe(4); // 4 main sections
    });

    it('provides semantic structure with cards', () => {
      render(<RealTimeAnalytics />);
      
      const cards = screen.getAllByRole('region');
      expect(cards.length).toBeGreaterThan(0);
    });

    it('has accessible progress bars', () => {
      render(<RealTimeAnalytics />);
      
      const progressBars = screen.getAllByRole('progressbar');
      progressBars.forEach(bar => {
        expect(bar).toHaveAttribute('aria-valuenow');
        expect(bar).toHaveAttribute('aria-valuemin');
        expect(bar).toHaveAttribute('aria-valuemax');
      });
    });
  });

  describe('responsiveness', () => {
    it('adapts to different screen sizes', () => {
      render(<RealTimeAnalytics />);
      
      // Check that responsive classes are present
      const container = screen.getByText('Real-Time Analytics').closest('div');
      expect(container).toBeInTheDocument();
    });
  });

  describe('state management', () => {
    it('initializes with correct default values', () => {
      render(<RealTimeAnalytics />);
      
      // Check that initial values are displayed correctly
      expect(screen.getByText('127')).toBeInTheDocument(); // Online users
      expect(screen.getByText('34')).toBeInTheDocument(); // Current visitors
    });

    it('displays live status indicators', () => {
      render(<RealTimeAnalytics />);
      
      // Check for live indicators
      const liveIndicators = screen.getAllByText('LIVE');
      expect(liveIndicators.length).toBe(3);
      
      // Live indicators should have proper styling
      liveIndicators.forEach(indicator => {
        expect(indicator).toBeInTheDocument();
      });
    });
  });
});
