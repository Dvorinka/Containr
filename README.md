<p align="center">
  <img src="./containr.svg" alt="Containr" width="120">
</p>

<h1 align="center">Containr</h1>

<p align="center">
  Self-hosted platform for deploying and managing containerized services.
  Railway-style project canvases on your own hardware.
</p>

<p align="center">
  <a href="#quick-start">Quick Start</a> •
  <a href="#screenshots">Screenshots</a> •
  <a href="#features">Features</a> •
  <a href="docs/guides/">Guides</a> •
  <a href="CONTRIBUTING.md">Contributing</a>
</p>

<p align="center">
  <a href="https://github.com/Dvorinka/Containr/actions/workflows/ci.yml"><img src="https://github.com/Dvorinka/Containr/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License: MIT"></a>
</p>

Containr is an open-source control plane for Docker. Create a project, drop
services onto a visual canvas, wire them together with environment variables,
and deploy — no Kubernetes, no cloud bill. Services appear as nodes with
auto-inferred connections; logs, metrics, builds, and rollbacks are one
click away.

The platform doubles as a public showcase: visitors browse approved projects
and the template catalog without an account, while owners manage everything
behind sign-in and a platform admin approves, curates, and moderates from a
dedicated console.

## Screenshots

| Projects dashboard | Project canvas |
| --- | --- |
| ![Projects dashboard with host telemetry](docs/screenshots/dashboard.png) | ![Visual service canvas with two services](docs/screenshots/canvas.png) |

| Service detail | Managed databases |
| --- | --- |
| ![Service view with metrics, logs and config tabs](docs/screenshots/service-detail.png) | ![Managed database list showing a running PostgreSQL](docs/screenshots/databases.png) |

## Features

- **Project canvas** — visual service topology, groups, drag/drop, auto-inferred connections, right-click lifecycle actions
- **Public project catalog** — approved projects are browsable anonymously; new projects stay private until an admin approves them
- **Admin console** (`/admin`) — platform stats, project approval/edit/delete, user admin management
- **Private networking** — every project gets an isolated Docker network; services reach each other by name (`web:3000`) and share variables via `${{service.KEY}}` references
- **Deployments & builds** — Docker deploys with history, image rollback, live build status
- **Runtime** — replicas, published ports, domains, health checks, restart policies; start/stop/restart/redeploy from canvas or service page
- **Git integration** — GitHub, GitLab, Bitbucket, Gitea; webhooks, GitHub App
- **Managed databases** — create PostgreSQL, MySQL, MariaDB, MongoDB, Redis, Dragonfly, or ClickHouse directly from `/databases`, with backup/restore
- **Template catalog** — 30 official templates (NocoDB, Plausible, MinIO, n8n, …) plus user-defined templates with JSON upload and owner-scoped edit/delete
- **Metrics** — per-service Docker stats plus host CPU/memory/disk telemetry
- **HA & scaling** — failover policies, node agents, autoscaling rules
- **Auth & security** — Better Auth sessions (email/password self-hosted), audit logs, vulnerability scans
- **Integrated docs** — searchable documentation rendered in-app on the landing page and `/docs`; syncs from GitHub, falls back to a bundled snapshot offline
- **Networking** — Traefik reverse proxy, optional Cloudflare Tunnel

## Access model

| Audience | Can do |
| --- | --- |
| **Anonymous** | Browse approved projects, services, templates, databases, HA status, docs |
| **Signed-in user** | Create/manage own projects, services, databases, templates; view own logs, variables, builds, deployments |
| **Admin** | Everything above plus project approval/moderation, user admin flags, HA manager controls, agent tokens, platform settings |

Logs, variables, exec consoles, and database connection URLs are never
public — they require owner, member, or admin access regardless of a
project's public visibility.

## Quick Start

Requires Docker with the Compose plugin, `openssl`, and `curl`:

```bash
curl -fsSL https://raw.githubusercontent.com/Dvorinka/Containr/main/install.sh | bash
```

Installs into `./containr`, generates secrets, pulls the published `:latest`
images, and starts the stack — UI at `http://localhost:3000`, API at
`http://localhost:8082`. Non-interactive; re-runs never overwrite `.env`.

The platform admin is provisioned at startup from environment variables:

```bash
ADMIN_EMAIL=you@example.com
ADMIN_PASSWORD=<generated>   # keep in a local untracked file
ADMIN_NAME=Your Name         # optional
```

Both the local account and the Better Auth session account are created, so
either sign-in path works. Without `ADMIN_*`, the first registered account
becomes owner; registration then closes automatically. The owner can reopen
it and configure a Cloudflare Tunnel token under **Settings → Platform** —
in-app values override env vars.

Override install defaults with env vars:

```bash
curl -fsSL https://raw.githubusercontent.com/Dvorinka/Containr/main/install.sh | \
  HTTP_PORT=8080 CONTAINR_DIR=/opt/containr bash
```

`CONTAINR_VERSION` pins a release tag, `CONTAINR_REF` selects the git ref for
downloaded files, `CONTAINR_BUILD=1` builds from source. From a git checkout,
`./install.sh` installs in place; plain `docker compose up -d` pulls the same
images (`--build` to compile locally).

Local development and self-hosted deployment (Traefik + Cloudflare Tunnel):
see [docs/guides/](docs/guides/) and `infra/docker-compose.yml`.

## Architecture

```
app/frontend/   React 19 + Vite + TypeScript + Tailwind + React Flow
app/backend/    Go API (Gin) · PostgreSQL · Dragonfly · Docker SDK · Better Auth sidecar
infra/          Self-hosted compose: Traefik + Cloudflare Tunnel
docs/           Guides, OpenAPI spec, design documents
```

All configuration is via environment variables — see `.env.example`. Never
commit `.env` or `.env.prod`; keep generated admin credentials in a local
untracked file (e.g. `admin-credentials.local`). If a secret was ever
committed, rotate it.

## Documentation

- In-app: the landing page and `/docs` render searchable docs — synced from
  this repository, with a bundled snapshot so they are never blank offline
- [docs/guides/](docs/guides/) — setup, deployment, Cloudflare, autoscaling
- [docs/api/openapi.yaml](docs/api/openapi.yaml) — API contract
- [docs/developers/onboarding.md](docs/developers/onboarding.md) — contributor onboarding
- `make help` — common tasks

---

[Contributing](CONTRIBUTING.md) · [Security](SECURITY.md) · [MIT License](LICENSE) © 2026 Tomas Dvorak
