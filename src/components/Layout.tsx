import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import {
  Plus,
  Activity,
  Settings,
  Database,
  Menu,
  X,
  Server,
  Folder,
  Github,
  Cpu,
  BarChart3,
  LogOut,
  ChevronDown,
  Search,
  Zap,
  Layers,
  Sparkles,
  Bell,
  Rocket,
  Workflow,
  Shield,
  ChevronRight,
  ExternalLink,
  Building2,
  BookOpen
} from 'lucide-react';
import { Button } from './ui/button';
import { Sheet, SheetContent, SheetTrigger } from './ui/sheet';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { ThemeToggle } from './ui/theme-toggle';
import { Separator } from './ui/separator';
import { Badge } from './ui/badge';
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
  { name: 'Dashboard', href: '/', icon: Activity, section: 'overview', badge: null },
  { name: 'Projects', href: '/projects', icon: Folder, section: 'overview', badge: '12' },
  { name: 'Analytics', href: '/analytics', icon: BarChart3, section: 'overview', badge: null },
  { name: 'Canvas', href: '/canvas', icon: Workflow, section: 'build', badge: 'Beta' },
  { name: 'Git Integration', href: '/git', icon: Github, section: 'deploy', badge: null },
  { name: 'Infrastructure', href: '/infrastructure', icon: Server, section: 'deploy', badge: '3' },
  { name: 'Node Agents', href: '/agents', icon: Cpu, section: 'deploy', badge: null },
  { name: 'Databases', href: '/databases', icon: Database, section: 'resources', badge: '5' },
  { name: 'Security', href: '/security', icon: Shield, section: 'security', badge: null },
  { name: 'Settings', href: '/settings', icon: Settings, section: 'settings', badge: null },
];

