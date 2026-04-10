package api

import (
	"containr/internal/database"
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"encoding/pem"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

// GitProvider represents a Git provider configuration per user.
type GitProvider struct {
	ID          string    `json:"id" db:"id"`
	Name        string    `json:"name" db:"name"` // github, gitlab, bitbucket, gitea, github_app
	DisplayName string    `json:"display_name" db:"display_name"`
	APIUrl      string    `json:"api_url" db:"api_url"`
	WebhookUrl  string    `json:"webhook_url" db:"webhook_url"`
	UserID      string    `json:"user_id" db:"user_id"`
	AccessToken string    `json:"-" db:"access_token"` // Hidden in JSON responses
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time `json:"updated_at" db:"updated_at"`
}

// GitRepository represents a connected Git repository
type GitRepository struct {
	ID            string    `json:"id" db:"id"`
	ProviderID    string    `json:"provider_id" db:"provider_id"`
	Name          string    `json:"name" db:"name"`
	FullName      string    `json:"full_name" db:"full_name"`
	Description   string    `json:"description" db:"description"`
	CloneURL      string    `json:"clone_url" db:"clone_url"`
	WebhookURL    string    `json:"webhook_url" db:"webhook_url"`
	DefaultBranch string    `json:"default_branch" db:"default_branch"`
	IsPrivate     bool      `json:"is_private" db:"is_private"`
	UserID        string    `json:"user_id" db:"user_id"`
	CreatedAt     time.Time `json:"created_at" db:"created_at"`
	UpdatedAt     time.Time `json:"updated_at" db:"updated_at"`
}

// GitWebhook represents a webhook configuration
type GitWebhook struct {
	ID         string    `json:"id" db:"id"`
	RepoID     string    `json:"repo_id" db:"repo_id"`
	ProviderID string    `json:"provider_id" db:"provider_id"`
	Events     string    `json:"events" db:"events"`    // JSON array of events
	Secret     string    `json:"-" db:"webhook_secret"` // Hidden in JSON responses
	Active     bool      `json:"active" db:"active"`
	CreatedAt  time.Time `json:"created_at" db:"created_at"`
	UpdatedAt  time.Time `json:"updated_at" db:"updated_at"`
}

// CreateGitProviderRequest represents a request to create a Git provider
type CreateGitProviderRequest struct {
	Name        string `json:"name" binding:"required,oneof=github gitlab bitbucket gitea github_app"`
	DisplayName string `json:"display_name" binding:"required"`
	AccessToken string `json:"access_token" binding:"required"`
	APIUrl      string `json:"api_url,omitempty"`
}

type ConnectGitHubAppRequest struct {
	InstallationID int64  `json:"installation_id" binding:"required,gt=0"`
	DisplayName    string `json:"display_name,omitempty"`
}

// CreateGitRepoRequest represents a request to connect a Git repository
type CreateGitRepoRequest struct {
	ProviderID   string `json:"provider_id" binding:"required"`
	RepoFullName string `json:"repo_full_name" binding:"required"`
}

// CreateWebhookRequest represents a request to create a webhook
type CreateWebhookRequest struct {
	RepoID string   `json:"repo_id" binding:"required"`
	Events []string `json:"events" binding:"required"`
	Branch string   `json:"branch"`
}

func handleGetGitProviders(c *gin.Context) {
	ctx, ok := requireGitRequestContext(c)
	if !ok {
		return
	}

	rows, err := ctx.db.Query(`
		SELECT id, name, display_name, api_url, webhook_url, user_id, created_at, updated_at
		FROM git_providers
		WHERE user_id = $1
		ORDER BY created_at DESC
	`, ctx.userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}
	defer rows.Close()

	providers := make([]GitProvider, 0)
	for rows.Next() {
		var provider GitProvider
		if err := rows.Scan(
			&provider.ID,
			&provider.Name,
			&provider.DisplayName,
			&provider.APIUrl,
			&provider.WebhookUrl,
			&provider.UserID,
			&provider.CreatedAt,
			&provider.UpdatedAt,
		); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
			return
		}
		providers = append(providers, provider)
	}

	c.JSON(http.StatusOK, gin.H{"providers": providers})
}

func handleGetGitHubAppInstallURL(c *gin.Context) {
	slug := strings.TrimSpace(os.Getenv("GITHUB_APP_SLUG"))
	if slug == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "GITHUB_APP_SLUG is not configured"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"install_url": fmt.Sprintf("https://github.com/apps/%s/installations/new", slug),
	})
}

