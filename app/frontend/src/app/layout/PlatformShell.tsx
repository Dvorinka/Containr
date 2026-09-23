import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import {
  Bell,
  BookOpen,
  ChartBar,
  CheckCircle2,
  ChevronsLeft,
  Container,
  Database,
  FileText,
  FolderKanban,
  LayoutTemplate,
  LogIn,
  LogOut,
  Moon,
  PanelLeft,
  RefreshCw,
  ScrollText,
  Search,
  Settings,
  Shield,
  ShieldCheck,
  Sun,
  UploadCloud,
  User,
  Users,
} from 'lucide-react';
import {
  getCurrentUserProfile,
  getUpgradeStatus,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  pullUpgradeImage,
} from '@/lib/api-client';
import { signOutAuthSession } from '@/lib/auth-client';
import { isDemoSearch } from '@/lib/demo-mode';
import { useAuthSession } from '@/lib/use-auth-session';
import { useToast } from '@/shared/components';

type NavItem = { label: string; href: string; icon: typeof FolderKanban; hint: string };
type NavSection = { title: string; items: NavItem[] };

const navSections: NavSection[] = [
  {
    title: 'Build',
    items: [
      { label: 'Projects', href: '/projects', icon: FolderKanban, hint: 'Services & deployments' },
      { label: 'Templates', href: '/templates', icon: LayoutTemplate, hint: 'Deployable presets' },
      { label: 'Builds', href: '/builds', icon: FileText, hint: 'Build history' },
    ],
  },
  {
    title: 'Operate',
    items: [
      { label: 'Databases', href: '/databases', icon: Database, hint: 'Managed data services' },
      { label: 'High Availability', href: '/ha', icon: ShieldCheck, hint: 'Failover & health' },
      { label: 'Security', href: '/security', icon: Shield, hint: 'Scans & compliance' },
      { label: 'Usage', href: '/usage', icon: ChartBar, hint: 'Resource consumption' },
    ],
  },
  {
    title: 'Workspace',
    items: [
      { label: 'People', href: '/people', icon: Users, hint: 'Members & access' },
      { label: 'Audit Logs', href: '/settings/audit-logs', icon: ScrollText, hint: 'Activity trail' },
      { label: 'Settings', href: '/settings', icon: Settings, hint: 'Platform preferences' },
      { label: 'Docs', href: '/docs', icon: BookOpen, hint: 'Guides & reference' },
    ],
  },
];

type ThemeMode = 'dark' | 'light';

function readStorage(key: string): string | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage unavailable (SSR, tests, private mode) — non-persistent is fine.
  }
}

function getInitialTheme(): ThemeMode {
  return readStorage('containr.theme') === 'light' ? 'light' : 'dark';
}

function getInitialSidebar(): boolean {
  return readStorage('containr.sidebar.expanded') !== '0';
}

