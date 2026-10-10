import type { CanvasGroup, CanvasNodeLayout, ProjectCanvasMetadata } from '../model';
import { NODE_HEIGHT, NODE_WIDTH } from './auto-layout';
import type { GroupNodeType, ServiceNodeType } from './nodes';

export type CanvasNode = ServiceNodeType | GroupNodeType;
export type Rect = { x: number; y: number; w: number; h: number };

export const GROUP_DEFAULT_WIDTH = 340;
export const GROUP_DEFAULT_HEIGHT = 230;
export const GROUP_PAD_X = 28;
export const GROUP_PAD_TOP = 56;
export const GROUP_PAD_BOTTOM = 24;
export const GROUP_ROW_GAP = 16;
export const GRID_STEP = 26;
export const NODE_GAP = 14;

export function rectsOverlap(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.w + NODE_GAP &&
    a.x + a.w + NODE_GAP > b.x &&
    a.y < b.y + b.h + NODE_GAP &&
    a.y + a.h + NODE_GAP > b.y
  );
}

// Nearest grid-aligned position where a node fits without touching any
// occupied rect. Spiral-searches outward on the canvas lattice; falls back to
// the given position when the neighbourhood is fully boxed in.
export function resolveFreeSpot(
  desired: { x: number; y: number },
  occupied: Rect[],
  fallback: { x: number; y: number },
  bounds?: Rect,
): { x: number; y: number } {
  const snap = (v: number) => Math.round(v / GRID_STEP) * GRID_STEP;
  const base = { x: snap(desired.x), y: snap(desired.y) };
  const fits = (x: number, y: number) => {
    if (bounds && (x < bounds.x || y < bounds.y || x + NODE_WIDTH > bounds.x + bounds.w || y + NODE_HEIGHT > bounds.y + bounds.h)) {
      return false;
    }
    return !occupied.some((rect) => rectsOverlap({ x, y, w: NODE_WIDTH, h: NODE_HEIGHT }, rect));
  };

  if (fits(base.x, base.y)) {
    return base;
  }

  for (let ring = 1; ring <= 12; ring++) {
    for (let dx = -ring; dx <= ring; dx++) {
      for (let dy = -ring; dy <= ring; dy++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) {
          continue;
        }
        const x = base.x + dx * GRID_STEP;
        const y = base.y + dy * GRID_STEP;
        if (fits(x, y)) {
          return { x, y };
        }
      }
    }
  }

  return fallback;
}

// Where an incoming service lands inside a group frame. If the point already
// fits inside the padded area, honour it. Otherwise append beneath the lowest
// member and grow the frame just enough — keeps groups compact instead of
// ballooning the frame to wherever the node used to sit.
export function groupSlot(
  nodes: CanvasNode[],
  groupId: string,
  group: CanvasNode,
  desiredX: number,
  desiredY: number,
  ignoreServiceId?: string,
): { x: number; y: number; width: number; height: number } {
  const width = typeof group.style?.width === 'number' ? group.style.width : GROUP_DEFAULT_WIDTH;
  const height = typeof group.style?.height === 'number' ? group.style.height : GROUP_DEFAULT_HEIGHT;

  const members = nodes.filter(
    (node) => node.type === 'serviceNode' && node.parentId === groupId && node.id !== ignoreServiceId,
  );
  const memberRects: Rect[] = members.map((node) => ({
    x: node.position.x,
    y: node.position.y,
    w: NODE_WIDTH,
    h: NODE_HEIGHT,
  }));
  const snap = (v: number) => Math.round(v / GRID_STEP) * GRID_STEP;
  const snappedX = snap(desiredX);
  const snappedY = snap(desiredY);
  const snappedFits =
    snappedX >= GROUP_PAD_X &&
    snappedY >= GROUP_PAD_TOP &&
    snappedX + NODE_WIDTH <= width - GROUP_PAD_X &&
    snappedY + NODE_HEIGHT <= height - GROUP_PAD_BOTTOM;
  const collides = memberRects.some((rect) =>
    rectsOverlap({ x: snappedX, y: snappedY, w: NODE_WIDTH, h: NODE_HEIGHT }, rect),
  );

  if (snappedFits && !collides) {
    return { x: snappedX, y: snappedY, width, height };
  }

  let bottom = GROUP_PAD_TOP - GROUP_ROW_GAP;
  for (const node of nodes) {
    if (node.type === 'serviceNode' && node.parentId === groupId && node.id !== ignoreServiceId) {
      bottom = Math.max(bottom, node.position.y + NODE_HEIGHT);
    }
  }

  const x = GROUP_PAD_X;
  const y = bottom + GROUP_ROW_GAP;
  return {
    x,
    y,
    width: Math.max(width, x + NODE_WIDTH + GROUP_PAD_X),
    height: Math.max(height, y + NODE_HEIGHT + GROUP_PAD_BOTTOM),
  };
}

export function buildMetadataFromFlow(nodes: CanvasNode[], viewport: { x: number; y: number; zoom: number }): ProjectCanvasMetadata {
  const groups: CanvasGroup[] = [];
  const layouts: CanvasNodeLayout[] = [];

  for (const node of nodes) {
    if (node.type === 'groupNode') {
      const width = typeof node.style?.width === 'number' ? node.style.width : GROUP_DEFAULT_WIDTH;
      const height = typeof node.style?.height === 'number' ? node.style.height : GROUP_DEFAULT_HEIGHT;
      groups.push({
        id: node.id,
        title: node.data.title,
        position: node.position,
        width,
        height,
      });
      continue;
    }

    if (node.type === 'serviceNode') {
      layouts.push({
        serviceId: node.id,
        position: node.position,
        groupId: node.parentId,
      });
    }
  }

  return {
    groups,
    nodes: layouts,
    edges: [],
    viewport,
  };
}
