package api

import (
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"

	"containr/internal/config"

	"github.com/gin-gonic/gin"
)

func setupAuthProxyRoutes(router *gin.Engine, cfg *config.Config) {
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
		proxy.ServeHTTP(c.Writer, c.Request)
		c.Abort()
	}

	router.Any("/api/auth", handler)
	router.Any("/api/auth/*proxyPath", handler)
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
