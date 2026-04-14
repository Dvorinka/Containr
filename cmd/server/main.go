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
	db, err := database.NewConnection(cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()

	// Run migrations
	if err := db.Migrate("migrations"); err != nil {
		log.Printf("Warning: Failed to run migrations: %v", err)
	}

	// Seed data for development
	if cfg.IsDevelopment() {
		if err := db.SeedData(); err != nil {
			log.Printf("Warning: Failed to seed data: %v", err)
		}
	}

	// Initialize Redis
	redis := database.NewRedis("redis://localhost:6379") // Default Redis URL

	// Setup Gin router
	if cfg.IsProduction() {
		gin.SetMode(gin.ReleaseMode)
	}

	router := gin.New()

	// Add middleware
	router.Use(middleware.Logger())
	router.Use(middleware.Recovery())
	router.Use(middleware.RequestID())

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
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Start server in a goroutine
	go func() {
		log.Printf("Server starting on %s", addr)
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
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Attempt graceful shutdown
	if err := server.Shutdown(ctx); err != nil {
		log.Printf("Server forced to shutdown: %v", err)
	}

	log.Println("Server exited")
}
