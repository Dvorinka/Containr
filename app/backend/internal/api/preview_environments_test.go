package api

import (
	"strings"
	"testing"
)

func TestPreviewServiceName(t *testing.T) {
	cases := []struct {
		svc, branch string
		want        string
	}{
		{"whoami-web", "feature-x", "whoami-web-feature-x-preview"},
		{"My App", "feat/JARV-123_foo", "my-app-feat-jarv-123-foo-preview"},
		{"svc", "", "svc-preview"},
	}
	for _, tc := range cases {
		got := previewServiceName(tc.svc, tc.branch)
		if got != tc.want {
			t.Fatalf("previewServiceName(%q,%q) = %q, want %q", tc.svc, tc.branch, got, tc.want)
		}
		if len(got) > 63 {
			t.Fatalf("name exceeds DNS label limit: %q", got)
		}
	}
	// A name that sanitizes to nothing must still be usable.
	if got := previewServiceName("!!!", "%%%"); !strings.HasPrefix(got, "preview-") {
		t.Fatalf("expected fallback name, got %q", got)
	}
}
