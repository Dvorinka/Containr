# Containr — Project Roadmap

Last verified: **2026-09-17** against `main` (`9e3aa3a`).

Goal: bring Containr from "working core + large headless backend" to a
finished, installable, documented v1.0 self-hosted platform.

---

## 1. Verified Current State

Everything below was run, not assumed.

| Check | Result |
|---|---|
| `go build ./...` | clean |
| `go vet ./...` | clean |
| `go test ./...` | all packages pass (api, build, cli, config, database, ha, middleware, networking, security) |
| `tsc -b` (frontend) | clean |
| `eslint .` | clean |
| `vite build` | clean |
| `vitest run` | 3/3 pass — one smoke test file only |
| `go run ./cmd/migrate up` vs empty Postgres | clean — 52 app tables + `goose_db_version`, version `20260917000000` |
| `go run ./cmd/migrate up` vs legacy schema | clean — APwhy parallel tables + `migrations` bookkeeping dropped, dead `users` columns removed |
| Backend boot vs migrated Postgres+Redis | starts, `/live` → 200, `/health` → `{"database":"ok","redis":"ok"}`, protected routes → 401 |
| Frontend demo mode (`?demo=1`) | Projects, workspace canvas, Templates render correctly in the Vertice theme |

### Feature inventory — backend vs frontend

The backend exposes **~90 route registrations**; the frontend consumes roughly
**25** of them. The gap below is the real roadmap.

| Feature | Backend | Frontend | Docs |
|---|---|---|---|
| Auth (Better Auth: email, GitHub, Google; bootstrap gate; internal manual user creation) | done | done (`/auth/*`, People page) | done |
| Projects CRUD | done | done (`/projects`) | done |
| Project canvas (nodes, groups, auto-connections, drag layout) | via services API | done (React Flow, `ProjectCanvas`) | done |
| Services CRUD | done | done (canvas + `/services/:id` detail) | done |
| Deployments: create, history, rollback, logs | done | done (service detail) | done |
| Service env variables | done | done (service detail config section) | done |
| Service metrics (Docker stats) | done | done (metrics section + `/metrics-demo`) | done |
| Host monitoring (`/system/host`) | done | done (Usage + Projects telemetry cards) | done |
| Builds + live status over `/ws` | done | done (`/builds`, `useBuildUpdates`) | done |
| Templates — list/detail/deploy | done | done (catalog page) | done |
| Templates — **Compose catalog** (GitHub import, paste YAML, `x-containr` metadata, community source) | **missing** | **missing** | spec written, not built |
| Git providers (PAT add/remove, repo list, branches) | done | done (Settings → Git Providers) | done |
| Git repo connect + webhook auto-deploy | done (`/git/repositories/connect`, `/git/webhooks`) | **missing** — no connect flow, no webhook status | guides claim it works |
| GitHub App install flow | done | partial — install-url/connect not surfaced | partial |
| Cron jobs (CRUD, trigger, executions) | done | **missing** | not documented |
| Managed databases (CRUD, actions, backup/restore) | done | **missing** | mentioned in README |
| Preview environments (CRUD, promote, cleanup) | done | **missing** | not documented |
| Security scans, vulnerabilities, compliance/GDPR reports | done | **missing** | README lists it |
| Audit logs | done | done — `/settings/audit-logs` filterable page | done |
| Autoscaling policies + manual scale | done | **missing** | `docs/guides/AUTOSCALING.md` describes UI that does not exist |
| HA / failover policies | done | **missing** | not documented |
| Node agents (register additional VPS/LXC/VM hosts, heartbeats) | done | done — token issue/revoke + install command on Usage page | done |
| API gateway (merged APwhy): upstream services, API keys, rate limits, ops/traffic analytics | management API done — native handlers under `/api/v1/gateway/*`, schema-corrected; **traffic proxy path still not mounted** (Phase 2) | **missing** | not documented |
| Proxmox provider (cluster/nodes/VM/LXC CRUD) | written, **routes never registered** — unreachable | none | not documented |
| Notifications (build/audit feed) | via existing APIs | done (shell bell menu) | — |
| Self-upgrade (`/system/upgrade/*`) | done | done (Upgrade button) | — |
| Light theme | CSS vars done | done (toggle in top bar) | — |
| CLI (`cmd/cli`) | exists | — | thin |
| Traefik + Cloudflare Tunnel infra | `infra/` done | — | done |
| Demo mode (`?demo=1`) | n/a | done | — |

