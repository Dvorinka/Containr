import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  BookOpen,
  Container,
  Database,
  GitBranch,
  LayoutTemplate,
  Rocket,
  Server,
  ShieldCheck,
  Terminal,
  Zap,
} from 'lucide-react';
import { getHostMonitoring, listProjects, listRecentDeployments, listTemplates } from '@/lib/api-client';
import { DocsBrowser } from '@/features/docs/DocsBrowser';
import { useAuthSession } from '@/lib/use-auth-session';
import { useDemoMode } from '@/lib/demo-mode';
import { useBranding } from '@/lib/use-branding';
import { BrandWordmark, MiniBars, SPill, Ticks } from '@/shared/components';
import { demoHostMonitoring, demoProjects, demoTemplates } from '@/lib/demo-data';

const features = [
  { icon: Rocket, title: 'Git-push deploys', text: 'Connect a repository and ship. Builds, rollouts, and rollbacks are handled for you.' },
  { icon: Database, title: 'Managed databases', text: 'Provision PostgreSQL, MySQL, Redis and more — with backups and connection management.' },
  { icon: ShieldCheck, title: 'High availability', text: 'Failover policies, health checks, and alerting keep services alive across nodes.' },
  { icon: GitBranch, title: 'Preview environments', text: 'Every branch gets an isolated environment with its own URL.' },
  { icon: LayoutTemplate, title: 'Template catalog', text: 'One-click deploys for popular self-hosted apps and community templates.' },
  { icon: Zap, title: 'Autoscaling', text: 'Metric-driven scaling policies adapt replicas to real load.' },
];

const demoDeploys = [
  { id: 'd1', serviceName: 'api-gateway', status: 'deployed', startedAt: new Date(Date.now() - 240_000).toISOString() },
  { id: 'd2', serviceName: 'web-frontend', status: 'building', startedAt: new Date(Date.now() - 390_000).toISOString() },
  { id: 'd3', serviceName: 'batch-evaluator', status: 'failed', startedAt: new Date(Date.now() - 3_900_000).toISOString() },
];

