package api

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/cookiejar"
	"net/http/httptest"
	"strings"
	"testing"

	"containr/internal/apwhy/config"
	"containr/internal/apwhy/storage"
)

type apiErrorPayload struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

type apiResponsePayload struct {
	OK    bool            `json:"ok"`
	Data  any             `json:"data"`
	Error apiErrorPayload `json:"error"`
}

func newTestServer(t *testing.T) (*httptest.Server, *http.Client) {
	t.Helper()

	cfg := config.Load()
	cfg.SQLitePath = ":memory:"
	cfg.CookieSecure = false

	store, err := storage.Open(cfg)
	if err != nil {
		t.Fatalf("failed to open test storage: %v", err)
	}

	server := NewServer(store, cfg)
	ts := httptest.NewServer(server.Handler())

	t.Cleanup(func() {
		ts.Close()
		_ = store.Close()
	})

	jar, err := cookiejar.New(nil)
	if err != nil {
		t.Fatalf("failed to create cookie jar: %v", err)
	}

	return ts, &http.Client{Jar: jar}
}

func requestJSON(t *testing.T, client *http.Client, method string, url string, body string) (int, apiResponsePayload) {
	t.Helper()

	var bodyReader *bytes.Reader
	if body == "" {
		bodyReader = bytes.NewReader(nil)
	} else {
		bodyReader = bytes.NewReader([]byte(body))
	}

	req, err := http.NewRequest(method, url, bodyReader)
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}
	if body != "" {
		req.Header.Set("Content-Type", "application/json")
	}

	resp, err := client.Do(req)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	defer resp.Body.Close()

	var payload apiResponsePayload
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		t.Fatalf("failed to decode response body: %v", err)
	}

	return resp.StatusCode, payload
}

func bootstrapAndLoginOwner(t *testing.T, client *http.Client, baseURL string) {
	t.Helper()

	status, payload := requestJSON(
		t,
		client,
		http.MethodPost,
		baseURL+"/api/v1/bootstrap/register-owner",
		`{"email":"owner@example.com","password":"owner-pass-123"}`,
	)
	if status != http.StatusCreated || !payload.OK {
		t.Fatalf("owner bootstrap failed: status=%d payload=%+v", status, payload)
	}

	status, payload = requestJSON(
		t,
		client,
		http.MethodPost,
		baseURL+"/api/v1/auth/login",
		`{"email":"owner@example.com","password":"owner-pass-123"}`,
	)
	if status != http.StatusOK || !payload.OK {
		t.Fatalf("owner login failed: status=%d payload=%+v", status, payload)
	}
}

func TestServerBootstrapLoginAndProtectedRoutes(t *testing.T) {
	ts, authClient := newTestServer(t)
	baseURL := ts.URL

	// Bootstrap should be open before any user exists.
	status, payload := requestJSON(t, authClient, http.MethodGet, baseURL+"/api/v1/bootstrap/status", "")
	if status != http.StatusOK || !payload.OK {
		t.Fatalf("unexpected bootstrap status response: status=%d payload=%+v", status, payload)
	}
	bootstrapData, ok := payload.Data.(map[string]any)
	if !ok {
		t.Fatalf("expected object payload for bootstrap status, got %#v", payload.Data)
	}
	if hasUsers, _ := bootstrapData["hasUsers"].(bool); hasUsers {
		t.Fatalf("expected hasUsers=false before owner bootstrap")
	}
	if registrationOpen, _ := bootstrapData["registrationOpen"].(bool); !registrationOpen {
		t.Fatalf("expected registrationOpen=true before owner bootstrap")
	}

	// Protected route without auth should fail.
	anonClient := &http.Client{}
	status, payload = requestJSON(t, anonClient, http.MethodGet, baseURL+"/api/v1/auth/me", "")
	if status != http.StatusUnauthorized || payload.OK {
		t.Fatalf("expected unauthorized /auth/me response, got status=%d payload=%+v", status, payload)
	}

	// Register owner and login.
	bootstrapAndLoginOwner(t, authClient, baseURL)

	// Bootstrap should close once owner exists.
	status, payload = requestJSON(t, authClient, http.MethodGet, baseURL+"/api/v1/bootstrap/status", "")
	if status != http.StatusOK || !payload.OK {
		t.Fatalf("unexpected bootstrap status after owner creation: status=%d payload=%+v", status, payload)
	}
	bootstrapData, ok = payload.Data.(map[string]any)
	if !ok {
		t.Fatalf("expected object payload for bootstrap status, got %#v", payload.Data)
	}
	if hasUsers, _ := bootstrapData["hasUsers"].(bool); !hasUsers {
		t.Fatalf("expected hasUsers=true after owner bootstrap")
	}
	if registrationOpen, _ := bootstrapData["registrationOpen"].(bool); registrationOpen {
		t.Fatalf("expected registrationOpen=false after owner bootstrap")
	}

	// Owner session cookie should authorize /auth/me.
	status, payload = requestJSON(t, authClient, http.MethodGet, baseURL+"/api/v1/auth/me", "")
	if status != http.StatusOK || !payload.OK {
		t.Fatalf("expected successful /auth/me response, got status=%d payload=%+v", status, payload)
	}
	meData, ok := payload.Data.(map[string]any)
	if !ok {
		t.Fatalf("expected object payload for auth/me, got %#v", payload.Data)
	}
	if email, _ := meData["email"].(string); email != "owner@example.com" {
		t.Fatalf("unexpected /auth/me email: %q", email)
	}

	// Logout should revoke auth session.
	status, payload = requestJSON(t, authClient, http.MethodPost, baseURL+"/api/v1/auth/logout", "")
	if status != http.StatusOK || !payload.OK {
		t.Fatalf("expected successful logout response, got status=%d payload=%+v", status, payload)
	}
	status, payload = requestJSON(t, authClient, http.MethodGet, baseURL+"/api/v1/auth/me", "")
	if status != http.StatusUnauthorized || payload.OK {
		t.Fatalf("expected unauthorized /auth/me after logout, got status=%d payload=%+v", status, payload)
	}
}

