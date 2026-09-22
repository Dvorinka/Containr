import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CheckCircle2,
  Clock,
  FolderKanban,
  Pencil,
  ShieldCheck,
  Trash2,
  Users,
  XCircle,
} from 'lucide-react';
import {
  deleteProject,
  getAdminOverview,
  listAdminUsers,
  listProjects,
  setProjectApproval,
  setUserAdmin,
  updateProject,
  type AdminUser,
  type ProjectEntity,
} from '@/lib/api-client';
import { useAuthSession } from '@/lib/use-auth-session';
import { LoadingState, useToast } from '@/shared/components';

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
  const sessionQuery = useAuthSession();
  const myId = sessionQuery.data?.user.id;

  const overviewQuery = useQuery({ queryKey: ['admin-overview'], queryFn: getAdminOverview });
  const usersQuery = useQuery({ queryKey: ['admin-users'], queryFn: listAdminUsers });
  const projectsQuery = useQuery({ queryKey: ['admin-projects'], queryFn: () => listProjects({ limit: 100 }) });
  const [editingProject, setEditingProject] = useState<ProjectEntity | null>(null);
  const [editForm, setEditForm] = useState({ name: '', description: '' });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-overview'] });
    queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    queryClient.invalidateQueries({ queryKey: ['admin-projects'] });
    queryClient.invalidateQueries({ queryKey: ['projects'] });
  };

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

  if (overviewQuery.isPending) {
    return <LoadingState message="Loading admin console…" className="py-24" />;
  }

  if (overviewQuery.isError) {
    return (
      <div className="mx-auto max-w-xl px-5 py-24 text-center">
        <ShieldCheck size={28} className="mx-auto text-[var(--error)]" />
        <h1 className="mt-4 text-lg font-semibold text-[var(--text-primary)]">Admin access required</h1>
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

  return (
    <div className="mx-auto max-w-6xl px-5 py-8">
      <div className="mb-8">
        <h1 className="text-[24px] font-bold tracking-tight text-[var(--text-primary)]">Admin console</h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Platform overview, project approvals, and user management.
        </p>
      </div>

      <div className="grid grid-cols-4 gap-3 max-lg:grid-cols-3 max-sm:grid-cols-2">
        {Object.entries(statLabels).map(([key, label]) => (
          <div
            key={key}
            className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-card)] px-4 py-3.5"
          >
            <p className="text-[20px] font-bold tabular-nums text-[var(--text-primary)]">{stats[key] ?? 0}</p>
            <p className="mt-0.5 text-[10.5px] uppercase tracking-wider text-[var(--text-tertiary)]">{label}</p>
          </div>
        ))}
      </div>

      <section className="mt-8">
        <div className="mb-3 flex items-center gap-2">
          <Clock size={15} className="text-[var(--warning)]" />
          <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">Pending approvals</h2>
          {pending.length > 0 ? (
            <span className="rounded-full bg-[var(--warning-soft)] px-2 py-0.5 text-[10.5px] font-semibold text-[var(--warning)]">
              {pending.length}
            </span>
          ) : null}
        </div>
        {pending.length > 0 ? (
          <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-card)]">
            {pending.map((project) => (
              <div
                key={project.id}
                className="flex items-center gap-4 border-b border-[var(--border-subtle)] px-4 py-3 last:border-b-0"
              >
                <FolderKanban size={15} className="shrink-0 text-[var(--text-tertiary)]" />
                <div className="min-w-0 flex-1">
                  <Link to={`/projects/${project.id}`} className="text-[13.5px] font-medium text-[var(--text-primary)] hover:underline">
                    {project.name}
                  </Link>
                  <p className="truncate text-[11.5px] text-[var(--text-tertiary)]">{project.description || 'No description'}</p>
                </div>
                <button
                  type="button"
                  onClick={() => approvalMutation.mutate({ id: project.id, approved: true })}
                  disabled={approvalMutation.isPending}
                  className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--accent-primary)] px-3 py-1.5 text-[12px] font-semibold text-[var(--accent-on)] disabled:opacity-50"
                >
                  <CheckCircle2 size={13} /> Approve
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-card)] px-4 py-6 text-center text-[13px] text-[var(--text-tertiary)]">
            Nothing waiting for approval.
          </div>
        )}
      </section>

      <section className="mt-8">
        <div className="mb-3 flex items-center gap-2">
          <FolderKanban size={15} className="text-[var(--accent-primary)]" />
          <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">All projects</h2>
        </div>
        <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-card)]">
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
              <span
                className={`rounded-full px-2.5 py-0.5 text-[10.5px] font-semibold ${
                  project.isApproved
                    ? 'bg-[var(--success-soft)] text-[var(--success)]'
                    : 'bg-[var(--warning-soft)] text-[var(--warning)]'
                }`}
              >
                {project.isApproved ? 'public' : 'pending'}
              </span>
              <button
                type="button"
                onClick={() => {
                  setEditingProject(project);
                  setEditForm({ name: project.name, description: project.description ?? '' });
                }}
                className="inline-flex items-center gap-1 rounded-[var(--radius-md)] border border-[var(--border-default)] px-2.5 py-1.5 text-[12px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
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
                className="inline-flex items-center gap-1 rounded-[var(--radius-md)] border border-[var(--error)] px-2.5 py-1.5 text-[12px] font-medium text-[var(--error)] hover:bg-[var(--error-soft)] disabled:opacity-50"
                title="Delete project"
              >
                <Trash2 size={12} />
              </button>
              <button
                type="button"
                onClick={() => approvalMutation.mutate({ id: project.id, approved: !project.isApproved })}
                disabled={approvalMutation.isPending}
                className="rounded-[var(--radius-md)] border border-[var(--border-default)] px-3 py-1.5 text-[12px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-50"
              >
                {project.isApproved ? 'Unapprove' : 'Approve'}
              </button>
            </div>
          ))}
          {allProjects.length === 0 ? (
            <p className="px-4 py-6 text-center text-[13px] text-[var(--text-tertiary)]">No projects yet.</p>
          ) : null}
        </div>
      </section>

      <section className="mt-8 pb-10">
        <div className="mb-3 flex items-center gap-2">
          <Users size={15} className="text-[var(--accent-tertiary)]" />
          <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">Users</h2>
        </div>
        <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-card)]">
          {users.map((user) => (
            <UserRow
              key={user.id}
              user={user}
              isSelf={user.id === myId}
              pending={adminMutation.isPending}
              onToggle={(isAdmin) => adminMutation.mutate({ id: user.id, isAdmin })}
            />
          ))}
          {users.length === 0 ? (
            <p className="px-4 py-6 text-center text-[13px] text-[var(--text-tertiary)]">No users.</p>
          ) : null}
        </div>
      </section>

      {editingProject ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-base)] shadow-2xl">
            <div className="border-b border-[var(--border-subtle)] px-5 py-4">
              <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">Edit project</h2>
              <p className="text-xs text-[var(--text-tertiary)]">Admin edit — changes apply immediately.</p>
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
              <button
                type="button"
                onClick={() => setEditingProject(null)}
                className="rounded-[var(--radius-md)] px-3.5 py-2 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => editMutation.mutate()}
                disabled={editMutation.isPending || editForm.name.trim().length < 2}
                className="rounded-[var(--radius-md)] bg-[var(--accent-primary)] px-4 py-2 text-xs font-semibold text-[var(--accent-on)] disabled:opacity-50"
              >
                {editMutation.isPending ? 'Saving…' : 'Save'}
              </button>
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
}: {
  user: AdminUser;
  isSelf: boolean;
  pending: boolean;
  onToggle: (isAdmin: boolean) => void;
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
        <span className="inline-flex items-center gap-1 rounded-full bg-[var(--accent-primary-soft)] px-2.5 py-0.5 text-[10.5px] font-semibold text-[var(--accent-primary)]">
          <ShieldCheck size={11} /> admin
        </span>
      ) : null}
      <button
        type="button"
        onClick={() => onToggle(!user.is_admin)}
        disabled={pending || isSelf}
        title={isSelf ? 'You cannot change your own admin flag' : undefined}
        className="rounded-[var(--radius-md)] border border-[var(--border-default)] px-3 py-1.5 text-[12px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-40"
      >
        {user.is_admin ? (
          <span className="inline-flex items-center gap-1"><XCircle size={12} /> Revoke</span>
        ) : (
          'Make admin'
        )}
      </button>
    </div>
  );
}
