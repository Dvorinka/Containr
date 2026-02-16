package api

import (
	"containr/internal/database"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// GitProvider represents a Git provider (GitHub, GitLab, Bitbucket)
type GitProvider struct {
	ID          string `json:"id" db:"id"`
	Name        string `json:"name" db:"name"`        // github, gitlab, bitbucket
	DisplayName string `json:"display_name" db:"display_name"`
	APIUrl      string `json:"api_url" db:"api_url"`
	WebhookUrl  string `json:"webhook_url" db:"webhook_url"`
	UserID      string `json:"user_id" db:"user_id"`
	AccessToken string `json:"-" db:"access_token"` // Hidden in JSON responses
	CreatedAt   string `json:"created_at" db:"created_at"`
	UpdatedAt   string `json:"updated_at" db:"updated_at"`
}

// GitRepository represents a connected Git repository
type GitRepository struct {
	ID           string `json:"id" db:"id"`
	ProviderID   string `json:"provider_id" db:"provider_id"`
	Name         string `json:"name" db:"name"`
	FullName     string `json:"full_name" db:"full_name"`
	Description  string `json:"description" db:"description"`
	CloneURL     string `json:"clone_url" db:"clone_url"`
	WebhookURL   string `json:"webhook_url" db:"webhook_url"`
	DefaultBranch string `json:"default_branch" db:"default_branch"`
	IsPrivate    bool   `json:"is_private" db:"is_private"`
	UserID       string `json:"user_id" db:"user_id"`
	CreatedAt    string `json:"created_at" db:"created_at"`
	UpdatedAt    string `json:"updated_at" db:"updated_at"`
}

// GitWebhook represents a webhook configuration
type GitWebhook struct {
	ID         string `json:"id" db:"id"`
	RepoID     string `json:"repo_id" db:"repo_id"`
	ProviderID string `json:"provider_id" db:"provider_id"`
	Events     string `json:"events" db:"events"`     // JSON array of events
	Secret     string `json:"-" db:"webhook_secret"` // Hidden in JSON responses
	Active     bool   `json:"active" db:"active"`
	CreatedAt  string `json:"created_at" db:"created_at"`
	UpdatedAt  string `json:"updated_at" db:"updated_at"`
}

// CreateGitProviderRequest represents a request to create a Git provider
type CreateGitProviderRequest struct {
	Name        string `json:"name" binding:"required,oneof=github gitlab bitbucket"`
	DisplayName string `json:"display_name" binding:"required"`
	AccessToken string `json:"access_token" binding:"required"`
}

// CreateGitRepoRequest represents a request to connect a Git repository
type CreateGitRepoRequest struct {
	ProviderID   string `json:"provider_id" binding:"required"`
	RepoFullName string `json:"repo_full_name" binding:"required"`
}

// CreateWebhookRequest represents a request to create a webhook
type CreateWebhookRequest struct {
	RepoID    string   `json:"repo_id" binding:"required"`
	Events    []string `json:"events" binding:"required"`
	Branch    string   `json:"branch"`
}

func handleGetGitProviders(c *gin.Context) {
	userID := c.MustGet("user_id").(string)
	db := c.MustGet("db").(*database.DB)

	rows, err := db.Query(`
		SELECT id, name, display_name, api_url, webhook_url, user_id, created_at, updated_at
		FROM git_providers 
		WHERE user_id = $1 
		ORDER BY created_at DESC
	`, userID)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}
	defer rows.Close()

	var providers []GitProvider
	for rows.Next() {
		var provider GitProvider
		if err := rows.Scan(&provider.ID, &provider.Name, &provider.DisplayName, &provider.APIUrl, 
			&provider.WebhookUrl, &provider.UserID, &provider.CreatedAt, &provider.UpdatedAt); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
			return
		}
		providers = append(providers, provider)
	}

	c.JSON(http.StatusOK, gin.H{"providers": providers})
}

