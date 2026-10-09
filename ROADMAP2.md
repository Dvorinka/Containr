# Containr — Roadmap 2: The dflow Convergence

Last verified: **2026-10-08** — deep pass over the full dflow codebase
(`~/Desktop/PROG+HTML/dflow`, community fork of dflow-sh/dflow, frozen for
preservation) against Containr `main` (`15b5b0e`).

Goal: make Containr the superior successor — absorb everything worth having
from dflow, then go past it and past Railway. Same power for humans and
agents: the UI is the friendly face, the CLI and MCP are the machine face,
all three sit on the same API. **Branding stays Containr/Vertice** —
white-labeling is an admin option, not an identity change.

---

## 1. What dflow actually is (verified)

Next.js 15 + PayloadCMS 3 + MongoDB + Redis/BullMQ. Runtime model: every
host is a remote server driven **over SSH** with Dokku auto-installed as the
per-app container manager. Async work = 43 BullMQ queue processors
(`src/queues/**`), live logs via Redis pub/sub → SSE endpoint, persisted to
deployment records. ~30 collections, ~180 server actions, 11 dashboard
routes per service (general, deployments, logs, environment, domains,
volumes, proxy, scaling, backups, settings).

### Full capability matrix — dflow → Containr

Legend: ✅ done · 🟡 partial/different · ❌ missing · ➖ not applicable (dokku/SSH-specific)

#### Deployment pipeline
| dflow capability | Containr status | Action |
|---|---|---|
| Queued deployments, serialized per server, cancellable while queued | ❌ goroutine fire-and-forget; `CancelDeployment` exists in engine but is **never routed** | Add deploy queue + cancel route |
| Deployment states `queued → building → success/failed`, live SSE logs + persisted record | 🟡 states exist (`building→running`); WS streams builds; no queued state | Extend status + stream |
| Redeploy cache modes (`ps:rebuild` vs fresh pull); webhook pushes force `no-cache` | ❌ always rebuilds | Add `cache` flag on deploy/redeploy |
| Cancel queued deployment from UI | ❌ (engine fn unrouted) | Route it |
| Per-service job ordering | ❌ concurrent deploys of one service can race | Serialize per service |

#### Service configuration
| dflow capability | Containr status | Action |
|---|---|---|
| Multi-domain per service + default flag + cert type | ❌ single `services.domain` | `service_domains` table |
| Cert types: letsencrypt / none / Cloudflare Origin / **CF-for-SaaS custom hostnames** | 🟡 Traefik ACME only | LE default; CF custom hostnames deferred (only needed if hosting tenant domains) |
| DNS preflight check (`checkDNSConfigAction`) | ❌ | `GET /services/:id/domains/check` |
| Volumes per service + dangling-volume browser/attach/delete | ❌ engine supports `VolumeMounts`; no API/UI | `services.volumes` jsonb + Volumes tab |
| Resource **limits and reservations**, per-server defaults | 🟡 `cpu_limit`/`memory_limit` int columns (unclear units) | explicit string units + reserves + instance defaults |
| Pre-deploy capacity check (dokku binary interceptor) | ❌ | Node capacity check pre-deploy/scale |
| Maintenance mode toggle | ❌ | Traefik middleware label |
| Basic-auth gate per service (`toggleHttpAuth`) | ❌ | Traefik basic-auth middleware |
| Raw proxy config override (`setServiceNginxConfig`) | ❌ | Allowlisted `traefik_labels` jsonb |
| Service clone (full config copy) | ❌ | `POST /services/:id/clone` |
| Move service between projects (`SwitchServiceProjectDialog`) | ❌ | `PUT /services/:id {project_id}` |
| Env var save → hot-apply + optional restart (`noRestart`) | ❌ rows rewritten; containers keep stale env until manual redeploy | Apply→redeploy flow |
| Static-site builder; Heroku buildpacks | 🟡 railpack/nixpacks/dockerfile auto-detect, no user override | `services.builder` enum + static builder |
| Docker registry accounts (private registries) | ❌ | `registry_credentials` per service/instance |

