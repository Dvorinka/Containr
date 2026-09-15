# Containr Auth And Shell Design

Date: 2026-04-16

## Scope

Change only `app/frontend` and `app/backend`. Leave legacy root `src/` frontend untouched.

## Auth

Containr uses embedded Better Auth for cookie sessions. Public auth supports only:

- Email/password
- GitHub OAuth
- Google OAuth

Magic links, GitLab, Bitbucket, and Gitea auth are removed from active auth UI and runtime config.

Bootstrap behavior:

- If no local platform users exist, auth UI sends users to first-account registration.
- If at least one local platform user exists, public registration is disabled.
- Existing users can sign in only.
- New users after bootstrap must be created manually inside authenticated platform UI/API.

Backend enforcement:

- Better Auth blocks user creation after bootstrap unless request carries trusted internal token.
- Go API exposes bootstrap status.
- Go API exposes authenticated manual user creation. It creates both Better Auth credentials and local platform user.

## Shell

Desktop sidebar becomes expanded, non-scrollable, and label-first. Primary items:

- Projects
- Templates
- Usage
- People
- Settings
- Docs

Bottom area keeps account access and settings/sign-out. Top logo placeholder links to `/projects`. Support is removed.

## Upgrade

Upgrade control becomes functional. Backend exposes current image/ref status and a pull operation for configured GitHub Container Registry or Docker image refs. Frontend can auto-detect configured image and trigger pull.

## Notifications

Notifications menu shows live operational data from existing build/audit APIs with refresh. It no longer acts as static decoration.

## Theme

Add light mode support by toggling root theme attribute and CSS variables. Keep current dark palette as default.

## Task 7: Host Monitoring And Agents

Add backend/frontend foundation for host telemetry and distributed nodes:

- Monitor server running Containr.
- Store/surface CPU, memory, disk, load, uptime, Docker availability, and node health.
- Reuse existing node agent routes where possible.
- Allow connecting additional VPS, LXC, VM, or bare-metal nodes through agent registration.
- Expose data needed later by autoscaling and distributed placement.

## Validation

Run frontend typecheck/build for `app/frontend`. Run focused Go tests or `go test ./internal/api/... ./internal/middleware/...` from `app/backend` where feasible.
