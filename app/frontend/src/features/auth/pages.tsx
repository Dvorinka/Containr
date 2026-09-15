import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, ArrowRight, Github, Globe, Layers, Loader2, Mail, ScrollText, User2, Zap } from 'lucide-react';
import { LineAreaChart, DonutChart } from '@/shared/components';
import {
  AuthError,
  getAuthBootstrap,
  startGoogleSignIn,
  signInWithEmail,
  signUpWithEmail,
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
  const features = [
    { icon: Zap, title: 'Instant deploys', body: 'Images or Git repositories to running containers.' },
    { icon: Globe, title: 'Domains & routing', body: 'Traefik-managed endpoints per service.' },
    { icon: ScrollText, title: 'Logs & metrics', body: 'Live container telemetry and log streams.' },
    { icon: Layers, title: 'Project canvas', body: 'Services, groups, and dependencies on one map.' },
  ];
  const previewSparkline = [18, 22, 19, 31, 28, 42, 38, 51, 47, 58, 52, 64];

  return (
    <div className="relative hidden border-r border-[var(--border-subtle)] bg-[var(--bg-base)]/70 backdrop-blur-2xl xl:flex xl:w-[46%]">
      <div className="absolute inset-0 bg-[#e8316a]/10" />
      <div className="relative z-10 flex h-full w-full flex-col justify-between p-10">
        <div>
          <div className="flex items-center gap-3">
            <img src="/containr.svg" alt="Containr" className="h-9 w-9" />
            <span className="text-lg font-bold tracking-tight text-[var(--text-primary)]">Containr</span>
          </div>
          <h1 className="mt-8 font-headline text-4xl font-semibold leading-tight text-[var(--text-primary)]">
            Your containers,
            <br />
            one platform.
          </h1>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-[var(--text-secondary)]">
            Self-hosted deployment platform. Projects, services, builds, and live telemetry — owned end to end.
          </p>

          <div className="mt-8 grid grid-cols-2 gap-3">
            {features.map((feature) => (
              <div key={feature.title} className="flex items-start gap-3 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-card)]/60 p-3">
                <div className="card-icon shrink-0" style={{ width: 30, height: 30 }}>
                  <feature.icon size={14} />
                </div>
                <div>
                  <p className="text-xs font-semibold text-[var(--text-primary)]">{feature.title}</p>
                  <p className="mt-0.5 text-[11px] leading-snug text-[var(--text-tertiary)]">{feature.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="panel p-5">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">Platform Preview</p>
            <span className="badge-active"><span className="live-dot" />Active</span>
          </div>
          <div className="flex items-end gap-5">
            <div className="flex-1">
              <p className="text-2xl font-black tracking-tight text-[var(--text-primary)]">api-gateway</p>
              <p className="mb-2 text-xs text-[var(--text-tertiary)]">3 instances · deployed 4m ago</p>
              <LineAreaChart data={previewSparkline} color="#e8316a" height={64} />
            </div>
            <div className="shrink-0 pb-1">
              <DonutChart percentage={64} color="#9c7ef0" size={110} thickness={12} animated={false} />
              <p className="-mt-1 text-center text-[10px] uppercase tracking-wide text-[var(--text-muted)]">Memory</p>
            </div>
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
    <div className="w-full max-w-[460px] rounded-[var(--radius-xl)] border border-[var(--border-subtle)] bg-[var(--surface-card)]/92 p-7 shadow-2xl shadow-black/35 backdrop-blur-xl md:p-8">
      <div className="mb-7">
        <div className="mb-5 flex items-center gap-2.5 xl:hidden">
          <img src="/containr.svg" alt="Containr" className="h-8 w-8" />
          <span className="text-base font-bold tracking-tight text-[var(--text-primary)]">Containr</span>
        </div>
        <p className="hidden text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)] xl:block">Containr</p>
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
  const bootstrapQuery = useQuery({
    queryKey: ['auth-bootstrap'],
    queryFn: getAuthBootstrap,
  });
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
      <AuthCard title="Sign In" subtitle="Use email/password, GitHub, or Google.">
        {error ? <AuthErrorNotice message={error} /> : null}
        {info ? <AuthInfoNotice message={info} /> : null}
        {bootstrapQuery.isLoading ? <AuthInfoNotice message="Checking platform access mode..." /> : null}

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

        <div className="my-5 flex items-center gap-3">
          <div className="h-px flex-1 bg-[var(--border-subtle)]" />
          <span className="text-[11px] uppercase tracking-wider text-[var(--text-muted)]">or continue with</span>
          <div className="h-px flex-1 bg-[var(--border-subtle)]" />
        </div>

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
            onClick={() => void signInWithGoogleProvider()}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] text-sm font-medium text-[var(--text-primary)] transition-colors hover:border-[var(--border-default)]"
          >
            <span className="text-sm font-semibold">G</span>
            Google
          </button>
        </div>

        <div className="mt-5 flex items-center justify-between text-xs text-[var(--text-secondary)]">
          <span>Need access?</span>
          <span>Ask platform owner to create account.</span>
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

  if (bootstrapQuery.data?.mode === 'login') {
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
      <AuthCard title="Create Account" subtitle="Create first platform owner account. Registration closes after bootstrap.">
        {error ? <AuthErrorNotice message={error} /> : null}
        {bootstrapQuery.isLoading ? <AuthInfoNotice message="Checking platform bootstrap state..." /> : null}

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
