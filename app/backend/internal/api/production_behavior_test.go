package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestGitProviderIntegrationEndpointsRequireAuthentication(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	v1 := router.Group("/api/v1")
	v1.GET("/git/providers/:providerId/repositories", handleGetGitRepositories)
	v1.POST("/git/repositories/connect", handleConnectGitRepository)
	v1.POST("/git/webhooks", handleCreateWebhook)

	cases := []struct {
		name   string
		method string
		path   string
	}{
		{name: "list provider repositories", method: http.MethodGet, path: "/api/v1/git/providers/any/repositories"},
		{name: "connect repository", method: http.MethodPost, path: "/api/v1/git/repositories/connect"},
		{name: "create webhook", method: http.MethodPost, path: "/api/v1/git/webhooks"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest(tc.method, tc.path, nil)
			rec := httptest.NewRecorder()
			router.ServeHTTP(rec, req)

			if rec.Code != http.StatusUnauthorized {
				t.Fatalf("expected status %d, got %d", http.StatusUnauthorized, rec.Code)
			}

			var body map[string]any
			if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
				t.Fatalf("failed to decode response: %v", err)
			}
			if body["error"] != "User not authenticated" {
				t.Fatalf("expected auth error, got %v", body["error"])
			}
		})
	}
}

func TestRespondDependencyUnavailable(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.GET("/healthz", func(c *gin.Context) {
		respondDependencyUnavailable(c, "docker", "not configured")
	})

	req := httptest.NewRequest(http.MethodGet, "/healthz", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected status %d, got %d", http.StatusServiceUnavailable, rec.Code)
	}

	var body map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if body["code"] != "DEPENDENCY_UNAVAILABLE" {
		t.Fatalf("expected code DEPENDENCY_UNAVAILABLE, got %v", body["code"])
	}
}

func TestRequireAuthenticatedUserIDRejectsMissingUserContext(t *testing.T) {
	gin.SetMode(gin.TestMode)
	rec := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(rec)
	c.Request = httptest.NewRequest(http.MethodGet, "/secure", nil)

	userID, ok := requireAuthenticatedUserID(c)
	if ok {
		t.Fatalf("expected helper to reject missing user context, got user ID %q", userID)
	}
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected status %d, got %d", http.StatusUnauthorized, rec.Code)
	}
}
