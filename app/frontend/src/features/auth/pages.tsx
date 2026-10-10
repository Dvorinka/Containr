import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, ArrowRight, Github, Loader2, Mail, User2 } from 'lucide-react';
import {
  AuthError,
  getAuthBootstrap,
  startGoogleSignIn,
  signInWithEmail,
  signUpWithEmail,
  startGitHubSignIn,
} from '@/lib/auth-client';
import { acceptInvite, getInvite } from '@/lib/api-client';
import { useAuthSession } from '@/lib/use-auth-session';
import { GhostBtn, QuietBtn } from '@/shared/components/sentry';

function sanitizeRedirect(raw: string | null): string {
  if (!raw) {
    return '/';
  }

  const value = raw.trim();
  if (!value.startsWith('/') || value.startsWith('//')) {
    return '/';
  }

  return value;
}

function buildOAuthCallbackURL(path: string): string {
  const cleanPath = sanitizeRedirect(path);
  return `${window.location.origin}${cleanPath}`;
}

function GoogleMark() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"/>
      <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.46 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z"/>
    </svg>
  );
}

function AuthCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="w-full max-w-[400px]">
      <div className="s-card shadow-2xl shadow-black/50">
        <div className="s-cardhead mb-1">
          <h2 className="font-headline text-[17px] font-semibold text-[var(--text-primary)]">{title}</h2>
        </div>
        <p className="mb-6 v-mono text-[11.5px] text-[var(--text-tertiary)]">{subtitle}</p>
        {children}
      </div>
    </div>
  );
}

function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[var(--bg-void)]">
      <div className="subtle-grid absolute inset-0" />
      <div className="relative flex min-h-screen flex-col items-center justify-center px-5 py-10">
        <div className="mb-8 flex flex-col items-center">
          <img src="/containr.svg" alt="Containr" className="h-14 w-14" />
          <span className="mt-4 font-headline text-2xl font-bold tracking-tight text-[var(--text-primary)]">Containr</span>
          <span className="mt-1 v-mono text-[11px] uppercase tracking-[0.14em] text-[var(--text-muted)]">Self-hosted container platform</span>
        </div>
        {children}
        <p className="mt-8 text-center v-mono text-[10.5px] text-[var(--text-muted)]">
          Sessions are cookie-based · first account becomes platform owner
        </p>
      </div>
    </div>
  );
}

