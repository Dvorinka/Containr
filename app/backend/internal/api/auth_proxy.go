package api

import (
	"containr/internal/database"
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"

	"containr/internal/config"

	"github.com/gin-gonic/gin"
)

func setupAuthProxyRoutes(router *gin.Engine, cfg *config.Config, db *database.DB) {
	targetURL, err := parseAuthProxyTarget(cfg.BetterAuthProxyURL)
	if err != nil {
		log.Printf("Warning: auth proxy disabled: %v", err)
		return
	}

	proxy := httputil.NewSingleHostReverseProxy(targetURL)
	proxy.ErrorHandler = func(writer http.ResponseWriter, request *http.Request, proxyErr error) {
		log.Printf("Auth proxy error: %v", proxyErr)
		writer.Header().Set("Content-Type", "application/json")
		writer.WriteHeader(http.StatusBadGateway)
		_, _ = writer.Write([]byte(`{"error":"Auth service unavailable"}`))
	}

	handler := func(c *gin.Context) {
		if shouldBlockPublicBetterAuthSignup(c, cfg, db) {
			c.JSON(http.StatusForbidden, gin.H{"error": "Public registration is disabled after bootstrap"})
			c.Abort()
			return
		}

		proxy.ServeHTTP(c.Writer, c.Request)
		c.Abort()
	}

	router.Any("/api/auth", handler)
	router.Any("/api/auth/*proxyPath", handler)
}

func shouldBlockPublicBetterAuthSignup(c *gin.Context, cfg *config.Config, db *database.DB) bool {
	if db == nil || db.DB == nil {
		return false
	}

	if !strings.EqualFold(c.Request.Method, http.MethodPost) {
		return false
	}

	if !strings.HasSuffix(c.Request.URL.Path, "/sign-up/email") {
		return false
	}

	internalToken := strings.TrimSpace(cfg.BetterAuthInternalToken)
	if internalToken != "" && c.GetHeader("X-Containr-Auth-Internal") == internalToken {
		return false
	}

	count, err := countLocalUsers(db)
	if err != nil {
		log.Printf("Failed to inspect signup bootstrap state: %v", err)
		return true
	}

	// Registration is closed once the first account exists unless the owner
	// reopens it in Settings (signup_enabled).
	return count > 0 && !signupEnabled(db)
}

func parseAuthProxyTarget(rawTarget string) (*url.URL, error) {
	trimmed := strings.TrimSpace(rawTarget)
	if trimmed == "" {
		trimmed = "http://127.0.0.1:3001"
	}

	targetURL, err := url.Parse(trimmed)
	if err != nil {
		return nil, err
	}

	if targetURL.Scheme == "" || targetURL.Host == "" {
		return nil, url.InvalidHostError(trimmed)
	}

	return targetURL, nil
}
