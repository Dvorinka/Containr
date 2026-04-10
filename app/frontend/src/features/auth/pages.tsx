import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { AlertCircle, ArrowRight, Github, Gitlab, KeyRound, Loader2, Mail, Shield, User2, Workflow } from 'lucide-react';
import {
  AuthError,
  startBitbucketSignIn,
  startGitLabSignIn,
  requestMagicLinkInvite,
  signInWithEmail,
  signUpWithEmail,
  startGiteaSignIn,
  startGitHubSignIn,
} from '@/lib/auth-client';
import { useAuthSession } from '@/lib/use-auth-session';

function sanitizeRedirect(raw: string | null): string {
  if (!raw) {
    return '/projects';
  }

  const value = raw.trim();
  if (!value.startsWith('/') || value.startsWith('//')) {
    return '/projects';
  }

  return value;
}

function buildOAuthCallbackURL(path: string): string {
  const cleanPath = sanitizeRedirect(path);
  return `${window.location.origin}${cleanPath}`;
}

function AuthCanvas() {
  const bars = [32, 44, 28, 60, 52, 64, 36, 48, 54, 72, 66, 78];

  return (
    <div className="relative hidden border-r border-[var(--border-subtle)] bg-[var(--bg-base)]/70 backdrop-blur-2xl xl:flex xl:w-[46%]">
      <div className="absolute inset-0 bg-[#e8316a]/10" />
      <div className="relative z-10 flex h-full w-full flex-col justify-between p-10">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--text-muted)]">Containr Access</p>
          <h1 className="mt-3 font-headline text-4xl font-semibold leading-tight text-[var(--text-primary)]">
            Secure Sessions,
            <br />
            Better Auth
          </h1>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-[var(--text-secondary)]">
            Email/password, invite magic links, and OAuth providers (GitHub, GitLab, Bitbucket, Gitea) are handled by a dedicated Better Auth service with cookie sessions.
          </p>
        </div>

        <div className="panel p-5">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">Auth Health</p>
            <span className="flex items-center gap-2 text-xs text-[var(--success)]">
              <span className="live-pulse h-2 w-2 rounded-full bg-[var(--success)]" />
              Live
            </span>
          </div>
          <div className="grid grid-cols-12 items-end gap-1.5">
            {bars.map((height, index) => (
              <div
                key={`bar-${index}`}
                className="rounded-sm"
                style={{ height: `${height}px`, background: '#e8316a' }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
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
    <div className="w-full max-w-[520px] rounded-[var(--radius-xl)] border border-[var(--border-subtle)] bg-[var(--surface-card)]/92 p-7 shadow-2xl shadow-black/35 backdrop-blur-xl md:p-8">
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">Containr</p>
        <h2 className="mt-2 font-headline text-2xl font-semibold text-[var(--text-primary)]">{title}</h2>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">{subtitle}</p>
      </div>
      {children}
    </div>
  );
}

function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--bg-void)]">
      <div className="ambient-glow" />
      <div className="relative flex min-h-screen">
        <AuthCanvas />
        <div className="flex w-full items-center justify-center px-5 py-8 md:px-8">{children}</div>
      </div>
    </div>
  );
}

