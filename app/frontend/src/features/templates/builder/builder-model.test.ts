import { describe, expect, it } from 'vitest';
import {
  canvasFromConfig,
  configFromCanvas,
  layoutPositions,
  newServiceKey,
  validateGraph,
  type BuilderNode,
} from './builder-model';

const plausibleConfig = {
  version: 2,
  services: [
    { key: 'db', type: 'database', runtime: 'postgresql', environment: { POSTGRES_DB: 'plausible' } },
    { key: 'events', type: 'database', runtime: 'clickhouse' },
    {
      key: 'web',
      name: 'plausible',
      type: 'web',
      runtime: 'ghcr.io/plausible/community-edition:v2',
      port: 8000,
      health_check: '/api/health',
      depends_on: ['db', 'events'],
      environment: { DATABASE_URL: '{{service.db.url}}' },
    },
  ],
};

describe('canvasFromConfig', () => {
  it('parses graph services into nodes with auto-layout', () => {
    const nodes = canvasFromConfig(plausibleConfig);
    expect(nodes.map((n) => n.key)).toEqual(['db', 'events', 'web']);
    // databases are roots (depth 0), web depends on both (depth 1)
    expect(nodes[0].position.x).toBeLessThan(nodes[2].position.x);
    expect(nodes[1].position.y).toBeGreaterThan(nodes[0].position.y);
  });

  it('restores saved canvas positions', () => {
    const nodes = canvasFromConfig({
      ...plausibleConfig,
      canvas: { positions: { db: { x: 500, y: 500 } } },
    });
    expect(nodes[0].position).toEqual({ x: 500, y: 500 });
  });

  it('migrates flat legacy configs to a single node', () => {
    const nodes = canvasFromConfig({
      type: 'web',
      runtime: 'nginx:latest',
      port: 80,
      environment: { FOO: 'bar' },
    });
    expect(nodes).toHaveLength(1);
    expect(nodes[0].service).toMatchObject({ key: 'app', type: 'web', runtime: 'nginx:latest', port: 80 });
  });

  it('drops entries without a key', () => {
    const nodes = canvasFromConfig({ version: 2, services: [{ type: 'web', runtime: 'x' }, { key: 'ok', type: 'web', runtime: 'y' }] });
    expect(nodes.map((n) => n.key)).toEqual(['ok']);
  });
});

describe('configFromCanvas', () => {
  it('round-trips a graph config', () => {
    const nodes = canvasFromConfig(plausibleConfig);
    const config = configFromCanvas(nodes, plausibleConfig);
    const services = config.services as Record<string, unknown>[];
    expect(config.version).toBe(2);
    expect(services).toHaveLength(3);
    const web = services.find((s) => s.key === 'web')!;
    expect(web.depends_on).toEqual(['db', 'events']);
    expect(web.port).toBe(8000);
    expect((web.environment as Record<string, string>).DATABASE_URL).toBe('{{service.db.url}}');
  });

  it('persists node positions under config.canvas', () => {
    const nodes = canvasFromConfig(plausibleConfig);
    nodes[0].position = { x: 321, y: 123 };
    const config = configFromCanvas(nodes, {});
    expect((config.canvas as { positions: Record<string, { x: number; y: number }> }).positions.db).toEqual({ x: 321, y: 123 });
    // and parses back to the same spot
    expect(canvasFromConfig(config)[0].position).toEqual({ x: 321, y: 123 });
  });

  it('strips flat fields when converting a legacy config', () => {
    const nodes = canvasFromConfig({ type: 'web', runtime: 'nginx:latest', port: 80 });
    const config = configFromCanvas(nodes, { type: 'web', runtime: 'nginx:latest', port: 80 });
    expect(config.type).toBeUndefined();
    expect(config.runtime).toBeUndefined();
    expect((config.services as unknown[]).length).toBe(1);
  });
});

describe('layoutPositions', () => {
  it('depths follow the depends_on chain', () => {
    const pos = layoutPositions([
      { key: 'a', type: 'database', runtime: 'postgresql' },
      { key: 'b', type: 'web', runtime: 'img', depends_on: ['a'] },
      { key: 'c', type: 'web', runtime: 'img', depends_on: ['b'] },
    ]);
    expect(pos.a.x).toBeLessThan(pos.b.x);
    expect(pos.b.x).toBeLessThan(pos.c.x);
  });

  it('a dependency cycle does not hang', () => {
    const pos = layoutPositions([
      { key: 'a', type: 'web', runtime: 'x', depends_on: ['b'] },
      { key: 'b', type: 'web', runtime: 'x', depends_on: ['a'] },
    ]);
    expect(pos.a).toBeDefined();
    expect(pos.b).toBeDefined();
  });
});

describe('validateGraph', () => {
  const node = (key: string, extra: Partial<BuilderNode['service']> = {}): BuilderNode => ({
    key,
    position: { x: 0, y: 0 },
    service: { key, type: 'web', runtime: 'img:1', ...extra },
  });

  it('accepts a valid graph', () => {
    expect(validateGraph([node('db', { type: 'database', runtime: 'postgresql' }), node('web', { depends_on: ['db'] })])).toEqual([]);
  });

  it('rejects duplicate keys', () => {
    expect(validateGraph([node('a'), node('a')])).toContain('duplicate key "a"');
  });

  it('rejects bad keys and self-deps', () => {
    const errs = validateGraph([node('BAD KEY'), node('x', { depends_on: ['x'] })]);
    expect(errs.some((e) => e.includes('not a valid key'))).toBe(true);
    expect(errs).toContain('"x" depends on itself');
  });

  it('rejects deps on missing services', () => {
    expect(validateGraph([node('web', { depends_on: ['ghost'] })])).toContain(
      '"web" depends on unknown service "ghost"',
    );
  });

  it('rejects database without engine and web without source', () => {
    const errs = validateGraph([node('db', { type: 'database', runtime: undefined }), node('web', { runtime: undefined })]);
    expect(errs).toContain('"db" is a database with no engine selected');
    expect(errs).toContain('"web" needs an image (runtime) or a git repo');
  });

  it('reports dependency cycles', () => {
    const errs = validateGraph([node('a', { depends_on: ['b'] }), node('b', { depends_on: ['a'] })]);
    expect(errs.some((e) => e.startsWith('dependency cycle'))).toBe(true);
  });
});

describe('newServiceKey', () => {
  it('picks unused keys', () => {
    expect(newServiceKey('database', new Set())).toBe('db');
    expect(newServiceKey('database', new Set(['db']))).toBe('db2');
    expect(newServiceKey('web', new Set(['web', 'web2']))).toBe('web3');
  });
});
