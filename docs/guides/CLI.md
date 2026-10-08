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
services list|get|create|delete|start|stop|restart|redeploy
deploy <service-id>              trigger a deployment
deployments list|get|logs|rollback
logs <service-id> [--follow]     runtime logs (SSE follow)
exec <service-id> -- <cmd>       one-off container command
variables list|set|unset         env vars (secrets masked)
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