func handleConnectGitHubApp(c *gin.Context) {
	ctx, ok := requireGitRequestContext(c)
	if !ok {
		return
	}

	var req ConnectGitHubAppRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	displayName := strings.TrimSpace(req.DisplayName)
	if displayName == "" {
		displayName = fmt.Sprintf("GitHub App #%d", req.InstallationID)
	}

	provider := GitProvider{
		ID:          uuid.NewString(),
		Name:        "github_app",
		DisplayName: displayName,
		APIUrl:      strings.TrimSpace(getenvOrDefault("GITHUB_APP_BASE_URL", "https://api.github.com")),
		WebhookUrl:  "https://github.com",
		AccessToken: strconv.FormatInt(req.InstallationID, 10),
		UserID:      ctx.userID,
	}

	if err := ctx.db.QueryRow(`
		INSERT INTO git_providers (id, name, display_name, api_url, webhook_url, access_token, user_id, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
		ON CONFLICT (name, user_id)
		DO UPDATE SET
			display_name = EXCLUDED.display_name,
			api_url = EXCLUDED.api_url,
			webhook_url = EXCLUDED.webhook_url,
			access_token = EXCLUDED.access_token,
			updated_at = NOW()
		RETURNING id, created_at, updated_at
	`, provider.ID, provider.Name, provider.DisplayName, provider.APIUrl, provider.WebhookUrl, provider.AccessToken, provider.UserID).Scan(&provider.ID, &provider.CreatedAt, &provider.UpdatedAt); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to connect GitHub App installation"})
		return
	}

	provider.AccessToken = ""
	c.JSON(http.StatusOK, gin.H{
		"message":  "GitHub App connected",
		"provider": provider,
	})
}

func handleCreateGitProvider(c *gin.Context) {
	ctx, ok := requireGitRequestContext(c)
	if !ok {
		return
	}

	var req CreateGitProviderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	req.Name = strings.ToLower(strings.TrimSpace(req.Name))
	req.DisplayName = strings.TrimSpace(req.DisplayName)
	req.AccessToken = strings.TrimSpace(req.AccessToken)
	req.APIUrl = strings.TrimSpace(req.APIUrl)

	if !validateGitToken(req.Name, req.AccessToken) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid access token for " + req.Name})
		return
	}

	provider := GitProvider{
		ID:          uuid.NewString(),
		Name:        req.Name,
		DisplayName: req.DisplayName,
		AccessToken: req.AccessToken,
		UserID:      ctx.userID,
	}

	switch req.Name {
	case "github":
		provider.APIUrl = "https://api.github.com"
		provider.WebhookUrl = "https://api.github.com"
	case "gitlab":
		provider.APIUrl = req.APIUrl
		if provider.APIUrl == "" {
			provider.APIUrl = strings.TrimSpace(getenvOrDefault("GITLAB_API_URL", "https://gitlab.com/api/v4"))
		}
		provider.APIUrl = strings.TrimSuffix(provider.APIUrl, "/")
		provider.WebhookUrl = strings.TrimSpace(getenvOrDefault("GITLAB_BASE_URL", "https://gitlab.com"))
	case "bitbucket":
		provider.APIUrl = req.APIUrl
		if provider.APIUrl == "" {
			provider.APIUrl = strings.TrimSpace(getenvOrDefault("BITBUCKET_API_URL", "https://api.bitbucket.org/2.0"))
		}
		provider.APIUrl = strings.TrimSuffix(provider.APIUrl, "/")
		provider.WebhookUrl = strings.TrimSpace(getenvOrDefault("BITBUCKET_BASE_URL", "https://bitbucket.org"))
	case "gitea":
		provider.APIUrl = req.APIUrl
		if provider.APIUrl == "" {
			provider.APIUrl = strings.TrimSpace(getenvOrDefault("GITEA_BASE_URL", "https://gitea.example.com"))
		}
		provider.APIUrl = strings.TrimSuffix(provider.APIUrl, "/")
		provider.WebhookUrl = provider.APIUrl
	case "github_app":
		provider.APIUrl = strings.TrimSpace(getenvOrDefault("GITHUB_APP_BASE_URL", "https://api.github.com"))
		provider.WebhookUrl = "https://github.com"
	default:
		c.JSON(http.StatusBadRequest, gin.H{"error": "Unsupported provider"})
		return
	}

	if _, err := ctx.db.Exec(`
		INSERT INTO git_providers (id, name, display_name, api_url, webhook_url, access_token, user_id, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
	`, provider.ID, provider.Name, provider.DisplayName, provider.APIUrl, provider.WebhookUrl, provider.AccessToken, provider.UserID); err != nil {
		if isUniqueConstraintError(err) {
			c.JSON(http.StatusConflict, gin.H{"error": "Provider already connected for this account"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create Git provider"})
		return
	}

	if err := ctx.db.QueryRow(`
		SELECT created_at, updated_at
		FROM git_providers
		WHERE id = $1
	`, provider.ID).Scan(&provider.CreatedAt, &provider.UpdatedAt); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to read created provider"})
		return
	}

	provider.AccessToken = ""
	c.JSON(http.StatusCreated, provider)
}

func handleGetGitRepositories(c *gin.Context) {
	ctx, ok := requireGitRequestContext(c)
	if !ok {
		return
	}

	providerID := strings.TrimSpace(c.Param("providerId"))
	if _, err := uuid.Parse(providerID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid provider ID"})
		return
	}

	var providerName, providerDisplayName, providerAccessToken, providerAPIURL string
	err := ctx.db.QueryRow(`
		SELECT name, display_name, access_token, api_url
		FROM git_providers
		WHERE id = $1 AND user_id = $2
	`, providerID, ctx.userID).Scan(&providerName, &providerDisplayName, &providerAccessToken, &providerAPIURL)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			c.JSON(http.StatusNotFound, gin.H{"error": "Provider not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}

	if c.DefaultQuery("sync", "1") != "0" {
		if syncErr := syncProviderRepositories(ctx.db, providerID, ctx.userID, providerName, providerAPIURL, providerAccessToken); syncErr != nil {
			log.Printf("Git repository sync failed for provider %s (%s): %v", providerName, providerID, syncErr)
		}
	}

	page := positiveIntOrDefault(c.DefaultQuery("page", "1"), 1)
	limit := positiveIntOrDefault(c.DefaultQuery("limit", "20"), 20)
	if limit > 100 {
		limit = 100
	}
	offset := (page - 1) * limit
	search := strings.TrimSpace(c.Query("search"))
	searchNullable := sql.NullString{String: search, Valid: search != ""}

	rows, err := ctx.db.Query(`
		SELECT id, provider_id, name, full_name, COALESCE(description, ''), clone_url, COALESCE(webhook_url, ''),
			   default_branch, is_private, user_id, created_at, updated_at
		FROM git_repositories
		WHERE provider_id = $1 AND user_id = $2
		  AND ($3::text IS NULL OR full_name ILIKE ('%' || $3::text || '%') OR name ILIKE ('%' || $3::text || '%'))
		ORDER BY updated_at DESC
		LIMIT $4 OFFSET $5
	`, providerID, ctx.userID, searchNullable, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}
	defer rows.Close()

	repositories := make([]GitRepository, 0)
	for rows.Next() {
		var repo GitRepository
		if err := rows.Scan(
			&repo.ID,
			&repo.ProviderID,
			&repo.Name,
			&repo.FullName,
			&repo.Description,
			&repo.CloneURL,
			&repo.WebhookURL,
			&repo.DefaultBranch,
			&repo.IsPrivate,
			&repo.UserID,
			&repo.CreatedAt,
			&repo.UpdatedAt,
		); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
			return
		}
		repositories = append(repositories, repo)
	}

	var total int
	if err := ctx.db.QueryRow(`
		SELECT COUNT(*)
		FROM git_repositories
		WHERE provider_id = $1 AND user_id = $2
		  AND ($3::text IS NULL OR full_name ILIKE ('%' || $3::text || '%') OR name ILIKE ('%' || $3::text || '%'))
	`, providerID, ctx.userID, searchNullable).Scan(&total); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"provider": gin.H{
			"id":           providerID,
			"name":         providerName,
			"display_name": providerDisplayName,
		},
		"repositories": repositories,
		"pagination": gin.H{
			"page":  page,
			"limit": limit,
			"total": total,
		},
	})
}

