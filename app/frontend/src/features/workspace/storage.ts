import type { ServiceEntity } from '@/lib/api-client';
import {
  createDefaultCanvasMetadata,
  DEFAULT_VIEWPORT,
  type CanvasEdge,
  type CanvasGroup,
  type CanvasNodeLayout,
  type ProjectCanvasMetadata,
} from './model';

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function parsePoint(value: unknown): { x: number; y: number } | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  if (!isFiniteNumber(candidate.x) || !isFiniteNumber(candidate.y)) {
    return null;
  }

  return { x: candidate.x, y: candidate.y };
}

function parseGroups(raw: unknown): CanvasGroup[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .map((entry) => {
      if (!entry || typeof entry !== 'object') {
        return null;
      }
      const group = entry as Record<string, unknown>;
      const point = parsePoint(group.position);
      if (!point || typeof group.id !== 'string' || typeof group.title !== 'string') {
        return null;
      }

      const width = isFiniteNumber(group.width) ? group.width : 320;
      const height = isFiniteNumber(group.height) ? group.height : 220;

      return {
        id: group.id,
        title: group.title,
        width,
        height,
        position: point,
      } satisfies CanvasGroup;
    })
    .filter((entry): entry is CanvasGroup => entry !== null);
}

function parseNodes(raw: unknown): CanvasNodeLayout[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const parsed: CanvasNodeLayout[] = [];

  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') {
      continue;
    }
    const node = entry as Record<string, unknown>;
    const point = parsePoint(node.position);
    if (!point || typeof node.serviceId !== 'string') {
      continue;
    }

    const normalized: CanvasNodeLayout = {
      serviceId: node.serviceId,
      position: point,
    };

    if (typeof node.groupId === 'string') {
      normalized.groupId = node.groupId;
    }

    parsed.push(normalized);
  }

  return parsed;
}

function parseEdges(raw: unknown): CanvasEdge[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .map((entry) => {
      if (!entry || typeof entry !== 'object') {
        return null;
      }
      const edge = entry as Record<string, unknown>;
      if (
        typeof edge.id !== 'string' ||
        typeof edge.sourceServiceId !== 'string' ||
        typeof edge.targetServiceId !== 'string'
      ) {
        return null;
      }

      return {
        id: edge.id,
        sourceServiceId: edge.sourceServiceId,
        targetServiceId: edge.targetServiceId,
      } satisfies CanvasEdge;
    })
    .filter((entry): entry is CanvasEdge => entry !== null);
}

function parseViewport(raw: unknown): ProjectCanvasMetadata['viewport'] {
  if (!raw || typeof raw !== 'object') {
    return DEFAULT_VIEWPORT;
  }

  const viewport = raw as Record<string, unknown>;
  if (!isFiniteNumber(viewport.x) || !isFiniteNumber(viewport.y) || !isFiniteNumber(viewport.zoom)) {
    return DEFAULT_VIEWPORT;
  }

  return {
    x: viewport.x,
    y: viewport.y,
    zoom: viewport.zoom,
  };
}

function parseRawCanvasMetadata(raw: unknown): ProjectCanvasMetadata | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const source = raw as Record<string, unknown>;

  return {
    groups: parseGroups(source.groups),
    nodes: parseNodes(source.nodes),
    edges: parseEdges(source.edges),
    viewport: parseViewport(source.viewport),
  };
}

export function canvasStorageKey(projectId: string): string {
  return `containr.canvas.v1.${projectId}`;
}

export function clearCanvasMetadata(projectId: string): void {
  localStorage.removeItem(canvasStorageKey(projectId));
}

export function saveCanvasMetadata(projectId: string, metadata: ProjectCanvasMetadata): void {
  localStorage.setItem(canvasStorageKey(projectId), JSON.stringify(metadata));
}

export function loadCanvasMetadata(projectId: string, services: ServiceEntity[]): ProjectCanvasMetadata {
  const key = canvasStorageKey(projectId);
  const fallback = createDefaultCanvasMetadata(services);
  const serviceIds = new Set(services.map((service) => service.id));

  const raw = localStorage.getItem(key);
  if (!raw) {
    saveCanvasMetadata(projectId, fallback);
    return fallback;
  }

  try {
    const parsed = parseRawCanvasMetadata(JSON.parse(raw));
    if (!parsed) {
      saveCanvasMetadata(projectId, fallback);
      return fallback;
    }

    const validGroups = parsed.groups;
    const groupIds = new Set(validGroups.map((group) => group.id));

    const nodeMap = new Map(parsed.nodes.map((node) => [node.serviceId, node]));
    const normalizedNodes: CanvasNodeLayout[] = [];

    for (const [index, service] of services.entries()) {
      const existing = nodeMap.get(service.id);
      if (existing) {
        normalizedNodes.push({
          serviceId: existing.serviceId,
          position: existing.position,
          groupId: existing.groupId && groupIds.has(existing.groupId) ? existing.groupId : undefined,
        });
        continue;
      }

      const col = index % 3;
      const row = Math.floor(index / 3);
      normalizedNodes.push({
        serviceId: service.id,
        position: {
          x: 70 + col * 260,
          y: 80 + row * 170,
        },
      });
    }

    const seenEdgeIds = new Set<string>();
    const normalizedEdges = parsed.edges.filter((edge) => {
      if (
        !serviceIds.has(edge.sourceServiceId) ||
        !serviceIds.has(edge.targetServiceId) ||
        edge.sourceServiceId === edge.targetServiceId ||
        seenEdgeIds.has(edge.id)
      ) {
        return false;
      }

      seenEdgeIds.add(edge.id);
      return true;
    });

    const normalized: ProjectCanvasMetadata = {
      groups: validGroups,
      nodes: normalizedNodes,
      edges: normalizedEdges,
      viewport: parseViewport(parsed.viewport),
    };

    saveCanvasMetadata(projectId, normalized);
    return normalized;
  } catch {
    saveCanvasMetadata(projectId, fallback);
    return fallback;
  }
}
