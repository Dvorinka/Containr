# Containr CLI

The CLI controls every part of a Containr instance — the same API surface
the web UI uses. Build it with `scripts/build-cli.sh` or
`go build ./cmd/cli` from `app/backend`.

## Authentication

Create a personal access token in the web UI under
**Settings → Personal Access Tokens** (or `containr tokens create`), then:

```bash
containr auth login cnp_...                      # verify + store
containr auth login cnp_... --url https://containr.example.com
containr auth login cnp_... --name production    # named profile
containr auth status                             # show active profile + identity
containr auth logout
```

Resolution order for every command: `--token`/`--api-url` flags >
`CONTAINR_TOKEN`/`CONTAINR_API_URL` env > active profile >
`http://localhost:8080/api/v1`. The active profile is `--profile` >
`CONTAINR_PROFILE` > `current_profile` in `~/.containr.yaml`.

## Output and scripting

- `--json` prints the raw API response — safe to pipe and parse.
- `--yes` / `-y` skips confirmation on destructive commands (delete,
  revoke, restore, failover). Non-interactive shells refuse destructive
  commands without it.
- Exit codes are stable: `0` ok, `1` error, `2` auth/permission,
  `3` not found, `4` validation, `5` unreachable.

## Commands

```
auth login|logout|status         token auth and profiles
tokens list|create|revoke        personal access tokens
projects list|get|create|delete
services list|get|create|update|delete|start|stop|restart|redeploy
services clone|move              duplicate config or re-parent a service
services domains list|add|remove|default|check   multi-domain + DNS preflight
registries list|add|update|remove  private-image pull credentials
volumes list|delete              docker volume inventory + cleanup (admin)
deploy <service-id>              trigger a deployment (--no-cache, --commit-hash, --branch)
deployments list|get|logs|rollback|cancel
logs <service-id> [--follow]     runtime logs (SSE follow)
exec <service-id> -- <cmd>       one-off container command
variables list|set|unset         env vars (secrets masked; --redeploy applies them)
variables shared list|set|unset  project shared vars — referenced as ${{shared.KEY}}
databases list|get|create|update|delete|action|backup|restore|download-backup|import-backup
                               import-backup <id> <file.tar.gz|-> uploads an archive as a restore
                               point; ships offsite too when a backup target is assigned
databases list|get|create|update|delete|action|backup|restore|download-backup
                               create --public exposes the port on all interfaces;
                               update <id> --public/--public=false toggles it (container recreates, data persists)
databases register <name>      register an external database (--type --host --port --database --username --password --ssl; probed before storing)
databases test-connection      probe a connection — by id, or ad-hoc flags
backup-targets list|add|update|remove|test
                               S3-compatible archive destinations; add/update probe the bucket
                               first, empty --access-key/--secret-key on update keep stored keys;
                               update <db-id> --backup-target assigns a target ("" clears it)
cron list|get|create|delete|trigger|executions
templates list|get|create|delete|deploy|plan|import-compose|deploy-graph
                               deploy --name --var K=V; plan dry-resolves expressions;
                               import-compose <compose.yml|-> converts a compose file into
                               a v2 graph config; deploy-graph <project-id> <config.json|->
                               deploys an ad-hoc service graph
import compose <project-id> <compose.yml|->
                               deploys a docker-compose file straight into a project —
                               no template row. DB images become managed databases
                               attached under their service name; --var K=V overrides
                               template variables
nodes list|get|delete|tokens     node agents + onboarding tokens (admin)
nodes add <user@host>            SSH bootstrap — one session installs the agent, then never needed again (--print for manual runs)
nodes update|prune|commands      rename/auto-prune, bounded docker prune, command history
migrate railway                  pull a Railway project (services, vars, domains) via GraphQL and recreate it — --dry-run prints the plan
migrate dflow                    import a dflow project (services, vars, volumes, domains) via its Payload REST API — needs --url + --api-key, --dry-run prints the plan
scaling status|policies|services|scale
ha status|alerts|health|policies|enable|disable|failover
security scan|vulnerabilities|metrics
gateway services|keys|analytics  (admin)
admin overview|users|settings|audit-logs
notifications list|read
webhooks list|create|update|delete|deliveries|test
                               outbound signed webhooks — create <name> <url>
                               --event 'service.*' (repeatable, '*' = all);
                               deliveries are HMAC-signed (X-Containr-Signature)
operations                       live ops view: active deploys, queue depth,
                               24h failures, cron runs, backups
activity                         enriched activity feed; --severity/--category/
                               --resource/--project/--limit filters
shell <service-id>               interactive PTY shell inside the service
                               container (bash→sh fallback; resizes follow)
banners list|create|update|delete  announcement banners (admin);
                               active banners print on `auth status`
invites list|create|revoke       team invite links (admin); create
                               prints the one-time acceptance URL
admin impersonate <id>           mint a 15-min token acting as a user
admin github-app status|manifest|convert
                               self-provision the instance GitHub App
up                               deploy the current directory
```

