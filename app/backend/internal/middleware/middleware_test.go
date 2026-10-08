package middleware

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

func TestSecurityHeaders(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(SecurityHeaders())
	router.GET("/test", func(c *gin.Context) {
		c.String(http.StatusOK, "ok")
	})

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if got := rec.Header().Get("X-Content-Type-Options"); got != "nosniff" {
		t.Fatalf("expected X-Content-Type-Options nosniff, got %q", got)
	}
	if got := rec.Header().Get("X-Frame-Options"); got != "DENY" {
		t.Fatalf("expected X-Frame-Options DENY, got %q", got)
	}
	if got := rec.Header().Get("Referrer-Policy"); got != "strict-origin-when-cross-origin" {
		t.Fatalf("expected Referrer-Policy strict-origin-when-cross-origin, got %q", got)
	}
	if got := rec.Header().Get("X-XSS-Protection"); got != "1; mode=block" {
		t.Fatalf("expected X-XSS-Protection header, got %q", got)
	}
	if got := rec.Header().Get("Strict-Transport-Security"); got != "" {
		t.Fatalf("expected no HSTS header for plain HTTP request, got %q", got)
	}
}

func TestSecurityHeadersAddsHSTSWhenForwardedProtoHTTPS(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(SecurityHeaders())
	router.GET("/test", func(c *gin.Context) {
		c.String(http.StatusOK, "ok")
	})

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("X-Forwarded-Proto", "https")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if got := rec.Header().Get("Strict-Transport-Security"); got == "" {
		t.Fatal("expected HSTS header for https-forwarded request")
	}
}

func TestRequestBodyLimitRejectsLargeRequest(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(RequestBodyLimit(8))
	router.POST("/test", func(c *gin.Context) {
		c.String(http.StatusOK, "ok")
	})

	req := httptest.NewRequest(http.MethodPost, "/test", strings.NewReader("0123456789"))
	req.ContentLength = 10
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("expected status %d, got %d", http.StatusRequestEntityTooLarge, rec.Code)
	}
}

func TestAuthRejectsNonUUIDUserIDClaim(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(Auth("secret"))
	router.GET("/test", func(c *gin.Context) {
		c.String(http.StatusOK, "ok")
	})

	token := issueJWT(t, "secret", jwt.MapClaims{
		"user_id": "not-a-uuid",
		"email":   "test@example.com",
		"exp":     time.Now().Add(time.Hour).Unix(),
	})

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected status %d, got %d", http.StatusUnauthorized, rec.Code)
	}
}

func TestAuthStoresStringUserIDForValidClaims(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(Auth("secret"))
	router.GET("/test", func(c *gin.Context) {
		userID, _ := c.Get("user_id")
		c.String(http.StatusOK, fmt.Sprint(userID))
	})

	expectedUserID := uuid.NewString()
	token := issueJWT(t, "secret", jwt.MapClaims{
		"user_id": expectedUserID,
		"email":   "test@example.com",
		"exp":     time.Now().Add(time.Hour).Unix(),
	})

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, rec.Code)
	}
	if got := rec.Body.String(); got != expectedUserID {
		t.Fatalf("expected user_id %q, got %q", expectedUserID, got)
	}
}

func TestAuthRejectsPATWithoutDatabase(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(Auth("secret"))
	router.GET("/test", func(c *gin.Context) {
		c.String(http.StatusOK, "ok")
	})

	// A cnp_-prefixed token takes the PAT path, not JWT parsing — without a
	// db handle it must fail closed with 401.
	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("Authorization", "Bearer cnp_"+strings.Repeat("ab", 24))
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected status %d, got %d", http.StatusUnauthorized, rec.Code)
	}
}

func TestPATScopeAllows(t *testing.T) {
	gin.SetMode(gin.TestMode)

	cases := []struct {
		name   string
		scope  string
		method string
		want   bool
	}{
		{"read allows GET", "read", http.MethodGet, true},
		{"read allows HEAD", "read", http.MethodHead, true},
		{"read allows OPTIONS", "read", http.MethodOptions, true},
		{"read blocks POST", "read", http.MethodPost, false},
		{"read blocks DELETE", "read", http.MethodDelete, false},
		{"write allows POST", "write", http.MethodPost, true},
		{"write allows DELETE", "write", http.MethodDelete, true},
		{"admin allows PATCH", "admin", http.MethodPatch, true},
		{"no scope (session/JWT) unrestricted", "", http.MethodPost, true},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			rec := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(rec)
			c.Request = httptest.NewRequest(tc.method, "/x", nil)
			if tc.scope != "" {
				c.Set("pat_scope", tc.scope)
			}
			if got := patScopeAllows(c); got != tc.want {
				t.Fatalf("patScopeAllows(scope=%q, method=%s) = %v, want %v", tc.scope, tc.method, got, tc.want)
			}
		})
	}
}

func issueJWT(t *testing.T, secret string, claims jwt.MapClaims) string {
	t.Helper()
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString([]byte(secret))
	if err != nil {
		t.Fatalf("failed to sign token: %v", err)
	}
	return signed
}
