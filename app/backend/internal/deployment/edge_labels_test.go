package deployment

import (
	"strings"
	"testing"
)

func TestEdgeLabelsCustomMiddlewares(t *testing.T) {
	spec := RuntimeSpec{
		ServiceID: "01234567-89ab-cdef-0123-456789abcdef",
		Port:      8080,
		Domains:   []string{"app.example.com"},
		TraefikLabels: map[string]string{
			"middlewares.rl.ratelimit.average":                              "100",
			"middlewares.rl.ratelimit.period":                               "1m",
			"middlewares.sec.headers.customresponseheaders.X-Frame-Options": "DENY",
		},
	}
	labels := edgeLabels(spec, "containr-edge")

	if got := labels["traefik.http.middlewares.svc-01234567-rl.ratelimit.average"]; got != "100" {
		t.Fatalf("ratelimit label missing: %v", labels)
	}
	if got := labels["traefik.http.middlewares.svc-01234567-sec.headers.customresponseheaders.X-Frame-Options"]; got != "DENY" {
		t.Fatalf("headers label missing: %v", labels)
	}
	chain := labels["traefik.http.routers.svc-01234567.middlewares"]
	if chain != "svc-01234567-rl,svc-01234567-sec" {
		t.Fatalf("middleware chain wrong: %q", chain)
	}
}

func TestEdgeLabelsCustomAfterBuiltins(t *testing.T) {
	spec := RuntimeSpec{
		ServiceID:      "01234567-89ab-cdef-0123-456789abcdef",
		Port:           8080,
		Domains:        []string{"app.example.com"},
		BasicAuthUsers: "u:$apr1$x",
		TraefikLabels: map[string]string{
			"middlewares.rl.ratelimit.average": "10",
		},
	}
	labels := edgeLabels(spec, "containr-edge")
	chain := labels["traefik.http.routers.svc-01234567.middlewares"]
	if !strings.HasPrefix(chain, "svc-01234567-auth,") || !strings.HasSuffix(chain, "svc-01234567-rl") {
		t.Fatalf("builtin should precede custom: %q", chain)
	}
}

func TestEdgeLabelsNoCustom(t *testing.T) {
	spec := RuntimeSpec{
		ServiceID: "01234567-89ab-cdef-0123-456789abcdef",
		Port:      8080,
		Domains:   []string{"app.example.com"},
	}
	labels := edgeLabels(spec, "containr-edge")
	if _, ok := labels["traefik.http.routers.svc-01234567.middlewares"]; ok {
		t.Fatal("middleware chain should be absent with no middlewares")
	}
}
