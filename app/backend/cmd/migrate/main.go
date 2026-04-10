package main

import (
	"context"
	"log"
	"os"

	"containr/internal/config"
	"containr/internal/database"

	"github.com/pressly/goose/v3"
)

func main() {
	cfg := config.Load()

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

	legacyDir := os.Getenv("LEGACY_MIGRATIONS_DIR")
	if legacyDir == "" {
		legacyDir = "migrations"
	}

	gooseDir := os.Getenv("GOOSE_MIGRATIONS_DIR")
	if gooseDir == "" {
		gooseDir = "migrations_goose"
	}

	command := "up"
	if len(os.Args) > 1 {
		command = os.Args[1]
	}

	switch command {
	case "up":
		migrationCtx, migrationCancel := context.WithTimeout(context.Background(), cfg.MigrationLockTimeout)
		if err := db.MigrateAllWithLock(migrationCtx, legacyDir, gooseDir); err != nil {
			migrationCancel()
			log.Fatalf("Migration failed: %v", err)
		}
		migrationCancel()
		log.Println("Legacy + goose migrations completed successfully")
	case "legacy-up":
		if err := db.Migrate(legacyDir); err != nil {
			log.Fatalf("Legacy migration failed: %v", err)
		}
		log.Println("Legacy migrations completed successfully")
	case "goose-up":
		if err := db.MigrateGoose(gooseDir); err != nil {
			log.Fatalf("Goose migration failed: %v", err)
		}
		log.Println("Goose migrations completed successfully")
	case "goose-status":
		if err := db.GooseStatus(gooseDir); err != nil {
			log.Fatalf("Goose status failed: %v", err)
		}
	case "goose-create":
		if len(os.Args) < 3 {
			log.Fatalf("Missing migration name. Usage: go run cmd/migrate/main.go goose-create <name>")
		}
		name := os.Args[2]
		if err := goose.Create(nil, gooseDir, name, "sql"); err != nil {
			log.Fatalf("Goose create failed: %v", err)
		}
		log.Printf("Created goose migration %q in %q", name, gooseDir)
	default:
		log.Fatalf("Unknown command %q. Supported commands: up | legacy-up | goose-up | goose-status | goose-create", command)
	}
}
