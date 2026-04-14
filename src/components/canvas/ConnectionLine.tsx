import React from 'react';

interface ConnectionLineProps {
  from: { x: number; y: number };
  to: { x: number; y: number };
  type: 'database' | 'api' | 'network';
  status: 'active' | 'inactive';
  isTemporary?: boolean;
}

export function ConnectionLine({ from, to, type, status, isTemporary }: ConnectionLineProps) {
  const getColor = () => {
    if (isTemporary) return '#3b82f6';
    if (status === 'inactive') return '#6b7280';
    
    switch (type) {
      case 'database': return '#10b981';
      case 'api': return '#8b5cf6';
      case 'network': return '#f59e0b';
      default: return '#6b7280';
    }
  };

  const getStrokeDasharray = () => {
    if (isTemporary) return '5,5';
    return status === 'inactive' ? '3,3' : 'none';
  };

  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  
  // Calculate control points for curved line
  const cx = from.x + dx / 2;
  const cy = from.y + dy / 2 - Math.min(distance / 4, 50);

  return (
    <g>
      <defs>
        <marker
          id={`arrowhead-${type}-${status}`}
          markerWidth="10"
          markerHeight="10"
          refX="8"
          refY="3"
          orient="auto"
        >
          <polygon
            points="0 0, 10 3, 0 6"
            fill={getColor()}
          />
        </marker>
      </defs>
      
      <path
        d={`M ${from.x} ${from.y} Q ${cx} ${cy} ${to.x} ${to.y}`}
        stroke={getColor()}
        strokeWidth={isTemporary ? 2 : status === 'active' ? 2 : 1}
        fill="none"
        strokeDasharray={getStrokeDasharray()}
        markerEnd={`url(#arrowhead-${type}-${status})`}
        opacity={isTemporary ? 0.6 : status === 'inactive' ? 0.5 : 0.8}
        className={status === 'active' && !isTemporary ? 'animate-pulse' : ''}
      />
    </g>
  );
}
