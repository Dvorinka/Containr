package storage

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	_ "github.com/go-sql-driver/mysql"
	_ "github.com/jackc/pgx/v5/stdlib"
	_ "modernc.org/sqlite"

	"apwhy/internal/auth"
	"apwhy/internal/config"
	"apwhy/internal/rbac"
)

type Store struct {
	DB  *sql.DB
	Cfg config.Config
}

func NowISO() string {
	return time.Now().UTC().Format(time.RFC3339)
}

func Open(cfg config.Config) (*Store, error) {
	db, err := sql.Open("sqlite", cfg.SQLitePath)
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(1)

	if _, err := db.Exec(schemaSQL); err != nil {
		return nil, fmt.Errorf("failed to apply schema: %w", err)
	}

	s := &Store{DB: db, Cfg: cfg}
	if err := s.seedAccessControl(context.Background()); err != nil {
		return nil, err
	}
	return s, nil
}

func (s *Store) Close() error {
	return s.DB.Close()
}

func (s *Store) seedAccessControl(ctx context.Context) error {
	tx, err := s.DB.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	now := NowISO()

	for _, permission := range rbac.PermissionSeeds {
		id, _ := auth.RandomID("perm")
		_, err := tx.ExecContext(ctx, `
			INSERT INTO permissions (id, code, name, description, created_at)
			VALUES (?, ?, ?, ?, ?)
			ON CONFLICT(code) DO UPDATE SET name=excluded.name, description=excluded.description
		`, id, permission.Code, permission.Name, permission.Description, now)
		if err != nil {
			return err
		}
	}

	type roleSeed struct {
		Name        string
		Slug        string
		Description string
		System      bool
		PermCodes   []string
	}

	roles := []roleSeed{
		{Name: "Owner", Slug: "owner", Description: "Primary administrator with all permissions.", System: true, PermCodes: rbac.OwnerPermissionCodes},
		{Name: "Admin", Slug: "admin", Description: "Operational admin with management permissions.", System: true, PermCodes: rbac.AdminPermissionCodes},
		{Name: "Viewer", Slug: "viewer", Description: "Read-only dashboard access.", System: true, PermCodes: rbac.ViewerPermissionCodes},
	}

	for _, role := range roles {
		roleID := ""
		_ = tx.QueryRowContext(ctx, `SELECT id FROM roles WHERE slug = ?`, role.Slug).Scan(&roleID)
		if roleID == "" {
			roleID, _ = auth.RandomID("role")
			_, err := tx.ExecContext(ctx, `
				INSERT INTO roles (id, name, slug, description, is_system, enabled, created_at, updated_at)
				VALUES (?, ?, ?, ?, ?, 1, ?, ?)
			`, roleID, role.Name, role.Slug, role.Description, boolToInt(role.System), now, now)
			if err != nil {
				return err
			}
		} else {
			_, err := tx.ExecContext(ctx, `
				UPDATE roles SET name = ?, description = ?, is_system = ?, updated_at = ? WHERE id = ?
			`, role.Name, role.Description, boolToInt(role.System), now, roleID)
			if err != nil {
				return err
			}
		}

		if role.System {
			_, err := tx.ExecContext(ctx, `DELETE FROM role_permissions WHERE role_id = ?`, roleID)
			if err != nil {
				return err
			}
			for _, code := range role.PermCodes {
				permID := ""
				if err := tx.QueryRowContext(ctx, `SELECT id FROM permissions WHERE code = ?`, code).Scan(&permID); err != nil {
					return err
				}
				_, err = tx.ExecContext(ctx, `
					INSERT INTO role_permissions (role_id, permission_id, created_at) VALUES (?, ?, ?)
					ON CONFLICT(role_id, permission_id) DO NOTHING
				`, roleID, permID, now)
				if err != nil {
					return err
				}
			}
		}
	}

	return tx.Commit()
}

func boolToInt(value bool) int {
	if value {
		return 1
	}
	return 0
}

func monthPeriod(t time.Time) string {
	return t.UTC().Format("2006-01")
}

func slugify(value string, fallback string) string {
	v := strings.ToLower(strings.TrimSpace(value))
	if v == "" {
		v = fallback
	}
	out := strings.Builder{}
	lastDash := false
	for _, r := range v {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') {
			out.WriteRune(r)
			lastDash = false
			continue
		}
		if !lastDash {
			out.WriteRune('-')
			lastDash = true
		}
	}
	result := strings.Trim(out.String(), "-")
	if result == "" {
		return fallback
	}
	return result
}

func normalizePathPrefix(value, fallback string) string {
	v := strings.TrimSpace(value)
	if v == "" {
		v = fallback
	}
	if !strings.HasPrefix(v, "/") {
		v = "/" + v
	}
	if len(v) > 1 && strings.HasSuffix(v, "/") {
		v = strings.TrimSuffix(v, "/")
	}
	return v
}

func normalizeHealthPath(value string) string {
	return normalizePathPrefix(value, "/health")
}

func parseAllowedServiceIDs(value string) []string {
	if strings.TrimSpace(value) == "" {
		return []string{}
	}
	var result []string
	_ = json.Unmarshal([]byte(value), &result)
	if result == nil {
		return []string{}
	}
	return result
}

func mustJSON(v any) string {
	bytes, _ := json.Marshal(v)
	return string(bytes)
}

func minLimit(a, b sql.NullInt64) sql.NullInt64 {
	if !a.Valid && !b.Valid {
		return sql.NullInt64{}
	}
	if !a.Valid {
		return b
	}
	if !b.Valid {
		return a
	}
	if a.Int64 < b.Int64 {
		return a
	}
	return b
}

func toNullInt(value *int) sql.NullInt64 {
	if value == nil || *value <= 0 {
		return sql.NullInt64{}
	}
	return sql.NullInt64{Valid: true, Int64: int64(*value)}
}

func scanJSONText(value sql.NullString) string {
	if !value.Valid {
		return "[]"
	}
	if strings.TrimSpace(value.String) == "" {
		return "[]"
	}
	return value.String
}

var ErrNotFound = errors.New("not found")
