package api

import (
	"bytes"
	"containr/internal/database"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// GitProvider represents a Git provider (GitHub, GitLab, Bitbucket)
type GitProvider struct {
	ID          string `json:"id" db:"id"`
	Name        string `json:"name" db:"name"` // github, gitlab, bitbucket
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
	ID            string `json:"id" db:"id"`
	ProviderID    string `json:"provider_id" db:"provider_id"`
	Name          string `json:"name" db:"name"`
	FullName      string `json:"full_name" db:"full_name"`
	Description   string `json:"description" db:"description"`
	CloneURL      string `json:"clone_url" db:"clone_url"`
	WebhookURL    string `json:"webhook_url" db:"webhook_url"`
	DefaultBranch string `json:"default_branch" db:"default_branch"`
	IsPrivate     bool   `json:"is_private" db:"is_private"`
	UserID        string `json:"user_id" db:"user_id"`
	CreatedAt     string `json:"created_at" db:"created_at"`
	UpdatedAt     string `json:"updated_at" db:"updated_at"`
}

// GitWebhook represents a webhook configuration
type GitWebhook struct {
	ID              string `json:"id" db:"id"`
	RepoID          string `json:"repo_id" db:"repo_id"`
	ProviderID      string `json:"provider_id" db:"provider_id"`
	Events          string `json:"events" db:"events"`    // JSON array of events
	Secret          string `json:"-" db:"webhook_secret"` // Hidden in JSON responses
	RemoteWebhookID string `json:"remote_webhook_id" db:"remote_webhook_id"`
	Active          bool   `json:"active" db:"active"`
	BranchFilter    string `json:"branch_filter,omitempty" db:"branch_filter"`
	CreatedAt       string `json:"created_at" db:"created_at"`
	UpdatedAt       string `json:"updated_at" db:"updated_at"`
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
	RepoID string   `json:"repo_id" binding:"required"`
	Events []string `json:"events" binding:"required"`
	Branch string   `json:"branch"`
}

type GitBranch struct {
	Name       string `json:"name"`
	CommitHash string `json:"commit_hash"`
	IsDefault  bool   `json:"is_default"`
}

type githubRepo struct {
	Name          string `json:"name"`
	FullName      string `json:"full_name"`
	Description   string `json:"description"`
	CloneURL      string `json:"clone_url"`
	HTMLURL       string `json:"html_url"`
	DefaultBranch string `json:"default_branch"`
	Private       bool   `json:"private"`
}

type githubBranch struct {
	Name   string `json:"name"`
	Commit struct {
		SHA string `json:"sha"`
	} `json:"commit"`
}

type githubUser struct {
	Login string `json:"login"`
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
			   p.id, p.name, p.access_token, p.api_url, p.webhook_url
		FROM git_repositories r
		JOIN git_providers p ON r.provider_id = p.id
		WHERE r.id = $1 AND r.user_id = $2
	`, req.RepoID, userID).Scan(&repo.ID, &repo.ProviderID, &repo.FullName, &repo.UserID,
		&provider.ID, &provider.Name, &provider.AccessToken, &provider.APIUrl, &provider.WebhookUrl)

	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Repository not found"})
		return
	}

	// Convert events to JSON
	eventsJSON, _ := json.Marshal(req.Events)
	webhookSecret := generateWebhookSecret()

	// Create webhook on Git provider
	webhookURL := fmt.Sprintf("%s/api/v1/webhooks/git/%s", publicBaseURL(c), req.RepoID)
	remoteWebhookID, err := createGitWebhook(provider.Name, repo.FullName, provider.AccessToken,
		provider.APIUrl, webhookURL, req.Events, webhookSecret)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create webhook on Git provider: " + err.Error()})
		return
	}

	// Create webhook record
	webhook := GitWebhook{
		ID:              uuid.New().String(),
		RepoID:          req.RepoID,
		ProviderID:      provider.ID,
		Events:          string(eventsJSON),
		Secret:          webhookSecret,
		RemoteWebhookID: remoteWebhookID,
		Active:          true,
		BranchFilter:    req.Branch,
	}

	_, err = db.Exec(`
		INSERT INTO git_webhooks (id, repo_id, provider_id, events, webhook_secret, remote_webhook_id, active, branch_filter, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
	`, webhook.ID, webhook.RepoID, webhook.ProviderID, webhook.Events, webhook.Secret, webhook.RemoteWebhookID, webhook.Active, nullableString(webhook.BranchFilter))

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create webhook"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"webhook":           webhook,
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

func handleGetRepositoryBranches(c *gin.Context) {
	userID := c.MustGet("user_id").(string)
	db := c.MustGet("db").(*database.DB)
	repoID := c.Param("repoId")

	if _, err := uuid.Parse(repoID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid repository ID"})
		return
	}

	var repo GitRepository
	var provider GitProvider
	err := db.QueryRow(`
		SELECT r.id, r.full_name, r.default_branch,
			   p.id, p.name, p.access_token, p.api_url
		FROM git_repositories r
		JOIN git_providers p ON r.provider_id = p.id
		WHERE r.id = $1 AND r.user_id = $2
	`, repoID, userID).Scan(&repo.ID, &repo.FullName, &repo.DefaultBranch,
		&provider.ID, &provider.Name, &provider.AccessToken, &provider.APIUrl)

	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Repository not found"})
		return
	}

	branches, err := fetchGitBranches(provider.Name, provider.AccessToken, provider.APIUrl, repo.FullName, repo.DefaultBranch)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch branches: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"branches": branches})
}

// Helper functions (these would need to be implemented with actual Git provider API calls)

func validateGitToken(provider, token string) bool {
	if strings.TrimSpace(token) == "" {
		return false
	}

	if provider != "github" {
		return true
	}

	body, status, err := gitProviderRequest("GET", "https://api.github.com", token, "/user", nil)
	if err != nil || status < 200 || status >= 300 {
		return false
	}

	var user githubUser
	return json.Unmarshal(body, &user) == nil && user.Login != ""
}

func fetchGitRepositories(provider, token, apiUrl string) ([]map[string]interface{}, error) {
	if provider != "github" {
		return nil, fmt.Errorf("%s repository listing is not implemented yet", provider)
	}

	body, status, err := gitProviderRequest(
		"GET",
		apiUrl,
		token,
		"/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator,organization_member",
		nil,
	)
	if err != nil {
		return nil, err
	}
	if status < 200 || status >= 300 {
		return nil, providerStatusError(status, body)
	}

	var repos []githubRepo
	if err := json.Unmarshal(body, &repos); err != nil {
		return nil, err
	}

	result := make([]map[string]interface{}, 0, len(repos))
	for _, repo := range repos {
		result = append(result, map[string]interface{}{
			"name":           repo.Name,
			"full_name":      repo.FullName,
			"description":    repo.Description,
			"clone_url":      repo.CloneURL,
			"default_branch": repo.DefaultBranch,
			"private":        repo.Private,
			"html_url":       repo.HTMLURL,
		})
	}

	return result, nil
}

func fetchGitRepositoryDetails(provider, repoFullName, token, apiUrl string) (map[string]interface{}, error) {
	if provider != "github" {
		return nil, fmt.Errorf("%s repository details are not implemented yet", provider)
	}

	path, err := githubRepoPath(repoFullName, "")
	if err != nil {
		return nil, err
	}

	body, status, err := gitProviderRequest("GET", apiUrl, token, path, nil)
	if err != nil {
		return nil, err
	}
	if status < 200 || status >= 300 {
		return nil, providerStatusError(status, body)
	}

	var repo githubRepo
	if err := json.Unmarshal(body, &repo); err != nil {
		return nil, err
	}

	return map[string]interface{}{
		"name":           repo.Name,
		"description":    repo.Description,
		"clone_url":      repo.CloneURL,
		"default_branch": repo.DefaultBranch,
		"private":        repo.Private,
		"html_url":       repo.HTMLURL,
	}, nil
}

func fetchGitBranches(provider, token, apiUrl, repoFullName, defaultBranch string) ([]GitBranch, error) {
	if provider != "github" {
		return nil, fmt.Errorf("%s branch listing is not implemented yet", provider)
	}

	path, err := githubRepoPath(repoFullName, "/branches?per_page=100")
	if err != nil {
		return nil, err
	}

	body, status, err := gitProviderRequest("GET", apiUrl, token, path, nil)
	if err != nil {
		return nil, err
	}
	if status < 200 || status >= 300 {
		return nil, providerStatusError(status, body)
	}

	var rawBranches []githubBranch
	if err := json.Unmarshal(body, &rawBranches); err != nil {
		return nil, err
	}

	branches := make([]GitBranch, 0, len(rawBranches))
	for _, branch := range rawBranches {
		branches = append(branches, GitBranch{
			Name:       branch.Name,
			CommitHash: branch.Commit.SHA,
			IsDefault:  branch.Name == defaultBranch,
		})
	}

	return branches, nil
}

func createGitWebhook(provider, repoFullName, token, apiUrl, targetURL string, events []string, secret string) (string, error) {
	if provider != "github" {
		return "", fmt.Errorf("%s webhooks are not implemented yet", provider)
	}

	path, err := githubRepoPath(repoFullName, "/hooks")
	if err != nil {
		return "", err
	}

	payload := map[string]interface{}{
		"name":   "web",
		"active": true,
		"events": events,
		"config": map[string]string{
			"url":          targetURL,
			"content_type": "json",
			"secret":       secret,
			"insecure_ssl": "0",
		},
	}
	data, _ := json.Marshal(payload)

	body, status, err := gitProviderRequest("POST", apiUrl, token, path, bytes.NewReader(data))
	if err != nil {
		return "", err
	}
	if status < 200 || status >= 300 {
		return "", providerStatusError(status, body)
	}

	var response struct {
		ID int64 `json:"id"`
	}
	if err := json.Unmarshal(body, &response); err != nil {
		return "", err
	}
	if response.ID == 0 {
		return "", fmt.Errorf("GitHub returned an empty webhook ID")
	}

	return strconv.FormatInt(response.ID, 10), nil
}

func generateWebhookSecret() string {
	return "webhook-secret-" + uuid.New().String()
}

func gitProviderRequest(method, apiUrl, token, path string, body io.Reader) ([]byte, int, error) {
	base := strings.TrimRight(apiUrl, "/")
	if base == "" {
		base = "https://api.github.com"
	}

	req, err := http.NewRequest(method, base+path, body)
	if err != nil {
		return nil, 0, err
	}
	req.Header.Set("Accept", "application/vnd.github+json")
	if strings.TrimSpace(token) != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	req.Header.Set("X-GitHub-Api-Version", "2022-11-28")
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, 0, err
	}
	defer resp.Body.Close()

	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, resp.StatusCode, err
	}

	return data, resp.StatusCode, nil
}

func githubRepoPath(repoFullName, suffix string) (string, error) {
	parts := strings.Split(repoFullName, "/")
	if len(parts) != 2 || parts[0] == "" || parts[1] == "" {
		return "", fmt.Errorf("repository must use owner/name format")
	}

	return "/repos/" + url.PathEscape(parts[0]) + "/" + url.PathEscape(parts[1]) + suffix, nil
}

func providerStatusError(status int, body []byte) error {
	var response struct {
		Message string `json:"message"`
	}
	if err := json.Unmarshal(body, &response); err == nil && response.Message != "" {
		return fmt.Errorf("provider returned %d: %s", status, response.Message)
	}

	return fmt.Errorf("provider returned %d", status)
}

func publicBaseURL(c *gin.Context) string {
	for _, key := range []string{"CONTAINR_PUBLIC_URL", "PUBLIC_URL", "APP_URL"} {
		if value := strings.TrimRight(os.Getenv(key), "/"); value != "" {
			return value
		}
	}

	scheme := "http"
	if c.Request.TLS != nil || c.GetHeader("X-Forwarded-Proto") == "https" {
		scheme = "https"
	}

	host := c.Request.Host
	if forwardedHost := c.GetHeader("X-Forwarded-Host"); forwardedHost != "" {
		host = forwardedHost
	}

	return scheme + "://" + host
}

func nullableString(value string) any {
	if strings.TrimSpace(value) == "" {
		return nil
	}
	return value
}

func fetchGitHubFile(provider, token, apiUrl, repoFullName, branch, filePath string) ([]byte, error) {
	if provider != "github" {
		return nil, fmt.Errorf("%s file fetch is not implemented yet", provider)
	}

	suffix := "/contents/" + strings.TrimLeft(filePath, "/")
	if branch != "" {
		suffix += "?ref=" + url.QueryEscape(branch)
	}

	path, err := githubRepoPath(repoFullName, suffix)
	if err != nil {
		return nil, err
	}

	body, status, err := gitProviderRequest("GET", apiUrl, token, path, nil)
	if err != nil {
		return nil, err
	}
	if status < 200 || status >= 300 {
		return nil, providerStatusError(status, body)
	}

	var response struct {
		Content  string `json:"content"`
		Encoding string `json:"encoding"`
	}
	if err := json.Unmarshal(body, &response); err != nil {
		return nil, err
	}
	if response.Encoding != "base64" {
		return nil, fmt.Errorf("unsupported GitHub content encoding: %s", response.Encoding)
	}

	decoded, err := base64.StdEncoding.DecodeString(strings.ReplaceAll(response.Content, "\n", ""))
	if err != nil {
		return nil, err
	}

	return decoded, nil
}
