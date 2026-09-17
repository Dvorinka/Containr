package api

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"time"

	"containr/internal/database"
	"containr/internal/deployment"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// handleGitWebhookPush is the public push receiver. Providers call
// POST /api/git/webhooks/:id with a signed payload; the HMAC against
// git_webhooks.webhook_secret replaces session auth.
func handleGitWebhookPush(c *gin.Context) {
	dbValue, exists := c.Get("db")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database connection not available"})
		return
	}
	db := dbValue.(*database.DB)

	webhookID := strings.TrimSpace(c.Param("id"))
	if _, err := uuid.Parse(webhookID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid webhook ID"})
		return
	}

	var (
		secret       string
		repoID       string
		providerID   string
		branchFilter string
		active       bool
	)
	err := db.QueryRow(`
		SELECT webhook_secret, repo_id, provider_id, COALESCE(branch_filter, ''), active
		FROM git_webhooks WHERE id = $1`, webhookID).
		Scan(&secret, &repoID, &providerID, &branchFilter, &active)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Webhook not found"})
		return
	}
	if !active {
		c.JSON(http.StatusForbidden, gin.H{"error": "Webhook is disabled"})
		return
	}

	body, err := io.ReadAll(io.LimitReader(c.Request.Body, 4<<20))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Failed to read payload"})
		return
	}

	var providerName string
	_ = db.QueryRow(`SELECT name FROM git_providers WHERE id = $1`, providerID).Scan(&providerName)

	if !verifyGitWebhookSignature(providerName, secret, c.Request, body) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid signature"})
		return
	}

	var payload struct {
		Ref        string `json:"ref"`
		After      string `json:"after"`
		Repository struct {
			FullName          string `json:"full_name"`
			PathWithNamespace string `json:"path_with_namespace"`
		} `json:"repository"`
		Project struct {
			PathWithNamespace string `json:"path_with_namespace"`
		} `json:"project"`
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
	if branchFilter != "" && branchFilter != branch {
		c.JSON(http.StatusAccepted, gin.H{"received": true, "ignored": "branch not watched"})
		return
	}
	commit := payload.HeadCommit.ID
	if commit == "" {
		commit = payload.After
	}

	var cloneURL, fullName, repoUserID string
	err = db.QueryRow(
		`SELECT clone_url, full_name, user_id FROM git_repositories WHERE id = $1`, repoID,
	).Scan(&cloneURL, &fullName, &repoUserID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Repository not found"})
		return
	}

	rows, err := db.Query(`
		SELECT s.id, s.project_id, s.name, s.type, s.status, s.image, s.command,
		       s.environment, s.git_repo, s.git_branch, s.build_path, s.cpu, s.memory,
		       s.created_at, s.updated_at
		FROM services s
		WHERE s.git_branch = $1 AND (s.git_repo = $2 OR s.git_repo = $3)`,
		branch, cloneURL, fullName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to match services"})
		return
	}
	defer rows.Close()

	var services []Service
	for rows.Next() {
		var s Service
		if err := rows.Scan(
			&s.ID, &s.ProjectID, &s.Name, &s.Type, &s.Status, &s.Image, &s.Command,
			&s.Environment, &s.GitRepo, &s.GitBranch, &s.BuildPath, &s.CPU, &s.Memory,
			&s.CreatedAt, &s.UpdatedAt,
		); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to scan service"})
			return
		}
		services = append(services, s)
	}

	engineValue, _ := c.Get("deployment_engine")
	engine, _ := engineValue.(*deployment.DeploymentEngine)

	enqueued := 0
	for _, service := range services {
		now := time.Now()
		var commitHash *string
		if commit != "" {
			commitHash = &commit
		}
		d := DeploymentModel{
			ID:         uuid.New(),
			ServiceID:  service.ID,
			CommitHash: commitHash,
			Status:     "pending",
			CreatedAt:  now,
			UpdatedAt:  now,
		}
		if _, err := db.Exec(
			`INSERT INTO deployments
			 (id, service_id, commit_hash, status, image_name, image_tag, created_at, updated_at)
			 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
			d.ID, d.ServiceID, d.CommitHash, d.Status, d.ImageName, d.ImageTag, d.CreatedAt, d.UpdatedAt,
		); err != nil {
			continue
		}
		if engine == nil {
			failedAt := time.Now()
			failure := "Deployment engine unavailable. Docker may not be configured on this server."
			_, _ = db.Exec(
				`UPDATE deployments SET status = 'failed', error = $1, completed_at = $2, updated_at = $2 WHERE id = $3`,
				failure, failedAt, d.ID,
			)
			continue
		}
		_, _ = db.Exec(
			`UPDATE services SET status = 'building', updated_at = $1 WHERE id = $2`,
			time.Now(), service.ID,
		)
		go runDeploymentAndSync(
			context.Background(), db, engine, &d, service,
			CreateDeploymentRequest{CommitHash: commit, Branch: branch, Trigger: "webhook"},
			repoUserID,
		)
		enqueued++
	}

	c.JSON(http.StatusAccepted, gin.H{
		"received":    true,
		"branch":      branch,
		"deployments": enqueued,
	})
}

// verifyGitWebhookSignature checks the push signature per provider:
// GitHub X-Hub-Signature-256 and Gitea X-Gitea-Signature are HMAC-SHA256 hex;
// GitLab compares X-Gitlab-Token to the stored secret directly.
func verifyGitWebhookSignature(provider, secret string, r *http.Request, body []byte) bool {
	if strings.EqualFold(provider, "gitlab") {
		token := r.Header.Get("X-Gitlab-Token")
		return token != "" && subtle.ConstantTimeCompare([]byte(token), []byte(secret)) == 1
	}
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(body)
	sum := mac.Sum(nil)
	for _, header := range []string{"X-Hub-Signature-256", "X-Gitea-Signature"} {
		sig := strings.TrimPrefix(r.Header.Get(header), "sha256=")
		if decoded, err := hex.DecodeString(sig); err == nil && len(decoded) > 0 && hmac.Equal(decoded, sum) {
			return true
		}
	}
	return false
}