#### Databases
| dflow capability | Containr status | Action |
|---|---|---|
| Managed DBs (pg/mysql/mariadb/mongo/redis/clickhouse via dokku plugins) | ✅ plus dragonfly | — |
| **External DB registration** (Neon/Atlas/RDS conn details + test) | ❌ | `provider=external` + test endpoint |
| Internal backups + restore (same-type enforced) | ✅ | — |
| Scheduled backups | ✅ cron field | — |
| **External S3 backups** (auth/schedule/unschedule ops) | ❌ | `backup_targets` + shipper |
| **Cross-server DB migration** (export → sftp hop → import) | ❌ | `POST /databases/:id/migrate` |
| Public DB port expose/unexpose | ❌ loopback only | opt-in TCP expose |
| DB → service env linking (`dokku link`) | ✅ Bind action injects `DATABASE_URL` | — |

#### Servers / infrastructure
| dflow capability | Containr status | Action |
|---|---|---|
| Attach server = paste IP + SSH key; Dokku auto-installs | 🟡 agents exist, manual install | **SSH bootstrap**: one SSH session installs agent, never needed again |
| Tailscale/Headscale, NetBird, ZeroTier enroll + mesh connect | ❌ | Agent mesh-IP detection first; auth-key enroll optional |
| AWS EC2 + Hetzner provisioning w/ cloud-init | ❌ | IaC (ROADMAP §2.2): Terraform Proxmox/AWS + Hetzner module |
| Security groups (AWS SG rules, sync) | ❌ | Under IaC provider modules |
| Server-level global/wildcard domain (`updateServerDomain`) | ❌ | `nodes.default_domain` |
| Scheduled server cleanup (dokku cleanup → docker prune) | ❌ | Agent `prune` command + schedule |
| Queue flush/inspect per server (`flushServerQueues`, `getServerQueues`) | ➖ no queue yet | Ops page shows jobs once queue exists |
| Arbitrary SSH command on server (`executeCommand`) | ➖ exec is container-scoped | Node terminal via agent (PTY) |
| Server onboarding wizard, reset, cleanup-on-delete | 🟡 token issue/revoke only | Onboarding flow + `nodes add` UX |
| Ansible playbooks (stored, runnable per server, exec history) | ➖ | **Defer** — security surface; SSH bootstrap covers provisioning |
| Per-node resource dashboards | 🟡 heartbeat telemetry exists | Node detail page |

#### Platform / org
| dflow capability | Containr status | Action |
|---|---|---|
| Multi-tenant organisations + custom RBAC (per-resource CRUD, create-limits, read-scope) | 🟡 `is_admin` + `project_members` | Defer full RBAC; design PAT scopes role-compatible |
| Team invite links/emails | 🟡 manual user create only | `POST /invites` → link join |
| User API keys → full REST API | ❌ **the big gap** — session/JWT only | PATs (Phase A) |
| Outbound webhooks (collection events, HMAC, custom headers) | ✅ `outbound_webhooks` + `webhook_deliveries`, HMAC `X-Containr-Signature`, wildcard events, 3-retry, UI page | — |
| Banners (global + per-tenant, dismissible) | ❌ | `banners` table + top bar |
| White-label (logo/favicon/title/OG/theme colors) | ❌ | `app_settings.branding` — **Containr remains the default brand** |
| Activity feed (icon/severity/category/metadata, 90-day TTL job) | ✅ `/activity` + project view | — |
| Admin metrics dashboard (users/servers/queued/failed counts) | 🟡 `/admin` exists | Extend |
| **Impersonate user** | ✅ admin token + `impersonated_by` claim (browser swap pending) | Done (CLI/API/MCP) |
| In-app docs (content-collections markdown) | ✅ `/docs` | — |
| Dynamic client-side filter framework (535-line `filter.utils`) | ✅ `dynamic-filter.ts` + URL state; audit/builds/activity | Done |
| Ops "bubble" (queue monitor, terminal, sync) | ✅ `/operations` + interactive terminal | Done |

