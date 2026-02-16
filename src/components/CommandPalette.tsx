import React, { useEffect, useState } from 'react';
import { Command } from 'cmdk';
import { 
  Github, 
  Database, 
  Container, 
  Code, 
  HardDrive, 
  Plus,
  Search
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
}

const serviceOptions: ServiceOption[] = [
  {
    id: 'github',
    name: 'GitHub Repository',
    description: 'Deploy from a GitHub repository',
    icon: Github,
    type: 'github',
  },
  {
    id: 'postgres',
    name: 'PostgreSQL',
    description: 'Add a PostgreSQL database',
    icon: Database,
    type: 'database',
  },
  {
    id: 'redis',
    name: 'Redis',
    description: 'Add a Redis cache',
    icon: Database,
    type: 'database',
  },
  {
    id: 'docker',
    name: 'Docker Image',
    description: 'Deploy a Docker image',
    icon: Container,
    type: 'docker',
  },
  {
    id: 'function',
    name: 'Serverless Function',
    description: 'Add a serverless function',
    icon: Code,
    type: 'function',
  },
  {
    id: 'bucket',
    name: 'Storage Bucket',
    description: 'Add object storage',
    icon: HardDrive,
    type: 'bucket',
  },
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
    }

    return () => {
      document.removeEventListener('keydown', down);
    };
  }, [open, onClose]);

  const handleSelect = (option: ServiceOption) => {
    // Generate a unique ID for the new node
    const nodeId = `${option.type}-${Date.now()}`;
    
    // Calculate a random position for the new node
    const position = {
      x: Math.random() * 400 + 100,
      y: Math.random() * 300 + 100,
    };

    // Create the new node
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

    // Add the node to the store
    addNode(newNode);
    
    console.log('Added service:', option);
    onClose();
  };

  if (!open) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      data-ui-element="true"
    >
      <div className="w-full max-w-md">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <Command className="rounded-2xl">
            <div className="flex items-center border-b border-gray-200 dark:border-gray-700 px-4 py-3">
              <Search className="w-5 h-5 text-gray-400 mr-3" />
              <Command.Input
                placeholder="What would you like to create?"
                value={search}
                onValueChange={setSearch}
                className="flex-1 py-2 bg-transparent outline-none text-gray-900 dark:text-gray-100 placeholder-gray-500 text-sm"
              />
              <kbd className="ml-3 px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded">
                ESC
              </kbd>
            </div>

            <Command.List className="max-h-[350px] overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent">
              <Command.Empty className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                No services found.
              </Command.Empty>

              {serviceOptions.map((option) => (
                <Command.Item
                  key={option.id}
                  onSelect={() => handleSelect(option)}
                  className={cn(
                    'flex items-center gap-3 px-3 py-3 rounded-xl text-sm cursor-pointer transition-all duration-150',
                    'hover:bg-blue-50 dark:hover:bg-gray-700',
                    'focus:bg-blue-50 dark:focus:bg-gray-700',
                    'text-gray-700 dark:text-gray-300',
                    'hover:text-blue-600 dark:hover:text-blue-400'
                  )}
                >
                  <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-600 flex items-center justify-center group-hover:bg-blue-100 dark:group-hover:bg-blue-900 transition-colors flex-shrink-0">
                    <option.icon className="w-4 h-4 text-gray-600 dark:text-gray-300 group-hover:text-blue-600 dark:group-hover:text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">{option.name}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {option.description}
                    </div>
                  </div>
                  <Plus className="w-4 h-4 text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400" />
                </Command.Item>
              ))}
            </Command.List>

            <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-3 bg-gray-50 dark:bg-gray-900">
              <div className="flex items-center justify-center text-xs text-gray-500 dark:text-gray-400 gap-6">
                <div className="flex items-center gap-2">
                  <kbd className="px-2 py-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-xs">
                    ↑↓
                  </kbd>
                  <span>Navigate</span>
                </div>
                <div className="flex items-center gap-2">
                  <kbd className="px-2 py-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-xs">
                    ↵
                  </kbd>
                  <span>Select</span>
                </div>
                <div className="flex items-center gap-2">
                  <kbd className="px-2 py-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-xs">
                    ESC
                  </kbd>
                  <span>Close</span>
                </div>
              </div>
            </div>
          </Command>
        </div>
      </div>
    </div>
  );
}
