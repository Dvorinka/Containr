package api

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestTopoSortServicesOrdersByDependsOn(t *testing.T) {
	sorted, err := topoSortServices([]TemplateServiceSpec{
		{Key: "web", DependsOn: []string{"db"}},
		{Key: "db", Type: "database"},
		{Key: "worker", DependsOn: []string{"web", "db"}},
	})
	if err != nil {
		t.Fatalf("topoSortServices: %v", err)
	}
	if sorted[0].Key != "db" || sorted[1].Key != "web" || sorted[2].Key != "worker" {
		t.Fatalf("unexpected order: %v", []string{sorted[0].Key, sorted[1].Key, sorted[2].Key})
	}
}

func TestTopoSortServicesRejectsCycle(t *testing.T) {
	_, err := topoSortServices([]TemplateServiceSpec{
		{Key: "a", DependsOn: []string{"b"}},
		{Key: "b", DependsOn: []string{"a"}},
	})
	if err == nil || !strings.Contains(err.Error(), "cycle") {
		t.Fatalf("expected cycle error, got %v", err)
	}
}

func TestTopoSortServicesRejectsUnknownDep(t *testing.T) {
	_, err := topoSortServices([]TemplateServiceSpec{
		{Key: "a", DependsOn: []string{"ghost"}},
	})
	if err == nil || !strings.Contains(err.Error(), "unknown key") {
		t.Fatalf("expected unknown-key error, got %v", err)
	}
}

func TestResolveStaticExpr(t *testing.T) {
	unresolved := []string{}
	var generated bool

	v := resolveStaticExpr("{{secret}}", nil, &unresolved, &generated)
	if len(v) != 32 || !generated {
		t.Fatalf("secret: got %q generated=%v", v, generated)
	}
	v = resolveStaticExpr("{{secret(8)}}", nil, &unresolved, &generated)
	if len(v) != 16 {
		t.Fatalf("secret(8): got %q", v)
	}
	v = resolveStaticExpr("port-{{random:10}}", nil, &unresolved, &generated)
	if !strings.HasPrefix(v, "port-") {
		t.Fatalf("random: got %q", v)
	}
	v = resolveStaticExpr("{{DOMAIN:-example.com}}", nil, &unresolved, &generated)
	if v != "example.com" {
		t.Fatalf("var default: got %q", v)
	}
	v = resolveStaticExpr("{{DOMAIN}}", map[string]string{"DOMAIN": "x.io"}, &unresolved, &generated)
	if v != "x.io" {
		t.Fatalf("var override: got %q", v)
	}
	v = resolveStaticExpr("{{MISSING}}", nil, &unresolved, &generated)
	if v != "" || len(unresolved) == 0 || unresolved[0] != "MISSING" {
		t.Fatalf("missing var: got %q unresolved=%v", v, unresolved)
	}
}

func TestResolveTemplateGraphDatabaseRefs(t *testing.T) {
	sorted, err := topoSortServices([]TemplateServiceSpec{
		{Key: "db", Type: "database", Runtime: "postgresql", Environment: map[string]string{
			"POSTGRES_DB": "shop",
		}},
		{Key: "web", Type: "web", Runtime: "nginx", DependsOn: []string{"db"}, Environment: map[string]string{
			"DATABASE_URL":  "{{service.db.url}}",
			"DB_HOST":       "{{service.db.host}}",
			"DB_PORT":       "{{service.db.port}}",
			"SESSION_TOKEN": "{{secret}}",
		}},
	})
	if err != nil {
		t.Fatalf("topo: %v", err)
	}
	graph := resolveTemplateGraph(sorted, nil)
	if len(graph.unresolved) > 0 {
		t.Fatalf("unresolved: %v", graph.unresolved)
	}
	web := graph.members[1]
	if web.env["DB_HOST"] != "db" {
		t.Fatalf("DB_HOST=%q", web.env["DB_HOST"])
	}
	if web.env["DB_PORT"] != "5432" {
		t.Fatalf("DB_PORT=%q", web.env["DB_PORT"])
	}
	dbURL := web.env["DATABASE_URL"]
	if !strings.HasPrefix(dbURL, "postgresql://") || !strings.Contains(dbURL, "@db:5432/shop") {
		t.Fatalf("DATABASE_URL=%q", dbURL)
	}
	if len(web.env["SESSION_TOKEN"]) != 32 || !web.secretKeys["SESSION_TOKEN"] {
		t.Fatalf("SESSION_TOKEN=%q secret=%v", web.env["SESSION_TOKEN"], web.secretKeys["SESSION_TOKEN"])
	}
	// Database member must carry the generated password so refs and the
	// container agree.
	db := graph.members[0]
	if pw := db.env["POSTGRES_PASSWORD"]; len(pw) != 32 || !db.secretKeys["POSTGRES_PASSWORD"] {
		t.Fatalf("POSTGRES_PASSWORD=%q secret=%v", pw, db.secretKeys["POSTGRES_PASSWORD"])
	}
	if !strings.Contains(dbURL, db.env["POSTGRES_PASSWORD"]) {
		t.Fatalf("url %q does not carry the resolved password", dbURL)
	}
}

