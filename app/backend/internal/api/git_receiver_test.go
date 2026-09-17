package api

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"net/http/httptest"
	"testing"
)

func signBody(t *testing.T, secret string, body []byte) string {
	t.Helper()
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(body)
	return hex.EncodeToString(mac.Sum(nil))
}

func TestVerifyGitWebhookSignature(t *testing.T) {
	body := []byte(`{"ref":"refs/heads/main"}`)
	secret := "test-secret"
	valid := signBody(t, secret, body)

	cases := []struct {
		name     string
		provider string
		headers  map[string]string
		want     bool
	}{
		{
			name:     "github sha256 prefix",
			provider: "github",
			headers:  map[string]string{"X-Hub-Signature-256": "sha256=" + valid},
			want:     true,
		},
		{
			name:     "gitea signature",
			provider: "gitea",
			headers:  map[string]string{"X-Gitea-Signature": valid},
			want:     true,
		},
		{
			name:     "gitlab token",
			provider: "gitlab",
			headers:  map[string]string{"X-Gitlab-Token": secret},
			want:     true,
		},
		{
			name:     "gitlab rejects wrong token",
			provider: "gitlab",
			headers:  map[string]string{"X-Gitlab-Token": "wrong"},
			want:     false,
		},
		{
			name:     "github rejects wrong signature",
			provider: "github",
			headers:  map[string]string{"X-Hub-Signature-256": "sha256=" + signBody(t, "other", body)},
			want:     false,
		},
		{
			name:     "missing signature",
			provider: "github",
			headers:  map[string]string{},
			want:     false,
		},
		{
			name:     "malformed hex",
			provider: "github",
			headers:  map[string]string{"X-Hub-Signature-256": "sha256=zzz"},
			want:     false,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest("POST", "/api/git/webhooks/x", nil)
			for k, v := range tc.headers {
				req.Header.Set(k, v)
			}
			if got := verifyGitWebhookSignature(tc.provider, secret, req, body); got != tc.want {
				t.Fatalf("verifyGitWebhookSignature = %v, want %v", got, tc.want)
			}
		})
	}
}
