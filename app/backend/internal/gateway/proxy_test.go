package gateway

import "testing"

func TestBuildTargetURL(t *testing.T) {
	cases := []struct {
		name                                       string
		upstream, prefix, path, query, want        string
	}{
		{
			name:     "strips route prefix",
			upstream: "https://api.internal:8080",
			prefix:   "/g/weather",
			path:     "/g/weather/v1/current",
			query:    "city=oslo",
			want:     "https://api.internal:8080/v1/current?city=oslo",
		},
		{
			name:     "prefix root maps to upstream root",
			upstream: "https://api.internal",
			prefix:   "/g/weather",
			path:     "/g/weather",
			want:     "https://api.internal/",
		},
		{
			name:     "upstream base path is preserved",
			upstream: "https://api.internal/base",
			prefix:   "/g/x",
			path:     "/g/x/ping",
			want:     "https://api.internal/base/ping",
		},
		{
			name:     "root prefix leaves path untouched",
			upstream: "https://api.internal",
			prefix:   "/",
			path:     "/g/raw",
			want:     "https://api.internal/g/raw",
		},
		{
			name:     "path without prefix is still proxied",
			upstream: "https://api.internal",
			prefix:   "/g/x",
			path:     "/other",
			want:     "https://api.internal/other",
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got, err := BuildTargetURL(tc.upstream, tc.prefix, tc.path, tc.query)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if got != tc.want {
				t.Fatalf("got %q, want %q", got, tc.want)
			}
		})
	}
}

func TestBuildTargetURL_InvalidUpstream(t *testing.T) {
	if _, err := BuildTargetURL("://bad", "/g/x", "/g/x/y", ""); err == nil {
		t.Fatal("expected error for unparsable upstream")
	}
}
