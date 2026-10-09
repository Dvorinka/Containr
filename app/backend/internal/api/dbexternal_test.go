package api

import (
	"context"
	"net"
	"testing"
)

func TestNormalizeExternalRequestDefaults(t *testing.T) {
	req := externalDatabaseRequest{Type: "PostgreSQL", Host: " db.example.com ", Port: 0}
	if err := normalizeExternalRequest(&req); err != nil {
		t.Fatalf("normalize failed: %v", err)
	}
	if req.Type != "postgresql" {
		t.Fatalf("type not normalized: %q", req.Type)
	}
	if req.Host != "db.example.com" {
		t.Fatalf("host not trimmed: %q", req.Host)
	}
	if req.Port != 5432 {
		t.Fatalf("default port = %d, want 5432", req.Port)
	}
}

func TestNormalizeExternalRequestRejects(t *testing.T) {
	cases := []externalDatabaseRequest{
		{Type: "sqlite", Host: "x"},                  // unsupported type
		{Type: "postgresql", Host: "  "},             // empty host
		{Type: "postgresql", Host: "h", Port: 70000}, // out of range
	}
	for i, req := range cases {
		if err := normalizeExternalRequest(&req); err == nil {
			t.Fatalf("case %d: expected error", i)
		}
	}
}

func TestExternalConnectionURLMasking(t *testing.T) {
	ext := &DatabaseExternalRef{
		Host:     "db.example.com",
		Port:     5432,
		Database: "appdb",
		Username: "svc",
		SSL:      true,
	}
	u := externalConnectionURL("postgresql", ext, "s3cret")
	if u != "postgres://svc:s3cret@db.example.com:5432/appdb?sslmode=require" {
		t.Fatalf("unexpected pg url: %s", u)
	}
	u = externalConnectionURL("postgresql", ext, "")
	if u != "postgres://svc@db.example.com:5432/appdb?sslmode=require" {
		t.Fatalf("unexpected passwordless url: %s", u)
	}

	r := &DatabaseExternalRef{Host: "cache.internal", Port: 6379, SSL: true}
	u = externalConnectionURL("redis", r, "pw")
	if u != "rediss://:pw@cache.internal:6379" {
		t.Fatalf("unexpected redis url: %s", u)
	}
}

func TestProbeExternalDatabaseTCP(t *testing.T) {
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listen: %v", err)
	}
	defer ln.Close()
	port := ln.Addr().(*net.TCPAddr).Port

	// TCP fallback path — mysql uses a plain dial.
	latency, err := probeExternalDatabase(context.Background(), externalDatabaseRequest{
		Type: "mysql", Host: "127.0.0.1", Port: port,
	})
	if err != nil {
		t.Fatalf("probe should succeed against open listener: %v", err)
	}
	if latency <= 0 {
		t.Fatalf("latency not recorded")
	}

	// Closed port must fail fast.
	if _, err := probeExternalDatabase(context.Background(), externalDatabaseRequest{
		Type: "mysql", Host: "127.0.0.1", Port: 1,
	}); err == nil {
		t.Fatalf("probe should fail against closed port")
	}
}

func TestRedisTLSConfig(t *testing.T) {
	if redisTLSConfig(false, "h") != nil {
		t.Fatalf("disabled ssl must produce nil tls config")
	}
	cfg := redisTLSConfig(true, "db.example.com")
	if cfg == nil || cfg.ServerName != "db.example.com" {
		t.Fatalf("expected ServerName passthrough, got %+v", cfg)
	}
}
