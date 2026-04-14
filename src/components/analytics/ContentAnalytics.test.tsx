import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ContentAnalytics } from './ContentAnalytics';

describe('ContentAnalytics', () => {
  describe('rendering', () => {
    it('renders without crashing', () => {
      render(<ContentAnalytics timeRange="7d" />);
    });

    it('displays the main title', () => {
      render(<ContentAnalytics timeRange="7d" />);
      expect(screen.getByText('Content Analytics')).toBeInTheDocument();
    });

    it('renders all expected sections', () => {
      render(<ContentAnalytics timeRange="7d" />);
      
      // Check for main sections
      expect(screen.getByText('Top Pages')).toBeInTheDocument();
      expect(screen.getByText('Landing Pages')).toBeInTheDocument();
      expect(screen.getByText('Exit Pages')).toBeInTheDocument();
      expect(screen.getByText('Custom Events')).toBeInTheDocument();
    });

    it('displays top pages data correctly', () => {
      render(<ContentAnalytics timeRange="7d" />);
      
      // Check for specific top pages
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Projects')).toBeInTheDocument();
      expect(screen.getByText('Analytics')).toBeInTheDocument();
      expect(screen.getByText('Documentation')).toBeInTheDocument();
      expect(screen.getByText('Settings')).toBeInTheDocument();
      
      // Check for metrics
      expect(screen.getByText('12,456')).toBeInTheDocument(); // Dashboard pageviews
      expect(screen.getByText('9,876')).toBeInTheDocument(); // Projects pageviews
    });

    it('displays landing pages with conversion rates', () => {
      render(<ContentAnalytics timeRange="7d" />);
      
      expect(screen.getByText('Home')).toBeInTheDocument();
      expect(screen.getByText('Getting Started')).toBeInTheDocument();
      expect(screen.getByText('Features')).toBeInTheDocument();
      
      // Check conversion rates
      expect(screen.getByText('2.7%')).toBeInTheDocument();
      expect(screen.getByText('3.5%')).toBeInTheDocument();
    });

    it('displays exit pages data', () => {
      render(<ContentAnalytics timeRange="7d" />);
      
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Projects')).toBeInTheDocument();
      
      // Check exit rates
      expect(screen.getByText('28.4%')).toBeInTheDocument();
      expect(screen.getByText('31.2%')).toBeInTheDocument();
    });

    it('displays custom events', () => {
      render(<ContentAnalytics timeRange="7d" />);
      
      expect(screen.getByText('button_click')).toBeInTheDocument();
      expect(screen.getByText('form_submit')).toBeInTheDocument();
      expect(screen.getByText('download')).toBeInTheDocument();
      expect(screen.getByText('video_play')).toBeInTheDocument();
      
      // Check event categories
      expect(screen.getByText('interaction')).toBeInTheDocument();
      expect(screen.getByText('engagement')).toBeInTheDocument();
    });

    it('displays trend indicators correctly', () => {
      render(<ContentAnalytics timeRange="7d" />);
      
      // Check for trend indicators (arrows and percentages)
      expect(screen.getByText('12.5%')).toBeInTheDocument();
      expect(screen.getByText('8.3%')).toBeInTheDocument();
      expect(screen.getByText('-3.2%')).toBeInTheDocument();
    });

    it('renders progress bars for bounce rates', () => {
      render(<ContentAnalytics timeRange="7d" />);
      
      // Progress bars should be present for bounce rates
      const progressBars = screen.getAllByRole('progressbar');
      expect(progressBars.length).toBeGreaterThan(0);
    });

    it('displays badges for event categories', () => {
      render(<ContentAnalytics timeRange="7d" />);
      
      const badges = screen.getAllByText('interaction');
      expect(badges.length).toBeGreaterThan(0);
      
      const engagementBadges = screen.getAllByText('engagement');
      expect(engagementBadges.length).toBeGreaterThan(0);
    });

    it('formats numbers correctly with locale', () => {
      render(<ContentAnalytics timeRange="7d" />);
      
      // Check that large numbers are formatted with commas
      expect(screen.getByText('12,456')).toBeInTheDocument();
      expect(screen.getByText('8,765')).toBeInTheDocument();
      expect(screen.getByText('5,432')).toBeInTheDocument();
    });
  });

  describe('props handling', () => {
    it('accepts different timeRange values', () => {
      render(<ContentAnalytics timeRange="30d" />);
      expect(screen.getByText('Content Analytics')).toBeInTheDocument();
    });

    it('handles empty timeRange', () => {
      render(<ContentAnalytics timeRange="" />);
      expect(screen.getByText('Content Analytics')).toBeInTheDocument();
    });
  });

  describe('data structure', () => {
    it('renders consistent data structure', () => {
      const { container } = render(<ContentAnalytics timeRange="7d" />);
      
      // Check that the component renders the expected structure
      const cards = container.querySelectorAll('.bg-card');
      expect(cards.length).toBe(4); // Should have 4 main cards
    });

    it('displays icons for different sections', () => {
      render(<ContentAnalytics timeRange="7d" />);
      
      // Icons should be present (we can't easily test specific icons but we can check the structure)
      const cardHeaders = screen.getAllByRole('heading', { level: 3 });
      expect(cardHeaders.length).toBeGreaterThan(0);
    });
  });

  describe('accessibility', () => {
    it('has proper heading hierarchy', () => {
      render(<ContentAnalytics timeRange="7d" />);
      
      const mainHeading = screen.getByRole('heading', { level: 2 });
      expect(mainHeading).toHaveTextContent('Content Analytics');
      
      const sectionHeadings = screen.getAllByRole('heading', { level: 3 });
      expect(sectionHeadings.length).toBe(4); // 4 sections
    });

    it('provides semantic structure with cards', () => {
      render(<ContentAnalytics timeRange="7d" />);
      
      // Cards should provide proper grouping
      const sections = screen.getAllByRole('region');
      expect(sections.length).toBeGreaterThan(0);
    });
  });
});
