package api

import (
	"context"
	"crypto/tls"
	"database/sql"
	"errors"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"strings"
	"time"

	"containr/internal/database/sqlcdb"
	"containr/internal/secrets"

	"github.com/gin-gonic/gin"
	"github.com/go-redis/redis/v8"
)

// externalDatabaseRequest is the shared payload for registering an external
// database and for ad-hoc connection tests.
type externalDatabaseRequest struct {
	Name     string `json:"name"`
	Type     string `json:"type" binding:"required"`
	Host     string `json:"host" binding:"required"`
	Port     int    `json:"port"`
	Database string `json:"database"`
	Username string `json:"username"`
	Password string `json:"password"`
	SSL      bool   `json:"ssl"`
}

var externalDefaultPorts = map[string]int{
	"postgresql": 5432,
	"mysql":      3306,
	"mariadb":    3306,
	"mongodb":    27017,
	"redis":      6379,
	"dragonfly":  6379,
	"clickhouse": 9000,
}

// externalConnectionURL composes a DSN for display/bind use. The password is
// embedded only on privileged reads — the value is decrypted at that point.
func externalConnectionURL(dbType string, ext *DatabaseExternalRef, password string) string {
	host := net.JoinHostPort(ext.Host, fmt.Sprintf("%d", ext.Port))
	creds := ""
	if ext.Username != "" {
		creds = url.QueryEscape(ext.Username)
		if password != "" {
			creds += ":" + url.QueryEscape(password)
		}
		creds += "@"
	}
	switch dbType {
	case "postgresql":
		u := fmt.Sprintf("postgres://%s%s/%s", creds, host, ext.Database)
		if ext.SSL {
			u += "?sslmode=require"
		}
		return u
	case "mysql", "mariadb":
		return fmt.Sprintf("mysql://%s%s/%s", creds, host, ext.Database)
	case "mongodb":
		u := fmt.Sprintf("mongodb://%s%s/%s", creds, host, ext.Database)
		if ext.SSL {
			u += "?tls=true"
		}
		return u
	case "redis", "dragonfly":
		scheme := "redis"
		if ext.SSL {
			scheme = "rediss"
		}
		// Redis auth is password-only; username support is ACL-era.
		if password != "" {
			creds = ":" + url.QueryEscape(password) + "@"
			if ext.Username != "" {
				creds = url.QueryEscape(ext.Username) + creds
			}
		}
		return fmt.Sprintf("%s://%s%s", scheme, creds, host)
	case "clickhouse":
		return fmt.Sprintf("clickhouse://%s%s/%s", creds, host, ext.Database)
	}
	return fmt.Sprintf("%s://%s%s", dbType, creds, host)
}

// probeExternalDatabase verifies reachability. postgres and redis-family get
// real protocol checks via the vendored drivers; everything else gets a TCP
// dial — enough to catch typos and firewall issues without new dependencies.
func probeExternalDatabase(ctx context.Context, req externalDatabaseRequest) (time.Duration, error) {
	addr := net.JoinHostPort(req.Host, fmt.Sprintf("%d", req.Port))
	dialer := &net.Dialer{Timeout: 5 * time.Second}
	start := time.Now()

	switch req.Type {
	case "postgresql":
		sslmode := "disable"
		if req.SSL {
			sslmode = "require"
		}
		dsn := fmt.Sprintf("postgres://%s:%s@%s/%s?sslmode=%s&connect_timeout=5",
			url.QueryEscape(req.Username), url.QueryEscape(req.Password), addr,
			url.QueryEscape(req.Database), sslmode)
		conn, err := sql.Open("postgres", dsn)
		if err != nil {
			return 0, err
		}
		defer conn.Close()
		if err := conn.PingContext(ctx); err != nil {
			return 0, err
		}
	case "redis", "dragonfly":
		client := redis.NewClient(&redis.Options{
			Addr:        addr,
			Username:    req.Username,
			Password:    req.Password,
			DialTimeout: 5 * time.Second,
			ReadTimeout: 5 * time.Second,
			TLSConfig:   redisTLSConfig(req.SSL, req.Host),
		})
		defer client.Close()
		if err := client.Ping(ctx).Err(); err != nil {
			return 0, err
		}
	default:
		conn, err := dialer.DialContext(ctx, "tcp", addr)
		if err != nil {
			return 0, err
		}
		conn.Close()
	}
	return time.Since(start), nil
}

func redisTLSConfig(enabled bool, host string) *tls.Config {
	if !enabled {
		return nil
	}
	return &tls.Config{ServerName: host, MinVersion: tls.VersionTLS12}
}

// handleTestDatabaseConnection probes arbitrary connection parameters — used
// by the register form's "test" button and by agents before registering.
func (h *DatabaseHandler) TestDatabaseConnection(c *gin.Context) {
	if _, ok := requireAuthenticatedUserID(c); !ok {
		return
	}
	var req externalDatabaseRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error(), "code": "VALIDATION"})
		return
	}
	if err := normalizeExternalRequest(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error(), "code": "VALIDATION"})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()
	latency, err := probeExternalDatabase(ctx, req)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"ok": false, "error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true, "latency_ms": latency.Milliseconds()})
}

