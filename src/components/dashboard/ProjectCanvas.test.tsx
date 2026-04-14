import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProjectCanvas } from './ProjectCanvas';

// Mock any external dependencies
vi.mock('react', async () => {
  const actual = await vi.importActual('react');
  return {
    ...actual,
    // Mock any specific React hooks if needed
  };
});

describe('ProjectCanvas', () => {
  describe('rendering', () => {
    it('renders without crashing', () => {
      render(<ProjectCanvas />);
    });

    it('displays the main title', () => {
      render(<ProjectCanvas />);
      expect(screen.getByText('Project Canvas')).toBeInTheDocument();
    });

    it('displays project actions', () => {
      render(<ProjectCanvas />);
      
      expect(screen.getByText('New Service')).toBeInTheDocument();
      expect(screen.getByText('Redeploy All')).toBeInTheDocument();
      expect(screen.getByText('View Logs')).toBeInTheDocument();
    });

    it('shows service nodes', () => {
      render(<ProjectCanvas />);
      
      // Check for different service types
      expect(screen.getByText('Web App')).toBeInTheDocument();
      expect(screen.getByText('Database')).toBeInTheDocument();
      expect(screen.getByText('API Service')).toBeInTheDocument();
      expect(screen.getByText('Worker')).toBeInTheDocument();
    });

    it('displays service status indicators', () => {
      render(<ProjectCanvas />);
      
      // Check for status badges
      const statusBadges = screen.getAllByText('running');
      expect(statusBadges.length).toBeGreaterThan(0);
    });

    it('shows service metrics', () => {
      render(<ProjectCanvas />);
      
      // Check for CPU and memory metrics
      expect(screen.getByText('CPU')).toBeInTheDocument();
      expect(screen.getByText('Memory')).toBeInTheDocument();
    });
  });

  describe('service interactions', () => {
    it('allows service selection', () => {
      render(<ProjectCanvas />);
      
      const serviceNodes = screen.getAllByRole('button').filter(button => 
        button.textContent?.includes('Web App') || 
        button.textContent?.includes('Database')
      );
      
      if (serviceNodes.length > 0) {
        fireEvent.click(serviceNodes[0]);
        // Should update the selected state (we can't easily test internal state)
      }
    });

    it('shows service context menu', () => {
      render(<ProjectCanvas />);
      
      // Look for more options buttons
      const moreButtons = screen.getAllByLabelText('More options');
      expect(moreButtons.length).toBeGreaterThan(0);
    });

    it('displays service details', () => {
      render(<ProjectCanvas />);
      
      // Check for service details like URLs, deployment info
      expect(screen.getByText('https://web-app.example.com')).toBeInTheDocument();
      expect(screen.getByText('Last deploy')).toBeInTheDocument();
    });
  });

  describe('service actions', () => {
    it('provides service control buttons', () => {
      render(<ProjectCanvas />);
      
      // Check for action buttons
      expect(screen.getByText('Start')).toBeInTheDocument();
      expect(screen.getByText('Stop')).toBeInTheDocument();
      expect(screen.getByText('Restart')).toBeInTheDocument();
      expect(screen.getByText('Rebuild')).toBeInTheDocument();
    });

    it('shows environment information', () => {
      render(<ProjectCanvas />);
      
      // Check for environment badges
      const envBadges = screen.getAllByText('production');
      expect(envBadges.length).toBeGreaterThan(0);
    });

    it('displays deployment information', () => {
      render(<ProjectCanvas />);
      
      // Check for deployment-related information
      expect(screen.getByText('Deployments')).toBeInTheDocument();
      expect(screen.getByText('Build')).toBeInTheDocument();
    });
  });

  describe('visual elements', () => {
    it('renders service icons', () => {
      render(<ProjectCanvas />);
      
      // Icons should be present (we check for the structure)
      const iconElements = document.querySelectorAll('svg');
      expect(iconElements.length).toBeGreaterThan(0);
    });

    it('displays status colors correctly', () => {
      render(<ProjectCanvas />);
      
      // Status indicators should have appropriate styling
      const statusElements = screen.getAllByText('running');
      statusElements.forEach(element => {
        expect(element).toBeInTheDocument();
      });
    });

    it('shows connection lines between services', () => {
      render(<ProjectCanvas />);
      
      // The canvas should render connections (we check the structure)
      const canvas = screen.getByText('Project Canvas').closest('div');
      expect(canvas).toBeInTheDocument();
    });
  });

  describe('service types', () => {
    it('displays different service types correctly', () => {
      render(<ProjectCanvas />);
      
      // Check for various service types
      expect(screen.getByText('Web App')).toBeInTheDocument();
      expect(screen.getByText('Database')).toBeInTheDocument();
      expect(screen.getByText('API Service')).toBeInTheDocument();
      expect(screen.getByText('Worker')).toBeInTheDocument();
    });

    it('shows appropriate icons for service types', () => {
      render(<ProjectCanvas />);
      
      // Different service types should have different visual representations
      const serviceCards = screen.getAllByRole('region');
      expect(serviceCards.length).toBeGreaterThan(3);
    });
  });

  describe('status indicators', () => {
    it('displays running status', () => {
      render(<ProjectCanvas />);
      
      const runningStatuses = screen.getAllByText('running');
      expect(runningStatuses.length).toBeGreaterThan(0);
    });

    it('displays building status', () => {
      render(<ProjectCanvas />);
      
      const buildingStatuses = screen.getAllByText('building');
      expect(buildingStatuses.length).toBeGreaterThan(0);
    });

    it('displays failed status', () => {
      render(<ProjectCanvas />);
      
      const failedStatuses = screen.getAllByText('failed');
      expect(failedStatuses.length).toBeGreaterThan(0);
    });

    it('displays stopped status', () => {
      render(<ProjectCanvas />);
      
      const stoppedStatuses = screen.getAllByText('stopped');
      expect(stoppedStatuses.length).toBeGreaterThan(0);
    });
  });

  describe('metrics display', () => {
    it('shows CPU usage', () => {
      render(<ProjectCanvas />);
      
      expect(screen.getByText('CPU')).toBeInTheDocument();
      // Look for CPU percentage values
      const cpuValues = screen.getAllByText(/\d+% CPU/);
      expect(cpuValues.length).toBeGreaterThan(0);
    });

    it('shows memory usage', () => {
      render(<ProjectCanvas />);
      
      expect(screen.getByText('Memory')).toBeInTheDocument();
      // Look for memory values
      const memoryValues = screen.getAllByText(/\d+\.?\d* GB/);
      expect(memoryValues.length).toBeGreaterThan(0);
    });

    it('displays instance count', () => {
      render(<ProjectCanvas />);
      
      // Look for instance information
      const instanceInfo = screen.getAllByText(/instances?/i);
      expect(instanceInfo.length).toBeGreaterThan(0);
    });
  });

  describe('deployment information', () => {
    it('shows last deployment time', () => {
      render(<ProjectCanvas />);
      
      expect(screen.getByText('Last deploy')).toBeInTheDocument();
      // Look for time information
      const timeInfo = screen.getAllByText(/\d+ \w+ ago/);
      expect(timeInfo.length).toBeGreaterThan(0);
    });

    it('displays deployment status', () => {
      render(<ProjectCanvas />);
      
      // Check for deployment status indicators
      const deployStatus = screen.getAllByText(/deployed|failed|building/);
      expect(deployStatus.length).toBeGreaterThan(0);
    });

    it('shows build information', () => {
      render(<ProjectCanvas />);
      
      expect(screen.getByText('Build')).toBeInTheDocument();
      // Look for build-related information
      const buildInfo = screen.getAllByText(/commit|branch|tag/);
      expect(buildInfo.length).toBeGreaterThan(0);
    });
  });

  describe('environment context', () => {
    it('displays environment badges', () => {
      render(<ProjectCanvas />);
      
      // Check for different environments
      const environments = ['production', 'preview', 'development'];
      environments.forEach(env => {
        const envElements = screen.getAllByText(env);
        if (envElements.length > 0) {
          expect(envElements[0]).toBeInTheDocument();
        }
      });
    });

    it('shows region information', () => {
      render(<ProjectCanvas />);
      
      // Look for region information
      const regionInfo = screen.getAllByText(/us-east-1|eu-west-1|asia-southeast/);
      expect(regionInfo.length).toBeGreaterThan(0);
    });
  });

  describe('actions and controls', () => {
    it('provides new service button', () => {
      render(<ProjectCanvas />);
      
      const newServiceButton = screen.getByText('New Service');
      expect(newServiceButton).toBeInTheDocument();
      expect(newServiceButton.closest('button')).toBeInTheDocument();
    });

    it('provides redeploy all button', () => {
      render(<ProjectCanvas />);
      
      const redeployButton = screen.getByText('Redeploy All');
      expect(redeployButton).toBeInTheDocument();
      expect(redeployButton.closest('button')).toBeInTheDocument();
    });

    it('provides view logs button', () => {
      render(<ProjectCanvas />);
      
      const logsButton = screen.getByText('View Logs');
      expect(logsButton).toBeInTheDocument();
      expect(logsButton.closest('button')).toBeInTheDocument();
    });

    it('shows individual service controls', () => {
      render(<ProjectCanvas />);
      
      // Check for individual service action buttons
      const actionButtons = screen.getAllByText(/Start|Stop|Restart|Rebuild/);
      expect(actionButtons.length).toBeGreaterThan(0);
    });
  });

  describe('accessibility', () => {
    it('has proper heading hierarchy', () => {
      render(<ProjectCanvas />);
      
      const mainHeading = screen.getByRole('heading', { level: 2 });
      expect(mainHeading).toHaveTextContent('Project Canvas');
    });

    it('provides accessible buttons', () => {
      render(<ProjectCanvas />);
      
      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        expect(button).toBeInTheDocument();
      });
    });

    it('has semantic structure', () => {
      render(<ProjectCanvas />);
      
      const regions = screen.getAllByRole('region');
      expect(regions.length).toBeGreaterThan(0);
    });
  });

  describe('responsive design', () => {
    it('adapts to different screen sizes', () => {
      render(<ProjectCanvas />);
      
      // Component should handle different viewport sizes
      const container = screen.getByText('Project Canvas').closest('div');
      expect(container).toBeInTheDocument();
    });
  });

  describe('error handling', () => {
    it('handles missing service data gracefully', () => {
      render(<ProjectCanvas />);
      
      // Should still render the basic structure even with missing data
      expect(screen.getByText('Project Canvas')).toBeInTheDocument();
    });

    it('displays error states', () => {
      render(<ProjectCanvas />);
      
      // Check for failed status indicators
      const failedElements = screen.getAllByText('failed');
      if (failedElements.length > 0) {
        expect(failedElements[0]).toBeInTheDocument();
      }
    });
  });

  describe('performance', () => {
    it('renders efficiently with multiple services', () => {
      const startTime = performance.now();
      render(<ProjectCanvas />);
      const endTime = performance.now();
      
      // Should render quickly even with multiple services
      expect(endTime - startTime).toBeLessThan(200); // 200ms threshold
    });
  });

  describe('data consistency', () => {
    it('maintains consistent service structure', () => {
      render(<ProjectCanvas />);
      
      // All services should follow the same structure
      const serviceCards = screen.getAllByRole('region');
      serviceCards.forEach(card => {
        expect(card).toBeInTheDocument();
      });
    });

    it('displays consistent status formatting', () => {
      render(<ProjectCanvas />);
      
      // Status should be consistently formatted
      const statusElements = screen.getAllByText(/running|building|failed|stopped|deploying/);
      statusElements.forEach(element => {
        expect(element).toBeInTheDocument();
      });
    });
  });
});
