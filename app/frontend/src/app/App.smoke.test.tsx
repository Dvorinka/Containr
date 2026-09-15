import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { ToastProvider } from '@/shared/components';
import App from './App';

function renderApp(initialPath: string) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        refetchOnWindowFocus: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <MemoryRouter initialEntries={[initialPath]}>
          <App />
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

describe('App smoke routes', () => {
  it('renders projects page in demo mode', async () => {
    renderApp('/projects?demo=1');

    expect(await screen.findByRole('heading', { name: /^projects$/i })).toBeInTheDocument();
    expect(screen.getByText(/demo mode active/i)).toBeInTheDocument();
    expect(screen.getByText(/deploy, manage, and monitor containerized services/i)).toBeInTheDocument();
  });

  it('renders builds page in demo mode', async () => {
    renderApp('/builds?demo=1');

    expect(await screen.findByRole('heading', { name: /build pipeline/i })).toBeInTheDocument();
    expect(screen.getByText(/polling/i)).toBeInTheDocument();
  });

  it('renders templates page in demo mode', async () => {
    renderApp('/templates?demo=1');

    expect(await screen.findByRole('heading', { name: /template catalog/i })).toBeInTheDocument();
    expect(screen.getAllByText(/react application/i).length).toBeGreaterThan(0);
  });
});
