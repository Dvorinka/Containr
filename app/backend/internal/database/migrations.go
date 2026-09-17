package database

import (
	"fmt"
	"log"
)

func (db *DB) ensureRequiredExtensions() error {
	if _, err := db.Exec(`CREATE EXTENSION IF NOT EXISTS pgcrypto`); err != nil {
		return fmt.Errorf("failed to ensure pgcrypto extension required for UUID defaults: %w", err)
	}
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