export function LandingPage() {
  const [now] = useState(() => Date.now());
  const isDemoMode = useDemoMode();
  const { logoUrl, productName } = useBranding();
  const sessionQuery = useAuthSession({ enabled: !isDemoMode });
  const signedIn = !isDemoMode && Boolean(sessionQuery.data);
  const demo = isDemoMode ? '?demo=1' : '';

  const projectsQuery = useQuery({ queryKey: ['landing-projects'], queryFn: () => listProjects(), staleTime: 60_000, enabled: !isDemoMode });
  const templatesQuery = useQuery({ queryKey: ['landing-templates'], queryFn: () => listTemplates(), staleTime: 60_000, enabled: !isDemoMode });
  const hostQuery = useQuery({ queryKey: ['landing-host'], queryFn: getHostMonitoring, staleTime: 30_000, enabled: !isDemoMode });
  const deploysQuery = useQuery({ queryKey: ['landing-deploys'], queryFn: () => listRecentDeployments(4), staleTime: 30_000, enabled: !isDemoMode });

  const projects = isDemoMode ? demoProjects : (projectsQuery.data ?? []);
  const templates = (isDemoMode ? demoTemplates : (templatesQuery.data ?? [])).slice(0, 12);
  const host = isDemoMode ? demoHostMonitoring : hostQuery.data;
  const deploys = isDemoMode ? demoDeploys : (deploysQuery.data ?? []).slice(0, 3);

  const cpuPct = host ? Math.min(100, Math.round((host.load.load1m / Math.max(1, host.cpu.cores)) * 100)) : null;
  const memPct = host ? Math.round(host.memory.usagePercent) : null;
  const diskPct = host ? Math.round(host.storage.usagePercent) : null;

  const rel = (d?: string) => {
    if (!d) return '—';
    const s = Math.floor((now - new Date(d).getTime()) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    return `${Math.floor(s / 86400)}d ago`;
  };

  return (
    <div className="min-h-screen bg-[var(--bg-void)] text-[var(--text-secondary)]">
      {/* ── Top bar ── */}
      <header className="sticky top-0 z-40 border-b border-[var(--border-subtle)] bg-[var(--bg-base)]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5">
          <Link to="/" className="flex items-center gap-2.5">
            <img src={logoUrl || '/containr.svg'} alt={productName} className="h-7 w-7 rounded-lg object-contain" />
            <span className="font-headline text-[15px] font-semibold tracking-tight text-[var(--text-primary)]">
              <BrandWordmark />
            </span>
          </Link>
          <nav className="flex items-center gap-1 text-[13px]">
            <a href="#features" className="rounded-[var(--radius-md)] px-3 py-1.5 text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)] max-sm:hidden">Features</a>
            <a href="#templates" className="rounded-[var(--radius-md)] px-3 py-1.5 text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)] max-sm:hidden">Templates</a>
            <a href="#docs" className="rounded-[var(--radius-md)] px-3 py-1.5 text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)] max-sm:hidden">Docs</a>
            <Link to={`/projects${demo}`} className="rounded-[var(--radius-md)] px-3 py-1.5 font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]">
              Browse
            </Link>
            {signedIn || isDemoMode ? (
              <Link to={`/${demo}`} className="ml-1 s-btn-accent">
                Console <ArrowRight size={13} />
              </Link>
            ) : (
              <Link to="/auth/sign-in" className="ml-1 s-btn-accent">
                Sign in <ArrowRight size={13} />
              </Link>
            )}
          </nav>
        </div>
      </header>

      <main>
        {/* ── Hero + live instance window ── */}
        <section className="border-b border-[var(--border-subtle)]">
          <div className="mx-auto grid max-w-6xl gap-10 px-5 pb-16 pt-16 lg:grid-cols-[1.1fr_1fr] lg:items-center">
            <div>
              <p className="s-chip mb-6 inline-flex">
                <Container size={11} />
                self-hosted PaaS
              </p>
              <h1 className="font-headline text-[44px] font-bold leading-[1.06] tracking-[-0.03em] text-[var(--text-primary)] max-sm:text-[32px]">
                Deploy containers like it's{' '}
                <span className="text-[var(--accent-primary)]">your own cloud</span>
              </h1>
              <p className="mt-5 max-w-lg text-[14px] leading-relaxed text-[var(--text-secondary)]">
                Containr turns any Docker host into a full deployment platform — git-push builds,
                managed databases, preview environments, HA failover, and a searchable knowledge base.
              </p>
              <div className="mt-8 flex items-center gap-3">
                <Link to={`/${demo}`} className="s-btn-accent !px-5 !h-10 text-sm">
                  {isDemoMode ? 'Explore the live demo' : 'Open the console'} <ArrowRight size={15} />
                </Link>
                <a href="#docs" className="s-btn-quiet !px-5 !h-10 text-sm">
                  <BookOpen size={15} /> Read the docs
                </a>
              </div>
              <div className="v-mono mt-8 flex items-center gap-5 text-[11px] text-[var(--text-tertiary)]">
                <span className="flex items-center gap-2">
                  <i className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--success)]" />
                  {projects.length} public projects
                </span>
                <span>{projects.reduce((s, p) => s + (p.stats?.running_services ?? 0), 0)} services online</span>
                <span className="max-sm:hidden">{projects.reduce((s, p) => s + (p.stats?.deployment_count ?? 0), 0)} deployments</span>
              </div>
            </div>

            {/* Live window — real telemetry from this instance */}
            <div className="s-card !p-0 overflow-hidden">
              <div className="s-cardhead border-b border-[var(--border-subtle)]">
                <span className="s-ibox"><Server size={13.5} /></span>
                <span className="s-t">{host?.hostname ?? 'this instance'} <span className="s-ta">live</span></span>
                <span className="s-trail">
                  <SPill tone={host?.dockerAvailable ? 'ok' : 'off'}>{host?.dockerAvailable ? 'online' : 'offline'}</SPill>
                </span>
              </div>
              <div className="px-4 pb-2 pt-3">
                {[
                  { label: 'CPU', v: cpuPct },
                  { label: 'Memory', v: memPct },
                  { label: 'Disk', v: diskPct },
                ].map((r) => (
                  <div key={r.label} className="py-1.5">
                    <div className="mb-1.5 flex items-baseline justify-between text-[11.5px]">
                      <span className="text-[var(--text-secondary)]">{r.label}</span>
                      <b className="font-semibold text-[var(--accent-primary)]">{r.v !== null ? `${r.v}%` : '—'}</b>
                    </div>
                    <Ticks pct={r.v ?? 0} count={48} warn={(r.v ?? 0) > 85} />
                  </div>
                ))}
              </div>
              <div className="border-t border-[var(--border-subtle)] px-4 py-3">
                <p className="v-mono mb-2 text-[10px] uppercase tracking-[0.12em] text-[var(--text-tertiary)]">latest deploys</p>
                {deploys.map((d) => (
                  <div key={d.id} className="flex items-center gap-2.5 py-1.5 text-[12px]">
                    <MiniBars tone={(d.status ?? '').toLowerCase() === 'failed' ? 'var(--error)' : 'var(--accent-primary)'} />
                    <span className="min-w-0 flex-1 truncate font-medium text-[var(--text-primary)]">{d.serviceName || d.id}</span>
                    <span className="v-mono text-[10.5px] text-[var(--text-tertiary)]">{rel(d.startedAt)}</span>
                  </div>
                ))}
                {deploys.length === 0 && (
                  <p className="py-1.5 text-[11.5px] text-[var(--text-tertiary)]">No deployments yet.</p>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* ── Install strip ── */}
        <section className="border-b border-[var(--border-subtle)] bg-[var(--bg-base)]/60">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-5 py-5">
            <span className="s-ibox"><Terminal size={13.5} /></span>
            <code className="v-mono flex-1 text-[12.5px] text-[var(--text-secondary)]">
              <span className="text-[var(--accent-primary)]">$</span> docker compose up -d
            </code>
            <span className="v-mono text-[11px] text-[var(--text-tertiary)]">one host · one command · full platform</span>
          </div>
        </section>

        {/* ── Features ── */}
        <section id="features" className="border-b border-[var(--border-subtle)]">
          <div className="mx-auto max-w-6xl px-5 py-16">
            <div className="flex items-end justify-between gap-6 max-sm:flex-col max-sm:items-start">
              <div>
                <p className="v-mono mb-2 flex items-center gap-2 text-[10.5px] uppercase tracking-[0.1em] text-[var(--text-tertiary)]">
                  <i className="inline-block h-[5px] w-[5px] rounded-[1px] bg-[var(--accent-primary)]" />
                  platform
                </p>
                <h2 className="font-headline text-[26px] font-bold tracking-tight text-[var(--text-primary)]">
                  Everything a deployment platform needs
                </h2>
                <p className="mt-1.5 max-w-lg text-[13px] text-[var(--text-secondary)]">
                  One install, one dashboard, full control over your own infrastructure.
                </p>
              </div>
              <span className="v-mono text-[11px] text-[var(--text-muted)]">06 capabilities</span>
            </div>
            <div className="mt-9 grid grid-cols-3 gap-3.5 max-md:grid-cols-2 max-sm:grid-cols-1">
              {features.map((feature) => (
                <div key={feature.title} className="s-card">
                  <div className="s-cardhead !mb-0">
                    <span className="s-ibox"><feature.icon size={13.5} /></span>
                    <h3 className="s-t">{feature.title}</h3>
                  </div>
                  <p className="mt-2 text-[12.5px] leading-relaxed text-[var(--text-tertiary)]">{feature.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Templates ── */}
        <section id="templates" className="border-b border-[var(--border-subtle)] bg-[var(--bg-base)]/60">
          <div className="mx-auto max-w-6xl px-5 py-16">
            <div className="flex items-end justify-between gap-6">
              <div>
                <p className="v-mono mb-2 flex items-center gap-2 text-[10.5px] uppercase tracking-[0.1em] text-[var(--text-tertiary)]">
                  <i className="inline-block h-[5px] w-[5px] rounded-[1px] bg-[var(--accent-primary)]" />
                  catalog
                </p>
                <h2 className="font-headline text-[26px] font-bold tracking-tight text-[var(--text-primary)]">Template catalog</h2>
                <p className="mt-1.5 text-[13px] text-[var(--text-secondary)]">
                  Production-ready presets — deploy in one click from the console.
                </p>
              </div>
              <Link
                to={`/templates${demo}`}
                className="s-chip !normal-case !tracking-normal"
              >
                Browse all <ArrowRight size={11} />
              </Link>
            </div>
            <div className="mt-8 grid grid-cols-4 gap-3 max-lg:grid-cols-3 max-sm:grid-cols-2">
              {templates.map((template) => (
                <Link
                  key={template.id}
                  to={`/templates?template=${template.id}${isDemoMode ? '&demo=1' : ''}`}
                  className="s-card group"
                >
                  <div className="flex items-center gap-2.5">
                    {template.logo ? (
                      <img src={template.logo} alt="" className="h-7 w-7 rounded-[6px]" />
                    ) : (
                      <span className="s-ibox !h-7 !w-7"><LayoutTemplate size={13.5} /></span>
                    )}
                    <span className="truncate text-[13px] font-semibold text-[var(--text-primary)]">{template.name}</span>
                  </div>
                  <p className="mt-2 line-clamp-2 text-[11.5px] leading-relaxed text-[var(--text-tertiary)]">
                    {template.description}
                  </p>
                  <span className="s-chip mt-2" style={{ cursor: 'default' }}>
                    {template.category || 'app'}
                  </span>
                </Link>
              ))}
              {templates.length === 0 && !templatesQuery.isPending ? (
                <p className="col-span-full py-8 text-center text-sm text-[var(--text-tertiary)]">
                  Template catalog is empty — sign in to add your own.
                </p>
              ) : null}
            </div>
          </div>
        </section>

        {/* ── Docs ── */}
        <section id="docs" className="border-b border-[var(--border-subtle)]">
          <div className="mx-auto max-w-6xl px-5 py-16">
            <p className="v-mono mb-2 flex items-center gap-2 text-[10.5px] uppercase tracking-[0.1em] text-[var(--text-tertiary)]">
              <i className="inline-block h-[5px] w-[5px] rounded-[1px] bg-[var(--accent-primary)]" />
              reference
            </p>
            <h2 className="font-headline text-[26px] font-bold tracking-tight text-[var(--text-primary)]">Documentation</h2>
            <p className="mt-1.5 text-[13px] text-[var(--text-secondary)]">
              Guides and references — synced from GitHub, cached locally, always available.
            </p>
            <div className="mt-8">
              <DocsBrowser />
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[var(--border-subtle)]">
        <div className="v-mono mx-auto flex max-w-6xl items-center justify-between px-5 py-6 text-[11.5px] text-[var(--text-tertiary)]">
          <span className="flex items-center gap-2">
            <img src="/containr.svg" alt="" className="h-4 w-4 rounded" />
            containr — self-hosted container platform
          </span>
          <div className="flex items-center gap-4">
            <Link to={`/projects${demo}`} className="hover:text-[var(--text-secondary)]">Projects</Link>
            <Link to={`/templates${demo}`} className="hover:text-[var(--text-secondary)]">Templates</Link>
            {!isDemoMode ? <Link to="/admin" className="hover:text-[var(--text-secondary)]">Admin</Link> : null}
          </div>
        </div>
      </footer>
    </div>
  );
}
