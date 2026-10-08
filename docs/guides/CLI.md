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
volumes list|delete              docker volume inventory + cleanup (admin)
deploy <service-id>              trigger a deployment (--no-cache, --commit-hash, --branch)
deployments list|get|logs|rollback|cancel
logs <service-id> [--follow]     runtime logs (SSE follow)
exec <service-id> -- <cmd>       one-off container command
variables list|set|unset         env vars (secrets masked; --redeploy applies them)
databases list|get|create|delete|action|backup|restore|download-backup
cron list|get|create|delete|trigger|executions
templates list|get|create|delete|deploy
nodes list|get|delete|tokens     node agents + onboarding tokens (admin)
scaling status|policies|services|scale
ha status|alerts|health|policies|enable|disable|failover
security scan|vulnerabilities|metrics
gateway services|keys|analytics  (admin)
admin overview|users|settings|audit-logs
notifications list|read
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
