package api

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	"containr/internal/database"
	"containr/internal/deployment"

	"github.com/gin-gonic/gin"
)

// GitHub App self-provisioning (manifest flow): an admin POSTs the manifest
// to github.com/settings/apps/new, GitHub redirects back with `code`, and the
// code is exchanged at /app-manifests/{code}/conversions for real credentials
// stored in app_settings. Values stored there take precedence over the
// GITHUB_APP_* env vars, so the flow removes the manual env-setup barrier.

const (
	settingGitHubAppID            = "github_app.id"
	settingGitHubAppSlug          = "github_app.slug"
	settingGitHubAppName          = "github_app.name"
	settingGitHubAppClientID      = "github_app.client_id"
	settingGitHubAppClientSecret  = "github_app.client_secret"
	settingGitHubAppPrivateKey    = "github_app.private_key"
	settingGitHubAppWebhookSecret = "github_app.webhook_secret"
)

// platformSetting resolves a setting row first, then env, then empty.
func platformSetting(key, envKey string) string {
	return strings.TrimSpace(settingValue(GetAuditDB(), key, envKey, ""))
}

func githubAppConfigured(db *database.DB) bool {
	return strings.TrimSpace(settingValue(db, settingGitHubAppID, "GITHUB_APP_ID", "")) != "" &&
		strings.TrimSpace(settingValue(db, settingGitHubAppPrivateKey, "GITHUB_APP_PRIVATE_KEY", "")) != ""
}

// POST /admin/git/github-app/manifest — builds the GitHub App manifest the
// browser POSTs to github.com. Response carries the manifest as a JSON string
// (the form submits it verbatim) plus the destination URL.
func handleAdminGitHubAppManifest(c *gin.Context) {
	var req struct {
		BaseURL      string `json:"base_url" binding:"required"`
		Name         string `json:"name"`
		Organization string `json:"organization"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, http.StatusBadRequest, "INVALID_BODY", "base_url is required")
		return
	}
	base := strings.TrimSuffix(strings.TrimSpace(req.BaseURL), "/")
	if !strings.HasPrefix(base, "https://") &&
		!strings.HasPrefix(base, "http://localhost") &&
		!strings.HasPrefix(base, "http://127.0.0.1") {
		respondError(c, http.StatusBadRequest, "VALIDATION", "base_url must be an https URL (localhost http allowed)")
		return
	}

	stateBuf := make([]byte, 16)
	if _, err := rand.Read(stateBuf); err != nil {
		respondError(c, http.StatusInternalServerError, "INTERNAL", "failed to generate state")
		return
	}
	state := hex.EncodeToString(stateBuf)

	name := strings.TrimSpace(req.Name)
	if name == "" {
		db, _ := c.Get("db")
		if d, ok := db.(*database.DB); ok {
			name = strings.TrimSpace(settingValue(d, settingBrandProductName, "BRAND_NAME", ""))
		}
		if name == "" {
			name = "Containr"
		}
		name = fmt.Sprintf("%s-%s", name, time.Now().UTC().Format("2006-01-02"))
	}

	callbackURL := base + "/git/github-app/callback"
	manifest, err := json.Marshal(map[string]interface{}{
		"name":  name,
		"url":   base,
		"hook_attributes": map[string]interface{}{
			"url":    base + "/api/git/github-app/webhook",
			"active": true,
		},
		"redirect_url":  callbackURL,
		"callback_urls": []string{callbackURL},
		"public":        false,
		"default_permissions": map[string]string{
			"contents":      "read",
			"metadata":      "read",
			"pull_requests": "write",
		},
		"default_events": []string{"push", "pull_request"},
	})
	if err != nil {
		respondError(c, http.StatusInternalServerError, "INTERNAL", "failed to build manifest")
		return
	}

	org := strings.TrimSpace(req.Organization)
	createURL := fmt.Sprintf("https://github.com/settings/apps/new?state=%s", state)
	if org != "" {
		createURL = fmt.Sprintf("https://github.com/organizations/%s/settings/apps/new?state=%s", org, state)
	}

	c.JSON(http.StatusOK, gin.H{
		"url":      createURL,
		"manifest": string(manifest),
		"state":    state,
	})
}

// POST /admin/git/github-app/convert — exchanges the `code` GitHub appends to
// the manifest redirect for the real app credentials, then stores them.
func handleAdminGitHubAppConvert(c *gin.Context) {
	var req struct {
		Code string `json:"code" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, http.StatusBadRequest, "INVALID_BODY", "code is required")
		return
	}

	apiBase := strings.TrimSuffix(strings.TrimSpace(os.Getenv("GITHUB_APP_BASE_URL")), "/")
	if apiBase == "" {
		apiBase = "https://api.github.com"
	}
	request, err := http.NewRequest(http.MethodPost,
		fmt.Sprintf("%s/app-manifests/%s/conversions", apiBase, strings.TrimSpace(req.Code)), nil)
	if err != nil {
		respondError(c, http.StatusInternalServerError, "INTERNAL", "failed to build conversion request")
		return
	}
	request.Header.Set("Accept", "application/vnd.github+json")
	request.Header.Set("X-GitHub-Api-Version", "2022-11-28")

	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(request)
	if err != nil {
		respondError(c, http.StatusBadGateway, "UPSTREAM", "failed to reach GitHub")
		return
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if resp.StatusCode != http.StatusCreated && resp.StatusCode != http.StatusOK {
		respondError(c, http.StatusBadGateway, "UPSTREAM",
			fmt.Sprintf("GitHub conversion failed (%d)", resp.StatusCode))
		return
	}

	var app struct {
		ID            int64  `json:"id"`
		Slug          string `json:"slug"`
		Name          string `json:"name"`
		ClientID      string `json:"client_id"`
		ClientSecret  string `json:"client_secret"`
		PEM           string `json:"pem"`
		WebhookSecret string `json:"webhook_secret"`
	}
	if err := json.Unmarshal(body, &app); err != nil || app.ID == 0 {
		respondError(c, http.StatusBadGateway, "UPSTREAM", "invalid conversion response")
		return
	}

	db := c.MustGet("db").(*database.DB)
	for _, kv := range []struct {
		key    string
		value  string
		secret bool
	}{
		{settingGitHubAppID, fmt.Sprintf("%d", app.ID), false},
		{settingGitHubAppSlug, app.Slug, false},
		{settingGitHubAppName, app.Name, false},
		{settingGitHubAppClientID, app.ClientID, false},
		{settingGitHubAppClientSecret, app.ClientSecret, true},
		{settingGitHubAppPrivateKey, app.PEM, true},
		{settingGitHubAppWebhookSecret, app.WebhookSecret, true},
	} {
		if err := setSetting(db, kv.key, kv.value, kv.secret); err != nil {
			respondError(c, http.StatusInternalServerError, "INTERNAL", "failed to store app credentials")
			return
		}
	}

	LogAuditWithRequest(c, "github_app", fmt.Sprintf("%d", app.ID), "provision",
		map[string]interface{}{"name": app.Name, "slug": app.Slug})
	c.JSON(http.StatusOK, gin.H{
		"app_id": app.ID,
		"slug":   app.Slug,
		"name":   app.Name,
	})
}

