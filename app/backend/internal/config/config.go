package config

import (
	"fmt"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"
)

// Config represents the application configuration
type Config struct {
	// Server Configuration
	Port            int           `env:"PORT" default:"8080"`
	Host            string        `env:"HOST" default:"localhost"`
	ReadTimeout     time.Duration `env:"READ_TIMEOUT" default:"30s"`
	WriteTimeout    time.Duration `env:"WRITE_TIMEOUT" default:"30s"`
	IdleTimeout     time.Duration `env:"IDLE_TIMEOUT" default:"60s"`
	ShutdownTimeout time.Duration `env:"SHUTDOWN_TIMEOUT" default:"30s"`

	// Database Configuration
	DatabaseURL          string        `env:"DATABASE_URL" default:"postgres://user:password@localhost/containr?sslmode=disable"`
	RedisURL             string        `env:"REDIS_URL" default:"redis://localhost:6379"`
	SQLitePath           string        `env:"SQLITE_PATH" default:"./data/apwhy.db"`
	MaxConnections       int           `env:"MAX_CONNECTIONS" default:"25"`
	MaxIdleConnections   int           `env:"MAX_IDLE_CONNECTIONS" default:"5"`
	ConnMaxLifetime      time.Duration `env:"CONN_MAX_LIFETIME" default:"5m"`
	ConnMaxIdleTime      time.Duration `env:"CONN_MAX_IDLE_TIME" default:"5m"`
	AutoMigrate          bool          `env:"AUTO_MIGRATE" default:"true"`
	MigrationLockTimeout time.Duration `env:"MIGRATION_LOCK_TIMEOUT" default:"2m"`
	SeedDataOnStart      bool          `env:"SEED_DATA_ON_START" default:"false"`

	// Security Configuration
	JWTSecret                string        `env:"JWT_SECRET" default:"your-secret-key-change-in-production"`
	AuthPort                 int           `env:"AUTH_PORT" default:"3001"`
	BetterAuthEnabled        bool          `env:"BETTER_AUTH_ENABLED" default:"true"`
	BetterAuthSecret         string        `env:"BETTER_AUTH_SECRET" default:"PLACEHOLDER_BETTER_AUTH_SECRET_CHANGE_ME_32CHARS_MIN"`
	BetterAuthProxyURL       string        `env:"BETTER_AUTH_PROXY_URL" default:"http://127.0.0.1:3001"`
	BetterAuthInternalURL    string        `env:"BETTER_AUTH_INTERNAL_URL" default:"http://127.0.0.1:3001/internal/session"`
	BetterAuthInternalToken  string        `env:"BETTER_AUTH_INTERNAL_TOKEN" default:""`
	BetterAuthNodeBinary     string        `env:"BETTER_AUTH_NODE_BINARY" default:"node"`
	BetterAuthEntrypoint     string        `env:"BETTER_AUTH_ENTRYPOINT" default:"auth/src/server.js"`
	BetterAuthStartupTimeout time.Duration `env:"BETTER_AUTH_STARTUP_TIMEOUT" default:"20s"`
	SessionAccessCookie      string        `env:"SESSION_ACCESS_COOKIE" default:"access_token"`
	SessionRefreshCookie     string        `env:"SESSION_REFRESH_COOKIE" default:"refresh_token"`
	AccessTokenTTL           time.Duration `env:"ACCESS_TOKEN_TTL" default:"15m"`
	RefreshTokenTTL          time.Duration `env:"REFRESH_TOKEN_TTL" default:"7d"`
	BcryptCost               int           `env:"BCRYPT_COST" default:"12"`

	// CORS Configuration
	CORSOrigins     []string `env:"CORS_ORIGINS" default:"*"`
	CORSMethods     []string `env:"CORS_METHODS" default:"GET,POST,PUT,PATCH,DELETE,OPTIONS"`
	CORSHeaders     []string `env:"CORS_HEADERS" default:"Origin,Content-Type,Accept,Authorization"`
	CORSCredentials bool     `env:"CORS_CREDENTIALS" default:"true"`

	// API Gateway Configuration
	APIKeyHeader          string        `env:"API_KEY_HEADER" default:"X-API-Key"`
	ServiceTokenHeader    string        `env:"SERVICE_TOKEN_HEADER" default:"X-Service-Token"`
	AllowRootRoutePrefix  bool          `env:"ALLOW_ROOT_ROUTE_PREFIX" default:"false"`
	DefaultServiceTimeout time.Duration `env:"DEFAULT_SERVICE_TIMEOUT" default:"30s"`

	// Rate Limiting Configuration
	FreeRPM              int `env:"FREE_RPM" default:"60"`
	ProRPM               int `env:"PRO_RPM" default:"600"`
	BusinessRPM          int `env:"BUSINESS_RPM" default:"3000"`
	FreeMonthlyQuota     int `env:"FREE_MONTHLY_QUOTA" default:"1000"`
	ProMonthlyQuota      int `env:"PRO_MONTHLY_QUOTA" default:"50000"`
	BusinessMonthlyQuota int `env:"BUSINESS_MONTHLY_QUOTA" default:"300000"`

	// Cookie Configuration
	CookieSecure   bool   `env:"COOKIE_SECURE" default:"false"`
	CookieDomain   string `env:"COOKIE_DOMAIN" default:""`
	CookiePath     string `env:"COOKIE_PATH" default:"/"`
	CookieSameSite string `env:"COOKIE_SAME_SITE" default:"lax"`

	// Analytics Configuration
	UmamiBaseURL   string `env:"UMAMI_BASE_URL" default:""`
	UmamiAPIKey    string `env:"UMAMI_API_KEY" default:""`
	UmamiWebsiteID string `env:"UMAMI_WEBSITE_ID" default:""`

	// Logging Configuration
	LogLevel  string `env:"LOG_LEVEL" default:"info"`
	LogFormat string `env:"LOG_FORMAT" default:"json"`
	LogOutput string `env:"LOG_OUTPUT" default:"stdout"`

	// Development/Debug Configuration
	Debug            bool   `env:"DEBUG" default:"false"`
	TrustedProxyCIDR string `env:"TRUSTED_PROXY_CIDR" default:""`
	MaxRequestBody   int64  `env:"MAX_REQUEST_BODY_BYTES" default:"10485760"`

	// Dashboard UI Configuration
	DashboardUIBasePath string `env:"DASHBOARD_UI_BASE_PATH" default:"/"`
}

