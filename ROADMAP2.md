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
- [x] **Routing overrides** — `services.traefik_labels` jsonb with
  allowlist validation. Keys `middlewares.<name>.<type>[.<field>]` scope
  to the service router (`svc-<id>-<name>`), auto-attach after builtins;
  router/service/provider-level keys rejected. API + CLI
  (`--traefik-label`) + MCP + service page Access editor.
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
- [x] **Backup import** — `POST /databases/:id/backups/import` accepts a
  `.tar.gz` (multipart `file` or raw body, 2 GiB cap, gzip-magic
  validated), stores it in the backups volume via a holder container,
  registers a completed restore point, and ships offsite when a backup
  target is configured. `api/backuptargets.go`. (pairs with
  migrators).

## 6. Phase E — Templates v2 (absorbs compose-catalog spec + dflow graph templates)

- [x] **Template = ordered service graph** — `services[]` entries with
  `{name, type, source, build, ports, volumes, variables, depends_on}`;
  deploy order from dependency refs. `templategraph.go`,
  `topoSortServices`.
- [x] **Expressions** — `{{service.KEY.prop}}` (host/port/user/password/
  database/url), `{{secret}}`/`{{secret(N)}}`, `{{random:N}}`,
  `{{VAR:-default}}` (incl. explicitly-empty defaults); `POST
  /templates/:id/plan` returns the resolved graph without deploying.
- [x] **Compose import** — `POST /templates/import/compose` (yaml →
  graph, known DB images become managed databases), `POST
  /templates/import/git` (compose file fetched from any git repo — clone
  URL, ssh remote, or owner/repo via connected providers, `ref` selects
  branch/commit); `templates import-compose|import-git` CLI, MCP tools,
  paste-or-git toggle in the template UI.
- [x] **Graph deploy pipeline** — creates services in dependency order,
  resolves vars/secrets, triggers builds. `deployTemplateGraph`,
  `POST /templates/deploy` (inline), `POST /projects/:id/import-compose`.
- [x] **Visual template builder** — canvas mode in the template editor:
  web/worker/cron/database nodes, handles wire `depends_on`, inspector
  edits image/repo/engine/port/env/volumes, live validation, applies
  back to the version-2 graph JSON. Positions persist under
  `config.canvas`; flat legacy configs open as a single node.
  `builder-model.ts` + `TemplateBuilder.tsx`.
- [x] **Catalog growth** — seeded graph stacks for n8n, Gitea,
  Nextcloud, Vaultwarden, Umami, Immich (Plausible already shipped).
  `TestSeedTemplatesResolveCleanly` keeps every seed parseable,
  topo-sortable, and fully resolved. Remaining single-service guides can
  convert incrementally via the same endpoint.

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
  explicit pins skip cordoned nodes. Spread placement shipped:
  `services.spread` distributes replicas deterministically across every
  online schedulable agent (replica i → agents[i mod n]), mutually
  exclusive with a pin; `auto` is now resource-aware — least memory
  utilisation, then cpu, then container count, with uninstrumented
  agents sorting last. Lifecycle and `GET /runtime` are
  inventory-driven, so remote replicas show up and tear down wherever
  they run. Remote ingress shipped: the agent reports assigned host
  ports in the `create_container` result, the backend renders a
  Traefik file-provider config per remote service into
  `TRAEFIK_DYNAMIC_DIR` (shared volume, `watch=true`) pointing the
  loadbalancer at each replica's mesh IP + published port; route files
  are rewritten on every remote reconcile and removed on teardown or
  local placement. Agents report managed-container states at every
  heartbeat — exits, OOMs, and crash loops land in inventory between
  reconciles (tombstones never resurrect). Remote sleep/wake shipped:
  heartbeats carry per-container net counters, idle remote services
  lose replicas via agent remove + tombstones, and the route file
  repoints at `/internal/wake-page/:id` on the backend — first hit
  retriggers the wake reconcile, which recreates replicas and restores
  real upstreams. Remote nodes run
  registry-pulled images only — git builds are the remaining
  documented ceiling. Tag affinity shipped: `node_agents.tags`
  (operator-set via `PUT /agents/:id` / `nodes update --tags`) +
  `services.placement_tags` — `auto` and `spread` only consider
  online schedulable agents carrying every required tag, tags are
  re-evaluated each reconcile (a tag change re-spreads replicas),
  unsatisfiable requirements fail with a clear error, pin + tags
  and local + tags are rejected, empty array clears. Surfaces:
  `--placement-tags` on services create/update, `--tags` on
  `nodes update`, MCP args, OpenAPI, node-detail tag editor +
  service-detail placement-tags input. Remaining: build-on-node,
  remote sleep/wake, spread weighting by real capacity.
- [x] **Agent self-upgrade** — `POST /agents/:id/upgrade` enqueues a
  `self_upgrade` command carrying platform + sha256 + server version;
  the agent downloads its replacement from `GET /agents/download/
  :platform`, verifies the checksum, sanity-checks `--version`,
  atomically swaps its own executable, reports the result, then
  re-execs (`syscall.Exec`) — no supervisor needed. Agents now stamp
  `main.version` via ldflags at image build and report it at
  register/heartbeat (`node_agents.version` refreshes on re-register;
  older agents keep their stored value). Surfaces: `nodes upgrade`
  CLI, `containr_nodes_upgrade` MCP (confirm-gated), node-detail page
  button (online-gated). Ceilings: linux amd64/arm64 only; agents on
  other platforms get a `NO_BINARY` 409.
