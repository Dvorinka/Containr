package api

import (
	"context"
	"database/sql"
	"os"
	"strings"
	"testing"
	"time"

	"containr/internal/database"
	"containr/internal/database/sqlcdb"

	"github.com/google/uuid"
)

func testDSNString(t *testing.T) string {
	t.Helper()
	dsn := os.Getenv("METRICS_TEST_DSN")
	if dsn == "" {
		dsn = os.Getenv("DATABASE_URL")
	}
	if dsn == "" {
		t.Skip("METRICS_TEST_DSN not set")
	}
	return dsn
}

func TestDNSLabel(t *testing.T) {
	cases := map[string]string{
		"my-app":        "my-app",
		"My App_2":      "my-app-2",
		"  web  ":       "web",
		"__weird__name": "weird-name",
		"---":           "",
		"":              "",
	}
	for in, want := range cases {
		if got := dnsLabel(in); got != want {
			t.Errorf("dnsLabel(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestDNSLabelLengthCap(t *testing.T) {
	long := "a" + string(make([]byte, 0)) + "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
	if got := dnsLabel(long); len(got) > 63 {
		t.Fatalf("label over 63 chars: %d", len(got))
	}
}

// Live invariant test against real Postgres — set METRICS_TEST_DSN (or
// DATABASE_URL). Verifies the generated domain queries preserve the
// default-domain and legacy services.domain invariants.
func TestServiceDomainsLiveInvariants(t *testing.T) {
	dsn := testDSNString(t)
	db, err := database.NewConnection(dsn)
	if err != nil {
		t.Fatalf("connect: %v", err)
	}
	defer db.Close()
	ctx := context.Background()
	q := sqlcdb.New(db.DB)

	userID := uuid.New()
	projectID := uuid.New()
	envID := uuid.New()
	serviceID := uuid.New()
	suffix := strings.ReplaceAll(serviceID.String()[:8], "-", "")

	must := func(err error) {
		t.Helper()
		if err != nil {
			t.Fatalf("setup: %v", err)
		}
	}
	_, err = db.Exec(`INSERT INTO users (id, email, password_hash, name) VALUES ($1, $2, 'x', 'test')`,
		userID, "domtest-"+suffix+"@test.local")
	must(err)
	_, err = db.Exec(`INSERT INTO projects (id, name, owner_id, is_approved) VALUES ($1, $2, $3, true)`,
		projectID, "domtest-"+suffix, userID)
	must(err)
	_, err = db.Exec(`INSERT INTO environments (id, name, project_id) VALUES ($1, 'production', $2)`,
		envID, projectID)
	must(err)
	_, err = db.Exec(`INSERT INTO services (id, name, project_id, environment_id, service_type, source_type)
		VALUES ($1, 'domtest-`+suffix+`', $2, $3, 'web', 'image')`,
		serviceID, projectID, envID)
	must(err)
	defer func() {
		_, _ = db.Exec(`DELETE FROM users WHERE id = $1`, userID)
	}()

	d1, err := q.CreateServiceDomain(ctx, sqlcdb.CreateServiceDomainParams{
		ServiceID: serviceID, Domain: "a-" + suffix + ".example.com", IsDefault: true})
	if err != nil {
		t.Fatalf("create d1: %v", err)
	}
	d2, err := q.CreateServiceDomain(ctx, sqlcdb.CreateServiceDomainParams{
		ServiceID: serviceID, Domain: "b-" + suffix + ".example.com", IsDefault: false})
	if err != nil {
		t.Fatalf("create d2: %v", err)
	}

	syncDefaultDomain(db, serviceID)
	var legacy string
	if err := db.QueryRow(`SELECT domain FROM services WHERE id = $1`, serviceID).Scan(&legacy); err != nil {
		t.Fatalf("read legacy: %v", err)
	}
	if legacy != d1.Domain {
		t.Fatalf("legacy domain = %q, want %q", legacy, d1.Domain)
	}

	// Switch default: exactly one row stays default, legacy follows.
	if err := q.ClearServiceDomainDefault(ctx, serviceID); err != nil {
		t.Fatalf("clear: %v", err)
	}
	if _, err := q.SetServiceDomainDefault(ctx, sqlcdb.SetServiceDomainDefaultParams{
		ID: d2.ID, ServiceID: serviceID}); err != nil {
		t.Fatalf("set default: %v", err)
	}
	syncDefaultDomain(db, serviceID)
	if err := db.QueryRow(`SELECT domain FROM services WHERE id = $1`, serviceID).Scan(&legacy); err != nil {
		t.Fatalf("read legacy2: %v", err)
	}
	if legacy != d2.Domain {
		t.Fatalf("legacy after switch = %q, want %q", legacy, d2.Domain)
	}

	doms := loadServiceDomains(db, serviceID)
	if len(doms) != 2 || !doms[0].IsDefault || doms[0].Domain != d2.Domain {
		t.Fatalf("list order wrong: %+v", doms)
	}

	// Deleting the default falls back to the remaining domain.
	if _, err := q.DeleteServiceDomain(ctx, sqlcdb.DeleteServiceDomainParams{
		ID: d2.ID, ServiceID: serviceID}); err != nil {
		t.Fatalf("delete d2: %v", err)
	}
	syncDefaultDomain(db, serviceID)
	if err := db.QueryRow(`SELECT domain FROM services WHERE id = $1`, serviceID).Scan(&legacy); err != nil {
		t.Fatalf("read legacy3: %v", err)
	}
	if legacy != d1.Domain {
		t.Fatalf("legacy after delete = %q, want %q", legacy, d1.Domain)
	}
}

// Live clone test: cloneServiceRow must copy config, domains, and variables
// verbatim, start stopped, and land in the target project/environment.
func TestCloneServiceRowLive(t *testing.T) {
	dsn := testDSNString(t)
	db, err := database.NewConnection(dsn)
	if err != nil {
		t.Fatalf("connect: %v", err)
	}
	defer db.Close()
	ctx := context.Background()
	q := sqlcdb.New(db.DB)

	userID := uuid.New()
	projectID := uuid.New()
	envID := uuid.New()
	serviceID := uuid.New()
	suffix := strings.ReplaceAll(serviceID.String()[:8], "-", "")
	must := func(err error) {
		t.Helper()
		if err != nil {
			t.Fatalf("setup: %v", err)
		}
	}
	_, err = db.Exec(`INSERT INTO users (id, email, password_hash, name) VALUES ($1, $2, 'x', 'test')`,
		userID, "clone-"+suffix+"@test.local")
	must(err)
	_, err = db.Exec(`INSERT INTO projects (id, name, owner_id, is_approved) VALUES ($1, $2, $3, true)`,
		projectID, "clone-"+suffix, userID)
	must(err)
	_, err = db.Exec(`INSERT INTO environments (id, name, project_id) VALUES ($1, 'production', $2)`,
		envID, projectID)
	must(err)
	_, err = db.Exec(`INSERT INTO services (id, name, project_id, environment_id, service_type, source_type,
		image_name, port, volumes, traefik_labels, maintenance_mode)
		VALUES ($1, $2, $3, $4, 'web', 'image', 'traefik/whoami:latest', 80,
			'[{"mount":"/data"}]'::jsonb,
			'{"middlewares.rl.ratelimit.average":"100"}'::jsonb, true)`,
		serviceID, "clonesrc-"+suffix, projectID, envID)
	must(err)
	defer func() { _, _ = db.Exec(`DELETE FROM users WHERE id = $1`, userID) }()

	if _, err := q.CreateServiceDomain(ctx, sqlcdb.CreateServiceDomainParams{
		ServiceID: serviceID, Domain: "src-" + suffix + ".example.com", IsDefault: true}); err != nil {
		t.Fatalf("seed domain: %v", err)
	}
	if _, err := db.Exec(`INSERT INTO environment_variables (id, service_id, key, value, is_secret)
		VALUES ($1, $2, 'FOO', 'bar', false)`, uuid.New(), serviceID); err != nil {
		t.Fatalf("seed var: %v", err)
	}

	cloneID, err := cloneServiceRow(db, serviceID, projectID, "clone-"+suffix, "")
	if err != nil {
		t.Fatalf("clone: %v", err)
	}

	var status, imageName, env string
	var maintenance bool
	var volumes, labels []byte
	if err := db.QueryRow(`SELECT status, image_name, COALESCE(environment,''), maintenance_mode,
		volumes, traefik_labels FROM services WHERE id = $1`, cloneID).
		Scan(&status, &imageName, &env, &maintenance, &volumes, &labels); err != nil {
		t.Fatalf("read clone: %v", err)
	}
	if status != "stopped" || imageName != "traefik/whoami:latest" || env != "production" {
		t.Fatalf("clone mismatch: %v %v %v", status, imageName, env)
	}
	if !maintenance || string(volumes) == "[]" || string(labels) == "{}" {
		t.Fatalf("clone dropped config: maint=%v vol=%s labels=%s", maintenance, volumes, labels)
	}
	doms := loadServiceDomains(db, cloneID)
	if len(doms) != 1 || doms[0].Domain != "src-"+suffix+".example.com" || !doms[0].IsDefault {
		t.Fatalf("domains not cloned: %+v", doms)
	}
	var varVal string
	if err := db.QueryRow(`SELECT value FROM environment_variables WHERE service_id = $1 AND key = 'FOO'`,
		cloneID).Scan(&varVal); err != nil || varVal != "bar" {
		t.Fatalf("vars not cloned: %v %q", err, varVal)
	}
}

// Live preview-environment test: generated queries must preserve the
// access-check join, the status-sync CASE, and the sweep listing.
func TestPreviewEnvironmentsLiveInvariants(t *testing.T) {
	dsn := testDSNString(t)
	db, err := database.NewConnection(dsn)
	if err != nil {
		t.Fatalf("connect: %v", err)
	}
	defer db.Close()
	ctx := context.Background()
	q := sqlcdb.New(db.DB)

	userID := uuid.New()
	projectID := uuid.New()
	envID := uuid.New()
	srcID := uuid.New()
	cloneID := uuid.New()
	previewID := uuid.New()
	suffix := strings.ReplaceAll(previewID.String()[:8], "-", "")
	must := func(err error) {
		t.Helper()
		if err != nil {
			t.Fatalf("setup: %v", err)
		}
	}
	_, err = db.Exec(`INSERT INTO users (id, email, password_hash, name) VALUES ($1, $2, 'x', 'test')`,
		userID, "prev-"+suffix+"@test.local")
	must(err)
	_, err = db.Exec(`INSERT INTO projects (id, name, owner_id, is_approved) VALUES ($1, $2, $3, true)`,
		projectID, "prev-"+suffix, userID)
	must(err)
	_, err = db.Exec(`INSERT INTO environments (id, name, project_id) VALUES ($1, 'production', $2)`,
		envID, projectID)
	must(err)
	for _, p := range [][3]interface{}{{srcID, "src-" + suffix, "running"}, {cloneID, "clone-" + suffix, "running"}} {
		_, err = db.Exec(`INSERT INTO services (id, name, project_id, environment_id, service_type, source_type, status)
			VALUES ($1, $2, $3, $4, 'web', 'image', $5)`,
			p[0], p[1], projectID, envID, p[2])
		must(err)
	}
	defer func() { _, _ = db.Exec(`DELETE FROM users WHERE id = $1`, userID) }()

	must(q.CreatePreviewEnvironment(ctx, sqlcdb.CreatePreviewEnvironmentParams{
		ID:               previewID,
		ProjectID:        projectID,
		ServiceID:        srcID,
		PreviewServiceID: uuid.NullUUID{UUID: cloneID, Valid: true},
		BranchName:       "feat-" + suffix,
		Environment:      "preview-feat-" + suffix,
		Status:           "building",
		ExpiresAt:        time.Now().Add(-time.Hour), // already past TTL → sweepable
	}))

	// List + service join.
	rows, err := q.ListPreviewEnvironmentsForProject(ctx, projectID)
	if err != nil || len(rows) != 1 {
		t.Fatalf("list: %v %d", err, len(rows))
	}
	if rows[0].ID != previewID || !rows[0].SvcID.Valid || rows[0].ServiceName.String != "src-"+suffix {
		t.Fatalf("list row: %+v", rows[0])
	}

	// Access-check join: owner reads; a stranger does not.
	if _, err := q.GetPreviewEnvironment(ctx, sqlcdb.GetPreviewEnvironmentParams{
		ID: previewID, OwnerID: userID}); err != nil {
		t.Fatalf("owner read: %v", err)
	}
	if _, err := q.GetPreviewEnvironment(ctx, sqlcdb.GetPreviewEnvironmentParams{
		ID: previewID, OwnerID: uuid.New()}); err != nil {
		t.Fatalf("approved project should be public-read: %v", err)
	}

	// Status sync folds clone's 'running' into the preview row.
	if err := q.SyncPreviewStatuses(ctx); err != nil {
		t.Fatalf("sync: %v", err)
	}
	var status string
	if err := db.QueryRow(`SELECT status FROM preview_environments WHERE id = $1`, previewID).Scan(&status); err != nil {
		t.Fatalf("read status: %v", err)
	}
	if status != "running" {
		t.Fatalf("status after sync = %q, want running", status)
	}

	// TTL sweep picks it up (expired at insert), marks expired.
	sweep, err := q.ListSweepablePreviews(ctx)
	if err != nil {
		t.Fatalf("sweep list: %v", err)
	}
	found := false
	for _, s := range sweep {
		if s.ID == previewID && s.PreviewServiceID.UUID == cloneID {
			found = true
		}
	}
	if !found {
		t.Fatalf("sweepable list missing preview: %+v", sweep)
	}
	must(q.MarkPreviewEnvironmentStatus(ctx, sqlcdb.MarkPreviewEnvironmentStatusParams{Status: "expired", ID: previewID}))
	sweep, _ = q.ListSweepablePreviews(ctx)
	for _, s := range sweep {
		if s.ID == previewID {
			t.Fatal("expired preview still sweepable")
		}
	}

	// Owner lookup and delete.
	owner, err := q.GetPreviewEnvironmentOwner(ctx, previewID)
	if err != nil || owner != userID {
		t.Fatalf("owner: %v %v", owner, err)
	}
	must(q.DeletePreviewEnvironment(ctx, previewID))
}

// Live deployment lifecycle: generated queries preserve list ordering,
// the access join, and the status-transition writes.
func TestDeploymentsLiveInvariants(t *testing.T) {
	dsn := testDSNString(t)
	db, err := database.NewConnection(dsn)
	if err != nil {
		t.Fatalf("connect: %v", err)
	}
	defer db.Close()
	ctx := context.Background()
	q := sqlcdb.New(db.DB)

	userID := uuid.New()
	projectID := uuid.New()
	envID := uuid.New()
	serviceID := uuid.New()
	deployID := uuid.New()
	suffix := strings.ReplaceAll(deployID.String()[:8], "-", "")
	must := func(err error) {
		t.Helper()
		if err != nil {
			t.Fatalf("setup: %v", err)
		}
	}
	_, err = db.Exec(`INSERT INTO users (id, email, password_hash, name) VALUES ($1, $2, 'x', 'test')`,
		userID, "dep-"+suffix+"@test.local")
	must(err)
	_, err = db.Exec(`INSERT INTO projects (id, name, owner_id, is_approved) VALUES ($1, $2, $3, true)`,
		projectID, "dep-"+suffix, userID)
	must(err)
	_, err = db.Exec(`INSERT INTO environments (id, name, project_id) VALUES ($1, 'production', $2)`,
		envID, projectID)
	must(err)
	_, err = db.Exec(`INSERT INTO services (id, name, project_id, environment_id, service_type, source_type, status)
		VALUES ($1, $2, $3, $4, 'web', 'image', 'running')`,
		serviceID, "dep-"+suffix, projectID, envID)
	must(err)
	defer func() { _, _ = db.Exec(`DELETE FROM users WHERE id = $1`, userID) }()

	must(q.InsertDeployment(ctx, sqlcdb.InsertDeploymentParams{
		ID:        deployID,
		ServiceID: serviceID,
		Version:   "v1-" + suffix,
		Status:    sql.NullString{String: "pending", Valid: true},
	}))
	total, err := q.CountDeploymentsForService(ctx, serviceID)
	if err != nil || total != 1 {
		t.Fatalf("count: %v %d", err, total)
	}
	rows, err := q.ListDeploymentsForService(ctx, sqlcdb.ListDeploymentsForServiceParams{
		ServiceID: serviceID, Limit: 10, Offset: 0})
	if err != nil || len(rows) != 1 || rows[0].ID != deployID {
		t.Fatalf("list: %v %+v", err, rows)
	}

	// Access join returns owner.
	access, err := q.GetDeploymentAccess(ctx, deployID)
	if err != nil || access.OwnerID != userID || access.ServiceID != serviceID {
		t.Fatalf("access: %v %+v", err, access)
	}

	// Recent feed honors the access predicate.
	feed, err := q.ListRecentAccessibleDeployments(ctx, sqlcdb.ListRecentAccessibleDeploymentsParams{
		OwnerID: userID, Limit: 10, Offset: 0})
	if err != nil {
		t.Fatalf("feed: %v", err)
	}
	found := false
	for _, d := range feed {
		if d.ID == deployID && d.ServiceName == "dep-"+suffix {
			found = true
		}
	}
	if !found {
		t.Fatalf("feed missing deployment: %+v", feed)
	}

	// Status transitions.
	must(q.SetDeploymentStatus(ctx, sqlcdb.SetDeploymentStatusParams{
		Status: sql.NullString{String: "queued", Valid: true}, UpdatedAt: sql.NullTime{Time: time.Now(), Valid: true}, ID: deployID}))
	must(q.SyncDeploymentProgress(ctx, sqlcdb.SyncDeploymentProgressParams{
		Status:    sql.NullString{String: "deployed", Valid: true},
		ImageName: sql.NullString{String: "nginx", Valid: true},
		ImageTag:  sql.NullString{String: "alpine", Valid: true},
		UpdatedAt: sql.NullTime{Time: time.Now(), Valid: true},
		ID:        deployID,
	}))
	r, err := q.GetDeploymentWithProject(ctx, deployID)
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if r.Status.String != "deployed" || r.ImageName.String != "nginx" || r.ProjectID != projectID {
		t.Fatalf("post-sync row: %+v", r)
	}
	must(q.FailDeployment(ctx, sqlcdb.FailDeploymentParams{
		Error:       sql.NullString{String: "boom", Valid: true},
		CompletedAt: sql.NullTime{Time: time.Now(), Valid: true},
		ID:          deployID,
	}))
	r, _ = q.GetDeploymentWithProject(ctx, deployID)
	if r.Status.String != "failed" || r.Error.String != "boom" {
		t.Fatalf("post-fail row: %+v", r)
	}
}

// TestRuntimeLiveInvariants exercises the runtime.sql queries: the
// legacy-column COALESCE chain in GetServiceRuntimeWithOwner, the
// deployed-image concat, and the conditional published-port update.
func TestRuntimeLiveInvariants(t *testing.T) {
	dsn := testDSNString(t)
	db, err := database.NewConnection(dsn)
	if err != nil {
		t.Fatalf("connect: %v", err)
	}
	defer db.Close()
	ctx := context.Background()
	q := sqlcdb.New(db.DB)

	userID := uuid.New()
	projectID := uuid.New()
	envID := uuid.New()
	serviceID := uuid.New()
	suffix := strings.ReplaceAll(serviceID.String()[:8], "-", "")
	must := func(err error) {
		t.Helper()
		if err != nil {
			t.Fatalf("setup: %v", err)
		}
	}
	_, err = db.Exec(`INSERT INTO users (id, email, password_hash, name) VALUES ($1, $2, 'x', 'test')`,
		userID, "rt-"+suffix+"@test.local")
	must(err)
	_, err = db.Exec(`INSERT INTO projects (id, name, owner_id, is_approved) VALUES ($1, $2, $3, true)`,
		projectID, "rt-"+suffix, userID)
	must(err)
	_, err = db.Exec(`INSERT INTO environments (id, name, project_id) VALUES ($1, 'production', $2)`,
		envID, projectID)
	must(err)
	// Only legacy columns populated — the COALESCE chain must surface them.
	_, err = db.Exec(`INSERT INTO services (id, name, project_id, environment_id, service_type, source_type,
		source_url, image_name, start_command, port) VALUES ($1, $2, $3, $4, 'worker', 'git', $5, $6, 'run.sh', 8080)`,
		serviceID, "rt-"+suffix, projectID, envID, "https://git.example/x.git", "repo/img:latest")
	must(err)
	defer func() { _, _ = db.Exec(`DELETE FROM users WHERE id = $1`, userID) }()

	row, err := q.GetServiceRuntimeWithOwner(ctx, serviceID)
	if err != nil {
		t.Fatalf("runtime row: %v", err)
	}
	if row.Type != "worker" || row.Image != "repo/img:latest" || row.Command != "run.sh" ||
		row.GitRepo != "https://git.example/x.git" || row.OwnerID != userID {
		t.Fatalf("COALESCE chain lost legacy columns: %+v", row)
	}
	svc := serviceFromRuntimeRow(row)
	if svc.Type != "worker" || svc.Image != "repo/img:latest" || svc.Port != 8080 {
		t.Fatalf("mapped service wrong: %+v", svc)
	}

	// Sibling refs + port lookup.
	refs, err := q.ListProjectServiceRefs(ctx, projectID)
	if err != nil || len(refs) != 1 || refs[0].Name != "rt-"+suffix {
		t.Fatalf("refs: %v %+v", err, refs)
	}
	port, err := q.GetServicePort(ctx, serviceID)
	if err != nil || port != 8080 {
		t.Fatalf("port: %v %d", err, port)
	}

	// Variables round-trip.
	_, err = db.Exec(`INSERT INTO environment_variables (id, service_id, key, value, is_secret)
		VALUES (gen_random_uuid(), $1, 'API_KEY', 'shh', true), (gen_random_uuid(), $1, 'PLAIN', 'p', false)`,
		serviceID)
	must(err)
	vars, err := q.ListServiceVariablesWithSecret(ctx, serviceID)
	if err != nil || len(vars) != 2 {
		t.Fatalf("vars: %v %+v", err, vars)
	}
	vals, err := q.ListServiceVariableValues(ctx, serviceID)
	if err != nil || len(vals) != 2 {
		t.Fatalf("vals: %v %+v", err, vals)
	}
	got, err := q.GetServiceVariableValue(ctx, sqlcdb.GetServiceVariableValueParams{ServiceID: serviceID, Key: "API_KEY"})
	if err != nil || got != "shh" {
		t.Fatalf("var value: %v %q", err, got)
	}

	// Node agent listing through container_instances.
	_, err = db.Exec(`INSERT INTO node_agents (id, name, hostname, ip_address, port) VALUES ($1, $2, 'h', '127.0.0.1', 9999)`,
		"agent-"+suffix, "agent-"+suffix)
	must(err)
	_, err = db.Exec(`INSERT INTO container_instances (id, name, image, project_id, service_id, node_agent_id)
		VALUES ($1, 'c', 'img', $2, $3, $4)`,
		"ci-"+suffix, projectID.String(), serviceID.String(), "agent-"+suffix)
	must(err)
	agents, err := q.ListNodeAgentsForService(ctx, serviceID.String())
	if err != nil || len(agents) != 1 || agents[0] != "agent-"+suffix {
		t.Fatalf("agents: %v %+v", err, agents)
	}

	// Last deployed image: only 'deployed' rows, latest first.
	d1, d2 := uuid.New(), uuid.New()
	must(q.InsertDeployment(ctx, sqlcdb.InsertDeploymentParams{
		ID: d1, ServiceID: serviceID, Version: "v1",
		Status: sql.NullString{String: "failed", Valid: true},
	}))
	must(q.InsertDeployment(ctx, sqlcdb.InsertDeploymentParams{
		ID: d2, ServiceID: serviceID, Version: "v2",
		Status: sql.NullString{String: "deployed", Valid: true},
	}))
	must(q.SyncDeploymentProgress(ctx, sqlcdb.SyncDeploymentProgressParams{
		Status:    sql.NullString{String: "deployed", Valid: true},
		ImageName: sql.NullString{String: "app", Valid: true},
		ImageTag:  sql.NullString{String: "v2", Valid: true},
		UpdatedAt: sql.NullTime{Time: time.Now(), Valid: true},
		ID:        d2,
	}))
	img, err := q.GetLastDeployedImage(ctx, serviceID)
	if err != nil || img != "app:v2" {
		t.Fatalf("last image: %v %q", err, img)
	}

	// Conditional published-port update: writes once, no-ops on repeat.
	must(q.SetServicePublishedPort(ctx, sqlcdb.SetServicePublishedPortParams{PublishedPort: 30001, ID: serviceID}))
	p, err := q.GetServicePublishedPort(ctx, serviceID)
	if err != nil || p != 30001 {
		t.Fatalf("published port: %v %d", err, p)
	}
	must(q.SetServiceReplicas(ctx, sqlcdb.SetServiceReplicasParams{
		Replicas: 3, UpdatedAt: sql.NullTime{Time: time.Now(), Valid: true}, ID: serviceID}))
	row, _ = q.GetServiceRuntimeWithOwner(ctx, serviceID)
	if row.Replicas != 3 {
		t.Fatalf("replicas: %+v", row)
	}

	// Sleeper reads: candidate sweep + domain/status text lookups.
	_, err = db.Exec(`UPDATE services SET sleep_enabled = true, domain = 'rt.example.com', status = 'running' WHERE id = $1`, serviceID)
	must(err)
	cands, err := q.ListSleepCandidates(ctx)
	if err != nil {
		t.Fatalf("sleep candidates: %v", err)
	}
	var mine *sqlcdb.ListSleepCandidatesRow
	for i := range cands {
		if cands[i].ID == serviceID {
			mine = &cands[i]
		}
	}
	if mine == nil || mine.SleepIdleMinutes != 15 {
		t.Fatalf("candidate missing/idle wrong: %+v", mine)
	}
	dom, err := q.GetServiceDomainText(ctx, serviceID)
	if err != nil || dom != "rt.example.com" {
		t.Fatalf("domain text: %v %q", err, dom)
	}
	st, err := q.GetServiceStatusText(ctx, serviceID)
	if err != nil || st != "running" {
		t.Fatalf("status text: %v %q", err, st)
	}
}
