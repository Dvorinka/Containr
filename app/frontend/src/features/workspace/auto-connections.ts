import type { ServiceEntity } from '@/lib/api-client';
import type { CanvasEdge } from './model';

export type ServiceVariable = {
  key: string;
  value: string;
  isSecret: boolean;
};

type LinkRecord = {
  edge: CanvasEdge;
  reasons: string[];
};

function normalizeToken(raw: string): string {
  return raw.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function slugifyServiceName(name: string): string {
  return normalizeToken(name);
}

function tokenizePlaceholders(value: string): string[] {
  if (!value || typeof value !== 'string') {
    return [];
  }

  const matches = value.match(/\{\{\s*([^{}]+?)\s*\}\}/g);
  if (!matches) {
    return [];
  }

  return matches
    .map((match) => match.replace(/\{\{|\}\}/g, '').trim())
    .map(normalizeToken)
    .filter(Boolean);
}

function candidateTokensForService(service: ServiceEntity): Set<string> {
  const slug = slugifyServiceName(service.name);
  const tokens = new Set<string>([
    slug,
    `${slug}_url`,
    `${slug}_uri`,
    `${slug}_host`,
    `${slug}_port`,
    `${slug}_database_url`,
  ]);

  if (service.type === 'database') {
    tokens.add('database_url');
    tokens.add('database_host');
    tokens.add('database_port');

    if (slug.includes('postgres') || slug.includes('pg')) {
      tokens.add('postgres');
      tokens.add('postgres_url');
      tokens.add('postgres_host');
      tokens.add('postgres_port');
      tokens.add('db_url');
      tokens.add('db_host');
      tokens.add('db_port');
    }

    if (slug.includes('redis')) {
      tokens.add('redis');
      tokens.add('redis_url');
      tokens.add('redis_host');
      tokens.add('redis_port');
      tokens.add('cache_url');
    }

    if (slug.includes('mysql')) {
      tokens.add('mysql');
      tokens.add('mysql_url');
      tokens.add('mysql_host');
      tokens.add('mysql_port');
    }

    if (slug.includes('mongo')) {
      tokens.add('mongo');
      tokens.add('mongodb');
      tokens.add('mongodb_url');
      tokens.add('mongo_url');
    }
  }

  return tokens;
}

function buildTokenIndex(services: ServiceEntity[]): Map<string, string[]> {
  const index = new Map<string, string[]>();

  const push = (token: string, serviceId: string) => {
    const values = index.get(token);
    if (values) {
      if (!values.includes(serviceId)) {
        values.push(serviceId);
      }
      return;
    }
    index.set(token, [serviceId]);
  };

  const databaseServices = services.filter((service) => service.type === 'database');
  const primaryDatabase = databaseServices[0];

  for (const service of services) {
    for (const token of candidateTokensForService(service)) {
      push(token, service.id);
    }
  }

  if (primaryDatabase) {
    for (const genericToken of ['db', 'db_url', 'db_host', 'db_port']) {
      push(genericToken, primaryDatabase.id);
    }
  }

  return index;
}

function resolveTokenTarget(token: string, sourceService: ServiceEntity, services: ServiceEntity[], index: Map<string, string[]>): string[] {
  const exact = index.get(token) ?? [];
  const resolvedExact = exact.filter((candidate) => candidate !== sourceService.id);
  if (resolvedExact.length > 0) {
    return resolvedExact;
  }

  const potential = services
    .filter((service) => service.id !== sourceService.id)
    .filter((service) => {
      const slug = slugifyServiceName(service.name);
      return token.includes(slug) && (token.endsWith('url') || token.endsWith('uri') || token.endsWith('host') || token.endsWith('port'));
    })
    .map((service) => service.id);

  if (potential.length > 0) {
    return potential;
  }

  if (token.startsWith('db_') || token === 'database_url') {
    const dbServices = services.filter((service) => service.id !== sourceService.id && service.type === 'database');
    if (dbServices.length === 1) {
      return [dbServices[0].id];
    }
  }

  return [];
}

export function inferAutoConnections(
  services: ServiceEntity[],
  variablesByService: Record<string, ServiceVariable[]>,
): LinkRecord[] {
  if (services.length === 0) {
    return [];
  }

  const serviceMap = new Map(services.map((service) => [service.id, service]));
  const tokenIndex = buildTokenIndex(services);
  const linkMap = new Map<string, LinkRecord>();

  for (const service of services) {
    const variables = variablesByService[service.id] ?? [];

    for (const variable of variables) {
      const tokens = tokenizePlaceholders(variable.value);
      for (const token of tokens) {
        const targetIds = resolveTokenTarget(token, service, services, tokenIndex);
        for (const targetId of targetIds) {
          const targetService = serviceMap.get(targetId);
          if (!targetService || targetService.id === service.id) {
            continue;
          }

          const key = `${service.id}->${targetService.id}`;
          const existing = linkMap.get(key);
          const reason = `${variable.key}:{{${token}}}`;

          if (existing) {
            if (!existing.reasons.includes(reason)) {
              existing.reasons.push(reason);
            }
            continue;
          }

          linkMap.set(key, {
            edge: {
              id: `auto-${service.id}-${targetService.id}`,
              sourceServiceId: service.id,
              targetServiceId: targetService.id,
            },
            reasons: [reason],
          });
        }
      }
    }
  }

  return Array.from(linkMap.values());
}
