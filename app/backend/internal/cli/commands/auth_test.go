package commands

import (
	"testing"

	"github.com/spf13/viper"
)

func TestResolveAPIURLDefaultsAndTrimming(t *testing.T) {
	viper.Set("api-url", "")
	viper.Set("current_profile", "")
	viper.Set("profiles.default.api_url", "")
	if got := ResolveAPIURL(); got != "http://localhost:8080/api/v1" {
		t.Fatalf("unexpected default api url: %s", got)
	}

	viper.Set("api-url", "https://api.example.com/api/v1/")
	if got := ResolveAPIURL(); got != "https://api.example.com/api/v1" {
		t.Fatalf("unexpected trimmed api url: %s", got)
	}

	// Bare hosts gain the /api/v1 suffix.
	viper.Set("api-url", "https://containr.example.com")
	if got := ResolveAPIURL(); got != "https://containr.example.com/api/v1" {
		t.Fatalf("unexpected suffixed api url: %s", got)
	}
	viper.Set("api-url", "")
}

func TestResolveTokenProfileAndEnv(t *testing.T) {
	viper.Set("token", "")
	viper.Set("current_profile", "staging")
	viper.Set("profiles.staging.token", "cnp_staging")
	if got := ResolveToken(); got != "cnp_staging" {
		t.Fatalf("expected profile token, got %s", got)
	}
	t.Setenv("CONTAINR_TOKEN", "cnp_env")
	if got := ResolveToken(); got != "cnp_env" {
		t.Fatalf("env should win over profile, got %s", got)
	}
	viper.Set("token", "cnp_flag")
	if got := ResolveToken(); got != "cnp_flag" {
		t.Fatalf("flag should win over env, got %s", got)
	}
}

func TestExitCodeMapping(t *testing.T) {
	if got := exitCodeFor(401); got != ExitAuth {
		t.Fatalf("401 → %d, want %d", got, ExitAuth)
	}
	if got := exitCodeFor(404); got != ExitNotFound {
		t.Fatalf("404 → %d, want %d", got, ExitNotFound)
	}
	if got := exitCodeFor(400); got != ExitValidation {
		t.Fatalf("400 → %d, want %d", got, ExitValidation)
	}
}