function AuthErrorNotice({ message }: { message: string }) {
  return (
    <div className="mb-4 flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--error-soft)] bg-[var(--error-soft)] px-3 py-2.5 text-sm text-[var(--error)]">
      <AlertCircle size={16} className="mt-0.5 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

function AuthInfoNotice({ message }: { message: string }) {
  return (
    <div className="mb-4 rounded-[var(--radius-md)] border border-[var(--success-soft)] bg-[var(--success-soft)] px-3 py-2.5 text-sm text-[var(--success)]">
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
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [magicEmail, setMagicEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isMagicLoading, setIsMagicLoading] = useState(false);

  if (sessionQuery.data) {
    return <Navigate to={redirectPath} replace />;
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

  const submitMagicLink = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setInfo(null);
    setIsMagicLoading(true);

    try {
      await requestMagicLinkInvite(magicEmail.trim(), buildOAuthCallbackURL(redirectPath));
      setInfo('Magic invite link sent. Check your email inbox.');
    } catch (exception) {
      const message = exception instanceof AuthError ? exception.message : 'Failed to send magic link';
      setError(message);
    } finally {
      setIsMagicLoading(false);
    }
  };

  const signInWithGitHubProvider = async () => {
    setError(null);
    await startGitHubSignIn(buildOAuthCallbackURL(redirectPath));
  };

  const signInWithGiteaProvider = async () => {
    setError(null);
    await startGiteaSignIn(buildOAuthCallbackURL(redirectPath));
  };

  const signInWithGitLabProvider = async () => {
    setError(null);
    await startGitLabSignIn(buildOAuthCallbackURL(redirectPath));
  };

  const signInWithBitbucketProvider = async () => {
    setError(null);
    await startBitbucketSignIn(buildOAuthCallbackURL(redirectPath));
  };

  return (
    <AuthLayout>
      <AuthCard title="Sign In" subtitle="Use your Containr account, invite magic link, or provider OAuth.">
        {error ? <AuthErrorNotice message={error} /> : null}
        {info ? <AuthInfoNotice message={info} /> : null}

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

          <button
            type="submit"
            disabled={isSubmitting || sessionQuery.isPending}
            className="mt-1 inline-flex h-10 w-full items-center justify-center gap-2 rounded-[var(--radius-md)] text-sm font-semibold text-white shadow-lg transition-all disabled:cursor-not-allowed disabled:opacity-60"
            style={{ background: '#e8316a' }}
          >
            {isSubmitting ? <Loader2 size={15} className="animate-spin" /> : <Mail size={15} />}
            Continue
          </button>
        </form>

        <div className="my-5 h-px bg-[var(--border-subtle)]" />

        <div className="grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => void signInWithGitHubProvider()}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] text-sm font-medium text-[var(--text-primary)] transition-colors hover:border-[var(--border-default)]"
          >
            <Github size={15} />
            GitHub
          </button>
          <button
            type="button"
            onClick={() => void signInWithGitLabProvider()}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] text-sm font-medium text-[var(--text-primary)] transition-colors hover:border-[var(--border-default)]"
          >
            <Gitlab size={15} />
            GitLab
          </button>
          <button
            type="button"
            onClick={() => void signInWithBitbucketProvider()}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] text-sm font-medium text-[var(--text-primary)] transition-colors hover:border-[var(--border-default)]"
          >
            <Workflow size={15} />
            Bitbucket
          </button>
          <button
            type="button"
            onClick={() => void signInWithGiteaProvider()}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] text-sm font-medium text-[var(--text-primary)] transition-colors hover:border-[var(--border-default)]"
          >
            <Shield size={15} />
            Gitea
          </button>
        </div>

        <form className="mt-4 space-y-2" onSubmit={submitMagicLink}>
          <label className="block text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
            Magic Link Invite
            <input
              type="email"
              autoComplete="email"
              value={magicEmail}
              onChange={(event) => setMagicEmail(event.target.value)}
              required
              className="mt-2 w-full rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none transition-colors focus:border-[var(--accent-primary)]"
              placeholder="invite@example.com"
            />
          </label>
          <button
            type="submit"
            disabled={isMagicLoading}
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-[var(--radius-md)] border border-[var(--border-subtle)] text-sm font-medium text-[var(--text-primary)] transition-colors hover:border-[var(--border-default)] disabled:opacity-60"
          >
            {isMagicLoading ? <Loader2 size={15} className="animate-spin" /> : <KeyRound size={15} />}
            Send Invite Link
          </button>
        </form>

        <div className="mt-5 flex items-center justify-between text-xs text-[var(--text-secondary)]">
          <span>No account yet?</span>
          <Link to={`/auth/sign-up?redirect=${encodeURIComponent(redirectPath)}`} className="inline-flex items-center gap-1 text-[var(--accent-primary)] hover:underline">
            Create one <ArrowRight size={12} />
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
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (sessionQuery.data) {
    return <Navigate to={redirectPath} replace />;
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
      <AuthCard title="Create Account" subtitle="Provision your operator account with email/password auth.">
        {error ? <AuthErrorNotice message={error} /> : null}

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

          <button
            type="submit"
            disabled={isSubmitting || sessionQuery.isPending}
            className="mt-1 inline-flex h-10 w-full items-center justify-center gap-2 rounded-[var(--radius-md)] text-sm font-semibold text-white shadow-lg transition-all disabled:cursor-not-allowed disabled:opacity-60"
            style={{ background: '#e8316a' }}
          >
            {isSubmitting ? <Loader2 size={15} className="animate-spin" /> : <User2 size={15} />}
            Create Account
          </button>
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
