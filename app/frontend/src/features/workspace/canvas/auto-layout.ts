import type { ServiceEntity } from '@/lib/api-client';
import type { ServiceVariable } from '../auto-connections';
import { inferAutoConnections } from '../auto-connections';

export const NODE_WIDTH = 240;
export const NODE_HEIGHT = 104;
// Multiples of the 26px canvas grid so laid-out nodes land on the lattice.
export const COL_GAP = 338;
export const ROW_GAP = 182;

type LinkEdge = { sourceServiceId: string; targetServiceId: string };

// Layered left-to-right layout: a service's depth is the longest chain of
// dependencies beneath it, so consumers sit left and datastores right.
// Unconnected services get their own trailing column separated by a gap.
export function computeLayeredLayout(
  services: ServiceEntity[],
  edges: LinkEdge[],
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  if (services.length === 0) {
    return positions;
  }

  const ids = new Set(services.map((service) => service.id));
  const outgoing = new Map<string, string[]>();
  const connected = new Set<string>();

  for (const edge of edges) {
    if (!ids.has(edge.sourceServiceId) || !ids.has(edge.targetServiceId)) {
      continue;
    }
    connected.add(edge.sourceServiceId);
    connected.add(edge.targetServiceId);
    const list = outgoing.get(edge.sourceServiceId) ?? [];
    list.push(edge.targetServiceId);
    outgoing.set(edge.sourceServiceId, list);
  }

  const depthMemo = new Map<string, number>();
  const depthOf = (id: string, trail: Set<string>): number => {
    const memoized = depthMemo.get(id);
    if (memoized !== undefined) {
      return memoized;
    }
    if (trail.has(id)) {
      return 0; // cycle guard
    }
    trail.add(id);
    let best = 0;
    for (const target of outgoing.get(id) ?? []) {
      best = Math.max(best, depthOf(target, trail) + 1);
    }
    trail.delete(id);
    depthMemo.set(id, best);
    return best;
  };

  const connectedServices = services
    .filter((service) => connected.has(service.id))
    .sort((a, b) => a.name.localeCompare(b.name));
  const looseServices = services
    .filter((service) => !connected.has(service.id))
    .sort((a, b) => a.name.localeCompare(b.name));

  const depthById = new Map(connectedServices.map((service) => [service.id, depthOf(service.id, new Set())]));
  const maxDepth = Math.max(0, ...depthById.values());

  // Column = maxDepth - depth so deeper consumers render further left.
  const columns = new Map<number, ServiceEntity[]>();
  for (const service of connectedServices) {
    const col = maxDepth - (depthById.get(service.id) ?? 0);
    const list = columns.get(col) ?? [];
    list.push(service);
    columns.set(col, list);
  }

  const connectedColCount = columns.size;
  const maxRows = Math.max(
    1,
    ...Array.from(columns.values()).map((list) => list.length),
    looseServices.length,
  );

  const gridOffset = (value: number) => Math.round(value / 26) * 26;

  for (const [col, list] of columns) {
    const offsetY = gridOffset(((maxRows - list.length) * ROW_GAP) / 2);
    list.forEach((service, row) => {
      positions.set(service.id, { x: col * COL_GAP, y: offsetY + row * ROW_GAP });
    });
  }

  looseServices.forEach((service, row) => {
    const col = connectedColCount > 0 ? connectedColCount : 0;
    const offsetY = gridOffset(((maxRows - looseServices.length) * ROW_GAP) / 2);
    positions.set(service.id, { x: col * COL_GAP, y: offsetY + row * ROW_GAP });
  });

  return positions;
}

export function layoutFromVariables(
  services: ServiceEntity[],
  variablesByService: Record<string, ServiceVariable[]>,
): Map<string, { x: number; y: number }> {
  const links = inferAutoConnections(services, variablesByService);
  return computeLayeredLayout(
    services,
    links.map((link) => link.edge),
  );
}