func TestResolveTemplateGraphServiceRefs(t *testing.T) {
	sorted, err := topoSortServices([]TemplateServiceSpec{
		{Key: "api", Type: "web", Runtime: "ghcr.io/x/api:1", Port: 8080},
		{Key: "front", Type: "web", Runtime: "ghcr.io/x/front:1", Port: 3000, DependsOn: []string{"api"}, Environment: map[string]string{
			"API_URL": "{{service.api.url}}/v2",
		}},
	})
	if err != nil {
		t.Fatalf("topo: %v", err)
	}
	graph := resolveTemplateGraph(sorted, nil)
	if got := graph.members[1].env["API_URL"]; got != "http://api:8080/v2" {
		t.Fatalf("API_URL=%q", got)
	}
}

func TestResolveTemplateGraphUnresolvedServiceProp(t *testing.T) {
	sorted, _ := topoSortServices([]TemplateServiceSpec{
		{Key: "web", Type: "web", Runtime: "nginx", Environment: map[string]string{
			"X": "{{service.nope.host}}",
		}},
	})
	graph := resolveTemplateGraph(sorted, nil)
	if len(graph.unresolved) == 0 {
		t.Fatal("expected unresolved ref")
	}
}

func TestValidateTemplateGraph(t *testing.T) {
	if err := validateTemplateGraph([]TemplateServiceSpec{
		{Key: "db", Type: "database", Runtime: "postgresql"},
	}); err != nil {
		t.Fatalf("valid db spec rejected: %v", err)
	}
	if err := validateTemplateGraph([]TemplateServiceSpec{
		{Key: "db", Type: "database", Runtime: "nonsense"},
	}); err == nil {
		t.Fatal("expected unsupported db engine error")
	}
	if err := validateTemplateGraph([]TemplateServiceSpec{
		{Key: "web", Type: "web"},
	}); err == nil {
		t.Fatal("expected missing runtime error")
	}
}

// TestOfficialTemplatesAllParse walks every seeded template and asserts the
// config parses, graph templates topo-sort + validate, and a dry-run resolve
// produces no unresolved refs (defaults cover all expressions).
func TestOfficialTemplatesAllParse(t *testing.T) {
	for _, tpl := range SeedTemplates() {
		var cfg TemplateConfig
		if err := json.Unmarshal([]byte(tpl.Config), &cfg); err != nil {
			t.Errorf("%s: config parse: %v", tpl.ID, err)
			continue
		}
		if len(cfg.Services) == 0 {
			continue
		}
		sorted, err := topoSortServices(cfg.Services)
		if err != nil {
			t.Errorf("%s: topo sort: %v", tpl.ID, err)
			continue
		}
		if err := validateTemplateGraph(sorted); err != nil {
			t.Errorf("%s: validate: %v", tpl.ID, err)
			continue
		}
		var vars []TemplateVariable
		if tpl.Variables != "" {
			if err := json.Unmarshal([]byte(tpl.Variables), &vars); err != nil {
				t.Errorf("%s: variables parse: %v", tpl.ID, err)
				continue
			}
		}
		userVars := map[string]string{}
		for _, v := range vars {
			if v.Default != "" {
				userVars[v.Key] = v.Default
			}
		}
		graph := resolveTemplateGraph(sorted, userVars)
		if len(graph.unresolved) > 0 {
			t.Errorf("%s: unresolved refs: %v", tpl.ID, graph.unresolved)
		}
	}
}
