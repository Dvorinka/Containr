import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  deployTemplate,
  getTemplateById,
  listProjects,
  listTemplates,
  type TemplateDetailEntity,
  type TemplateEntity,
} from '@/lib/api-client';
import {
  Search,
  Filter,
  Check,
  Loader2,
  Sparkles,
  Box,
  Code,
  Database,
  Globe,
  Layers,
  Terminal,
  Play,
  ArrowRight,
  Star,
} from 'lucide-react';

const demoTemplates: TemplateEntity[] = [
  {
    id: 'tpl-react',
    name: 'React Application',
    description: 'Single-page frontend with Vite and static serving runtime.',
    category: 'frontend',
    logo: 'https://cdn.simpleicons.org/react',
    configRaw: '{"runtime":"node"}',
    variablesRaw: '[]',
    isOfficial: true,
  },
  {
    id: 'tpl-go',
    name: 'Go API Service',
    description: 'API-ready Go runtime with direct binary startup.',
    category: 'web',
    logo: 'https://cdn.simpleicons.org/go',
    configRaw: '{"runtime":"go"}',
    variablesRaw: '[]',
    isOfficial: true,
  },
  {
    id: 'tpl-postgres',
    name: 'PostgreSQL Database',
    description: 'Managed PostgreSQL service with credential setup variables.',
    category: 'database',
    logo: 'https://cdn.simpleicons.org/postgresql',
    configRaw: '{"runtime":"postgres"}',
    variablesRaw: '[]',
    isOfficial: true,
  },
  {
    id: 'tpl-mysql',
    name: 'MySQL Database',
    description: 'Managed MySQL service for transactional workloads.',
    category: 'database',
    logo: 'https://cdn.simpleicons.org/mysql',
    configRaw: '{"runtime":"mysql"}',
    variablesRaw: '[]',
    isOfficial: true,
  },
  {
    id: 'tpl-mariadb',
    name: 'MariaDB Database',
    description: 'Managed MariaDB service with MySQL compatibility.',
    category: 'database',
    logo: 'https://cdn.simpleicons.org/mariadb',
    configRaw: '{"runtime":"mariadb"}',
    variablesRaw: '[]',
    isOfficial: true,
  },
  {
    id: 'tpl-clickhouse',
    name: 'ClickHouse Database',
    description: 'Columnar analytics database template for high-speed queries.',
    category: 'database',
    logo: 'https://cdn.simpleicons.org/clickhouse',
    configRaw: '{"runtime":"clickhouse"}',
    variablesRaw: '[]',
    isOfficial: true,
  },
  {
    id: 'tpl-dragonfly',
    name: 'Dragonfly Database',
    description: 'Redis-compatible in-memory store powered by Dragonfly.',
    category: 'database',
    logo: 'https://cdn.simpleicons.org/redis',
    configRaw: '{"runtime":"dragonfly"}',
    variablesRaw: '[]',
    isOfficial: true,
  },
];

