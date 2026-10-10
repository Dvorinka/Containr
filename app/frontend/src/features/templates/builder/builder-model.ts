// Pure model for the visual template builder: converts between the
// template `config` JSON (version 2 service graph, or a legacy flat
// single-service config) and canvas state (nodes + positions), and
// validates the graph before save. No React, no DOM — directly testable.

export type BuilderServiceType = 'web' | 'worker' | 'cron' | 'database';

export type BuilderService = {
  key: string;
  name?: string;
  type: BuilderServiceType;
  runtime?: string;
  repo?: string;
  branch?: string;
  build_command?: string;
  start_command?: string;
  port?: number;
  health_check?: string;
  builder?: string;
  environment?: Record<string, string>;
  volumes?: { type?: string; source: string; target: string; read_only?: boolean }[];
  depends_on?: string[];
};

export type BuilderCanvas = {
  positions: Record<string, { x: number; y: number }>;
};

export type BuilderNode = {
  key: string;
  service: BuilderService;
  position: { x: number; y: number };
};

const KEY_RE = /^[a-z][a-z0-9_-]*$/;
const COL_X = 60;
const ROW_Y = 200;

function asService(raw: unknown): BuilderService | null {
  if (!raw || typeof raw !== 'object') return null;
  const s = raw as Record<string, unknown>;
  const key = typeof s.key === 'string' ? s.key : '';
  if (!key) return null;
  const type = typeof s.type === 'string' ? s.type : 'web';
  return {
    key,
    name: typeof s.name === 'string' ? s.name : undefined,
    type: (['web', 'worker', 'cron', 'database'] as const).includes(type as BuilderServiceType)
      ? (type as BuilderServiceType)
      : 'web',
    runtime: typeof s.runtime === 'string' ? s.runtime : undefined,
    repo: typeof s.repo === 'string' ? s.repo : undefined,
    branch: typeof s.branch === 'string' ? s.branch : undefined,
    build_command: typeof s.build_command === 'string' ? s.build_command : undefined,
    start_command: typeof s.start_command === 'string' ? s.start_command : undefined,
    port: typeof s.port === 'number' ? s.port : undefined,
    health_check: typeof s.health_check === 'string' ? s.health_check : undefined,
    builder: typeof s.builder === 'string' ? s.builder : undefined,
    environment:
      s.environment && typeof s.environment === 'object' && !Array.isArray(s.environment)
        ? Object.fromEntries(
            Object.entries(s.environment as Record<string, unknown>).map(([k, v]) => [k, String(v)]),
          )
        : undefined,
    volumes: Array.isArray(s.volumes)
      ? (s.volumes
          .map((v) => {
            if (!v || typeof v !== 'object') return null;
            const vol = v as Record<string, unknown>;
            if (typeof vol.target !== 'string' || !vol.target) return null;
            return {
              type: typeof vol.type === 'string' ? vol.type : undefined,
              source: typeof vol.source === 'string' ? vol.source : '',
              target: vol.target,
              read_only: typeof vol.read_only === 'boolean' ? vol.read_only : undefined,
            };
          })
          .filter((v): v is NonNullable<typeof v> => v !== null)
        )
      : undefined,
    depends_on: Array.isArray(s.depends_on)
      ? s.depends_on.filter((d): d is string => typeof d === 'string')
      : undefined,
  };
}

// Flat legacy configs ({type, runtime, port, …} with no services array)
// map to a single service node so the builder can edit them without
// losing fields the round-trip would drop.
function flatToService(config: Record<string, unknown>): BuilderService | null {
  const type = typeof config.type === 'string' ? config.type : '';
  const runtime = typeof config.runtime === 'string' ? config.runtime : '';
  if (!type && !runtime) return null;
  const svc = asService({
    key: 'app',
    type: type || 'web',
    runtime,
    port: config.port,
    health_check: config.health_check,
    build_command: config.build_command,
    start_command: config.start_command,
    environment: config.environment,
  });
  return svc;
}

// Layered auto-layout: depth = longest depends_on chain; column per
// depth, row per member. Deterministic so tests can assert positions.
export function layoutPositions(services: BuilderService[]): Record<string, { x: number; y: number }> {
  const depth = new Map<string, number>();
  const visiting = new Set<string>();
  const byKey = new Map(services.map((s) => [s.key, s]));
  const depthOf = (key: string): number => {
    const memo = depth.get(key);
    if (memo !== undefined) return memo;
    if (visiting.has(key)) return 0; // cycle guard
    visiting.add(key);
    const deps = byKey.get(key)?.depends_on ?? [];
    let d = 0;
    for (const dep of deps) {
      if (byKey.has(dep)) d = Math.max(d, depthOf(dep) + 1);
    }
    visiting.delete(key);
    depth.set(key, d);
    return d;
  };
  const rows = new Map<number, number>();
  const positions: Record<string, { x: number; y: number }> = {};
  for (const svc of services) {
    const d = depthOf(svc.key);
    const row = rows.get(d) ?? 0;
    rows.set(d, row + 1);
    positions[svc.key] = { x: COL_X + d * 300, y: 40 + row * ROW_Y };
  }
  return positions;
}