func handleConnectGitRepository(c *gin.Context) {
	ctx, ok := requireGitRequestContext(c)
	if !ok {
		return
	}

	var req CreateGitRepoRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	providerID := strings.TrimSpace(req.ProviderID)
	if _, err := uuid.Parse(providerID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid provider ID"})
		return
	}

	var providerName string
	err := ctx.db.QueryRow(`
		SELECT name
		FROM git_providers
		WHERE id = $1 AND user_id = $2
	`, providerID, ctx.userID).Scan(&providerName)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			c.JSON(http.StatusNotFound, gin.H{"error": "Provider not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}

	repoName, fullName, err := normalizeRepositoryFullName(req.RepoFullName)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var existing GitRepository
	err = ctx.db.QueryRow(`
		SELECT id, provider_id, name, full_name, COALESCE(description, ''), clone_url, COALESCE(webhook_url, ''),
			   default_branch, is_private, user_id, created_at, updated_at
		FROM git_repositories
		WHERE provider_id = $1 AND full_name = $2 AND user_id = $3
	`, providerID, fullName, ctx.userID).Scan(
		&existing.ID,
		&existing.ProviderID,
		&existing.Name,
		&existing.FullName,
		&existing.Description,
		&existing.CloneURL,
		&existing.WebhookURL,
		&existing.DefaultBranch,
		&existing.IsPrivate,
		&existing.UserID,
		&existing.CreatedAt,
		&existing.UpdatedAt,
	)
	switch {
	case err == nil:
		c.JSON(http.StatusOK, gin.H{
			"message":    "Repository already connected",
			"repository": existing,
		})
		return
	case !errors.Is(err, sql.ErrNoRows):
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}

	repo := GitRepository{
		ID:            uuid.NewString(),
		ProviderID:    providerID,
		Name:          repoName,
		FullName:      fullName,
		Description:   "",
		CloneURL:      deriveCloneURL(providerName, fullName),
		DefaultBranch: "main",
		IsPrivate:     false,
		UserID:        ctx.userID,
	}

	if err := ctx.db.QueryRow(`
		INSERT INTO git_repositories (
			id, provider_id, name, full_name, description, clone_url, default_branch, is_private, user_id, created_at, updated_at
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
		RETURNING created_at, updated_at
	`, repo.ID, repo.ProviderID, repo.Name, repo.FullName, repo.Description, repo.CloneURL, repo.DefaultBranch, repo.IsPrivate, repo.UserID).Scan(&repo.CreatedAt, &repo.UpdatedAt); err != nil {
		if isUniqueConstraintError(err) {
			c.JSON(http.StatusConflict, gin.H{"error": "Repository is already connected"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to connect repository"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message":    "Repository connected successfully",
		"repository": repo,
	})
}

func handleCreateWebhook(c *gin.Context) {
	ctx, ok := requireGitRequestContext(c)
	if !ok {
		return
	}

	var req CreateWebhookRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if len(req.Events) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "events cannot be empty"})
		return
	}

	repoID := strings.TrimSpace(req.RepoID)
	if _, err := uuid.Parse(repoID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid repository ID"})
		return
	}

	var providerID string
	err := ctx.db.QueryRow(`
		SELECT provider_id
		FROM git_repositories
		WHERE id = $1 AND user_id = $2
	`, repoID, ctx.userID).Scan(&providerID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			c.JSON(http.StatusNotFound, gin.H{"error": "Repository not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}

	eventsJSON, err := json.Marshal(req.Events)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid events payload"})
		return
	}

	secret, err := generateWebhookSecret()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate webhook secret"})
		return
	}

	webhook := GitWebhook{
		ID:         uuid.NewString(),
		RepoID:     repoID,
		ProviderID: providerID,
		Events:     string(eventsJSON),
		Secret:     secret,
		Active:     true,
	}

	if err := ctx.db.QueryRow(`
		INSERT INTO git_webhooks (
			id, repo_id, provider_id, events, webhook_secret, active, branch_filter, created_at, updated_at
		)
		VALUES ($1, $2, $3, $4, $5, TRUE, $6, NOW(), NOW())
		ON CONFLICT (repo_id, provider_id)
		DO UPDATE SET
			events = EXCLUDED.events,
			webhook_secret = EXCLUDED.webhook_secret,
			active = TRUE,
			branch_filter = EXCLUDED.branch_filter,
			updated_at = NOW()
		RETURNING id, active, created_at, updated_at
	`, webhook.ID, webhook.RepoID, webhook.ProviderID, webhook.Events, webhook.Secret, strings.TrimSpace(req.Branch)).Scan(&webhook.ID, &webhook.Active, &webhook.CreatedAt, &webhook.UpdatedAt); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to configure webhook"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Webhook configured successfully",
		"webhook": gin.H{
			"id":          webhook.ID,
			"repo_id":     webhook.RepoID,
			"provider_id": webhook.ProviderID,
			"events":      req.Events,
			"branch":      strings.TrimSpace(req.Branch),
			"active":      webhook.Active,
			"created_at":  webhook.CreatedAt,
			"updated_at":  webhook.UpdatedAt,
		},
	})
}

