import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Boxes,
  Check,
  DownloadCloud,
  ExternalLink,
  FileCode2,
  Github,
  ImageIcon,
  Layers,
  Loader2,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { gitApi, projectsApi, templatesApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toaster';
import { cn } from '@/lib/utils';
import type { GitProvider, GitRepository, Template, TemplateVariable } from '@/types';

interface ComposeServiceSummary {
  name: string;
  type?: string;
  image?: string;
  build_context?: string;
  command?: string;
  ports?: string[];
}

interface ComposeConfig {
  type?: string;
  format?: string;
  service_count?: number;
  serviceCount?: number;
  services?: ComposeServiceSummary[];
}

const sampleCompose = `name: uptime-kuma

x-containr:
  name: Uptime Kuma
  description: Self-hosted uptime monitoring with status pages.
  category: Monitoring
  icon: https://cdn.simpleicons.org/uptimekuma
  screenshots:
    - https://raw.githubusercontent.com/louislam/uptime-kuma/master/public/icon.svg

services:
  uptime-kuma:
    image: louislam/uptime-kuma:1
    ports:
      - "\${UPTIME_KUMA_PORT:-3001}:3001"
    volumes:
      - uptime-kuma:/app/data

volumes:
  uptime-kuma:`;

function parseJsonField<T>(value: T | string | undefined, fallback: T): T {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function parseTemplateVariables(template: Template | null): TemplateVariable[] {
  return parseJsonField<TemplateVariable[]>(template?.variables, []);
}

function parseScreenshots(template: Template | null): string[] {
  return parseJsonField<string[]>(template?.screenshots, []);
}

function parseConfig(template: Template | null): ComposeConfig {
  return parseJsonField<ComposeConfig>(template?.config, {});
}

function variableKey(variable: TemplateVariable) {
  return variable.key || variable.name || variable.label;
}

function sourceLabel(template: Template) {
  if (template.source_type === 'github') return template.source_repo || 'GitHub';
  if (template.source_type === 'manual') return 'Pasted Compose';
  if (template.is_official) return 'Official';
  return 'Community';
}

function serviceCount(template: Template) {
  const config = parseConfig(template);
  return config.service_count || config.serviceCount || config.services?.length || 0;
}

function templateServices(template: Template | null) {
  return parseConfig(template).services ?? [];
}

function templateSlug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function TemplatePreview({ template, active = false }: { template: Template; active?: boolean }) {
  const screenshots = parseScreenshots(template);
  const services = templateServices(template);

  if (screenshots.length > 0) {
    return (
      <div className="relative h-44 overflow-hidden rounded-md border border-border bg-background">
        <img src={screenshots[0]} alt="" className="h-full w-full object-cover" />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3">
          <div className="text-xs font-medium text-white">{screenshots.length} screenshot{screenshots.length === 1 ? '' : 's'}</div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('relative h-44 overflow-hidden rounded-md border border-border bg-background', active && 'border-primary/60')}>
      <div className="absolute inset-0 railway-dot-grid opacity-70" />
      <div className="relative flex h-full flex-col justify-between p-4">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>docker compose</span>
          <FileCode2 className="h-4 w-4" />
        </div>
        <div className="grid gap-2">
          {(services.length > 0 ? services : [{ name: template.name, image: 'compose service' }]).slice(0, 4).map((service) => (
            <div key={service.name} className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2 text-sm">
              <span className="truncate font-medium">{service.name}</span>
              <span className="ml-3 truncate text-xs text-muted-foreground">{service.image || service.build_context || service.type}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Templates() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [deployingTemplate, setDeployingTemplate] = useState<Template | null>(null);
  const [focusedTemplate, setFocusedTemplate] = useState<Template | null>(null);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isPasteOpen, setIsPasteOpen] = useState(false);
  const [isProviderOpen, setIsProviderOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [serviceName, setServiceName] = useState('');
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [providerForm, setProviderForm] = useState({ display_name: 'GitHub', access_token: '' });
  const [importForm, setImportForm] = useState({
    provider_id: '',
    source_url: '',
    repo_full_name: '',
    branch: '',
    compose_path: '',
  });
  const [pasteForm, setPasteForm] = useState({
    name: '',
    description: '',
    category: 'community',
    source_url: '',
    compose_yaml: sampleCompose,
  });

  const { data: templatesData, isLoading: templatesLoading } = useQuery({
    queryKey: ['templates'],
    queryFn: () => templatesApi.getTemplates(),
  });

  const { data: projectsData } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsApi.getProjects({ limit: 100 }),
  });

  const { data: providersData } = useQuery({
    queryKey: ['git-providers'],
    queryFn: () => gitApi.getProviders(),
  });

  const selectedProviderId = importForm.provider_id || providersData?.providers?.[0]?.id || '';
  const { data: repositoriesData, isFetching: repositoriesLoading } = useQuery({
    queryKey: ['provider-repositories', selectedProviderId],
    queryFn: () => gitApi.getProviderRepositories(selectedProviderId),
    enabled: !!selectedProviderId,
  });

  const templates = templatesData?.templates ?? [];
  const categories = useMemo(() => ['all', ...Array.from(new Set(templates.map((template) => template.category)))], [templates]);
  const filteredTemplates = useMemo(() => {
    const term = search.trim().toLowerCase();
    return templates.filter((template) => {
      const services = templateServices(template).map((service) => [service.name, service.image].join(' ')).join(' ');
      const matchesSearch = !term || [template.name, template.description, template.category, template.source_repo, services]
        .some((value) => value?.toLowerCase().includes(term));
      const matchesCategory = category === 'all' || template.category === category;
      return matchesSearch && matchesCategory;
    });
  }, [category, search, templates]);

  const officialCount = templates.filter((template) => template.is_official).length;
  const communityCount = templates.length - officialCount;
  const composeCount = templates.filter((template) => parseConfig(template).type === 'compose' || template.compose_yaml).length;

  const createProvider = useMutation({
    mutationFn: () => gitApi.createProvider({
      name: 'github',
      display_name: providerForm.display_name,
      access_token: providerForm.access_token,
    }),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['git-providers'] });
      setImportForm((previous) => ({ ...previous, provider_id: response.provider.id }));
      setProviderForm({ display_name: 'GitHub', access_token: '' });
      setIsProviderOpen(false);
    },
    onError: (err: Error) => {
      toast({ title: 'GitHub connection failed', description: err.message, variant: 'destructive' });
    },
  });

  const importTemplate = useMutation({
    mutationFn: () => templatesApi.importGitHubTemplate({
      provider_id: importForm.provider_id || selectedProviderId || undefined,
      source_url: importForm.source_url || undefined,
      repo_full_name: importForm.repo_full_name || undefined,
      branch: importForm.branch || undefined,
      compose_path: importForm.compose_path || undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      setIsImportOpen(false);
      setImportForm({ provider_id: selectedProviderId, source_url: '', repo_full_name: '', branch: '', compose_path: '' });
      toast({ title: 'Template imported', description: 'Docker Compose app is ready to install.' });
    },
    onError: (err: Error) => {
      toast({ title: 'Template import failed', description: err.message, variant: 'destructive' });
    },
  });

  const pasteTemplate = useMutation({
    mutationFn: () => templatesApi.importComposeTemplate({
      name: pasteForm.name || undefined,
      description: pasteForm.description || undefined,
      category: pasteForm.category || undefined,
      source_url: pasteForm.source_url || undefined,
      compose_yaml: pasteForm.compose_yaml,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      setIsPasteOpen(false);
      setPasteForm({ name: '', description: '', category: 'community', source_url: '', compose_yaml: sampleCompose });
      toast({ title: 'Compose template added', description: 'The app is now in your template catalog.' });
    },
    onError: (err: Error) => {
      toast({ title: 'Compose import failed', description: err.message, variant: 'destructive' });
    },
  });

  const deployTemplate = useMutation({
    mutationFn: () => {
      if (!deployingTemplate) throw new Error('No template selected');
      return templatesApi.deployTemplate(deployingTemplate.id, {
        project_id: selectedProjectId,
        name: serviceName || deployingTemplate.name,
        variables,
      });
    },
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setDeployingTemplate(null);
      setSelectedProjectId('');
      setServiceName('');
      setVariables({});
      toast({
        title: 'Template installed',
        description: `${response.service_ids?.length || response.serviceCount || 1} service${(response.service_ids?.length || response.serviceCount || 1) === 1 ? '' : 's'} added to the project.`,
      });
    },
    onError: (err: Error) => {
      toast({ title: 'Install failed', description: err.message, variant: 'destructive' });
    },
  });

  const openInstall = (template: Template) => {
    setDeployingTemplate(template);
    setFocusedTemplate(template);
    setServiceName(templateSlug(template.name));
    setVariables(
      parseTemplateVariables(template).reduce<Record<string, string>>((acc, variable) => {
        acc[variableKey(variable)] = variable.default || '';
        return acc;
      }, {}),
    );
  };

  const focused = focusedTemplate || filteredTemplates[0] || null;
  const focusedScreenshots = parseScreenshots(focused);
  const installVariables = parseTemplateVariables(deployingTemplate);
  const installServices = templateServices(deployingTemplate);

  return (
    <div className="mx-auto max-w-[1500px] space-y-8 p-5 md:p-8">
      <div className="grid gap-6 xl:grid-cols-[1fr_430px]">
        <div className="space-y-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-md border border-border px-3 py-1 text-xs font-semibold uppercase text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5" />
                App Catalog
              </div>
              <h1 className="text-4xl font-semibold tracking-normal md:text-5xl">Templates</h1>
              <p className="mt-3 max-w-2xl text-muted-foreground">
                Install self-hosted apps from Docker Compose files, GitHub repositories, or pasted CasaOS-style stacks.
              </p>
              <div className="mt-6 flex flex-wrap gap-3 text-sm text-muted-foreground">
                <Badge variant="outline" className="gap-2">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                  {officialCount} official
                </Badge>
                <Badge variant="outline" className="gap-2">
                  <Github className="h-3.5 w-3.5" />
                  {communityCount} community
                </Badge>
                <Badge variant="outline" className="gap-2">
                  <FileCode2 className="h-3.5 w-3.5" />
                  {composeCount} compose
                </Badge>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setIsProviderOpen(true)} className="gap-2">
                <Github className="h-4 w-4" />
                Connect
              </Button>
              <Button variant="outline" onClick={() => setIsPasteOpen(true)} className="gap-2">
                <FileCode2 className="h-4 w-4" />
                Paste Compose
              </Button>
              <Button onClick={() => setIsImportOpen(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                Import GitHub
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full lg:max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search apps, images, services" className="pl-9" />
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {categories.map((item) => (
                <Button key={item} variant={category === item ? 'secondary' : 'ghost'} size="sm" onClick={() => setCategory(item)}>
                  {item}
                </Button>
              ))}
            </div>
          </div>

          {templatesLoading ? (
            <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="h-80 rounded-md border border-border bg-card animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
              {filteredTemplates.map((template) => {
                const services = templateServices(template);
                const selected = focused?.id === template.id;
                return (
                  <Card
                    key={template.id}
                    className={cn('cursor-pointer border-border bg-card transition-colors hover:border-muted-foreground/40', selected && 'border-primary/60')}
                    onClick={() => setFocusedTemplate(template)}
                  >
                    <CardContent className="flex h-full flex-col gap-5 p-4">
                      <TemplatePreview template={template} active={selected} />
                      <div className="flex items-start gap-4">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-border bg-background">
                          {template.logo ? (
                            <img src={template.logo} alt="" className="h-6 w-6" />
                          ) : (
                            <Boxes className="h-5 w-5 text-muted-foreground" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h2 className="truncate text-lg font-semibold">{template.name}</h2>
                          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{template.description}</p>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 text-xs">
                        <Badge variant="secondary">{template.category}</Badge>
                        <Badge variant="outline">{serviceCount(template)} services</Badge>
                        <Badge variant="outline">{sourceLabel(template)}</Badge>
                      </div>

                      <div className="mt-auto flex items-center justify-between gap-3 border-t border-border pt-4">
                        <div className="min-w-0 text-xs text-muted-foreground">
                          {services.slice(0, 2).map((service) => service.name).join(', ') || 'Compose app'}
                        </div>
                        <Button size="sm" onClick={(event) => { event.stopPropagation(); openInstall(template); }}>
                          Install
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        <aside className="xl:sticky xl:top-24 xl:h-fit">
          <Card className="border-border bg-card">
            <CardContent className="space-y-5 p-5">
              {focused ? (
                <>
                  <TemplatePreview template={focused} active />
                  <div>
                    <div className="flex items-start gap-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-border bg-background">
                        {focused.logo ? <img src={focused.logo} alt="" className="h-7 w-7" /> : <Layers className="h-5 w-5" />}
                      </div>
                      <div className="min-w-0">
                        <h2 className="text-2xl font-semibold">{focused.name}</h2>
                        <p className="mt-1 text-sm text-muted-foreground">{focused.description}</p>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Badge variant="secondary">{focused.category}</Badge>
                      <Badge variant="outline">{serviceCount(focused)} Compose services</Badge>
                    </div>
                  </div>

                  {focusedScreenshots.length > 1 && (
                    <div className="grid grid-cols-3 gap-2">
                      {focusedScreenshots.slice(0, 3).map((screenshot) => (
                        <img key={screenshot} src={screenshot} alt="" className="aspect-video rounded-md border border-border object-cover" />
                      ))}
                    </div>
                  )}

                  <div className="space-y-2">
                    <div className="text-sm font-semibold">Services</div>
                    {templateServices(focused).map((service) => (
                      <div key={service.name} className="rounded-md border border-border p-3 text-sm">
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-medium">{service.name}</span>
                          <Badge variant="outline">{service.type || 'service'}</Badge>
                        </div>
                        <div className="mt-1 truncate text-xs text-muted-foreground">{service.image || service.build_context || 'build context'}</div>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-2">
                    <Button className="flex-1" onClick={() => openInstall(focused)}>
                      <DownloadCloud className="h-4 w-4" />
                      Install
                    </Button>
                    {focused.source_url && (
                      <Button variant="outline" size="icon" onClick={() => window.open(focused.source_url, '_blank', 'noopener,noreferrer')}>
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </>
              ) : (
                <div className="py-16 text-center text-sm text-muted-foreground">
                  <ImageIcon className="mx-auto mb-3 h-8 w-8" />
                  Import or paste a Compose template to start.
                </div>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>

      <Dialog open={isProviderOpen} onOpenChange={setIsProviderOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Connect GitHub</DialogTitle>
            <DialogDescription>Use a GitHub token for private repositories, branch discovery, and higher API limits.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="provider-name">Display name</Label>
              <Input id="provider-name" value={providerForm.display_name} onChange={(event) => setProviderForm({ ...providerForm, display_name: event.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="provider-token">GitHub token</Label>
              <Input id="provider-token" type="password" value={providerForm.access_token} onChange={(event) => setProviderForm({ ...providerForm, access_token: event.target.value })} placeholder="ghp_..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsProviderOpen(false)}>Cancel</Button>
            <Button onClick={() => createProvider.mutate()} disabled={!providerForm.access_token.trim() || createProvider.isPending}>
              {createProvider.isPending ? 'Connecting...' : 'Connect'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Import from GitHub</DialogTitle>
            <DialogDescription>Enter any GitHub repository or Compose file URL. Connected GitHub is optional for public repositories.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="github-url">GitHub URL</Label>
              <Input
                id="github-url"
                value={importForm.source_url}
                onChange={(event) => setImportForm({ ...importForm, source_url: event.target.value })}
                placeholder="https://github.com/owner/repo/blob/main/docker-compose.yml"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="import-provider">Connected account</Label>
                <select
                  id="import-provider"
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={importForm.provider_id || selectedProviderId}
                  onChange={(event) => setImportForm({ ...importForm, provider_id: event.target.value })}
                >
                  <option value="">Public GitHub</option>
                  {(providersData?.providers ?? []).map((provider: GitProvider) => (
                    <option key={provider.id} value={provider.id}>{provider.display_name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="repo-full-name">Repository</Label>
                <Input
                  id="repo-full-name"
                  list="connected-repos"
                  value={importForm.repo_full_name}
                  onChange={(event) => setImportForm({ ...importForm, repo_full_name: event.target.value })}
                  placeholder="owner/repo"
                />
                <datalist id="connected-repos">
                  {(repositoriesData?.repositories ?? []).map((repo: GitRepository) => (
                    <option key={repo.id} value={repo.full_name} />
                  ))}
                </datalist>
                {repositoriesLoading && <div className="text-xs text-muted-foreground">Loading connected repositories...</div>}
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="github-branch">Branch</Label>
                <Input id="github-branch" value={importForm.branch} onChange={(event) => setImportForm({ ...importForm, branch: event.target.value })} placeholder="main" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="compose-path">Compose path</Label>
                <Input id="compose-path" value={importForm.compose_path} onChange={(event) => setImportForm({ ...importForm, compose_path: event.target.value })} placeholder="docker-compose.yml" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsImportOpen(false)}>Cancel</Button>
            <Button
              onClick={() => importTemplate.mutate()}
              disabled={(!importForm.source_url.trim() && !importForm.repo_full_name.trim()) || importTemplate.isPending}
            >
              {importTemplate.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Github className="h-4 w-4" />}
              Import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isPasteOpen} onOpenChange={setIsPasteOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Paste Docker Compose</DialogTitle>
            <DialogDescription>Paste a Compose file. Optional `x-containr` or `x-casaos` fields add catalog metadata and screenshots.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="paste-name">Name</Label>
                <Input id="paste-name" value={pasteForm.name} onChange={(event) => setPasteForm({ ...pasteForm, name: event.target.value })} placeholder="Optional override" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="paste-category">Category</Label>
                <Input id="paste-category" value={pasteForm.category} onChange={(event) => setPasteForm({ ...pasteForm, category: event.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="paste-description">Description</Label>
              <Input id="paste-description" value={pasteForm.description} onChange={(event) => setPasteForm({ ...pasteForm, description: event.target.value })} placeholder="Optional override" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="paste-source">Source link</Label>
              <Input id="paste-source" value={pasteForm.source_url} onChange={(event) => setPasteForm({ ...pasteForm, source_url: event.target.value })} placeholder="https://github.com/owner/repo" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="compose-yaml">Compose YAML</Label>
              <Textarea
                id="compose-yaml"
                value={pasteForm.compose_yaml}
                onChange={(event) => setPasteForm({ ...pasteForm, compose_yaml: event.target.value })}
                className="min-h-[320px] font-mono text-xs"
                spellCheck={false}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsPasteOpen(false)}>Cancel</Button>
            <Button onClick={() => pasteTemplate.mutate()} disabled={!pasteForm.compose_yaml.trim() || pasteTemplate.isPending}>
              {pasteTemplate.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileCode2 className="h-4 w-4" />}
              Add Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deployingTemplate} onOpenChange={(open) => !open && setDeployingTemplate(null)}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Install {deployingTemplate?.name}</DialogTitle>
            <DialogDescription>Review services, choose a project, fill setup values, and add the app to the project canvas.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-5 py-2 lg:grid-cols-[1fr_280px]">
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="install-project">Project</Label>
                  <select
                    id="install-project"
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={selectedProjectId}
                    onChange={(event) => setSelectedProjectId(event.target.value)}
                  >
                    <option value="">Select project</option>
                    {(projectsData?.projects ?? []).map((project) => (
                      <option key={project.id} value={project.id}>{project.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="install-name">Install name</Label>
                  <Input id="install-name" value={serviceName} onChange={(event) => setServiceName(event.target.value)} />
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-sm font-semibold">Services</div>
                <div className="grid gap-2">
                  {installServices.map((service) => (
                    <div key={service.name} className="rounded-md border border-border p-3 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-medium">{service.name}</span>
                        <Badge variant="outline">{service.type || 'service'}</Badge>
                      </div>
                      <div className="mt-1 truncate text-xs text-muted-foreground">{service.image || service.build_context || 'build context'}</div>
                      {service.ports && service.ports.length > 0 && (
                        <div className="mt-2 text-xs text-muted-foreground">{service.ports.join(', ')}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {installVariables.length > 0 && (
                <div className="space-y-3">
                  <div className="text-sm font-semibold">Setup</div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {installVariables.map((variable) => {
                      const key = variableKey(variable);
                      return (
                        <div className="space-y-2" key={key}>
                          <Label htmlFor={`template-var-${key}`}>
                            {variable.label || key}
                            {variable.required && <span className="ml-1 text-destructive">*</span>}
                          </Label>
                          <Input
                            id={`template-var-${key}`}
                            type={variable.secret ? 'password' : 'text'}
                            value={variables[key] ?? ''}
                            onChange={(event) => setVariables((previous) => ({ ...previous, [key]: event.target.value }))}
                            placeholder={variable.default || key}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-3">
              {deployingTemplate && <TemplatePreview template={deployingTemplate} />}
              <div className="rounded-md border border-border p-4 text-sm">
                <div className="mb-2 flex items-center gap-2 font-medium">
                  <Check className="h-4 w-4 text-emerald-400" />
                  Install summary
                </div>
                <div className="space-y-1 text-muted-foreground">
                  <div>{installServices.length || 1} Compose services</div>
                  <div>{installVariables.length} setup values</div>
                  <div>{sourceLabel(deployingTemplate || ({} as Template))}</div>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeployingTemplate(null)}>Cancel</Button>
            <Button onClick={() => deployTemplate.mutate()} disabled={!selectedProjectId || !serviceName.trim() || deployTemplate.isPending}>
              {deployTemplate.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <DownloadCloud className="h-4 w-4" />}
              Install
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
