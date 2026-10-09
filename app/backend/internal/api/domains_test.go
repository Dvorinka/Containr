package api

import "testing"

func TestDNSLabel(t *testing.T) {
	cases := map[string]string{
		"my-app":        "my-app",
		"My App_2":      "my-app-2",
		"  web  ":       "web",
		"__weird__name": "weird-name",
		"---":           "",
		"":              "",
	}
	for in, want := range cases {
		if got := dnsLabel(in); got != want {
			t.Errorf("dnsLabel(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestDNSLabelLengthCap(t *testing.T) {
	long := "a" + string(make([]byte, 0)) + "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
	if got := dnsLabel(long); len(got) > 63 {
		t.Fatalf("label over 63 chars: %d", len(got))
	}
}
