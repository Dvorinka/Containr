import { NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import {
  Activity,
  Bell,
  BookOpen,
  ChartBar,
  CheckCircle2,
  ChevronsLeft,
  ChevronsUpDown,
  Clock,
  Container,
  Database,
  FileText,
  FolderKanban,
  LayoutDashboard,
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
  Webhook,
  WifiOff,
} from 'lucide-react';
import {
  getCurrentUserProfile,
  getUpgradeStatus,
  pingServer,
  getSetupStatus,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  pullUpgradeImage,
  listProjects,
} from '@/lib/api-client';
import { signOutAuthSession } from '@/lib/auth-client';
import { isDemoSearch } from '@/lib/demo-mode';
import { demoProjects } from '@/lib/demo-data';
import { useAuthSession } from '@/lib/use-auth-session';
import { BannerBar, BrandWordmark, CommandPalette, useToast } from '@/shared/components';

type NavItem = { label: string; href: string; icon: typeof FolderKanban; hint: string };
type NavSection = { title: string; items: NavItem[] };

const navSections: NavSection[] = [
  {
    title: 'Platform',
    items: [
      { label: 'Dashboard', href: '/', icon: LayoutDashboard, hint: 'Fleet overview' },
      { label: 'Projects', href: '/projects', icon: FolderKanban, hint: 'Services & deployments' },
      { label: 'Templates', href: '/templates', icon: LayoutTemplate, hint: 'Deployable presets' },
      { label: 'Builds', href: '/builds', icon: FileText, hint: 'Build history' },
      { label: 'Databases', href: '/databases', icon: Database, hint: 'Managed data services' },
    ],
  },
  {
    title: 'Operate',
    items: [
      { label: 'Operations', href: '/operations', icon: Activity, hint: 'Live jobs & failures' },
      { label: 'Activity', href: '/activity', icon: Clock, hint: 'Platform event feed' },
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
      { label: 'Webhooks', href: '/settings/webhooks', icon: Webhook, hint: 'Signed event delivery' },
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

// ConnectivityBanner pings /health every 15s and listens for browser
// online/offline events — when the instance is unreachable it shows a
// slim bar so the persisted last-known data doesn't masquerade as live.
function ConnectivityBanner() {
  const [offline, setOffline] = useState(() => !navigator.onLine);
  useEffect(() => {
    const up = () => setOffline(false);
    const down = () => setOffline(true);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);
  const ping = useQuery({
    queryKey: ['connectivity'],
    queryFn: pingServer,
    refetchInterval: 15_000,
    retry: 0,
    networkMode: 'always',
    staleTime: 0,
  });
  if (!offline && !ping.isError) {
    return null;
  }
  return (
    <div className="flex items-center justify-center gap-2 border-b border-[var(--warning,var(--border-subtle))] bg-[var(--surface-muted)] px-4 py-1.5 text-xs text-[var(--text-secondary)]">
      <WifiOff size={13} className="text-[var(--warning,#f59e0b)]" />
      {offline
        ? 'No network connection — showing last-known data.'
        : 'Cannot reach this Containr instance — showing last-known data. Retrying…'}
    </div>
  );
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
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setPaletteOpen((open) => !open);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

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
  // Fresh installs get routed through the setup wizard until the flag lands.
  const setupQuery = useQuery({
    queryKey: ['setup-status'],
    queryFn: getSetupStatus,
    enabled: !isDemoMode && signedIn,
    staleTime: 60_000,
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

  // Longest matching href wins so /settings/audit-logs lights only
  // "Audit Logs", not "Settings" as well.
  const activeHref = location.pathname === '/'
    ? '/'
    : visibleNavSections
        .flatMap((section) => section.items.map((item) => item.href))
        .filter(
          (itemHref) =>
            itemHref !== '/' &&
            (location.pathname === itemHref || location.pathname.startsWith(`${itemHref}/`)),
        )
        .sort((a, b) => b.length - a.length)[0] ?? null;
  const isActiveRoute = (itemHref: string) => itemHref === activeHref;

  const userName = isDemoMode ? 'Demo workspace' : profileQuery.data?.name ?? sessionQuery.data?.user.name ?? 'Account';
  const userEmail = isDemoMode ? 'Sample data · read-only' : profileQuery.data?.email ?? sessionQuery.data?.user.email ?? 'Local session';
  const initials = userName
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'C';

  const paletteNavigate = (target: string) => {
    navigate(href(target));
  };

  // Project deep-links for the palette — only fetched once it opens.
  const paletteProjectsQuery = useQuery({
    queryKey: ['palette-projects'],
    queryFn: () => listProjects(),
    enabled: paletteOpen && !isDemoMode,
    staleTime: 60_000,
  });
  const paletteProjects = isDemoMode
    ? demoProjects
    : paletteProjectsQuery.data ?? [];

  if (!isDemoMode && signedIn && setupQuery.data?.needs_setup) {
    return <Navigate to="/setup" replace />;
  }

  return (
    <div className="app-shell min-h-screen">
      <div className="relative flex min-h-screen">
        {/* ── Sidebar — fixed rail per design/23-sentry ── */}
        <aside
          className="shell-side hidden h-screen shrink-0 flex-col md:flex"
          style={{ width: sidebarExpanded ? '252px' : '64px' }}
        >
          <div
            className={`flex items-center ${
              sidebarExpanded ? 'gap-2.5 px-[18px] pb-5 pt-4' : 'flex-col gap-3 px-2 pb-4 pt-4'
            }`}
          >
            <NavLink to={href('/')} title="Containr" className="flex items-center gap-2.5">
              <span className="shell-mark grid h-[26px] w-[26px] shrink-0 place-items-center">
                <Container size={14} />
              </span>
              {sidebarExpanded ? (
                <span className="font-headline text-[15px] font-semibold tracking-[-0.01em] text-[var(--text-primary)]">
                  <BrandWordmark />
                </span>
              ) : null}
            </NavLink>
            <button
              type="button"
              onClick={() => setSidebarExpanded((v) => !v)}
              title={sidebarExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
              className={`shell-collapse flex items-center justify-center ${
                sidebarExpanded ? 'ml-auto h-[22px] w-[22px]' : 'h-7 w-7'
              }`}
            >
              {sidebarExpanded ? <ChevronsLeft size={14} /> : <PanelLeft size={15} />}
            </button>
          </div>

          <nav className={`flex flex-1 flex-col overflow-y-auto ${sidebarExpanded ? 'px-3' : 'gap-4 px-2'}`}>
            {visibleNavSections.map((section, si) => (
              <div key={section.title} className={si > 0 && sidebarExpanded ? 'mt-[26px]' : ''}>
                {sidebarExpanded ? (
                  <p className="shell-nav-group">{section.title}</p>
                ) : null}
                <div className={`flex flex-col ${sidebarExpanded ? '' : 'items-center gap-1'}`}>
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = isActiveRoute(item.href);
                    return (
                      <NavLink
                        key={item.href}
                        to={href(item.href)}
                        title={sidebarExpanded ? item.hint : `${item.label} — ${item.hint}`}
                        className={`shell-ni ${isActive ? 'on' : ''} ${
                          sidebarExpanded ? '' : 'h-10 w-10 justify-center !px-0'
                        }`}
                      >
                        <Icon size={16} className="shrink-0" />
                        {sidebarExpanded ? <span className="truncate">{item.label}</span> : null}
                      </NavLink>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          <div className={`mt-auto ${sidebarExpanded ? 'px-3 pb-3.5' : 'flex justify-center px-2 pb-3'}`}>
            {signedIn ? (
              <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                  <button
                    type="button"
                    title={sidebarExpanded ? undefined : userEmail}
                    className={`shell-user ${
                      sidebarExpanded ? 'w-full' : 'h-10 w-10 justify-center border-transparent bg-transparent'
                    }`}
                  >
                    <span className="shell-avatar">{initials}</span>
                    {sidebarExpanded ? (
                      <>
                        <span className="min-w-0 flex-1 text-left">
                          <span className="block truncate text-[13px] font-medium text-[var(--text-primary)]">{userName}</span>
                          <span className="block truncate text-[10.5px] text-[var(--text-tertiary)]">{userEmail}</span>
                        </span>
                        <ChevronsUpDown size={13} className="shrink-0 text-[var(--text-tertiary)]" />
                      </>
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
                className={`shell-ni ${
                  sidebarExpanded ? 'w-full' : 'h-10 w-10 justify-center !px-0'
                }`}
              >
                <LogIn size={16} className="shrink-0" />
                {sidebarExpanded ? <span className="text-[13px] font-medium">Sign in</span> : null}
              </NavLink>
            )}
          </div>
        </aside>

        <div className="relative z-10 flex min-h-screen min-w-0 flex-1 flex-col overflow-hidden">
          <BannerBar />
          {/* ── Topbar — search left, utility icons right ── */}
          <header className="shell-top hidden h-[56px] shrink-0 items-center gap-3.5 md:flex">
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="shell-search"
            >
              <Search size={13} className="shrink-0" />
              Search anything
              <kbd>⌘ K</kbd>
            </button>

            <span className="v-env">{isDemoMode ? 'env:demo' : `env:${import.meta.env.MODE}`}</span>

            <div className="flex-1" />

            {isAdmin && !isDemoMode ? (
              <button
                type="button"
                onClick={() => pullMutation.mutate()}
                disabled={pullMutation.isPending || !upgradeQuery.data?.imageRef}
                className="s-btn-accent"
                title={upgradeQuery.data?.message || 'Pull latest configured image'}
              >
                {pullMutation.isPending ? <RefreshCw size={13} className="animate-spin" /> : <UploadCloud size={13} />}
                Upgrade
              </button>
            ) : null}

            {signedIn && !isDemoMode ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setNotificationsOpen((open) => !open)}
                  className="shell-tic relative"
                  aria-label="Notifications"
                >
                  <Bell size={16} />
                  {unreadCount > 0 ? <span className="shell-tic-dot" /> : null}
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

            <button
              type="button"
              onClick={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))}
              className="shell-tic"
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          </header>

          <header className="md:hidden sticky top-0 z-50 border-b border-[var(--border-subtle)] bg-[var(--bg-base)]/85 backdrop-blur-2xl">
            <div className="flex items-center justify-between p-4">
              <NavLink to={href('/')} className="flex items-center gap-3">
                <div className="shell-mark flex h-9 w-9 items-center justify-center">
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

          <ConnectivityBanner />
          <main className="flex-1 overflow-y-auto">
            <Outlet />
          </main>
        </div>
      </div>

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onNavigate={paletteNavigate}
        openTargets={paletteProjects.map((p) => ({
          label: p.name,
          target: `/projects/${p.id}`,
          description: 'Project workspace',
        }))}
      />
    </div>
  );
}

const menuItemClass =
  'flex w-full cursor-pointer select-none items-center gap-2 rounded-[var(--radius-md)] px-2.5 py-2 text-[13px] text-[var(--text-secondary)] outline-none transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)] data-[highlighted]:bg-[var(--surface-muted)] data-[highlighted]:text-[var(--text-primary)]';