// TestDatabaseConnectionByID re-probes a registered external database using
// its stored (decrypted) credentials.
func (h *DatabaseHandler) TestDatabaseConnectionByID(c *gin.Context) {
	userID, ok := requireAuthenticatedUserID(c)
	if !ok {
		return
	}
	databaseID := c.Param("id")
	userID = h.effectiveUserID(c, userID, databaseID)

	row, err := h.queries.GetDatabaseServiceByIDAndUser(c.Request.Context(), sqlcdb.GetDatabaseServiceByIDAndUserParams{
		ID:     databaseID,
		UserID: userID,
	})
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			c.JSON(http.StatusNotFound, gin.H{"error": "Database not found", "code": "NOT_FOUND"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch database"})
		return
	}
	if row.Provider != "external" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "test-connection applies to external databases", "code": "VALIDATION"})
		return
	}

	req := externalDatabaseRequest{
		Type:     row.Type,
		Host:     databaseNullString(row.ExternalHost),
		Port:     int(row.ExternalPort.Int32),
		Database: databaseNullString(row.ExternalName),
		Username: databaseNullString(row.ExternalUsername),
		Password: secrets.Decrypt(row.ExternalPassword),
		SSL:      row.ExternalSsl,
	}
	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()
	latency, probeErr := probeExternalDatabase(ctx, req)
	if probeErr != nil {
		c.JSON(http.StatusOK, gin.H{"ok": false, "error": probeErr.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true, "latency_ms": latency.Milliseconds()})
}

func normalizeExternalRequest(req *externalDatabaseRequest) error {
	req.Type = normalizeDatabaseType(req.Type)
	if _, ok := supportedDatabaseTypes[req.Type]; !ok {
		return fmt.Errorf("%w: %s", errUnsupportedDatabaseType, req.Type)
	}
	req.Host = strings.TrimSpace(req.Host)
	if req.Host == "" {
		return errors.New("host is required")
	}
	if req.Port <= 0 {
		req.Port = externalDefaultPorts[req.Type]
	}
	if req.Port <= 0 || req.Port > 65535 {
		return errors.New("port must be 1-65535")
	}
	return nil
}

// RegisterExternalDatabase records a database hosted elsewhere — same list,
// same bind surface, no container. The connection is probed first so typos
// fail at registration, not at the first service bind.
func (h *DatabaseHandler) RegisterExternalDatabase(c *gin.Context) {
	userID, ok := requireAuthenticatedUserID(c)
	if !ok {
		return
	}
	var req externalDatabaseRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error(), "code": "VALIDATION"})
		return
	}
	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "name is required", "code": "VALIDATION"})
		return
	}
	if err := normalizeExternalRequest(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error(), "code": "VALIDATION"})
		return
	}

	probeCtx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()
	if _, err := probeExternalDatabase(probeCtx, req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": fmt.Sprintf("Connection check failed: %v", err),
			"code":  "DEPENDENCY_UNAVAILABLE",
		})
		return
	}

	count, err := h.queries.CountDatabaseServicesByUserAndName(c.Request.Context(), sqlcdb.CountDatabaseServicesByUserAndNameParams{
		UserID: userID,
		Name:   req.Name,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to validate database name"})
		return
	}
	if count > 0 {
		c.JSON(http.StatusConflict, gin.H{"error": "database name already exists", "code": "CONFLICT"})
		return
	}

	databaseID := generateDatabaseID(req.Name)
	now := sql.NullTime{Time: time.Now(), Valid: true}
	encPassword := ""
	if req.Password != "" {
		encPassword = secrets.Encrypt(req.Password)
	}
	if err := h.queries.CreateExternalDatabaseService(c.Request.Context(), sqlcdb.CreateExternalDatabaseServiceParams{
		ID:               databaseID,
		UserID:           userID,
		Name:             req.Name,
		Type:             req.Type,
		Version:          "",
		Plan:             "external",
		Region:           "external",
		ExternalHost:     sql.NullString{String: req.Host, Valid: true},
		ExternalPort:     sql.NullInt32{Int32: int32(req.Port), Valid: true},
		ExternalName:     sql.NullString{String: req.Database, Valid: req.Database != ""},
		ExternalUsername: sql.NullString{String: req.Username, Valid: req.Username != ""},
		ExternalPassword: encPassword,
		ExternalSsl:      req.SSL,
		CreatedAt:        now,
		UpdatedAt:        now,
	}); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to register database"})
		return
	}

	LogAudit(userID, "database", databaseID, "register-external", map[string]interface{}{
		"name": req.Name,
		"type": req.Type,
		"host": req.Host,
	})
	c.JSON(http.StatusCreated, gin.H{
		"id":      databaseID,
		"message": "External database registered",
		"status":  "running",
	})
}
