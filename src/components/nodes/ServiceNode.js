import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Handle, Position } from '@xyflow/react';
import { Github, Database, Container, Code, HardDrive, Plus } from 'lucide-react';
import { cn } from '../../lib/utils';
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
export default function ServiceNode({ data, selected }) {
    const Icon = iconMap[data.type];
    const statusColor = data.status ? statusColors[data.status] : 'bg-gray-500';
    const typeColor = typeColors[data.type];
    return (_jsxs("div", { className: cn('relative min-w-[200px] max-w-[300px] rounded-lg border-2 bg-white dark:bg-slate-800 shadow-lg transition-all duration-200 hover:shadow-xl', typeColor, selected && 'ring-2 ring-blue-500 ring-offset-2'), "data-ui-element": "true", children: [data.status && (_jsx("div", { className: "absolute -top-2 -right-2", children: _jsx("div", { className: cn('w-4 h-4 rounded-full', statusColor) }) })), _jsx(Handle, { type: "target", position: Position.Top, className: "w-3 h-3 bg-slate-400 border-2 border-white dark:border-slate-800" }), _jsx(Handle, { type: "source", position: Position.Bottom, className: "w-3 h-3 bg-slate-400 border-2 border-white dark:border-slate-800" }), _jsxs("div", { className: "p-4", children: [_jsxs("div", { className: "flex items-center gap-3 mb-2", children: [_jsx("div", { className: "p-2 rounded-md bg-white dark:bg-slate-700", children: _jsx(Icon, { className: "w-5 h-5 text-slate-700 dark:text-slate-300" }) }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("h3", { className: "font-semibold text-sm text-slate-900 dark:text-slate-100 truncate", children: data.label }), data.repo && (_jsx("p", { className: "text-xs text-slate-500 dark:text-slate-400 truncate", children: data.repo }))] })] }), data.type === 'empty' && (_jsx("div", { className: "text-center py-2", children: _jsx("p", { className: "text-xs text-slate-500 dark:text-slate-400", children: "Click to add service" }) })), data.status && (_jsx("div", { className: "mt-2 pt-2 border-t border-slate-200 dark:border-slate-700", children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsx("span", { className: "text-xs text-slate-500 dark:text-slate-400 capitalize", children: data.status }), data.type === 'github' && (_jsx("span", { className: "text-xs text-slate-500 dark:text-slate-400", children: "main" }))] }) }))] })] }));
}
