package database

import (
	"context"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"regexp"
	"sort"
)

var managedMigrationPattern = regexp.MustCompile(`^\d{3}_.+\.sql$`)

// Migrate runs all migration files in the migrations directory
func (db *DB) Migrate(migrationsDir string) error {
	if err := db.ensureRequiredExtensions(); err != nil {
		return err
	}

	// Create migrations table if it doesn't exist
	if err := db.createMigrationsTable(); err != nil {
		return fmt.Errorf("failed to create migrations table: %w", err)
	}

	migrationFiles, err := listManagedMigrationFiles(migrationsDir)
	if err != nil {
		return err
	}

	// Run each migration that hasn't been run yet
	for _, fileName := range migrationFiles {
		if err := db.runMigration(migrationsDir, fileName); err != nil {
			return fmt.Errorf("failed to run migration %s: %w", fileName, err)
		}
	}

	log.Println("All migrations completed successfully")
	return nil
}

func listManagedMigrationFiles(migrationsDir string) ([]string, error) {
	entries, err := os.ReadDir(migrationsDir)
	if err != nil {
		return nil, fmt.Errorf("failed to read migrations directory: %w", err)
	}

	migrationFiles := make([]string, 0, len(entries))
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}

		fileName := entry.Name()
		if !isManagedMigrationFile(fileName) {
			log.Printf("Skipping unmanaged migration file: %s", fileName)
			continue
		}

		migrationFiles = append(migrationFiles, fileName)
	}

	sort.Strings(migrationFiles)
	return migrationFiles, nil
}

func isManagedMigrationFile(fileName string) bool {
	return managedMigrationPattern.MatchString(fileName)
}

func (db *DB) ensureRequiredExtensions() error {
	if _, err := db.Exec(`CREATE EXTENSION IF NOT EXISTS pgcrypto`); err != nil {
		return fmt.Errorf("failed to ensure pgcrypto extension required for UUID defaults: %w", err)
	}
	return nil
}

func (db *DB) createMigrationsTable() error {
	query := `
		CREATE TABLE IF NOT EXISTS migrations (
			id SERIAL PRIMARY KEY,
			filename VARCHAR(255) UNIQUE NOT NULL,
			executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
		)
	`
	_, err := db.Exec(query)
	return err
}

func (db *DB) runMigration(migrationsDir, fileName string) error {
	// Check if migration has already been run
	var count int
	err := db.QueryRow("SELECT COUNT(*) FROM migrations WHERE filename = $1", fileName).Scan(&count)
	if err != nil {
		return fmt.Errorf("failed to check migration status: %w", err)
	}

	if count > 0 {
		log.Printf("Migration %s already executed, skipping", fileName)
		return nil
	}

	// Read migration file
	filePath := filepath.Join(migrationsDir, fileName)
	content, err := os.ReadFile(filePath)
	if err != nil {
		return fmt.Errorf("failed to read migration file %s: %w", fileName, err)
	}

	// Execute migration in a transaction
	tx, err := db.BeginTx(context.Background(), nil)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	// Execute migration SQL
	_, err = tx.Exec(string(content))
	if err != nil {
		return fmt.Errorf("failed to execute migration %s: %w", fileName, err)
	}

	// Record that migration was executed
	_, err = tx.Exec("INSERT INTO migrations (filename) VALUES ($1)", fileName)
	if err != nil {
		return fmt.Errorf("failed to record migration %s: %w", fileName, err)
	}

	// Commit transaction
	if err = tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit migration %s: %w", fileName, err)
	}

	log.Printf("Successfully executed migration: %s", fileName)
	return nil
}

// SeedData inserts initial data for development
func (db *DB) SeedData() error {
	// Check if we already have users
	var count int
	err := db.QueryRow("SELECT COUNT(*) FROM users").Scan(&count)
	if err != nil {
		return fmt.Errorf("failed to check existing users: %w", err)
	}

	if count > 0 {
		log.Println("Database already has data, skipping seed")
		return nil
	}

	// Insert demo user
	hashedPassword := "$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi" // "password"
	_, err = db.Exec(`
		INSERT INTO users (email, password_hash, name) 
		VALUES ($1, $2, $3)
	`, "demo@containr.dev", hashedPassword, "Demo User")
	if err != nil {
		return fmt.Errorf("failed to create demo user: %w", err)
	}

	// Insert demo project
	var projectID string
	err = db.QueryRow(`
		INSERT INTO projects (name, description, owner_id) 
		VALUES ($1, $2, (SELECT id FROM users WHERE email = $3))
		RETURNING id
	`, "Demo Project", "A sample project to showcase Containr features", "demo@containr.dev").Scan(&projectID)
	if err != nil {
		return fmt.Errorf("failed to create demo project: %w", err)
	}

	// Insert environments
	environments := []string{"production", "preview", "development"}
	for _, env := range environments {
		_, err = db.Exec(`
			INSERT INTO environments (name, project_id) 
			VALUES ($1, $2)
		`, env, projectID)
		if err != nil {
			return fmt.Errorf("failed to create environment %s: %w", env, err)
		}
	}

	log.Println("Database seeded successfully")
	return nil
}