// Environment represents the application environment
type Environment string

const (
	Development Environment = "development"
	Production  Environment = "production"
	Staging     Environment = "staging"
	Test        Environment = "test"
)

// Load loads configuration from environment variables with defaults
func Load() *Config {
	cfg := &Config{}

	// Use reflection or manual field setting for simplicity
	cfg.Port = getenvInt("PORT", 8080)
	cfg.Host = getenv("HOST", "localhost")
	cfg.ReadTimeout = getenvDuration("READ_TIMEOUT", 30*time.Second)
	cfg.WriteTimeout = getenvDuration("WRITE_TIMEOUT", 30*time.Second)
	cfg.IdleTimeout = getenvDuration("IDLE_TIMEOUT", 60*time.Second)
	cfg.ShutdownTimeout = getenvDuration("SHUTDOWN_TIMEOUT", 30*time.Second)

	cfg.DatabaseURL = encodeDatabasePassword(getenv("DATABASE_URL", "postgres://user:password@localhost/containr?sslmode=disable"))
	cfg.RedisURL = encodeRedisPassword(getenv("REDIS_URL", "redis://localhost:6379"))
	cfg.SQLitePath = getenv("SQLITE_PATH", "./data/apwhy.db")
	cfg.MaxConnections = getenvInt("MAX_CONNECTIONS", 25)
	cfg.MaxIdleConnections = getenvInt("MAX_IDLE_CONNECTIONS", 5)
	cfg.ConnMaxLifetime = getenvDuration("CONN_MAX_LIFETIME", 5*time.Minute)
	cfg.ConnMaxIdleTime = getenvDuration("CONN_MAX_IDLE_TIME", 5*time.Minute)
	cfg.AutoMigrate = getenvBool("AUTO_MIGRATE", true)
	cfg.MigrationLockTimeout = getenvDuration("MIGRATION_LOCK_TIMEOUT", 2*time.Minute)
	cfg.SeedDataOnStart = getenvBool("SEED_DATA_ON_START", false)

	cfg.JWTSecret = getenv("JWT_SECRET", "your-secret-key-change-in-production")
	cfg.AuthPort = getenvInt("AUTH_PORT", 3001)
	cfg.BetterAuthEnabled = getenvBool("BETTER_AUTH_ENABLED", true)
	cfg.BetterAuthSecret = getenv("BETTER_AUTH_SECRET", "PLACEHOLDER_BETTER_AUTH_SECRET_CHANGE_ME_32CHARS_MIN")
	cfg.BetterAuthProxyURL = getenv("BETTER_AUTH_PROXY_URL", "http://127.0.0.1:3001")
	cfg.BetterAuthInternalURL = getenv("BETTER_AUTH_INTERNAL_URL", "http://127.0.0.1:3001/internal/session")
	cfg.BetterAuthInternalToken = getenv("BETTER_AUTH_INTERNAL_TOKEN", "")
	cfg.BetterAuthNodeBinary = getenv("BETTER_AUTH_NODE_BINARY", "node")
	cfg.BetterAuthEntrypoint = getenv("BETTER_AUTH_ENTRYPOINT", "auth/src/server.js")
	cfg.BetterAuthStartupTimeout = getenvDuration("BETTER_AUTH_STARTUP_TIMEOUT", 20*time.Second)
	cfg.SessionAccessCookie = getenv("SESSION_ACCESS_COOKIE", "access_token")
	cfg.SessionRefreshCookie = getenv("SESSION_REFRESH_COOKIE", "refresh_token")
	cfg.AccessTokenTTL = getenvDuration("ACCESS_TOKEN_TTL", 15*time.Minute)
	cfg.RefreshTokenTTL = getenvDuration("REFRESH_TOKEN_TTL", 7*24*time.Hour)
	cfg.BcryptCost = getenvInt("BCRYPT_COST", 12)

	cfg.CORSOrigins = getenvSliceWithAliases([]string{"CORS_ORIGINS", "CORS_ALLOWED_ORIGINS"}, []string{"*"})
	cfg.CORSMethods = getenvSlice("CORS_METHODS", []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"})
	cfg.CORSHeaders = getenvSlice("CORS_HEADERS", []string{"Origin", "Content-Type", "Accept", "Authorization"})
	cfg.CORSCredentials = getenvBool("CORS_CREDENTIALS", true)

	cfg.APIKeyHeader = getenv("API_KEY_HEADER", "X-API-Key")
	cfg.ServiceTokenHeader = getenv("SERVICE_TOKEN_HEADER", "X-Service-Token")
	cfg.AllowRootRoutePrefix = getenvBool("ALLOW_ROOT_ROUTE_PREFIX", false)
	cfg.DefaultServiceTimeout = getenvDuration("DEFAULT_SERVICE_TIMEOUT", 30*time.Second)

	cfg.FreeRPM = getenvInt("FREE_RPM", 60)
	cfg.ProRPM = getenvInt("PRO_RPM", 600)
	cfg.BusinessRPM = getenvInt("BUSINESS_RPM", 3000)
	cfg.FreeMonthlyQuota = getenvInt("FREE_MONTHLY_QUOTA", 1000)
	cfg.ProMonthlyQuota = getenvInt("PRO_MONTHLY_QUOTA", 50000)
	cfg.BusinessMonthlyQuota = getenvInt("BUSINESS_MONTHLY_QUOTA", 300000)

	cfg.CookieSecure = getenvBool("COOKIE_SECURE", false)
	cfg.CookieDomain = getenv("COOKIE_DOMAIN", "")
	cfg.CookiePath = getenv("COOKIE_PATH", "/")
	cfg.CookieSameSite = getenv("COOKIE_SAME_SITE", "lax")

	cfg.UmamiBaseURL = getenv("UMAMI_BASE_URL", "")
	cfg.UmamiAPIKey = getenv("UMAMI_API_KEY", "")
	cfg.UmamiWebsiteID = getenv("UMAMI_WEBSITE_ID", "")

	cfg.LogLevel = getenv("LOG_LEVEL", "info")
	cfg.LogFormat = getenv("LOG_FORMAT", "json")
	cfg.LogOutput = getenv("LOG_OUTPUT", "stdout")

	cfg.Debug = getenvBool("DEBUG", false)
	cfg.TrustedProxyCIDR = getenv("TRUSTED_PROXY_CIDR", "")
	cfg.MaxRequestBody = getenvInt64("MAX_REQUEST_BODY_BYTES", 10*1024*1024)

	cfg.DashboardUIBasePath = getenv("DASHBOARD_UI_BASE_PATH", "/")

	// Validate configuration
	if err := cfg.Validate(); err != nil {
		panic(fmt.Sprintf("Invalid configuration: %v", err))
	}

	return cfg
}

// Validate validates the configuration
func (c *Config) Validate() error {
	if c.JWTSecret == "your-secret-key-change-in-production" && c.GetEnvironment() == Production {
		return fmt.Errorf("JWT_SECRET must be set in production")
	}

	if c.DatabaseURL == "" {
		return fmt.Errorf("DATABASE_URL is required")
	}

	if c.Port < 1 || c.Port > 65535 {
		return fmt.Errorf("PORT must be between 1 and 65535")
	}

	if c.BcryptCost < 10 || c.BcryptCost > 31 {
		return fmt.Errorf("BCRYPT_COST must be between 10 and 31")
	}

	if c.GetEnvironment() == Production {
		if len(strings.TrimSpace(c.JWTSecret)) < 32 {
			return fmt.Errorf("JWT_SECRET must be at least 32 characters in production")
		}
		if c.SeedDataOnStart {
			return fmt.Errorf("SEED_DATA_ON_START must be false in production")
		}

		if !c.CookieSecure {
			return fmt.Errorf("COOKIE_SECURE must be true in production")
		}

		if c.BetterAuthEnabled {
			if len(strings.TrimSpace(c.BetterAuthSecret)) < 32 ||
				c.BetterAuthSecret == "PLACEHOLDER_BETTER_AUTH_SECRET_CHANGE_ME_32CHARS_MIN" {
				return fmt.Errorf("BETTER_AUTH_SECRET must be at least 32 characters in production")
			}
			if strings.TrimSpace(c.BetterAuthInternalToken) == "" ||
				c.BetterAuthInternalToken == "PLACEHOLDER_INTERNAL_AUTH_TOKEN" {
				return fmt.Errorf("BETTER_AUTH_INTERNAL_TOKEN must be set in production")
			}
		}

		nonEmptyOrigins := 0
		for _, origin := range c.CORSOrigins {
			trimmed := strings.TrimSpace(origin)
			if trimmed == "" {
				continue
			}
			nonEmptyOrigins++
			if trimmed == "*" && c.CORSCredentials {
				return fmt.Errorf("CORS_ORIGINS cannot include '*' when CORS_CREDENTIALS=true in production")
			}
		}
		if nonEmptyOrigins == 0 {
			return fmt.Errorf("CORS_ORIGINS must include at least one explicit origin in production")
		}
	}

	return nil
}

// GetEnvironment determines the current environment
func (c *Config) GetEnvironment() Environment {
	env := strings.ToLower(getenv("ENVIRONMENT", "development"))
	switch env {
	case "production":
		return Production
	case "staging":
		return Staging
	case "test":
		return Test
	default:
		return Development
	}
}

// IsProduction returns true if running in production
func (c *Config) IsProduction() bool {
	return c.GetEnvironment() == Production
}

// IsDevelopment returns true if running in development
func (c *Config) IsDevelopment() bool {
	return c.GetEnvironment() == Development
}

// Helper functions for environment variable parsing
func getenv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getenvInt(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if intValue, err := strconv.Atoi(value); err == nil {
			return intValue
		}
	}
	return defaultValue
}

