package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestIdempotencyPassThroughWithoutKey(t *testing.T) {
	gin.SetMode(gin.TestMode)
	called := 0
	router := gin.New()
	router.Use(Idempotency())
	router.POST("/x", func(c *gin.Context) { called++; c.JSON(200, gin.H{"ok": true}) })

	req := httptest.NewRequest(http.MethodPost, "/x", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if called != 1 || rec.Code != 200 {
		t.Fatalf("expected pass-through, called=%d code=%d", called, rec.Code)
	}
}

func TestIdempotencyPassThroughWithoutRedis(t *testing.T) {
	gin.SetMode(gin.TestMode)
	called := 0
	router := gin.New()
	router.Use(Idempotency())
	router.POST("/x", func(c *gin.Context) { called++; c.JSON(200, gin.H{"ok": true}) })

	// Key present but no redis in context — must not block the request.
	req := httptest.NewRequest(http.MethodPost, "/x", nil)
	req.Header.Set("Idempotency-Key", "abc-123")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if called != 1 || rec.Code != 200 {
		t.Fatalf("expected pass-through without redis, called=%d code=%d", called, rec.Code)
	}
}

func TestIdempotencySkipsNonPOST(t *testing.T) {
	gin.SetMode(gin.TestMode)
	called := 0
	router := gin.New()
	router.Use(Idempotency())
	router.GET("/x", func(c *gin.Context) { called++; c.String(200, "ok") })

	req := httptest.NewRequest(http.MethodGet, "/x", nil)
	req.Header.Set("Idempotency-Key", "abc")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if called != 1 {
		t.Fatalf("GET should bypass idempotency, called=%d", called)
	}
}