const demoTemplateDetails: Record<string, TemplateDetailEntity> = {
  'tpl-react': {
    template: demoTemplates[0],
    config: {
      type: 'web',
      runtime: 'node',
      buildCommand: 'npm install && npm run build',
      startCommand: 'npx serve -s dist',
      port: 3000,
      healthCheck: '/health',
      environment: {},
      nixpacksConfig: {},
    },
    variables: [
      {
        key: 'VITE_API_URL',
        label: 'API URL',
        defaultValue: 'https://api.example.com',
        required: true,
        secret: false,
        description: 'Public API endpoint for frontend calls',
      },
    ],
  },
  'tpl-go': {
    template: demoTemplates[1],
    config: {
      type: 'web',
      runtime: 'go',
      buildCommand: 'go build -o app .',
      startCommand: './app',
      port: 8080,
      healthCheck: '/health',
      environment: {},
      nixpacksConfig: {},
    },
    variables: [
      {
        key: 'GO_ENV',
        label: 'Go Environment',
        defaultValue: 'production',
        required: false,
        secret: false,
        description: 'Runtime environment value',
      },
    ],
  },
  'tpl-postgres': {
    template: demoTemplates[2],
    config: {
      type: 'database',
      runtime: 'postgres',
      buildCommand: '',
      startCommand: '',
      port: 5432,
      healthCheck: '',
      environment: {},
      nixpacksConfig: {},
    },
    variables: [
      {
        key: 'POSTGRES_USER',
        label: 'Username',
        defaultValue: 'postgres',
        required: true,
        secret: false,
        description: 'Database user',
      },
      {
        key: 'POSTGRES_PASSWORD',
        label: 'Password',
        defaultValue: '',
        required: true,
        secret: true,
        description: 'Database password',
      },
    ],
  },
  'tpl-mysql': {
    template: demoTemplates[3],
    config: {
      type: 'database',
      runtime: 'mysql',
      buildCommand: '',
      startCommand: '',
      port: 3306,
      healthCheck: '',
      environment: {},
      nixpacksConfig: {},
    },
    variables: [
      {
        key: 'MYSQL_DATABASE',
        label: 'Database Name',
        defaultValue: 'app',
        required: true,
        secret: false,
        description: 'Initial database to create',
      },
      {
        key: 'MYSQL_USER',
        label: 'Username',
        defaultValue: 'app',
        required: true,
        secret: false,
        description: 'Application DB user',
      },
      {
        key: 'MYSQL_PASSWORD',
        label: 'User Password',
        defaultValue: '',
        required: true,
        secret: true,
        description: 'Application DB password',
      },
      {
        key: 'MYSQL_ROOT_PASSWORD',
        label: 'Root Password',
        defaultValue: '',
        required: true,
        secret: true,
        description: 'Root account password',
      },
    ],
  },
  'tpl-mariadb': {
    template: demoTemplates[4],
    config: {
      type: 'database',
      runtime: 'mariadb',
      buildCommand: '',
      startCommand: '',
      port: 3306,
      healthCheck: '',
      environment: {},
      nixpacksConfig: {},
    },
    variables: [
      {
        key: 'MARIADB_DATABASE',
        label: 'Database Name',
        defaultValue: 'app',
        required: true,
        secret: false,
        description: 'Initial database to create',
      },
      {
        key: 'MARIADB_USER',
        label: 'Username',
        defaultValue: 'app',
        required: true,
        secret: false,
        description: 'Application DB user',
      },
      {
        key: 'MARIADB_PASSWORD',
        label: 'User Password',
        defaultValue: '',
        required: true,
        secret: true,
        description: 'Application DB password',
      },
      {
        key: 'MARIADB_ROOT_PASSWORD',
        label: 'Root Password',
        defaultValue: '',
        required: true,
        secret: true,
        description: 'Root account password',
      },
    ],
  },
  'tpl-clickhouse': {
    template: demoTemplates[5],
    config: {
      type: 'database',
      runtime: 'clickhouse',
      buildCommand: '',
      startCommand: '',
      port: 8123,
      healthCheck: '',
      environment: {},
      nixpacksConfig: {},
    },
    variables: [
      {
        key: 'CLICKHOUSE_DB',
        label: 'Database Name',
        defaultValue: 'app',
        required: false,
        secret: false,
        description: 'Default database name',
      },
      {
        key: 'CLICKHOUSE_USER',
        label: 'Username',
        defaultValue: 'default',
        required: false,
        secret: false,
        description: 'ClickHouse user',
      },
      {
        key: 'CLICKHOUSE_PASSWORD',
        label: 'Password',
        defaultValue: '',
        required: false,
        secret: true,
        description: 'ClickHouse password',
      },
    ],
  },
  'tpl-dragonfly': {
    template: demoTemplates[6],
    config: {
      type: 'database',
      runtime: 'dragonfly',
      buildCommand: '',
      startCommand: '',
      port: 6379,
      healthCheck: '',
      environment: {},
      nixpacksConfig: {},
    },
    variables: [
      {
        key: 'DRAGONFLY_PASSWORD',
        label: 'Password',
        defaultValue: '',
        required: false,
        secret: true,
        description: 'Optional Redis-compatible password',
      },
    ],
  },
};

const demoProjects = [
  { id: 'project-demo', name: 'Demo Project' },
  { id: 'project-internal', name: 'Internal Tooling' },
];

