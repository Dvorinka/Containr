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
