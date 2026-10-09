package api

import (
	"strings"
	"testing"

	"gopkg.in/yaml.v3"
)

func composeToSpecsForTest(t *testing.T, y string) ([]TemplateServiceSpec, []string, error) {
	t.Helper()
	var file composeFileDef
	if err := yaml.Unmarshal([]byte(y), &file); err != nil {
		t.Fatalf("yaml: %v", err)
	}
	return composeToSpecs(&file)
}

func TestComposeToSpecsConvertsStack(t *testing.T) {
	specs, warnings, err := composeToSpecsForTest(t, `services:
  web:
    image: traefik/whoami:latest
    ports:
      - "80"
    environment:
      GREETING: hello-compose
    depends_on:
      - db
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_PASSWORD: pgsecret123
      POSTGRES_DB: appdb
`)
	if err != nil {
		t.Fatal(err)
	}
	if len(specs) != 2 {
		t.Fatalf("want 2 specs, got %d", len(specs))
	}
	db, web := specs[0], specs[1]
	if db.Key != "db" || db.Type != "database" || db.Runtime != "postgresql" {
		t.Errorf("db spec wrong: %+v", db)
	}
	if db.Environment["POSTGRES_PASSWORD"] != "pgsecret123" {
		t.Errorf("db env lost: %v", db.Environment)
	}
	if web.Key != "web" || web.Type != "web" || web.Runtime != "traefik/whoami:latest" {
		t.Errorf("web spec wrong: %+v", web)
	}
	if web.Port != 80 {
		t.Errorf("web port = %d, want 80", web.Port)
	}
	if len(web.DependsOn) != 1 || web.DependsOn[0] != "db" {
		t.Errorf("web depends_on = %v, want [db]", web.DependsOn)
	}
	if len(warnings) != 0 {
		t.Errorf("unexpected warnings: %v", warnings)
	}
}

func TestComposeToSpecsDeterministicOrder(t *testing.T) {
	y := `services:
  zebra:
    image: alpine
  alpha:
    image: alpine
`
	for i := 0; i < 5; i++ {
		specs, _, err := composeToSpecsForTest(t, y)
		if err != nil {
			t.Fatal(err)
		}
		if specs[0].Key != "alpha" || specs[1].Key != "zebra" {
			t.Fatalf("unstable order: %v", specs)
		}
	}
}

func TestComposeToSpecsDatabaseImages(t *testing.T) {
	cases := map[string]string{
		"postgres:16":   "postgresql",
		"redis:7":       "redis",
		"mysql:8":       "mysql",
		"mariadb:11":    "mariadb",
		"mongo:7":       "mongodb",
		"clickhouse:24": "clickhouse",
	}
	for image, want := range cases {
		specs, _, err := composeToSpecsForTest(t, "services:\n  db:\n    image: "+image+"\n")
		if err != nil {
			t.Fatalf("%s: %v", image, err)
		}
		if specs[0].Type != "database" || specs[0].Runtime != want {
			t.Errorf("%s → %+v, want database/%s", image, specs[0], want)
		}
	}
}

func TestComposeToSpecsNoServices(t *testing.T) {
	_, _, err := composeToSpecsForTest(t, "version: '3'\n")
	if err == nil || !strings.Contains(err.Error(), "no services") {
		t.Errorf("want no-services error, got %v", err)
	}
}

func TestComposeToSpecsWarnings(t *testing.T) {
	_, warnings, err := composeToSpecsForTest(t, `services:
  app:
    build: .
  orphan:
    image: alpine
    environment:
      - UNSET_VAR
`)
	if err != nil {
		t.Fatal(err)
	}
	joined := strings.Join(warnings, "\n")
	if !strings.Contains(joined, "build contexts are not supported") {
		t.Errorf("missing build warning: %v", warnings)
	}
	if !strings.Contains(joined, "UNSET_VAR") {
		t.Errorf("missing env warning: %v", warnings)
	}
}
