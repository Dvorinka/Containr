package api

import (
	"net/http"
	"strings"
	"time"

	"containr/internal/database"
	"containr/internal/secrets"

	"github.com/docker/docker/api/types/registry"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// Registry is a stored credential for pulling private images. Password is
// encrypted at rest and never returned — `has_password` signals presence.
type Registry struct {
	ID          uuid.UUID `json:"id"`
	Name        string    `json:"name"`
	Host        string    `json:"host"` // e.g. ghcr.io, registry.example.com; docker.io for Docker Hub
	Username    string    `json:"username"`
	HasPassword bool      `json:"has_password"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type registryRequest struct {
	Name     string `json:"name" binding:"required,min=1,max=255"`
	Host     string `json:"host" binding:"required,min=1,max=255"`
	Username string `json:"username"`
	Password string `json:"password"`
}

func handleListRegistries(c *gin.Context) {
	db, exists := c.Get("db")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database connection not available"})
		return
	}
	userID, _ := c.Get("user_id")
	rows, err := db.(*database.DB).Query(
		`SELECT id, name, host, username, password <> '', created_at, updated_at
		 FROM registries WHERE owner_id = $1 ORDER BY created_at DESC`,
		userID.(string),
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list registries"})
		return
	}
	defer rows.Close()

	registries := []Registry{}
	for rows.Next() {
		var r Registry
		if err := rows.Scan(&r.ID, &r.Name, &r.Host, &r.Username, &r.HasPassword, &r.CreatedAt, &r.UpdatedAt); err == nil {
			registries = append(registries, r)
		}
	}
	c.JSON(http.StatusOK, gin.H{"registries": registries})
}

func handleCreateRegistry(c *gin.Context) {
	db, exists := c.Get("db")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database connection not available"})
		return
	}
	userID, _ := c.Get("user_id")

	var req registryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error(), "code": "VALIDATION"})
		return
	}
	req.Host = strings.ToLower(strings.TrimSpace(req.Host))
	req.Host = strings.TrimPrefix(strings.TrimPrefix(req.Host, "https://"), "http://")
	req.Host = strings.TrimSuffix(req.Host, "/")

	// Encrypt only a real credential — encrypting "" would still satisfy
	// `password <> ''` and report has_password for anonymous registries.
	password := ""
	if req.Password != "" {
		password = secrets.Encrypt(req.Password)
	}
	var r Registry
	err := db.(*database.DB).QueryRow(
		`INSERT INTO registries (owner_id, name, host, username, password)
		 VALUES ($1, $2, $3, $4, $5)
		 RETURNING id, name, host, username, password <> '', created_at, updated_at`,
		userID.(string), req.Name, req.Host, req.Username, password,
	).Scan(&r.ID, &r.Name, &r.Host, &r.Username, &r.HasPassword, &r.CreatedAt, &r.UpdatedAt)
	if err != nil {
		if strings.Contains(err.Error(), "unique") {
			c.JSON(http.StatusConflict, gin.H{"error": "A registry for this host already exists", "code": "CONFLICT"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create registry"})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"registry": r})
}

func handleUpdateRegistry(c *gin.Context) {
	db, exists := c.Get("db")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database connection not available"})
		return
	}
	userID, _ := c.Get("user_id")
	registryID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid registry ID", "code": "VALIDATION"})
		return
	}

	var req registryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error(), "code": "VALIDATION"})
		return
	}
	req.Host = strings.ToLower(strings.TrimSpace(req.Host))
	req.Host = strings.TrimPrefix(strings.TrimPrefix(req.Host, "https://"), "http://")
	req.Host = strings.TrimSuffix(req.Host, "/")

	// Empty password keeps the stored credential — there is no "clear"
	// operation; delete + recreate to remove a password.
	var passwordArg interface{}
	if req.Password != "" {
		passwordArg = secrets.Encrypt(req.Password)
	}

	var r Registry
	err = db.(*database.DB).QueryRow(
		`UPDATE registries SET name = $1, host = $2, username = $3,
				password = COALESCE($4, password), updated_at = now()
		 WHERE id = $5 AND owner_id = $6
		 RETURNING id, name, host, username, password <> '', created_at, updated_at`,
		req.Name, req.Host, req.Username, passwordArg, registryID, userID.(string),
	).Scan(&r.ID, &r.Name, &r.Host, &r.Username, &r.HasPassword, &r.CreatedAt, &r.UpdatedAt)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Registry not found", "code": "NOT_FOUND"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"registry": r})
}

func handleDeleteRegistry(c *gin.Context) {
	db, exists := c.Get("db")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database connection not available"})
		return
	}
	userID, _ := c.Get("user_id")
	registryID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid registry ID", "code": "VALIDATION"})
		return
	}
	res, err := db.(*database.DB).Exec(
		`DELETE FROM registries WHERE id = $1 AND owner_id = $2`,
		registryID, userID.(string),
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete registry"})
		return
	}
	if n, _ := res.RowsAffected(); n == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Registry not found", "code": "NOT_FOUND"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Registry deleted"})
}

// registryAuthFor resolves pull credentials for an image reference: the
// caller's registry whose host matches, else anonymous. docker.io covers
// bare image names (nginx:latest).
func registryAuthFor(db *database.DB, ownerID, imageRef string) registry.AuthConfig {
	host := registryHost(imageRef)
	var username, password string
	err := db.QueryRow(
		`SELECT username, password FROM registries WHERE owner_id = $1 AND host = $2`,
		ownerID, host,
	).Scan(&username, &password)
	if err != nil {
		return registry.AuthConfig{}
	}
	return registry.AuthConfig{
		Username:      username,
		Password:      secrets.Decrypt(password),
		ServerAddress: host,
	}
}