### Known issues and debt

- ~~**React Flow edge warnings**~~ — **fixed**: `ServiceNode` now renders
  invisible `Handle` components (target left, source right), so inferred
  auto-connections attach without `#008` warnings.
- ~~**OpenAPI drift**~~ — **resolved**: spec now covers all 153 mounted
  operations (114 path items, 154 operations incl. root probes). Schemas
  were corrected against the real Go structs (Service, Git*, NodeAgent,
  HostMonitoring, UpgradeStatus, metrics); stale `source`/`build_config`
  contract removed. `api-types.ts` regenerated; `api-client.ts` raw types
  now alias generated schemas — camelCase normalizers stay by design.
- **Two DB access patterns remain**: GORM is gone (agents handler ported to
  sqlc), but most handlers still hand-write `database/sql` — ~140 call sites
  across ~14 files. Porting them to `sqlc/queries/` is mechanical but large;
  scheduled as its own pass.
- ~~**Two migration systems**~~ — **resolved**: `migrations/` and its loader
  are deleted. `migrations_goose/` is the only path;
  `20260401163000_baseline.sql` carries the consolidated schema (idempotent —
  safe over partially-migrated legacy installs), and
  `20260917000000_drop_apwhy_parallel_auth.sql` removes the dead APwhy
  objects. Fresh install and legacy upgrade both verified via `cmd/migrate`.
- ~~**APwhy is triple-implemented**~~ — **resolved**: vendored server,
  `cmd/apwhy`, embedded SolidJS bundle, and the unwired copy under
  `internal/api/server.go` + cloned packages are all deleted (~7.5k lines).
  Management API lives at `/api/v1/gateway/*` on Containr auth; traffic
  proxy mount remains Phase 2 work. Note: `umami_sync_cache` and
  `database_connections` were dropped with the dead tables — re-add via a
  new migration when Phase 2 Umami sync lands.
- **Proxmox written but never wired**: `internal/proxmox` +
  `internal/api/proxmox.go` define 17 endpoints; `RegisterProxmoxRoutes` is
  never called. Kept deliberately — see §2.2.
- ~~**Dead weight**~~ — **removed**: `reactflow` dep, `cmd/test-*`
  harnesses, `migrations/0001_init.sql` + `.bak`. Correction to the earlier
  audit: `feature_response.go` is *live* (`respondDependencyUnavailable` is
  used by `logs.go`) and stays.
- **Stale health data**: `.desloppify/state-*.json` is from February — rerun.
- **Test coverage**: frontend has one smoke test; backend coverage
  concentrated in `internal/api` and infra packages; deployment engine,
  docker client, metrics, scaling, agents have no tests.

---

## 2. Decisions

1. **APwhy — merged, consolidated.** DECIDED: APwhy becomes a first-class
   Containr feature ("API Gateway"): deploy a service, publish it behind a
   managed route with keys, rate limits, and analytics. Canonical
   implementation is the Containr-native Gin handlers
   (`internal/api/apwhy_handlers.go`) — they already use Containr auth and
   DB. The vendored standalone server (`internal/apwhy/*`, `cmd/apwhy`,
   embedded SolidJS bundle) is deleted after the useful parts are ported
   (`gateway/proxy.go`, analytics queries). The parallel auth/RBAC schema
   from migration 008 is dropped — Better Auth owns identity. APwhy's
   upstream repo at `ref/APwhy` stays as the standalone edition.