func handleCreateGitProvider(c *gin.Context) {
	userID := c.MustGet("user_id").(string)
	db := c.MustGet("db").(*database.DB)

	var req CreateGitProviderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Validate the access token by making a test API call
	if !validateGitToken(req.Name, req.AccessToken) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid access token for " + req.Name})
		return
	}

	provider := GitProvider{
		ID:          uuid.New().String(),
		Name:        req.Name,
		DisplayName: req.DisplayName,
		AccessToken: req.AccessToken,
		UserID:      userID,
	}

	// Set provider-specific URLs
	switch req.Name {
	case "github":
		provider.APIUrl = "https://api.github.com"
		provider.WebhookUrl = "https://api.github.com"
	case "gitlab":
		provider.APIUrl = "https://gitlab.com/api/v4"
		provider.WebhookUrl = "https://gitlab.com"
	case "bitbucket":
		provider.APIUrl = "https://api.bitbucket.org/2.0"
		provider.WebhookUrl = "https://api.bitbucket.org/2.0"
	}

	_, err := db.Exec(`
		INSERT INTO git_providers (id, name, display_name, api_url, webhook_url, access_token, user_id, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
	`, provider.ID, provider.Name, provider.DisplayName, provider.APIUrl, 
		provider.WebhookUrl, provider.AccessToken, provider.UserID)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create Git provider"})
		return
	}

	// Return provider without access token
	provider.AccessToken = ""
	c.JSON(http.StatusCreated, provider)
}

func handleGetGitRepositories(c *gin.Context) {
	userID := c.MustGet("user_id").(string)
	db := c.MustGet("db").(*database.DB)
	providerID := c.Param("providerId")

	// Validate UUID
	if _, err := uuid.Parse(providerID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid provider ID"})
		return
	}

	// Get provider info
	var provider GitProvider
	err := db.QueryRow(`
		SELECT id, name, access_token, api_url
		FROM git_providers 
		WHERE id = $1 AND user_id = $2
	`, providerID, userID).Scan(&provider.ID, &provider.Name, &provider.AccessToken, &provider.APIUrl)

	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Git provider not found"})
		return
	}

	// Fetch repositories from the Git provider
	repos, err := fetchGitRepositories(provider.Name, provider.AccessToken, provider.APIUrl)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch repositories"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"repositories": repos})
}

func handleConnectGitRepository(c *gin.Context) {
	userID := c.MustGet("user_id").(string)
	db := c.MustGet("db").(*database.DB)

	var req CreateGitRepoRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Validate UUID
	if _, err := uuid.Parse(req.ProviderID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid provider ID"})
		return
	}

	// Get provider info
	var provider GitProvider
	err := db.QueryRow(`
		SELECT id, name, access_token, api_url
		FROM git_providers 
		WHERE id = $1 AND user_id = $2
	`, req.ProviderID, userID).Scan(&provider.ID, &provider.Name, &provider.AccessToken, &provider.APIUrl)

	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Git provider not found"})
		return
	}

	// Fetch repository details from Git provider
	repoDetails, err := fetchGitRepositoryDetails(provider.Name, req.RepoFullName, provider.AccessToken, provider.APIUrl)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch repository details"})
		return
	}

	// Check if repository is already connected
	var existingID string
	err = db.QueryRow(`
		SELECT id FROM git_repositories 
		WHERE provider_id = $1 AND full_name = $2
	`, req.ProviderID, req.RepoFullName).Scan(&existingID)

	if err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "Repository already connected", "repository_id": existingID})
		return
	}

	// Create repository record
	repo := GitRepository{
		ID:            uuid.New().String(),
		ProviderID:    req.ProviderID,
		Name:          repoDetails["name"].(string),
		FullName:      req.RepoFullName,
		Description:   repoDetails["description"].(string),
		CloneURL:      repoDetails["clone_url"].(string),
		DefaultBranch: repoDetails["default_branch"].(string),
		IsPrivate:     repoDetails["private"].(bool),
		UserID:        userID,
	}

	_, err = db.Exec(`
		INSERT INTO git_repositories (id, provider_id, name, full_name, description, clone_url, 
			default_branch, is_private, user_id, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
	`, repo.ID, repo.ProviderID, repo.Name, repo.FullName, repo.Description, 
		repo.CloneURL, repo.DefaultBranch, repo.IsPrivate, repo.UserID)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to connect repository"})
		return
	}

	c.JSON(http.StatusCreated, repo)
}

