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
	"github.com/google/uuid"
	_ "github.com/jackc/pgx/v5/stdlib"
	_ "modernc.org/sqlite"

	"containr/internal/auth"
	"containr/internal/config"
	"containr/internal/rbac"
)

type Store struct {
	DB  *sql.DB
	Cfg config.Config
}

func NowISO() string {
	return time.Now().UTC().Format(time.RFC3339)
}

func generateUUID() string {
	return uuid.New().String()
}

func Open(cfg config.Config) (*Store, error) {
	// Use PostgreSQL for Containr, fallback to SQLite for APwhy compatibility
	var db *sql.DB
	var err error

	if cfg.DatabaseURL != "" {
		db, err = sql.Open("pgx", cfg.DatabaseURL)
	} else if cfg.SQLitePath != "" {
		db, err = sql.Open("sqlite", cfg.SQLitePath)
	} else {
		return nil, errors.New("no database configuration provided")
	}

	if err != nil {
		return nil, err
	}

	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(5)

	// Test connection
	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("failed to connect to database: %w", err)
	}

	s := &Store{DB: db, Cfg: cfg}

	// Only seed APwhy data if using SQLite or if PostgreSQL tables don't exist
	if cfg.SQLitePath != "" || !s.postgresTablesExist() {
		if err := s.seedAccessControl(context.Background()); err != nil {
			return nil, err
		}
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

// postgresTablesExist checks if APwhy tables exist in PostgreSQL
func (s *Store) postgresTablesExist() bool {
	var count int
	err := s.DB.QueryRow(`
		SELECT COUNT(*) FROM information_schema.tables 
		WHERE table_schema = 'public' 
		AND table_name = 'api_services'
	`).Scan(&count)
	return err == nil && count > 0
}

// APwhy Service operations
func (s *Store) ListAPServices(ctx context.Context) ([]APService, error) {
	rows, err := s.DB.QueryContext(ctx, `
		SELECT id, name, slug, upstream_url, route_prefix, health_path, 
			   upstream_auth_header, upstream_auth_value, internal_token,
			   enabled, rpm_limit, monthly_quota, request_timeout_ms,
			   last_validation_at, last_validation_status, last_validation_message,
			   created_at, updated_at
		FROM api_services 
		ORDER BY created_at DESC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var services []APService
	for rows.Next() {
		var service APService
		err := rows.Scan(
			&service.ID, &service.Name, &service.Slug, &service.UpstreamURL,
			&service.RoutePrefix, &service.HealthPath, &service.UpstreamAuthHeader,
			&service.UpstreamAuthValue, &service.InternalToken, &service.Enabled,
			&service.RPMLimit, &service.MonthlyQuota, &service.RequestTimeoutMs,
			&service.LastValidationAt, &service.LastValidationStatus,
			&service.LastValidationMessage, &service.CreatedAt, &service.UpdatedAt,
		)
		if err != nil {
			continue
		}
		services = append(services, service)
	}
	return services, nil
}

func (s *Store) CreateAPService(ctx context.Context, service *APService) error {
	service.ID = generateUUID()
	service.CreatedAt = NowISO()
	service.UpdatedAt = NowISO()

	_, err := s.DB.ExecContext(ctx, `
		INSERT INTO api_services (
			id, name, slug, upstream_url, route_prefix, health_path,
			upstream_auth_header, upstream_auth_value, internal_token,
			enabled, rpm_limit, monthly_quota, request_timeout_ms,
			created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
	`,
		service.ID, service.Name, service.Slug, service.UpstreamURL,
		service.RoutePrefix, service.HealthPath, service.UpstreamAuthHeader,
		service.UpstreamAuthValue, service.InternalToken, service.Enabled,
		service.RPMLimit, service.MonthlyQuota, service.RequestTimeoutMs,
		service.CreatedAt, service.UpdatedAt,
	)
	return err
}

func (s *Store) UpdateAPService(ctx context.Context, id string, updates map[string]interface{}) error {
	setParts := make([]string, 0)
	args := make([]interface{}, 0)
	argIndex := 1

	for field, value := range updates {
		setParts = append(setParts, fmt.Sprintf("%s = $%d", field, argIndex))
		args = append(args, value)
		argIndex++
	}

	args = append(args, NowISO(), id)

	_, err := s.DB.ExecContext(ctx,
		fmt.Sprintf("UPDATE api_services SET %s, updated_at = $%d WHERE id = $%d",
			strings.Join(setParts, ", "), argIndex, argIndex+1),
		args...,
	)
	return err
}

// APwhy API Key operations
func (s *Store) ListAPIKeys(ctx context.Context) ([]APIKey, error) {
	rows, err := s.DB.QueryContext(ctx, `
		SELECT id, name, key_hash, key_prefix, plan, allowed_service_ids,
			   enabled, rpm_limit, monthly_quota, created_at, updated_at, last_used_at
		FROM api_keys 
		ORDER BY created_at DESC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var keys []APIKey
	for rows.Next() {
		var key APIKey
		err := rows.Scan(
			&key.ID, &key.Name, &key.KeyHash, &key.KeyPrefix, &key.Plan,
			&key.AllowedServiceIDs, &key.Enabled, &key.RPMLimit, &key.MonthlyQuota,
			&key.CreatedAt, &key.UpdatedAt, &key.LastUsedAt,
		)
		if err != nil {
			continue
		}
		keys = append(keys, key)
	}
	return keys, nil
}

func (s *Store) CreateAPIKey(ctx context.Context, key *APIKey) error {
	key.ID = generateUUID()
	key.CreatedAt = NowISO()
	key.UpdatedAt = NowISO()

	_, err := s.DB.ExecContext(ctx, `
		INSERT INTO api_keys (
			id, name, key_hash, key_prefix, plan, allowed_service_ids,
			enabled, rpm_limit, monthly_quota, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
	`,
		key.ID, key.Name, key.KeyHash, key.KeyPrefix, key.Plan,
		key.AllowedServiceIDs, key.Enabled, key.RPMLimit, key.MonthlyQuota,
		key.CreatedAt, key.UpdatedAt,
	)
	return err
}

// Types for APwhy
type APService struct {
	ID                    string  `json:"id"`
	Name                  string  `json:"name"`
	Slug                  string  `json:"slug"`
	UpstreamURL           string  `json:"upstreamUrl"`
	RoutePrefix           string  `json:"routePrefix"`
	HealthPath            string  `json:"healthPath"`
	UpstreamAuthHeader    string  `json:"upstreamAuthHeader"`
	UpstreamAuthValue     string  `json:"upstreamAuthValue"`
	InternalToken         string  `json:"internalToken"`
	Enabled               bool    `json:"enabled"`
	RPMLimit              *int    `json:"rpmLimit"`
	MonthlyQuota          *int    `json:"monthlyQuota"`
	RequestTimeoutMs      *int    `json:"requestTimeoutMs"`
	LastValidationAt      *string `json:"lastValidationAt"`
	LastValidationStatus  *string `json:"lastValidationStatus"`
	LastValidationMessage *string `json:"lastValidationMessage"`
	CreatedAt             string  `json:"createdAt"`
	UpdatedAt             string  `json:"updatedAt"`
}

type APIKey struct {
	ID                string  `json:"id"`
	Name              string  `json:"name"`
	KeyHash           string  `json:"keyHash"`
	KeyPrefix         string  `json:"keyPrefix"`
	Plan              string  `json:"plan"`
	AllowedServiceIDs string  `json:"allowedServiceIds"`
	Enabled           bool    `json:"enabled"`
	RPMLimit          *int    `json:"rpmLimit"`
	MonthlyQuota      *int    `json:"monthlyQuota"`
	CreatedAt         string  `json:"createdAt"`
	UpdatedAt         string  `json:"updatedAt"`
	LastUsedAt        *string `json:"lastUsedAt"`
}
