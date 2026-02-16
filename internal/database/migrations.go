package database

import (
	"context"
	"fmt"
	"io/ioutil"
	"log"
	"path/filepath"
	"sort"
	"strings"
)

// Migrate runs all migration files in the migrations directory
func (db *DB) Migrate(migrationsDir string) error {
	// Create migrations table if it doesn't exist
	if err := db.createMigrationsTable(); err != nil {
		return fmt.Errorf("failed to create migrations table: %w", err)
	}

	// Get list of migration files
	files, err := ioutil.ReadDir(migrationsDir)
	if err != nil {
		return fmt.Errorf("failed to read migrations directory: %w", err)
	}

	// Sort files by name to ensure proper order
	var migrationFiles []string
	for _, file := range files {
		if !file.IsDir() && strings.HasSuffix(file.Name(), ".sql") {
			migrationFiles = append(migrationFiles, file.Name())
		}
	}
	sort.Strings(migrationFiles)

	// Run each migration that hasn't been run yet
	for _, fileName := range migrationFiles {
		if err := db.runMigration(migrationsDir, fileName); err != nil {
			return fmt.Errorf("failed to run migration %s: %w", fileName, err)
		}
	}

	log.Println("All migrations completed successfully")
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
	content, err := ioutil.ReadFile(filePath)
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