func getenvBool(key string, defaultValue bool) bool {
	if value := os.Getenv(key); value != "" {
		if boolValue, err := strconv.ParseBool(value); err == nil {
			return boolValue
		}
	}
	return defaultValue
}

func getenvDuration(key string, defaultValue time.Duration) time.Duration {
	if value := os.Getenv(key); value != "" {
		if duration, err := time.ParseDuration(value); err == nil {
			return duration
		}
	}
	return defaultValue
}

func getenvInt64(key string, defaultValue int64) int64 {
	if value := os.Getenv(key); value != "" {
		if intValue, err := strconv.ParseInt(value, 10, 64); err == nil {
			return intValue
		}
	}
	return defaultValue
}

func getenvSlice(key string, defaultValue []string) []string {
	if value := os.Getenv(key); value != "" {
		return strings.Split(value, ",")
	}
	return defaultValue
}

func getenvSliceWithAliases(keys []string, defaultValue []string) []string {
	for _, key := range keys {
		if value := os.Getenv(key); value != "" {
			return strings.Split(value, ",")
		}
	}
	return defaultValue
}

// encodeDatabasePassword URL-encodes the password in a database connection string
func encodeDatabasePassword(databaseURL string) string {
	// Find the password part between :@ and encode it
	atIndex := strings.LastIndex(databaseURL, "@")
	if atIndex == -1 {
		return databaseURL // No @ found, return as is
	}

	beforeAt := databaseURL[:atIndex]
	afterAt := databaseURL[atIndex:]

	// Find the last : before the @ to locate the password
	lastColonIndex := strings.LastIndex(beforeAt, ":")
	if lastColonIndex == -1 {
		return databaseURL // No : found, return as is
	}

	userPart := beforeAt[:lastColonIndex]
	password := beforeAt[lastColonIndex+1:]

	// URL encode the password
	encodedPassword := url.QueryEscape(password)

	// Reconstruct the URL
	return userPart + ":" + encodedPassword + afterAt
}

// encodeRedisPassword URL-encodes the password in a Redis connection string.
func encodeRedisPassword(redisURL string) string {
	// Find the host separator (@). Use the last one so passwords containing @ are preserved.
	atIndex := strings.LastIndex(redisURL, "@")
	if atIndex == -1 {
		return redisURL // No auth section found
	}

	beforeAt := redisURL[:atIndex]
	afterAt := redisURL[atIndex:]

	// Find the last : before @ to locate the password.
	lastColonIndex := strings.LastIndex(beforeAt, ":")
	if lastColonIndex == -1 {
		return redisURL // No password separator found
	}

	password := beforeAt[lastColonIndex+1:]
	if password == "" {
		return redisURL
	}

	decoded, err := url.QueryUnescape(password)
	if err == nil {
		password = decoded
	}
	encodedPassword := url.QueryEscape(password)

	return beforeAt[:lastColonIndex+1] + encodedPassword + afterAt
}