func handleGetConnectedRepositories(c *gin.Context) {
	ctx, ok := requireGitRequestContext(c)
	if !ok {
		return
	}

	page := positiveIntOrDefault(c.DefaultQuery("page", "1"), 1)
	limit := positiveIntOrDefault(c.DefaultQuery("limit", "10"), 10)
	if limit > 100 {
		limit = 100
	}
	offset := (page - 1) * limit

	rows, err := ctx.db.Query(`
		SELECT r.id, r.provider_id, r.name, r.full_name, COALESCE(r.description, ''), r.clone_url,
			   r.default_branch, r.is_private, r.user_id, r.created_at, r.updated_at,
			   p.name as provider_name, p.display_name
		FROM git_repositories r
		JOIN git_providers p ON r.provider_id = p.id
		WHERE r.user_id = $1
		ORDER BY r.updated_at DESC
		LIMIT $2 OFFSET $3
	`, ctx.userID, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}
	defer rows.Close()

	repositories := make([]map[string]interface{}, 0)
	for rows.Next() {
		var repo GitRepository
		var providerName, providerDisplayName string
		if err := rows.Scan(
			&repo.ID,
			&repo.ProviderID,
			&repo.Name,
			&repo.FullName,
			&repo.Description,
			&repo.CloneURL,
			&repo.DefaultBranch,
			&repo.IsPrivate,
			&repo.UserID,
			&repo.CreatedAt,
			&repo.UpdatedAt,
			&providerName,
			&providerDisplayName,
		); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
			return
		}

		repositories = append(repositories, map[string]interface{}{
			"id":             repo.ID,
			"provider_id":    repo.ProviderID,
			"name":           repo.Name,
			"full_name":      repo.FullName,
			"description":    repo.Description,
			"clone_url":      repo.CloneURL,
			"default_branch": repo.DefaultBranch,
			"is_private":     repo.IsPrivate,
			"created_at":     repo.CreatedAt,
			"updated_at":     repo.UpdatedAt,
			"provider": map[string]string{
				"name":         providerName,
				"display_name": providerDisplayName,
			},
		})
	}

	var total int
	if err := ctx.db.QueryRow(`
		SELECT COUNT(*)
		FROM git_repositories
		WHERE user_id = $1
	`, ctx.userID).Scan(&total); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"repositories": repositories,
		"pagination": gin.H{
			"page":  page,
			"limit": limit,
			"total": total,
		},
	})
}

type remoteGitRepository struct {
	Name          string
	FullName      string
	Description   string
	CloneURL      string
	DefaultBranch string
	IsPrivate     bool
}