#### Agent surface
| dflow capability | Containr status | Action |
|---|---|---|
| Payload REST/GraphQL auto-API + per-user API keys | ❌ | PATs + OpenAPI (better: typed, documented) |
| CLI | ❌ | none in dflow — **Containr CLI is a genuine leap past it** |
| MCP | ❌ | none — same leap |
| Railway migrator script | ❌ | `containr migrate railway` |
| GitHub App **manifest flow** (instance self-provisions the App) | ✅ manifest + convert + App webhook | Done |
| fork-sync webhook deploy trigger | ✅ sync/repository_dispatch/workflow_run | Done |
| Azure DevOps provider | ❌ | Optional (dflow does token-clone only) |

---

## 2. The spine: agent-first platform

*Agent and user on the same level.* Concretely:

- Every operation reachable by a **personal access token**, not just
  sessions.
- Every operation in the **CLI** with `--json`, stable exit codes, `--yes`.
- Every operation in an **MCP server** (stdio first) so Devin/Claude Code/
  Cursor/Codex drive Containr natively.
- `openapi.yaml` stays the single source of truth; UI, CLI, MCP are thin
  clients.

### Phase A — Agent surface (do this FIRST; everything after inherits it) ✅ SHIPPED (PRs #14–#18)

- [x] **Personal access tokens.** `user_tokens` table — `id`, `user_id`,
  `name`, `key_prefix` (`cnp_…`), `key_hash` (sha256), `scopes`
  (`read`/`write`/`admin`, later resource-scoped), `expires_at`,
  `last_used_at`. Model on `agent_auth_tokens` (raw shown once, hash stored).
  `POST/GET/DELETE /api/v1/user/tokens`; `middleware.Auth` accepts
  `Bearer cnp_…`; Settings → Access tokens UI with one-time display +
  copyable CLI/MCP config snippets.
- [x] **CLI v2.** Current `cmd/cli` is auth + projects only. Full client:
  - `auth login [--token] [--url] [--profile]` (multi-instance profiles).
  - Resources: `projects services deploy logs exec variables databases
    cron templates nodes scaling ha security gateway notifications
    webhooks domains volumes backups admin`.
  - `containr up` / `deploy` — cwd→service create-or-update→watch
    (the `railway up` equivalent; single most important command).
  - `containr link` (bind cwd→service), `containr open`, `containr run`,
    `containr shell` (PTY once exec upgrade lands), `completion`.
  - Universal `--json`, `-o yaml`, `--watch`, `--yes`; exit codes
    0/1/2/3/4 (ok/err/not-found/unauthorized/conflict).
  - GoReleaser → GH releases + `install.sh`; `version` command.
  - Conventions from docsync/envdiff/cix/repolint.
- [x] **MCP server** (`cmd/mcp`, same module, stdio). Tools mirror the
  CLI: `list_projects create_service deploy get_logs set_variable
  restart rollback create_database trigger_cron deploy_template exec
  get_metrics security_scan …`. Auth: `CONTAINR_URL` + `CONTAINR_TOKEN`
  or shared `~/.containr/config`. `containr mcp serve` + install snippets
  for Devin/Claude/Cursor.
- [x] **API agent ergonomics.** `Idempotency-Key` on mutating endpoints;
  uniform `{error, code, details}` envelope (audit bare-string returns);
  cursor pagination on growing lists; name-or-id lookup everywhere.
- [x] **Agent docs.** Root `AGENTS.md`, `/docs` serves `llms.txt` +
  `llms-full.txt`, MCP tool list generated from OpenAPI where possible.

**Gate**: an agent holding only a PAT registers a project, deploys from a
git repo, streams logs, sets vars, rolls back — zero UI. Same via CLI
for a human.

---

## 3. Phase B — Deployment pipeline maturity ✅ SHIPPED (PR #19)

dflow's one real architectural edge. Containr deploys are fire-and-forget
goroutines; this fixes correctness *and* unlocks the ops surface.

- [x] **Deploy job queue.** Lightweight internal queue — per-service
  FIFO in `internal/deployqueue`; status gains `queued`.
