package api

import (
	"testing"
	"time"
)

func TestIsValidAgentAuthToken(t *testing.T) {
	t.Setenv("CONTAINR_AGENT_AUTH_TOKEN", "super-secret")
	t.Setenv("CONTAINR_AGENT_AUTH_TOKENS", "")

	if !isValidAgentAuthToken("super-secret") {
		t.Fatalf("expected token to validate")
	}
	if isValidAgentAuthToken("wrong-token") {
		t.Fatalf("expected invalid token to be rejected")
	}
}

func TestConfiguredAgentAuthTokensCSV(t *testing.T) {
	t.Setenv("CONTAINR_AGENT_AUTH_TOKEN", "")
	t.Setenv("CONTAINR_AGENT_AUTH_TOKENS", "token-a, token-b ,token-c")

	tokens := configuredAgentAuthTokens()
	if len(tokens) != 3 {
		t.Fatalf("expected 3 tokens, got %d (%v)", len(tokens), tokens)
	}
	if tokens[0] != "token-a" || tokens[1] != "token-b" || tokens[2] != "token-c" {
		t.Fatalf("unexpected token list: %v", tokens)
	}
}

func TestBuildMetricPointComputesPercentages(t *testing.T) {
	point := buildMetricPoint(
		time.Now(),
		NodeResources{
			CPU: CPUResources{
				Cores: 4,
				Usage: 32.5,
			},
			Memory: MemoryResources{
				Total:     1000,
				Used:      250,
				Available: 750,
			},
		},
		SystemLoad{Load1M: 1.1, Load5M: 0.9, Load15M: 0.5},
		3,
	)

	mem := point["memory"].(map[string]interface{})
	if mem["usage_percent"].(float64) != 25 {
		t.Fatalf("expected memory usage percent 25, got %v", mem["usage_percent"])
	}
	cpu := point["cpu"].(map[string]interface{})
	if cpu["usage_percent"].(float64) != 32.5 {
		t.Fatalf("expected cpu usage percent 32.5, got %v", cpu["usage_percent"])
	}
}
