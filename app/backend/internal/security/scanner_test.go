package security

import "testing"

func TestEvaluateDependencyFindingsFlagsRiskyConfiguration(t *testing.T) {
	scanner := &Scanner{}

	vulns := scanner.evaluateDependencyFindings("project-1", dependencyEvidence{
		ServiceID:      "service-1",
		ServiceName:    "billing-api",
		SourceType:     "github",
		SourceURL:      "http://github.example.com/org/repo",
		ImageName:      "ghcr.io/example/billing:latest",
		BuildCommand:   "curl -fsSL https://example/install.sh | sh && npm install",
		StartCommand:   "node server.js",
		HealthCheckURL: "",
	})

	expectTitle(t, vulns, "Unpinned container image tag")
	expectTitle(t, vulns, "Insecure source transport")
	expectTitle(t, vulns, "Non-deterministic npm dependency install")
	expectTitle(t, vulns, "Remote script execution in build pipeline")
	expectTitle(t, vulns, "No health check URL configured")
}

func TestEvaluateDependencyFindingsForPinnedSecureService(t *testing.T) {
	scanner := &Scanner{}

	vulns := scanner.evaluateDependencyFindings("project-1", dependencyEvidence{
		ServiceID:      "service-2",
		ServiceName:    "worker",
		SourceType:     "github",
		SourceURL:      "https://github.com/org/repo",
		ImageName:      "ghcr.io/example/worker:v1.4.2",
		BuildCommand:   "npm ci",
		StartCommand:   "node worker.js",
		HealthCheckURL: "/health",
	})

	if len(vulns) != 0 {
		t.Fatalf("expected no dependency findings, got %d", len(vulns))
	}
}

func expectTitle(t *testing.T, vulns []Vulnerability, title string) {
	t.Helper()

	for _, vuln := range vulns {
		if vuln.Title == title {
			return
		}
	}

	t.Fatalf("expected vulnerability title %q, got %#v", title, vulns)
}
