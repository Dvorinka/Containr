# AGENTS.md — Containr

Containr is a self-hosted Docker PaaS (Railway-style). Backend: Go + Gin + PostgreSQL (sqlc) + Redis-compatible cache (Dragonfly) + Docker API. Frontend: React + Vite + TypeScript + React Query. API contract: `docs/api/openapi.yaml` (generated types: `app/frontend/src/generated/api-types.ts`).

This file is for **coding agents working on the repo**. For operating Containr as a deployed product, see `llms.txt`.

## Layout

- `app/backend` — Go monolith. Entrypoints: `cmd/server` (API), `cmd/cli` (`containr` CLI), `cmd/mcp` (`containr-mcp` MCP server).
- `app/backend/internal/api` — Gin handlers + route groups (`routes.go`: public / `read` OptionalAuth / `authed` / `admin`).
- `app/backend/internal/middleware` — `Auth` (JWT + Better Auth session + PAT), `RequireAdmin`, `Idempotency`.
- `app/backend/internal/cli/commands` — all CLI commands; shared `Client`, `Output`, `confirm` helpers live here.
- `app/backend/internal/mcpserver` — declarative MCP tool registry mirroring the API.
- `app/backend/sqlc` — `schema.sql` + `queries/*.sql`; generate via `sqlc generate` into `internal/database/sqlcdb`.
- `app/backend/migrations_goose` — goose migrations (`YYYYMMDDHHMMSS_name.sql`).
- `app/frontend` — React app. Pages under `src/features/`, API calls via `src/lib/api-client.ts`.

## Build / test / verify

```sh
cd app/backend && go build ./... && go vet ./... && go test ./...
cd app/frontend && npx tsc --noEmit && npm run lint && npm run build
cd app/frontend && npm run generate:api   # after any openapi.yaml change
```

Dev stack: Postgres on `:15432` (`containr-postgres-1`), Dragonfly on `:16379` (`containr-dragonfly-1`). Server needs `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `PORT=8080`.

## Conventions that matter

- New endpoints go in the right route group; mutations on `authed`/`admin` get idempotency for free.
- New list endpoints use `pageWindow`/`paginationMeta` (`internal/api/pagination.go`) — cursor + page, `next_cursor` in the envelope.
- New errors use stable codes via `respondError(c, status, code, msg)` in `internal/api/errors.go`.
- New CLI command → also register an MCP tool in `internal/mcpserver/server.go` and document in OpenAPI. All three surfaces ship together.
- Destructive CLI commands must gate on `--yes`/`confirm` via `commands.confirm`; destructive MCP tools require `confirm: true`.
- sqlc: edit `schema.sql` + `queries/*.sql`, run `sqlc generate`, add the goose migration.
- Don't commit secrets. PATs (`cnp_…`) and agent tokens (`cagt_…`) are sha256-hashed at rest; raw values are shown once.
