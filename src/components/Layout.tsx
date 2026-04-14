import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Activity,
  Bell,
  BookOpen,
  ChevronDown,
  FileText,
  Grid2X2,
  LayoutTemplate,
  LogOut,
  Menu,
  MoreVertical,
  Plus,
  Search,
  Settings,
  Users,
} from 'lucide-react';
import { Button } from './ui/button';
import { Sheet, SheetContent, SheetTrigger } from './ui/sheet';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import CommandPalette from './CommandPalette';
import { useCanvasStore } from '../store/canvasStore';
import { useAuth } from '../hooks/useAuth';
import { cn } from '../lib/utils';

const navigation = [
  { name: 'Projects', href: '/projects', icon: Grid2X2 },
  { name: 'Templates', href: '/templates', icon: LayoutTemplate },
  { name: 'Usage', href: '/usage', icon: Activity },
  { name: 'People', href: '/people', icon: Users },
  { name: 'Docs', href: '/docs', icon: BookOpen },
];

function pageTitle(pathname: string) {
  if (pathname === '/projects' || pathname === '/') return 'Projects';
  if (pathname.startsWith('/projects/')) return 'Project Details';
  const exact = navigation.find((item) => pathname === item.href);
  if (exact) return exact.name;
  return 'Dashboard';
}

function NavLink({ item, onNavigate }: { item: (typeof navigation)[number]; onNavigate?: () => void }) {
  const location = useLocation();
  const isActive = location.pathname === item.href || 
    (item.href !== '/' && location.pathname.startsWith(`${item.href}`));

  return (
    <Link
      to={item.href}
      onClick={onNavigate}
      className={cn(
        'sidebar-item flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all duration-150',
        isActive
          ? 'text-foreground font-medium'
          : 'text-muted-foreground hover:text-foreground hover:bg-surface-hover'
      )}
    >
      <item.icon className={cn('h-[18px] w-[18px]', isActive ? 'text-primary' : '')} />
      <span>{item.name}</span>
    </Link>
  );
}

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isSettingsActive = location.pathname === '/settings';

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <aside className="flex h-full flex-col border-r border-border bg-background">
      {/* Logo Section */}
      <div className="flex h-16 items-center gap-3 px-4">
        <Link to="/projects" className="flex items-center gap-2.5" onClick={onNavigate}>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
            <svg viewBox="0 0 24 24" className="h-5 w-5 text-primary" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
          </div>
          <div className="min-w-0">
            <div className="truncate text-[15px] font-semibold tracking-tight">Containr</div>
          </div>
        </Link>
      </div>

      {/* Workspace Switcher */}
      <div className="px-3 pb-2">
        <div className="flex items-center gap-2.5 rounded-lg border border-border bg-surface px-3 py-2">
          <Avatar className="h-7 w-7">
            <AvatarImage src="/avatars/01.png" alt={user?.name || 'User'} />
            <AvatarFallback className="bg-primary/10 text-primary text-xs">
              {user?.name?.charAt(0) || user?.email?.charAt(0) || 'U'}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-medium">{user?.name || 'Personal'}</div>
            <div className="truncate text-[11px] text-muted-foreground">{user?.email || 'Workspace'}</div>
          </div>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 space-y-0.5 px-3 py-2">
        {navigation.map((item) => (
          <NavLink key={item.href} item={item} onNavigate={onNavigate} />
        ))}
      </nav>

      {/* Bottom Section */}
      <div className="border-t border-border p-3 space-y-1">
        <Link
          to="/settings"
          onClick={onNavigate}
          className={cn(
            'sidebar-item flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all duration-150',
            isSettingsActive
              ? 'text-foreground font-medium'
              : 'text-muted-foreground hover:text-foreground hover:bg-surface-hover'
          )}
        >
          <Settings className={cn('h-[18px] w-[18px]', isSettingsActive ? 'text-primary' : '')} />
          <span>Settings</span>
        </Link>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-muted-foreground hover:bg-surface-hover hover:text-foreground transition-all duration-150">
              <MoreVertical className="h-[18px] w-[18px]" />
              <span className="flex-1">More</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuItem asChild>
              <Link to="/settings" onClick={onNavigate}>
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/docs" onClick={onNavigate}>
                <FileText className="mr-2 h-4 w-4" />
                Documentation
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
}

export default function Layout() {
  const { isCommandPaletteOpen, setCommandPaletteOpen } = useCanvasStore();
  const location = useLocation();

  return (
    <div className="h-screen w-full overflow-hidden bg-background text-foreground">
      {/* Desktop Sidebar */}
      <div className="hidden h-full w-[260px] lg:fixed lg:inset-y-0 lg:left-0 lg:block">
        <Sidebar />
      </div>

      {/* Main Content Area */}
      <div className="flex h-full min-w-0 flex-col lg:pl-[260px]">
        {/* Header */}
        <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border bg-background/95 px-4 backdrop-blur lg:px-6">
          {/* Mobile Menu */}
          <div className="flex items-center gap-3">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden h-8 w-8">
                  <Menu className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[260px] p-0">
                <Sidebar />
              </SheetContent>
            </Sheet>

            {/* Page Title */}
            <div>
              <h1 className="text-[15px] font-semibold tracking-tight">{pageTitle(location.pathname)}</h1>
            </div>
          </div>

          {/* Right Section */}
          <div className="flex items-center gap-1.5">
            {/* Search Button */}
            <button
              type="button"
              onClick={() => setCommandPaletteOpen(true)}
              className="hidden md:flex items-center gap-2 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-surface-hover"
            >
              <Search className="h-3.5 w-3.5" />
              <span>Search</span>
              <kbd className="ml-1 rounded border border-border bg-background px-1 py-0 text-[10px]">⌘K</kbd>
            </button>

            {/* New Button */}
            <Button 
              onClick={() => setCommandPaletteOpen(true)} 
              size="sm" 
              className="h-7 gap-1.5 text-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">New</span>
            </Button>

            {/* Notifications */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative h-8 w-8">
                  <Bell className="h-4 w-4" />
                  <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-success" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72">
                <div className="px-3 py-2">
                  <div className="text-sm font-medium">Notifications</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    System events and deployment activity
                  </div>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="flex-col items-start gap-1 py-2.5">
                  <span className="text-sm font-medium">All systems operational</span>
                  <span className="text-xs text-muted-foreground">
                    Monitoring is active. No issues detected.
                  </span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Main Content */}
        <main className="min-h-0 flex-1 overflow-auto bg-background">
          <Outlet />
        </main>
      </div>

      {/* Command Palette */}
      <CommandPalette open={isCommandPaletteOpen} onClose={() => setCommandPaletteOpen(false)} />
    </div>
  );
}