- [x] **Build-on-node** — private registry pulls + real builds shipped.
  Git sources materialize via `internal/source` checkout (branch/commit,
  `GIT_ASKPASS` credential injection, dumb-transport fallback), package
  through `BuildManager.PackageContext`, ship as agent-token artifacts,
  and `docker build` on the node (`build_image` command). Remote rollbacks
  `docker save` → artifact → `load_image` on the node. Verified end-to-end
  on a live agent (PR #60).
- [ ] **IaC provisioning (ROADMAP §2.2, unchanged)** — Terraform/
  OpenTofu, `infra_connections`, Proxmox + AWS modules, + Hetzner module
  (dflow's second provider), cloud-init → auto-enroll.
- [x] **Global/wildcard domain per node** (`node_agents.default_domain`) —
  `PUT /agents/:id {default_domain}`; domainless services placed on the
  node get `<name>.<default_domain>` (pinned → node's base; spread →
  union of eligible nodes). `serviceDomainNames` resolves them so
  routing, wake placeholders, and `public_url` all pick them up.
  CLI `nodes update --domain`, MCP arg, node-detail editor.

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
- [x] **Notification producers round-out** — all shipped: deployments
  (deployments.go), backups (databases.go `createBackupProcess` → owner),
  agent offline/online sweep (`reconcileAgentHealth` → admins),
  upgrade-available (`checkForUpgrade`, tag-persisted) and security-scan
  findings (`scanner.OnScanComplete` → project owner).
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
- [x] **dflow importer** — `containr migrate dflow --url --api-key
  --project --into --dry-run`: pages the Payload REST collections
  (users API-Key auth) → services (app→git/web, docker→image,
  database→typed image + DATABASE_URL for external providers),
  variables (empty encrypted values flagged), bind volumes, domains.
  Soft-deleted services excluded. `cli/commands/migrate_dflow.go`.
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
  - [x] **env var edit + domain management + replica scaling** (PR #61 —
    mobile v1.5: variables editor, domains screen, scale + sleep
    settings, notifications tab, cron jobs screen with run-now and
    execution history).
  - [x] **Push notifications** — per-user `notification_channels`
    (ntfy + Gotify): every `insertUserNotification` fans out best-effort
    to enabled channels; CRUD + live test-ping via web settings, CLI
    `notifications channels`, and MCP. FCM/APNs remain optional.
  - [x] **Offline resilience** — AsyncStorage-persisted query cache
    (7d, high-churn keys excluded) + banner when the instance is
    unreachable (`/health` ping + expo-network).
- [x] **Status/offline resilience** — web persists the query cache to
  localStorage (24h) and PlatformShell shows a "last-known data" banner
  on offline/unreachable; CLI exits `ExitUnavailable` with a clean
  "cannot reach" message (no stack traces).

## 10. Carried-over debt (ROADMAP.md items still open)

- [x] **Gateway traffic path** — `/g/:slug/*` mounted → api_key auth →
  rpm + monthly quota → `gateway/proxy.go` → usage_counters /
  metrics_timeseries / incident_events.
- [x] **Preview environments runtime** — previews are real service clones:
  branch override, queued deployment, node-domain hostnames, TTL sweeper,
  promote = redeploy of the source at the preview branch.
- [x] **Environments** — CRUD (`GET/POST /projects/:id/environments`,
  `DELETE /environments/:id`), switcher chips with service counts in the
  workspace, CLI `environments` + MCP parity. Per-env vars/domains ride the
  service's own scope (one env per service); promote ships via preview
  promote.
- [x] **sqlc port** — all static `database/sql` call sites → `sqlc/queries/` + generated `sqlcdb`. Merged: metrics + domains (#75), service clone/move (#76), preview environments (#77), deployments + rollback (#78), runtime ops (#79), cron (#80), sleep/wake sweeper (#81), git providers/repos/webhooks (#82), auth + security (#83), operations/settings/audit/activity/builds/misc + apwhy gateway (#84). Raw SQL remains only for runtime-assembled statements (filtered lists, sparse updates) and Better Auth `auth_users` probes.
- [ ] **Tests** — canvas/wizard frontend coverage, deployment/template/
  webhook table tests, Playwright e2e golden path.
- [x] **First-run wizard** — public `GET /setup/status` + authed
  `POST /setup/complete`; `/setup` page steps admin account → GitHub App
  manifest flow (callback returns to the wizard via a session marker) →
  optional Cloudflare tunnel token → done. Shell redirects signed-in
  users to `/setup` while `needs_setup`; installs with existing projects
  auto-complete so nobody gets nagged retroactively.
- [x] **Self-upgrade loop verification** — live-verified: admin
  `POST /agents/:id/upgrade` → `self_upgrade` command → agent downloads
  `/api/agents/download/linux-amd64` → sha256 verify → `--version`
  sanity → atomic rename → result posts → `syscall.Exec` re-exec. Agent
  ran `v0.0.1-old`, came back `v9.9.9-test`, command row `completed`.
- [ ] **Docs freshness, v1.0.0 release.**

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