func syncProviderRepositories(db *database.DB, providerID, userID, providerName, providerAPIURL, accessToken string) error {
	repositories, err := fetchProviderRepositories(providerName, providerAPIURL, accessToken)
	if err != nil {
		return err
	}

	for _, repository := range repositories {
		if strings.TrimSpace(repository.FullName) == "" || strings.TrimSpace(repository.Name) == "" {
			continue
		}

		cloneURL := strings.TrimSpace(repository.CloneURL)
		if cloneURL == "" {
			cloneURL = deriveCloneURL(providerName, repository.FullName)
		}

		defaultBranch := strings.TrimSpace(repository.DefaultBranch)
		if defaultBranch == "" {
			defaultBranch = "main"
		}

		_, err := db.Exec(`
			INSERT INTO git_repositories (
				id, provider_id, name, full_name, description, clone_url, default_branch, is_private, user_id, created_at, updated_at
			)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
			ON CONFLICT (provider_id, full_name)
			DO UPDATE SET
				name = EXCLUDED.name,
				description = EXCLUDED.description,
				clone_url = EXCLUDED.clone_url,
				default_branch = EXCLUDED.default_branch,
				is_private = EXCLUDED.is_private,
				updated_at = NOW()
		`, uuid.NewString(), providerID, repository.Name, repository.FullName, repository.Description, cloneURL, defaultBranch, repository.IsPrivate, userID)
		if err != nil {
			return err
		}
	}

	return nil
}

func fetchProviderRepositories(providerName, providerAPIURL, accessToken string) ([]remoteGitRepository, error) {
	switch strings.ToLower(strings.TrimSpace(providerName)) {
	case "github":
		return fetchGitHubRepositories(providerAPIURL, accessToken)
	case "github_app":
		return fetchGitHubAppRepositories(providerAPIURL, accessToken)
	case "gitlab":
		return fetchGitLabRepositories(providerAPIURL, accessToken)
	case "bitbucket":
		return fetchBitbucketRepositories(providerAPIURL, accessToken)
	case "gitea":
		return fetchGiteaRepositories(providerAPIURL, accessToken)
	default:
		return nil, nil
	}
}

func fetchGitHubRepositories(providerAPIURL, accessToken string) ([]remoteGitRepository, error) {
	if strings.TrimSpace(accessToken) == "" {
		return nil, fmt.Errorf("github access token is missing")
	}

	baseURL := strings.TrimSpace(providerAPIURL)
	if baseURL == "" {
		baseURL = "https://api.github.com"
	}
	baseURL = strings.TrimSuffix(baseURL, "/")

	request, err := http.NewRequest(http.MethodGet, baseURL+"/user/repos?per_page=100&sort=updated", nil)
	if err != nil {
		return nil, err
	}

	request.Header.Set("Accept", "application/vnd.github+json")
	request.Header.Set("Authorization", "Bearer "+strings.TrimSpace(accessToken))

	client := &http.Client{Timeout: 10 * time.Second}
	response, err := client.Do(request)
	if err != nil {
		return nil, err
	}
	defer response.Body.Close()

	if response.StatusCode != http.StatusOK {
		payload, _ := io.ReadAll(io.LimitReader(response.Body, 2048))
		return nil, fmt.Errorf("github repos request failed with status %d: %s", response.StatusCode, strings.TrimSpace(string(payload)))
	}

	var rows []map[string]interface{}
	if err := json.NewDecoder(response.Body).Decode(&rows); err != nil {
		return nil, err
	}

	result := make([]remoteGitRepository, 0, len(rows))
	for _, row := range rows {
		fullName := asGitString(row["full_name"])
		name := asGitString(row["name"])
		if fullName == "" || name == "" {
			continue
		}
		result = append(result, remoteGitRepository{
			Name:          name,
			FullName:      fullName,
			Description:   asGitString(row["description"]),
			CloneURL:      asGitString(row["clone_url"]),
			DefaultBranch: asGitString(row["default_branch"]),
			IsPrivate:     asBoolValue(row["private"]),
		})
	}

	return result, nil
}

func fetchGitHubAppRepositories(providerAPIURL, installationIDRaw string) ([]remoteGitRepository, error) {
	installationID, err := strconv.ParseInt(strings.TrimSpace(installationIDRaw), 10, 64)
	if err != nil || installationID <= 0 {
		return nil, fmt.Errorf("github_app installation id is invalid")
	}

	baseURL := strings.TrimSpace(providerAPIURL)
	if baseURL == "" {
		baseURL = strings.TrimSpace(getenvOrDefault("GITHUB_APP_BASE_URL", "https://api.github.com"))
	}
	baseURL = strings.TrimSuffix(baseURL, "/")

	token, err := getGitHubAppInstallationToken(baseURL, installationID)
	if err != nil {
		return nil, err
	}

	request, err := http.NewRequest(http.MethodGet, fmt.Sprintf("%s/installation/repositories?per_page=100", baseURL), nil)
	if err != nil {
		return nil, err
	}
	request.Header.Set("Accept", "application/vnd.github+json")
	request.Header.Set("Authorization", "Bearer "+token)

	client := &http.Client{Timeout: 10 * time.Second}
	response, err := client.Do(request)
	if err != nil {
		return nil, err
	}
	defer response.Body.Close()

	if response.StatusCode != http.StatusOK {
		payload, _ := io.ReadAll(io.LimitReader(response.Body, 2048))
		return nil, fmt.Errorf("github app repos request failed with status %d: %s", response.StatusCode, strings.TrimSpace(string(payload)))
	}

	var wrapper struct {
		Repositories []map[string]interface{} `json:"repositories"`
	}
	if err := json.NewDecoder(response.Body).Decode(&wrapper); err != nil {
		return nil, err
	}

	result := make([]remoteGitRepository, 0, len(wrapper.Repositories))
	for _, row := range wrapper.Repositories {
		fullName := asGitString(row["full_name"])
		name := asGitString(row["name"])
		if fullName == "" || name == "" {
			continue
		}
		result = append(result, remoteGitRepository{
			Name:          name,
			FullName:      fullName,
			Description:   asGitString(row["description"]),
			CloneURL:      asGitString(row["clone_url"]),
			DefaultBranch: asGitString(row["default_branch"]),
			IsPrivate:     asBoolValue(row["private"]),
		})
	}

	return result, nil
}

