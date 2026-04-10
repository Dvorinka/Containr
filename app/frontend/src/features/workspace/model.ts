import type { ServiceEntity } from '@/lib/api-client';

export type CanvasPoint = {
  x: number;
  y: number;
};

export type CanvasGroup = {
  id: string;
  title: string;
  position: CanvasPoint;
  width: number;
  height: number;
};

export type CanvasNodeLayout = {
  serviceId: string;
  position: CanvasPoint;
  groupId?: string;
};

export type CanvasEdge = {
  id: string;
  sourceServiceId: string;
  targetServiceId: string;
};

export type CanvasViewport = {
  x: number;
  y: number;
  zoom: number;
};

export type ProjectCanvasMetadata = {
  groups: CanvasGroup[];
  nodes: CanvasNodeLayout[];
  edges: CanvasEdge[];
  viewport: CanvasViewport;
};

export const DEFAULT_VIEWPORT: CanvasViewport = {
  x: 0,
  y: 0,
  zoom: 1,
};

export function createDefaultCanvasMetadata(services: ServiceEntity[]): ProjectCanvasMetadata {
  const nodes = services.map((service, index) => {
    const col = index % 3;
    const row = Math.floor(index / 3);

    return {
      serviceId: service.id,
      position: {
        x: 70 + col * 260,
        y: 80 + row * 170,
      },
    };
  });

  return {
    groups: [],
    nodes,
    edges: [],
    viewport: DEFAULT_VIEWPORT,
  };
}
