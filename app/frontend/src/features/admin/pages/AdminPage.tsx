import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CheckCircle2,
  Clock,
  Copy,
  FolderKanban,
  Megaphone,
  Pencil,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
  XCircle,
} from 'lucide-react';
import {
  createBanner,
  createInvite,
  deleteBanner,
  deleteProject,
  getAdminOverview,
  impersonateUser,
  type ImpersonationResult,
  listAdminBanners,
  listAdminUsers,
  listInvites,
  listProjects,
  revokeInvite,
  setProjectApproval,
  setUserAdmin,
  updateBanner,
  updateProject,
  type AdminUser,
  type Banner,
  type ProjectEntity,
} from '@/lib/api-client';
import { useAuthSession } from '@/lib/use-auth-session';
import { useDemoMode } from '@/lib/demo-mode';
import { DemoRestricted, LoadingState, useToast } from '@/shared/components';
import { GhostBtn, QuietBtn, SPageHead, SPill } from '@/shared/components/sentry';

const statLabels: Record<string, string> = {
  users: 'Users',
  projects: 'Projects',
  pending_projects: 'Pending approval',
  services: 'Services',
  running_services: 'Running',
  databases: 'Databases',
  agents: 'Agents',
  templates: 'Templates',
  user_templates: 'User templates',
  cron_jobs: 'Cron jobs',
  deployments_total: 'Deployments',
};

