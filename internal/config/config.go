package config

import (
	"os"
	"strconv"
)

type Config struct {
	Environment string
	Port        string
	DatabaseURL string
	RedisURL    string
	JWTSecret   string
	CORS        CORSConfig
	Proxmox     ProxmoxConfig
}

type CORSConfig struct {
	AllowedOrigins []string
}

type ProxmoxConfig struct {
	BaseURL  string
	Username string
	Password string
	TokenID  string
	Token    string
}

func Load() *Config {
	cfg := &Config{
		Environment: getEnv("ENVIRONMENT", "development"),
		Port:        getEnv("PORT", "8080"),
		DatabaseURL: getEnv("DATABASE_URL", "postgres://containr:password@localhost:5432/containr?sslmode=disable"),
		RedisURL:    getEnv("REDIS_URL", "redis://localhost:6379"),
		JWTSecret:   getEnv("JWT_SECRET", "your-secret-key-change-in-production"),
		CORS: CORSConfig{
			AllowedOrigins: []string{
				"http://localhost:3000", // Vite dev server
				"http://localhost:5173", // Alternative Vite port
			},
		},
		Proxmox: ProxmoxConfig{
			BaseURL:  getEnv("PROXMOX_BASE_URL", ""),
			Username: getEnv("PROXMOX_USERNAME", ""),
			Password: getEnv("PROXMOX_PASSWORD", ""),
			TokenID:  getEnv("PROXMOX_TOKEN_ID", ""),
			Token:    getEnv("PROXMOX_TOKEN", ""),
		},
	}

	// Add production origins if in production
	if cfg.Environment == "production" {
		cfg.CORS.AllowedOrigins = append(cfg.CORS.AllowedOrigins,
			getEnv("FRONTEND_URL", "https://your-domain.com"))
	}

	return cfg
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getEnvAsBool(key string, defaultValue bool) bool {
	if value := os.Getenv(key); value != "" {
		if parsed, err := strconv.ParseBool(value); err == nil {
			return parsed
		}
	}
	return defaultValue
}

func getEnvAsInt(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if parsed, err := strconv.Atoi(value); err == nil {
			return parsed
		}
	}
	return defaultValue
}