func fetchGiteaRepositories(providerAPIURL, accessToken string) ([]remoteGitRepository, error) {
	if strings.TrimSpace(accessToken) == "" {
		return nil, fmt.Errorf("gitea access token is missing")
	}

	baseURL := strings.TrimSpace(providerAPIURL)
	if baseURL == "" {
		baseURL = strings.TrimSpace(getenvOrDefault("GITEA_BASE_URL", "https://gitea.example.com"))
	}
	baseURL = strings.TrimSuffix(baseURL, "/")

	request, err := http.NewRequest(http.MethodGet, baseURL+"/api/v1/user/repos?limit=100", nil)
	if err != nil {
		return nil, err
	}

	request.Header.Set("Accept", "application/json")
	request.Header.Set("Authorization", "token "+strings.TrimSpace(accessToken))

	client := &http.Client{Timeout: 10 * time.Second}
	response, err := client.Do(request)
	if err != nil {
		return nil, err
	}
	defer response.Body.Close()

	if response.StatusCode != http.StatusOK {
		payload, _ := io.ReadAll(io.LimitReader(response.Body, 2048))
		return nil, fmt.Errorf("gitea repos request failed with status %d: %s", response.StatusCode, strings.TrimSpace(string(payload)))
	}

	var rows []map[string]interface{}
	if err := json.NewDecoder(response.Body).Decode(&rows); err != nil {
		return nil, err
	}

	result := make([]remoteGitRepository, 0, len(rows))
	for _, row := range rows {
		fullName := asGitString(row["full_name"])
		name := asGitString(row["name"])
		if fullName == "" || name == "" {
			continue
		}
		result = append(result, remoteGitRepository{
			Name:          name,
			FullName:      fullName,
			Description:   asGitString(row["description"]),
			CloneURL:      asGitString(row["clone_url"]),
			DefaultBranch: asGitString(row["default_branch"]),
			IsPrivate:     asBoolValue(row["private"]),
		})
	}

	return result, nil
}

func fetchGitLabRepositories(providerAPIURL, accessToken string) ([]remoteGitRepository, error) {
	if strings.TrimSpace(accessToken) == "" {
		return nil, fmt.Errorf("gitlab access token is missing")
	}

	baseURL := strings.TrimSpace(providerAPIURL)
	if baseURL == "" {
		baseURL = strings.TrimSpace(getenvOrDefault("GITLAB_API_URL", "https://gitlab.com/api/v4"))
	}
	baseURL = strings.TrimSuffix(baseURL, "/")

	request, err := http.NewRequest(http.MethodGet, baseURL+"/projects?membership=true&simple=true&per_page=100&order_by=last_activity_at&sort=desc", nil)
	if err != nil {
		return nil, err
	}

	request.Header.Set("Accept", "application/json")
	request.Header.Set("PRIVATE-TOKEN", strings.TrimSpace(accessToken))
	request.Header.Set("Authorization", "Bearer "+strings.TrimSpace(accessToken))

	client := &http.Client{Timeout: 10 * time.Second}
	response, err := client.Do(request)
	if err != nil {
		return nil, err
	}
	defer response.Body.Close()

	if response.StatusCode != http.StatusOK {
		payload, _ := io.ReadAll(io.LimitReader(response.Body, 2048))
		return nil, fmt.Errorf("gitlab repos request failed with status %d: %s", response.StatusCode, strings.TrimSpace(string(payload)))
	}

	var rows []map[string]interface{}
	if err := json.NewDecoder(response.Body).Decode(&rows); err != nil {
		return nil, err
	}

	result := make([]remoteGitRepository, 0, len(rows))
	for _, row := range rows {
		fullName := asGitString(row["path_with_namespace"])
		name := asGitString(row["name"])
		if fullName == "" || name == "" {
			continue
		}

		visibility := strings.ToLower(asGitString(row["visibility"]))
		isPrivate := visibility == "private"
		if visibility == "" {
			isPrivate = asBoolValue(row["private"])
		}

		result = append(result, remoteGitRepository{
			Name:          name,
			FullName:      fullName,
			Description:   asGitString(row["description"]),
			CloneURL:      asGitString(row["http_url_to_repo"]),
			DefaultBranch: asGitString(row["default_branch"]),
			IsPrivate:     isPrivate,
		})
	}

	return result, nil
}

