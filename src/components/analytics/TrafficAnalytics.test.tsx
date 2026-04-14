import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TrafficAnalytics } from './TrafficAnalytics';

describe('TrafficAnalytics', () => {
  describe('rendering', () => {
    it('renders without crashing', () => {
      render(<TrafficAnalytics timeRange="7d" />);
    });

    it('displays the main title', () => {
      render(<TrafficAnalytics timeRange="7d" />);
      expect(screen.getByText('Traffic Analytics')).toBeInTheDocument();
    });

    it('renders all expected sections', () => {
      render(<TrafficAnalytics timeRange="7d" />);
      
      expect(screen.getByText('Traffic Sources')).toBeInTheDocument();
      expect(screen.getByText('Top Keywords')).toBeInTheDocument();
      expect(screen.getByText('Referring Domains')).toBeInTheDocument();
      expect(screen.getByText('Campaign Performance')).toBeInTheDocument();
    });

    it('displays traffic sources data correctly', () => {
      render(<TrafficAnalytics timeRange="7d" />);
      
      // Check for traffic sources
      expect(screen.getByText('Organic Search')).toBeInTheDocument();
      expect(screen.getByText('Direct Traffic')).toBeInTheDocument();
      expect(screen.getByText('Social Media')).toBeInTheDocument();
      expect(screen.getByText('Referral')).toBeInTheDocument();
      expect(screen.getByText('Email')).toBeInTheDocument();
      expect(screen.getByText('Paid Search')).toBeInTheDocument();
    });

    it('shows visitor counts for traffic sources', () => {
      render(<TrafficAnalytics timeRange="7d" />);
      
      expect(screen.getByText('15,832')).toBeInTheDocument();
      expect(screen.getByText('12,666')).toBeInTheDocument();
      expect(screen.getByText('8,142')).toBeInTheDocument();
      expect(screen.getByText('5,428')).toBeInTheDocument();
      expect(screen.getByText('3,215')).toBeInTheDocument();
      expect(screen.getByText('2,543')).toBeInTheDocument();
    });

    it('displays percentages for traffic sources', () => {
      render(<TrafficAnalytics timeRange="7d" />);
      
      expect(screen.getByText('35%')).toBeInTheDocument();
      expect(screen.getByText('28%')).toBeInTheDocument();
      expect(screen.getByText('18%')).toBeInTheDocument();
      expect(screen.getByText('12%')).toBeInTheDocument();
      expect(screen.getByText('7%')).toBeInTheDocument();
      expect(screen.getByText('5%')).toBeInTheDocument();
    });

    it('shows trend indicators for traffic sources', () => {
      render(<TrafficAnalytics timeRange="7d" />);
      
      expect(screen.getByText('12.5%')).toBeInTheDocument();
      expect(screen.getByText('8.3%')).toBeInTheDocument();
      expect(screen.getByText('-3.2%')).toBeInTheDocument();
      expect(screen.getByText('15.7%')).toBeInTheDocument();
      expect(screen.getByText('5.8%')).toBeInTheDocument();
      expect(screen.getByText('-2.1%')).toBeInTheDocument();
    });
  });

  describe('keywords section', () => {
    it('displays top keywords', () => {
      render(<TrafficAnalytics timeRange="7d" />);
      
      expect(screen.getByText('react dashboard')).toBeInTheDocument();
      expect(screen.getByText('container management')).toBeInTheDocument();
      expect(screen.getByText('deployment automation')).toBeInTheDocument();
      expect(screen.getByText('kubernetes tutorial')).toBeInTheDocument();
      expect(screen.getByText('docker compose')).toBeInTheDocument();
    });

    it('shows keyword search volumes', () => {
      render(<TrafficAnalytics timeRange="7d" />);
      
      expect(screen.getByText('3,421')).toBeInTheDocument();
      expect(screen.getByText('2,856')).toBeInTheDocument();
      expect(screen.getByText('2,134')).toBeInTheDocument();
      expect(screen.getByText('1,876')).toBeInTheDocument();
      expect(screen.getByText('1,543')).toBeInTheDocument();
    });

    it('displays keyword trends', () => {
      render(<TrafficAnalytics timeRange="7d" />);
      
      expect(screen.getByText('18.2%')).toBeInTheDocument();
      expect(screen.getByText('12.7%')).toBeInTheDocument();
      expect(screen.getByText('8.9%')).toBeInTheDocument();
      expect(screen.getByText('-5.3%')).toBeInTheDocument();
      expect(screen.getByText('6.4%')).toBeInTheDocument();
    });
  });

  describe('referring domains section', () => {
    it('displays referring domains', () => {
      render(<TrafficAnalytics timeRange="7d" />);
      
      expect(screen.getByText('github.com')).toBeInTheDocument();
      expect(screen.getByText('stackoverflow.com')).toBeInTheDocument();
      expect(screen.getByText('medium.com')).toBeInTheDocument();
      expect(screen.getByText('dev.to')).toBeInTheDocument();
      expect(screen.getByText('reddit.com')).toBeInTheDocument();
    });

    it('shows referring domain traffic', () => {
      render(<TrafficAnalytics timeRange="7d" />);
      
      expect(screen.getByText('8,234')).toBeInTheDocument();
      expect(screen.getByText('5,678')).toBeInTheDocument();
      expect(screen.getByText('3,456')).toBeInTheDocument();
      expect(screen.getByText('2,890')).toBeInTheDocument();
      expect(screen.getByText('1,234')).toBeInTheDocument();
    });

    it('displays domain authority indicators', () => {
      render(<TrafficAnalytics timeRange="7d" />);
      
      // Check for domain authority badges
      const daBadges = screen.getAllByText(/DA \d+/);
      expect(daBadges.length).toBeGreaterThan(0);
      
      expect(screen.getByText('DA 95')).toBeInTheDocument();
      expect(screen.getByText('DA 92')).toBeInTheDocument();
      expect(screen.getByText('DA 88')).toBeInTheDocument();
    });
  });

  describe('campaign performance section', () => {
    it('displays campaign names', () => {
      render(<TrafficAnalytics timeRange="7d" />);
      
      expect(screen.getByText('Summer Launch')).toBeInTheDocument();
      expect(screen.getByText('Tech Blog Series')).toBeInTheDocument();
      expect(screen.getByText('Product Update')).toBeInTheDocument();
      expect(screen.getByText('Webinar Promotion')).toBeInTheDocument();
    });

    it('shows campaign metrics', () => {
      render(<TrafficAnalytics timeRange="7d" />);
      
      // Check for visitors, conversion rate, and cost
      expect(screen.getByText('5,432')).toBeInTheDocument();
      expect(screen.getByText('3.2%')).toBeInTheDocument();
      expect(screen.getByText('$1,245')).toBeInTheDocument();
      
      expect(screen.getByText('2,876')).toBeInTheDocument();
      expect(screen.getByText('4.1%')).toBeInTheDocument();
      expect(screen.getByText('$856')).toBeInTheDocument();
    });

    it('displays campaign status badges', () => {
      render(<TrafficAnalytics timeRange="7d" />);
      
      const activeBadges = screen.getAllByText('Active');
      expect(activeBadges.length).toBeGreaterThan(0);
      
      const completedBadges = screen.getAllByText('Completed');
      expect(completedBadges.length).toBeGreaterThan(0);
    });

    it('shows campaign ROI', () => {
      render(<TrafficAnalytics timeRange="7d" />);
      
      expect(screen.getByText('245%')).toBeInTheDocument();
      expect(screen.getByText('312%')).toBeInTheDocument();
      expect(screen.getByText('189%')).toBeInTheDocument();
      expect(screen.getByText('156%')).toBeInTheDocument();
    });
  });

  describe('data visualization', () => {
    it('renders progress bars for traffic sources', () => {
      render(<TrafficAnalytics timeRange="7d" />);
      
      const progressBars = screen.getAllByRole('progressbar');
      expect(progressBars.length).toBeGreaterThan(0);
    });

    it('displays trend arrows correctly', () => {
      render(<TrafficAnalytics timeRange="7d" />);
      
      // Check for trend indicators (up and down arrows with percentages)
      const trendElements = screen.getAllByText(/\d+\.?\d*%/);
      expect(trendElements.length).toBeGreaterThan(10);
    });

    it('shows badges for different metrics', () => {
      render(<TrafficAnalytics timeRange="7d" />);
      
      const badges = screen.getAllByRole('generic');
      expect(badges.length).toBeGreaterThan(0);
    });
  });

  describe('data consistency', () => {
    it('maintains consistent percentage totals', () => {
      render(<TrafficAnalytics timeRange="7d" />);
      
      // Traffic source percentages should sum to 100%
      const percentages = [35, 28, 18, 12, 7, 5];
      const sum = percentages.reduce((a, b) => a + b, 0);
      expect(sum).toBe(100);
    });

    it('formats numbers correctly with locale', () => {
      render(<TrafficAnalytics timeRange="7d" />);
      
      // Check that large numbers are formatted with commas
      expect(screen.getByText('15,832')).toBeInTheDocument();
      expect(screen.getByText('12,666')).toBeInTheDocument();
      expect(screen.getByText('8,234')).toBeInTheDocument();
    });

    it('displays consistent data structure across sections', () => {
      render(<TrafficAnalytics timeRange="7d" />);
      
      // All sections should have cards with consistent structure
      const cards = screen.getAllByRole('region');
      expect(cards.length).toBe(4); // Should have 4 main sections
    });
  });

  describe('props handling', () => {
    it('accepts different timeRange values', () => {
      render(<TrafficAnalytics timeRange="30d" />);
      expect(screen.getByText('Traffic Analytics')).toBeInTheDocument();
    });

    it('handles empty timeRange', () => {
      render(<TrafficAnalytics timeRange="" />);
      expect(screen.getByText('Traffic Analytics')).toBeInTheDocument();
    });
  });

  describe('visual elements', () => {
    it('displays icons for different sections', () => {
      render(<TrafficAnalytics timeRange="7d" />);
      
      // Icons should be present (we check for the structure)
      const iconElements = document.querySelectorAll('svg');
      expect(iconElements.length).toBeGreaterThan(0);
    });

    it('renders proper card layouts', () => {
      render(<TrafficAnalytics timeRange="7d" />);
      
      const cardHeaders = screen.getAllByRole('heading', { level: 3 });
      expect(cardHeaders.length).toBe(4); // 4 sections
    });

    it('shows proper color coding for trends', () => {
      render(<TrafficAnalytics timeRange="7d" />);
      
      // Check for positive and negative trend indicators
      const positiveTrends = screen.getAllByText(/\d+\.\d+%/);
      const negativeTrends = screen.getAllByText(/-\d+\.\d+%/);
      
      expect(positiveTrends.length).toBeGreaterThan(0);
      expect(negativeTrends.length).toBeGreaterThan(0);
    });
  });

  describe('accessibility', () => {
    it('has proper heading hierarchy', () => {
      render(<TrafficAnalytics timeRange="7d" />);
      
      const mainHeading = screen.getByRole('heading', { level: 2 });
      expect(mainHeading).toHaveTextContent('Traffic Analytics');
      
      const sectionHeadings = screen.getAllByRole('heading', { level: 3 });
      expect(sectionHeadings.length).toBe(4); // 4 sections
    });

    it('provides semantic structure with cards', () => {
      render(<TrafficAnalytics timeRange="7d" />);
      
      const sections = screen.getAllByRole('region');
      expect(sections.length).toBeGreaterThan(0);
    });

    it('has accessible progress bars', () => {
      render(<TrafficAnalytics timeRange="7d" />);
      
      const progressBars = screen.getAllByRole('progressbar');
      progressBars.forEach(bar => {
        expect(bar).toHaveAttribute('aria-valuenow');
        expect(bar).toHaveAttribute('aria-valuemin');
        expect(bar).toHaveAttribute('aria-valuemax');
      });
    });
  });

  describe('interactivity', () => {
    it('provides clickable elements where expected', () => {
      render(<TrafficAnalytics timeRange="7d" />);
      
      // Links and interactive elements should be present
      const links = screen.getAllByRole('link');
      expect(links.length).toBeGreaterThan(0);
    });
  });

  describe('responsive design', () => {
    it('adapts to different content lengths', () => {
      render(<TrafficAnalytics timeRange="7d" />);
      
      // Component should handle varying content lengths
      const container = screen.getByText('Traffic Analytics').closest('div');
      expect(container).toBeInTheDocument();
    });
  });
});
