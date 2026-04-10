package api

import "testing"

func TestParsePositiveInt(t *testing.T) {
	cases := []struct {
		name     string
		input    string
		fallback int
		want     int
	}{
		{name: "valid number", input: "25", fallback: 10, want: 25},
		{name: "zero falls back", input: "0", fallback: 10, want: 10},
		{name: "negative falls back", input: "-5", fallback: 10, want: 10},
		{name: "invalid falls back", input: "abc", fallback: 10, want: 10},
		{name: "trim whitespace", input: "  3 ", fallback: 10, want: 3},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := parsePositiveInt(tc.input, tc.fallback)
			if got != tc.want {
				t.Fatalf("parsePositiveInt(%q, %d) = %d, want %d", tc.input, tc.fallback, got, tc.want)
			}
		})
	}
}

func TestParseUUIDOrNil(t *testing.T) {
	if got := parseUUIDOrNil(""); got != nil {
		t.Fatalf("expected nil for empty input, got %#v", got)
	}
	if got := parseUUIDOrNil("invalid"); got != nil {
		t.Fatalf("expected nil for invalid uuid, got %#v", got)
	}

	validID := "7c9e6679-7425-40de-944b-e07fc1f90ae7"
	got := parseUUIDOrNil(validID)
	gotStr, ok := got.(string)
	if !ok {
		t.Fatalf("expected string for valid uuid, got %#v", got)
	}
	if gotStr != validID {
		t.Fatalf("expected %q, got %q", validID, gotStr)
	}
}
