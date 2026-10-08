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
| Outbound webhooks (collection events, HMAC, custom headers) | ❌ | `webhooks` table + delivery log |
| Banners (global + per-tenant, dismissible) | ❌ | `banners` table + top bar |
| White-label (logo/favicon/title/OG/theme colors) | ❌ | `app_settings.branding` — **Containr remains the default brand** |
| Activity feed (icon/severity/category/metadata, 90-day TTL job) | 🟡 `audit_logs` coarser | Enrich + project feed UI |
| Admin metrics dashboard (users/servers/queued/failed counts) | 🟡 `/admin` exists | Extend |
| **Impersonate user** | ❌ | Admin support tool |
| In-app docs (content-collections markdown) | ✅ `/docs` | — |
| Dynamic client-side filter framework (535-line `filter.utils`) | 🟡 audit page filters only | Reuse pattern for tables |
| Ops "bubble" (queue monitor, terminal, sync) | ❌ | Operations page |

#### Agent surface
| dflow capability | Containr status | Action |
|---|---|---|
| Payload REST/GraphQL auto-API + per-user API keys | ❌ | PATs + OpenAPI (better: typed, documented) |
| CLI | ❌ | none in dflow — **Containr CLI is a genuine leap past it** |
| MCP | ❌ | none — same leap |
| Railway migrator script | ❌ | `containr migrate railway` |
| GitHub App **manifest flow** (instance self-provisions the App) | 🟡 env-configured App | `POST /git/github-app/manifest` flow |
| fork-sync webhook deploy trigger | ❌ | ~20 lines on receiver |
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

- [ ] **SSH bootstrap install** — `containr nodes add --ssh user@host` +
  UI flow: one SSH session runs agent install (binary + systemd +
  enroll token), SSH closed forever. dflow onboarding UX, agent-model
  security.
- [ ] **Mesh awareness** — agent detects + reports tailscale0/netbird0/
  zt0 IPs at register; backend stores + displays. Optional
  `TAILSCALE_AUTH_KEY` enroll-at-provision later.
- [ ] **Node detail page** — placed services, telemetry history, agent
  version + self-upgrade, **drain/cordon**, remove.
- [ ] **Node housekeeping** — agent `prune` command (docker system
  prune, bounded) + optional schedule (`setServerAutoCleanup` analog —
  disk pressure is the #1 small-VPS killer).
- [ ] **Multi-node scheduling** — wire `scheduling_rules` (table exists):
  pin/spread/affinity, prefer-lowest-usage; deploy engine routes to
  `services.node_id` via agent commands (agent already runs containers).
- [ ] **Build-on-node** — agents currently `docker run` prebuilt images
  only; extend agent to pull registry images (build stays central) —
  private registry creds flow through Phase C.
- [ ] **IaC provisioning (ROADMAP §2.2, unchanged)** — Terraform/
  OpenTofu, `infra_connections`, Proxmox + AWS modules, + Hetzner module
  (dflow's second provider), cloud-init → auto-enroll.
- [ ] **Global/wildcard domain per node** (`nodes.default_domain`) —
  auto-domains for services on that node.

## 8. Phase G — Platform polish

- [ ] **Outbound webhooks** — `webhooks(url, secret, events[], headers,
  enabled)` + `webhook_deliveries` log; HMAC `X-Containr-Signature`;
  events: `deployment.* service.* database.* security.* agent.*`.
- [ ] **Activity feed** — enrich `audit_logs` with `severity category
  icon label metadata`; per-project timeline + global feed; TTL job.
- [ ] **Banners** — `banners(title, body, level, scope, active)`; top
  bar in UI + surfaced to CLI on `auth status`.
- [ ] **White-label** — `app_settings.branding`: product name, logos,
  favicon, accent override, docs/support links. `GET /api/v1/branding`
  public + cached. **Containr/Vertice remains default;** this is for
  self-hosters who rebrand their instance.
- [ ] **Operations page** — unified view of running/queued/failed jobs
  (deploys, builds, backups, cron, scans, agent commands) — dflow's
  bubble panel as a real page; flush/stuck-job tools once queue exists.
- [ ] **Interactive terminal** — upgrade exec to WS PTY (`xterm.js`);
  `nodes/:id/terminal` via agent (dflow's wetty without the extra
  container).
- [ ] **Team invites** — `POST /invites` → signed link → join flow;
  replaces manual-only user creation.
- [ ] **Impersonate user** — admin support tool, audit-logged.
- [ ] **GitHub App manifest flow** — `POST /git/github-app/manifest`
  returns manifest + redirect; instance self-provisions its App
  (dflow pattern — removes the env-setup barrier).
- [ ] **fork-sync trigger** — accept repo-sync events on webhook
  receiver.
- [ ] **Dynamic filter framework** — port dflow's `filter.utils`
  pattern (typed filter configs → URL state → client filtering) for
  audit logs, deployments, notifications tables.
- [ ] **Notification producers round-out** — backups, agent offline,
  upgrade available, security findings.
- [ ] **Sleep-on-idle / wake-on-traffic** (serverless-lite) —
  `services.sleep_after_idle` (duration, empty=off). Reaper loop stops
  containers past idle threshold (last-seen from Traefik access logs or
  request-tracking middleware); edge middleware returns a "waking"
  page/503-with-retry, starts the container, then routes normally.
  Per-service toggle + status badge (`sleeping`). Railway calls this
  "app sleep"; it is the single biggest cost saver for hobby services.
- [ ] **Env doctor** — template/service required-var manifest:
  `POST /templates/:id/plan` and service env UI surface *missing* and
  *auto-generated* vars before deploy; never silently deploy with
  empty required values. Secrets get `{{secret(len)}}` defaults.
- [ ] **One-click install** — `install.sh` (curl|sh): detects docker,
  writes compose + .env with generated secrets, pulls images, runs
  migrations, prints admin URL. Companion `docker-compose.prod.yml`
  + `Dockerfile` images published to GHCR so installs never build
  from source.
- [ ] **CI/CD v2** — required-checks workflow (backend test/vet,
  frontend build, sqlc-diff check), path-filtered jobs for speed,
  and a release pipeline: merge to main → tag → GoReleaser binaries
  (CLI + MCP) → GHCR images (api, web, agent) → GitHub Release notes.
- [ ] **Custom roles/RBAC** — defer until demanded; PAT scopes designed
  forward-compatible now.

## 9. Phase H — Migration & ecosystem

- [ ] **Railway migrator** — `containr migrate railway --token --project
  --dry-run`: Railway GraphQL → services/vars/domains → recreate via
  PAT. Landing-page pitch: "off Railway in one command."
- [ ] **dflow importer** — `containr migrate dflow` via Payload REST
  export or Mongo dump: servers→nodes, projects, services(+vars/
  domains/volumes), databases, templates. Onboards dflow refugees.
- [ ] **`containr import compose`** — Phase-E parser straight to a
  project (no template intermediate).
- [ ] **Template registry** — optional `CONTAINR_TEMPLATE_REGISTRY_URL`
  fetch/publish; bundled catalog works offline (dflow's self-contained
  principle — nothing phones home).

## 9b. Phase I — Companion surfaces

- [ ] **Phone app** — read-heavy mobile client over the existing API
  (PAT auth already works). Scope v1: project/service list, status,
  deploy trigger + log tail, restart/stop, notifications push via
  existing notification rows (APNs/FCM relay optional, self-hosted
  webhook → ntfy/Gotify as zero-infra alternative). React Native or
  native-lean PWA; the API surface is already agent-shaped so the app
  is a thin client. Design: dark UI, deploy status as first-class view.
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