export function AdminPage() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const isDemoMode = useDemoMode();
  const sessionQuery = useAuthSession({ enabled: !isDemoMode });
  const myId = sessionQuery.data?.user.id;

  const overviewQuery = useQuery({ queryKey: ['admin-overview'], queryFn: getAdminOverview, enabled: !isDemoMode });
  const usersQuery = useQuery({ queryKey: ['admin-users'], queryFn: listAdminUsers, enabled: !isDemoMode });
  const projectsQuery = useQuery({ queryKey: ['admin-projects'], queryFn: () => listProjects({ limit: 100 }), enabled: !isDemoMode });
  const bannersQuery = useQuery({ queryKey: ['admin-banners'], queryFn: listAdminBanners, enabled: !isDemoMode });
  const invitesQuery = useQuery({
    queryKey: ['admin-invites'],
    queryFn: listInvites,
    enabled: !isDemoMode,
    select: (list) =>
      list.map((invite) => ({
        ...invite,
        expired: !invite.used_at && new Date(invite.expires_at).getTime() < Date.now(),
      })),
  });
  const [editingProject, setEditingProject] = useState<ProjectEntity | null>(null);
  const [editForm, setEditForm] = useState({ name: '', description: '' });
  const [bannerForm, setBannerForm] = useState({ title: '', body: '', level: 'info' as Banner['level'] });
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [impersonation, setImpersonation] = useState<ImpersonationResult | null>(null);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-overview'] });
    queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    queryClient.invalidateQueries({ queryKey: ['admin-projects'] });
    queryClient.invalidateQueries({ queryKey: ['admin-banners'] });
    queryClient.invalidateQueries({ queryKey: ['active-banners'] });
    queryClient.invalidateQueries({ queryKey: ['admin-invites'] });
    queryClient.invalidateQueries({ queryKey: ['projects'] });
  };

  const inviteCreateMutation = useMutation({
    mutationFn: () => createInvite({ email: inviteEmail.trim() || undefined }),
    onSuccess: (result) => {
      setInviteLink(`${window.location.origin}${result.url}`);
      setInviteEmail('');
      invalidate();
    },
    onError: (error) => showToast('error', 'Invite failed', error instanceof Error ? error.message : undefined),
  });

  const inviteRevokeMutation = useMutation({
    mutationFn: (id: string) => revokeInvite(id),
    onSuccess: () => {
      showToast('success', 'Invite revoked');
      invalidate();
    },
    onError: (error) => showToast('error', 'Revoke failed', error instanceof Error ? error.message : undefined),
  });

  const impersonateMutation = useMutation({
    mutationFn: (id: string) => impersonateUser(id),
    onSuccess: (result) => setImpersonation(result),
    onError: (error) => showToast('error', 'Impersonation failed', error instanceof Error ? error.message : undefined),
  });

  const bannerCreateMutation = useMutation({
    mutationFn: () =>
      createBanner({
        title: bannerForm.title.trim(),
        body: bannerForm.body.trim(),
        level: bannerForm.level,
      }),
    onSuccess: () => {
      showToast('success', 'Banner published');
      setBannerForm({ title: '', body: '', level: 'info' });
      invalidate();
    },
    onError: (error) => showToast('error', 'Create failed', error instanceof Error ? error.message : undefined),
  });

  const bannerToggleMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => updateBanner(id, { active }),
    onSuccess: () => invalidate(),
    onError: (error) => showToast('error', 'Update failed', error instanceof Error ? error.message : undefined),
  });

  const bannerDeleteMutation = useMutation({
    mutationFn: (id: string) => deleteBanner(id),
    onSuccess: () => {
      showToast('success', 'Banner deleted');
      invalidate();
    },
    onError: (error) => showToast('error', 'Delete failed', error instanceof Error ? error.message : undefined),
  });

  const approvalMutation = useMutation({
    mutationFn: ({ id, approved }: { id: string; approved: boolean }) => setProjectApproval(id, approved),
    onSuccess: (_, vars) => {
      showToast('success', vars.approved ? 'Project approved' : 'Project unapproved');
      invalidate();
    },
    onError: (error) => showToast('error', 'Update failed', error instanceof Error ? error.message : undefined),
  });

  const adminMutation = useMutation({
    mutationFn: ({ id, isAdmin }: { id: string; isAdmin: boolean }) => setUserAdmin(id, isAdmin),
    onSuccess: (_, vars) => {
      showToast('success', vars.isAdmin ? 'Admin granted' : 'Admin revoked');
      invalidate();
    },
    onError: (error) => showToast('error', 'Update failed', error instanceof Error ? error.message : undefined),
  });

  const editMutation = useMutation({
    mutationFn: () =>
      updateProject(editingProject!.id, {
        name: editForm.name.trim(),
        description: editForm.description.trim(),
      }),
    onSuccess: () => {
      showToast('success', 'Project updated');
      setEditingProject(null);
      invalidate();
    },
    onError: (error) => showToast('error', 'Update failed', error instanceof Error ? error.message : undefined),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteProject(id),
    onSuccess: () => {
      showToast('success', 'Project deleted');
      invalidate();
    },
    onError: (error) => showToast('error', 'Delete failed', error instanceof Error ? error.message : undefined),
  });

  if (isDemoMode) {
    return <DemoRestricted feature="The admin console" />;
  }

  if (overviewQuery.isPending) {
    return <LoadingState message="Loading admin console…" className="py-24" />;
  }

  if (overviewQuery.isError) {
    return (
      <div className="mx-auto max-w-xl px-5 py-24 text-center">
        <ShieldCheck size={28} className="mx-auto text-[var(--error)]" />
        <h1 className="mt-4 font-headline text-lg font-semibold text-[var(--text-primary)]">Admin access required</h1>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          This area is restricted to platform administrators.
        </p>
      </div>
    );
  }

  const overview = overviewQuery.data;
  const stats = overview?.stats ?? {};
  const pending = overview?.pending_projects ?? [];
  const users = usersQuery.data ?? [];
  const allProjects = projectsQuery.data ?? [];
  const banners = bannersQuery.data ?? [];
  const invites = invitesQuery.data ?? [];

  return (
    <div className="w-full px-4 py-6 sm:px-8">
      <SPageHead
        title="Admin Console"
        titleAccent="_"
        sub="Platform overview, project approvals, and user management."
      />

      <div className="grid grid-cols-4 gap-3.5 max-lg:grid-cols-3 max-sm:grid-cols-2">
        {Object.entries(statLabels).map(([key, label]) => (
          <div key={key} className="s-stat">
            <div className="px-4 pb-1 pt-4">
              <p className="text-[10.5px] font-medium uppercase tracking-[0.08em] text-[var(--text-tertiary)]">{label}</p>
              <p className="font-headline mt-3 text-[28px] font-bold leading-none tabular-nums text-[var(--text-primary)]">
                {stats[key] ?? 0}
              </p>
            </div>
            <div className="s-stat-foot mt-3">
              <span>total</span>
            </div>
          </div>
        ))}
      </div>

      <section className="s-card !p-0 mt-6 overflow-hidden">
        <div className="s-cardhead border-b border-[var(--border-subtle)]">
          <span className="s-ibox"><Clock /></span>
          <h2 className="s-t">Pending Approvals</h2>
          <span className="s-trail">
            {pending.length > 0 ? <SPill tone="warn">{pending.length}</SPill> : null}
          </span>
        </div>
        {pending.length > 0 ? (
          <div>
            {pending.map((project) => (
              <div
                key={project.id}
                className="flex items-center gap-4 border-b border-[var(--border-subtle)] px-4 py-3 last:border-b-0"
              >
                <span className="s-ibox !h-7 !w-7"><FolderKanban /></span>
                <div className="min-w-0 flex-1">
                  <Link to={`/projects/${project.id}`} className="text-[13.5px] font-medium text-[var(--text-primary)] hover:underline">
                    {project.name}
                  </Link>
                  <p className="truncate text-[11.5px] text-[var(--text-tertiary)]">{project.description || 'No description'}</p>
                </div>
                <GhostBtn
                  onClick={() => approvalMutation.mutate({ id: project.id, approved: true })}
                  disabled={approvalMutation.isPending}
                >
                  <CheckCircle2 size={13} /> Approve
                </GhostBtn>
              </div>
            ))}
          </div>
        ) : (
          <p className="px-4 py-6 text-center text-[13px] text-[var(--text-tertiary)]">
            Nothing waiting for approval.
          </p>
        )}
      </section>

      <section className="s-card !p-0 mt-6 overflow-hidden">
        <div className="s-cardhead border-b border-[var(--border-subtle)]">
          <span className="s-ibox"><FolderKanban /></span>
          <h2 className="s-t">All Projects</h2>
          <span className="s-trail"><span className="s-chip" style={{ cursor: 'default' }}>{allProjects.length}</span></span>
        </div>
        <div>
          {allProjects.map((project) => (
            <div
              key={project.id}
              className="flex items-center gap-4 border-b border-[var(--border-subtle)] px-4 py-3 last:border-b-0"
            >
              <div className="min-w-0 flex-1">
                <Link to={`/projects/${project.id}`} className="text-[13.5px] font-medium text-[var(--text-primary)] hover:underline">
                  {project.name}
                </Link>
                <p className="truncate text-[11.5px] text-[var(--text-tertiary)]">
                  {project.stats?.service_count ?? 0} services · {project.stats?.deployment_count ?? 0} deploys
                </p>
              </div>
              <SPill tone={project.isApproved ? 'ok' : 'warn'}>
                {project.isApproved ? 'public' : 'pending'}
              </SPill>
              <button
                type="button"
                onClick={() => {
                  setEditingProject(project);
                  setEditForm({ name: project.name, description: project.description ?? '' });
                }}
                className="s-icon-btn"
                title="Edit project"
              >
                <Pencil size={12} />
              </button>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(`Delete project "${project.name}"? This removes its services and deployments.`)) {
                    deleteMutation.mutate(project.id);
                  }
                }}
                disabled={deleteMutation.isPending}
                className="s-icon-btn !text-[var(--text-tertiary)] hover:!text-[var(--error)] disabled:opacity-40"
                title="Delete project"
              >
                <Trash2 size={12} />
              </button>
              <QuietBtn
                onClick={() => approvalMutation.mutate({ id: project.id, approved: !project.isApproved })}
                disabled={approvalMutation.isPending}
              >
                {project.isApproved ? 'Unapprove' : 'Approve'}
              </QuietBtn>
            </div>
          ))}
          {allProjects.length === 0 ? (
            <p className="px-4 py-6 text-center text-[13px] text-[var(--text-tertiary)]">No projects yet.</p>
          ) : null}
        </div>
      </section>

      <section className="s-card !p-0 mt-6 overflow-hidden">
        <div className="s-cardhead border-b border-[var(--border-subtle)]">
          <span className="s-ibox"><Megaphone /></span>
          <h2 className="s-t">Announcements</h2>
          <span className="s-trail"><span className="s-chip" style={{ cursor: 'default' }}>{banners.length}</span></span>
        </div>
        <div>
          <div className="flex flex-wrap items-center gap-2 border-b border-[var(--border-subtle)] px-4 py-3">
            <input
              value={bannerForm.title}
              onChange={(e) => setBannerForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Title"
              className="h-9 min-w-48 flex-1 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-3 text-sm focus:border-[var(--accent-primary)]"
            />
            <input
              value={bannerForm.body}
              onChange={(e) => setBannerForm((f) => ({ ...f, body: e.target.value }))}
              placeholder="Body (optional)"
              className="h-9 min-w-48 flex-[2] rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-3 text-sm focus:border-[var(--accent-primary)]"
            />
            <select
              value={bannerForm.level}
              onChange={(e) => setBannerForm((f) => ({ ...f, level: e.target.value as Banner['level'] }))}
              className="h-9 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-2 text-sm"
            >
              <option value="info">info</option>
              <option value="success">success</option>
              <option value="warning">warning</option>
              <option value="error">error</option>
            </select>
            <GhostBtn
              onClick={() => bannerCreateMutation.mutate()}
              disabled={bannerCreateMutation.isPending || bannerForm.title.trim().length === 0}
            >
              {bannerCreateMutation.isPending ? 'Publishing…' : 'Publish'}
            </GhostBtn>
          </div>
          {banners.map((banner) => (
            <div
              key={banner.id}
              className="flex items-center gap-4 border-b border-[var(--border-subtle)] px-4 py-3 last:border-b-0"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] font-medium text-[var(--text-primary)]">{banner.title}</p>
                <p className="truncate text-[11.5px] text-[var(--text-tertiary)]">
                  {banner.level}
                  {banner.body ? ` · ${banner.body}` : ''}
                </p>
              </div>
              <QuietBtn
                onClick={() => bannerToggleMutation.mutate({ id: banner.id, active: !banner.active })}
                disabled={bannerToggleMutation.isPending}
              >
                {banner.active ? 'Deactivate' : 'Activate'}
              </QuietBtn>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(`Delete banner "${banner.title}"?`)) {
                    bannerDeleteMutation.mutate(banner.id);
                  }
                }}
                disabled={bannerDeleteMutation.isPending}
                className="s-icon-btn !text-[var(--text-tertiary)] hover:!text-[var(--error)] disabled:opacity-40"
                title="Delete banner"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
          {banners.length === 0 ? (
            <p className="px-4 py-6 text-center text-[13px] text-[var(--text-tertiary)]">No announcements.</p>
          ) : null}
        </div>
      </section>

      <section className="s-card !p-0 mt-6 overflow-hidden">
        <div className="s-cardhead border-b border-[var(--border-subtle)]">
          <span className="s-ibox"><UserPlus /></span>
          <h2 className="s-t">Team Invites</h2>
          <span className="s-trail"><span className="s-chip" style={{ cursor: 'default' }}>{invites.length}</span></span>
        </div>
        <div>
          <div className="flex flex-wrap items-center gap-2 border-b border-[var(--border-subtle)] px-4 py-3">
            <input
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="Bind to email (optional)"
              type="email"
              className="h-9 min-w-64 flex-1 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-3 text-sm focus:border-[var(--accent-primary)]"
            />
            <GhostBtn
              onClick={() => inviteCreateMutation.mutate()}
              disabled={inviteCreateMutation.isPending}
            >
              {inviteCreateMutation.isPending ? 'Creating…' : 'Create invite link'}
            </GhostBtn>
          </div>
          {inviteLink ? (
            <div className="flex items-center gap-2 border-b border-[var(--border-subtle)] bg-[var(--accent-primary-soft)] px-4 py-2.5">
              <code className="v-mono min-w-0 flex-1 truncate text-[12px] text-[var(--accent-primary)]">{inviteLink}</code>
              <QuietBtn
                onClick={() => {
                  navigator.clipboard?.writeText(inviteLink);
                  showToast('success', 'Link copied');
                }}
              >
                <Copy size={11} /> Copy
              </QuietBtn>
              <QuietBtn onClick={() => setInviteLink(null)}>Dismiss</QuietBtn>
            </div>
          ) : null}
          {invites.map((invite) => {
            const used = Boolean(invite.used_at);
            const expired = !used && invite.expired;
            return (
              <div
                key={invite.id}
                className="flex items-center gap-4 border-b border-[var(--border-subtle)] px-4 py-3 last:border-b-0"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-medium text-[var(--text-primary)]">
                    {invite.email || 'Open invite'}
                  </p>
                  <p className="truncate text-[11.5px] text-[var(--text-tertiary)]">
                    expires {new Date(invite.expires_at).toLocaleString()}
                  </p>
                </div>
                <SPill tone={used ? 'off' : expired ? 'err' : 'ok'}>
                  {used ? 'used' : expired ? 'expired' : 'open'}
                </SPill>
                {!used ? (
                  <QuietBtn
                    onClick={() => inviteRevokeMutation.mutate(invite.id)}
                    disabled={inviteRevokeMutation.isPending}
                    className="hover:!text-[var(--error)] hover:!border-[var(--error)]"
                  >
                    Revoke
                  </QuietBtn>
                ) : null}
              </div>
            );
          })}
          {invites.length === 0 ? (
            <p className="px-4 py-6 text-center text-[13px] text-[var(--text-tertiary)]">No invites yet.</p>
          ) : null}
        </div>
      </section>

      <section className="s-card !p-0 mt-6 mb-10 overflow-hidden">
        <div className="s-cardhead border-b border-[var(--border-subtle)]">
          <span className="s-ibox"><Users /></span>
          <h2 className="s-t">Users</h2>
          <span className="s-trail"><span className="s-chip" style={{ cursor: 'default' }}>{users.length}</span></span>
        </div>
        <div>
          {users.map((user) => (
            <UserRow
              key={user.id}
              user={user}
              isSelf={user.id === myId}
              pending={adminMutation.isPending}
              onToggle={(isAdmin) => adminMutation.mutate({ id: user.id, isAdmin })}
              onImpersonate={user.is_admin || user.id === myId ? undefined : () => impersonateMutation.mutate(user.id)}
            />
          ))}
          {users.length === 0 ? (
            <p className="px-4 py-6 text-center text-[13px] text-[var(--text-tertiary)]">No users.</p>
          ) : null}
        </div>
      </section>

      {impersonation ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg s-card !p-0 overflow-hidden">
            <div className="s-cardhead border-b border-[var(--border-subtle)]">
              <span className="s-ibox"><ShieldCheck /></span>
              <h2 className="s-t">Impersonating {impersonation.user.email}</h2>
              <span className="s-trail">
                <span className="v-mono text-[10.5px] text-[var(--text-muted)]">
                  expires {new Date(impersonation.expires_at).toLocaleString()}
                </span>
              </span>
            </div>
            <div className="space-y-3 px-5 py-4">
              <div className="s-inset flex items-center gap-2 px-3 py-2.5">
                <code className="v-mono min-w-0 flex-1 truncate text-[12px] text-[var(--text-primary)]">
                  {impersonation.token}
                </code>
                <QuietBtn
                  onClick={() => {
                    navigator.clipboard?.writeText(impersonation.token);
                    showToast('success', 'Token copied');
                  }}
                >
                  <Copy size={11} /> Copy
                </QuietBtn>
              </div>
              <p className="text-[12px] leading-relaxed text-[var(--text-tertiary)]">
                Use it as a bearer token — e.g. <code className="text-[var(--text-secondary)]">CONTAINR_TOKEN=&lt;token&gt;
                containr &lt;command&gt;</code> or <code className="text-[var(--text-secondary)]">Authorization: Bearer
                &lt;token&gt;</code>. Requests run with that user's permissions for 15 minutes.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-[var(--border-subtle)] px-5 py-3.5">
              <GhostBtn onClick={() => setImpersonation(null)}>Done</GhostBtn>
            </div>
          </div>
        </div>
      ) : null}

      {editingProject ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md s-card !p-0 overflow-hidden">
            <div className="s-cardhead border-b border-[var(--border-subtle)]">
              <span className="s-ibox"><Pencil /></span>
              <h2 className="s-t">Edit Project</h2>
              <span className="s-trail">
                <span className="v-mono text-[10.5px] text-[var(--text-muted)]">admin edit</span>
              </span>
            </div>
            <div className="space-y-4 px-5 py-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">Name</label>
                <input
                  value={editForm.name}
                  onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                  className="h-10 w-full rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-3 text-sm focus:border-[var(--accent-primary)]"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">Description</label>
                <textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                  rows={3}
                  className="w-full resize-none rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-3 py-2 text-sm focus:border-[var(--accent-primary)]"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-[var(--border-subtle)] px-5 py-3.5">
              <QuietBtn onClick={() => setEditingProject(null)}>Cancel</QuietBtn>
              <GhostBtn
                onClick={() => editMutation.mutate()}
                disabled={editMutation.isPending || editForm.name.trim().length < 2}
              >
                {editMutation.isPending ? 'Saving…' : 'Save'}
              </GhostBtn>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function UserRow({
  user,
  isSelf,
  pending,
  onToggle,
  onImpersonate,
}: {
  user: AdminUser;
  isSelf: boolean;
  pending: boolean;
  onToggle: (isAdmin: boolean) => void;
  onImpersonate?: () => void;
}) {
  return (
    <div className="flex items-center gap-4 border-b border-[var(--border-subtle)] px-4 py-3 last:border-b-0">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--surface-muted)] text-[11px] font-bold text-[var(--text-secondary)]">
        {user.name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13.5px] font-medium text-[var(--text-primary)]">
          {user.name}
          {isSelf ? <span className="ml-2 text-[10.5px] text-[var(--text-tertiary)]">(you)</span> : null}
        </p>
        <p className="truncate text-[11.5px] text-[var(--text-tertiary)]">{user.email}</p>
      </div>
      {user.is_admin ? (
        <SPill tone="info"><ShieldCheck size={10} /> admin</SPill>
      ) : null}
      {onImpersonate ? (
        <QuietBtn onClick={onImpersonate}>Impersonate</QuietBtn>
      ) : null}
      <QuietBtn
        onClick={() => onToggle(!user.is_admin)}
        disabled={pending || isSelf}
        title={isSelf ? 'You cannot change your own admin flag' : undefined}
      >
        {user.is_admin ? (
          <span className="inline-flex items-center gap-1"><XCircle size={12} /> Revoke</span>
        ) : (
          'Make admin'
        )}
      </QuietBtn>
    </div>
  );
}
