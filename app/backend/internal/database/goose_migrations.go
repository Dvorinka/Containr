package database

import (
	"context"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/pressly/goose/v3"
)

const (
	defaultLegacyMigrationsDir = "migrations"
	defaultGooseMigrationsDir  = "migrations_goose"
	migrationAdvisoryLockKey   = int64(637266846588921720)
)

var migrationLockRetryInterval = 250 * time.Millisecond

// MigrateAll runs legacy app migrations first, then goose-managed migrations.
// This allows a safe transition without breaking existing installations.
func (db *DB) MigrateAll(legacyDir, gooseDir string) error {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()
	return db.MigrateAllWithLock(ctx, legacyDir, gooseDir)
}

// MigrateAllWithLock runs legacy + goose migrations while holding a PostgreSQL
// advisory lock to prevent concurrent migrators from racing.
func (db *DB) MigrateAllWithLock(ctx context.Context, legacyDir, gooseDir string) error {
	if legacyDir == "" {
		legacyDir = defaultLegacyMigrationsDir
	}
	if gooseDir == "" {
		gooseDir = defaultGooseMigrationsDir
	}

	releaseLock, err := db.acquireMigrationLock(ctx)
	if err != nil {
		return err
	}
	defer func() {
		if unlockErr := releaseLock(); unlockErr != nil {
			log.Printf("Warning: failed to release migration advisory lock: %v", unlockErr)
		}
	}()

	if err := db.Migrate(legacyDir); err != nil {
		return err
	}

	if err := db.MigrateGoose(gooseDir); err != nil {
		return err
	}

	return nil
}

func (db *DB) acquireMigrationLock(ctx context.Context) (func() error, error) {
	if ctx == nil {
		ctx = context.Background()
	}

	conn, err := db.Conn(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to open connection for migration lock: %w", err)
	}

	for {
		var acquired bool
		if err := conn.QueryRowContext(ctx, "SELECT pg_try_advisory_lock($1)", migrationAdvisoryLockKey).Scan(&acquired); err != nil {
			conn.Close()
			return nil, fmt.Errorf("failed to acquire migration advisory lock: %w", err)
		}
		if acquired {
			break
		}

		select {
		case <-ctx.Done():
			conn.Close()
			return nil, fmt.Errorf("timed out waiting for migration advisory lock: %w", ctx.Err())
		case <-time.After(migrationLockRetryInterval):
		}
	}

	log.Println("Acquired migration advisory lock")

	return func() error {
		defer conn.Close()

		var released bool
		if err := conn.QueryRowContext(context.Background(), "SELECT pg_advisory_unlock($1)", migrationAdvisoryLockKey).Scan(&released); err != nil {
			return fmt.Errorf("failed to release migration advisory lock: %w", err)
		}
		if !released {
			return fmt.Errorf("migration advisory lock was not held by current session")
		}

		log.Println("Released migration advisory lock")
		return nil
	}, nil
}

func (db *DB) MigrateGoose(migrationsDir string) error {
	if _, err := os.Stat(migrationsDir); err != nil {
		if os.IsNotExist(err) {
			log.Printf("Goose migrations directory %q not found, skipping goose migrations", migrationsDir)
			return nil
		}
		return fmt.Errorf("failed to access goose migrations directory %q: %w", migrationsDir, err)
	}

	if err := goose.SetDialect("postgres"); err != nil {
		return fmt.Errorf("failed to set goose dialect: %w", err)
	}

	if err := goose.Up(db.DB, migrationsDir); err != nil {
		return fmt.Errorf("failed to run goose migrations from %q: %w", migrationsDir, err)
	}

	log.Printf("Goose migrations completed successfully from %q", migrationsDir)
	return nil
}

func (db *DB) GooseStatus(migrationsDir string) error {
	if err := goose.SetDialect("postgres"); err != nil {
		return fmt.Errorf("failed to set goose dialect: %w", err)
	}
	if err := goose.Status(db.DB, migrationsDir); err != nil {
		return fmt.Errorf("failed to get goose migration status: %w", err)
	}
	return nil
}