2. **Proxmox — kept, and generalized into infrastructure providers over
   Terraform/OpenTofu.** DECIDED: node provisioning becomes an
   infrastructure-as-code pipeline. `internal/proxmox` stays for
   read/inventory (cluster status, node stats, existing VMs/LXCs); all
   *provisioning* goes through Terraform — one engine, providers as HCL
   modules. Proxmox (bpg/proxmox) is provider #1, AWS EC2 is provider #2;
   adding Hetzner/GCP/later providers is then a module, not a feature.
   Provisioning a node = render module → `terraform apply` → cloud-init
   installs Docker + `containr-agent` → node auto-enrolls. VM CRUD alone is
   not the feature; capacity-on-click is.
   - Engine: `terraform-exec` (or OpenTofu binary — same HCL, OSS license;
     pick at implementation time). Provider binaries + tfstate live under a
     `data/iac/` dir; provisioning requires the binary, core platform does
     not.
   - Secrets: provider credentials encrypted at rest in an
     `infra_connections` table, instance-scoped.
3. **Multi-node / autoscaling / HA in v1.0?** — **Ship agents + host
   monitoring; mark autoscaling/HA as beta.** They are backend-complete but
   unproven end-to-end.
4. **Environments**: `environment_id` exists in the schema and the seeder
   creates production/preview/development, but the UI exposes a single
   `env:production` badge. — **Production-only in v1.0**; preview
   environments land in Phase 3.
5. **DB access**: — **sqlc only.** Remove the GORM dependency (used by ~1
   handler) and stop hand-writing SQL in handlers.

---

## 3. Phases

### Phase 0 — Hygiene and contract (1 pass, blocking)

Everything else builds on a truthful API contract and a clean tree.

- [x] Remove dead code: `migrations/0001_init.sql`, `migrations/*.bak`,
      `cmd/test-build-manager`, `cmd/test-railpack`, `reactflow` npm dep.
      (`feature_response.go` kept — it is live.)
- [x] **APwhy consolidation** (per §2.1): Containr's native
      `internal/gateway` was already the real proxy — nothing needed porting;
      the vendored server, `cmd/apwhy`, the embedded SolidJS bundle, the
      unwired `internal/api/server.go` copy, and the cloned packages are
      deleted. Management routes moved to `/api/v1/gateway/*` (services CRUD +
      validate, keys, ops/traffic analytics); handlers fixed against the real
      schema (UUID ids, integer `enabled`, plan validation). Parallel
      auth/RBAC tables dropped in the migration consolidation.
- [x] Consolidate migrations: `migrations/` collapsed into the goose baseline
      `20260401163000_baseline.sql` (idempotent); `migrations_goose/` is the
      only path; legacy loader + Dockerfile copy removed. Fresh-boot (53
      tables) and upgrade-from-legacy both verified through `cmd/migrate`.
- [x] Converge DB access on sqlc: agents handler ported off GORM, `gorm`
      dependency dropped, agent queries in `sqlc/queries/agents.sql`.
      Remaining hand-written `database/sql` in other handlers (~140 sites)
      is tracked as a follow-up pass — sqlc is the target for all new code.
- [x] Bring `docs/api/openapi.yaml` to parity with `routes.go`: 114 paths /
      154 operations cover every mounted route (incl. `/live`, `/health`,
      `/ready`, `/api/agents/*` token routes with server overrides; Proxmox
      handlers are registered nowhere, intentionally undocumented).
      `api-types.ts` regenerated; `api-client.ts` contract types deduped to
      generated schemas — normalized view models kept.
- [x] Fix auto-connection edges — `ServiceNode` lacked `Handle` components;
      invisible target/source handles added in `nodes.tsx`.
- [x] Rerun desloppify; record score. 2026-09-17 scan (`ref/` excluded):
      objective **66.1**, strict **16.5** — note the tool's scoring model
      changed: strict now drags the 75%-weighted subjective pool (20 human
      review items, all unscored). Mechanical dimensions: code quality 90.7,
      security 97.0, file health 81.4, test health 35.0. The old "≥89 strict"
      target is not comparable; treat objective ≥ 70 as the next milestone.
- [x] `go vet`, `eslint`, `tsc`, `go test`, `vitest`, `vite build` all green;
      boot smoke verified (`/live` → 200, `/health` → db/redis ok, protected
      routes → 401) and documented in `CONTRIBUTING.md`.

**Gate**: `docker compose up -d` from a clean clone produces a working stack;
OpenAPI spec matches the router 1:1; zero dead packages.

### Phase 1 — Finish the core deploy loop (the Railway promise)

The product's spine: *project → service → deploy → logs → rollback*. Most
pieces exist; this phase closes the gaps that block real usage.

