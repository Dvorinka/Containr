package api

import (
	"context"
	"os"
	"strings"
	"testing"

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
