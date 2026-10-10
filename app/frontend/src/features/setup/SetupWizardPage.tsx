import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Check, ChevronRight, Github, Loader2, Rocket, ShieldCheck } from 'lucide-react';
import { useAuthSession } from '@/lib/use-auth-session';
import {
  completeSetup,
  createGitHubAppManifest,
  getSetupStatus,
  updatePlatformSettings,
} from '@/lib/api-client';
import { GhostBtn, QuietBtn } from '@/shared/components/sentry';

// Marker the GitHub App callback reads so the wizard flow resumes here
// instead of the settings page.
const SETUP_RETURN_KEY = 'containr.setup_return';

type Step = 'account' | 'github' | 'tunnel' | 'done';

export function SetupWizardPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const sessionQuery = useAuthSession();
  const statusQuery = useQuery({ queryKey: ['setup-status'], queryFn: getSetupStatus });
  const [override, setOverride] = useState<Step | null>(null);

  const status = statusQuery.data;
  const signedIn = Boolean(sessionQuery.data);

  const step: Step = useMemo(() => {
    if (override) return override;
    if (!status) return 'account';
    if (!status.has_users || !signedIn) return 'account';
    if (!status.has_github_app) return 'github';
    if (!status.has_tunnel) return 'tunnel';
    return 'done';
  }, [override, status, signedIn]);

  const completeMutation = useMutation({
    mutationFn: completeSetup,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['setup-status'] });
      navigate('/', { replace: true });
    },
  });

  if (statusQuery.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)]">
        <Loader2 size={22} className="animate-spin text-[var(--accent-primary)]" />
      </div>
    );
  }

  // Wizard is optional once the instance is already configured.
  if (status && !status.needs_setup && !override) {
    return <Navigate to="/" replace />;
  }

  const steps: { key: Step; label: string }[] = [
    { key: 'account', label: 'Admin account' },
    { key: 'github', label: 'Git provider' },
    { key: 'tunnel', label: 'Public access' },
    { key: 'done', label: 'Done' },
  ];
  const activeIdx = steps.findIndex((s) => s.key === step);

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex flex-col items-center px-5 py-16">
      <div className="w-full max-w-lg">
        <div className="flex items-center gap-2 mb-8">
          {steps.map((s, i) => (
            <div key={s.key} className="flex items-center gap-2">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-semibold border ${
                  i < activeIdx
                    ? 'bg-[var(--accent-primary)] border-[var(--accent-primary)] text-[var(--accent-on)]'
                    : i === activeIdx
                      ? 'border-[var(--accent-primary)] text-[var(--accent-primary)]'
                      : 'border-[var(--border-subtle)] text-[var(--text-muted)]'
                }`}
              >
                {i < activeIdx ? <Check size={12} /> : i + 1}
              </div>
              <span
                className={`text-xs ${i === activeIdx ? 'text-[var(--text-primary)] font-medium' : 'text-[var(--text-muted)]'}`}
              >
                {s.label}
              </span>
              {i < steps.length - 1 ? <div className="w-6 h-px bg-[var(--border-subtle)]" /> : null}
            </div>
          ))}
        </div>

        {step === 'account' ? (
          <section className="s-card">
            <div className="s-cardhead mb-1">
              <span className="s-ibox"><Rocket /></span>
              <h1 className="s-t">Welcome to Containr</h1>
            </div>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              First boot detected. Create the admin account — registration closes to the public
              right after, so this account owns the instance.
            </p>
            {status?.has_users && !signedIn ? (
              <div className="mt-4">
                <p className="text-sm text-[var(--text-secondary)]">
                  An account already exists — sign in to continue setup.
                </p>
                <Link
                  to="/auth/sign-in?redirect=/setup"
                  className="mt-4 s-btn-accent inline-flex items-center gap-2"
                >
                  Sign in <ChevronRight size={14} />
                </Link>
              </div>
            ) : !status?.has_users ? (
              <Link
                to="/auth/sign-up?redirect=/setup"
                className="mt-4 s-btn-accent inline-flex items-center gap-2"
              >
                Create admin account <ChevronRight size={14} />
              </Link>
            ) : null}
          </section>
        ) : null}

        {step === 'github' ? <GitHubStep onNext={() => setOverride('tunnel')} /> : null}
        {step === 'tunnel' ? <TunnelStep onNext={() => setOverride('done')} /> : null}

        {step === 'done' ? (
          <section className="s-card text-center">
            <div className="s-ibox mx-auto !h-10 !w-10"><ShieldCheck /></div>
            <h1 className="mt-4 font-headline text-lg font-bold text-[var(--text-primary)]">All set</h1>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              Deploy your first service from a git repo, an image, or a template — the dashboard is
              ready.
            </p>
            {completeMutation.isError ? (
              <p className="mt-3 text-xs text-[var(--error)]">
                {completeMutation.error instanceof Error
                  ? completeMutation.error.message
                  : 'Failed to save setup state'}
              </p>
            ) : null}
            <GhostBtn
              onClick={() => completeMutation.mutate()}
              disabled={completeMutation.isPending}
              className="mt-5 !h-10 !px-6"
            >
              {completeMutation.isPending ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <ShieldCheck size={15} />
              )}
              Enter Containr
            </GhostBtn>
          </section>
        ) : null}
      </div>
    </div>
  );
}

function GitHubStep({ onNext }: { onNext: () => void }) {
  const queryClient = useQueryClient();
  const provisionMutation = useMutation({
    mutationFn: async () => {
      const { url, manifest } = await createGitHubAppManifest({
        base_url: window.location.origin,
      });
      sessionStorage.setItem(SETUP_RETURN_KEY, '1');
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = url;
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = 'manifest';
      input.value = manifest;
      form.appendChild(input);
      document.body.appendChild(form);
      form.submit();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['setup-status'] }),
  });

  return (
    <section className="s-card">
      <div className="s-cardhead mb-1">
        <span className="s-ibox"><Github /></span>
        <h1 className="s-t">Connect a Git Provider</h1>
      </div>
      <p className="mt-1 text-sm text-[var(--text-secondary)]">
        Provision the instance GitHub App — repo push events then trigger deployments and preview
        environments automatically. Self-hosted GitLab/Gitea can be added later in Settings.
      </p>
      {provisionMutation.isError ? (
        <p className="mt-3 text-xs text-[var(--error)]">
          {provisionMutation.error instanceof Error
            ? provisionMutation.error.message
            : 'Could not start GitHub App provisioning'}
        </p>
      ) : null}
      <div className="mt-5 flex items-center gap-2">
        <GhostBtn
          onClick={() => provisionMutation.mutate()}
          disabled={provisionMutation.isPending}
        >
          {provisionMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : null}
          Set up GitHub App
        </GhostBtn>
        <QuietBtn onClick={onNext}>Skip for now</QuietBtn>
      </div>
    </section>
  );
}

function TunnelStep({ onNext }: { onNext: () => void }) {
  const queryClient = useQueryClient();
  const [token, setToken] = useState('');
  const saveMutation = useMutation({
    mutationFn: () =>
      updatePlatformSettings({ cloudflareTunnelToken: token.trim() || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['setup-status'] });
      onNext();
    },
  });

  return (
    <section className="s-card">
      <div className="s-cardhead mb-1">
        <span className="s-ibox"><ShieldCheck /></span>
        <h1 className="s-t">Public Access (optional)</h1>
      </div>
      <p className="mt-1 text-sm text-[var(--text-secondary)]">
        Paste a Cloudflare Tunnel token to expose this instance on the internet. Without one,
        Containr stays reachable on this network — you can add it later in Settings.
      </p>
      <input
        type="password"
        value={token}
        onChange={(e) => setToken(e.target.value)}
        placeholder="eyJhIjo… tunnel token"
        className="mt-4 w-full h-10 px-3 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] v-mono text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-primary)] transition-colors"
      />
      {saveMutation.isError ? (
        <p className="mt-3 text-xs text-[var(--error)]">
          {saveMutation.error instanceof Error ? saveMutation.error.message : 'Failed to save token'}
        </p>
      ) : null}
      <div className="mt-5 flex items-center gap-2">
        <GhostBtn
          onClick={() => (token.trim() ? saveMutation.mutate() : onNext())}
          disabled={saveMutation.isPending}
        >
          {saveMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : null}
          {token.trim() ? 'Save tunnel token' : 'Continue'}
        </GhostBtn>
        <QuietBtn onClick={onNext}>Skip</QuietBtn>
      </div>
    </section>
  );
}