const sections = {
  overview: { label: 'Overview', icon: Layers, color: 'text-blue-500', bg: 'bg-blue-500/10' },
  build: { label: 'Build', icon: Rocket, color: 'text-violet-500', bg: 'bg-violet-500/10' },
  deploy: { label: 'Deploy', icon: Zap, color: 'text-amber-500', bg: 'bg-amber-500/10' },
  resources: { label: 'Resources', icon: Database, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  security: { label: 'Security', icon: Shield, color: 'text-red-500', bg: 'bg-red-500/10' },
  settings: { label: 'Settings', icon: Settings, color: 'text-muted-foreground', bg: 'bg-muted/50' },
};

export default function Layout() {
  const { isCommandPaletteOpen, setCommandPaletteOpen, sidebarOpen, setSidebarOpen } = useCanvasStore();
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  const getPageTitle = () => {
    const currentNav = navigation.find(item => item.href === location.pathname);
    return currentNav ? currentNav.name : 'Dashboard';
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const groupedNavigation = navigation.reduce((acc, item) => {
    if (!acc[item.section]) acc[item.section] = [];
    acc[item.section].push(item);
    return acc;
  }, {} as Record<string, typeof navigation>);

  const NavLink = ({ item, mobile = false }: { item: typeof navigation[0]; mobile?: boolean }) => {
    const isActive = location.pathname === item.href;
    const isHovered = hoveredItem === item.name;
    
    return (
      <Link
        to={item.href}
        onMouseEnter={() => setHoveredItem(item.name)}
        onMouseLeave={() => setHoveredItem(null)}
        className={cn(
          "group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-300",
          isActive 
            ? "text-primary bg-primary/10 dark:bg-primary/15 shadow-sm" 
            : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
          mobile && "text-base py-3"
        )}
      >
        <div className={cn(
          "relative p-1.5 rounded-lg transition-all duration-300",
          isActive ? "bg-primary/15" : isHovered ? "bg-muted/70" : "bg-transparent"
        )}>
          <item.icon className={cn(
            "w-[18px] h-[18px] shrink-0 transition-all duration-300",
            isActive ? "text-primary" : isHovered ? "text-foreground" : "text-muted-foreground"
          )} />
          {isActive && (
            <div className="absolute inset-0 rounded-lg bg-primary/10 animate-pulse" />
          )}
        </div>
        <span className="relative z-10">{item.name}</span>
        {item.badge && (
          <Badge 
            variant="outline" 
            className={cn(
              "ml-auto text-[9px] font-semibold px-1.5 py-0 h-4",
              item.badge === 'New' || item.badge === 'Beta' 
                ? "bg-violet-500/10 text-violet-500 border-violet-500/20" 
                : "bg-muted/50 text-muted-foreground border-border/50"
            )}
          >
            {item.badge}
          </Badge>
        )}
        {isActive && (
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-gradient-to-b from-primary to-primary/50 rounded-r-full" />
        )}
        <ChevronRight className={cn(
          "w-4 h-4 ml-auto opacity-0 -translate-x-2 transition-all duration-300",
          isHovered && "opacity-100 translate-x-0"
        )} />
      </Link>
    );
  };

  return (
    <div className="h-screen w-full flex bg-background overflow-hidden">
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 dot-grid opacity-30 dark:opacity-15" />
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-gradient-radial from-primary/10 via-transparent to-transparent blur-3xl" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-gradient-radial from-violet-500/10 via-transparent to-transparent blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-radial from-primary/5 via-transparent to-transparent blur-3xl" />
        <div className="absolute inset-0 mesh-gradient opacity-50" />
      </div>

      <aside
        className={cn(
          "hidden lg:flex flex-col border-r border-border/40 bg-card/80 backdrop-blur-xl transition-all duration-300 ease-out flex-shrink-0 relative",
          sidebarOpen ? "w-72" : "w-0 opacity-0 -translate-x-full"
        )}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-primary/2 via-transparent to-transparent pointer-events-none" />
        
        <div className="relative p-4 border-b border-border/40">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="relative">
              <div className="w-10 h-10 bg-gradient-to-br from-primary via-violet-500 to-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/20 transition-all duration-500 group-hover:shadow-xl group-hover:shadow-primary/30 group-hover:scale-105 p-1.5">
                <img src="/containr.svg" alt="Containr" className="w-full h-full object-contain" />
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-card">
                <div className="absolute inset-0 rounded-full bg-emerald-500 animate-ping opacity-75" />
              </div>
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">Containr</span>
              <span className="text-[10px] text-muted-foreground leading-none font-medium">Self-hosted PaaS</span>
            </div>
          </Link>
        </div>

        <nav className="flex-1 p-3 overflow-y-auto scrollbar-thin">
          {Object.entries(groupedNavigation).map(([section, items]) => {
            const sectionConfig = sections[section as keyof typeof sections];
            return (
              <div key={section} className="mb-4">
                <div className="flex items-center gap-2 px-3 py-2 mb-1">
                  <div className={cn("p-1 rounded-md", sectionConfig?.bg)}>
                    {sectionConfig && <sectionConfig.icon className={cn("w-3 h-3", sectionConfig.color)} />}
                  </div>
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                    {sectionConfig?.label || section}
                  </span>
                </div>
                <div className="space-y-1">
                  {items.map((item) => (
                    <NavLink key={item.name} item={item} />
                  ))}
                </div>
              </div>
            );
          })}
        </nav>

        <div className="relative p-3 border-t border-border/40 space-y-3">
          <div className="p-3 rounded-xl bg-gradient-to-br from-primary/5 via-violet-500/5 to-transparent border border-primary/10">
            <div className="flex items-center gap-2 mb-2">
              <BookOpen className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">Documentation</span>
            </div>
            <p className="text-xs text-muted-foreground mb-3">Learn how to deploy your first service</p>
            <Button variant="outline" size="sm" className="w-full h-8 text-xs">
              View Docs
              <ExternalLink className="w-3 h-3 ml-1.5" />
            </Button>
          </div>
          
          <button
            onClick={() => setCommandPaletteOpen(true)}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-muted/30 hover:bg-muted/50 text-muted-foreground hover:text-foreground text-sm transition-all duration-200 group border border-transparent hover:border-border/50"
          >
            <Search className="w-4 h-4 group-hover:text-primary transition-colors" />
            <span>Quick Search</span>
            <div className="ml-auto flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 text-[10px] bg-background/80 rounded-md border border-border/50 font-mono shadow-sm">⌘</kbd>
              <kbd className="px-1.5 py-0.5 text-[10px] bg-background/80 rounded-md border border-border/50 font-mono shadow-sm">K</kbd>
            </div>
          </button>
          
          <Button
            onClick={() => setCommandPaletteOpen(true)}
            className="w-full gap-2 h-11 rounded-xl bg-gradient-to-r from-primary via-violet-500 to-primary bg-[length:200%_100%] hover:bg-right transition-all duration-500 shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30"
          >
            <Plus className="w-4 h-4" />
            New Deployment
          </Button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col relative min-w-0">
        <header className="h-16 glass-heavy border-b border-border/40 flex items-center px-4 gap-4 flex-shrink-0 sticky top-0 z-40">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden hover:bg-muted/50">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-80 p-0 bg-card/95 backdrop-blur-2xl border-r border-border/40">
              <div className="p-4 border-b border-border/40">
                <Link to="/" className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-primary via-violet-500 to-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/20 p-1.5">
                    <img src="/containr.svg" alt="Containr" className="w-full h-full object-contain" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-lg font-bold">Containr</span>
                    <span className="text-[10px] text-muted-foreground leading-none">Self-hosted PaaS</span>
                  </div>
                </Link>
              </div>
              <nav className="flex-1 p-3 space-y-1">
                {navigation.map((item) => (
                  <NavLink key={item.name} item={item} mobile />
                ))}
              </nav>
              <Separator />
              <div className="p-3">
                <Button
                  onClick={() => setCommandPaletteOpen(true)}
                  className="w-full gap-2 h-11 rounded-xl bg-gradient-to-r from-primary to-violet-500"
                >
                  <Plus className="w-4 h-4" />
                  New Deployment
                </Button>
              </div>
            </SheetContent>
          </Sheet>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="hidden lg:flex hover:bg-muted/50 transition-colors"
          >
            {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-foreground truncate">
                {getPageTitle()}
              </h2>
              {location.pathname === '/' && (
                <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1 animate-pulse" />
                  All systems operational
                </Badge>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              onClick={() => setCommandPaletteOpen(true)}
              className="hidden md:flex items-center gap-2 px-3 py-2 rounded-xl bg-muted/30 hover:bg-muted/50 text-muted-foreground hover:text-foreground text-sm transition-all duration-200 group border border-transparent hover:border-border/50"
            >
              <Search className="w-4 h-4 group-hover:text-primary transition-colors" />
              <span className="hidden lg:inline">Search...</span>
              <div className="hidden sm:flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 text-[10px] bg-background/80 rounded-md border border-border/50 font-mono shadow-sm">⌘</kbd>
                <kbd className="px-1.5 py-0.5 text-[10px] bg-background/80 rounded-md border border-border/50 font-mono shadow-sm">K</kbd>
              </div>
            </button>
            
            <Button
              size="sm"
              className="hidden sm:flex gap-2 h-9 rounded-xl bg-gradient-to-r from-primary to-violet-500 shadow-md shadow-primary/10 hover:shadow-lg hover:shadow-primary/20"
              onClick={() => setCommandPaletteOpen(true)}
            >
              <Sparkles className="w-4 h-4" />
              <span className="hidden lg:inline">New</span>
            </Button>

            <Button variant="ghost" size="icon" className="relative hover:bg-muted/50 rounded-xl">
              <Bell className="h-4 w-4" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-destructive rounded-full">
                <span className="absolute inset-0 rounded-full bg-destructive animate-ping opacity-75" />
              </span>
            </Button>
            
            <ThemeToggle />
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-2 px-2 hover:bg-muted/50 transition-colors rounded-xl">
                  <Avatar className="h-8 w-8 ring-2 ring-primary/20 ring-offset-1 ring-offset-background">
                    <AvatarImage src="/avatars/01.png" alt="User" />
                    <AvatarFallback className="bg-gradient-to-br from-primary/30 to-violet-500/30 text-primary font-medium text-sm">
                      {user?.name?.charAt(0) || user?.email?.charAt(0) || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <ChevronDown className="w-4 h-4 text-muted-foreground hidden sm:block" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60 glass-heavy border-border/40 shadow-xl rounded-xl">
                <div className="px-3 py-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10 ring-2 ring-primary/20">
                      <AvatarImage src="/avatars/01.png" alt="User" />
                      <AvatarFallback className="bg-gradient-to-br from-primary/30 to-violet-500/30 text-primary font-medium">
                        {user?.name?.charAt(0) || user?.email?.charAt(0) || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <p className="text-sm font-semibold">{user?.name || 'User'}</p>
                      <p className="text-xs text-muted-foreground">{user?.email || 'user@example.com'}</p>
                    </div>
                  </div>
                </div>
                <DropdownMenuSeparator className="bg-border/50" />
                <DropdownMenuItem asChild className="cursor-pointer focus:bg-muted/50 rounded-lg mx-1">
                  <Link to="/settings" className="flex items-center gap-2">
                    <Settings className="w-4 h-4" />
                    Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer focus:bg-muted/50 rounded-lg mx-1">
                  <Building2 className="w-4 h-4 mr-2" />
                  Organization
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-border/50" />
                <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive cursor-pointer focus:bg-destructive/10 rounded-lg mx-1">
                  <LogOut className="w-4 h-4 mr-2" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="flex-1 relative min-h-0 overflow-auto bg-background/30">
          <Outlet />
        </main>

        <Button
          onClick={() => setCommandPaletteOpen(true)}
          size="icon"
          className="lg:hidden fixed right-5 bottom-5 w-14 h-14 rounded-2xl shadow-xl bg-gradient-to-r from-primary to-violet-500 hover:scale-105 transition-transform shadow-primary/20"
        >
          <Plus className="w-6 h-6" />
        </Button>
      </div>

      <CommandPalette
        open={isCommandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
      />
    </div>
  );
}
