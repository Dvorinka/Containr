import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { SetupWizardPage } from './SetupWizardPage';
import type { SetupStatus } from '@/lib/api-client';

const mockStatus = vi.fn<() => Promise<SetupStatus>>();
const mockSession = vi.fn();

vi.mock('@/lib/api-client', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/api-client')>();
  return {
    ...mod,
    getSetupStatus: () => mockStatus(),
    completeSetup: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock('@/lib/use-auth-session', () => ({
  useAuthSession: () => mockSession(),
}));

function renderWizard() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/setup']}>
        <SetupWizardPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const base: SetupStatus = {
  has_users: false,
  setup_completed: false,
  needs_setup: true,
  has_github_app: false,
  has_tunnel: false,
  signup_enabled: false,
};

describe('SetupWizardPage', () => {
  beforeEach(() => {
    mockSession.mockReturnValue({ data: null });
  });

  it('prompts for the admin account on a fresh install', async () => {
    mockStatus.mockResolvedValue({ ...base });
    renderWizard();
    expect(await screen.findByText(/welcome to containr/i)).toBeInTheDocument();
    expect(screen.getByText(/create admin account/i)).toBeInTheDocument();
  });

  it('offers sign-in when users exist but nobody is signed in', async () => {
    mockStatus.mockResolvedValue({ ...base, has_users: true });
    renderWizard();
    expect(await screen.findByText(/sign in to continue setup/i)).toBeInTheDocument();
  });

  it('shows the git provider step for a signed-in admin without GitHub App', async () => {
    mockStatus.mockResolvedValue({ ...base, has_users: true });
    mockSession.mockReturnValue({ data: { user: { id: 'u1' } } });
    renderWizard();
    expect(await screen.findByText(/connect a git provider/i)).toBeInTheDocument();
    expect(screen.getByText(/set up github app/i)).toBeInTheDocument();
  });

  it('shows the tunnel step when git is already wired', async () => {
    mockStatus.mockResolvedValue({ ...base, has_users: true, has_github_app: true });
    mockSession.mockReturnValue({ data: { user: { id: 'u1' } } });
    renderWizard();
    expect(
      await screen.findByRole('heading', { name: /public access/i }),
    ).toBeInTheDocument();
  });

  it('lands on the finish step when everything is configured', async () => {
    mockStatus.mockResolvedValue({
      ...base,
      has_users: true,
      has_github_app: true,
      has_tunnel: true,
    });
    mockSession.mockReturnValue({ data: { user: { id: 'u1' } } });
    renderWizard();
    expect(await screen.findByText(/enter containr/i)).toBeInTheDocument();
  });
});
