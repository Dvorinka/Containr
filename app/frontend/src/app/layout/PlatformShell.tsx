import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Bell,
  BookOpen,
  ChartBar,
  CheckCircle2,
  Container,
  FolderKanban,
  LayoutTemplate,
  LogOut,
  Moon,
  RefreshCw,
  Search,
  Settings,
  Sun,
  UploadCloud,
  Users,
} from 'lucide-react';
import {
  getUpgradeStatus,
  listAuditLogs,
  listBuilds,
  pullUpgradeImage,
} from '@/lib/api-client';
import { signOutAuthSession } from '@/lib/auth-client';
import { useAuthSession } from '@/lib/use-auth-session';
import { useToast } from '@/shared/components';

const navItems = [
  { label: 'Projects', href: '/projects', icon: FolderKanban },
  { label: 'Templates', href: '/templates', icon: LayoutTemplate },
  { label: 'Usage', href: '/usage', icon: ChartBar },
  { label: 'People', href: '/people', icon: Users },
  { label: 'Settings', href: '/settings', icon: Settings },
  { label: 'Docs', href: '/docs', icon: BookOpen },
];

type ThemeMode = 'dark' | 'light';

function getInitialTheme(): ThemeMode {
  if (typeof window === 'undefined') {
    return 'dark';
  }
  return localStorage.getItem('containr.theme') === 'light' ? 'light' : 'dark';
}

