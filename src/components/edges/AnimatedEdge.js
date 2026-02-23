import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import React from 'react';
import { BaseEdge, EdgeLabelRenderer, getBezierPath, Position, } from '@xyflow/react';
export default function AnimatedEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, style = {}, markerEnd, }) {
    const [edgePath, labelX, labelY] = getBezierPath({
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition,
    });
    return (_jsxs(_Fragment, { children: [_jsx(BaseEdge, { id: id, path: edgePath, markerEnd: markerEnd, style: {
                    ...style,
                    strokeWidth: 2,
                    stroke: '#94a3b8',
                } }), _jsx("defs", { children: _jsxs("linearGradient", { id: `gradient-${id}`, x1: "0%", y1: "0%", x2: "100%", y2: "0%", children: [_jsx("stop", { offset: "0%", stopColor: "#3b82f6", stopOpacity: "0" }), _jsx("stop", { offset: "50%", stopColor: "#3b82f6", stopOpacity: "1" }), _jsx("stop", { offset: "100%", stopColor: "#3b82f6", stopOpacity: "0" })] }) }), _jsx("path", { d: edgePath, fill: "none", stroke: `url(#gradient-${id})`, strokeWidth: 2, strokeLinecap: "round", className: "animate-network-flow-egress", style: {
                    strokeDasharray: '10 5',
                    animation: 'networkFlowEgress 2s linear infinite',
                } }), _jsx(EdgeLabelRenderer, { children: _jsx("div", { style: {
                        position: 'absolute',
                        transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
                        pointerEvents: 'all',
                    }, className: "nodrag nopan", children: _jsx("div", { className: "bg-white dark:bg-slate-800 px-2 py-1 rounded text-xs text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shadow-sm", children: "network" }) }) })] }));
}
