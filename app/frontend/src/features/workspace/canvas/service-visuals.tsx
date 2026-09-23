import { Box, Globe, Database, Terminal, Clock } from 'lucide-react';

export function serviceTypeIcon(type: string, size = 18) {
  switch (type) {
    case 'web':
      return <Globe size={size} />;
    case 'database':
      return <Database size={size} />;
    case 'worker':
      return <Terminal size={size} />;
    case 'cron':
      return <Clock size={size} />;
    default:
      return <Box size={size} />;
  }
}

export function serviceTypeColor(type: string): string {
  switch (type) {
    case 'web':
      return '#7ab8ff';
    case 'database':
      return '#b4e34a';
    case 'worker':
      return '#f2c94c';
    case 'cron':
      return '#f2994a';
    default:
      return '#9295a4';
  }
}

export type ServiceBrandIcon = {
  slug: string;
  color: string;
};

const TECH_ICONS: (ServiceBrandIcon & { patterns: RegExp[] })[] = [
  { slug: 'postgresql', color: '#7ab8ff', patterns: [/postgres/i, /postgis/i] },
  { slug: 'redis', color: '#ff6b6b', patterns: [/redis/i, /dragonfly/i, /valkey/i, /keydb/i] },
  { slug: 'mysql', color: '#5ba4e5', patterns: [/mysql/i] },
  { slug: 'mariadb', color: '#4ea5ff', patterns: [/mariadb/i] },
  { slug: 'mongodb', color: '#47a248', patterns: [/mongo/i] },
  { slug: 'clickhouse', color: '#ffcc01', patterns: [/clickhouse/i] },
  { slug: 'couchdb', color: '#e42528', patterns: [/couchdb/i] },
  { slug: 'sqlite', color: '#69b7e4', patterns: [/sqlite/i] },
  { slug: 'influxdb', color: '#22adf6', patterns: [/influx/i] },
  { slug: 'elasticsearch', color: '#fec514', patterns: [/elastic/i, /opensearch/i] },
  { slug: 'meilisearch', color: '#ff5caa', patterns: [/meili/i] },
  { slug: 'typesense', color: '#d90368', patterns: [/typesense/i] },
  { slug: 'qdrant', color: '#dc244c', patterns: [/qdrant/i] },
  { slug: 'weaviate', color: '#01c9a7', patterns: [/weaviate/i] },
  { slug: 'minio', color: '#c72e49', patterns: [/minio/i] },
  { slug: 'rabbitmq', color: '#ff6600', patterns: [/rabbitmq/i, /rabbit/i] },
  { slug: 'apachekafka', color: '#d6dae4', patterns: [/kafka/i] },
  { slug: 'natsdotio', color: '#8be1d3', patterns: [/\bnats/i] },
  { slug: 'nginx', color: '#009639', patterns: [/nginx/i] },
  { slug: 'caddy', color: '#1f88c0', patterns: [/caddy/i] },
  { slug: 'traefikproxy', color: '#24a1c1', patterns: [/traefik/i] },
  { slug: 'nodedotjs', color: '#5fa04e', patterns: [/node(?=[:\-\d]|$)/i, /nodejs/i] },
  { slug: 'go', color: '#00add8', patterns: [/golang/i, /(?:^|[^a-z])go(?=[:\-\d]|$)/i] },
  { slug: 'python', color: '#6fa8dc', patterns: [/python/i, /\bpy(?:thon)?(?=[:\-\d]|$)/i] },
  { slug: 'rust', color: '#f74c00', patterns: [/rust/i] },
  { slug: 'php', color: '#8892bf', patterns: [/php/i] },
  { slug: 'ruby', color: '#cc342d', patterns: [/ruby/i, /rails/i] },
  { slug: 'openjdk', color: '#e6a23c', patterns: [/java/i, /openjdk/i, /jdk/i, /jre/i] },
  { slug: 'dotnet', color: '#6f4bd8', patterns: [/dotnet/i, /aspnet/i] },
  { slug: 'deno', color: '#70ffaf', patterns: [/\bdeno/i] },
  { slug: 'bun', color: '#f9f1e1', patterns: [/bun(?=[:\-\d]|$)/i] },
  { slug: 'react', color: '#61dafb', patterns: [/react/i] },
  { slug: 'vuedotjs', color: '#4fc08d', patterns: [/vue/i] },
  { slug: 'angular', color: '#dd0031', patterns: [/angular/i] },
  { slug: 'svelte', color: '#ff3e00', patterns: [/svelte/i] },
  { slug: 'nextdotjs', color: '#e6edf3', patterns: [/nextjs/i, /next\.js/i] },
  { slug: 'nuxtdotjs', color: '#00dc82', patterns: [/nuxt/i] },
  { slug: 'astro', color: '#ff5d01', patterns: [/astro/i] },
  { slug: 'prometheus', color: '#e6522c', patterns: [/prometheus/i] },
  { slug: 'grafana', color: '#f46800', patterns: [/grafana/i] },
  { slug: 'uptimekuma', color: '#5cdd8b', patterns: [/uptime.?kuma/i, /\bkuma/i] },
  { slug: 'n8n', color: '#ea4b71', patterns: [/n8n/i] },
  { slug: 'wordpress', color: '#4b9cd3', patterns: [/wordpress/i, /\bwp-/i] },
  { slug: 'ghost', color: '#a8b8c4', patterns: [/ghost/i] },
  { slug: 'nextcloud', color: '#0082c9', patterns: [/nextcloud/i] },
  { slug: 'immich', color: '#7c9ef5', patterns: [/immich/i] },
  { slug: 'supabase', color: '#3fcf8e', patterns: [/supabase/i] },
  { slug: 'pocketbase', color: '#b8dbe4', patterns: [/pocketbase/i] },
  { slug: 'keycloak', color: '#d6dae4', patterns: [/keycloak/i] },
  { slug: 'authentik', color: '#fd4b2d', patterns: [/authentik/i] },
  { slug: 'portainer', color: '#13bef9', patterns: [/portainer/i] },
  { slug: 'docker', color: '#2496ed', patterns: [/docker/i, /dind/i] },
  { slug: 'kubernetes', color: '#326ce5', patterns: [/kubernetes/i, /\bk8s/i] },
];

export type ServiceIconInput = { image?: string; name?: string; type?: string };

export function serviceIcon(service: ServiceIconInput): ServiceBrandIcon | null {
  const text = `${service.image ?? ''} ${service.name ?? ''}`.toLowerCase();
  for (const icon of TECH_ICONS) {
    if (icon.patterns.some((pattern) => pattern.test(text))) {
      return icon;
    }
  }
  return null;
}

export function serviceIconUrl(icon: ServiceBrandIcon): string {
  return `https://cdn.simpleicons.org/${icon.slug}/${icon.color.replace('#', '')}`;
}

export function serviceAccent(service: ServiceIconInput): string {
  return serviceIcon(service)?.color ?? serviceTypeColor(service.type ?? 'service');
}