function AuthErrorNotice({ message }: { message: string }) {
  return (
    <div className="mb-4 s-inset flex items-start gap-2 !border-[var(--error)]/30 px-3 py-2.5 text-[12.5px] text-[var(--error)]">
      <AlertCircle size={15} className="mt-0.5 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

function AuthInfoNotice({ message }: { message: string }) {
  return (
    <div className="mb-4 s-inset !border-[var(--success)]/30 px-3 py-2.5 text-[12.5px] text-[var(--success)]">
      {message}
    </div>
  );
}

export function SignInPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const redirectPath = useMemo(() => sanitizeRedirect(searchParams.get('redirect')), [searchParams]);

  const sessionQuery = useAuthSession();
  const bootstrapQuery = useQuery({
    queryKey: ['auth-bootstrap'],
    queryFn: getAuthBootstrap,
  });
  const providers = bootstrapQuery.data?.providers ?? [];
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (sessionQuery.data) {
    return <Navigate to={redirectPath} replace />;
  }

  if (bootstrapQuery.data?.mode === 'register') {
    return <Navigate to={`/auth/sign-up?redirect=${encodeURIComponent(redirectPath)}`} replace />;
  }

  const submitEmailPassword = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setInfo(null);
    setIsSubmitting(true);

    try {
      await signInWithEmail(email.trim(), password);
      await queryClient.invalidateQueries({ queryKey: ['auth-session'] });
      navigate(redirectPath, { replace: true });
    } catch (exception) {
      const message = exception instanceof AuthError ? exception.message : 'Failed to sign in';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const signInWithGitHubProvider = async () => {
    setError(null);
    try {
      await startGitHubSignIn(buildOAuthCallbackURL(redirectPath));
    } catch (exception) {
      const message = exception instanceof AuthError ? exception.message : 'GitHub sign-in failed';
      setError(message);
    }
  };

  const signInWithGoogleProvider = async () => {
    setError(null);
    try {
      await startGoogleSignIn(buildOAuthCallbackURL(redirectPath));
    } catch (exception) {
      const message = exception instanceof AuthError ? exception.message : 'Google sign-in failed';
      setError(message);
    }
  };

  return (
    <AuthLayout>
      <AuthCard
        title="Sign In"
        subtitle={providers.length > 0 ? 'Use email/password or a connected provider.' : 'Use your email and password.'}
      >
        {error ? <AuthErrorNotice message={error} /> : null}
        {info ? <AuthInfoNotice message={info} /> : null}
        {bootstrapQuery.isLoading ? <AuthInfoNotice message="Checking platform access mode..." /> : null}
        {bootstrapQuery.isError ? <AuthErrorNotice message="Cannot reach the Containr API - check that the backend container is running." /> : null}

        <form className="space-y-3" onSubmit={submitEmailPassword}>
          <label className="block text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
            Email
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              className="mt-2 w-full rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none transition-colors focus:border-[var(--accent-primary)]"
              placeholder="you@example.com"
            />
          </label>

          <label className="block text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
            Password
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              className="mt-2 w-full rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none transition-colors focus:border-[var(--accent-primary)]"
              placeholder="Your password"
            />
          </label>

          <GhostBtn type="submit" disabled={isSubmitting || sessionQuery.isPending} className="!h-10 w-full justify-center">
            {isSubmitting ? <Loader2 size={15} className="animate-spin" /> : <Mail size={15} />}
            Continue
          </GhostBtn>
        </form>

        {providers.length > 0 ? (
          <>
            <div className="my-5 flex items-center gap-3">
              <div className="h-px flex-1 bg-[var(--border-subtle)]" />
              <span className="text-[11px] uppercase tracking-wider text-[var(--text-muted)]">or continue with</span>
              <div className="h-px flex-1 bg-[var(--border-subtle)]" />
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              {providers.includes('github') ? (
                <QuietBtn
                  onClick={() => void signInWithGitHubProvider()}
                  className="!h-10 justify-center text-sm"
                >
                  <Github size={15} />
                  GitHub
                </QuietBtn>
              ) : null}
              {providers.includes('google') ? (
                <QuietBtn
                  onClick={() => void signInWithGoogleProvider()}
                  className="!h-10 justify-center text-sm"
                >
                  <GoogleMark />
                  Google
                </QuietBtn>
              ) : null}
            </div>
          </>
        ) : null}

        <div className="mt-5 flex items-center justify-between text-xs text-[var(--text-secondary)]">
          <span>Need access?</span>
          <span>Ask platform owner to create account.</span>
        </div>
      </AuthCard>
    </AuthLayout>
  );
}

export function AcceptInvitePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const sessionQuery = useAuthSession();
  const inviteQuery = useQuery({
    queryKey: ['invite', token],
    queryFn: () => getInvite(token),
    enabled: token.length > 0,
    retry: false,
  });

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (sessionQuery.data) {
    return <Navigate to="/" replace />;
  }

  const boundEmail = inviteQuery.data?.email ?? undefined;
  const effectiveEmail = boundEmail ?? email;
  const inviteValid = inviteQuery.data?.valid === true;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await acceptInvite({ token, name: name.trim(), email: effectiveEmail.trim(), password });
      // Establish the cookie session — the accept endpoint creates the
      // account, sign-in creates the browser session.
      await signInWithEmail(effectiveEmail.trim(), password);
      await queryClient.invalidateQueries({ queryKey: ['auth-session'] });
      navigate('/', { replace: true });
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : 'Failed to accept invite');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!token) {
    return (
      <AuthLayout>
        <AuthCard title="Invalid invite" subtitle="This link is missing its invite token.">
          <AuthErrorNotice message="Ask your administrator for a fresh invite link." />
        </AuthCard>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <AuthCard
        title="Join the team"
        subtitle={boundEmail ? `Invited as ${boundEmail}` : 'You have been invited — create your account.'}
      >
        {error ? <AuthErrorNotice message={error} /> : null}
        {inviteQuery.isLoading ? <AuthInfoNotice message="Validating invite…" /> : null}
        {inviteQuery.isError ? <AuthErrorNotice message="This invite link is not valid." /> : null}
        {inviteQuery.data && !inviteValid ? (
          <AuthErrorNotice message={inviteQuery.data.used ? 'This invite was already used.' : 'This invite has expired.'} />
        ) : null}

        {inviteValid ? (
          <form className="space-y-3" onSubmit={submit}>
            <label className="block text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
              Name
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="mt-2 w-full rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none transition-colors focus:border-[var(--accent-primary)]"
                placeholder="Your name"
              />
            </label>

            <label className="block text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
              Email
              <input
                type="email"
                value={boundEmail ?? email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={Boolean(boundEmail)}
                required
                className="mt-2 w-full rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none transition-colors focus:border-[var(--accent-primary)] disabled:opacity-60"
                placeholder="you@example.com"
              />
            </label>

            <label className="block text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
              Password
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                minLength={8}
                required
                className="mt-2 w-full rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none transition-colors focus:border-[var(--accent-primary)]"
                placeholder="At least 8 characters"
              />
            </label>

            <GhostBtn type="submit" disabled={isSubmitting} className="!h-10 w-full justify-center">
              {isSubmitting ? <Loader2 size={15} className="animate-spin" /> : <User2 size={15} />}
              Accept invite
            </GhostBtn>
          </form>
        ) : null}

        <div className="mt-5 flex items-center justify-between text-xs text-[var(--text-secondary)]">
          <span>Already have an account?</span>
          <Link to="/auth/sign-in" className="inline-flex items-center gap-1 text-[var(--accent-primary)] hover:underline">
            Sign in <ArrowRight size={12} />
          </Link>
        </div>
      </AuthCard>
    </AuthLayout>
  );
}

export function SignUpPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const redirectPath = useMemo(() => sanitizeRedirect(searchParams.get('redirect')), [searchParams]);

  const sessionQuery = useAuthSession();
  const bootstrapQuery = useQuery({
    queryKey: ['auth-bootstrap'],
    queryFn: getAuthBootstrap,
  });
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (sessionQuery.data) {
    return <Navigate to={redirectPath} replace />;
  }

  // Registration stays available when the owner reopened it in Settings.
  if (bootstrapQuery.data?.mode === 'login' && !bootstrapQuery.data.signupEnabled) {
    return <Navigate to={`/auth/sign-in?redirect=${encodeURIComponent(redirectPath)}`} replace />;
  }

  const submitSignUp = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await signUpWithEmail(name.trim(), email.trim(), password);
      await queryClient.invalidateQueries({ queryKey: ['auth-session'] });
      navigate(redirectPath, { replace: true });
    } catch (exception) {
      const message = exception instanceof AuthError ? exception.message : 'Failed to create account';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout>
      <AuthCard
        title="Create Account"
        subtitle={bootstrapQuery.data?.mode === 'register'
          ? 'Create first platform owner account. Registration closes after bootstrap.'
          : 'Create a new account.'}
      >
        {error ? <AuthErrorNotice message={error} /> : null}
        {bootstrapQuery.isLoading ? <AuthInfoNotice message="Checking platform bootstrap state..." /> : null}
        {bootstrapQuery.isError ? <AuthErrorNotice message="Cannot reach the Containr API - check that the backend container is running." /> : null}

        <form className="space-y-3" onSubmit={submitSignUp}>
          <label className="block text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
            Name
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              className="mt-2 w-full rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none transition-colors focus:border-[var(--accent-primary)]"
              placeholder="Operator"
            />
          </label>

          <label className="block text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
              className="mt-2 w-full rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none transition-colors focus:border-[var(--accent-primary)]"
              placeholder="you@example.com"
            />
          </label>

          <label className="block text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
              className="mt-2 w-full rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none transition-colors focus:border-[var(--accent-primary)]"
              placeholder="At least 8 characters"
            />
          </label>

          <GhostBtn type="submit" disabled={isSubmitting || sessionQuery.isPending} className="!h-10 w-full justify-center">
            {isSubmitting ? <Loader2 size={15} className="animate-spin" /> : <User2 size={15} />}
            Create Account
          </GhostBtn>
        </form>

        <div className="mt-5 flex items-center justify-between text-xs text-[var(--text-secondary)]">
          <span>Already signed up?</span>
          <Link to={`/auth/sign-in?redirect=${encodeURIComponent(redirectPath)}`} className="inline-flex items-center gap-1 text-[var(--accent-primary)] hover:underline">
            Go to sign in <ArrowRight size={12} />
          </Link>
        </div>
      </AuthCard>
    </AuthLayout>
  );
}
