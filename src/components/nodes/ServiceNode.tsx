import { Handle, Position } from '@xyflow/react';
import { Github, Database, Container, Code, HardDrive, Plus } from 'lucide-react';
import { cn } from '../../lib/utils';

interface ServiceNodeProps {
  data: {
    label: string;
    type: 'github' | 'database' | 'docker' | 'function' | 'bucket' | 'empty';
    repo?: string;
    status?: 'running' | 'building' | 'error' | 'stopped';
  };
  selected?: boolean;
}

const iconMap = {
  github: Github,
  database: Database,
  docker: Container,
  function: Code,
  bucket: HardDrive,
  empty: Plus,
};

const statusColors = {
  running: 'bg-green-500',
  building: 'bg-yellow-500',
  error: 'bg-red-500',
  stopped: 'bg-gray-500',
};

const typeColors = {
  github: 'bg-blue-100 dark:bg-blue-900 border-blue-300 dark:border-blue-700',
  database: 'bg-green-100 dark:bg-green-900 border-green-300 dark:border-green-700',
  docker: 'bg-amber-100 dark:bg-amber-900 border-amber-300 dark:border-amber-700',
  function: 'bg-purple-100 dark:bg-purple-900 border-purple-300 dark:border-purple-700',
  bucket: 'bg-cyan-100 dark:bg-cyan-900 border-cyan-300 dark:border-cyan-700',
  empty: 'bg-gray-100 dark:bg-gray-900 border-gray-300 dark:border-gray-700',
};

export default function ServiceNode({ data, selected }: ServiceNodeProps) {
  const Icon = iconMap[data.type];
  const statusColor = data.status ? statusColors[data.status] : 'bg-gray-500';
  const typeColor = typeColors[data.type];

  return (
    <div
      className={cn(
        'relative min-w-[200px] max-w-[300px] rounded-lg border-2 bg-white dark:bg-slate-800 shadow-lg transition-all duration-200 hover:shadow-xl',
        typeColor,
        selected && 'ring-2 ring-blue-500 ring-offset-2'
      )}
      data-ui-element="true"
    >
      {/* Status indicator */}
      {data.status && (
        <div className="absolute -top-2 -right-2">
          <div className={cn('w-4 h-4 rounded-full', statusColor)} />
        </div>
      )}

      {/* Handles */}
      <Handle
        type="target"
        position={Position.Top}
        className="w-3 h-3 bg-slate-400 border-2 border-white dark:border-slate-800"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="w-3 h-3 bg-slate-400 border-2 border-white dark:border-slate-800"
      />

      {/* Content */}
      <div className="p-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-md bg-white dark:bg-slate-700">
            <Icon className="w-5 h-5 text-slate-700 dark:text-slate-300" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm text-slate-900 dark:text-slate-100 truncate">
              {data.label}
            </h3>
            {data.repo && (
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {data.repo}
              </p>
            )}
          </div>
        </div>

        {data.type === 'empty' && (
          <div className="text-center py-2">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Click to add service
            </p>
          </div>
        )}

        {data.status && (
          <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500 dark:text-slate-400 capitalize">
                {data.status}
              </span>
              {data.type === 'github' && (
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  main
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