- [x] **Git connect flow, end to end**: Settings → GitProvidersSection manages
      providers; service dialog picks provider → repo → branch; on create the
      repo is connected (`POST /git/repositories/connect`, 409-tolerant) and a
      push webhook is registered (`POST /git/webhooks`). Live provider push
      verification pending real credentials.
- [x] **Webhook auto-deploy**: public receiver `POST /api/git/webhooks/:id`
      verifies HMAC (GitHub `X-Hub-Signature-256`, Gitea `X-Gitea-Signature`)
      or GitLab `X-Gitlab-Token`, maps repo+branch → services, inserts
      deployment rows and enqueues `runDeploymentAndSync` (trigger=webhook),
      which flips canvas node status to building. Unit-tested signature
      verification. Not yet e2e-verified against a real provider.
- [ ] **Compose template catalog** per `docs/superpowers/specs/2026-04-14-compose-template-catalog-design.md`:
      - `service_templates.compose_yaml`, `screenshots`, `source_type`,
        parsed `config` summary (migration + sqlc).
      - `POST /templates/import/github`, `POST /templates/import/compose`.
      - Variables discovered from `${VAR}`/`${VAR:-default}` placeholders.
      - Catalog UI: screenshots, badges, import dialogs (GitHub + paste),
        install wizard → creates one service per Compose service.
- [x] **Service creation flows on canvas**: Add Service covers Image, Git
      repo (provider → repo → branch → connect+webhook), Database (engine +
      plan → real `POST /databases` provisioning, not a hollow service row),
      worker/cron types, and a Template entry that jumps to the catalog with
      the project preselected (`/templates?project=`).
- [x] **Variables UX**: Variables section on the service detail page — add /
      edit / remove rows, secret masking (masked `********` secrets preserved on
      save; editing replaces), bulk `.env` paste (`KEY=VAL`, comments, `export`
      prefix, quoted values), inline validation (required / invalid / duplicate
      keys). Per-environment values are already covered by the schema: each
      environment owns its service instances, and variables are per-service.
- [x] **Deploy lifecycle polish**: backend already writes deploy progress to
      `services.status`; the canvas now polls faster while any service is in a
      transitional state so build → deploy propagates to nodes, deployment
      history rows link straight into that deployment's log tail, and rollback
      asks for confirmation before firing.
- [x] **Node/port collision handling**: verified structurally impossible in the
      current model — services never claim host ports (`PortMappings` is never
      populated; traffic routes via container IPs + Traefik discovery), and
      managed databases bind `127.0.0.1` with ephemeral host ports. If a claim
      ever conflicts, Docker's bind error lands in `deployments.error` and shows
      in the failed-deploy log tail — not silent. Revisit if a service-level
      host-port config is ever added.
- [x] Auth hardening: e2e-verified against a live stack (scratch Postgres +
      Redis + real Better Auth sidecar). Fixed a real gate hole: sign-ups write
      `auth_users` but the gate counted `users`, which only mirrors on the
      first authenticated call — a second registration slipped through the
      pre-mirror window. `countLocalUsers` now unions both tables (verified:
      `users=0, auth_users=1` already returns `mode: login` and 403s on both
      public register paths; internal-token manual creation works, wrong token
      refused). Session expiry redirect confirmed in `App.tsx`
      (401 → null → `/auth/sign-in?redirect=…`). OAuth happy paths remain
      unverifiable without real GitHub/Google credentials — providers are
      env-gated and `disableImplicitSignUp` means OAuth cannot bypass the
      gate by creating accounts.

**Gate**: a fresh instance can register → create project → connect GitHub repo
→ push → see build → see deploy → view logs → roll back, with zero manual API
calls. Template install from pasted Compose works the same way.

### Phase 2 — Surface the headless backend

All of these have working APIs and no UI. Cheapest feature wins in the repo.

- [ ] **Databases** (`/databases/*` + backup/restore): service type on canvas,
      detail page section for connection info, actions (start/stop/restart),
      backup create/list/restore. Verify against real Postgres/Redis/MySQL
      images.
