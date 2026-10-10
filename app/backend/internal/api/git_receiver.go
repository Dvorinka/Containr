package api

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"crypto/subtle"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"containr/internal/database"
	"containr/internal/database/sqlcdb"
	"containr/internal/deployment"
	"containr/internal/deployqueue"

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

	q := sqlcdb.New(db.DB)
	hook, err := q.GetGitWebhookForPush(context.Background(), uuid.MustParse(webhookID))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Webhook not found"})
		return
	}
	secret := hook.WebhookSecret
	branchFilter := hook.BranchFilter
	if !hook.Active.Bool {
		c.JSON(http.StatusForbidden, gin.H{"error": "Webhook is disabled"})
		return
	}

	body, err := io.ReadAll(io.LimitReader(c.Request.Body, 4<<20))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Failed to read payload"})
		return
	}

	providerName, _ := q.GetGitProviderNameByID(context.Background(), hook.ProviderID)

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

	// Non-push events that still mean "the repo changed": fork-sync bots
	// (sync), repository_dispatch, workflow_run completions. They carry no
	// `ref`, so fall back to the webhook's branch filter (or the service's
	// own git_branch via the repo match below).
	event := c.Request.Header.Get("X-GitHub-Event")
	if event == "" {
		event = c.Request.Header.Get("X-Gitea-Event")
	}
	syncEvent := event == "sync" || event == "repository_dispatch" || event == "workflow_run"

	if !strings.HasPrefix(payload.Ref, "refs/heads/") && !syncEvent {
		c.JSON(http.StatusAccepted, gin.H{"received": true, "ignored": "not a branch push"})
		return
	}
	branch := strings.TrimPrefix(payload.Ref, "refs/heads/")
	if branch == "" {
		branch = branchFilter
	}
	if branchFilter != "" && branchFilter != branch {
		c.JSON(http.StatusAccepted, gin.H{"received": true, "ignored": "branch not watched"})
		return
	}
	commit := payload.HeadCommit.ID
	if commit == "" {
		commit = payload.After
	}

	repo, err := q.GetGitRepoForPush(context.Background(), hook.RepoID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Repository not found"})
		return
	}
	cloneURL, fullName, repoUserID := repo.CloneUrl, repo.FullName, repo.UserID.String()

	engineValue, _ := c.Get("deployment_engine")
	engine, _ := engineValue.(*deployment.DeploymentEngine)

	enqueued, err := dispatchPushToServices(c, db, engine, cloneURL, fullName, branch, commit, repoUserID)
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

// dispatchPushToServices enqueues a deployment for every service tracking
// the pushed repo+branch. Shared by the per-repo webhook receiver and the
// GitHub App webhook endpoint.
func dispatchPushToServices(c *gin.Context, db *database.DB, engine *deployment.DeploymentEngine, cloneURL, fullName, branch, commit, repoUserID string) (int, error) {
	q := sqlcdb.New(db.DB)
	ctx := context.Background()
	// Sync-style events may carry no branch — empty branch matches all.
	rows, err := q.ListServicesForPush(ctx, sqlcdb.ListServicesForPushParams{
		GitBranch: sql.NullString{String: branch, Valid: true},
		GitRepo:   sql.NullString{String: cloneURL, Valid: true},
		GitRepo_2: sql.NullString{String: fullName, Valid: true},
	})
	if err != nil {
		return 0, err
	}

	var services []Service
	for _, row := range rows {
		services = append(services, Service{
			ID:          row.ID,
			ProjectID:   row.ProjectID,
			Name:        row.Name,
			Type:        row.Type,
			Status:      row.Status,
			Image:       row.Image,
			Command:     row.Command,
			Environment: row.Environment,
			GitRepo:     row.GitRepo,
			GitBranch:   row.GitBranch,
			BuildPath:   row.BuildPath,
			CPU:         row.Cpu,
			Memory:      row.Memory,
			CreatedAt:   row.CreatedAt.Time,
			UpdatedAt:   row.UpdatedAt.Time,
		})
	}

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
		if err := q.InsertDeployment(ctx, sqlcdb.InsertDeploymentParams{
			ID:         d.ID,
			ServiceID:  d.ServiceID,
			Version:    fmt.Sprintf("v%d", now.Unix()),
			CommitHash: sql.NullString{String: ptrStr(d.CommitHash), Valid: d.CommitHash != nil},
			Status:     sql.NullString{String: d.Status, Valid: true},
			ImageName:  sql.NullString{String: d.ImageName, Valid: true},
			ImageTag:   sql.NullString{String: d.ImageTag, Valid: true},
			CreatedAt:  sql.NullTime{Time: d.CreatedAt, Valid: true},
			UpdatedAt:  sql.NullTime{Time: d.UpdatedAt, Valid: true},
		}); err != nil {
			continue
		}
		if engine == nil {
			failure := "Deployment engine unavailable. Docker may not be configured on this server."
			failedAt := time.Now()
			_ = q.FailDeployment(ctx, sqlcdb.FailDeploymentParams{
				Error:       sql.NullString{String: failure, Valid: true},
				CompletedAt: sql.NullTime{Time: failedAt, Valid: true},
				ID:          d.ID,
			})
			continue
		}
		_ = q.SetServiceStatus(ctx, sqlcdb.SetServiceStatusParams{
			Status:    sql.NullString{String: "building", Valid: true},
			UpdatedAt: sql.NullTime{Time: time.Now(), Valid: true},
			ID:        service.ID,
		})
		// Webhook pushes default to a clean build — stale layers are the
		// classic silent-rollback failure (dflow convention).
		branchForBuild := branch
		if branchForBuild == "" {
			branchForBuild = service.GitBranch
		}
		webhookReq := CreateDeploymentRequest{CommitHash: commit, Branch: branchForBuild, Trigger: "webhook", NoCache: true}
		if pos := getDeployQueue(c).Enqueue(service.ID, deployqueue.Job{
			DeploymentID: d.ID,
			Run: func(jctx context.Context) {
				runDeploymentAndSync(jctx, db, engine, &d, service, webhookReq, repoUserID)
			},
		}); pos > 0 {
			now := sql.NullTime{Time: time.Now(), Valid: true}
			_ = q.SetDeploymentStatus(ctx, sqlcdb.SetDeploymentStatusParams{
				Status:    sql.NullString{String: "queued", Valid: true},
				UpdatedAt: now,
				ID:        d.ID,
			})
			_ = q.SetServiceStatus(ctx, sqlcdb.SetServiceStatusParams{
				Status:    sql.NullString{String: "queued", Valid: true},
				UpdatedAt: now,
				ID:        service.ID,
			})
		}
		enqueued++
	}
	return enqueued, nil
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
