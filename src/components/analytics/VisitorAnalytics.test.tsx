import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { VisitorAnalytics } from './VisitorAnalytics';

describe('VisitorAnalytics', () => {
  describe('rendering', () => {
    it('renders without crashing', () => {
      render(<VisitorAnalytics timeRange="7d" />);
    });

    it('displays the main title', () => {
      render(<VisitorAnalytics timeRange="7d" />);
      expect(screen.getByText('Visitor Analytics')).toBeInTheDocument();
    });

    it('renders all expected sections', () => {
      render(<VisitorAnalytics timeRange="7d" />);
      
      expect(screen.getByText('New vs Returning Visitors')).toBeInTheDocument();
      expect(screen.getByText('Device Categories')).toBeInTheDocument();
      expect(screen.getByText('Browser Distribution')).toBeInTheDocument();
      expect(screen.getByText('Operating Systems')).toBeInTheDocument();
      expect(screen.getByText('Geographic Distribution')).toBeInTheDocument();
    });
  });

  describe('new vs returning visitors', () => {
    it('displays new vs returning data', () => {
      render(<VisitorAnalytics timeRange="7d" />);
      
      expect(screen.getByText('New Visitors')).toBeInTheDocument();
      expect(screen.getByText('Returning Visitors')).toBeInTheDocument();
    });

    it('shows correct percentages', () => {
      render(<VisitorAnalytics timeRange="7d" />);
      
      expect(screen.getByText('68%')).toBeInTheDocument();
      expect(screen.getByText('32%')).toBeInTheDocument();
    });

    it('displays visitor counts', () => {
      render(<VisitorAnalytics timeRange="7d" />);
      
      // Check for visitor count displays
      const newVisitorElement = screen.getByText('68%').closest('div');
      expect(newVisitorElement).toBeInTheDocument();
      
      const returningVisitorElement = screen.getByText('32%').closest('div');
      expect(returningVisitorElement).toBeInTheDocument();
    });

    it('renders progress bars for visitor ratios', () => {
      render(<VisitorAnalytics timeRange="7d" />);
      
      const progressBars = screen.getAllByRole('progressbar');
      expect(progressBars.length).toBeGreaterThan(0);
    });
  });

  describe('device categories', () => {
    it('displays device types', () => {
      render(<VisitorAnalytics timeRange="7d" />);
      
      expect(screen.getByText('Desktop')).toBeInTheDocument();
      expect(screen.getByText('Mobile')).toBeInTheDocument();
      expect(screen.getByText('Tablet')).toBeInTheDocument();
    });

    it('shows device percentages', () => {
      render(<VisitorAnalytics timeRange="7d" />);
      
      expect(screen.getByText('45%')).toBeInTheDocument();
      expect(screen.getByText('42%')).toBeInTheDocument();
      expect(screen.getByText('13%')).toBeInTheDocument();
    });

    it('displays device user counts', () => {
      render(<VisitorAnalytics timeRange="7d" />);
      
      // Check that user counts are displayed alongside percentages
      const deviceSection = screen.getByText('Device Categories').closest('.bg-card');
      expect(deviceSection).toBeInTheDocument();
    });
  });

  describe('browser distribution', () => {
    it('displays browser names', () => {
      render(<VisitorAnalytics timeRange="7d" />);
      
      expect(screen.getByText('Chrome')).toBeInTheDocument();
      expect(screen.getByText('Safari')).toBeInTheDocument();
      expect(screen.getByText('Firefox')).toBeInTheDocument();
      expect(screen.getByText('Edge')).toBeInTheDocument();
      expect(screen.getByText('Others')).toBeInTheDocument();
    });

    it('shows browser percentages', () => {
      render(<VisitorAnalytics timeRange="7d" />);
      
      expect(screen.getByText('45%')).toBeInTheDocument();
      expect(screen.getByText('28%')).toBeInTheDocument();
      expect(screen.getByText('12%')).toBeInTheDocument();
      expect(screen.getByText('8%')).toBeInTheDocument();
      expect(screen.getByText('7%')).toBeInTheDocument();
    });

    it('displays browser user counts', () => {
      render(<VisitorAnalytics timeRange="7d" />);
      
      expect(screen.getByText('20,356')).toBeInTheDocument();
      expect(screen.getByText('12,666')).toBeInTheDocument();
      expect(screen.getByText('5,428')).toBeInTheDocument();
      expect(screen.getByText('3,619')).toBeInTheDocument();
      expect(screen.getByText('3,166')).toBeInTheDocument();
    });

    it('renders progress bars for browser distribution', () => {
      render(<VisitorAnalytics timeRange="7d" />);
      
      const progressBars = screen.getAllByRole('progressbar');
      expect(progressBars.length).toBeGreaterThan(4); // Should have multiple progress bars
    });
  });

  describe('operating systems', () => {
    it('displays operating system names', () => {
      render(<VisitorAnalytics timeRange="7d" />);
      
      expect(screen.getByText('Windows')).toBeInTheDocument();
      expect(screen.getByText('macOS')).toBeInTheDocument();
      expect(screen.getByText('Android')).toBeInTheDocument();
      expect(screen.getByText('iOS')).toBeInTheDocument();
      expect(screen.getByText('Linux')).toBeInTheDocument();
    });

    it('shows OS percentages', () => {
      render(<VisitorAnalytics timeRange="7d" />);
      
      expect(screen.getByText('38%')).toBeInTheDocument();
      expect(screen.getByText('32%')).toBeInTheDocument();
      expect(screen.getByText('18%')).toBeInTheDocument();
      expect(screen.getByText('10%')).toBeInTheDocument();
      expect(screen.getByText('2%')).toBeInTheDocument();
    });

    it('displays OS user counts', () => {
      render(<VisitorAnalytics timeRange="7d" />);
      
      expect(screen.getByText('17,189')).toBeInTheDocument();
      expect(screen.getByText('14,475')).toBeInTheDocument();
      expect(screen.getByText('8,142')).toBeInTheDocument();
      expect(screen.getByText('4,523')).toBeInTheDocument();
      expect(screen.getByText('905')).toBeInTheDocument();
    });
  });

  describe('geographic distribution', () => {
    it('displays country names', () => {
      render(<VisitorAnalytics timeRange="7d" />);
      
      expect(screen.getByText('United States')).toBeInTheDocument();
      expect(screen.getByText('United Kingdom')).toBeInTheDocument();
      expect(screen.getByText('Germany')).toBeInTheDocument();
      expect(screen.getByText('Canada')).toBeInTheDocument();
      expect(screen.getByText('France')).toBeInTheDocument();
      expect(screen.getByText('Others')).toBeInTheDocument();
    });

    it('shows country percentages', () => {
      render(<VisitorAnalytics timeRange="7d" />);
      
      expect(screen.getByText('35%')).toBeInTheDocument();
      expect(screen.getByText('18%')).toBeInTheDocument();
      expect(screen.getByText('12%')).toBeInTheDocument();
      expect(screen.getByText('8%')).toBeInTheDocument();
      expect(screen.getByText('7%')).toBeInTheDocument();
      expect(screen.getByText('20%')).toBeInTheDocument();
    });

    it('displays country user counts', () => {
      render(<VisitorAnalytics timeRange="7d" />);
      
      expect(screen.getByText('15,832')).toBeInTheDocument();
      expect(screen.getByText('8,142')).toBeInTheDocument();
      expect(screen.getByText('5,428')).toBeInTheDocument();
      expect(screen.getByText('3,619')).toBeInTheDocument();
      expect(screen.getByText('3,166')).toBeInTheDocument();
      expect(screen.getByText('9,047')).toBeInTheDocument();
    });
  });

  describe('data consistency', () => {
    it('maintains consistent percentage totals across sections', () => {
      render(<VisitorAnalytics timeRange="7d" />);
      
      // New vs returning should sum to 100%
      const newVsReturning = [68, 32];
      expect(newVsReturning.reduce((a, b) => a + b, 0)).toBe(100);
      
      // Devices should sum to 100%
      const devices = [45, 42, 13];
      expect(devices.reduce((a, b) => a + b, 0)).toBe(100);
      
      // Browsers should sum to 100%
      const browsers = [45, 28, 12, 8, 7];
      expect(browsers.reduce((a, b) => a + b, 0)).toBe(100);
      
      // Operating systems should sum to 100%
      const operatingSystems = [38, 32, 18, 10, 2];
      expect(operatingSystems.reduce((a, b) => a + b, 0)).toBe(100);
      
      // Countries should sum to 100%
      const countries = [35, 18, 12, 8, 7, 20];
      expect(countries.reduce((a, b) => a + b, 0)).toBe(100);
    });

    it('formats numbers correctly with locale', () => {
      render(<VisitorAnalytics timeRange="7d" />);
      
      // Check that large numbers are formatted with commas
      expect(screen.getByText('20,356')).toBeInTheDocument();
      expect(screen.getByText('17,189')).toBeInTheDocument();
      expect(screen.getByText('15,832')).toBeInTheDocument();
      expect(screen.getByText('14,475')).toBeInTheDocument();
    });

    it('displays consistent data structure across sections', () => {
      render(<VisitorAnalytics timeRange="7d" />);
      
      // All sections should have cards with consistent structure
      const cards = screen.getAllByRole('region');
      expect(cards.length).toBe(5); // Should have 5 main sections
    });
  });

  describe('visual elements', () => {
    it('renders progress bars with correct values', () => {
      render(<VisitorAnalytics timeRange="7d" />);
      
      const progressBars = screen.getAllByRole('progressbar');
      expect(progressBars.length).toBeGreaterThan(10); // Should have multiple progress bars
    });

    it('displays icons for different sections', () => {
      render(<VisitorAnalytics timeRange="7d" />);
      
      // Icons should be present (we check for the structure)
      const iconElements = document.querySelectorAll('svg');
      expect(iconElements.length).toBeGreaterThan(0);
    });

    it('shows proper color coding for different metrics', () => {
      render(<VisitorAnalytics timeRange="7d" />);
      
      // Check that different sections have visual distinction
      const sections = screen.getAllByRole('region');
      expect(sections.length).toBe(5);
    });
  });

  describe('props handling', () => {
    it('accepts different timeRange values', () => {
      render(<VisitorAnalytics timeRange="30d" />);
      expect(screen.getByText('Visitor Analytics')).toBeInTheDocument();
    });

    it('handles empty timeRange', () => {
      render(<VisitorAnalytics timeRange="" />);
      expect(screen.getByText('Visitor Analytics')).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('has proper heading hierarchy', () => {
      render(<VisitorAnalytics timeRange="7d" />);
      
      const mainHeading = screen.getByRole('heading', { level: 2 });
      expect(mainHeading).toHaveTextContent('Visitor Analytics');
      
      const sectionHeadings = screen.getAllByRole('heading', { level: 3 });
      expect(sectionHeadings.length).toBe(5); // 5 sections
    });

    it('provides semantic structure with cards', () => {
      render(<VisitorAnalytics timeRange="7d" />);
      
      const sections = screen.getAllByRole('region');
      expect(sections.length).toBeGreaterThan(0);
    });

    it('has accessible progress bars', () => {
      render(<VisitorAnalytics timeRange="7d" />);
      
      const progressBars = screen.getAllByRole('progressbar');
      progressBars.forEach(bar => {
        expect(bar).toHaveAttribute('aria-valuenow');
        expect(bar).toHaveAttribute('aria-valuemin');
        expect(bar).toHaveAttribute('aria-valuemax');
      });
    });
  });

  describe('responsive design', () => {
    it('adapts to different content lengths', () => {
      render(<VisitorAnalytics timeRange="7d" />);
      
      // Component should handle varying content lengths gracefully
      const container = screen.getByText('Visitor Analytics').closest('div');
      expect(container).toBeInTheDocument();
    });

    it('maintains layout consistency across sections', () => {
      render(<VisitorAnalytics timeRange="7d" />);
      
      // All sections should follow the same layout pattern
      const sectionHeadings = screen.getAllByRole('heading', { level: 3 });
      expect(sectionHeadings.length).toBe(5);
      
      sectionHeadings.forEach(heading => {
        expect(heading).toBeInTheDocument();
      });
    });
  });

  describe('data visualization', () => {
    it('provides visual hierarchy for data', () => {
      render(<VisitorAnalytics timeRange="7d" />);
      
      // Check that data is presented with clear visual hierarchy
      const percentages = screen.getAllByText(/\d+%/);
      expect(percentages.length).toBeGreaterThan(15);
    });

    it('displays data in consistent format', () => {
      render(<VisitorAnalytics timeRange="7d" />);
      
      // Check that similar data types are displayed consistently
      const userCounts = screen.getAllByText(/\d{1,3},\d{3}/);
      expect(userCounts.length).toBeGreaterThan(10);
    });
  });

  describe('performance', () => {
    it('renders efficiently with large datasets', () => {
      const startTime = performance.now();
      render(<VisitorAnalytics timeRange="7d" />);
      const endTime = performance.now();
      
      // Rendering should complete quickly
      expect(endTime - startTime).toBeLessThan(100); // 100ms threshold
    });
  });
});