func handleCreateWebhook(c *gin.Context) {
	userID := c.MustGet("user_id").(string)
	db := c.MustGet("db").(*database.DB)

	var req CreateWebhookRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Validate UUIDs
	if _, err := uuid.Parse(req.RepoID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid repository ID"})
		return
	}

	// Get repository and provider info
	var repo GitRepository
	var provider GitProvider
	err := db.QueryRow(`
		SELECT r.id, r.provider_id, r.full_name, r.user_id,
			   p.id, p.name, p.access_token, p.webhook_url
		FROM git_repositories r
		JOIN git_providers p ON r.provider_id = p.id
		WHERE r.id = $1 AND r.user_id = $2
	`, req.RepoID, userID).Scan(&repo.ID, &repo.ProviderID, &repo.FullName, &repo.UserID,
		&provider.ID, &provider.Name, &provider.AccessToken, &provider.WebhookUrl)

	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Repository not found"})
		return
	}

	// Convert events to JSON
	eventsJSON, _ := json.Marshal(req.Events)
	webhookSecret := generateWebhookSecret()

	// Create webhook on Git provider
	webhookURL := fmt.Sprintf("%s/api/v1/webhooks/git/%s", "https://your-domain.com", req.RepoID)
	remoteWebhookID, err := createGitWebhook(provider.Name, repo.FullName, provider.AccessToken, 
		provider.WebhookUrl, webhookURL, req.Events, webhookSecret)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create webhook on Git provider"})
		return
	}

	// Create webhook record
	webhook := GitWebhook{
		ID:         uuid.New().String(),
		RepoID:     req.RepoID,
		ProviderID: provider.ID,
		Events:     string(eventsJSON),
		Secret:     webhookSecret,
		Active:     true,
	}

	_, err = db.Exec(`
		INSERT INTO git_webhooks (id, repo_id, provider_id, events, webhook_secret, active, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
	`, webhook.ID, webhook.RepoID, webhook.ProviderID, webhook.Events, webhook.Secret, webhook.Active)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create webhook"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"webhook": webhook,
		"remote_webhook_id": remoteWebhookID,
	})
}

func handleGetConnectedRepositories(c *gin.Context) {
	userID := c.MustGet("user_id").(string)
	db := c.MustGet("db").(*database.DB)

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))
	offset := (page - 1) * limit

	rows, err := db.Query(`
		SELECT r.id, r.provider_id, r.name, r.full_name, r.description, r.clone_url,
			   r.default_branch, r.is_private, r.user_id, r.created_at, r.updated_at,
			   p.name as provider_name, p.display_name
		FROM git_repositories r
		JOIN git_providers p ON r.provider_id = p.id
		WHERE r.user_id = $1
		ORDER BY r.updated_at DESC
		LIMIT $2 OFFSET $3
	`, userID, limit, offset)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}
	defer rows.Close()

	var repositories []map[string]interface{}
	for rows.Next() {
		var repo GitRepository
		var providerName, providerDisplayName string
		if err := rows.Scan(&repo.ID, &repo.ProviderID, &repo.Name, &repo.FullName, &repo.Description, 
			&repo.CloneURL, &repo.DefaultBranch, &repo.IsPrivate, &repo.UserID, &repo.CreatedAt, &repo.UpdatedAt,
			&providerName, &providerDisplayName); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
			return
		}

		repositories = append(repositories, map[string]interface{}{
			"id":            repo.ID,
			"provider_id":   repo.ProviderID,
			"name":          repo.Name,
			"full_name":     repo.FullName,
			"description":   repo.Description,
			"clone_url":     repo.CloneURL,
			"default_branch": repo.DefaultBranch,
			"is_private":    repo.IsPrivate,
			"created_at":    repo.CreatedAt,
			"updated_at":    repo.UpdatedAt,
			"provider": map[string]string{
				"name":         providerName,
				"display_name": providerDisplayName,
			},
		})
	}

	// Get total count
	var total int
	err = db.QueryRow(`
		SELECT COUNT(*) FROM git_repositories WHERE user_id = $1
	`, userID).Scan(&total)

	if err != nil {
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

// Helper functions (these would need to be implemented with actual Git provider API calls)

func validateGitToken(provider, token string) bool {
	// TODO: Implement actual validation with Git provider APIs
	// For now, just check if token is not empty
	return token != ""
}

func fetchGitRepositories(provider, token, apiUrl string) ([]map[string]interface{}, error) {
	// TODO: Implement actual API calls to fetch repositories
	// For now, return mock data
	return []map[string]interface{}{
		{
			"name":         "example-repo",
			"full_name":    "user/example-repo",
			"description":  "An example repository",
			"clone_url":    "https://github.com/user/example-repo.git",
			"default_branch": "main",
			"private":      false,
		},
	}, nil
}

func fetchGitRepositoryDetails(provider, repoFullName, token, apiUrl string) (map[string]interface{}, error) {
	// TODO: Implement actual API call to fetch repository details
	return map[string]interface{}{
		"name":           "example-repo",
		"description":    "An example repository",
		"clone_url":      "https://github.com/user/example-repo.git",
		"default_branch": "main",
		"private":        false,
	}, nil
}

func createGitWebhook(provider, repoFullName, token, webhookUrl, apiUrl string, events []string, secret string) (string, error) {
	// TODO: Implement actual webhook creation
	return uuid.New().String(), nil
}

func generateWebhookSecret() string {
	// TODO: Generate a proper secret
	return "webhook-secret-" + uuid.New().String()
}