func fetchBitbucketRepositories(providerAPIURL, accessToken string) ([]remoteGitRepository, error) {
	if strings.TrimSpace(accessToken) == "" {
		return nil, fmt.Errorf("bitbucket access token is missing")
	}

	baseURL := strings.TrimSpace(providerAPIURL)
	if baseURL == "" {
		baseURL = strings.TrimSpace(getenvOrDefault("BITBUCKET_API_URL", "https://api.bitbucket.org/2.0"))
	}
	baseURL = strings.TrimSuffix(baseURL, "/")

	client := &http.Client{Timeout: 12 * time.Second}
	nextURL := baseURL + "/repositories?role=member&pagelen=100"
	maxPages := 5
	result := make([]remoteGitRepository, 0, 128)

	for page := 0; page < maxPages && nextURL != ""; page++ {
		request, err := http.NewRequest(http.MethodGet, nextURL, nil)
		if err != nil {
			return nil, err
		}
		request.Header.Set("Accept", "application/json")
		request.Header.Set("Authorization", "Bearer "+strings.TrimSpace(accessToken))

		response, err := client.Do(request)
		if err != nil {
			return nil, err
		}

		if response.StatusCode != http.StatusOK {
			payload, _ := io.ReadAll(io.LimitReader(response.Body, 2048))
			response.Body.Close()
			return nil, fmt.Errorf("bitbucket repos request failed with status %d: %s", response.StatusCode, strings.TrimSpace(string(payload)))
		}

		var payload struct {
			Values []map[string]interface{} `json:"values"`
			Next   string                   `json:"next"`
		}
		if err := json.NewDecoder(response.Body).Decode(&payload); err != nil {
			response.Body.Close()
			return nil, err
		}
		response.Body.Close()

		for _, row := range payload.Values {
			fullName := asGitString(row["full_name"])
			name := asGitString(row["name"])
			if fullName == "" || name == "" {
				continue
			}

			defaultBranch := "main"
			if branch, ok := row["mainbranch"].(map[string]interface{}); ok {
				if parsed := asGitString(branch["name"]); parsed != "" {
					defaultBranch = parsed
				}
			}

			cloneURL := ""
			if links, ok := row["links"].(map[string]interface{}); ok {
				if cloneLinks, ok := links["clone"].([]interface{}); ok {
					for _, raw := range cloneLinks {
						link, ok := raw.(map[string]interface{})
						if !ok {
							continue
						}
						if strings.EqualFold(asGitString(link["name"]), "https") {
							cloneURL = asGitString(link["href"])
							break
						}
					}
				}
			}

			result = append(result, remoteGitRepository{
				Name:          name,
				FullName:      fullName,
				Description:   asGitString(row["description"]),
				CloneURL:      cloneURL,
				DefaultBranch: defaultBranch,
				IsPrivate:     asBoolValue(row["is_private"]),
			})
		}

		nextURL = strings.TrimSpace(payload.Next)
	}

	return result, nil
}

func getGitHubAppInstallationToken(baseURL string, installationID int64) (string, error) {
	appID := strings.TrimSpace(os.Getenv("GITHUB_APP_ID"))
	privateKeyPEM := strings.TrimSpace(os.Getenv("GITHUB_APP_PRIVATE_KEY"))
	if appID == "" || privateKeyPEM == "" {
		return "", fmt.Errorf("GITHUB_APP_ID and GITHUB_APP_PRIVATE_KEY must be configured")
	}

	jwtToken, err := createGitHubAppJWT(appID, privateKeyPEM)
	if err != nil {
		return "", err
	}

	request, err := http.NewRequest(http.MethodPost, fmt.Sprintf("%s/app/installations/%d/access_tokens", strings.TrimSuffix(baseURL, "/"), installationID), nil)
	if err != nil {
		return "", err
	}

	request.Header.Set("Accept", "application/vnd.github+json")
	request.Header.Set("Authorization", "Bearer "+jwtToken)

	client := &http.Client{Timeout: 10 * time.Second}
	response, err := client.Do(request)
	if err != nil {
		return "", err
	}
	defer response.Body.Close()

	if response.StatusCode != http.StatusCreated {
		payload, _ := io.ReadAll(io.LimitReader(response.Body, 2048))
		return "", fmt.Errorf("github app token request failed with status %d: %s", response.StatusCode, strings.TrimSpace(string(payload)))
	}

	var body struct {
		Token string `json:"token"`
	}
	if err := json.NewDecoder(response.Body).Decode(&body); err != nil {
		return "", err
	}
	if strings.TrimSpace(body.Token) == "" {
		return "", fmt.Errorf("github app token response missing token")
	}
	return body.Token, nil
}

func createGitHubAppJWT(appID, privateKeyPEM string) (string, error) {
	privateKey, err := parseGitHubAppPrivateKey(privateKeyPEM)
	if err != nil {
		return "", err
	}

	now := time.Now().UTC()
	claims := jwt.RegisteredClaims{
		Issuer:    strings.TrimSpace(appID),
		IssuedAt:  jwt.NewNumericDate(now.Add(-60 * time.Second)),
		ExpiresAt: jwt.NewNumericDate(now.Add(9 * time.Minute)),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)
	return token.SignedString(privateKey)
}