export function canvasFromConfig(config: Record<string, unknown>): BuilderNode[] {
  const canvas = (config.canvas ?? {}) as Partial<BuilderCanvas>;
  const saved = canvas.positions ?? {};
  const rawServices = Array.isArray(config.services) ? config.services : null;
  const services = rawServices
    ? rawServices.map(asService).filter((s): s is BuilderService => s !== null)
    : [];
  if (services.length === 0) {
    const flat = flatToService(config);
    if (flat) services.push(flat);
  }
  const auto = layoutPositions(services);
  return services.map((service) => ({
    key: service.key,
    service,
    position: saved[service.key] ?? auto[service.key] ?? { x: COL_X, y: 40 },
  }));
}

export function configFromCanvas(
  nodes: BuilderNode[],
  rest: Record<string, unknown>,
): Record<string, unknown> {
  const services = nodes.map((node) => {
    const svc = node.service;
    const out: Record<string, unknown> = { key: svc.key, type: svc.type };
    if (svc.name) out.name = svc.name;
    if (svc.runtime) out.runtime = svc.runtime;
    if (svc.repo) out.repo = svc.repo;
    if (svc.branch) out.branch = svc.branch;
    if (svc.build_command) out.build_command = svc.build_command;
    if (svc.builder) out.builder = svc.builder;
    if (svc.start_command) out.start_command = svc.start_command;
    if (svc.port) out.port = svc.port;
    if (svc.health_check) out.health_check = svc.health_check;
    if (svc.environment && Object.keys(svc.environment).length > 0) out.environment = svc.environment;
    if (svc.volumes && svc.volumes.length > 0) out.volumes = svc.volumes;
    if (svc.depends_on && svc.depends_on.length > 0) out.depends_on = svc.depends_on;
    return out;
  });
  const positions: Record<string, { x: number; y: number }> = {};
  for (const node of nodes) positions[node.key] = node.position;
  const restConfig = { ...rest };
  // Flat (v1) fields and stale graph keys are dropped — the graph wins.
  for (const k of ['type', 'runtime', 'build_command', 'start_command', 'port', 'health_check', 'environment', 'dockerfile', 'nixpacks_config', 'services', 'canvas']) {
    delete restConfig[k];
  }
  return {
    version: 2,
    ...restConfig,
    services,
    canvas: { positions },
  };
}

export function validateGraph(nodes: BuilderNode[]): string[] {
  const errors: string[] = [];
  const keys = new Set<string>();
  for (const node of nodes) {
    if (!KEY_RE.test(node.service.key)) {
      errors.push(`"${node.service.key || '(empty)'}" is not a valid key (lowercase, digits, - or _)`);
    }
    if (keys.has(node.service.key)) errors.push(`duplicate key "${node.service.key}"`);
    keys.add(node.service.key);
    if (node.service.type === 'database' && !node.service.runtime) {
      errors.push(`"${node.service.key}" is a database with no engine selected`);
    }
    if (node.service.type !== 'database' && !node.service.runtime && !node.service.repo) {
      errors.push(`"${node.service.key}" needs an image (runtime) or a git repo`);
    }
  }
  for (const node of nodes) {
    for (const dep of node.service.depends_on ?? []) {
      if (dep === node.service.key) errors.push(`"${dep}" depends on itself`);
      else if (!keys.has(dep)) errors.push(`"${node.service.key}" depends on unknown service "${dep}"`);
    }
  }
  // Cycle detection — a cycle makes topo sort fail at deploy time.
  const state = new Map<string, 0 | 1 | 2>();
  const byKey = new Map(nodes.map((n) => [n.service.key, n]));
  const visit = (key: string, trail: string[]): void => {
    const s = state.get(key) ?? 0;
    if (s === 2) return;
    if (s === 1) {
      errors.push(`dependency cycle: ${[...trail, key].join(' → ')}`);
      return;
    }
    state.set(key, 1);
    for (const dep of byKey.get(key)?.service.depends_on ?? []) {
      if (byKey.has(dep)) visit(dep, [...trail, key]);
    }
    state.set(key, 2);
  };
  for (const node of nodes) visit(node.service.key, []);
  return errors;
}

export function newServiceKey(type: BuilderServiceType, existing: Set<string>): string {
  const base = type === 'database' ? 'db' : type;
  if (!existing.has(base)) return base;
  let i = 2;
  while (existing.has(`${base}${i}`)) i += 1;
  return `${base}${i}`;
}
