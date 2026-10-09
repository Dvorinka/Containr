package api

import (
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
)

func TestGatewayRateAllow(t *testing.T) {
	now := time.Date(2026, 10, 15, 12, 0, 30, 0, time.UTC)

	for i := 0; i < 3; i++ {
		if !gatewayRateAllow("test:a", 3, now) {
			t.Fatalf("call %d within limit rejected", i+1)
		}
	}
	if gatewayRateAllow("test:a", 3, now) {
		t.Fatal("call beyond limit allowed")
	}
	if !gatewayRateAllow("test:a", 3, now.Add(time.Minute)) {
		t.Fatal("new minute window still rejected")
	}
	if !gatewayRateAllow("test:unlimited", 0, now) {
		t.Fatal("non-positive limit should disable the check")
	}
}

func TestExtractGatewayKey(t *testing.T) {
	mkctx := func(headers map[string]string) *gin.Context {
		c, _ := gin.CreateTestContext(httptest.NewRecorder())
		c.Request = httptest.NewRequest("GET", "/g/x", nil)
		for k, v := range headers {
			c.Request.Header.Set(k, v)
		}
		return c
	}

	if got := extractGatewayKey(mkctx(map[string]string{"X-API-Key": "ap_abc"})); got != "ap_abc" {
		t.Fatalf("X-API-Key not extracted: %q", got)
	}
	if got := extractGatewayKey(mkctx(map[string]string{"Authorization": "Bearer ap_def"})); got != "ap_def" {
		t.Fatalf("Bearer not extracted: %q", got)
	}
	// X-API-Key wins when both are present.
	if got := extractGatewayKey(mkctx(map[string]string{
		"X-API-Key":     "ap_first",
		"Authorization": "Bearer ap_second",
	})); got != "ap_first" {
		t.Fatalf("X-API-Key should take precedence: %q", got)
	}
	if got := extractGatewayKey(mkctx(map[string]string{})); got != "" {
		t.Fatalf("expected empty key, got %q", got)
	}
}

func TestKeyAllowsService(t *testing.T) {
	svcID := "11111111-2222-3333-4444-555555555555"
	other := "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"

	cases := []struct {
		name    string
		allowed string
		want    bool
	}{
		{"empty list permits all", "[]", true},
		{"blank permits all", "", true},
		{"invalid json permits all", "not-json", true},
		{"listed service allowed", `["` + svcID + `"]`, true},
		{"unlisted service denied", `["` + other + `"]`, false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			k := &gatewayKey{AllowedServiceIDs: tc.allowed}
			if got := keyAllowsService(k, svcID); got != tc.want {
				t.Fatalf("keyAllowsService(%q) = %v, want %v", tc.allowed, got, tc.want)
			}
		})
	}
}