// GET /admin/git/github-app — provisioning status for the settings UI.
func handleAdminGetGitHubApp(c *gin.Context) {
	db := c.MustGet("db").(*database.DB)
	var stored string
	source := "none"
	if err := db.QueryRow(`SELECT value FROM app_settings WHERE key = $1`, settingGitHubAppID).Scan(&stored); err == nil && strings.TrimSpace(stored) != "" {
		source = "settings"
	} else if strings.TrimSpace(os.Getenv("GITHUB_APP_ID")) != "" {
		source = "env"
	}
	c.JSON(http.StatusOK, gin.H{
		"configured": githubAppConfigured(db),
		"source":     source,
		"app_id":     settingValue(db, settingGitHubAppID, "GITHUB_APP_ID", ""),
		"slug":       settingValue(db, settingGitHubAppSlug, "GITHUB_APP_SLUG", ""),
		"name":       settingValue(db, settingGitHubAppName, "", ""),
	})
}

// POST /api/git/github-app/webhook — the single App-level webhook all
// installed repos deliver to. Verified against the provisioned webhook
// secret, then dispatched to matching services.
func handleGitHubAppWebhook(c *gin.Context) {
	dbValue, exists := c.Get("db")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database connection not available"})
		return
	}
	db := dbValue.(*database.DB)

	secret := strings.TrimSpace(settingValue(db, settingGitHubAppWebhookSecret, "GITHUB_APP_WEBHOOK_SECRET", ""))
	if secret == "" {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "GitHub App webhook not configured"})
		return
	}

	body, err := io.ReadAll(io.LimitReader(c.Request.Body, 4<<20))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Failed to read payload"})
		return
	}

	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(body)
	expected := mac.Sum(nil)
	sig := strings.TrimPrefix(c.GetHeader("X-Hub-Signature-256"), "sha256=")
	decoded, err := hex.DecodeString(sig)
	if err != nil || len(decoded) == 0 || subtle.ConstantTimeCompare(decoded, expected) != 1 {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid signature"})
		return
	}

	event := c.GetHeader("X-GitHub-Event")
	if event != "push" {
		c.JSON(http.StatusAccepted, gin.H{"received": true, "ignored": "event " + event})
		return
	}

	var payload struct {
		Ref        string `json:"ref"`
		After      string `json:"after"`
		Repository struct {
			FullName string `json:"full_name"`
			CloneURL string `json:"clone_url"`
		} `json:"repository"`
		HeadCommit struct {
			ID string `json:"id"`
		} `json:"head_commit"`
	}
	if err := json.Unmarshal(body, &payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid payload"})
		return
	}
	if !strings.HasPrefix(payload.Ref, "refs/heads/") {
		c.JSON(http.StatusAccepted, gin.H{"received": true, "ignored": "not a branch push"})
		return
	}
	branch := strings.TrimPrefix(payload.Ref, "refs/heads/")
	commit := payload.HeadCommit.ID
	if commit == "" {
		commit = payload.After
	}

	cloneURL := payload.Repository.CloneURL
	fullName := payload.Repository.FullName
	if cloneURL == "" {
		cloneURL = fmt.Sprintf("https://github.com/%s.git", fullName)
	}

	// Services tracking an App-connected repo store either the clone URL or
	// owner/name — match both like the per-repo receiver does.
	engineValue, _ := c.Get("deployment_engine")
	engine, _ := engineValue.(*deployment.DeploymentEngine)

	enqueued, err := dispatchPushToServices(c, db, engine, cloneURL, fullName, branch, commit, "")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to match services"})
		return
	}
	c.JSON(http.StatusAccepted, gin.H{
		"received":    true,
		"branch":      branch,
		"deployments": enqueued,
	})
}
