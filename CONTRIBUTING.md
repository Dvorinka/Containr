# Contributing to Containr

Thanks for your interest in contributing. Containr is a self-hosted deployment
platform — contributions of all sizes are welcome.

## Project Layout

```
app/backend/    Go control-plane API (Gin, PostgreSQL, Redis, Docker SDK)
app/frontend/   React + Vite + TypeScript dashboard
infra/          Self-hosted compose stack (Traefik, Cloudflare Tunnel)
docs/           Guides, API spec, and design documents
templates/      Service template catalog notes
```

## Development Setup

1. Copy `.env.example` to `.env` and fill in values (never commit `.env`).
2. Start Postgres and Redis: `docker compose up -d postgres redis`
3. Backend: `cd app/backend && go run ./cmd/server`
4. Frontend: `cd app/frontend && npm install && npm run dev`

## Checks Before Submitting

- Backend: `cd app/backend && go build ./... && go test ./... && go vet ./...`
- Frontend: `cd app/frontend && npm run build && npm test`
- Compose: `docker compose config -q`

## Conventions

- Reuse existing utilities before adding dependencies.
- Keep handlers thin; business logic lives in `internal/` packages.
- Regenerate API types after schema changes:
  `npm --prefix app/frontend run generate:api`.
- Never commit secrets, tokens, or environment files.
- Write tests for non-trivial logic.

## Pull Requests

- Keep PRs focused — one concern per PR.
- Describe the "why", not just the "what".
- Include a test plan for anything touching deployment, auth, or networking.
