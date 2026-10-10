import { describe, expect, it } from 'vitest';
import {
  buildMetadataFromFlow,
  groupSlot,
  rectsOverlap,
  resolveFreeSpot,
} from './layout';
import { NODE_HEIGHT, NODE_WIDTH } from './auto-layout';
import type { GroupNodeType, ServiceNodeType } from './nodes';

const GRID_STEP = 26;
const NODE_GAP = 14;

function serviceNode(
  id: string,
  position: { x: number; y: number },
  parentId?: string,
): ServiceNodeType {
  return { id, type: 'serviceNode', position, parentId } as ServiceNodeType;
}

function groupNode(
  id: string,
  width = 340,
  height = 230,
): GroupNodeType {
  return {
    id,
    type: 'groupNode',
    position: { x: 0, y: 0 },
    style: { width, height },
    data: { title: `Group ${id}` },
  } as GroupNodeType;
}

describe('rectsOverlap', () => {
  const a = { x: 0, y: 0, w: 100, h: 100 };

  it('detects intersection', () => {
    expect(rectsOverlap(a, { x: 50, y: 50, w: 100, h: 100 })).toBe(true);
    expect(rectsOverlap(a, { x: -50, y: -50, w: 100, h: 100 })).toBe(true);
  });

  it('returns false for fully disjoint rects', () => {
    expect(rectsOverlap(a, { x: 500, y: 500, w: 100, h: 100 })).toBe(false);
  });

  it('treats the node gap as a collision zone', () => {
    // b sits just inside NODE_GAP to the right of a.
    expect(rectsOverlap(a, { x: 100 + NODE_GAP - 1, y: 0, w: 50, h: 50 })).toBe(true);
    // Beyond the gap there is no overlap.
    expect(rectsOverlap(a, { x: 100 + NODE_GAP + 1, y: 0, w: 50, h: 50 })).toBe(false);
  });
});

describe('resolveFreeSpot', () => {
  it('snaps the desired position to the grid when free', () => {
    const spot = resolveFreeSpot({ x: 40, y: 70 }, [], { x: 0, y: 0 });
    expect(spot).toEqual({ x: 52, y: 78 });
    expect(spot.x % GRID_STEP).toBe(0);
    expect(spot.y % GRID_STEP).toBe(0);
  });

  it('finds a neighbouring free grid point when occupied', () => {
    const occupied = [{ x: 0, y: 0, w: NODE_WIDTH, h: NODE_HEIGHT }];
    const spot = resolveFreeSpot({ x: 0, y: 0 }, occupied, { x: -1, y: -1 });
    expect(spot).not.toEqual({ x: -1, y: -1 });
    expect(Number.isInteger(spot.x / GRID_STEP)).toBe(true);
    expect(Number.isInteger(spot.y / GRID_STEP)).toBe(true);
    expect(
      rectsOverlap({ x: spot.x, y: spot.y, w: NODE_WIDTH, h: NODE_HEIGHT }, occupied[0]),
    ).toBe(false);
  });

  it('falls back when bounds reject every candidate', () => {
    // Node is wider than the bounds, so nothing can fit.
    const bounds = { x: 0, y: 0, w: 10, h: 10 };
    const fallback = { x: 999, y: 888 };
    expect(resolveFreeSpot({ x: 0, y: 0 }, [], fallback, bounds)).toEqual(fallback);
  });
});

describe('groupSlot', () => {
  it('honours a point that fits inside the padded frame', () => {
    const group = groupNode('g1');
    const slot = groupSlot([group], 'g1', group, 40, 70);
    expect(slot).toEqual({ x: 52, y: 78, width: 340, height: 230 });
  });

  it('appends below the lowest member and grows the frame on collision', () => {
    const group = groupNode('g1');
    const member = serviceNode('s1', { x: 52, y: 78 }, 'g1');
    const slot = groupSlot([group, member], 'g1', group, 40, 70);
    // bottom = 78 + 104 = 182; y = 182 + 16 = 198; grows height to 326.
    expect(slot.x).toBe(28);
    expect(slot.y).toBe(198);
    expect(slot.height).toBe(326);
    expect(slot.width).toBe(340);
  });

  it('appends under the padding when the desired point is outside', () => {
    const group = groupNode('g1');
    const slot = groupSlot([group], 'g1', group, 5000, 5000);
    expect(slot).toEqual({ x: 28, y: 56, width: 340, height: 230 });
  });

  it('ignores the dragged node when checking collisions', () => {
    const group = groupNode('g1');
    const dragged = serviceNode('s1', { x: 52, y: 78 }, 'g1');
    const slot = groupSlot([group, dragged], 'g1', group, 40, 70, 's1');
    expect(slot).toEqual({ x: 52, y: 78, width: 340, height: 230 });
  });
});

describe('buildMetadataFromFlow', () => {
  it('serializes groups and service layouts', () => {
    const nodes = [
      { ...groupNode('g1', 400, 300), position: { x: 10, y: 20 } },
      serviceNode('s1', { x: 5, y: 6 }, 'g1'),
      serviceNode('s2', { x: 100, y: 200 }),
    ];
    const viewport = { x: 1, y: 2, zoom: 0.5 };
    const meta = buildMetadataFromFlow(nodes, viewport);

    expect(meta.groups).toEqual([
      { id: 'g1', title: 'Group g1', position: { x: 10, y: 20 }, width: 400, height: 300 },
    ]);
    expect(meta.nodes).toEqual([
      { serviceId: 's1', position: { x: 5, y: 6 }, groupId: 'g1' },
      { serviceId: 's2', position: { x: 100, y: 200 }, groupId: undefined },
    ]);
    expect(meta.edges).toEqual([]);
    expect(meta.viewport).toEqual(viewport);
  });

  it('uses default group dimensions when style is missing', () => {
    const bare = { id: 'g2', type: 'groupNode', position: { x: 0, y: 0 }, data: { title: 'bare' } } as GroupNodeType;
    const meta = buildMetadataFromFlow([bare], { x: 0, y: 0, zoom: 1 });
    expect(meta.groups[0].width).toBe(340);
    expect(meta.groups[0].height).toBe(230);
  });
});
