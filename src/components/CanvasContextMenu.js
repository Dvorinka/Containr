import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React from 'react';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger, } from '@radix-ui/react-context-menu';
import { Github, Database, Container, Code, HardDrive } from 'lucide-react';
import { useCanvasStore } from '../store/canvasStore';
const serviceOptions = [
    {
        id: 'github',
        name: 'GitHub Repository',
        type: 'github',
        icon: Github,
    },
    {
        id: 'postgres',
        name: 'PostgreSQL',
        type: 'database',
        icon: Database,
    },
    {
        id: 'redis',
        name: 'Redis',
        type: 'database',
        icon: Database,
    },
    {
        id: 'docker',
        name: 'Docker Image',
        type: 'docker',
        icon: Container,
    },
    {
        id: 'function',
        name: 'Serverless Function',
        type: 'function',
        icon: Code,
    },
    {
        id: 'bucket',
        name: 'Storage Bucket',
        type: 'bucket',
        icon: HardDrive,
    },
];
export default function CanvasContextMenu({ children }) {
    const { addNode } = useCanvasStore();
    const handleSelect = (option, event) => {
        // Get click position relative to the canvas
        const reactFlowElement = event.target.closest('.react-flow');
        if (!reactFlowElement)
            return;
        const rect = reactFlowElement.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        // Generate a unique ID for the new node
        const nodeId = `${option.type}-${Date.now()}`;
        // Create the new node at click position
        const newNode = {
            id: nodeId,
            type: option.type,
            position: { x, y },
            data: {
                label: option.name,
                type: option.type,
                status: 'stopped',
                ...(option.type === 'github' && { repo: 'user/repo' }),
            },
        };
        // Add the node to the store
        addNode(newNode);
    };
    return (_jsxs(ContextMenu, { children: [_jsx(ContextMenuTrigger, { className: "w-full h-full", children: children }), _jsxs(ContextMenuContent, { className: "z-50 min-w-[200px] bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden", "data-ui-element": "true", children: [_jsx("div", { className: "px-3 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900", children: _jsx("div", { className: "text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide", children: "Add Service" }) }), _jsx("div", { className: "py-1", children: serviceOptions.map((option) => (_jsxs(ContextMenuItem, { className: "flex items-center px-3 py-2 text-sm cursor-pointer transition-all duration-150 text-gray-700 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-gray-700 hover:text-blue-600 dark:hover:text-blue-400 focus:outline-none focus:bg-blue-50 dark:focus:bg-gray-700 group", onSelect: (event) => handleSelect(option, event), children: [_jsx("div", { className: "w-5 h-5 rounded bg-gray-100 dark:bg-gray-600 flex items-center justify-center mr-2 group-hover:bg-blue-100 dark:group-hover:bg-blue-900 transition-colors flex-shrink-0", children: _jsx(option.icon, { className: "w-2.5 h-2.5 text-gray-600 dark:text-gray-300 group-hover:text-blue-600 dark:group-hover:text-blue-400" }) }), _jsx("div", { className: "flex-1 font-medium text-sm truncate", children: option.name })] }, option.id))) })] })] }));
}
