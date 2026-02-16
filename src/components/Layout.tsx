import { Outlet, Link, useLocation } from 'react-router-dom';
import { Plus, Activity, Settings, GitBranch, Database, Menu, X, Server, Folder, Github, Cpu, BarChart3 } from 'lucide-react';
import { Button } from './ui/button';
import { Sheet, SheetContent, SheetTrigger } from './ui/sheet';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { ThemeToggle } from './ui/theme-toggle';
import CommandPalette from './CommandPalette';
import { useCanvasStore } from '../store/canvasStore';

const navigation = [
  { name: 'Dashboard', href: '/', icon: Activity },
  { name: 'Projects', href: '/projects', icon: Folder },
  { name: 'Analytics', href: '/analytics', icon: BarChart3 },
  { name: 'Git Integration', href: '/git', icon: Github },
  { name: 'Infrastructure', href: '/infrastructure', icon: Server },
  { name: 'Node Agents', href: '/agents', icon: Cpu },
  { name: 'Deployments', href: '/deployments', icon: GitBranch },
  { name: 'Databases', href: '/databases', icon: Database },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export default function Layout() {
  const { isCommandPaletteOpen, setCommandPaletteOpen, sidebarOpen, setSidebarOpen } = useCanvasStore();
  const location = useLocation();

  const getPageTitle = () => {
    const currentNav = navigation.find(item => item.href === location.pathname);
    return currentNav ? currentNav.name : 'Dashboard';
  };

  return (
    <div className="h-screen w-full flex bg-background overflow-hidden">
      {/* Desktop Sidebar */}
      <div
        className={`
          ${sidebarOpen ? 'w-64' : 'w-0'}
          transition-all duration-300 ease-in-out
          bg-card border-r border-[rgb(var(--border))]
          flex flex-col overflow-hidden flex-shrink-0
          hidden lg:flex
        `}
      >
        {/* Header */}
        <div className="p-6 border-b border-[rgb(var(--border))] flex-shrink-0">
          <h1 className="text-2xl font-bold text-foreground">
            Containr
          </h1>
          <p className="text-sm text-muted-foreground">
            Self-hosted PaaS
          </p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto scrollbar-hide">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Button
                key={item.name}
                variant={isActive ? "default" : "ghost"}
                className="w-full justify-start gap-3 h-10"
                asChild
              >
                <Link to={item.href}>
                  <item.icon className="w-4 h-4" />
                  {item.name}
                </Link>
              </Button>
            );
          })}
        </nav>

        {/* Add Service Button */}
        <div className="p-4 border-t border-[rgb(var(--border))] flex-shrink-0">
          <Button
            onClick={() => setCommandPaletteOpen(true)}
            className="w-full gap-2"
            size="default"
          >
            <Plus className="w-4 h-4" />
            Add Service
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col relative min-w-0">
        {/* Top Bar */}
        <div className="h-16 bg-card border-b border-[rgb(var(--border))] flex items-center px-4 gap-4 flex-shrink-0">
          {/* Mobile Menu */}
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0">
              <div className="p-6 border-b border-[rgb(var(--border))]">
                <h1 className="text-2xl font-bold text-foreground">
                  Containr
                </h1>
                <p className="text-sm text-muted-foreground">
                  Self-hosted PaaS
                </p>
              </div>
              <nav className="flex-1 p-4 space-y-2">
                {navigation.map((item) => {
                  const isActive = location.pathname === item.href;
                  return (
                    <Button
                      key={item.name}
                      variant={isActive ? "default" : "ghost"}
                      className="w-full justify-start gap-3 h-10"
                      asChild
                    >
                      <Link to={item.href}>
                        <item.icon className="w-4 h-4" />
                        {item.name}
                      </Link>
                    </Button>
                  );
                })}
              </nav>
              <div className="p-4 border-t border-[var(--border)]">
                <Button
                  onClick={() => setCommandPaletteOpen(true)}
                  className="w-full gap-2"
                  size="default"
                >
                  <Plus className="w-4 h-4" />
                  Add Service
                </Button>
              </div>
            </SheetContent>
          </Sheet>

          {/* Desktop Sidebar Toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="hidden lg:flex"
          >
            {sidebarOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
            <span className="sr-only">Toggle sidebar</span>
          </Button>
          
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold text-foreground truncate">
              {getPageTitle()}
            </h2>
          </div>

          {/* Theme Toggle */}
          <ThemeToggle />
          
          {/* User Avatar */}
          <Avatar className="h-8 w-8">
            <AvatarImage src="/avatars/01.png" alt="User" />
            <AvatarFallback>U</AvatarFallback>
          </Avatar>
        </div>

        {/* Page Content */}
        <div className="flex-1 relative min-h-0 overflow-auto">
          <Outlet />
        </div>

        {/* Mobile Floating Action Button */}
        <Button
          onClick={() => setCommandPaletteOpen(true)}
          size="icon"
          className="lg:hidden fixed right-4 bottom-4 w-14 h-14 rounded-full shadow-lg z-50"
        >
          <Plus className="w-6 h-6" />
          <span className="sr-only">Add Service</span>
        </Button>
      </div>

      {/* Command Palette */}
      <CommandPalette
        open={isCommandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
      />
    </div>
  );
}
