package api

import (
	"strings"
	"testing"
)

func TestNormalizeTraefikLabels(t *testing.T) {
	valid := map[string]string{
		"middlewares.rl.ratelimit.average":                             "100",
		"middlewares.rl.ratelimit.period":                              "1m",
		"middlewares.sec.headers.customrequestheaders.X-Frame-Options": "DENY",
		"middlewares.gzip.compress":                                    "true",
	}
	out, err := normalizeTraefikLabels(valid)
	if err != nil {
		t.Fatalf("valid labels rejected: %v", err)
	}
	if len(out) != len(valid) {
		t.Fatalf("expected %d labels, got %d", len(valid), len(out))
	}
	if out["middlewares.gzip.compress"] != "true" {
		t.Fatalf("flag-style middleware missing: %v", out)
	}
}

func TestNormalizeTraefikLabelsLowercasesType(t *testing.T) {
	out, err := normalizeTraefikLabels(map[string]string{
		"middlewares.rl.RateLimit.average": "10",
	})
	if err != nil {
		t.Fatalf("mixed-case type rejected: %v", err)
	}
	if out["middlewares.rl.ratelimit.average"] != "10" {
		t.Fatalf("type not lowercased: %v", out)
	}
}

func TestNormalizeTraefikLabelsRejects(t *testing.T) {
	cases := map[string]string{
		"traefik.enable":                                 "true", // provider-level
		"middlewares..ratelimit.average":                 "1",    // empty name
		"middlewares.x.evilinject.thing":                 "1",    // unknown type
		"routers.svc.rule":                               "x",    // router hijack
		"middlewares.x.ratelimit.average.bad\ninjection": "1",    // control char in key fails regex
	}
	for k, v := range cases {
		if _, err := normalizeTraefikLabels(map[string]string{k: v}); err == nil {
			t.Fatalf("key %q should have been rejected", k)
		}
	}
}

func TestNormalizeTraefikLabelsRejectsBadValues(t *testing.T) {
	if _, err := normalizeTraefikLabels(map[string]string{"middlewares.a.ratelimit.average": ""}); err == nil {
		t.Fatal("empty value accepted")
	}
	if _, err := normalizeTraefikLabels(map[string]string{"middlewares.a.ratelimit.average": strings.Repeat("x", 600)}); err == nil {
		t.Fatal("oversized value accepted")
	}
	if _, err := normalizeTraefikLabels(map[string]string{"middlewares.a.ratelimit.average": "1\nmalicious"}); err == nil {
		t.Fatal("newline value accepted")
	}
}
