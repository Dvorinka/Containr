import React from 'react';
import { Position } from '@xyflow/react';
interface AnimatedEdgeProps {
    id: string;
    sourceX: number;
    sourceY: number;
    targetX: number;
    targetY: number;
    targetPosition: Position;
    sourcePosition: Position;
    style?: React.CSSProperties;
    markerEnd?: string;
}
export default function AnimatedEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, style, markerEnd, }: AnimatedEdgeProps): import("react/jsx-runtime").JSX.Element;
export {};
