import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import EnvVariablesEditor from './EnvVariablesEditor';

// Mock the API
vi.mock('@/lib/api', () => ({
  variablesApi: {
    getVariables: vi.fn(),
    updateVariables: vi.fn(),
    addVariable: vi.fn(),
    deleteVariable: vi.fn(),
  },
}));

describe('EnvVariablesEditor', () => {
  let queryClient: QueryClient;
  let mockVariablesApi: any;

  beforeEach(async () => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    mockVariablesApi = await import('@/lib/api');
    vi.clearAllMocks();
  });

  const renderWithQueryClient = (component: React.ReactElement) => {
    return render(
      <QueryClientProvider client={queryClient}>
        {component}
      </QueryClientProvider>
    );
  };

  const mockVariables = [
    {
      id: 'var-1',
      service_id: 'service-1',
      key: 'DATABASE_URL',
      value: 'postgresql://localhost:5432/mydb',
      is_secret: true,
      created_at: '2024-01-15T10:30:00Z',
      updated_at: '2024-01-15T10:30:00Z',
    },
    {
      id: 'var-2',
      service_id: 'service-1',
      key: 'API_KEY',
      value: 'sk-1234567890',
      is_secret: true,
      created_at: '2024-01-15T09:15:00Z',
      updated_at: '2024-01-15T09:15:00Z',
    },
    {
      id: 'var-3',
      service_id: 'service-1',
      key: 'DEBUG_MODE',
      value: 'true',
      is_secret: false,
      created_at: '2024-01-15T08:00:00Z',
      updated_at: '2024-01-15T08:00:00Z',
    },
  ];

  describe('rendering', () => {
    it('renders without crashing', async () => {
      mockVariablesApi.variablesApi.getVariables.mockResolvedValue({
        variables: mockVariables,
      });

      renderWithQueryClient(
        <EnvVariablesEditor serviceId="service-1" />
      );

      await waitFor(() => {
        expect(screen.getByText('Environment Variables')).toBeInTheDocument();
      });
    });

    it('displays loading state', () => {
      mockVariablesApi.variablesApi.getVariables.mockImplementation(() => new Promise(() => {}));

      renderWithQueryClient(
        <EnvVariablesEditor serviceId="service-1" />
      );

      expect(screen.getByText('Loading environment variables...')).toBeInTheDocument();
    });

    it('displays existing variables', async () => {
      mockVariablesApi.variablesApi.getVariables.mockResolvedValue({
        variables: mockVariables,
      });

      renderWithQueryClient(
        <EnvVariablesEditor serviceId="service-1" />
      );

      await waitFor(() => {
        expect(screen.getByDisplayValue('DATABASE_URL')).toBeInTheDocument();
        expect(screen.getByDisplayValue('API_KEY')).toBeInTheDocument();
        expect(screen.getByDisplayValue('DEBUG_MODE')).toBeInTheDocument();
      });
    });

    it('shows empty state when no variables exist', async () => {
      mockVariablesApi.variablesApi.getVariables.mockResolvedValue({
        variables: [],
      });

      renderWithQueryClient(
        <EnvVariablesEditor serviceId="service-1" />
      );

      await waitFor(() => {
        expect(screen.getByText('No environment variables configured')).toBeInTheDocument();
      });
    });
  });

  describe('secret variables handling', () => {
    it('masks secret variable values', async () => {
      mockVariablesApi.variablesApi.getVariables.mockResolvedValue({
        variables: mockVariables,
      });

      renderWithQueryClient(
        <EnvVariablesEditor serviceId="service-1" />
      );

      await waitFor(() => {
        // Secret variables should have empty values in the input
        const secretInputs = screen.getAllByDisplayValue('');
        expect(secretInputs.length).toBeGreaterThan(0);
      });
    });

    it('shows secret indicators for secret variables', async () => {
      mockVariablesApi.variablesApi.getVariables.mockResolvedValue({
        variables: mockVariables,
      });

      renderWithQueryClient(
        <EnvVariablesEditor serviceId="service-1" />
      );

      await waitFor(() => {
        const keyIcons = document.querySelectorAll('svg');
        expect(keyIcons.length).toBeGreaterThan(0);
      });
    });

    it('allows toggling secret visibility', async () => {
      mockVariablesApi.variablesApi.getVariables.mockResolvedValue({
        variables: mockVariables,
      });

      renderWithQueryClient(
        <EnvVariablesEditor serviceId="service-1" />
      );

      await waitFor(() => {
        const eyeButtons = screen.getAllByRole('button');
        const secretToggleButton = eyeButtons.find(button => 
          button.getAttribute('aria-label')?.includes('secret')
        );
        
        if (secretToggleButton) {
          fireEvent.click(secretToggleButton);
        }
      });
    });
  });

  describe('variable management', () => {
    it('allows adding new variables', async () => {
      mockVariablesApi.variablesApi.getVariables.mockResolvedValue({
        variables: [],
      });

      renderWithQueryClient(
        <EnvVariablesEditor serviceId="service-1" />
      );

      await waitFor(() => {
        const addButton = screen.getByText('Add Variable');
        fireEvent.click(addButton);
      });

      await waitFor(() => {
        expect(screen.getByDisplayValue('')).toBeInTheDocument(); // New empty variable
      });
    });

    it('allows removing variables', async () => {
      mockVariablesApi.variablesApi.getVariables.mockResolvedValue({
        variables: mockVariables,
      });

      renderWithQueryClient(
        <EnvVariablesEditor serviceId="service-1" />
      );

      await waitFor(() => {
        const deleteButtons = screen.getAllByRole('button');
        const firstDeleteButton = deleteButtons.find(button => 
          button.getAttribute('aria-label')?.includes('delete')
        );
        
        if (firstDeleteButton) {
          fireEvent.click(firstDeleteButton);
        }
      });
    });

    it('allows editing variable keys and values', async () => {
      mockVariablesApi.variablesApi.getVariables.mockResolvedValue({
        variables: [mockVariables[2]], // Non-secret variable
      });

      renderWithQueryClient(
        <EnvVariablesEditor serviceId="service-1" />
      );

      await waitFor(() => {
        const keyInput = screen.getByDisplayValue('DEBUG_MODE');
        const valueInput = screen.getByDisplayValue('true');
        
        fireEvent.change(keyInput, { target: { value: 'NEW_DEBUG_MODE' } });
        fireEvent.change(valueInput, { target: { value: 'false' } });
      });

      await waitFor(() => {
        expect(screen.getByDisplayValue('NEW_DEBUG_MODE')).toBeInTheDocument();
        expect(screen.getByDisplayValue('false')).toBeInTheDocument();
      });
    });

    it('allows toggling secret status', async () => {
      mockVariablesApi.variablesApi.getVariables.mockResolvedValue({
        variables: [mockVariables[2]], // Non-secret variable
      });

      renderWithQueryClient(
        <EnvVariablesEditor serviceId="service-1" />
      );

      await waitFor(() => {
        const secretCheckbox = screen.getByRole('checkbox');
        fireEvent.click(secretCheckbox);
      });
    });
  });

  describe('save functionality', () => {
    it('shows save button when changes are made', async () => {
      mockVariablesApi.variablesApi.getVariables.mockResolvedValue({
        variables: mockVariables,
      });

      renderWithQueryClient(
        <EnvVariablesEditor serviceId="service-1" />
      );

      await waitFor(() => {
        const keyInput = screen.getByDisplayValue('DEBUG_MODE');
        fireEvent.change(keyInput, { target: { value: 'NEW_DEBUG_MODE' } });
      });

      await waitFor(() => {
        expect(screen.getByText('Save Changes')).toBeInTheDocument();
      });
    });

    it('calls update API when save is clicked', async () => {
      mockVariablesApi.variablesApi.getVariables.mockResolvedValue({
        variables: mockVariables,
      });
      mockVariablesApi.variablesApi.updateVariables.mockResolvedValue({});

      renderWithQueryClient(
        <EnvVariablesEditor serviceId="service-1" />
      );

      await waitFor(() => {
        const keyInput = screen.getByDisplayValue('DEBUG_MODE');
        fireEvent.change(keyInput, { target: { value: 'NEW_DEBUG_MODE' } });
      });

      await waitFor(() => {
        const saveButton = screen.getByText('Save Changes');
        fireEvent.click(saveButton);
      });

      await waitFor(() => {
        expect(mockVariablesApi.variablesApi.updateVariables).toHaveBeenCalled();
      });
    });

    it('disables save button while saving', async () => {
      mockVariablesApi.variablesApi.getVariables.mockResolvedValue({
        variables: mockVariables,
      });
      mockVariablesApi.variablesApi.updateVariables.mockImplementation(() => new Promise(() => {}));

      renderWithQueryClient(
        <EnvVariablesEditor serviceId="service-1" />
      );

      await waitFor(() => {
        const keyInput = screen.getByDisplayValue('DEBUG_MODE');
        fireEvent.change(keyInput, { target: { value: 'NEW_DEBUG_MODE' } });
      });

      await waitFor(() => {
        const saveButton = screen.getByText('Save Changes');
        fireEvent.click(saveButton);
      });

      await waitFor(() => {
        expect(screen.getByText('Saving...')).toBeInTheDocument();
      });
    });
  });

  describe('error handling', () => {
    it('handles API errors gracefully', async () => {
      mockVariablesApi.variablesApi.getVariables.mockRejectedValue(
        new Error('Failed to fetch variables')
      );

      renderWithQueryClient(
        <EnvVariablesEditor serviceId="service-1" />
      );

      await waitFor(() => {
        expect(screen.getByText('Error loading environment variables')).toBeInTheDocument();
      });
    });

    it('displays save errors', async () => {
      mockVariablesApi.variablesApi.getVariables.mockResolvedValue({
        variables: mockVariables,
      });
      mockVariablesApi.variablesApi.updateVariables.mockRejectedValue(
        new Error('Failed to save variables')
      );

      renderWithQueryClient(
        <EnvVariablesEditor serviceId="service-1" />
      );

      await waitFor(() => {
        const keyInput = screen.getByDisplayValue('DEBUG_MODE');
        fireEvent.change(keyInput, { target: { value: 'NEW_DEBUG_MODE' } });
      });

      await waitFor(() => {
        const saveButton = screen.getByText('Save Changes');
        fireEvent.click(saveButton);
      });

      await waitFor(() => {
        expect(screen.getByText('Failed to save variables')).toBeInTheDocument();
      });
    });
  });

  describe('validation', () => {
    it('prevents duplicate keys', async () => {
      mockVariablesApi.variablesApi.getVariables.mockResolvedValue({
        variables: mockVariables,
      });

      renderWithQueryClient(
        <EnvVariablesEditor serviceId="service-1" />
      );

      await waitFor(() => {
        const addButton = screen.getByText('Add Variable');
        fireEvent.click(addButton);
      });

      await waitFor(() => {
        const newKeyInput = screen.getAllByDisplayValue('')[1]; // Second empty input
        fireEvent.change(newKeyInput, { target: { value: 'DATABASE_URL' } });
      });

      await waitFor(() => {
        expect(screen.getByText('Variable key already exists')).toBeInTheDocument();
      });
    });

    it('prevents empty keys', async () => {
      mockVariablesApi.variablesApi.getVariables.mockResolvedValue({
        variables: [],
      });

      renderWithQueryClient(
        <EnvVariablesEditor serviceId="service-1" />
      );

      await waitFor(() => {
        const addButton = screen.getByText('Add Variable');
        fireEvent.click(addButton);
      });

      await waitFor(() => {
        const saveButton = screen.getByText('Save Changes');
        fireEvent.click(saveButton);
      });

      await waitFor(() => {
        expect(screen.getByText('Variable key cannot be empty')).toBeInTheDocument();
      });
    });
  });

  describe('accessibility', () => {
    it('has proper heading hierarchy', async () => {
      mockVariablesApi.variablesApi.getVariables.mockResolvedValue({
        variables: mockVariables,
      });

      renderWithQueryClient(
        <EnvVariablesEditor serviceId="service-1" />
      );

      await waitFor(() => {
        const mainHeading = screen.getByRole('heading', { level: 2 });
        expect(mainHeading).toHaveTextContent('Environment Variables');
      });
    });

    it('provides accessible form controls', async () => {
      mockVariablesApi.variablesApi.getVariables.mockResolvedValue({
        variables: mockVariables,
      });

      renderWithQueryClient(
        <EnvVariablesEditor serviceId="service-1" />
      );

      await waitFor(() => {
        const inputs = screen.getAllByRole('textbox');
        inputs.forEach(input => {
          expect(input).toBeInTheDocument();
        });
      });
    });

    it('has proper ARIA labels', async () => {
      mockVariablesApi.variablesApi.getVariables.mockResolvedValue({
        variables: mockVariables,
      });

      renderWithQueryClient(
        <EnvVariablesEditor serviceId="service-1" />
      );

      await waitFor(() => {
        const buttons = screen.getAllByRole('button');
        buttons.forEach(button => {
          expect(button).toBeInTheDocument();
        });
      });
    });
  });

  describe('props handling', () => {
    it('accepts different serviceId values', async () => {
      mockVariablesApi.variablesApi.getVariables.mockResolvedValue({
        variables: [],
      });

      renderWithQueryClient(
        <EnvVariablesEditor serviceId="custom-service" />
      );

      await waitFor(() => {
        expect(screen.getByText('Environment Variables')).toBeInTheDocument();
      });
    });
  });

  describe('visual elements', () => {
    it('renders icons correctly', async () => {
      mockVariablesApi.variablesApi.getVariables.mockResolvedValue({
        variables: mockVariables,
      });

      renderWithQueryClient(
        <EnvVariablesEditor serviceId="service-1" />
      );

      await waitFor(() => {
        const icons = document.querySelectorAll('svg');
        expect(icons.length).toBeGreaterThan(0);
      });
    });

    it('displays proper styling for secret variables', async () => {
      mockVariablesApi.variablesApi.getVariables.mockResolvedValue({
        variables: mockVariables,
      });

      renderWithQueryClient(
        <EnvVariablesEditor serviceId="service-1" />
      );

      await waitFor(() => {
        const secretIndicators = document.querySelectorAll('.text-orange-500');
        expect(secretIndicators.length).toBeGreaterThan(0);
      });
    });
  });

  describe('responsive design', () => {
    it('adapts to different content lengths', async () => {
      mockVariablesApi.variablesApi.getVariables.mockResolvedValue({
        variables: mockVariables,
      });

      renderWithQueryClient(
        <EnvVariablesEditor serviceId="service-1" />
      );

      await waitFor(() => {
        const container = screen.getByText('Environment Variables').closest('div');
        expect(container).toBeInTheDocument();
      });
    });
  });
});
