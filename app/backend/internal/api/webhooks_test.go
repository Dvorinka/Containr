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