- [x] **Cron jobs** (`/cron-jobs/*`): real engine + UI. Backend was a stub
      (`calculateNextRun` returned now+1h, `executeCronJob` slept 2s and wrote
      "success" without running anything). Now: `robfig/cron` parses the
      schedule (validated on create → 400), a 60s scheduler goroutine executes
      due enabled jobs, and commands run via `docker exec sh -c` inside the
      service's `containr-<serviceID>-*` container with stdout+stderr captured
      into `cron_executions` — verified e2e (trigger + scheduler tick, real
      alpine output). UI: "Cron" tab on the service detail page — list/create/
      edit/enable-toggle, manual Run, execution history with logs. (Not added
      to Add Service: jobs exec into an existing service's container, so they
      live on the service, not as a standalone type.)
- [ ] **Preview environments** (`/preview-environments/*`): per-PR/per-branch
      preview creation, promote-to-production action, expiry + cleanup job.
      Decide first whether this stays Phase 2 or moves with env support (§2.4).
- [x] **Audit logs**: real page at `/settings/audit-logs` (linked from the
      Settings page) — filterable table by resource, action, actor (email),
      and time range, with pagination. Backend widened accordingly: the list
      endpoint was self-scoped and dropped `user_email`; it now joins `users`
      and accepts `user_id`/`actor`/`since` filters. Widening is consistent
      with the platform's no-roles trust model (every authed user can already
      create users).
- [x] **Agents/nodes**: onboarding flow on the Usage page — issue per-node
      tokens (raw `cagt_…` shown once, only sha256 hash stored in
      `agent_auth_tokens`), one-time copy + prefilled
      `CONTAINR_API_URL`/`CONTAINR_AGENT_AUTH_TOKEN` install command, issued
      tokens list with label/created/last-used and revoke (revoked tokens
      rejected at register/heartbeat — verified e2e). Env-configured shared
      tokens (`CONTAINR_AGENT_AUTH_TOKEN(S)`) still accepted. Node cards with
      heartbeat status + telemetry were already on the Usage page.
- [ ] **API Gateway (merged APwhy, full revival)** — new runtime work, not
      just UI. Target: every upstream service published through Containr is
      reachable, key-gated, rate-limited, and metered:
  - [ ] Mount the traffic path: catch-all route (e.g. `/g/:serviceSlug/*path`
        or per-service subdomain) → resolve `api_services` → API-key check →
        rate limit (`rpm_limit`, `monthly_quota` via `usage_counters`) →
        proxy through the ported `proxy.go` → record `metrics_timeseries` +
        `incident_events`.
  - [ ] Port `POST /services/:id/validate` (upstream reachability check) from
        the vendored server.
  - [ ] Full management surface under `/api/v1/gateway/*`: services CRUD +
        validate, keys issue/revoke/quotas, `analytics/ops`,
        `analytics/traffic`, incidents list.
  - [ ] UI: new "Gateway" page — register upstream (auto-suggest running
        Containr services), assign route prefix, issue/revoke keys with
        quotas, per-service traffic + ops charts (feeds Usage page too),
        incident timeline.
  - [ ] Optional: Umami sync (`umami_sync_cache`) if a Umami instance is
        configured — otherwise drop the table.
  - [ ] Note: APwhy's own auth/RBAC/deploy/database endpoints are *not*
        ported — Better Auth owns identity, Containr owns deployments and
        databases natively.
- [ ] **Notifications depth**: notification center persistence (read/unread),
      not just a transient bell feed.

**Gate**: every registered route is reachable from the UI or has an explicit
"API-only" note in the spec. A request to `/g/{service}` with a valid key
reaches the upstream container and appears in the analytics tables.

### Phase 3 — Advanced operations

- [ ] **Autoscaling UI** (`/scaling/*`): per-service policy editor
      (min/max/target CPU/mem), scaling history timeline, manual scale
      control on service detail. Mark beta until soak-tested.
- [ ] **HA / failover UI** (`/ha/*`): enable/disable per project, failover
      policies, manual failover with confirmation, status banner. Beta.
- [ ] **Security center** (`/security/*`): scan trigger per project, finding
      list with severity, compliance report viewer, audit correlation.
      Verify the scanner actually runs Trivy/Grype or document the real
      mechanism.
