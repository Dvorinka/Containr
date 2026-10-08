# Operations

Day-2 features for running services: scheduled jobs, ad-hoc exec, managed
databases, preview environments, security scans, and high availability.

## Cron jobs

Service detail → **Cron**. Standard 5-field cron expressions (`robfig/cron`
syntax), per-job timezone, enable/disable, manual trigger, and execution
history with captured stdout/stderr.

- The scheduler ticks every minute and runs due jobs via `docker exec`
  (`sh -c <command>`) inside the service's container.
- Executions are retained per-job (`retention` count) and visible in the UI.
- Requires a running container — a stopped service's due job records a
  failure, it does not queue.

```
GET/POST /api/v1/cron-jobs            PUT/DELETE /api/v1/cron-jobs/:id
POST     /api/v1/cron-jobs/:id/trigger
GET      /api/v1/cron-jobs/:id/executions
```

## Exec console

Service detail → **Console**. One-off `sh -c` commands against the running
container: 30s ceiling, 64KB output cap, exit code + captured output shown
per run. Debugging aid — not an interactive shell.

```
POST /api/v1/services/:id/exec  {command}
```

## Managed databases

**/databases** page — provision PostgreSQL/Redis/MySQL/MariaDB/MongoDB/
ClickHouse/Dragonfly as managed containers on the `containr` network.

- Start/stop/restart actions; connection URL with copy.
- **Backups**: manual snapshot now, or set a cron expression
  (`backup_schedule`) — due backups run inside the same scheduler tick as
  cron jobs. Archives live in the `containr-db-backups` volume and are
  downloadable (`GET /databases/:id/backups/:bid/download`) and restorable.
- **Bind to service**: injects `connection_url` into a service's variables
  as a secret (`DATABASE_URL` by default). Redeploy the service afterward —
  variables are read at deploy time.

## Preview environments

Service detail → **Previews**. Create a preview per branch/PR with a TTL,
promote it to production, or delete it.

Current limitation: previews are bookkeeping records — they do not build,
deploy, or route a real container. The generated `*.preview.containr.local`
URL is a placeholder. Real preview runtime is tracked on the roadmap.

## Security scans

**/security** page — pick a project, run a scan (dependency / configuration
/ comprehensive, optionally scoped to one service).

The scanner is heuristic config analysis, not Trivy/Grype: it flags
unpinned image tags, `http://` source/public URLs, `npm install` without
`npm ci`, `pip install` without hashes, `curl|sh` build steps, missing
health checks, and similar smells. Findings get severity badges and can be
resolved or ignored; the page also shows a security score, open/resolved
counts, scan history, and compliance status.

```
POST /api/v1/security/scans     {project_id, service_id?, scan_type}
GET  /api/v1/projects/:id/vulnerabilities
PUT  /api/v1/vulnerabilities/:id          {status: open|resolved|ignored}
GET  /api/v1/projects/:id/security/metrics
GET  /api/v1/projects/:id/security/history
```

## High availability

**/ha** page — manager enable/disable, node/health-check/alert status
cards, manual failover (with confirmation), per-service failover policies
(project → service picker, strategy, min healthy nodes, max failures),
active alerts with resolve, and health check results.

HA state is in-memory like autoscaling — policies and alerts reset on
backend restart.

## Node agents

**/usage** page → *Connect node*: issue a per-node token (`cagt_…`, shown
once), copy the prefilled install command, revoke tokens when done. Agents
register over `POST /api/agents/register` and heartbeat via
`POST /api/agents/heartbeat`.

## Personal access tokens

**Settings → Personal Access Tokens**: issue `cnp_…` bearer tokens for the
CLI, MCP server, and scripts — the same privileges as your account, bounded
by scope. The raw token is shown once at creation; only its SHA-256 hash is
stored.

Scopes:

- `read` — `GET`/`HEAD`/`OPTIONS` only; mutations return `403 SCOPE_INSUFFICIENT`.
- `write` — everything except admin routes.
- `admin` — full access; requires a platform admin account, and the token is
  still capped at the owner's privileges.

A token can never outrank its owner: non-admin scopes report
`is_admin = false` even on admin accounts.

```
GET    /api/v1/user/tokens            list (metadata only, never hashes)
POST   /api/v1/user/tokens            {name, scope?, expires_in_days?} → raw token once
DELETE /api/v1/user/tokens/:id        revoke (owner-scoped)
```

Use as `Authorization: Bearer cnp_…`, or `containr auth login cnp_…`.
Revocation takes effect on the next request; `last_used_at` updates on each
authenticated call.

## Deployment queue

Deployments are serialized per service: a deploy while another is active
lands in `queued` state and promotes when it finishes — deploys, rollbacks,
redeploys, and variable-apply reconciles can never race on the same service.
`POST /deployments/:id/cancel` drops queued work or aborts running builds.
Rows left in-flight by a server restart are marked `failed` on boot.
Webhook-triggered deploys build with `no_cache` by default.

## Secret variables

Variables with `is_secret` are AES-GCM-encrypted at rest (`enc:v1:` prefix).
Key derivation: `SECRETS_KEY` env var if set, else `JWT_SECRET`. Existing
plaintext secrets are encrypted on boot; reads for deploy/exec decrypt
transparently. Rotating the key makes stored secrets unreadable — re-save
them after rotation.
