package api

import (
	"encoding/json"
	"testing"
)

func TestWebhookEventMatches(t *testing.T) {
	subs := func(list ...string) json.RawMessage {
		raw, _ := json.Marshal(list)
		return raw
	}
	cases := []struct {
		events json.RawMessage
		event  string
		want   bool
	}{
		{subs("service.*"), "service.deploy", true},
		{subs("service.*"), "database.create", false},
		{subs("*"), "service.deploy", true},
		{subs("deployment.fail", "service.*"), "deployment.fail", true},
		{subs("deployment.fail"), "deployment.success", false},
		{subs(" ping "), "ping", true},
		{subs(), "service.deploy", false},
		{json.RawMessage(`"not-a-list"`), "service.deploy", false},
		{json.RawMessage(`invalid`), "service.deploy", false},
	}
	for i, tc := range cases {
		if got := webhookEventMatches(tc.events, tc.event); got != tc.want {
			t.Errorf("case %d: matches(%s, %q) = %v, want %v", i, tc.events, tc.event, got, tc.want)
		}
	}
}

func TestValidWebhookURL(t *testing.T) {
	cases := []struct {
		name    string
		url     string
		wantErr bool
	}{
		{"https", "https://hooks.example.com/wh/abc", false},
		{"http", "http://internal.lan:8080/notify", false},
		{"whitespace trimmed", "  https://example.com/hook  ", false},
		{"with query", "https://example.com/hook?token=x", false},
		{"ftp rejected", "ftp://files.example.com/x", true},
		{"no scheme", "example.com/hook", true},
		{"bare scheme", "https://", true},
		{"empty", "", true},
		{"javascript rejected", "javascript:alert(1)", true},
		{"host empty", "http:///path-only", true},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			err := validWebhookURL(tc.url)
			if tc.wantErr && err == nil {
				t.Errorf("validWebhookURL(%q) = nil, want error", tc.url)
			}
			if !tc.wantErr && err != nil {
				t.Errorf("validWebhookURL(%q) = %v, want nil", tc.url, err)
			}
		})
	}
}
