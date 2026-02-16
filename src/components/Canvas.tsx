import React, { useCallback, useRef, useEffect, useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  ReactFlowProvider,
} from '@xyflow/react';
import type { Node as ReactFlowNode } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useCanvasStore } from '../store/canvasStore';
import ServiceNodeComponent from './nodes/ServiceNode';
import EmptyCanvasNode from './nodes/EmptyCanvasNode';
import AnimatedEdge from './edges/AnimatedEdge';
import CanvasContextMenu from './CanvasContextMenu';

const nodeTypes = {
  service: ServiceNodeComponent,
  empty: EmptyCanvasNode,
};

const edgeTypes = {
  animated: AnimatedEdge,
};

function CanvasContent() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isOverUI, setIsOverUI] = useState(false);
  const { resolvedTheme } = useTheme();
  const {
    nodes,
    edges,
    setNodes,
    setEdges,
    onConnect,
    setSelectedNode,
  } = useCanvasStore();

  const [internalNodes, setInternalNodes, onNodesChange] = useNodesState(nodes);
  const [internalEdges, setInternalEdges, onEdgesChange] = useEdgesState(edges);

  // Sync internal state with store
  React.useEffect(() => {
    setInternalNodes(nodes);
  }, [nodes, setInternalNodes]);

  React.useEffect(() => {
    setInternalEdges(edges);
  }, [edges, setInternalEdges]);

  // Global hover detection for UI elements
  useEffect(() => {
    const handleMouseEnter = (e: MouseEvent) => {
      const target = e.target as Element;
      // Check if hovering over any UI element that should disable canvas interactions
      if (target && target.closest && (
        target.closest('[data-ui-element="true"]') || 
        target.closest('.react-flow__node') ||
        target.closest('[role="menu"]') ||
        target.closest('[role="dialog"]') ||
        target.closest('[data-cmdk-list]'))) {
        setIsOverUI(true);
      }
    };

    const handleMouseLeave = (e: MouseEvent) => {
      const target = e.target as Element;
      // Check if leaving UI elements
      if (target && target.closest && (
        target.closest('[data-ui-element="true"]') || 
        target.closest('.react-flow__node') ||
        target.closest('[role="menu"]') ||
        target.closest('[role="dialog"]') ||
        target.closest('[data-cmdk-list]'))) {
        setIsOverUI(false);
      }
    };

    const handleGlobalMouseMove = (e: MouseEvent) => {
      const target = e.target as Element;
      // Check if currently over any UI element
      if (target && target.closest) {
        const overUI = target.closest('[data-ui-element="true"]') || 
                       target.closest('.react-flow__node') ||
                       target.closest('[role="menu"]') ||
                       target.closest('[role="dialog"]') ||
                       target.closest('[data-cmdk-list]');
        setIsOverUI(!!overUI);
        // Debug logging
        if (overUI) {
          console.log('Over UI element:', overUI);
        }
      }
    };

    // Prevent wheel events at document level when over UI
    const handleDocumentWheel = (e: WheelEvent) => {
      if (isOverUI) {
        // When hovering over UI elements, prevent canvas zoom/scroll
        // regardless of what the wheel event target is
        console.log('Preventing canvas wheel event while over UI');
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        return false;
      }
    };

    document.addEventListener('mouseenter', handleMouseEnter, true);
    document.addEventListener('mouseleave', handleMouseLeave, true);
    document.addEventListener('mousemove', handleGlobalMouseMove, true);
    document.addEventListener('wheel', handleDocumentWheel, { passive: false, capture: true });

    return () => {
      document.removeEventListener('mouseenter', handleMouseEnter, true);
      document.removeEventListener('mouseleave', handleMouseLeave, true);
      document.removeEventListener('mousemove', handleGlobalMouseMove, true);
      document.removeEventListener('wheel', handleDocumentWheel, { capture: true } as any);
    };
  }, [isOverUI]);

  // Ensure container has proper dimensions
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current && containerRef.current.parentElement) {
        const parent = containerRef.current.parentElement;
        const rect = parent.getBoundingClientRect();
        
        // Only set dimensions if they're valid and different from current
        if (rect.width > 0 && rect.height > 0) {
          const currentWidth = containerRef.current.style.width;
          const currentHeight = containerRef.current.style.height;
          const newWidth = `${rect.width}px`;
          const newHeight = `${rect.height}px`;
          
          if (currentWidth !== newWidth || currentHeight !== newHeight) {
            containerRef.current.style.width = newWidth;
            containerRef.current.style.height = newHeight;
          }
        } else {
          // Fallback dimensions if parent has no size
          containerRef.current.style.width = '100vw';
          containerRef.current.style.height = 'calc(100vh - 56px)';
        }
      }
    };

    // Set dimensions immediately
    updateDimensions();
    
    // Also try after a short delay
    const timeout1 = setTimeout(updateDimensions, 10);
    const timeout2 = setTimeout(updateDimensions, 100);
    
    // Use ResizeObserver for reliable dimension tracking
    let resizeObserver: ResizeObserver | null = null;
    if (containerRef.current?.parentElement && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(updateDimensions);
      resizeObserver.observe(containerRef.current.parentElement);
    }
    
    return () => {
      clearTimeout(timeout1);
      clearTimeout(timeout2);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  }, []);

  const handleNodesChange = useCallback((changes: any) => {
    onNodesChange(changes);
    setNodes(internalNodes);
  }, [onNodesChange, setNodes, internalNodes]);

  const handleEdgesChange = useCallback((changes: any) => {
    onEdgesChange(changes);
    setEdges(internalEdges);
  }, [onEdgesChange, setEdges, internalEdges]);

  const onNodeDragStop = useCallback(
    (_event: React.MouseEvent, node: ReactFlowNode) => {
      console.log('Node moved:', node.id, node.position);
      setNodes(internalNodes);
    },
    [setNodes, internalNodes]
  );

  const onNodeClick = useCallback((_event: React.MouseEvent, node: ReactFlowNode) => {
    setSelectedNode(node.id);
  }, [setSelectedNode]);

  const handleCanvasWheel = useCallback((e: React.WheelEvent) => {
    console.log('Canvas wheel event, isOverUI:', isOverUI);
    if (isOverUI) {
      console.log('Preventing canvas zoom/scroll');
      e.stopPropagation();
      e.preventDefault();
    }
  }, [isOverUI]);

  return (
    <div className="flex-1 min-h-0 relative scrollbar-hide">
      <div className="w-full h-full bg-background rounded-t-xl border border-[rgb(var(--border))] border-b-0 overflow-hidden">
        <CanvasContextMenu>
          <div 
            ref={containerRef}
            className="w-full h-full"
            style={{ width: '100vw', height: 'calc(100vh - 56px)' }}
          >
            <ReactFlow
              nodes={internalNodes}
              edges={internalEdges}
              onNodesChange={handleNodesChange}
              onEdgesChange={handleEdgesChange}
              onConnect={onConnect}
              onNodeDragStop={onNodeDragStop}
              onNodeClick={onNodeClick}
              onWheel={handleCanvasWheel}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              fitView
              fitViewOptions={{ padding: 0.2, minZoom: 0.5, maxZoom: 1 }}
              defaultViewport={{ x: 0, y: 0, zoom: 0.9 }}
              attributionPosition="bottom-left"
              className="w-full h-full"
              style={{ width: '100%', height: '100%' }}
            >
              <Background 
                color={resolvedTheme === 'dark' ? '#545260' : '#878593'} 
                gap={16} 
              />
              <Controls 
                className="bg-background border border-[rgb(var(--border))]"
              />
              <MiniMap 
                nodeColor={(node) => {
                  switch (node.data?.type) {
                    case 'github': return '#52297A';
                    case 'database': return '#181622';
                    case 'docker': return '#211F2D';
                    case 'function': return '#545260';
                    case 'bucket': return '#878593';
                    default: return '#33323E';
                  }
                }}
                className="bg-card border border-[rgb(var(--border))]"
              />
            </ReactFlow>
          </div>
        </CanvasContextMenu>
      </div>
    </div>
  );
}

export default function Canvas() {
  return (
    <ReactFlowProvider>
      <CanvasContent />
    </ReactFlowProvider>
  );
}
