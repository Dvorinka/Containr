package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"containr/internal/api"
	"containr/internal/authruntime"
	"containr/internal/config"
	"containr/internal/database"
	"containr/internal/middleware"

	"github.com/gin-gonic/gin"
	"github.com/rs/cors"
)

func main() {
	// Load configuration
	cfg := config.Load()

	// Initialize database
	db, err := database.NewConnectionWithConfig(cfg.DatabaseURL, database.DBConfig{
		MaxOpenConns:    cfg.MaxConnections,
		MaxIdleConns:    cfg.MaxIdleConnections,
		ConnMaxLifetime: cfg.ConnMaxLifetime,
		ConnMaxIdleTime: cfg.ConnMaxIdleTime,
	})
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()

	// Run startup migrations unless explicitly disabled.
	if cfg.AutoMigrate {
		migrationCtx, migrationCancel := context.WithTimeout(context.Background(), cfg.MigrationLockTimeout)
		if err := db.MigrateAllWithLock(migrationCtx, "migrations", "migrations_goose"); err != nil {
			migrationCancel()
			log.Fatalf("Failed to run database migrations: %v", err)
		}
		migrationCancel()
	} else {
		log.Println("AUTO_MIGRATE disabled; skipping startup migrations")
	}

	// Seed demo data in development (or when explicitly requested).
	if cfg.IsDevelopment() || cfg.SeedDataOnStart {
		if err := db.SeedData(); err != nil {
			log.Printf("Warning: Failed to seed data: %v", err)
		}
	}

	// Initialize Redis
	redis, err := database.NewRedis(cfg.RedisURL)
	if err != nil {
		log.Fatalf("Failed to initialize Redis: %v", err)
	}
	redisHealthCtx, redisHealthCancel := context.WithTimeout(context.Background(), 5*time.Second)
	if err := redis.Health(redisHealthCtx); err != nil {
		redisHealthCancel()
		log.Fatalf("Failed to connect to Redis: %v", err)
	}
	redisHealthCancel()
	defer redis.Close()

	authRuntime, err := authruntime.Start(authruntime.Config{
		Enabled:        cfg.BetterAuthEnabled,
		NodeBinary:     cfg.BetterAuthNodeBinary,
		Entrypoint:     cfg.BetterAuthEntrypoint,
		Port:           cfg.AuthPort,
		StartupTimeout: cfg.BetterAuthStartupTimeout,
	})
	if err != nil {
		log.Fatalf("Failed to start embedded Better Auth runtime: %v", err)
	}
	if authRuntime != nil {
		defer func() {
			if closeErr := authRuntime.Close(); closeErr != nil {
				log.Printf("Better Auth runtime shutdown error: %v", closeErr)
			}
		}()
	}

	// Setup Gin router
	if cfg.IsProduction() {
		gin.SetMode(gin.ReleaseMode)
	}

	router := gin.New()
	trustedProxies := []string{}
	if cfg.TrustedProxyCIDR != "" {
		trustedProxies = []string{cfg.TrustedProxyCIDR}
	}
	if err := router.SetTrustedProxies(trustedProxies); err != nil {
		log.Fatalf("Failed to configure trusted proxies: %v", err)
	}

	// Add middleware
	router.Use(middleware.SecurityHeaders())
	router.Use(middleware.Logger())
	router.Use(middleware.Recovery())
	router.Use(middleware.RequestID())
	router.Use(middleware.RequestBodyLimit(cfg.MaxRequestBody))

	// CORS setup
	c := cors.New(cors.Options{
		AllowedOrigins:   cfg.CORSOrigins,
		AllowedMethods:   cfg.CORSMethods,
		AllowedHeaders:   cfg.CORSHeaders,
		ExposedHeaders:   []string{"Content-Length"},
		AllowCredentials: cfg.CORSCredentials,
		MaxAge:           86400,
	})

	// Wrap Gin router with CORS
	handler := c.Handler(router)

	// Initialize API routes
	api.SetupRoutes(router, db, redis, cfg)

	// Create HTTP server
	addr := fmt.Sprintf("%s:%d", cfg.Host, cfg.Port)
	log.Printf("Server starting on %s", addr)
	server := &http.Server{
		Addr:         addr,
		Handler:      handler,
		ReadTimeout:  cfg.ReadTimeout,
		WriteTimeout: cfg.WriteTimeout,
		IdleTimeout:  cfg.IdleTimeout,
	}

	// Start server in a goroutine
	go func() {
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Failed to start server: %v", err)
		}
	}()

	// Wait for interrupt signal to gracefully shutdown the server
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down server...")

	// Create a deadline for shutdown
	ctx, cancel := context.WithTimeout(context.Background(), cfg.ShutdownTimeout)
	defer cancel()

	// Attempt graceful shutdown
	if err := server.Shutdown(ctx); err != nil {
		log.Printf("Server forced to shutdown: %v", err)
	}

	log.Println("Server exited")
}