function toServiceName(value: string): string {
  const normalized = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized || 'service';
}

function categoryLabel(category: string): string {
  return category ? category[0].toUpperCase() + category.slice(1) : 'Uncategorized';
}

function categoryIcon(category: string): typeof Box {
  switch (category) {
    case 'frontend':
      return Globe;
    case 'web':
      return Code;
    case 'database':
      return Database;
    case 'backend':
      return Terminal;
    default:
      return Box;
  }
}

export function TemplatesPage() {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const isDemoMode = searchParams.get('demo') === '1';

  const [categoryFilter, setCategoryFilter] = useState('');
  const [searchFilter, setSearchFilter] = useState('');
  const [selectedTemplateIdState, setSelectedTemplateId] = useState<string | null>(null);
  const [deployProjectIdState, setDeployProjectId] = useState('');
  const [deployNameByTemplate, setDeployNameByTemplate] = useState<Record<string, string>>({});
  const [variableValuesByTemplate, setVariableValuesByTemplate] = useState<
    Record<string, Record<string, string>>
  >({});
  const [lastDeployment, setLastDeployment] = useState<{
    projectId: string;
    serviceId: string;
    serviceName: string;
  } | null>(null);

  const templatesQuery = useQuery({
    queryKey: ['templates-page', categoryFilter],
    enabled: !isDemoMode,
    queryFn: () => listTemplates({ category: categoryFilter || undefined }),
  });

  const projectsQuery = useQuery({
    queryKey: ['template-projects'],
    enabled: !isDemoMode,
    queryFn: listProjects,
  });

  const templates = useMemo(
    () => (isDemoMode ? demoTemplates : templatesQuery.data ?? []),
    [isDemoMode, templatesQuery.data],
  );

  const filteredTemplates = useMemo(() => {
    const query = searchFilter.trim().toLowerCase();
    if (!query) {
      return templates;
    }

    return templates.filter(
      (template) =>
        template.name.toLowerCase().includes(query) ||
        template.description.toLowerCase().includes(query) ||
        template.category.toLowerCase().includes(query),
    );
  }, [searchFilter, templates]);

  const categoryOptions = useMemo(() => {
    const values = new Set<string>();
    for (const template of templates) {
      if (template.category) {
        values.add(template.category);
      }
    }

    return Array.from(values).sort((left, right) => left.localeCompare(right));
  }, [templates]);

  const selectedTemplateId = useMemo(() => {
    if (filteredTemplates.length === 0) {
      return null;
    }
    if (selectedTemplateIdState && filteredTemplates.some((template) => template.id === selectedTemplateIdState)) {
      return selectedTemplateIdState;
    }
    return filteredTemplates[0].id;
  }, [filteredTemplates, selectedTemplateIdState]);

  const templateDetailQuery = useQuery({
    queryKey: ['template-detail-page', selectedTemplateId],
    enabled: !isDemoMode && Boolean(selectedTemplateId),
    queryFn: () => getTemplateById(selectedTemplateId!),
  });

  const selectedDetail = isDemoMode
    ? selectedTemplateId
      ? demoTemplateDetails[selectedTemplateId] ?? null
      : null
    : templateDetailQuery.data ?? null;

  const projectOptions = useMemo(
    () =>
      isDemoMode
        ? demoProjects
        : (projectsQuery.data ?? []).map((project) => ({
            id: project.id,
            name: project.name,
          })),
    [isDemoMode, projectsQuery.data],
  );

  const deployProjectId = useMemo(() => {
    if (projectOptions.length === 0) {
      return '';
    }
    if (projectOptions.some((project) => project.id === deployProjectIdState)) {
      return deployProjectIdState;
    }
    return projectOptions[0].id;
  }, [deployProjectIdState, projectOptions]);

  const variableDefaults = useMemo(() => {
    if (!selectedDetail) {
      return {} as Record<string, string>;
    }

    const defaults: Record<string, string> = {};
    for (const variable of selectedDetail.variables) {
      defaults[variable.key] = variable.defaultValue;
    }
    return defaults;
  }, [selectedDetail]);

  const deployName = useMemo(() => {
    if (!selectedTemplateId || !selectedDetail) {
      return '';
    }
    return deployNameByTemplate[selectedTemplateId] ?? toServiceName(selectedDetail.template.name);
  }, [deployNameByTemplate, selectedDetail, selectedTemplateId]);

  const variableValues = useMemo(() => {
    if (!selectedTemplateId) {
      return variableDefaults;
    }
    return {
      ...variableDefaults,
      ...(variableValuesByTemplate[selectedTemplateId] ?? {}),
    };
  }, [selectedTemplateId, variableDefaults, variableValuesByTemplate]);

  const missingRequiredVariables = useMemo(() => {
    if (!selectedDetail) {
      return [];
    }

    return selectedDetail.variables.filter((variable) => {
      if (!variable.required) {
        return false;
      }

      return !(variableValues[variable.key] ?? '').trim();
    });
  }, [selectedDetail, variableValues]);

  const deployMutation = useMutation({
    mutationFn: async () => {
      if (!selectedTemplateId) {
        throw new Error('No template selected');
      }

      const variables: Record<string, string> = {};
      for (const [key, value] of Object.entries(variableValues)) {
        if (value.trim()) {
          variables[key] = value.trim();
        }
      }

      return deployTemplate(selectedTemplateId, {
        projectId: deployProjectId,
        name: deployName.trim(),
        variables,
      });
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['project-services'] });
      setLastDeployment({
        projectId: deployProjectId,
        serviceId: result.serviceId,
        serviceName: deployName.trim(),
      });
    },
  });

  const isDeployDisabled =
    !selectedTemplateId ||
    !deployProjectId ||
    deployName.trim().length === 0 ||
    missingRequiredVariables.length > 0 ||
    deployMutation.isPending;

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="border-b border-[var(--border-subtle)] bg-[var(--bg-base)]/50 backdrop-blur-sm">
        <div className="mx-auto w-full max-w-[1400px] px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-xl font-semibold text-[var(--text-primary)]">Template Catalog</h1>
              <p className="text-sm text-[var(--text-secondary)]">Deploy services from pre-configured templates</p>
            </div>
            <div className="flex items-center gap-2 text-sm text-[var(--text-tertiary)]">
              <Layers size={16} />
              <span>{filteredTemplates.length} templates</span>
            </div>
          </div>
        </div>
      </div>

      {/* Demo Mode Banner */}
      {isDemoMode && (
        <div className="mx-auto w-full max-w-[1400px] px-6 py-4">
          <div className="px-4 py-3 rounded-[var(--radius-md)] border border-[var(--warning-soft)] bg-[var(--warning-soft)]/50">
            <div className="flex items-center gap-2 text-sm text-[var(--warning)]">
              <Sparkles size={16} />
              <span>Demo mode active — using sample data</span>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="mx-auto w-full max-w-[1400px] px-6 py-6">
        <div className="grid grid-cols-1 xl:grid-cols-[380px_1fr] gap-6">
          {/* Template List */}
          <section className="panel overflow-hidden">
            <div className="p-4 border-b border-[var(--border-subtle)]">
              <div className="flex items-center gap-2 mb-4">
                <Filter size={16} className="text-[var(--text-tertiary)]" />
                <span className="text-sm font-medium text-[var(--text-secondary)]">Filters</span>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium uppercase tracking-wider text-[var(--text-muted)] mb-2">
                    Category
                  </label>
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="w-full h-10 px-3 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] text-sm focus:border-[var(--accent-primary)] transition-colors"
                  >
                    <option value="">All categories</option>
                    {categoryOptions.map((option) => (
                      <option key={option} value={option}>{categoryLabel(option)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium uppercase tracking-wider text-[var(--text-muted)] mb-2">
                    Search
                  </label>
                  <div className="relative">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
                    <input
                      value={searchFilter}
                      onChange={(e) => setSearchFilter(e.target.value)}
                      className="w-full h-10 pl-10 pr-3 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] text-sm focus:border-[var(--accent-primary)] transition-colors"
                      placeholder="Search templates..."
                    />
                  </div>
                </div>
              </div>
            </div>

            {!isDemoMode && templatesQuery.isLoading ? (
              <div className="p-12 text-center">
                <Loader2 size={24} className="animate-spin mx-auto text-[var(--text-tertiary)]" />
                <p className="mt-3 text-sm text-[var(--text-muted)]">Loading templates...</p>
              </div>
            ) : null}

            {!isDemoMode && templatesQuery.isError ? (
              <div className="p-8 text-center">
                <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-[var(--error-soft)] flex items-center justify-center">
                  <Box size={24} className="text-[var(--error)]" />
                </div>
                <p className="text-sm text-[var(--error)]">Failed to load templates</p>
              </div>
            ) : null}

            {filteredTemplates.length === 0 && !templatesQuery.isLoading ? (
              <div className="p-12 text-center">
                <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-[var(--surface-muted)] flex items-center justify-center">
                  <Search size={24} className="text-[var(--text-tertiary)]" />
                </div>
                <p className="text-sm text-[var(--text-muted)]">No templates match filters</p>
              </div>
            ) : null}

            {filteredTemplates.length > 0 ? (
              <div className="max-h-[600px] overflow-auto p-3">
                <div className="grid grid-cols-1 gap-2">
                  {filteredTemplates.map((template) => {
                    const selected = template.id === selectedTemplateId;
                    const Icon = categoryIcon(template.category);
                    const categoryColor = template.category === 'database' ? '#9c7ef0' : template.category === 'frontend' ? '#6c8ef0' : template.category === 'web' ? '#e8316a' : '#9295a4';
                    return (
                      <button
                        key={template.id}
                        onClick={() => setSelectedTemplateId(template.id)}
                        className={`w-full p-4 rounded-[var(--radius-lg)] border text-left transition-all duration-300 group ${
                          selected
                            ? 'border-[var(--accent-primary)] bg-[var(--accent-primary-soft)] shadow-lg shadow-[var(--accent-primary-glow)]'
                            : 'border-[var(--border-subtle)] hover:border-[var(--border-default)] hover:bg-[var(--surface-muted)]/50 card-lift'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div 
                            className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-300 ${
                              selected ? 'ring-2 ring-white/20' : ''
                            }`}
                            style={{ 
                              background: selected ? categoryColor : `${categoryColor}20`,
                              color: selected ? 'white' : categoryColor
                            }}
                          >
                            <Icon size={18} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className={`text-sm font-semibold tracking-tight ${selected ? 'text-[var(--accent-primary)]' : 'text-[var(--text-primary)]'}`}>
                                {template.name}
                              </p>
                              {template.isOfficial && (
                                <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-[var(--warning-soft)] text-[var(--warning)] text-[10px] font-semibold">
                                  <Star size={8} className="fill-[var(--warning)]" />
                                  Official
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <span 
                                className="text-[10px] font-semibold uppercase tracking-wider"
                                style={{ color: categoryColor }}
                              >
                                {categoryLabel(template.category)}
                              </span>
                              <span className="text-[10px] text-[var(--text-tertiary)]">•</span>
                              <span className="text-[10px] text-[var(--text-tertiary)]">{template.configRaw ? JSON.parse(template.configRaw).runtime : 'n/a'}</span>
                            </div>
                            <p className="text-xs text-[var(--text-tertiary)] mt-2 line-clamp-2 group-hover:text-[var(--text-secondary)] transition-colors">{template.description}</p>
                          </div>
                          <ArrowRight 
                            size={14} 
                            className={`text-[var(--text-tertiary)] transition-all duration-300 ${
                              selected ? 'opacity-100 text-[var(--accent-primary)]' : 'opacity-0 group-hover:opacity-100'
                            }`}
                          />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </section>

          {/* Template Detail */}
          <section className="panel p-6">
            {!selectedTemplateId ? (
              <div className="py-16 text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--surface-muted)] flex items-center justify-center">
                  <Layers size={28} className="text-[var(--text-tertiary)]" />
                </div>
                <p className="text-sm text-[var(--text-muted)]">Select a template to view details and deploy</p>
              </div>
            ) : null}

            {selectedTemplateId && !isDemoMode && templateDetailQuery.isLoading ? (
              <div className="py-16 text-center">
                <Loader2 size={24} className="animate-spin mx-auto text-[var(--text-tertiary)]" />
                <p className="mt-3 text-sm text-[var(--text-muted)]">Loading template details...</p>
              </div>
            ) : null}

            {selectedTemplateId && !isDemoMode && templateDetailQuery.isError ? (
              <div className="py-16 text-center">
                <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-[var(--error-soft)] flex items-center justify-center">
                  <Box size={24} className="text-[var(--error)]" />
                </div>
                <p className="text-sm text-[var(--error)]">Failed to load template details</p>
              </div>
            ) : null}

            {selectedDetail ? (
              <>
                {/* Header */}
                <div className="flex items-start justify-between gap-4 mb-6">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-[var(--radius-md)] bg-[var(--accent-primary-soft)] flex items-center justify-center">
                      {(() => {
                        const Icon = categoryIcon(selectedDetail.template.category);
                        return <Icon size={24} className="text-[var(--accent-primary)]" />;
                      })()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-xl font-semibold text-[var(--text-primary)]">{selectedDetail.template.name}</h2>
                        {selectedDetail.template.isOfficial && (
                          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--warning-soft)] text-[var(--warning)] text-xs font-medium">
                            <Star size={10} className="fill-[var(--warning)]" />
                            Official
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-[var(--text-secondary)] mt-1">{selectedDetail.template.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 rounded-full border border-[var(--border-subtle)] text-xs text-[var(--text-tertiary)]">
                      {categoryLabel(selectedDetail.template.category)}
                    </span>
                    <span className="px-3 py-1 rounded-full border border-[var(--border-subtle)] text-xs text-[var(--text-tertiary)]">
                      {selectedDetail.config.runtime || 'n/a'}
                    </span>
                  </div>
                </div>

                {/* Config Grid */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                  <div className="panel-soft p-4">
                    <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">Type</p>
                    <p className="mono text-sm text-[var(--text-primary)] mt-2">{selectedDetail.config.type || '—'}</p>
                  </div>
                  <div className="panel-soft p-4">
                    <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">Port</p>
                    <p className="mono text-sm text-[var(--text-primary)] mt-2">{selectedDetail.config.port || '—'}</p>
                  </div>
                  <div className="panel-soft p-4">
                    <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">Build</p>
                    <p className="mono text-xs text-[var(--text-primary)] mt-2 truncate">{selectedDetail.config.buildCommand || '—'}</p>
                  </div>
                  <div className="panel-soft p-4">
                    <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">Start</p>
                    <p className="mono text-xs text-[var(--text-primary)] mt-2 truncate">{selectedDetail.config.startCommand || '—'}</p>
                  </div>
                </div>

                <div className="panel-soft p-4 mb-6">
                  <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)] mb-2">How Templates Work</p>
                  <p className="text-sm text-[var(--text-secondary)]">
                    Template defaults are merged with your variable inputs. Creating from template saves a stopped service in the selected project, then you deploy it from the service detail page.
                  </p>
                  {selectedDetail.config.type === 'database' && (
                    <p className="text-sm text-[var(--text-secondary)] mt-2">
                      Database templates create preconfigured database services with credentials and runtime settings, so you only need to provide required secrets.
                    </p>
                  )}
                </div>

                {/* Deploy Section */}
                <div className="border-t border-[var(--border-subtle)] pt-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-[var(--radius-md)] bg-[var(--success-soft)] flex items-center justify-center">
                      <Play size={18} className="text-[var(--success)]" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-[var(--text-primary)]">Deploy from Template</h3>
                      <p className="text-sm text-[var(--text-secondary)]">Configure and create a new service</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium uppercase tracking-wider text-[var(--text-muted)] mb-2">
                        Project
                      </label>
                      <select
                        value={deployProjectId}
                        onChange={(e) => setDeployProjectId(e.target.value)}
                        className="w-full h-10 px-3 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] text-sm focus:border-[var(--accent-primary)] transition-colors"
                      >
                        {projectOptions.length === 0 && <option value="">No projects available</option>}
                        {projectOptions.map((project) => (
                          <option key={project.id} value={project.id}>{project.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium uppercase tracking-wider text-[var(--text-muted)] mb-2">
                        Service Name
                      </label>
                      <input
                        value={deployName}
                        onChange={(e) => {
                          if (!selectedTemplateId) return;
                          setDeployNameByTemplate((current) => ({
                            ...current,
                            [selectedTemplateId]: e.target.value,
                          }));
                        }}
                        className="w-full h-10 px-3 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] text-sm focus:border-[var(--accent-primary)] transition-colors"
                        placeholder="service-name"
                      />
                    </div>
                  </div>

                  {selectedDetail.variables.length > 0 && (
                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                      {selectedDetail.variables.map((variable) => {
                        const hasError = variable.required && !(variableValues[variable.key] ?? '').trim();
                        return (
                          <div key={variable.key}>
                            <label className="block text-xs font-medium uppercase tracking-wider text-[var(--text-muted)] mb-2">
                              {variable.label}
                              {variable.required && <span className="text-[var(--error)] ml-1">*</span>}
                            </label>
                            <input
                              type={variable.secret ? 'password' : 'text'}
                              value={variableValues[variable.key] ?? ''}
                              onChange={(e) => {
                                if (!selectedTemplateId) return;
                                setVariableValuesByTemplate((current) => ({
                                  ...current,
                                  [selectedTemplateId]: {
                                    ...(current[selectedTemplateId] ?? {}),
                                    [variable.key]: e.target.value,
                                  },
                                }));
                              }}
                              className={`w-full h-10 px-3 rounded-[var(--radius-md)] border bg-[var(--surface-muted)] text-sm transition-colors ${
                                hasError ? 'border-[var(--error)]' : 'border-[var(--border-subtle)] focus:border-[var(--accent-primary)]'
                              }`}
                              placeholder={variable.defaultValue}
                            />
                            <p className="text-xs text-[var(--text-tertiary)] mt-1">
              {variable.description}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {missingRequiredVariables.length > 0 && (
                    <div className="mt-4 px-4 py-3 rounded-[var(--radius-md)] bg-[var(--error-soft)] text-sm text-[var(--error)]">
                      Fill required variables: {missingRequiredVariables.map((v) => v.key).join(', ')}
                    </div>
                  )}

                  {!isDemoMode && projectsQuery.isError && (
                    <div className="mt-4 px-4 py-3 rounded-[var(--radius-md)] bg-[var(--error-soft)] text-sm text-[var(--error)]">
                      Failed to load projects
                    </div>
                  )}

                  {deployMutation.isError && (
                    <div className="mt-4 px-4 py-3 rounded-[var(--radius-md)] bg-[var(--error-soft)] text-sm text-[var(--error)]">
                      {deployMutation.error instanceof Error ? deployMutation.error.message : 'Failed to create service'}
                    </div>
                  )}

                  {lastDeployment && (
                    <div className="mt-4 px-4 py-3 rounded-[var(--radius-md)] bg-[var(--success-soft)] text-sm text-[var(--success)]">
                      <div className="flex items-center gap-2">
                        <Check size={16} />
                        <span>
                          Service <span className="mono font-medium">{lastDeployment.serviceName}</span> created
                        </span>
                        <Link
                          to={`/projects/${lastDeployment.projectId}/services/${lastDeployment.serviceId}${isDemoMode ? '?demo=1' : ''}`}
                          className="flex items-center gap-1 ml-2 underline underline-offset-2 hover:no-underline"
                        >
                          View <ArrowRight size={12} />
                        </Link>
                      </div>
                    </div>
                  )}

                  <div className="mt-6">
                    <button
                      onClick={() => deployMutation.mutate()}
                      disabled={isDeployDisabled}
                      className="flex items-center gap-2 h-11 px-6 rounded-[var(--radius-md)] text-white text-sm font-medium shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                      style={{ background: '#e8316a' }}
                    >
                      {deployMutation.isPending ? (
                        <>
                          <Loader2 size={16} className="animate-spin" />
                          Creating...
                        </>
                      ) : (
                        <>
                          <Play size={16} />
                          Create Service
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </>
            ) : null}
          </section>
        </div>
      </div>
    </div>
  );
}
