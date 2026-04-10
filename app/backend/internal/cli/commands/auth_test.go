package commands

import (
	"testing"

	"github.com/spf13/viper"
)

func TestBuildAPIURLDefaultsAndTrimming(t *testing.T) {
	viper.Set("api-url", "")
	got := buildAPIURL("/user/profile")
	if got != "http://localhost:8080/api/v1/user/profile" {
		t.Fatalf("unexpected default api url: %s", got)
	}

	viper.Set("api-url", "https://api.example.com/api/v1/")
	got = buildAPIURL("user/profile")
	if got != "https://api.example.com/api/v1/user/profile" {
		t.Fatalf("unexpected trimmed api url: %s", got)
	}
}