export function PlatformShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const isDemoMode = isDemoSearch(location.search);
  const href = (target: string) => (isDemoMode ? `${target}?demo=1` : target);
  // Auth/admin-scoped pages have no demo fixtures — keep the demo nav honest.
  const visibleNavSections = isDemoMode
    ? navSections
        .map((section) =>
          section.title === 'Workspace'
            ? { ...section, items: section.items.filter((item) => item.href === '/docs') }
            : section,
        )
        .filter((section) => section.items.length > 0)
    : navSections;
  const [theme, setTheme] = useState<ThemeMode>(() => getInitialTheme());
  const [sidebarExpanded, setSidebarExpanded] = useState<boolean>(() => getInitialSidebar());
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const sessionQuery = useAuthSession({ enabled: !isDemoMode });
  const signedIn = isDemoMode || Boolean(sessionQuery.data);
  const profileQuery = useQuery({
    queryKey: ['current-profile'],
    queryFn: getCurrentUserProfile,
    enabled: !isDemoMode && Boolean(sessionQuery.data),
    staleTime: 60_000,
    retry: false,
  });
  const isAdmin = !isDemoMode && Boolean(profileQuery.data?.isAdmin);
  const upgradeQuery = useQuery({
    queryKey: ['upgrade-status'],
    queryFn: getUpgradeStatus,
    enabled: !isDemoMode,
  });
  const notificationsQuery = useQuery({
    queryKey: ['shell-notifications'],
    queryFn: () => listNotifications(20),
    enabled: !isDemoMode && signedIn,
    refetchInterval: 30_000,
  });
  const markReadMutation = useMutation({
    mutationFn: (id: string) => markNotificationRead(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['shell-notifications'] }),
  });
  const markAllReadMutation = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['shell-notifications'] }),
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    writeStorage('containr.theme', theme);
  }, [theme]);

  useEffect(() => {
    writeStorage('containr.sidebar.expanded', sidebarExpanded ? '1' : '0');
  }, [sidebarExpanded]);

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

  const notifications = notificationsQuery.data?.notifications ?? [];
  const unreadCount = notificationsQuery.data?.unread ?? 0;

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

  const userName = isDemoMode ? 'Demo workspace' : profileQuery.data?.name ?? sessionQuery.data?.user.name ?? 'Account';
  const userEmail = isDemoMode ? 'Sample data · read-only' : profileQuery.data?.email ?? sessionQuery.data?.user.email ?? 'Local session';
  const initials = userName
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'C';

  const avatar = (
    <div
      className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
      style={{ background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))', color: 'var(--accent-on)' }}
    >
      {initials}
    </div>
  );

  return (
    <div className="app-shell min-h-screen">
      <div className="ambient-glow" />

      <div className="relative flex min-h-screen">
        <aside
          className="hidden h-screen shrink-0 flex-col border-r py-4 transition-[width] duration-200 md:flex"
          style={{
            width: sidebarExpanded ? '218px' : '62px',
            background: 'var(--bg-base)',
            borderRightColor: 'var(--border-subtle)',
          }}
        >
          <div className={`flex items-center ${sidebarExpanded ? 'justify-between px-3' : 'flex-col items-center gap-2'}`}>
            <NavLink to={href('/projects')} title="Containr">
              <img src="/containr.svg" alt="Containr" className="h-[38px] w-[38px] rounded-xl" />
            </NavLink>
            <button
              type="button"
              onClick={() => setSidebarExpanded((v) => !v)}
              title={sidebarExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
              className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] text-[var(--text-tertiary)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]"
            >
              {sidebarExpanded ? <ChevronsLeft size={15} /> : <PanelLeft size={15} />}
            </button>
          </div>

          <nav className="mt-3 flex flex-1 flex-col gap-4 overflow-y-auto px-2">
            {visibleNavSections.map((section) => (
              <div key={section.title}>
                {sidebarExpanded ? (
                  <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                    {section.title}
                  </p>
                ) : null}
                <div className={`flex flex-col gap-0.5 ${sidebarExpanded ? '' : 'items-center'}`}>
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = isActiveRoute(item.href);
                    return (
                      <NavLink
                        key={item.href}
                        to={href(item.href)}
                        title={sidebarExpanded ? item.hint : `${item.label} — ${item.hint}`}
                        className={`relative flex items-center rounded-[11px] transition-colors ${
                          sidebarExpanded ? 'gap-2.5 px-2 py-2' : 'h-10 w-10 justify-center'
                        } ${
                          isActive
                            ? 'bg-[var(--accent-primary-soft)] text-[var(--accent-primary)]'
                            : 'text-[var(--text-tertiary)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-secondary)]'
                        }`}
                      >
                        {isActive ? (
                          <span
                            className="absolute -left-2 h-4 w-[2.5px] rounded-full"
                            style={{ background: 'var(--accent-primary)' }}
                          />
                        ) : null}
                        <Icon size={17} className="shrink-0" />
                        {sidebarExpanded ? (
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13px] font-medium leading-tight">{item.label}</span>
                            <span className="block truncate text-[10px] text-[var(--text-tertiary)]">{item.hint}</span>
                          </span>
                        ) : null}
                      </NavLink>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          <div className={`flex flex-col gap-2 px-2 pt-2 ${sidebarExpanded ? '' : 'items-center'}`}>
            {signedIn ? (
              <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                  <button
                    type="button"
                    title={sidebarExpanded ? undefined : userEmail}
                    className={`flex items-center gap-2.5 rounded-[11px] text-left transition-colors hover:bg-[var(--surface-muted)] ${
                      sidebarExpanded ? 'w-full px-2 py-2' : 'h-10 w-10 justify-center'
                    }`}
                  >
                    {avatar}
                    {sidebarExpanded ? (
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[12.5px] font-medium text-[var(--text-primary)]">{userName}</span>
                        <span className="block truncate text-[10.5px] text-[var(--text-tertiary)]">{userEmail}</span>
                      </span>
                    ) : null}
                  </button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content
                    side="right"
                    align="end"
                    sideOffset={10}
                    className="z-50 w-56 rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-1.5 shadow-2xl"
                  >
                    <div className="px-2.5 py-2">
                      <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{userName}</p>
                      <p className="truncate text-xs text-[var(--text-tertiary)]">{userEmail}</p>
                    </div>
                    <DropdownMenu.Separator className="my-1 h-px bg-[var(--border-subtle)]" />
                    {!isDemoMode ? (
                      <>
                        <DropdownMenu.Item asChild>
                          <button type="button" onClick={() => navigate(href('/settings'))} className={menuItemClass}>
                            <User size={14} /> Profile & account
                          </button>
                        </DropdownMenu.Item>
                        <DropdownMenu.Item asChild>
                          <button type="button" onClick={() => navigate(href('/settings'))} className={menuItemClass}>
                            <Settings size={14} /> Settings
                          </button>
                        </DropdownMenu.Item>
                        <DropdownMenu.Item asChild>
                          <button type="button" onClick={() => navigate(href('/settings/audit-logs'))} className={menuItemClass}>
                            <ScrollText size={14} /> Audit logs
                          </button>
                        </DropdownMenu.Item>
                        {isAdmin ? (
                          <DropdownMenu.Item asChild>
                            <button type="button" onClick={() => navigate(href('/admin'))} className={menuItemClass}>
                              <ShieldCheck size={14} /> Admin console
                            </button>
                          </DropdownMenu.Item>
                        ) : null}
                      </>
                    ) : null}
                    <DropdownMenu.Item asChild>
                      <button
                        type="button"
                        onClick={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))}
                        className={menuItemClass}
                      >
                        {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
                        {theme === 'dark' ? 'Light theme' : 'Dark theme'}
                      </button>
                    </DropdownMenu.Item>
                    <DropdownMenu.Separator className="my-1 h-px bg-[var(--border-subtle)]" />
                    <DropdownMenu.Item asChild>
                      {isDemoMode ? (
                        <button
                          type="button"
                          onClick={() => navigate('/')}
                          className={`${menuItemClass} text-[var(--error)] hover:!bg-[var(--error-soft)] hover:!text-[var(--error)]`}
                        >
                          <LogOut size={14} /> Exit demo
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void signOut()}
                          className={`${menuItemClass} text-[var(--error)] hover:!bg-[var(--error-soft)] hover:!text-[var(--error)]`}
                        >
                          <LogOut size={14} /> Sign out
                        </button>
                      )}
                    </DropdownMenu.Item>
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
            ) : (
              <NavLink
                to="/auth/sign-in"
                title="Sign in"
                className={`flex items-center gap-2.5 rounded-[11px] text-[var(--text-tertiary)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)] ${
                  sidebarExpanded ? 'w-full px-2 py-2' : 'h-10 w-10 justify-center'
                }`}
              >
                <LogIn size={16} className="shrink-0" />
                {sidebarExpanded ? <span className="text-[12.5px] font-medium">Sign in</span> : null}
              </NavLink>
            )}
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
              <span className="v-env">{isDemoMode ? 'env:demo' : 'env:production'}</span>
              <button
                type="button"
                onClick={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))}
                className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] border text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                style={{ borderColor: 'var(--border-subtle)' }}
                title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
              </button>

              {isAdmin && !isDemoMode ? (
                <button
                  type="button"
                  onClick={() => pullMutation.mutate()}
                  disabled={pullMutation.isPending || !upgradeQuery.data?.imageRef}
                  className="inline-flex h-8 items-center gap-2 rounded-[var(--radius-md)] px-3 text-xs font-semibold text-[var(--accent-on)] disabled:cursor-not-allowed disabled:opacity-50"
                  style={{ background: 'var(--accent-primary)' }}
                  title={upgradeQuery.data?.message || 'Pull latest configured image'}
                >
                  {pullMutation.isPending ? <RefreshCw size={14} className="animate-spin" /> : <UploadCloud size={14} />}
                  Upgrade
                </button>
              ) : null}

              {signedIn && !isDemoMode ? (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setNotificationsOpen((open) => !open)}
                    className="relative flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] border text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    style={{ borderColor: 'var(--border-subtle)' }}
                    aria-label="Notifications"
                  >
                    <Bell size={15} />
                    {unreadCount > 0 ? (
                      <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--accent-primary)] px-1 text-[10px] font-semibold text-[var(--accent-on)]">
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </span>
                    ) : null}
                  </button>

                  {notificationsOpen ? (
                    <div className="absolute right-0 top-10 z-50 w-80 rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-3 shadow-2xl">
                      <div className="mb-2 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-[var(--text-primary)]">Notifications</p>
                          <p className="text-xs text-[var(--text-tertiary)]">
                            {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          {unreadCount > 0 ? (
                            <button
                              type="button"
                              onClick={() => markAllReadMutation.mutate()}
                              className="rounded-[var(--radius-sm)] px-2 py-1 text-xs text-[var(--text-tertiary)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]"
                            >
                              Mark all read
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => queryClient.invalidateQueries({ queryKey: ['shell-notifications'] })}
                            className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] text-[var(--text-tertiary)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]"
                            aria-label="Refresh notifications"
                          >
                            <RefreshCw size={13} />
                          </button>
                        </div>
                      </div>
                      <div className="max-h-80 space-y-2 overflow-y-auto">
                        {notifications.length > 0 ? (
                          notifications.map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => { if (!item.read_at) markReadMutation.mutate(item.id ?? ''); }}
                              className="w-full rounded-[var(--radius-md)] bg-[var(--surface-muted)] p-3 text-left hover:bg-[var(--surface-card)]"
                            >
                              <div className="flex items-start gap-2">
                                {!item.read_at ? (
                                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent-primary)]" />
                                ) : null}
                                <div className="min-w-0">
                                  <p className={`text-sm ${item.read_at ? 'text-[var(--text-secondary)]' : 'font-medium text-[var(--text-primary)]'}`}>{item.title}</p>
                                  <p className="mt-1 truncate text-xs text-[var(--text-tertiary)]">{item.body}</p>
                                </div>
                              </div>
                            </button>
                          ))
                        ) : (
                          <div className="flex items-center gap-2 rounded-[var(--radius-md)] bg-[var(--surface-muted)] p-3 text-sm text-[var(--text-secondary)]">
                            <CheckCircle2 size={15} className="text-[var(--success)]" />
                            No notifications yet
                          </div>
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
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
              {visibleNavSections.flatMap((section) => section.items).map((item) => {
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

const menuItemClass =
  'flex w-full cursor-pointer select-none items-center gap-2 rounded-[var(--radius-md)] px-2.5 py-2 text-[13px] text-[var(--text-secondary)] outline-none transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)] data-[highlighted]:bg-[var(--surface-muted)] data-[highlighted]:text-[var(--text-primary)]';