## containr up

Run inside a git checkout: uses `remote.origin.url` + the current branch
as the build source, creates a service named after the directory when none
exists, then triggers a deployment.

```bash
containr up --project <id>
containr up --project <id> --image ghcr.io/example/app:latest   # image, no build
```

Set `project_id` on the active profile to omit `--project` (stored in
`~/.containr.yaml` under `profiles.<name>.project_id`).

## Service volumes

`services update` manages mounts; flags replace the whole mount list:

```bash
containr services update <id> --volume data:/data --bind /srv/cfg:/etc/app:ro
containr services update <id> --clear-volumes
```

`type` is `volume` (docker named volume, auto-created) or `bind` (host
path). `target` must be absolute. Mounts apply on the next deploy or
redeploy — `containr deploy <id>` to apply immediately.

`volumes list` shows the node's docker volume inventory with in-use
flags; `volumes delete <name>` removes an unused volume (admin scope).

## Node placement

Pin a service to a registered node agent, or let the scheduler pick the
least-loaded online node:

```bash
containr services create --project <id> --name api --image ghcr.io/x/api:v1 --node <agent-id>
containr services update <id> --node auto    # least-loaded online node
containr services update <id> --node local   # move back to this server
```

`auto` scores nodes by real headroom — lowest memory utilisation, then
cpu, then container count. Or spread replicas across every online,
schedulable node (mutually exclusive with a pin):

```bash
containr services update <id> --replicas 4 --spread    # replica i → node[i % n]
containr services update <id> --spread=false           # back to single placement
```

Constrain `auto`/`spread` placement to nodes carrying operator tags —
`nodes update` labels a node, `--placement-tags` requires every listed tag
(mutually exclusive with a pin; an empty value clears the requirement):

```bash
containr nodes update <id> --tags gpu,eu-west
containr services update <id> --placement-tags gpu     # only gpu nodes are eligible
```

Remote nodes run registry-pulled images only — git builds, domains
(Traefik lives on the host), and sleep detection stay local. Start,
stop, restart, redeploy, and delete all fan out to the pinned node's
agent. `services get` shows the resolved `node_name`.

Take a node out of rotation or empty it entirely (admin):

```bash
containr nodes cordon <id>    # no new pins; running replicas stay
containr nodes uncordon <id>
containr nodes drain <id>     # cordon + remove its containers + unpin services
containr nodes upgrade <id>   # agent pulls its replacement from the server, re-execs
```

`nodes upgrade` swaps the agent binary for the one bundled in the running
server image — the agent downloads it over the API, verifies the sha256 the
server computed, sanity-checks it, atomically replaces its own executable,
and re-execs. The node must be online and the server must ship a binary for
its architecture (`linux-amd64`/`linux-arm64`).

## Service domains and access

A service can carry multiple hostnames; the default is mirrored to
`services.domain`:

```bash
containr services domains add <id> app.example.com --default
containr services domains check <id>      # DNS preflight per domain
containr services domains remove <id> <domain-id>
```

DNS check compares each domain to the expected target — set
`app_settings.public_ip` (or `PUBLIC_IP` env) so `wrong-target` is
meaningful; without it any resolvable domain reports `ok`.

Access gates apply via Traefik middlewares (no extra proxy):