func TestServerServicesCreateValidationRules(t *testing.T) {
	ts, client := newTestServer(t)
	baseURL := ts.URL

	bootstrapAndLoginOwner(t, client, baseURL)

	// Route prefix under /api must be rejected.
	status, payload := requestJSON(
		t,
		client,
		http.MethodPost,
		baseURL+"/api/v1/services",
		`{"name":"Bad Service","upstreamUrl":"http://example.com","routePrefix":"/api/conflict"}`,
	)
	if status != http.StatusBadRequest || payload.OK {
		t.Fatalf("expected route conflict validation failure, got status=%d payload=%+v", status, payload)
	}
	if payload.Error.Code != "ROUTE_CONFLICT" {
		t.Fatalf("expected ROUTE_CONFLICT error code, got %q", payload.Error.Code)
	}

	// Valid service should be created successfully.
	status, payload = requestJSON(
		t,
		client,
		http.MethodPost,
		baseURL+"/api/v1/services",
		`{"name":"Web Frontend","upstreamUrl":"http://example.com","routePrefix":"/web"}`,
	)
	if status != http.StatusCreated || !payload.OK {
		t.Fatalf("expected successful service creation, got status=%d payload=%+v", status, payload)
	}
	createData, ok := payload.Data.(map[string]any)
	if !ok {
		t.Fatalf("expected object payload for service creation, got %#v", payload.Data)
	}
	if _, ok := createData["id"].(string); !ok {
		t.Fatalf("expected created service id in response")
	}
	if slug, _ := createData["slug"].(string); !strings.Contains(slug, "web-frontend") {
		t.Fatalf("expected normalized service slug, got %q", slug)
	}

	// List should contain the newly created service.
	status, payload = requestJSON(t, client, http.MethodGet, baseURL+"/api/v1/services", "")
	if status != http.StatusOK || !payload.OK {
		t.Fatalf("expected successful services list response, got status=%d payload=%+v", status, payload)
	}
	rows, ok := payload.Data.([]any)
	if !ok || len(rows) == 0 {
		t.Fatalf("expected non-empty services list, got %#v", payload.Data)
	}
}

func TestServerProxyWithAPIKey(t *testing.T) {
	ts, authClient := newTestServer(t)
	baseURL := ts.URL

	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("x-api-key") != "" {
			w.WriteHeader(http.StatusBadRequest)
			_, _ = io.WriteString(w, "unexpected-api-key-header")
			return
		}
		_, _ = io.WriteString(w, "ok:"+r.URL.Path+"?"+r.URL.RawQuery)
	}))
	t.Cleanup(upstream.Close)

	bootstrapAndLoginOwner(t, authClient, baseURL)

	// Create service exposed at /web/* and proxied to the upstream test server.
	status, payload := requestJSON(
		t,
		authClient,
		http.MethodPost,
		baseURL+"/api/v1/services",
		`{"name":"Web Proxy","upstreamUrl":"`+upstream.URL+`","routePrefix":"/web"}`,
	)
	if status != http.StatusCreated || !payload.OK {
		t.Fatalf("expected successful service creation, got status=%d payload=%+v", status, payload)
	}

	// Mint API key for gateway access.
	status, payload = requestJSON(
		t,
		authClient,
		http.MethodPost,
		baseURL+"/api/v1/keys",
		`{"name":"integration-key","plan":"free"}`,
	)
	if status != http.StatusCreated || !payload.OK {
		t.Fatalf("expected successful key creation, got status=%d payload=%+v", status, payload)
	}
	keyData, ok := payload.Data.(map[string]any)
	if !ok {
		t.Fatalf("expected object payload for key creation, got %#v", payload.Data)
	}
	rawKey, _ := keyData["key"].(string)
	if strings.TrimSpace(rawKey) == "" {
		t.Fatalf("expected non-empty raw API key")
	}

	// No API key should be rejected.
	anonClient := &http.Client{}
	status, payload = requestJSON(t, anonClient, http.MethodGet, baseURL+"/web/ping?x=1", "")
	if status != http.StatusUnauthorized || payload.OK {
		t.Fatalf("expected unauthorized proxy request without key, got status=%d payload=%+v", status, payload)
	}
	if payload.Error.Code != "API_KEY_MISSING" {
		t.Fatalf("expected API_KEY_MISSING error code, got %q", payload.Error.Code)
	}

	// Valid API key should proxy request and strip the key before forwarding.
	req, err := http.NewRequest(http.MethodGet, baseURL+"/web/ping?x=1", nil)
	if err != nil {
		t.Fatalf("failed to create proxy request: %v", err)
	}
	req.Header.Set("x-api-key", rawKey)

	resp, err := anonClient.Do(req)
	if err != nil {
		t.Fatalf("proxy request failed: %v", err)
	}
	defer resp.Body.Close()

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		t.Fatalf("failed to read proxy response body: %v", err)
	}
	body := string(bodyBytes)

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected proxy status 200, got %d body=%q", resp.StatusCode, body)
	}
	if body != "ok:/ping?x=1" {
		t.Fatalf("unexpected proxy body: %q", body)
	}
}