func parseGitHubAppPrivateKey(raw string) (*rsa.PrivateKey, error) {
	normalized := strings.ReplaceAll(strings.TrimSpace(raw), "\\n", "\n")
	block, _ := pem.Decode([]byte(normalized))
	if block == nil {
		return nil, fmt.Errorf("invalid github app private key format")
	}

	if key, err := x509.ParsePKCS1PrivateKey(block.Bytes); err == nil {
		return key, nil
	}

	parsed, err := x509.ParsePKCS8PrivateKey(block.Bytes)
	if err != nil {
		return nil, err
	}
	privateKey, ok := parsed.(*rsa.PrivateKey)
	if !ok {
		return nil, fmt.Errorf("github app private key is not RSA")
	}
	return privateKey, nil
}

func asGitString(value interface{}) string {
	if value == nil {
		return ""
	}
	switch typed := value.(type) {
	case string:
		return strings.TrimSpace(typed)
	default:
		return strings.TrimSpace(fmt.Sprint(typed))
	}
}

func asBoolValue(value interface{}) bool {
	switch typed := value.(type) {
	case bool:
		return typed
	case string:
		parsed, _ := strconv.ParseBool(strings.TrimSpace(typed))
		return parsed
	default:
		return false
	}
}

func getenvOrDefault(key, fallback string) string {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	return value
}

func validateGitToken(provider, token string) bool {
	token = strings.TrimSpace(token)
	if token == "" {
		return false
	}
	if strings.EqualFold(strings.TrimSpace(provider), "github_app") {
		installationID, err := strconv.ParseInt(token, 10, 64)
		return err == nil && installationID > 0
	}
	return true
}

type gitRequestContext struct {
	userID string
	db     *database.DB
}

func requireGitRequestContext(c *gin.Context) (*gitRequestContext, bool) {
	userID, ok := requireAuthenticatedUserID(c)
	if !ok {
		return nil, false
	}

	dbValue, exists := c.Get("db")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database context not found"})
		return nil, false
	}

	db, ok := dbValue.(*database.DB)
	if !ok || db == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid database context"})
		return nil, false
	}

	return &gitRequestContext{
		userID: userID,
		db:     db,
	}, true
}

func positiveIntOrDefault(raw string, fallback int) int {
	value, err := strconv.Atoi(raw)
	if err != nil || value <= 0 {
		return fallback
	}
	return value
}

func isUniqueConstraintError(err error) bool {
	if err == nil {
		return false
	}
	lower := strings.ToLower(err.Error())
	return strings.Contains(lower, "duplicate key") || strings.Contains(lower, "unique constraint")
}

func normalizeRepositoryFullName(input string) (name string, fullName string, err error) {
	value := strings.TrimSpace(input)
	if value == "" {
		return "", "", fmt.Errorf("repo_full_name is required")
	}

	if parsed, parseErr := url.Parse(value); parseErr == nil && parsed.Scheme != "" && parsed.Host != "" {
		path := strings.Trim(parsed.Path, "/")
		if path != "" {
			value = path
		}
	}

	if strings.HasPrefix(strings.ToLower(value), "git@") {
		if separator := strings.Index(value, ":"); separator != -1 && separator+1 < len(value) {
			value = value[separator+1:]
		}
	}

	value = strings.TrimSuffix(value, ".git")
	parts := strings.Split(strings.Trim(value, "/"), "/")
	if len(parts) != 2 {
		return "", "", fmt.Errorf("repo_full_name must be in owner/repository format")
	}
	if strings.TrimSpace(parts[0]) == "" || strings.TrimSpace(parts[1]) == "" {
		return "", "", fmt.Errorf("repo_full_name must be in owner/repository format")
	}
	for _, part := range parts {
		if strings.ContainsAny(part, " \t\r\n") {
			return "", "", fmt.Errorf("repo_full_name cannot include whitespace")
		}
	}

	return parts[1], parts[0] + "/" + parts[1], nil
}

func deriveCloneURL(provider, repoFullName string) string {
	switch strings.ToLower(strings.TrimSpace(provider)) {
	case "github":
		return fmt.Sprintf("https://github.com/%s.git", repoFullName)
	case "github_app":
		return fmt.Sprintf("https://github.com/%s.git", repoFullName)
	case "gitlab":
		baseURL := strings.TrimSuffix(strings.TrimSpace(getenvOrDefault("GITLAB_BASE_URL", "https://gitlab.com")), "/")
		return fmt.Sprintf("%s/%s.git", baseURL, repoFullName)
	case "bitbucket":
		baseURL := strings.TrimSuffix(strings.TrimSpace(getenvOrDefault("BITBUCKET_BASE_URL", "https://bitbucket.org")), "/")
		return fmt.Sprintf("%s/%s.git", baseURL, repoFullName)
	case "gitea":
		baseURL := strings.TrimSuffix(strings.TrimSpace(getenvOrDefault("GITEA_BASE_URL", "https://gitea.example.com")), "/")
		return fmt.Sprintf("%s/%s.git", baseURL, repoFullName)
	default:
		return repoFullName
	}
}

func generateWebhookSecret() (string, error) {
	buf := make([]byte, 24)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return hex.EncodeToString(buf), nil
}
