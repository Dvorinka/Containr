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
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { listProjects, listTemplates } from '@/lib/api-client';
import { DocsBrowser } from '@/features/docs/DocsBrowser';
import { useAuthSession } from '@/lib/use-auth-session';

const features = [
  { icon: Rocket, title: 'Git-push deploys', text: 'Connect a repository and ship. Builds, rollouts, and rollbacks are handled for you.' },
  { icon: Database, title: 'Managed databases', text: 'Provision PostgreSQL, MySQL, Redis and more — with backups and connection management.' },
  { icon: ShieldCheck, title: 'High availability', text: 'Failover policies, health checks, and alerting keep services alive across nodes.' },
  { icon: GitBranch, title: 'Preview environments', text: 'Every branch gets an isolated environment with its own URL.' },
  { icon: LayoutTemplate, title: 'Template catalog', text: 'One-click deploys for popular self-hosted apps and community templates.' },
  { icon: Zap, title: 'Autoscaling', text: 'Metric-driven scaling policies adapt replicas to real load.' },
];

export function LandingPage() {
  const sessionQuery = useAuthSession();
  const signedIn = Boolean(sessionQuery.data);

  const projectsQuery = useQuery({ queryKey: ['landing-projects'], queryFn: () => listProjects(), staleTime: 60_000 });
  const templatesQuery = useQuery({ queryKey: ['landing-templates'], queryFn: () => listTemplates(), staleTime: 60_000 });

  const projects = projectsQuery.data ?? [];
  const templates = (templatesQuery.data ?? []).slice(0, 12);

  return (
    <div className="min-h-screen bg-[var(--bg-void)] text-[var(--text-secondary)]">
      <div className="ambient-glow" />

      <header className="sticky top-0 z-40 border-b border-[var(--border-subtle)] bg-[var(--bg-base)]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5">
          <Link to="/" className="flex items-center gap-2.5">
            <img src="/containr.svg" alt="Containr" className="h-7 w-7 rounded-lg" />
            <span className="text-[15px] font-extrabold tracking-tight text-[var(--text-primary)]">
              contain<span style={{ color: 'var(--accent-primary)' }}>r</span>
            </span>
          </Link>
          <nav className="flex items-center gap-1 text-[13px]">
            <a href="#features" className="rounded-[var(--radius-md)] px-3 py-1.5 text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)] max-sm:hidden">Features</a>
            <a href="#templates" className="rounded-[var(--radius-md)] px-3 py-1.5 text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)] max-sm:hidden">Templates</a>
            <a href="#docs" className="rounded-[var(--radius-md)] px-3 py-1.5 text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)] max-sm:hidden">Docs</a>
            <Link
              to="/projects"
              className="rounded-[var(--radius-md)] px-3 py-1.5 font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]"
            >
              Browse
            </Link>
            {signedIn ? (
              <Link
                to="/projects"
                className="ml-1 inline-flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--accent-primary)] px-3.5 py-1.5 font-semibold text-[var(--accent-on)]"
              >
                Console <ArrowRight size={13} />
              </Link>
            ) : (
              <Link
                to="/auth/sign-in"
                className="ml-1 inline-flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--accent-primary)] px-3.5 py-1.5 font-semibold text-[var(--accent-on)]"
              >
                Sign in <ArrowRight size={13} />
              </Link>
            )}
          </nav>
        </div>
      </header>

      <main className="relative">
        <section className="mx-auto max-w-6xl px-5 pb-16 pt-20 text-center">
          <p className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-card)] px-3.5 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
            <Container size={12} className="text-[var(--accent-primary)]" />
            self-hosted PaaS
          </p>
          <h1 className="mx-auto max-w-3xl text-[42px] font-extrabold leading-[1.08] tracking-[-0.03em] text-[var(--text-primary)] max-sm:text-[32px]">
            Deploy containers like it's{' '}
            <span style={{ color: 'var(--accent-primary)' }}>your own cloud</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-[15px] leading-relaxed text-[var(--text-secondary)]">
            Containr turns any Docker host into a full deployment platform — git-push builds,
            managed databases, preview environments, HA failover, and a searchable knowledge base.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <Link
              to="/projects"
              className="inline-flex items-center gap-2 rounded-[var(--radius-md)] bg-[var(--accent-primary)] px-5 py-2.5 text-sm font-semibold text-[var(--accent-on)] transition-transform hover:scale-[1.02]"
            >
              Browse projects <ArrowRight size={15} />
            </Link>
            <a
              href="#docs"
              className="inline-flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border-default)] px-5 py-2.5 text-sm font-medium text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]"
            >
              <BookOpen size={15} /> Read the docs
            </a>
          </div>

          {projects.length > 0 ? (
            <div className="mx-auto mt-12 grid max-w-3xl grid-cols-3 gap-3 text-left max-sm:grid-cols-1">
              <Stat label="Public projects" value={projects.length} />
              <Stat
                label="Running services"
                value={projects.reduce((sum, p) => sum + (p.stats?.running_services ?? 0), 0)}
              />
              <Stat
                label="Deployments"
                value={projects.reduce((sum, p) => sum + (p.stats?.deployment_count ?? 0), 0)}
              />
            </div>
          ) : null}
        </section>

        <section id="features" className="border-t border-[var(--border-subtle)] bg-[var(--bg-base)]/60">
          <div className="mx-auto max-w-6xl px-5 py-16">
            <h2 className="text-center text-[26px] font-bold tracking-tight text-[var(--text-primary)]">
              Everything a deployment platform needs
            </h2>
            <p className="mx-auto mt-2 max-w-lg text-center text-sm text-[var(--text-secondary)]">
              One install, one dashboard, full control over your own infrastructure.
            </p>
            <div className="mt-10 grid grid-cols-3 gap-4 max-md:grid-cols-2 max-sm:grid-cols-1">
              {features.map((feature) => (
                <div
                  key={feature.title}
                  className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-5 transition-colors hover:border-[var(--border-default)]"
                >
                  <feature.icon size={18} className="text-[var(--accent-primary)]" />
                  <h3 className="mt-3 text-[14.5px] font-semibold text-[var(--text-primary)]">{feature.title}</h3>
                  <p className="mt-1.5 text-[12.5px] leading-relaxed text-[var(--text-tertiary)]">{feature.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="templates" className="border-t border-[var(--border-subtle)]">
          <div className="mx-auto max-w-6xl px-5 py-16">
            <div className="flex items-end justify-between">
              <div>
                <h2 className="text-[26px] font-bold tracking-tight text-[var(--text-primary)]">Template catalog</h2>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">
                  Production-ready presets — deploy in one click from the console.
                </p>
              </div>
              <Link
                to="/templates"
                className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[var(--accent-primary)] hover:underline"
              >
                Browse all <ArrowRight size={13} />
              </Link>
            </div>
            <div className="mt-8 grid grid-cols-4 gap-3 max-lg:grid-cols-3 max-sm:grid-cols-2">
              {templates.map((template) => (
                <Link
                  key={template.id}
                  to="/templates"
                  className="group rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4 transition-colors hover:border-[var(--border-strong)]"
                >
                  <div className="flex items-center gap-2.5">
                    {template.logo ? (
                      <img src={template.logo} alt="" className="h-7 w-7 rounded-md" />
                    ) : (
                      <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[var(--surface-muted)] text-[var(--accent-primary)]">
                        <LayoutTemplate size={14} />
                      </span>
                    )}
                    <span className="truncate text-[13px] font-semibold text-[var(--text-primary)]">{template.name}</span>
                  </div>
                  <p className="mt-2 line-clamp-2 text-[11.5px] leading-relaxed text-[var(--text-tertiary)]">
                    {template.description}
                  </p>
                  <span className="mt-2 inline-block rounded-full bg-[var(--surface-muted)] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[var(--text-tertiary)]">
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

        <section id="docs" className="border-t border-[var(--border-subtle)] bg-[var(--bg-base)]/60">
          <div className="mx-auto max-w-6xl px-5 py-16">
            <h2 className="text-[26px] font-bold tracking-tight text-[var(--text-primary)]">Documentation</h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Guides and references — synced from GitHub, cached locally, always available.
            </p>
            <div className="mt-8">
              <DocsBrowser />
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[var(--border-subtle)]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-6 text-[12px] text-[var(--text-tertiary)]">
          <span className="flex items-center gap-2">
            <img src="/containr.svg" alt="" className="h-4 w-4 rounded" />
            Containr — self-hosted container platform
          </span>
          <div className="flex items-center gap-4">
            <Link to="/projects" className="hover:text-[var(--text-secondary)]">Projects</Link>
            <Link to="/templates" className="hover:text-[var(--text-secondary)]">Templates</Link>
            <Link to="/admin" className="hover:text-[var(--text-secondary)]">Admin</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-card)] px-4 py-3.5">
      <p className="text-[22px] font-bold tabular-nums text-[var(--text-primary)]">{value}</p>
      <p className="mt-0.5 text-[11px] uppercase tracking-wider text-[var(--text-tertiary)]">{label}</p>
    </div>
  );
}