```bash
containr services update <id> --maintenance on
containr services update <id> --basic-auth admin:secret --basic-auth ops:pw2
```

Maintenance mode redirects all traffic to `<BASE_URL>/api/v1/maintenance`
— set `app_settings.base_url` or `BASE_URL`; without it the service is
taken offline with empty responses. Basic-auth credentials are stored
bcrypt-hashed (htpasswd) and gate every request.

## Build strategy and resources

Source-built services pick a builder per service:

```bash
containr services update <id> --builder railpack   # auto|railpack|nixpacks|dockerfile|static
containr services update <id> --builder static --static-cmd "npm run build" --static-dir dist
```

`auto` detects from repo contents (Dockerfile → railpack → nixpacks).
`static` builds assets in a node stage and serves them from nginx —
`--static-cmd` runs inside the build stage (default
`npm ci && npm run build`), `--static-dir` is copied into the nginx image
(default `dist`, exposed on port 80).

Resource reservations complement the hard `cpu`/`memory` limits:

```bash
containr services update <id> --cpu-reserve 0.25 --memory-reserve 128Mi
```

`cpu`/`memory` are hard caps (NanoCPUs/Memory); `cpu_reserve`/
`memory_reserve` are soft hints (CPU shares, MemoryReservation). Empty
string clears. `app_settings.default_cpu`/`default_memory` change the
instance-level defaults used at service creation;
`app_settings.capacity_policy=block` fails deployments whose requested
memory exceeds node capacity (default `warn` logs only).

## Sleep mode (scale-to-zero)

Services can scale to zero after an idle window and resume on traffic:

```bash
containr services update <id> --sleep --sleep-idle 15   # enable, 15 min idle timeout
containr services update <id> --sleep=false            # disable
containr services sleep <id>                           # sleep now
containr services wake <id>                            # resume now
containr services env-check <id>                      # flag empty vars + unresolved ${{refs}}
```

Idleness is measured as flat container network I/O over the configured
window (swept every 30s). Sleeping removes the workload containers and —
when the service has domains — installs a busybox placeholder that holds
the Traefik route at higher priority, serves a reloading "waking" page,
and pings `GET /api/v1/internal/wake/:id` to reconcile the service back.
The API must be reachable from containers for the callback (containerized
deploys work via the shared network; bare-metal needs `HOST=0.0.0.0`).

## Clone, move, registries

`services clone` duplicates config, volumes, domains, access gates,
builder settings, and variables — ciphertext secret values are copied
verbatim (no decrypt/re-encrypt). The clone starts stopped:

```bash
containr services clone <id> --name staging-api --project <other-project-id> --environment preview
containr services move <id> <project-id>    # name conflicts → 409
```

Note: cloned domains are verbatim copies — the same hostname attached to
two services makes Traefik routing ambiguous. Re-domain or undeploy one.

`registries` stores private-image pull credentials, owner-scoped and
encrypted at rest. Matched by image host on every image-sourced deploy:

```bash
containr registries add ghcr ghcr.io --username <user> --password <pat>
containr registries add hub docker.io --username <user> --password <pw>   # Docker Hub
containr registries update <id> --username <new-user>   # empty --password keeps stored
containr registries remove <id>
```

## MCP server

`containr-mcp` (`go build ./cmd/mcp`) exposes the same API as MCP tools
over stdio — every command group above maps to a `containr_*` tool
(~60 tools). Destructive tools require the caller to pass
`confirm: true`; results are pretty JSON with `isError` on failures.

Client configuration (Claude Code, Cursor, Devin, any stdio MCP host):

```json
{
  "mcpServers": {
    "containr": {
      "command": "containr-mcp",
      "env": {
        "CONTAINR_API_URL": "https://containr.example.com",
        "CONTAINR_TOKEN": "cnp_..."
      }
    }
  }
}
```

Scope the token deliberately: `read` is enough for inspection agents,
`write` for deploy automation, `admin` only for platform operations.

Deployments are serialized per service: a second `deploy` on a busy
service lands in `queued` state and runs when the active one finishes.
`deployments cancel <id>` drops a queued deployment or aborts a running
one (builds/reconciles stop via context cancellation).
