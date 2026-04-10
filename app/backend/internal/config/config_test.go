package config

import (
	"reflect"
	"strings"
	"testing"
)

func TestLoadUsesCORSAllowedOriginsAlias(t *testing.T) {
	t.Setenv("ENVIRONMENT", "development")
	t.Setenv("CORS_ORIGINS", "")
	t.Setenv("CORS_ALLOWED_ORIGINS", "http://localhost:3000,https://app.example.com")

	cfg := Load()
	want := []string{"http://localhost:3000", "https://app.example.com"}
	if !reflect.DeepEqual(cfg.CORSOrigins, want) {
		t.Fatalf("unexpected CORS origins: got %v want %v", cfg.CORSOrigins, want)
	}
}

func TestLoadPrefersCorsOriginsOverAlias(t *testing.T) {
	t.Setenv("ENVIRONMENT", "development")
	t.Setenv("CORS_ORIGINS", "https://preferred.example.com")
	t.Setenv("CORS_ALLOWED_ORIGINS", "https://alias.example.com")

	cfg := Load()
	want := []string{"https://preferred.example.com"}
	if !reflect.DeepEqual(cfg.CORSOrigins, want) {
		t.Fatalf("unexpected CORS origins precedence: got %v want %v", cfg.CORSOrigins, want)
	}
}

func TestLoadUsesRedisURL(t *testing.T) {
	t.Setenv("ENVIRONMENT", "development")
	t.Setenv("REDIS_URL", "redis://:pass@redis.internal:6380/1")

	cfg := Load()
	if cfg.RedisURL != "redis://:pass@redis.internal:6380/1" {
		t.Fatalf("unexpected Redis URL: got %q", cfg.RedisURL)
	}
}

func TestLoadEncodesRedisPasswordSpecialCharacters(t *testing.T) {
	t.Setenv("ENVIRONMENT", "development")
	t.Setenv("REDIS_URL", "redis://:Redis123!@#@redis.internal:6379/0")

	cfg := Load()
	if cfg.RedisURL != "redis://:Redis123%21%40%23@redis.internal:6379/0" {
		t.Fatalf("expected encoded Redis URL, got %q", cfg.RedisURL)
	}
}

func TestValidateRejectsWildcardCorsWithCredentialsInProduction(t *testing.T) {
	t.Setenv("ENVIRONMENT", "production")
	cfg := Config{
		JWTSecret:       "this-is-a-very-strong-production-secret-123",
		DatabaseURL:     "postgres://user:pass@localhost/containr?sslmode=disable",
		Port:            8080,
		BcryptCost:      12,
		CookieSecure:    true,
		CORSOrigins:     []string{"*"},
		CORSCredentials: true,
	}

	err := cfg.Validate()
	if err == nil || !strings.Contains(err.Error(), "CORS_ORIGINS cannot include '*'") {
		t.Fatalf("expected wildcard CORS validation error, got %v", err)
	}
}

func TestValidateRejectsEmptyCorsOriginsInProduction(t *testing.T) {
	t.Setenv("ENVIRONMENT", "production")
	cfg := Config{
		JWTSecret:       "this-is-a-very-strong-production-secret-123",
		DatabaseURL:     "postgres://user:pass@localhost/containr?sslmode=disable",
		Port:            8080,
		BcryptCost:      12,
		CookieSecure:    true,
		CORSOrigins:     []string{"   "},
		CORSCredentials: true,
	}

	err := cfg.Validate()
	if err == nil || !strings.Contains(err.Error(), "CORS_ORIGINS must include at least one explicit origin") {
		t.Fatalf("expected empty CORS origins validation error, got %v", err)
	}
}

func TestValidateAllowsWildcardCorsWithoutCredentialsInProduction(t *testing.T) {
	t.Setenv("ENVIRONMENT", "production")
	cfg := Config{
		JWTSecret:       "this-is-a-very-strong-production-secret-123",
		DatabaseURL:     "postgres://user:pass@localhost/containr?sslmode=disable",
		Port:            8080,
		BcryptCost:      12,
		CookieSecure:    true,
		CORSOrigins:     []string{"*"},
		CORSCredentials: false,
	}

	if err := cfg.Validate(); err != nil {
		t.Fatalf("expected wildcard CORS without credentials to pass, got %v", err)
	}
}

func TestValidateRejectsInsecureCookieInProduction(t *testing.T) {
	t.Setenv("ENVIRONMENT", "production")
	cfg := Config{
		JWTSecret:       "this-is-a-very-strong-production-secret-123",
		DatabaseURL:     "postgres://user:pass@localhost/containr?sslmode=disable",
		Port:            8080,
		BcryptCost:      12,
		CookieSecure:    false,
		CORSOrigins:     []string{"https://app.example.com"},
		CORSCredentials: true,
	}

	err := cfg.Validate()
	if err == nil || !strings.Contains(err.Error(), "COOKIE_SECURE must be true") {
		t.Fatalf("expected COOKIE_SECURE validation error, got %v", err)
	}
}

func TestValidateRejectsShortJWTSecretInProduction(t *testing.T) {
	t.Setenv("ENVIRONMENT", "production")
	cfg := Config{
		JWTSecret:       "short-secret",
		DatabaseURL:     "postgres://user:pass@localhost/containr?sslmode=disable",
		Port:            8080,
		BcryptCost:      12,
		CookieSecure:    true,
		CORSOrigins:     []string{"https://app.example.com"},
		CORSCredentials: true,
	}

	err := cfg.Validate()
	if err == nil || !strings.Contains(err.Error(), "JWT_SECRET must be at least 32 characters") {
		t.Fatalf("expected JWT_SECRET length validation error, got %v", err)
	}
}

func TestValidateRejectsSeedDataOnStartInProduction(t *testing.T) {
	t.Setenv("ENVIRONMENT", "production")
	cfg := Config{
		JWTSecret:       "this-is-a-very-strong-production-secret-123",
		DatabaseURL:     "postgres://user:pass@localhost/containr?sslmode=disable",
		Port:            8080,
		BcryptCost:      12,
		CookieSecure:    true,
		CORSOrigins:     []string{"https://app.example.com"},
		CORSCredentials: true,
		SeedDataOnStart: true,
	}

	err := cfg.Validate()
	if err == nil || !strings.Contains(err.Error(), "SEED_DATA_ON_START must be false") {
		t.Fatalf("expected SEED_DATA_ON_START validation error, got %v", err)
	}
}

func TestLoadUsesNewStartupDefaults(t *testing.T) {
	t.Setenv("ENVIRONMENT", "development")
	t.Setenv("AUTO_MIGRATE", "")
	t.Setenv("MIGRATION_LOCK_TIMEOUT", "")
	t.Setenv("SEED_DATA_ON_START", "")
	t.Setenv("MAX_REQUEST_BODY_BYTES", "")

	cfg := Load()

	if !cfg.AutoMigrate {
		t.Fatal("expected AUTO_MIGRATE default to true")
	}
	if cfg.MigrationLockTimeout <= 0 {
		t.Fatalf("expected positive MIGRATION_LOCK_TIMEOUT, got %v", cfg.MigrationLockTimeout)
	}
	if cfg.SeedDataOnStart {
		t.Fatal("expected SEED_DATA_ON_START default to false")
	}
	if cfg.MaxRequestBody <= 0 {
		t.Fatalf("expected positive MAX_REQUEST_BODY_BYTES, got %d", cfg.MaxRequestBody)
	}
}
