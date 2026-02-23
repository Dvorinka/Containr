import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React, { useEffect, useState } from 'react';
import { Command } from 'cmdk';
import { Github, Database, Container, Code, HardDrive, Plus, Search, Layers, Server } from 'lucide-react';
import { cn } from '../lib/utils';
import { useCanvasStore } from '../store/canvasStore';
const serviceOptions = [
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
export default function CommandPalette({ open, onClose }) {
    const [search, setSearch] = useState('');
    const { addNode } = useCanvasStore();
    useEffect(() => {
        const down = (e) => {
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
    const handleSelect = (option) => {
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
                status: 'stopped',
                ...(option.type === 'github' && { repo: 'user/repo' }),
            },
        };
        addNode(newNode);
        onClose();
    };
    if (!open)
        return null;
    return (_jsx("div", { className: "fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-start justify-center pt-[15vh] p-4 animate-fade-in", children: _jsx("div", { className: "w-full max-w-xl animate-command-in", children: _jsxs(Command, { className: "bg-card/95 backdrop-blur-2xl rounded-2xl shadow-modal border border-border/50 overflow-hidden", children: [_jsxs("div", { className: "flex items-center border-b border-border/50 px-4 py-3", children: [_jsx(Search, { className: "w-5 h-5 text-muted-foreground mr-3 shrink-0" }), _jsx(Command.Input, { placeholder: "What would you like to create?", value: search, onValueChange: setSearch, className: "flex-1 py-2 bg-transparent outline-none text-foreground placeholder-muted-foreground text-sm", autoFocus: true }), _jsx("kbd", { className: "ml-3 px-2 py-1 text-[10px] bg-muted/50 text-muted-foreground rounded-md font-mono border border-border/50", children: "ESC" })] }), _jsxs(Command.List, { className: "max-h-[350px] overflow-y-auto p-2 scrollbar-thin", children: [_jsx(Command.Empty, { className: "py-10 text-center text-sm text-muted-foreground", children: _jsxs("div", { className: "flex flex-col items-center gap-2", children: [_jsx(Search, { className: "w-8 h-8 text-muted-foreground/50" }), _jsx("span", { children: "No services found." })] }) }), search === '' && (_jsx("div", { className: "px-2 py-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider", children: "Quick Actions" })), search === '' && quickActions.map((action) => (_jsxs(Command.Item, { className: cn('flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm cursor-pointer transition-all duration-150', 'hover:bg-muted/50 data-[selected=true]:bg-muted/50', 'text-foreground'), children: [_jsx("div", { className: "w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center", children: _jsx(action.icon, { className: "w-4 h-4 text-muted-foreground" }) }), _jsx("span", { className: "flex-1 font-medium", children: action.name }), _jsxs("kbd", { className: "px-1.5 py-0.5 text-[10px] bg-background text-muted-foreground rounded border border-border/50 font-mono", children: ["\u2318", action.shortcut] })] }, action.name))), _jsx("div", { className: "px-2 py-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider mt-2", children: "Create New Service" }), serviceOptions.map((option) => (_jsxs(Command.Item, { onSelect: () => handleSelect(option), className: cn('flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm cursor-pointer transition-all duration-150', 'hover:bg-muted/50 data-[selected=true]:bg-muted/50', 'text-foreground group'), children: [_jsx("div", { className: cn("w-9 h-9 rounded-xl flex items-center justify-center transition-colors", "bg-gradient-to-br", option.gradient, "group-hover:from-primary/10 group-hover:to-primary/5"), children: _jsx(option.icon, { className: "w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" }) }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("div", { className: "font-medium", children: option.name }), _jsx("div", { className: "text-xs text-muted-foreground mt-0.5", children: option.description })] }), _jsx(Plus, { className: "w-4 h-4 text-muted-foreground/50 group-hover:text-primary group-hover:text-primary transition-colors" })] }, option.id)))] }), _jsx("div", { className: "border-t border-border/50 px-4 py-3 bg-muted/20", children: _jsxs("div", { className: "flex items-center justify-center text-[11px] text-muted-foreground gap-6", children: [_jsxs("div", { className: "flex items-center gap-1.5", children: [_jsx("kbd", { className: "px-1.5 py-0.5 bg-background/80 border border-border/50 rounded text-[10px] font-mono", children: "\u2191\u2193" }), _jsx("span", { children: "Navigate" })] }), _jsxs("div", { className: "flex items-center gap-1.5", children: [_jsx("kbd", { className: "px-1.5 py-0.5 bg-background/80 border border-border/50 rounded text-[10px] font-mono", children: "\u21B5" }), _jsx("span", { children: "Select" })] }), _jsxs("div", { className: "flex items-center gap-1.5", children: [_jsx("kbd", { className: "px-1.5 py-0.5 bg-background/80 border border-border/50 rounded text-[10px] font-mono", children: "ESC" }), _jsx("span", { children: "Close" })] })] }) })] }) }) }));
}
