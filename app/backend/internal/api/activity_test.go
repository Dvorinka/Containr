package api

import "testing"

func TestClassifyAuditEvent(t *testing.T) {
	cases := []struct {
		resource, action          string
		wantSev, wantCat, wantLab string
	}{
		{"service", "service.create", "success", "service", "Service created"},
		{"service", "service.delete", "warning", "service", "Service deleted"},
		{"deployment", "deploy", "success", "deployment", "Deployment deployed"},
		{"project", "project.create", "success", "project", "Project created"},
		{"user_invite", "user_invite.create", "success", "system", "User invite created"},
		{"user_token", "user_token.revoke", "warning", "security", "User token revoked"},
		{"service", "deploy.fail", "error", "service", "Service fail"},
		{"user", "impersonate", "warning", "user", "User impersonated"},
		{"webhook", "update", "info", "webhook", "Webhook updated"},
	}
	for _, tc := range cases {
		sev, cat, lab := classifyAuditEvent(tc.resource, tc.action)
		if sev != tc.wantSev {
			t.Errorf("%s/%s: severity = %q, want %q", tc.resource, tc.action, sev, tc.wantSev)
		}
		if cat != tc.wantCat {
			t.Errorf("%s/%s: category = %q, want %q", tc.resource, tc.action, cat, tc.wantCat)
		}
		if lab != tc.wantLab {
			t.Errorf("%s/%s: label = %q, want %q", tc.resource, tc.action, lab, tc.wantLab)
		}
	}
}
