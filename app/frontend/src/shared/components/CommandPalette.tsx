import { useEffect, useState } from 'react';
import { Command } from 'cmdk';
import {
  ArrowRight,
  Box,
  CornerDownRight,
  Database,
  Clock,
  Search,
} from 'lucide-react';

export interface PaletteTarget {
  label: string;
  target: string;
  description?: string;
}

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon: typeof Box;
  action: () => void;
  category?: string;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onAddService?: (type: string) => void;
  onNavigate?: (target: string) => void;
  /** Navigate-group items; falls back to the full app route map. */
  navTargets?: PaletteTarget[];
  /** Extra searchable "Open …" rows, e.g. projects. */
  openTargets?: PaletteTarget[];
}

const APP_NAV: PaletteTarget[] = [
  { label: 'Dashboard', target: '/', description: 'Index — stats, nodes, deploys' },
  { label: 'Projects', target: '/projects', description: 'All projects' },
  { label: 'Templates', target: '/templates', description: 'Template catalog' },
  { label: 'Builds', target: '/builds', description: 'Build pipeline' },
  { label: 'Databases', target: '/databases', description: 'Managed databases' },
  { label: 'Operations', target: '/operations', description: 'Backups, cron, maintenance' },
  { label: 'Activity', target: '/activity', description: 'Platform event feed' },
  { label: 'High Availability', target: '/ha', description: 'Failover & alerts' },
  { label: 'Security', target: '/security', description: 'Access, sessions, secrets' },
  { label: 'Usage', target: '/usage', description: 'Resource consumption' },
  { label: 'People', target: '/people', description: 'Team & access control' },
  { label: 'Audit Logs', target: '/settings/audit-logs', description: 'Recorded actions' },
  { label: 'Webhooks', target: '/settings/webhooks', description: 'Signed event delivery' },
  { label: 'Settings', target: '/settings', description: 'Platform preferences' },
  { label: 'Docs', target: '/docs', description: 'Guides & reference' },
  { label: 'Landing', target: '/landing', description: 'Public page' },
];

export function CommandPalette({
  open,
  onClose,
  onAddService,
  onNavigate,
  navTargets,
  openTargets,
}: CommandPaletteProps) {
  if (!open) return null;

  return (
    <CommandPaletteContent
      onClose={onClose}
      onAddService={onAddService}
      onNavigate={onNavigate}
      navTargets={navTargets}
      openTargets={openTargets}
    />
  );
}

function CommandPaletteContent({
  onClose,
  onAddService,
  onNavigate,
  navTargets,
  openTargets,
}: Omit<CommandPaletteProps, 'open'>) {
  const [search, setSearch] = useState('');

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onClose();
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [onClose]);

  const commands: CommandItem[] = [];

  // Create items only exist where onAddService is wired — elsewhere the
  // entries would silently no-op.
  if (onAddService) {
    commands.push(
      {
        id: 'add-web',
        label: 'Add Web Service',
        description: 'Deploy a web application',
        icon: Box,
        category: 'Create',
        action: () => { onAddService('web'); onClose(); },
      },
      {
        id: 'add-worker',
        label: 'Add Worker Service',
        description: 'Deploy a background worker',
        icon: Clock,
        category: 'Create',
        action: () => { onAddService('worker'); onClose(); },
      },
      {
        id: 'add-database',
        label: 'Add Database',
        description: 'Provision a PostgreSQL database',
        icon: Database,
        category: 'Create',
        action: () => { onAddService('database'); onClose(); },
      },
      {
        id: 'add-cron',
        label: 'Add Cron Job',
        description: 'Schedule a recurring task',
        icon: Clock,
        category: 'Create',
        action: () => { onAddService('cron'); onClose(); },
      },
    );
  }

  if (onNavigate) {
    (navTargets ?? APP_NAV).forEach((t, i) =>
      commands.push({
        id: `nav-${i}`,
        label: t.label,
        description: t.description,
        icon: CornerDownRight,
        category: 'Navigate',
        action: () => { onNavigate(t.target); onClose(); },
      }),
    );
    (openTargets ?? []).forEach((t, i) =>
      commands.push({
        id: `open-${i}`,
        label: t.label,
        description: t.description,
        icon: ArrowRight,
        category: 'Open',
        action: () => { onNavigate(t.target); onClose(); },
      }),
    );
  }

  const filteredCommands = commands.filter(
    (cmd) =>
      cmd.label.toLowerCase().includes(search.toLowerCase()) ||
      cmd.description?.toLowerCase().includes(search.toLowerCase()) ||
      cmd.category?.toLowerCase().includes(search.toLowerCase())
  );

  const groupedCommands = filteredCommands.reduce(
    (acc, cmd) => {
      const category = cmd.category || 'Other';
      if (!acc[category]) acc[category] = [];
      acc[category].push(cmd);
      return acc;
    },
    {} as Record<string, CommandItem[]>
  );

  const placeholder = onNavigate
    ? 'Search pages, projects, actions…'
    : 'What would you like to create?';

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-[var(--bg-void)]/80 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="absolute left-1/2 top-[20%] -translate-x-1/2 w-full max-w-xl">
        <Command
          className="s-card !p-0 overflow-hidden shadow-2xl shadow-black/50"
          loop
        >
          <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border-subtle)]">
            <Search size={18} className="text-[var(--text-muted)]" />
            <Command.Input
              value={search}
              onValueChange={setSearch}
              placeholder={placeholder}
              className="flex-1 bg-transparent text-[var(--text-primary)] placeholder:text-[var(--text-muted)] text-sm outline-none"
            />
            <kbd className="px-2 py-0.5 rounded bg-[var(--surface-muted)] text-[10px] font-mono text-[var(--text-muted)]">
              ESC
            </kbd>
          </div>

          <Command.List className="max-h-[320px] overflow-y-auto p-2">
            <Command.Empty className="py-6 text-center text-sm text-[var(--text-muted)]">
              No results found.
            </Command.Empty>

            {Object.entries(groupedCommands).map(([category, items]) => (
              <Command.Group key={category} heading={category} className="mb-2">
                <div className="px-2 py-1.5 v-mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-muted)]">
                  {category}
                </div>
                {items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Command.Item
                      key={item.id}
                      value={item.label}
                      onSelect={item.action}
                      className="flex items-center gap-3 px-3 py-2 rounded-[var(--radius-md)] cursor-pointer text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)] aria-selected:bg-[var(--accent-primary-soft)] aria-selected:text-[var(--accent-primary)] transition-colors"
                    >
                      <span className="s-ibox !h-7 !w-7"><Icon size={13.5} /></span>
                      <div className="flex-1">
                        <div className="text-sm font-medium">{item.label}</div>
                        {item.description && (
                          <div className="text-xs text-[var(--text-muted)]">{item.description}</div>
                        )}
                      </div>
                    </Command.Item>
                  );
                })}
              </Command.Group>
            ))}
          </Command.List>

          <div className="flex items-center gap-4 px-4 py-2 border-t border-[var(--border-subtle)] text-[10px] text-[var(--text-muted)]">
            <div className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-[var(--surface-muted)] text-[9px]">↑↓</kbd>
              <span>Navigate</span>
            </div>
            <div className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-[var(--surface-muted)] text-[9px]">↵</kbd>
              <span>Select</span>
            </div>
            <div className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-[var(--surface-muted)] text-[9px]">⌘K</kbd>
              <span>Toggle</span>
            </div>
          </div>
        </Command>
      </div>
    </div>
  );
}
