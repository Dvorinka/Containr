import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { 
  FolderKanban, 
  Hammer, 
  LayoutTemplate, 
  ChartBar, 
  Users, 
  Settings, 
  BookOpen,
  Container,
  Bell,
  Search,
  Zap,
  Activity,
} from 'lucide-react';

const navItems = [
  { label: 'Projects', href: '/projects', icon: FolderKanban },
  { label: 'Builds', href: '/builds', icon: Hammer },
  { label: 'Templates', href: '/templates', icon: LayoutTemplate },
  { label: 'Usage', href: '/usage', icon: ChartBar },
  { label: 'People', href: '/people', icon: Users },
  { label: 'Settings', href: '/settings', icon: Settings },
  { label: 'Docs', href: '/docs', icon: BookOpen },
];

// Developer/Demo pages
const demoNavItems = [
  { label: 'Metrics Demo', href: '/metrics-demo', icon: Activity },
  { label: 'Showcase', href: '/showcase', icon: Zap },
];

export function PlatformShell() {
  const location = useLocation();
  const isDemoMode = new URLSearchParams(location.search).get('demo') === '1';
  const href = (target: string) => (isDemoMode ? `${target}?demo=1` : target);

  const isActiveRoute = (itemHref: string) => 
    location.pathname === itemHref || location.pathname.startsWith(`${itemHref}/`);

  return (
    <div className="app-shell min-h-screen">
      {/* Ambient glow background */}
      <div className="ambient-glow" />
      
      <div className="flex min-h-screen relative">
        {/* Desktop Sidebar - self.html exact match: 64px width */}
        <aside 
          className="hidden md:flex shrink-0 flex-col items-center border-r"
          style={{ 
            width: '64px',
            background: '#111217',
            borderRight: '1px solid rgba(255,255,255,0.07)',
            padding: '16px 0',
            gap: '5px'
          }}
        >
          {/* Logo - exact self.html: 38px circular pink */}
          <div 
            className="rounded-full flex items-center justify-center"
            style={{ 
              width: '38px', 
              height: '38px', 
              background: '#e8316a',
              marginBottom: '14px'
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/>
            </svg>
          </div>
          
          {/* Nav Items - 40x40 icon-only */}
          {navItems.map((item) => {
            const isActive = isActiveRoute(item.href);
            const Icon = item.icon;
            return (
              <NavLink
                key={item.href}
                to={href(item.href)}
                className={`nav-item ${isActive ? 'active' : ''}`}
                title={item.label}
              >
                <Icon size={18} />
              </NavLink>
            );
          })}
          
          {/* Separator */}
          <div style={{ width: '32px', height: '1px', background: 'rgba(255,255,255,0.07)', margin: '8px 0' }} />
          
          {/* Demo/Developer Items */}
          {demoNavItems.map((item) => {
            const isActive = isActiveRoute(item.href);
            const Icon = item.icon;
            return (
              <NavLink
                key={item.href}
                to={href(item.href)}
                className={`nav-item ${isActive ? 'active' : ''}`}
                title={item.label}
              >
                <Icon size={18} />
              </NavLink>
            );
          })}
          
          {/* Spacer */}
          <div className="flex-1" />
          
          {/* Bottom icons - Settings */}
          <NavLink to="/settings" className="nav-item" title="Settings">
            <Settings size={18} />
          </NavLink>
          <NavLink to="/docs" className="nav-item" title="Help">
            <BookOpen size={18} />
          </NavLink>
          
          {/* User Avatar - exact self.html: 34px */}
          <div 
            className="rounded-full flex items-center justify-center cursor-pointer"
            style={{ 
              width: '34px', 
              height: '34px', 
              background: '#22233a',
              fontSize: '11px',
              fontWeight: 700,
              color: '#9295a4',
              marginTop: '4px',
              letterSpacing: '-0.3px'
            }}
            title="User"
          >
            w.
          </div>
        </aside>

        {/* Main Content */}
        <div className="min-w-0 flex-1 relative z-10 flex flex-col min-h-screen overflow-hidden">
          {/* Topbar - self.html exact match: 52px height */}
          <header 
            className="shrink-0 flex items-center"
            style={{ 
              height: '52px',
              background: '#111217',
              borderBottom: '1px solid rgba(255,255,255,0.07)',
              padding: '0 22px',
              gap: '14px'
            }}
          >
            {/* Search Box */}
            <div className="search-box">
              <Search size={14} />
              <input type="text" placeholder="Search logs..." />
            </div>
            
            {/* Right side */}
            <div className="ml-auto flex items-center" style={{ gap: '8px' }}>
              <button 
                className="rounded-[9px] border bg-transparent text-[#9295a4] font-medium cursor-pointer"
                style={{
                  height: '32px',
                  padding: '0 14px',
                  border: '1px solid rgba(255,255,255,0.1)',
                  fontSize: '13px',
                  fontFamily: 'inherit'
                }}
              >
                Support
              </button>
              <button 
                className="rounded-[9px] border-none flex items-center text-[#e8e9f0] font-medium cursor-pointer"
                style={{
                  height: '32px',
                  padding: '0 14px',
                  background: 'rgba(255,255,255,0.08)',
                  fontSize: '13px',
                  fontFamily: 'inherit',
                  gap: '6px'
                }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <polyline points="17 11 12 6 7 11"/>
                  <polyline points="17 18 12 13 7 18"/>
                </svg>
                Upgrade
              </button>
              <button 
                className="rounded-[9px] border flex items-center justify-center cursor-pointer bg-transparent"
                style={{
                  width: '32px',
                  height: '32px',
                  border: '1px solid rgba(255,255,255,0.1)'
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9295a4" strokeWidth="2" strokeLinecap="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                </svg>
              </button>
            </div>
          </header>

          {/* Mobile Header */}
          <header className="md:hidden sticky top-0 z-50 border-b border-[var(--border-subtle)] bg-[var(--bg-base)]/70 backdrop-blur-2xl">
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div 
                  className="rounded-xl flex items-center justify-center"
                  style={{ 
                    width: '36px', 
                    height: '36px', 
                    background: '#e8316a'
                  }}
                >
                  <Container size={16} className="text-white" />
                </div>
                <span className="font-headline font-semibold text-[var(--text-primary)]">Containr</span>
              </div>
              <div className="flex items-center gap-2">
                <button className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-muted)] transition-all">
                  <Search size={16} />
                </button>
                <button className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-muted)] transition-all relative">
                  <Bell size={16} />
                  <div className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[var(--accent-primary)]" />
                </button>
              </div>
            </div>
            <nav className="flex gap-1 px-3 pb-3 overflow-x-auto scrollbar-hide">
              {navItems.map((item) => {
                const isActive = isActiveRoute(item.href);
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.href}
                    to={href(item.href)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                      isActive
                        ? 'bg-[var(--accent-primary-soft)] text-[var(--accent-primary)]'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-muted)]'
                    }`}
                  >
                    <Icon size={14} />
                    {item.label}
                  </NavLink>
                );
              })}
              {/* Demo items */}
              {demoNavItems.map((item) => {
                const isActive = isActiveRoute(item.href);
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.href}
                    to={href(item.href)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                      isActive
                        ? 'bg-[var(--accent-primary-soft)] text-[var(--accent-primary)]'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-muted)]'
                    }`}
                  >
                    <Icon size={14} />
                    {item.label}
                  </NavLink>
                );
              })}
            </nav>
          </header>

          {/* Page Content - scrollable */}
          <main className="flex-1 overflow-y-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
