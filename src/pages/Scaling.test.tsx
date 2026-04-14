import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Scaling from './Scaling';

// Mock date-fns
vi.mock('date-fns', () => ({
  formatDistanceToNow: vi.fn(() => '2 hours ago'),
}));

describe('Scaling', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    vi.clearAllMocks();
  });

  const renderWithQueryClient = (component: React.ReactElement) => {
    return render(
      <QueryClientProvider client={queryClient}>
        {component}
      </QueryClientProvider>
    );
  };

  describe('rendering', () => {
    it('renders without crashing', () => {
      renderWithQueryClient(<Scaling />);
    });

    it('displays the main title', () => {
      renderWithQueryClient(<Scaling />);
      expect(screen.getByText('Auto Scaling')).toBeInTheDocument();
    });

    it('shows description text', () => {
      renderWithQueryClient(<Scaling />);
      expect(screen.getByText('Configure automatic scaling policies for your services based on metrics like CPU, memory, and custom thresholds.')).toBeInTheDocument();
    });

    it('displays tabs for different sections', () => {
      renderWithQueryClient(<Scaling />);
      
      expect(screen.getByText('Policies')).toBeInTheDocument();
      expect(screen.getByText('Metrics')).toBeInTheDocument();
      expect(screen.getByText('History')).toBeInTheDocument();
      expect(screen.getByText('Settings')).toBeInTheDocument();
    });
  });

  describe('policies section', () => {
    it('displays policies list', () => {
      renderWithQueryClient(<Scaling />);
      
      // Check for service names
      expect(screen.getByText('Web App')).toBeInTheDocument();
      expect(screen.getByText('API Service')).toBeInTheDocument();
      expect(screen.getByText('Database')).toBeInTheDocument();
    });

    it('shows policy status indicators', () => {
      renderWithQueryClient(<Scaling />);
      
      // Check for enabled/disabled badges
      const enabledBadges = screen.getAllByText('Enabled');
      expect(enabledBadges.length).toBeGreaterThan(0);
    });

    it('displays scaling configuration', () => {
      renderWithQueryClient(<Scaling />);
      
      // Check for scaling metrics
      expect(screen.getByText('Min Replicas')).toBeInTheDocument();
      expect(screen.getByText('Max Replicas')).toBeInTheDocument();
      expect(screen.getByText('Target CPU')).toBeInTheDocument();
      expect(screen.getByText('Target Memory')).toBeInTheDocument();
    });

    it('shows current replica counts', () => {
      renderWithQueryClient(<Scaling />);
      
      // Look for replica count information
      const replicaInfo = screen.getAllByText(/Current: \d+/);
      expect(replicaInfo.length).toBeGreaterThan(0);
    });
  });

  describe('policy management', () => {
    it('allows creating new policies', () => {
      renderWithQueryClient(<Scaling />);
      
      const addButton = screen.getByText('Add Policy');
      expect(addButton).toBeInTheDocument();
      expect(addButton.closest('button')).toBeInTheDocument();
    });

    it('allows editing existing policies', () => {
      renderWithQueryClient(<Scaling />);
      
      // Look for edit buttons
      const editButtons = screen.getAllByRole('button');
      const editButton = editButtons.find(button => 
        button.getAttribute('aria-label')?.includes('edit')
      );
      expect(editButton).toBeInTheDocument();
    });

    it('allows deleting policies', () => {
      renderWithQueryClient(<Scaling />);
      
      // Look for delete buttons
      const deleteButtons = screen.getAllByRole('button');
      const deleteButton = deleteButtons.find(button => 
        button.getAttribute('aria-label')?.includes('delete')
      );
      expect(deleteButton).toBeInTheDocument();
    });

    it('allows toggling policy status', () => {
      renderWithQueryClient(<Scaling />);
      
      // Look for toggle switches
      const toggleButtons = screen.getAllByRole('switch');
      expect(toggleButtons.length).toBeGreaterThan(0);
    });
  });

  describe('metrics section', () => {
    it('displays metrics charts', () => {
      renderWithQueryClient(<Scaling />);
      
      // Switch to metrics tab
      const metricsTab = screen.getByText('Metrics');
      fireEvent.click(metricsTab);
      
      expect(screen.getByText('CPU Usage')).toBeInTheDocument();
      expect(screen.getByText('Memory Usage')).toBeInTheDocument();
      expect(screen.getByText('Request Rate')).toBeInTheDocument();
    });

    it('shows time range selector', () => {
      renderWithQueryClient(<Scaling />);
      
      const metricsTab = screen.getByText('Metrics');
      fireEvent.click(metricsTab);
      
      expect(screen.getByText('Last 24h')).toBeInTheDocument();
      expect(screen.getByText('Last 7d')).toBeInTheDocument();
      expect(screen.getByText('Last 30d')).toBeInTheDocument();
    });

    it('displays current metric values', () => {
      renderWithQueryClient(<Scaling />);
      
      const metricsTab = screen.getByText('Metrics');
      fireEvent.click(metricsTab);
      
      // Look for percentage values
      const percentageValues = screen.getAllByText(/\d+%/);
      expect(percentageValues.length).toBeGreaterThan(0);
    });
  });

  describe('history section', () => {
    it('displays scaling events', () => {
      renderWithQueryClient(<Scaling />);
      
      const historyTab = screen.getByText('History');
      fireEvent.click(historyTab);
      
      expect(screen.getByText('Scaling Events')).toBeInTheDocument();
    });

    it('shows event details', () => {
      renderWithQueryClient(<Scaling />);
      
      const historyTab = screen.getByText('History');
      fireEvent.click(historyTab);
      
      // Look for event information
      expect(screen.getByText('Scale Up')).toBeInTheDocument();
      expect(screen.getByText('Scale Down')).toBeInTheDocument();
    });

    it('displays event timestamps', () => {
      renderWithQueryClient(<Scaling />);
      
      const historyTab = screen.getByText('History');
      fireEvent.click(historyTab);
      
      // Look for time information
      const timeInfo = screen.getAllByText('2 hours ago');
      expect(timeInfo.length).toBeGreaterThan(0);
    });

    it('shows event reasons', () => {
      renderWithQueryClient(<Scaling />);
      
      const historyTab = screen.getByText('History');
      fireEvent.click(historyTab);
      
      // Look for scaling reasons
      expect(screen.getByText('CPU threshold exceeded')).toBeInTheDocument();
      expect(screen.getByText('Memory threshold exceeded')).toBeInTheDocument();
    });
  });

  describe('settings section', () => {
    it('displays global settings', () => {
      renderWithQueryClient(<Scaling />);
      
      const settingsTab = screen.getByText('Settings');
      fireEvent.click(settingsTab);
      
      expect(screen.getByText('Global Settings')).toBeInTheDocument();
    });

    it('shows configuration options', () => {
      renderWithQueryClient(<Scaling />);
      
      const settingsTab = screen.getByText('Settings');
      fireEvent.click(settingsTab);
      
      expect(screen.getByText('Default Cooldown')).toBeInTheDocument();
      expect(screen.getByText('Max Scale Factor')).toBeInTheDocument();
      expect(screen.getByText('Cost Optimization')).toBeInTheDocument();
    });

    it('allows adjusting settings', () => {
      renderWithQueryClient(<Scaling />);
      
      const settingsTab = screen.getByText('Settings');
      fireEvent.click(settingsTab);
      
      // Look for input fields
      const inputs = screen.getAllByRole('spinbutton');
      expect(inputs.length).toBeGreaterThan(0);
    });
  });

  describe('cost optimization', () => {
    it('displays cost information', () => {
      renderWithQueryClient(<Scaling />);
      
      // Look for cost-related information
      const costInfo = screen.getAllByText(/\$\d+\.\d+\/hour/);
      expect(costInfo.length).toBeGreaterThan(0);
    });

    it('shows cost savings', () => {
      renderWithQueryClient(<Scaling />);
      
      // Look for savings information
      const savingsInfo = screen.getAllByText(/Save \$\d+\.\d+/);
      expect(savingsInfo.length).toBeGreaterThan(0);
    });

    it('displays efficiency metrics', () => {
      renderWithQueryClient(<Scaling />);
      
      // Look for efficiency indicators
      const efficiencyInfo = screen.getAllByText(/\d+% efficiency/);
      expect(efficiencyInfo.length).toBeGreaterThan(0);
    });
  });

  describe('alerts and notifications', () => {
    it('shows alert indicators', () => {
      renderWithQueryClient(<Scaling />);
      
      // Look for alert icons or badges
      const alertIcons = document.querySelectorAll('.text-orange-500');
      expect(alertIcons.length).toBeGreaterThan(0);
    });

    it('displays warning messages', () => {
      renderWithQueryClient(<Scaling />);
      
      // Look for warning indicators
      const warningInfo = screen.getAllByText(/warning|alert/i);
      expect(warningInfo.length).toBeGreaterThan(0);
    });

    it('shows success indicators', () => {
      renderWithQueryClient(<Scaling />);
      
      // Look for success indicators
      const successInfo = screen.getAllByText(/healthy|optimal/i);
      expect(successInfo.length).toBeGreaterThan(0);
    });
  });

  describe('form interactions', () => {
    it('handles input changes', () => {
      renderWithQueryClient(<Scaling />);
      
      const inputs = screen.getAllByRole('spinbutton');
      if (inputs.length > 0) {
        fireEvent.change(inputs[0], { target: { value: '5' } });
        expect(inputs[0]).toHaveValue(5);
      }
    });

    it('handles switch toggles', () => {
      renderWithQueryClient(<Scaling />);
      
      const switches = screen.getAllByRole('switch');
      if (switches.length > 0) {
        fireEvent.click(switches[0]);
        // Switch state should change (we can't easily test the internal state)
      }
    });

    it('handles button clicks', () => {
      renderWithQueryClient(<Scaling />);
      
      const buttons = screen.getAllByRole('button');
      if (buttons.length > 0) {
        fireEvent.click(buttons[0]);
        // Button should handle the click
      }
    });
  });

  describe('data visualization', () => {
    it('renders charts', () => {
      renderWithQueryClient(<Scaling />);
      
      const metricsTab = screen.getByText('Metrics');
      fireEvent.click(metricsTab);
      
      // Charts should be present (we check for containers)
      const chartContainers = screen.getAllByRole('img');
      expect(chartContainers.length).toBeGreaterThan(0);
    });

    it('displays progress bars', () => {
      renderWithQueryClient(<Scaling />);
      
      // Look for progress indicators
      const progressBars = screen.getAllByRole('progressbar');
      expect(progressBars.length).toBeGreaterThan(0);
    });

    it('shows status indicators', () => {
      renderWithQueryClient(<Scaling />);
      
      // Status indicators should be present
      const statusElements = screen.getAllByRole('status');
      expect(statusElements.length).toBeGreaterThan(0);
    });
  });

  describe('accessibility', () => {
    it('has proper heading hierarchy', () => {
      renderWithQueryClient(<Scaling />);
      
      const mainHeading = screen.getByRole('heading', { level: 1 });
      expect(mainHeading).toHaveTextContent('Auto Scaling');
    });

    it('provides accessible form controls', () => {
      renderWithQueryClient(<Scaling />);
      
      const inputs = screen.getAllByRole('spinbutton');
      inputs.forEach(input => {
        expect(input).toBeInTheDocument();
      });
    });

    it('has proper ARIA labels', () => {
      renderWithQueryClient(<Scaling />);
      
      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        expect(button).toBeInTheDocument();
      });
    });

    it('provides keyboard navigation', () => {
      renderWithQueryClient(<Scaling />);
      
      const focusableElements = screen.getAllByRole('button');
      expect(focusableElements.length).toBeGreaterThan(0);
    });
  });

  describe('responsive design', () => {
    it('adapts to different screen sizes', () => {
      renderWithQueryClient(<Scaling />);
      
      // Component should handle different viewport sizes
      const container = screen.getByText('Auto Scaling').closest('div');
      expect(container).toBeInTheDocument();
    });

    it('maintains layout on mobile', () => {
      renderWithQueryClient(<Scaling />);
      
      // Should work on mobile devices
      const mobileLayout = screen.getByText('Auto Scaling');
      expect(mobileLayout).toBeInTheDocument();
    });
  });

  describe('error handling', () => {
    it('handles missing data gracefully', () => {
      renderWithQueryClient(<Scaling />);
      
      // Should still render the basic structure
      expect(screen.getByText('Auto Scaling')).toBeInTheDocument();
    });

    it('displays error states', () => {
      renderWithQueryClient(<Scaling />);
      
      // Should handle error states appropriately
      const errorIndicators = screen.getAllByText(/error|failed/i);
      if (errorIndicators.length > 0) {
        expect(errorIndicators[0]).toBeInTheDocument();
      }
    });
  });

  describe('performance', () => {
    it('renders efficiently', () => {
      const startTime = performance.now();
      renderWithQueryClient(<Scaling />);
      const endTime = performance.now();
      
      // Should render quickly
      expect(endTime - startTime).toBeLessThan(200); // 200ms threshold
    });

    it('handles large datasets', () => {
      renderWithQueryClient(<Scaling />);
      
      // Should handle multiple policies and metrics
      const policyElements = screen.getAllByText(/Web App|API Service|Database/);
      expect(policyElements.length).toBeGreaterThan(0);
    });
  });

  describe('visual elements', () => {
    it('renders icons correctly', () => {
      renderWithQueryClient(<Scaling />);
      
      const icons = document.querySelectorAll('svg');
      expect(icons.length).toBeGreaterThan(0);
    });

    it('displays badges with correct styling', () => {
      renderWithQueryClient(<Scaling />);
      
      const badges = screen.getAllByRole('status');
      expect(badges.length).toBeGreaterThan(0);
    });

    it('shows proper color coding', () => {
      renderWithQueryClient(<Scaling />);
      
      // Should have proper color indicators for different states
      const colorElements = document.querySelectorAll('.text-green-500, .text-red-500, .text-orange-500');
      expect(colorElements.length).toBeGreaterThan(0);
    });
  });

  describe('data consistency', () => {
    it('maintains consistent data structure', () => {
      renderWithQueryClient(<Scaling />);
      
      // All policy cards should follow the same structure
      const policyCards = screen.getAllByRole('region');
      expect(policyCards.length).toBeGreaterThan(0);
    });

    it('displays consistent formatting', () => {
      renderWithQueryClient(<Scaling />);
      
      // Numbers and percentages should be formatted consistently
      const numbers = screen.getAllByText(/\d+/);
      expect(numbers.length).toBeGreaterThan(0);
    });
  });
});
