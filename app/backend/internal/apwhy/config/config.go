package config

import (
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	Port                  int
	SQLitePath            string
	DashboardUIBasePath   string
	APIKeyHeader          string
	ServiceTokenHeader    string
	AllowRootRoutePrefix  bool
	DefaultServiceTimeout time.Duration
	CookieSecure          bool
	CookieDomain          string
	AccessTokenTTL        time.Duration
	RefreshTokenTTL       time.Duration
	SessionAccessCookie   string
	SessionRefreshCookie  string
	FreeRPM               int
	ProRPM                int
	BusinessRPM           int
	FreeMonthlyQuota      int
	ProMonthlyQuota       int
	BusinessMonthlyQuota  int
	UmamiBaseURL          string
	UmamiAPIKey           string
	UmamiWebsiteID        string
	TrustedProxyCIDR      string
}

func getenv(key, fallback string) string {
	if value := strings.TrimSpace(os.Getenv(key)); value != "" {
		return value
	}
	return fallback
}

func getenvInt(key string, fallback int) int {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	parsed, err := strconv.Atoi(value)
	if err != nil {
		return fallback
	}
	return parsed
}

func getenvBool(key string, fallback bool) bool {
	value := strings.TrimSpace(strings.ToLower(os.Getenv(key)))
	if value == "" {
		return fallback
	}
	return value == "1" || value == "true" || value == "yes"
}

func normalizePathPrefix(value, fallback string) string {
	v := strings.TrimSpace(value)
	if v == "" {
		return fallback
	}
	if !strings.HasPrefix(v, "/") {
		v = "/" + v
	}
	if len(v) > 1 && strings.HasSuffix(v, "/") {
		v = strings.TrimSuffix(v, "/")
	}
	return v
}

func normalizeSQLitePath(value string) string {
	v := strings.TrimSpace(value)
	if v == "" {
		v = "./data/apwhy.sqlite"
	}
	if v == ":memory:" {
		return v
	}
	if strings.HasPrefix(v, "file:") {
		return v
	}
	if filepath.IsAbs(v) {
		return "file:" + v
	}
	abs, err := filepath.Abs(v)
	if err != nil {
		return "file:" + v
	}
	return "file:" + abs
}

func Load() Config {
	return Config{
		Port:                 getenvInt("APWHY_PORT", getenvInt("PORT", 3001)),
		SQLitePath:           normalizeSQLitePath(getenv("SQLITE_DB_PATH", getenv("DATABASE_URL", "./data/apwhy.sqlite"))),
		DashboardUIBasePath:  normalizePathPrefix(getenv("DASHBOARD_UI_BASE_PATH", "/"), "/"),
		APIKeyHeader:         strings.ToLower(getenv("API_KEY_HEADER", "x-api-key")),
		ServiceTokenHeader:   strings.ToLower(getenv("SERVICE_TOKEN_HEADER", "x-apwhy-service-token")),
		AllowRootRoutePrefix: getenvBool("ALLOW_ROOT_ROUTE_PREFIX", false),
		DefaultServiceTimeout: time.Duration(
			getenvInt("DEFAULT_SERVICE_TIMEOUT_MS", 8000),
		) * time.Millisecond,
		CookieSecure:         getenvBool("COOKIE_SECURE", false),
		CookieDomain:         getenv("COOKIE_DOMAIN", ""),
		AccessTokenTTL:       time.Duration(getenvInt("ACCESS_TOKEN_TTL_MINUTES", 15)) * time.Minute,
		RefreshTokenTTL:      time.Duration(getenvInt("REFRESH_TOKEN_TTL_HOURS", 168)) * time.Hour,
		SessionAccessCookie:  getenv("SESSION_ACCESS_COOKIE", "apwhy_access"),
		SessionRefreshCookie: getenv("SESSION_REFRESH_COOKIE", "apwhy_refresh"),
		FreeRPM:              getenvInt("FREE_RPM", 60),
		ProRPM:               getenvInt("PRO_RPM", 600),
		BusinessRPM:          getenvInt("BUSINESS_RPM", 3000),
		FreeMonthlyQuota:     getenvInt("FREE_MONTHLY_QUOTA", 1000),
		ProMonthlyQuota:      getenvInt("PRO_MONTHLY_QUOTA", 50000),
		BusinessMonthlyQuota: getenvInt("BUSINESS_MONTHLY_QUOTA", 300000),
		UmamiBaseURL:         strings.TrimRight(getenv("UMAMI_BASE_URL", ""), "/"),
		UmamiAPIKey:          getenv("UMAMI_API_KEY", ""),
		UmamiWebsiteID:       getenv("UMAMI_WEBSITE_ID", ""),
		TrustedProxyCIDR:     getenv("TRUSTED_PROXY_CIDR", ""),
	}
}
