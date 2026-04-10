package api

import "testing"

func TestNormalizeRepositoryFullName(t *testing.T) {
	cases := []struct {
		name         string
		input        string
		wantName     string
		wantFullName string
		wantErr      bool
	}{
		{
			name:         "owner slash repo",
			input:        "acme/platform",
			wantName:     "platform",
			wantFullName: "acme/platform",
		},
		{
			name:         "https clone URL",
			input:        "https://github.com/acme/platform.git",
			wantName:     "platform",
			wantFullName: "acme/platform",
		},
		{
			name:         "ssh URL",
			input:        "git@github.com:acme/platform.git",
			wantName:     "platform",
			wantFullName: "acme/platform",
		},
		{
			name:    "invalid format",
			input:   "acme",
			wantErr: true,
		},
		{
			name:    "empty",
			input:   "",
			wantErr: true,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			gotName, gotFullName, err := normalizeRepositoryFullName(tc.input)
			if tc.wantErr {
				if err == nil {
					t.Fatalf("expected error, got nil")
				}
				return
			}
			if err != nil {
				t.Fatalf("expected no error, got %v", err)
			}
			if gotName != tc.wantName {
				t.Fatalf("name mismatch: got %q want %q", gotName, tc.wantName)
			}
			if gotFullName != tc.wantFullName {
				t.Fatalf("full name mismatch: got %q want %q", gotFullName, tc.wantFullName)
			}
		})
	}
}

func TestDeriveCloneURL(t *testing.T) {
	fullName := "acme/platform"
	cases := []struct {
		provider string
		want     string
	}{
		{provider: "github", want: "https://github.com/acme/platform.git"},
		{provider: "gitlab", want: "https://gitlab.com/acme/platform.git"},
		{provider: "bitbucket", want: "https://bitbucket.org/acme/platform.git"},
		{provider: "unknown", want: "acme/platform"},
	}

	for _, tc := range cases {
		t.Run(tc.provider, func(t *testing.T) {
			got := deriveCloneURL(tc.provider, fullName)
			if got != tc.want {
				t.Fatalf("deriveCloneURL(%q) = %q, want %q", tc.provider, got, tc.want)
			}
		})
	}
}