export function PlatformShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const isDemoMode = new URLSearchParams(location.search).get('demo') === '1';
  const href = (target: string) => (isDemoMode ? `${target}?demo=1` : target);
  const [theme, setTheme] = useState<ThemeMode>(() => getInitialTheme());
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const sessionQuery = useAuthSession({ enabled: !isDemoMode });
  const upgradeQuery = useQuery({
    queryKey: ['upgrade-status'],
    queryFn: getUpgradeStatus,
    enabled: !isDemoMode,
  });
  const buildsQuery = useQuery({
    queryKey: ['shell-build-notifications'],
    queryFn: () => listBuilds({ page: 1, limit: 5 }),
    enabled: !isDemoMode,
  });
  const auditQuery = useQuery({
    queryKey: ['shell-audit-notifications'],
    queryFn: () => listAuditLogs({ page: 1, limit: 5 }),
    enabled: !isDemoMode,
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('containr.theme', theme);
  }, [theme]);

  const pullMutation = useMutation({
    mutationFn: pullUpgradeImage,
    onSuccess: (status) => {
      queryClient.invalidateQueries({ queryKey: ['upgrade-status'] });
      showToast('success', 'Upgrade image pulled', status.digest || status.imageRef || status.message);
    },
    onError: (error) => {
      showToast('error', 'Upgrade failed', error instanceof Error ? error.message : 'Unable to pull image');
    },
  });

  const notifications = useMemo(() => {
    const builds = (buildsQuery.data?.builds ?? []).map((build) => ({
      id: `build-${build.id}`,
      title: `${build.status} build`,
      body: build.imageName || build.serviceId || build.id,
    }));
    const audits = (auditQuery.data ?? []).map((log) => ({
      id: `audit-${log.id}`,
      title: log.action,
      body: `${log.resource}${log.resourceId ? ` / ${log.resourceId}` : ''}`,
    }));
    return [...builds, ...audits].slice(0, 6);
  }, [auditQuery.data, buildsQuery.data?.builds]);

  const signOut = async () => {
    try {
      await signOutAuthSession();
    } finally {
      queryClient.clear();
      navigate('/auth/sign-in', { replace: true });
    }
  };

  const isActiveRoute = (itemHref: string) =>
    location.pathname === itemHref || location.pathname.startsWith(`${itemHref}/`);

  const userName = sessionQuery.data?.user.name ?? 'Account';
  const userEmail = sessionQuery.data?.user.email ?? 'Local session';
  const initials = userName
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'C';

  return (
    <div className="app-shell min-h-screen">
      <div className="ambient-glow" />

      <div className="relative flex min-h-screen">
        <aside
          className="hidden h-screen shrink-0 flex-col items-center border-r py-4 md:flex"
          style={{
            width: '62px',
            background: 'var(--bg-base)',
            borderRightColor: 'var(--border-subtle)',
          }}
        >
          <NavLink to={href('/projects')} className="mb-3" title="Containr">
            <img src="/containr.svg" alt="Containr" className="h-[38px] w-[38px] rounded-xl" />
          </NavLink>

          <nav className="flex flex-col items-center gap-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = isActiveRoute(item.href);
              return (
                <NavLink
                  key={item.href}
                  to={href(item.href)}
                  title={item.label}
                  className={`relative flex h-10 w-10 items-center justify-center rounded-[11px] transition-colors ${
                    isActive
                      ? 'bg-[var(--accent-primary-soft)] text-[var(--accent-primary)]'
                      : 'text-[var(--text-tertiary)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-secondary)]'
                  }`}
                >
                  {isActive ? (
                    <span
                      className="absolute -left-[11px] h-4 w-[2.5px] rounded-full"
                      style={{ background: 'var(--accent-primary)' }}
                    />
                  ) : null}
                  <Icon size={17} />
                </NavLink>
              );
            })}
          </nav>

          <div className="flex-1" />

          <div className="flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={() => void signOut()}
              title={`Sign out (${userName})`}
              className="flex h-10 w-10 items-center justify-center rounded-[11px] text-[var(--text-tertiary)] transition-colors hover:bg-[var(--error-soft)] hover:text-[var(--error)]"
            >
              <LogOut size={16} />
            </button>
            <div
              title={userEmail}
              className="flex h-[30px] w-[30px] items-center justify-center rounded-full text-[11px] font-bold"
              style={{ background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))', color: 'var(--accent-on)' }}
            >
              {initials}
            </div>
          </div>
        </aside>

        <div className="relative z-10 flex min-h-screen min-w-0 flex-1 flex-col overflow-hidden">
          <header
            className="hidden h-[46px] shrink-0 items-center border-b px-5 md:flex"
            style={{
              background: 'var(--bg-base)',
              borderBottomColor: 'var(--border-subtle)',
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '11px',
            }}
          >
            <NavLink to={href('/projects')} className="mr-5 text-sm font-extrabold tracking-tight text-[var(--text-primary)]" style={{ fontFamily: 'Inter, sans-serif' }}>
              contain<span style={{ color: 'var(--accent-primary)' }}>r</span>
            </NavLink>

            <div className="flex items-center gap-5">
              <span className="v-tick"><i className="sig" /><b>{isDemoMode ? 'demo' : 'nominal'}</b></span>
              <span className="v-tick"><i className="sig" style={{ background: 'var(--text-tertiary)' }} />node <b>local</b></span>
            </div>

            <div className="search-box ml-6 max-w-[300px]" style={{ height: 30 }}>
              <Search size={13} />
              <input type="text" placeholder="search…" className="v-mono" style={{ fontSize: 11.5 }} />
            </div>

            <div className="ml-auto flex items-center gap-4">
              <span className="v-env">env:production</span>
              <button
                type="button"
                onClick={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))}
                className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] border text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                style={{ borderColor: 'var(--border-subtle)' }}
                title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
              </button>

              <button
                type="button"
                onClick={() => pullMutation.mutate()}
                disabled={isDemoMode || pullMutation.isPending || !upgradeQuery.data?.imageRef}
                className="inline-flex h-8 items-center gap-2 rounded-[var(--radius-md)] px-3 text-xs font-semibold text-[var(--accent-on)] disabled:cursor-not-allowed disabled:opacity-50"
                style={{ background: 'var(--accent-primary)' }}
                title={upgradeQuery.data?.message || 'Pull latest configured image'}
              >
                {pullMutation.isPending ? <RefreshCw size={14} className="animate-spin" /> : <UploadCloud size={14} />}
                Upgrade
              </button>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setNotificationsOpen((open) => !open)}
                  className="relative flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] border text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  style={{ borderColor: 'var(--border-subtle)' }}
                  aria-label="Notifications"
                >
                  <Bell size={15} />
                  {notifications.length > 0 ? (
                    <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-[var(--accent-primary)]" />
                  ) : null}
                </button>

                {notificationsOpen ? (
                  <div className="absolute right-0 top-10 z-50 w-80 rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-3 shadow-2xl">
                    <div className="mb-2 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-[var(--text-primary)]">Notifications</p>
                        <p className="text-xs text-[var(--text-tertiary)]">Build and audit activity</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          queryClient.invalidateQueries({ queryKey: ['shell-build-notifications'] });
                          queryClient.invalidateQueries({ queryKey: ['shell-audit-notifications'] });
                        }}
                        className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] text-[var(--text-tertiary)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]"
                        aria-label="Refresh notifications"
                      >
                        <RefreshCw size={13} />
                      </button>
                    </div>
                    <div className="space-y-2">
                      {notifications.length > 0 ? (
                        notifications.map((item) => (
                          <div key={item.id} className="rounded-[var(--radius-md)] bg-[var(--surface-muted)] p-3">
                            <p className="text-sm font-medium text-[var(--text-primary)]">{item.title}</p>
                            <p className="mt-1 truncate text-xs text-[var(--text-tertiary)]">{item.body}</p>
                          </div>
                        ))
                      ) : (
                        <div className="flex items-center gap-2 rounded-[var(--radius-md)] bg-[var(--surface-muted)] p-3 text-sm text-[var(--text-secondary)]">
                          <CheckCircle2 size={15} className="text-[var(--success)]" />
                          No recent events
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </header>

          <header className="md:hidden sticky top-0 z-50 border-b border-[var(--border-subtle)] bg-[var(--bg-base)]/85 backdrop-blur-2xl">
            <div className="flex items-center justify-between p-4">
              <NavLink to={href('/projects')} className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] bg-[var(--accent-primary)] text-[var(--accent-on)]">
                  <Container size={16} />
                </div>
                <span className="font-headline font-semibold text-[var(--text-primary)]">Containr</span>
              </NavLink>
              <button
                type="button"
                onClick={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))}
                className="h-9 w-9 rounded-[var(--radius-md)] border border-[var(--border-subtle)] text-[var(--text-secondary)]"
              >
                {theme === 'dark' ? <Sun size={15} className="mx-auto" /> : <Moon size={15} className="mx-auto" />}
              </button>
            </div>
            <nav className="flex gap-1 overflow-x-auto px-3 pb-3">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = isActiveRoute(item.href);
                return (
                  <NavLink
                    key={item.href}
                    to={href(item.href)}
                    className={`flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                      isActive
                        ? 'bg-[var(--accent-primary-soft)] text-[var(--accent-primary)]'
                        : 'text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    <Icon size={14} />
                    {item.label}
                  </NavLink>
                );
              })}
            </nav>
          </header>

          <main className="flex-1 overflow-y-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
