import { useEffect, useState } from 'react';
import { Command } from 'cmdk';
import {
  Box,
  Database,
  Github,
  Image,
  Clock,
  Search,
  Settings,
  FileText,
  Activity,
  LayoutGrid,
} from 'lucide-react';

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon: typeof Box;
  shortcut?: string;
  action: () => void;
  category?: string;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onAddService?: (type: string) => void;
  onNavigate?: (path: string) => void;
}

export function CommandPalette({
  open,
  onClose,
  onAddService,
  onNavigate,
}: CommandPaletteProps) {
  if (!open) return null;

  return (
    <CommandPaletteContent
      onClose={onClose}
      onAddService={onAddService}
      onNavigate={onNavigate}
    />
  );
}

function CommandPaletteContent({
  onClose,
  onAddService,
  onNavigate,
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

  const commands: CommandItem[] = [
    {
      id: 'add-web',
      label: 'Add Web Service',
      description: 'Deploy a web application',
      icon: Box,
      shortcut: 'W',
      category: 'Create',
      action: () => {
        onAddService?.('web');
        onClose();
      },
    },
    {
      id: 'add-worker',
      label: 'Add Worker Service',
      description: 'Deploy a background worker',
      icon: Clock,
      shortcut: 'K',
      category: 'Create',
      action: () => {
        onAddService?.('worker');
        onClose();
      },
    },
    {
      id: 'add-database',
      label: 'Add Database',
      description: 'Provision a PostgreSQL database',
      icon: Database,
      shortcut: 'D',
      category: 'Create',
      action: () => {
        onAddService?.('database');
        onClose();
      },
    },
    {
      id: 'add-cron',
      label: 'Add Cron Job',
      description: 'Schedule a recurring task',
      icon: Clock,
      category: 'Create',
      action: () => {
        onAddService?.('cron');
        onClose();
      },
    },
    {
      id: 'connect-github',
      label: 'Connect GitHub Repo',
      description: 'Link a repository for auto-deploy',
      icon: Github,
      category: 'Connect',
      action: () => {
        onClose();
      },
    },
    {
      id: 'deploy-image',
      label: 'Deploy Docker Image',
      description: 'Deploy from a container registry',
      icon: Image,
      category: 'Connect',
      action: () => {
        onClose();
      },
    },
    {
      id: 'goto-canvas',
      label: 'Go to Canvas',
      icon: LayoutGrid,
      shortcut: 'C',
      category: 'Navigate',
      action: () => {
        onNavigate?.('canvas');
        onClose();
      },
    },
    {
      id: 'goto-logs',
      label: 'Go to Logs',
      icon: FileText,
      shortcut: 'L',
      category: 'Navigate',
      action: () => {
        onNavigate?.('logs');
        onClose();
      },
    },
    {
      id: 'goto-metrics',
      label: 'Go to Metrics',
      icon: Activity,
      shortcut: 'M',
      category: 'Navigate',
      action: () => {
        onNavigate?.('observability');
        onClose();
      },
    },
    {
      id: 'goto-settings',
      label: 'Go to Settings',
      icon: Settings,
      shortcut: 'S',
      category: 'Navigate',
      action: () => {
        onNavigate?.('settings');
        onClose();
      },
    },
  ];

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

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-[var(--bg-void)]/80 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="absolute left-1/2 top-[20%] -translate-x-1/2 w-full max-w-xl">
        <Command
          className="panel overflow-hidden"
          loop
        >
          <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border-subtle)]">
            <Search size={18} className="text-[var(--text-muted)]" />
            <Command.Input
              value={search}
              onValueChange={setSearch}
              placeholder="What would you like to create?"
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
                <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">
                  {category}
                </div>
                {items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Command.Item
                      key={item.id}
                      value={item.label}
                      onSelect={item.action}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius-md)] cursor-pointer text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)] aria-selected:bg-[var(--accent-primary-soft)] aria-selected:text-[var(--accent-primary)] transition-colors"
                    >
                      <Icon size={18} className="text-[var(--text-muted)]" />
                      <div className="flex-1">
                        <div className="text-sm font-medium">{item.label}</div>
                        {item.description && (
                          <div className="text-xs text-[var(--text-muted)]">{item.description}</div>
                        )}
                      </div>
                      {item.shortcut && (
                        <kbd className="px-2 py-0.5 rounded bg-[var(--surface-muted)] text-[10px] font-mono text-[var(--text-muted)]">
                          {item.shortcut}
                        </kbd>
                      )}
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