- [x] **Cancel deployments.** `POST /deployments/:id/cancel` — queued
  jobs cancel immediately, active jobs cancel context; `cancelled` status.
- [x] **Cache modes.** `no_cache` on deploys; webhook-triggered deploys
  default to no-cache (dflow convention — prevents stale-layer surprises).
- [x] **Queued→building→running status + persisted step logs.** `queued`
  state lands; streaming over existing log surface.
- [x] **Env var apply → redeploy.** `--redeploy` flag on variable writes;
  backend requeues honoring running state.
- [x] **Encrypt variables at rest.** `is_secret` values encrypted
  AES-GCM `enc:v1:` (key from `SECRETS_KEY`); masked-echo preserves
  ciphertext.

## 4. Phase C — Service configuration parity ✅ SHIPPED (PRs #20–#23)

- [x] **Volumes on services** — `services.volumes` jsonb
  `[{volume|host_path, container_path, read_only}]`; Volumes tab +
  admin volume inventory.
- [x] **Multi-domain** — `service_domains(service_id, domain, is_default,
  cert_type, status, last_checked_at)`. Domains UI: add/remove/
  set-default/DNS-status badge. `services.domain` stays derived default.
- [x] **DNS preflight** — `GET /services/:id/domains/check` resolves and
  compares vs edge IP → `ok|wrong-target|pending`.
- [x] **Maintenance mode + basic-auth gate** — Traefik middleware labels;
  no proxy code needed.
- [ ] **Routing overrides** — `services.traefik_labels` jsonb with
  allowlist validation (middlewares, headers, redirects).
- [x] **Builder override** — `services.builder` enum
  `auto|railpack|nixpacks|dockerfile|static`; static builder = build +
  nginx serve. Fixed hardcoded `nixpacks` + `BuildImage` stream drain bug.
- [x] **Resource limits + reserves** — `cpu`/`memory` caps +
  `cpu_reserve`/`memory_reserve` → NanoCPUs/Memory/MemoryReservation;
  instance defaults in `app_settings`.
- [x] **Pre-deploy capacity check** — reservations vs node capacity;
  `app_settings.capacity_policy=block` rejects, default warns.
- [x] **Service clone** + **move between projects** — copies volumes,
  domains, access gates, vars (ciphertext verbatim); audit-logged.
- [x] **Private registries** — `registry_credentials`
  (server/username/secret, encrypted); pull auth resolved at deploy;
  per-service registry link.
- [x] **Service detail tabs to match dflow's surface**: Domains,
  Volumes, access-controls sections added to the service page.

## 5. Phase D — Data layer maturity

