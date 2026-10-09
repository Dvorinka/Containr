package api

import "testing"

func TestSemverNewer(t *testing.T) {
	cases := []struct {
		candidate, current string
		want               bool
	}{
		{"v1.2.3", "v1.2.2", true},
		{"1.3.0", "v1.2.9", true},
		{"v2.0.0", "v1.9.9", true},
		{"v1.2.3", "v1.2.3", false},
		{"v1.2.0", "v1.2.3", false},
		{"v1.10.0", "v1.9.9", true}, // numeric, not lexicographic
		{"dev", "v1.0.0", false},
		{"v1.0.0", "main", false},
		{"v1.2.3-rc.1", "v1.2.2", true}, // prerelease suffix tolerated
		{"", "v1.0.0", false},
	}
	for _, tc := range cases {
		if got := semverNewer(tc.candidate, tc.current); got != tc.want {
			t.Errorf("semverNewer(%q, %q) = %v, want %v", tc.candidate, tc.current, got, tc.want)
		}
	}
}