- [ ] **Multi-node scheduling**: service → node placement rules using agent
      telemetry; health-based rescheduling. Depends on Phase 2 agents.
- [ ] **Infrastructure providers over Terraform** (per §2.2):
  - [ ] `internal/iac` package: wraps terraform-exec/OpenTofu — render
        provider module + vars, `init`/`apply`/`destroy` in per-node
        workspaces under `data/iac/`, capture outputs (IP, name, node id).
  - [ ] `infra_connections` table: provider type (`proxmox`, `aws`),
        encrypted credentials, instance-scoped; managed in Settings.
  - [ ] `proxmox` module: LXC/VM on chosen node/storage, cloud-init installs
        Docker + `containr-agent` with enrollment token → auto-registers.
  - [ ] `aws` module: EC2 instance (AMI + instance type + SG) with the same
        cloud-init enrollment → same node pipeline, different provider.
  - [ ] Register `RegisterProxmoxRoutes` behind auth at
        `/api/v1/proxmox/*` for read/inventory (cluster, nodes, stats,
        existing VMs/LXCs) — write/provision path is Terraform only.
  - [ ] Node lifecycle: destroy = `terraform destroy` + agent deregistration;
        drift detection via periodic `plan` (mark node drifted in UI).
  - [ ] UI — Nodes/Infrastructure page: provider connections, provision
        wizard (pick provider → region/node → size → enroll), node cards
        with provider badge, VM/LXC lifecycle actions.
- [ ] **Environments** (per §2.4): env switcher, per-env variables/domains,
      promote flow — ships with preview environments.

**Gate**: scaling and failover demonstrably work against a two-node lab;
security scans produce real reports, not empty tables.

### Phase 4 — Productization and release

- [ ] **First-run experience**: setup wizard (create admin → optional OAuth →
      optional GitHub App → done), seeded demo project optional, empty states
      everywhere.
- [ ] **Install story**: single `curl | sh`-style installer that writes
      `.env`, pulls images, runs compose; verify on a clean VPS.
- [ ] **Self-upgrade loop**: verify `/system/upgrade/pull` actually swaps the
      running image; document rollback.
- [ ] **Docs pass**: sync all guides to reality (AUTOSCALING currently
      describes a non-existent UI); rewrite getting-started to the canvas
      flow; publish OpenAPI at `/docs` inside the app (Docs page exists —
      render the spec there).
- [ ] **Tests**: raise frontend beyond smoke (canvas interactions, template
      install wizard, git connect); backend table-driven tests for
      deployments, templates import, webhooks; Playwright e2e suite for the
      Phase-1 golden path.
- [ ] **CI**: GitHub Actions — build, lint, typecheck, tests, compose boot
      smoke; publish container images to GHCR with semver tags.
- [ ] **Release**: `v1.0.0` tag, changelog, release notes, screenshots refresh
      in README.
- [ ] Post-build workflow per repo rules: codebase-to-course, desloppify,
      security-reviewer, audit; append README scorecard.

**Gate**: clean VPS → installer → first service deployed in under 10 minutes;
CI green; docs match the product.

---

## 4. Cross-Cutting (every phase)

- **Spec parity**: OpenAPI is the contract — regenerate types on every API
  change (`npm run generate:api`); CI check for drift.
- **No manual API type duplication** in `api-client.ts` — consume
  `generated/api-types.ts`.
- **Vertice design system**: all new UI follows `index.css` tokens, mono
  labels, lime accent; no new palettes.
- **Demo mode parity**: every new page ships demo data in `demo-data.ts`.
- **Accessibility**: keyboard nav, focus rings, aria labels — the shell
  already sets the pattern.
- **Commits**: conventional messages, `Authored By: TDvorak <info@tdvorak.dev>`
  trailer; squash-merge bodies kept short.
- **Pre-push gate**: build + test + lint + boot smoke, every time.

## 5. Explicitly Out of Scope for v1.0

- Billing / metering (self-hosted; Usage page is monitoring-only).
- Kubernetes backend — Docker/Compose is the runtime.
- Magic-link, GitLab/Bitbucket/Gitea **auth** (removed by auth spec). Git
  *providers* beyond GitHub remain PAT-based.
- Mobile app, TUI, desktop app.