- [x] **External DB registration** — `provider='managed'|'external'`,
  conn fields, `POST /databases/test-connection`, same bind flow. (PR #24)
- [x] **Public DB port expose** — `public_port` opt-in `0.0.0.0` host
  bind; default stays loopback. (PR #25)
- [x] **Offsite backups** — `backup_targets` (S3-compatible:
  endpoint/bucket/keys encrypted); per-DB destination; archives shipped
  via holder container + minio-go; restore-from-S3 fallback. (PR #26)
- [ ] **Cross-node DB migration** — `POST /databases/:id/migrate
  {target_node_id}`: dump → stream transfer → provision → restore →
  re-point bound services. Deferred until Phase F lands real second
  nodes — nothing to migrate between today.
- [ ] **Backup import** — upload archive → new restore point (pairs with
  migrators).

## 6. Phase E — Templates v2 (absorbs compose-catalog spec + dflow graph templates)

- [ ] **Template = ordered service graph** — `services[]` entries with
  `{name, type, source, build, ports, volumes, variables, depends_on}`;
  deploy order from dependency refs.
- [ ] **Expressions** — `${{service.KEY}}` (already the runtime ref
  syntax — reuse), `{{secret(len,"charset")}}`, `{{random:int}}`,
  `{{VAR:-default}}`; `POST /templates/:id/plan` returns the resolved
  graph without deploying (agents love this).
- [ ] **Compose import** — `POST /templates/import/compose` (compose-go
  parser → graph), `POST /templates/import/github` (compose file from
  repo path). Implements `docs/superpowers/specs/2026-04-14-*`.
- [ ] **Graph deploy pipeline** — creates project + services in
  dependency order, resolves vars, triggers builds; defined
  partial-failure policy.
- [ ] **Visual template builder** — canvas mode: drop git/image/db
  nodes, wire refs, set order, save/publish. Reuses existing canvas
  primitives (dflow's `templates/compose` is exactly this).
- [ ] **Catalog growth** — convert `templates/*.md` (20 app guides) into
  real graph templates; screenshots + badges per the old spec.

**Gate**: paste n8n compose → 3-service project with generated secrets
and wired refs, one click or one CLI call.

## 7. Phase F — Nodes & infrastructure

- [x] **SSH bootstrap install** — `containr nodes add <user@host>` mints an
  enroll token, SSHes once (agent/key/default keys), runs
  `GET /api/agents/install.sh | bash` remotely, closes the session.
  `--print` emits the one-liner for manual runs; the Usage page shows the
  same command. Agent binaries ship in the image under `/agents` and are
  served at `/api/agents/download/{linux-amd64,linux-arm64}` (install
  script falls back to GH releases). `cli/commands/nodes_add.go`,
  `api/assets/install-agent.sh`, `agents.go:ServeInstallScript`/`ServeAgentBinary`.
- [x] **Mesh awareness** — agent reports tailscale/netbird/wireguard/
  zerotier interface IPs at register (`mesh` field, authoritative on
  re-register), stored in `node_agents.metadata.mesh`, shown on the node
  detail page. `TAILSCALE_AUTH_KEY` enroll-at-provision still open.
- [x] **Node detail page** — `/nodes/:id` (admin): heartbeat telemetry
  (cpu/mem sparklines over 1h/24h/7d via `GET /agents/:id/metrics`),
  containers, command history, rename, auto-prune toggle, prune-now,
  remove. Drain/cordon and self-upgrade deferred — they need
  `services.node_id` routing which lands with multi-node scheduling.
- [x] **Node housekeeping** — agent `prune` + `system_df` commands
  (`docker system prune -af`, volumes excluded unless requested, optional
  `--until`). `node_agents.auto_prune` + the health sweep enqueue a prune
  at most once per 24h per node. Surfaces: `POST /agents/:id/prune`,
  `nodes update --auto-prune` / `nodes prune [--volumes --until]` /
  `nodes commands`, MCP `containr_nodes_update|prune|commands`
  (confirm-gated), Usage-page per-node Prune button + auto toggle.
  `cmd/agent/main.go`, `notification_producers.go:scheduleAutoPrune`.
- [🟡] **Multi-node scheduling** — phase 1 shipped: `services.node_id`
  pin (explicit / `auto` = least-loaded online / `local` = clear),
  `NodeRunner` seam in the deploy engine routes reconcile to the agent's
  command queue (`create_container` with image/env/cmd/ports/volumes/
  labels/limits), `container_instances` inventory per (agent, service,
  replica), remote stop/start/restart/delete fan-out, `GET
  /nodes/options`, `--node` on services create/update + MCP + OpenAPI +
  service-detail Placement section. Drain/cordon shipped:
  `node_agents.schedulable`, `POST /agents/:id/cordon|uncordon|drain`
  (drain evicts remote containers via the agent queue + unpins services
  so they redeploy locally), `nodes cordon|uncordon|drain` CLI +
  MCP (drain confirm-gated) + node-detail page controls; `auto` and
  explicit pins skip cordoned nodes. Remote nodes run registry-pulled
  images only — git builds, Traefik domains, and remote sleep are
  documented ceilings. Remaining: `scheduling_rules` spread/affinity
  policies, deployment status reported back from agent
  results, per-node resource-aware `auto` (currently count-based).
- [🟡] **Build-on-node** — private registry pulls shipped: the dispatch
  payload carries the project owner's `registries` credentials for the
  image host; the agent `docker login`s for the pull and logs out after,
  and command payloads are scrubbed of passwords on completion. Agent
  also verifies the container is still running ~1.5s after `run` so
  crash-loops fail the deploy instead of reporting healthy. Remaining:
  real builds on the node (source checkout + build daemon) — pulls
  already work.
- [ ] **IaC provisioning (ROADMAP §2.2, unchanged)** — Terraform/
  OpenTofu, `infra_connections`, Proxmox + AWS modules, + Hetzner module
  (dflow's second provider), cloud-init → auto-enroll.
- [ ] **Global/wildcard domain per node** (`nodes.default_domain`) —
  auto-domains for services on that node.

## 8. Phase G — Platform polish

- [x] **Outbound webhooks** — `outbound_webhooks(url, secret, events[],
  headers, enabled)` + `webhook_deliveries` log; HMAC
  `X-Containr-Signature`; wildcard events on every audited action;
  CLI + MCP + `/settings/webhooks` page with delivery log + test ping.
- [x] **Activity feed** — `audit_logs` enriched with `severity`
  (`info|success|warning|error`), `category`, human `label`; derived at
  write time, classified on read for legacy rows, boot-time backfill.
  `GET /activity` (global, visibility-scoped, filters + `since`) and
  `GET /projects/:id/activity` (owner/member/approved/admin). Frontend:
  `/activity` page with severity chips + project workspace `Activity`
  view. `containr activity` + `containr_activity_list`/`containr_project_activity`
  MCP tools. Retention worker prunes > `AUDIT_RETENTION_DAYS` (default 90).
- [x] **Banners** — `banners` table with title/body/level/active/
  dismissible/schedule window. `GET /banners/active` for signed-in
  users; admin CRUD at `/admin/banners`. `BannerBar` renders above the
  header (per-banner dismiss via localStorage); admin console manages
  them; `containr banners` CLI + `auth status` surfaces active ones.
- [x] **White-label** — `app_settings` `branding.*` keys: product name,
  logo/favicon URL, accent color, docs/support links. Public
  `GET /api/v1/branding` (defaults = Containr); admin writes via
  `PUT /settings`. `useBranding()` applies title/accent/favicon;
  `BrandWordmark` replaces hardcoded marks; admin Platform section
  edits all fields. MCP `containr_branding_get` + `settings_update`.
- [x] **Operations page** — `GET /operations` aggregates active
  deployments, in-memory deploy-queue depth (`Queue.Snapshot()`),
  24h failures, cron runs and backups scoped to the caller's projects.
  UI at `/operations` (Operate nav) with live refetch; `containr
  operations` CLI + `containr_operations_get` MCP. Remaining: agent
  commands once node fleet lands; flush/stuck-job tools.
- [x] **Interactive terminal** — `GET /services/:id/terminal` upgrades
  to a WebSocket bridged to a `docker exec` PTY (bash→sh fallback,
  `TERM=xterm-256color`, resize frames). xterm.js Console section on the
  service page; `containr shell <id>` bridges a local TTY; distroless
  images get a clean "no shell" error. Remaining: `nodes/:id/terminal`
  via agent.
- [x] **Team invites** — `POST /admin/invites` returns a one-time
  link (sha256-hashed token at rest, optional email binding, TTL);
  public `GET /auth/invites/:token` validates and
  `POST /auth/accept-invite` registers — works while public signup is
  closed. `/auth/accept-invite` page, admin manage/revoke UI,
  `containr invites` CLI + MCP tools.
- [x] **Impersonate user** — `POST /admin/users/:id/impersonate`
  mints a 15-minute bearer token (`impersonated_by` claim),
  audit-logged; admin accounts are not impersonatable. CLI
  `admin impersonate`, MCP tool, admin UI token modal. Remaining:
  in-browser session swap needs a session bridge.
- [x] **GitHub App manifest flow** — `POST /admin/git/github-app/manifest`
  returns manifest + submission URL; the callback page exchanges
  `code` via `POST /admin/git/github-app/convert` and credentials
  persist in `app_settings` (overriding `GITHUB_APP_*` env). New
  public `POST /api/git/github-app/webhook` receives App-level push
  events (HMAC-verified) and enqueues matching services. Settings→env
  fallback wired into install-URL + installation-token paths.
  `containr admin github-app` CLI + MCP + OpenAPI.
- [x] **fork-sync trigger** — webhook receiver accepts `sync`,
  `repository_dispatch`, and `workflow_run` events (no `ref`) alongside
  pushes: branch falls back to the webhook filter, then the service's
  own `git_branch`; repo-only matching when no branch is known.
  Also fixed a latent bug where the webhook's deployment insert omitted
  the NOT NULL `version` column — push-triggered deploys silently
  failed for every service.
- [x] **Dynamic filter framework** — ported dflow's `filter.utils`
  pattern as `lib/dynamic-filter.ts` + `use-dynamic-filter.ts`
  (`FilterConfig` schema → `FilterEngine` → `FilterBar`; state lives in
  `?f.<key>` search params so filtered views are shareable links).
  `useFilterState` exposes URL state pre-fetch for server-backed
  filters. Applied: audit logs (server-backed), builds (server + client
  date-range), activity (severity server + client category/search).
  Notifications table has no list surface yet — apply when one lands.
- [ ] **Notification producers round-out** — backups, agent offline,
  upgrade available, security findings.
- [x] **Sleep-on-idle / wake-on-traffic** (serverless-lite) —
  `services.sleep_enabled` + `sleep_idle_minutes` (PR #29). Sweeper
  polls container NetworkIO deltas; idle past threshold → workload
  removed, status `sleeping`. Wake-on-traffic via per-service
  placeholder container on the edge network carrying the same Traefik
  host rule at higher priority — serves a waking page, calls
  `/internal/wake/:id`, exits; Traefik falls back once the app is up.
  Verified `running → sleeping → waking → running` end to end.
- [x] **Env doctor** — `GET /services/:id/env-check` surfaces
  unresolved `${{…}}` refs, empty values, and unreadable
  (rotated-key) secrets; template `plan` endpoint reports missing
  required vars before deploy (PR #30). Frontend Variables section
  shows the banner.
- [x] **Shared project variables** — `project_variables` table,
  `GET/PUT /projects/:id/variables`, `${{shared.KEY}}` refs resolved
  at deploy/reconcile, secrets `enc:v1:` at rest and masked (PR #32).
- [x] **One-click install** — `install.sh` (curl|sh): detects docker,
  writes compose + .env with generated secrets incl. `SECRETS_KEY`,
  pulls images, runs migrations, prints admin URL. GHCR images mean
  installs never build from source.
- [x] **CI/CD v2** — required checks (Go test/vet, frontend
  lint/build/test, compose boot smoke), `dorny/paths-filter` gate so
  docs-only PRs skip heavyweight jobs, and release on main/tag:
  conventional-commit version bump → tag → GHCR images (backend,
  frontend) → cross-platform CLI + MCP binaries → SHA-256 checksums
  → GitHub Release → Trivy scans (PR #33).
- [ ] **Custom roles/RBAC** — defer until demanded; PAT scopes designed
  forward-compatible now.

## 9. Phase H — Migration & ecosystem

- [x] **Railway migrator** — `containr migrate railway --token --project
  --environment --into --dry-run`: Railway GraphQL (backboard) →
  services (git-repo/image + command + replicas), variables, custom +
  service domains → recreates via the Containr API. Project tokens and
  account tokens both supported. `cli/commands/migrate.go`.
- [ ] **dflow importer** — `containr migrate dflow` via Payload REST
  export or Mongo dump: servers→nodes, projects, services(+vars/
  domains/volumes), databases, templates. Onboards dflow refugees.
- [x] **`containr import compose`** — `POST /projects/:id/import-compose`
  deploys a compose file straight into a project; CLI `import compose`,
  MCP tool, workspace import modal; project delete cascades to
  graph-provisioned managed databases (`database_services.project_id`).
- [x] **Template registry** — `CONTAINR_TEMPLATE_REGISTRY_URL` merges a
  remote Containr catalog into `GET /templates` as `source:"registry"`
  (60s cache, dead registry never blocks local). `GET /templates/:id`
  falls through to the registry; deploy materializes a deterministic
  `reg-<hash>` private copy for the deployer so re-deploys don't dup.
  `api/templateregistry.go`, `.env.example`.

## 9b. Phase I — Companion surfaces

- [x] **Phone app (v1)** — `app/mobile`, Expo/React Native thin client
  over the agent-shaped API; dark UI mirroring the design system. PAT
  auth against any instance URL, stored in platform secure storage.
  - **Dashboard** — service status counts (running/sleeping/failed/
    stopped), per-project service health dots, recent deployments feed.
  - **Operate** — start/stop/restart/redeploy, sleep/wake, rollback to
    a prior deployment, database start/stop/restart/backup-now.
  - **Observe** — polling log tail (300 lines, 5s refresh), per-service
    deployment history, env-doctor issues surfaced on the service view.
  - [ ] **env var edit + apply-redeploy, domain management, replica
    scaling, cron execution history** — next iteration.
  - [ ] **Push notifications** — zero-infra path = self-hosted
    ntfy/Gotify relay (no Firebase dependency), FCM/APNs optional.
  - [ ] **Offline resilience** — cached last-known state + unreachable
    banner.
- [ ] **Status/offline resilience** — app + CLI degrade gracefully when
  the instance is unreachable (cached last-known state, clear banner).

## 10. Carried-over debt (ROADMAP.md items still open)

- [ ] **Gateway traffic path** — mount `/g/:slug/*` → key → rate-limit →
  `gateway/proxy.go` → metrics. Management API exists; proxy unwired.
- [ ] **Preview environments runtime** — real build+deploy+subdomain+TTL
  (bookkeeping only now). Pairs with clone + multi-domain.
- [ ] **Environments** — env switcher, per-env vars/domains, promote.
- [ ] **sqlc port** — ~140 raw `database/sql` sites → `sqlc/queries/`.
- [ ] **Tests** — canvas/wizard frontend coverage, deployment/template/
  webhook table tests, Playwright e2e golden path.
- [ ] **First-run wizard** — admin → GitHub App (manifest flow from
  Phase G makes this self-serve) → Tunnel → done.
- [ ] **Self-upgrade loop verification**, docs freshness, v1.0.0 release.

## 11. Deliberately not imported from dflow

- Dokku-over-SSH runtime — our Docker API + agent model is strictly
  better.
- Per-server-named BullMQ queues — our queue stays a single ordered
  table.
- Payload/Mongo/Next.js stack, multi-tenant plugin machinery.
- Ansible playbook runner — arbitrary code-on-node is a security
  surface; SSH bootstrap + agent commands cover the real needs.
  Revisit only with a concrete demand.
- `isAdmin`-only collection access — our owner/admin/public model is
  richer already.
- Netdata install flow — our agent telemetry + optional Beszel covers
  monitoring; don't ship a third dashboard stack.

## 12. Recommended order

```
A (agent surface) ──► B (deploy pipeline) ──► C/D (service+data depth)
      │                                              │
      ▼                                              ▼
 CLI/MCP dogfood every feature              E (templates v2)
                                                    │
                                             F (nodes/infra) ──► H (migrators)
                                                    │
                                             G (polish) + debt
```

Why this order: PATs+CLI+MCP first = every later feature ships
user-and-agent-visible at once. The queue (B) is prerequisite for
the ops surface and correct concurrency. Templates v2 needs volumes,
multi-domain, clone. Migrators last — they're launch marketing, not
foundation.

## 13. Design rules

- **API is the contract.** UI, CLI, MCP are thin clients over
  `openapi.yaml`. A feature isn't done until all three reach it.
- **Everything scriptable.** JSON in/out, `--json`/`--yes`, uniform
  pagination, name-or-id addressing.
- **Same powers, same position.** Nothing user-facing that isn't
  API-facing; agent-visible state (tokens, jobs) visible to users too.
- **dflow is a donor, not a dependency.** Port semantics, not code.
- **Containr branding is the default**; white-label is instance config.
- **Self-hosted first** — no required external service, no phone-home.
