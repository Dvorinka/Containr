import React, { useEffect, useState } from 'react';
import { Command } from 'cmdk';
import {
  Github,
  Database,
  Container,
  Code,
  HardDrive,
  Plus,
  Search,
  Layers,
  Server
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useCanvasStore } from '../store/canvasStore';

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

interface ServiceOption {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  type: 'github' | 'database' | 'docker' | 'function' | 'bucket';
  gradient: string;
}

const serviceOptions: ServiceOption[] = [
  {
    id: 'github',
    name: 'GitHub Repository',
    description: 'Deploy from a GitHub repository',
    icon: Github,
    type: 'github',
    gradient: 'from-violet-500/10 to-violet-500/5',
  },
  {
    id: 'postgres',
    name: 'PostgreSQL',
    description: 'Add a PostgreSQL database',
    icon: Database,
    type: 'database',
    gradient: 'from-blue-500/10 to-blue-500/5',
  },
  {
    id: 'redis',
    name: 'Redis',
    description: 'Add a Redis cache',
    icon: Database,
    type: 'database',
    gradient: 'from-red-500/10 to-red-500/5',
  },
  {
    id: 'docker',
    name: 'Docker Image',
    description: 'Deploy a Docker image',
    icon: Container,
    type: 'docker',
    gradient: 'from-cyan-500/10 to-cyan-500/5',
  },
  {
    id: 'function',
    name: 'Serverless Function',
    description: 'Add a serverless function',
    icon: Code,
    type: 'function',
    gradient: 'from-amber-500/10 to-amber-500/5',
  },
  {
    id: 'bucket',
    name: 'Storage Bucket',
    description: 'Add object storage',
    icon: HardDrive,
    type: 'bucket',
    gradient: 'from-emerald-500/10 to-emerald-500/5',
  },
];

const quickActions = [
  { name: 'New Project', icon: Layers, shortcut: 'P' },
  { name: 'Add Server', icon: Server, shortcut: 'S' },
];

export default function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const [search, setSearch] = useState('');
  const { addNode } = useCanvasStore();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onClose();
      }
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (open) {
      document.addEventListener('keydown', down);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', down);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  const handleSelect = (option: ServiceOption) => {
    const nodeId = `${option.type}-${Date.now()}`;
    
    const position = {
      x: Math.random() * 400 + 100,
      y: Math.random() * 300 + 100,
    };

    const newNode = {
      id: nodeId,
      type: option.type,
      position,
      data: {
        label: option.name,
        type: option.type,
        status: 'stopped' as const,
        ...(option.type === 'github' && { repo: 'user/repo' }),
      },
    };

    addNode(newNode);
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-start justify-center pt-[15vh] p-4 animate-fade-in">
      <div className="w-full max-w-xl animate-command-in">
        <Command className="bg-card/95 backdrop-blur-2xl rounded-2xl shadow-modal border border-border/50 overflow-hidden">
          <div className="flex items-center border-b border-border/50 px-4 py-3">
            <Search className="w-5 h-5 text-muted-foreground mr-3 shrink-0" />
            <Command.Input
              placeholder="What would you like to create?"
              value={search}
              onValueChange={setSearch}
              className="flex-1 py-2 bg-transparent outline-none text-foreground placeholder-muted-foreground text-sm"
              autoFocus
            />
            <kbd className="ml-3 px-2 py-1 text-[10px] bg-muted/50 text-muted-foreground rounded-md font-mono border border-border/50">
              ESC
            </kbd>
          </div>

          <Command.List className="max-h-[350px] overflow-y-auto p-2 scrollbar-thin">
            <Command.Empty className="py-10 text-center text-sm text-muted-foreground">
              <div className="flex flex-col items-center gap-2">
                <Search className="w-8 h-8 text-muted-foreground/50" />
                <span>No services found.</span>
              </div>
            </Command.Empty>

            {search === '' && (
              <div className="px-2 py-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                Quick Actions
              </div>
            )}

            {search === '' && quickActions.map((action) => (
              <Command.Item
                key={action.name}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm cursor-pointer transition-all duration-150',
                  'hover:bg-muted/50 data-[selected=true]:bg-muted/50',
                  'text-foreground'
                )}
              >
                <div className="w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center">
                  <action.icon className="w-4 h-4 text-muted-foreground" />
                </div>
                <span className="flex-1 font-medium">{action.name}</span>
                <kbd className="px-1.5 py-0.5 text-[10px] bg-background text-muted-foreground rounded border border-border/50 font-mono">
                  ⌘{action.shortcut}
                </kbd>
              </Command.Item>
            ))}

            <div className="px-2 py-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider mt-2">
              Create New Service
            </div>

            {serviceOptions.map((option) => (
              <Command.Item
                key={option.id}
                onSelect={() => handleSelect(option)}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm cursor-pointer transition-all duration-150',
                  'hover:bg-muted/50 data-[selected=true]:bg-muted/50',
                  'text-foreground group'
                )}
              >
                <div className={cn(
                  "w-9 h-9 rounded-xl flex items-center justify-center transition-colors",
                  "bg-gradient-to-br",
                  option.gradient,
                  "group-hover:from-primary/10 group-hover:to-primary/5"
                )}>
                  <option.icon className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium">{option.name}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {option.description}
                  </div>
                </div>
                <Plus className="w-4 h-4 text-muted-foreground/50 group-hover:text-primary group-hover:text-primary transition-colors" />
              </Command.Item>
            ))}
          </Command.List>

          <div className="border-t border-border/50 px-4 py-3 bg-muted/20">
            <div className="flex items-center justify-center text-[11px] text-muted-foreground gap-6">
              <div className="flex items-center gap-1.5">
                <kbd className="px-1.5 py-0.5 bg-background/80 border border-border/50 rounded text-[10px] font-mono">↑↓</kbd>
                <span>Navigate</span>
              </div>
              <div className="flex items-center gap-1.5">
                <kbd className="px-1.5 py-0.5 bg-background/80 border border-border/50 rounded text-[10px] font-mono">↵</kbd>
                <span>Select</span>
              </div>
              <div className="flex items-center gap-1.5">
                <kbd className="px-1.5 py-0.5 bg-background/80 border border-border/50 rounded text-[10px] font-mono">ESC</kbd>
                <span>Close</span>
              </div>
            </div>
          </div>
        </Command>
      </div>
    </div>
  );
}
