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
  <a href="#features">Features</a> •
  <a href="#architecture">Architecture</a> •
  <a href="docs/guides/">Guides</a> •
  <a href="CONTRIBUTING.md">Contributing</a>
</p>

## What is Containr?

Containr is an open-source control plane for Docker. It gives you a
project-first deployment workflow — create a project, drop services onto a
visual canvas, wire them together with environment variables, and deploy —
without Kubernetes, without a cloud bill, and without giving up control of
your infrastructure.

The UI is inspired by Railway's project canvas: services appear as nodes,
connections are inferred automatically, and everything — logs, metrics,
deployments, builds — is one click away.

## Features

- **Project canvas** — visual service topology with groups, drag/drop layout,
  and auto-inferred connections
- **Deployments** — Docker-based deploys with history, logs, and rollback
- **Git integration** — deploy from GitHub, GitLab, Bitbucket, or Gitea;
  repository and branch pickers, webhooks, GitHub App support
- **Builds** — build pipeline with live status over WebSocket
- **Service metrics** — real CPU/memory/network telemetry from Docker stats
- **Templates** — one-click service catalog (databases, apps, tooling)
- **Databases** — managed database services with backup/restore actions
- **Cron jobs** — scheduled jobs with execution history
- **Preview environments** — per-project preview deploys
- **Variables & environments** — per-service env vars, production/preview/dev
- **Node monitoring** — host CPU, memory, disk, and network telemetry
- **Security** — audit logs, vulnerability scans, compliance reports
- **Auth** — Better Auth sessions (email + OAuth), per-user resource scoping
- **Self-hosted networking** — Traefik reverse proxy, optional Cloudflare
  Tunnel for exposure without port forwarding

## Architecture

```
app/frontend/   React 19 + Vite + TypeScript + Tailwind + React Flow
app/backend/    Go API (Gin) · PostgreSQL · Redis · Docker SDK · Better Auth sidecar
infra/          Self-hosted compose: Traefik + Cloudflare Tunnel
docs/           Guides, OpenAPI spec, design documents
```

| Component    | Default port |
| ------------ | ------------ |
| Frontend     | 3000 (prod) / 5173 (dev) |
| API          | 8082 |
| Auth sidecar | 3001 |
| PostgreSQL   | 5432 |
| Redis        | 6379 |

## Quick Start

### Docker Compose (everything)

```bash
cp .env.example .env   # fill in secrets
docker compose up -d
```

Frontend at `http://localhost:3000`, API at `http://localhost:8082`.

### Local development

```bash
docker compose up -d postgres redis   # data services only
cd app/backend && go run ./cmd/server # API + embedded auth sidecar
cd app/frontend && npm install && npm run dev
```

Frontend dev server at `http://localhost:5173`.

### Self-hosted with Traefik + Cloudflare Tunnel

See `infra/docker-compose.yml` and
[docs/guides/CLOUDFLARE_SETUP.md](docs/guides/CLOUDFLARE_SETUP.md).

## Configuration

All configuration is via environment variables — see `.env.example`.
Required for production: `JWT_SECRET`, `BETTER_AUTH_SECRET`,
`BETTER_AUTH_INTERNAL_TOKEN`, database and Redis credentials.

**Never commit `.env` or `.env.prod`.** Both are gitignored; if a secret was
ever committed, rotate it.

## Documentation

- [docs/guides/](docs/guides/) — setup, deployment, Cloudflare, autoscaling
- [docs/api/openapi.yaml](docs/api/openapi.yaml) — API contract
- [docs/developers/onboarding.md](docs/developers/onboarding.md) — contributor onboarding
- [docs/design/](docs/design/) — UI design references
- `make help` — common tasks

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Issues and PRs welcome.

## Security

See [SECURITY.md](SECURITY.md). Report vulnerabilities privately — do not
open public issues.

## License

[MIT](LICENSE) © 2026 Tomas Dvorak
