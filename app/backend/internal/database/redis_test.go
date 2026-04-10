package database

import "testing"

func TestNewRedisRejectsEmptyURL(t *testing.T) {
	if _, err := NewRedis(""); err == nil {
		t.Fatal("expected error for empty redis URL")
	}
}

func TestNewRedisRejectsInvalidURL(t *testing.T) {
	if _, err := NewRedis("://bad-redis-url"); err == nil {
		t.Fatal("expected error for invalid redis URL")
	}
}

func TestNewRedisAcceptsValidURL(t *testing.T) {
	r, err := NewRedis("redis://:password@localhost:6379/0")
	if err != nil {
		t.Fatalf("expected valid redis URL, got error: %v", err)
	}
	_ = r.Close()
}
