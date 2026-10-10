package api

import "testing"

func TestSplitImageReference(t *testing.T) {
	cases := []struct {
		name      string
		image     string
		fallback  string
		wantImage string
		wantTag   string
	}{
		{"empty uses fallback tag", "", "latest", "", "latest"},
		{"bare image", "nginx", "latest", "nginx", "latest"},
		{"tagged image", "nginx:1.27", "latest", "nginx", "1.27"},
		{"registry with port untagged", "registry.local:5000/app", "latest", "registry.local:5000/app", "latest"},
		{"registry with port tagged", "registry.local:5000/app:v2", "latest", "registry.local:5000/app", "v2"},
		{"digest stays whole", "nginx@sha256:abc123", "latest", "nginx@sha256:abc123", "latest"},
		{"tag and digest", "nginx:1.27@sha256:abc", "latest", "nginx:1.27@sha256:abc", "latest"},
		{"namespaced tagged", "ghcr.io/owner/repo:dev", "latest", "ghcr.io/owner/repo", "dev"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			img, tag := splitImageReference(tc.image, tc.fallback)
			if img != tc.wantImage || tag != tc.wantTag {
				t.Fatalf("splitImageReference(%q, %q) = (%q, %q), want (%q, %q)",
					tc.image, tc.fallback, img, tag, tc.wantImage, tc.wantTag)
			}
		})
	}
}

func TestMapEngineStatusToDBStatus(t *testing.T) {
	cases := map[string]string{
		"running":   "deployed",
		"building":  "building",
		"failed":    "failed",
		"cancelled": "cancelled",
		"queued":    "queued",
	}
	for in, want := range cases {
		if got := mapEngineStatusToDBStatus(in); got != want {
			t.Fatalf("mapEngineStatusToDBStatus(%q) = %q, want %q", in, got, want)
		}
	}
}
