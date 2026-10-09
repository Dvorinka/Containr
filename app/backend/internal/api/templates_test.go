package api

import (
	"encoding/json"
	"testing"
)

func TestNormalizeTemplateServiceType(t *testing.T) {
	valid := []string{"web", "worker", "database", "cron"}
	for _, value := range valid {
		got, err := normalizeTemplateServiceType(value)
		if err != nil {
			t.Fatalf("normalizeTemplateServiceType(%q) returned error: %v", value, err)
		}
		if got != value {
			t.Fatalf("normalizeTemplateServiceType(%q) = %q, want %q", value, got, value)
		}
	}

	_, err := normalizeTemplateServiceType("unsupported")
	if err == nil {
		t.Fatalf("expected unsupported template type to return error")
	}
}

func TestMergeTemplateVariables(t *testing.T) {
	env, secretKeys, missing := mergeTemplateVariables(
		map[string]string{
			"DEFAULT_ONE": "a",
			"DEFAULT_TWO": "b",
		},
		[]TemplateVariable{
			{
				Key:      "REQ",
				Default:  "",
				Required: true,
				Secret:   true,
			},
			{
				Key:      "OPTIONAL",
				Default:  "fallback",
				Required: false,
				Secret:   false,
			},
		},
		map[string]string{
			"REQ":       "provided",
			"EXTRA_KEY": "custom",
		},
	)

	if len(missing) != 0 {
		t.Fatalf("expected no missing required vars, got %v", missing)
	}
	if env["REQ"] != "provided" {
		t.Fatalf("expected REQ=provided, got %q", env["REQ"])
	}
	if env["OPTIONAL"] != "fallback" {
		t.Fatalf("expected OPTIONAL=fallback, got %q", env["OPTIONAL"])
	}
	if env["EXTRA_KEY"] != "custom" {
		t.Fatalf("expected EXTRA_KEY=custom, got %q", env["EXTRA_KEY"])
	}
	if !secretKeys["REQ"] {
		t.Fatalf("expected REQ to be marked secret")
	}
}

func TestResolveTemplateRuntimeImage(t *testing.T) {
	if got := resolveTemplateRuntimeImage("dragonfly"); got == "dragonfly" || got == "" {
		t.Fatalf("expected dragonfly runtime to map to a concrete image, got %q", got)
	}
	if got := resolveTemplateRuntimeImage("custom-runtime"); got != "custom-runtime" {
		t.Fatalf("expected unknown runtime passthrough, got %q", got)
	}
}

func TestSeedTemplatesResolveCleanly(t *testing.T) {
	for _, tpl := range SeedTemplates() {
		var config TemplateConfig
		if err := json.Unmarshal([]byte(tpl.Config), &config); err != nil {
			t.Fatalf("%s: invalid config JSON: %v", tpl.ID, err)
		}
		var variables []TemplateVariable
		if err := json.Unmarshal([]byte(tpl.Variables), &variables); err != nil {
			t.Fatalf("%s: invalid variables JSON: %v", tpl.ID, err)
		}
		if len(config.Services) == 0 {
			continue // legacy single-service template
		}
		sorted, err := topoSortServices(config.Services)
		if err != nil {
			t.Fatalf("%s: topo sort: %v", tpl.ID, err)
		}
		if err := validateTemplateGraph(sorted); err != nil {
			t.Fatalf("%s: graph validation: %v", tpl.ID, err)
		}
		// User vars left empty — every expression must still resolve via
		// defaults, secrets, or service refs.
		graph := resolveTemplateGraph(sorted, map[string]string{})
		if len(graph.unresolved) > 0 {
			t.Fatalf("%s: unresolved expressions: %v", tpl.ID, graph.unresolved)
		}
	}
}
