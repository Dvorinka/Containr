package api

import (
	"context"
	"log"
	"net/http"
	"os"
	"time"

	"containr/internal/build"
	"containr/internal/config"
	"containr/internal/database"
	"containr/internal/deployment"
	"containr/internal/deployqueue"
	"containr/internal/docker"
	"containr/internal/ha"
	"containr/internal/metrics"
	"containr/internal/middleware"
	"containr/internal/scaling"
	"containr/internal/secrets"

	"github.com/gin-gonic/gin"
)

func SetupRoutes(router *gin.Engine, db *database.DB, redis *database.Redis, cfg *config.Config) {
	// Expose Better Auth through backend so frontend can use a single backend origin.
	setupAuthProxyRoutes(router, cfg, db)

	// Initialize Docker client (non-fatal if it fails)
	var dockerClient *docker.Client
	var buildManager *build.BuildManager
	var deploymentEngine *deployment.DeploymentEngine

	if client, err := docker.NewClient(); err != nil {
		log.Printf("Warning: Failed to initialize Docker client: %v", err)
		log.Printf("Docker-related features will be disabled")
	} else {
		dockerClient = client
		buildManager = build.NewBuildManager("/tmp/containr-builds", dockerClient)
		deploymentEngine = deployment.NewDeploymentEngine(buildManager, dockerClient)
		// Restore managed sidecars (e.g. cloudflared) from saved settings.
		syncManagedContainers(dockerClient, db)
	}

	// Initialize build handler
	buildHandler := NewBuildHandler(buildManager, dockerClient, db)

	// Initialize scheduler and metrics systems
	scheduler := deployment.NewScheduler()
	var metricsStorage metrics.MetricsStorage = metrics.NewInMemoryMetricsStorage()
	if db != nil && db.DB != nil {
		metricsStorage = metrics.NewPostgreSQLMetricsStorage(db.DB)
	}
	metricsCollector := metrics.NewMetricsCollector(scheduler, metricsStorage)
	autoScaler := scaling.NewAutoScaler(scheduler, metricsCollector)
	if db != nil && db.DB != nil {
		autoScaler.WithPersistence(db.DB)
		if err := autoScaler.LoadPolicies(context.Background()); err != nil {
			log.Printf("Failed to restore scaling policies: %v", err)
		}
	}
	haManager := ha.NewHighAvailabilityManager(scheduler, metricsCollector)
	if db != nil && db.DB != nil {
		haManager.WithPersistence(db.DB)
		if err := haManager.LoadHealthChecks(context.Background()); err != nil {
			log.Printf("Failed to restore health checks: %v", err)
		}
	}
	if dockerClient != nil && db != nil {
		// Service-bound checks probe the service DNS name on the project
		// network — the backend container joins it on demand. The old
		// 127.0.0.1 fallback stays for node-bound checks.
		docker := dockerClient
		haManager.WithServiceResolver(func(ctx context.Context, serviceID string) (string, int, error) {
			var name, projectID string
			var port int
			err := db.QueryRowContext(ctx,
				`SELECT name, project_id::text, COALESCE(port, 0) FROM services WHERE id = $1`,
				serviceID,
			).Scan(&name, &projectID, &port)
			if err != nil {
				return "", 0, err
			}
			if err := docker.ConnectSelfToNetwork(ctx, deployment.ProjectNetworkName(projectID)); err != nil {
				return "", 0, err
			}
			return name, port, nil
		})
	}
	haAPIManager := NewHAManager(haManager)

	// Initialize scaling handler
	scalingHandler := NewScalingHandler(autoScaler)

	// Initialize agent handler (sqlc-backed)
	agentHandler := NewNodeAgentHandler(db)

	// Start the cron scheduler — executes due cron_jobs via docker exec.
	StartCronScheduler(context.Background(), db, dockerClient)

	// Initialize database handler
	databaseHandler := NewDatabaseHandler(db.DB, dockerClient)

	// Per-service serialized deploy queue — one active deployment per
	// service, the rest wait as 'queued'.
	deployQueue := deployqueue.New()

	// Encrypt-at-rest for secret env vars. SECRETS_KEY wins, JWT_SECRET is
	// the fallback so existing installs need no new config.
	secrets.Configure(os.Getenv("SECRETS_KEY"), cfg.JWTSecret)

	// Boot sweep: in-memory engine state dies on restart, so anything that
	// looked in-flight is actually orphaned — mark it failed rather than
	// leaving phantom 'building'/'queued' rows.
	_, _ = db.Exec(
		`UPDATE deployments SET status = 'failed', error = 'Interrupted by server restart', completed_at = NOW(), updated_at = NOW()
		 WHERE status IN ('queued', 'pending', 'building', 'deploying', 'rolling_back')`,
	)

	// Boot sweep: encrypt any plaintext secret values left over from before
	// encryption-at-rest landed. Transparent and idempotent.
	if encRows, err := db.Query(`SELECT id, value FROM environment_variables WHERE is_secret = TRUE`); err == nil {
		type encRow struct {
			id    string
			value string
		}
		var toEncrypt []encRow
		for encRows.Next() {
			var r encRow
			if err := encRows.Scan(&r.id, &r.value); err == nil && !secrets.IsEncrypted(r.value) {
				toEncrypt = append(toEncrypt, r)
			}
		}
		encRows.Close()
		for _, r := range toEncrypt {
			_, _ = db.Exec(`UPDATE environment_variables SET value = $1, updated_at = NOW() WHERE id = $2`, secrets.Encrypt(r.value), r.id)
		}
		if len(toEncrypt) > 0 {
			log.Printf("secrets: encrypted %d plaintext secret variable(s)", len(toEncrypt))
		}
	}

	// Initialize security handler
	securityHandler := NewSecurityHandler(db, cfg.JWTSecret)

	// Note: Proxmox integration can be added later if needed
	// For now, focusing on core Containr and APwhy functionality

	// Add database and JWT secret to gin context for handlers
	router.Use(func(c *gin.Context) {
		c.Set("db", db)
		c.Set("redis", redis)
		c.Set("jwt_secret", cfg.JWTSecret)
		c.Set("docker_client", dockerClient)
		c.Set("database_handler", databaseHandler)
		c.Set("build_manager", buildManager)
		if deploymentEngine != nil {
			c.Set("deployment_engine", deploymentEngine)
		}
		c.Set("deploy_queue", deployQueue)
		c.Set("scheduler", scheduler)
		c.Set("metrics_collector", metricsCollector)
		c.Set("auto_scaler", autoScaler)
		c.Set("ha_manager", haManager)
		c.Set("scaling_handler", scalingHandler)
		c.Next()
	})

	// Seed the official service template catalog (idempotent upserts).
	go SeedOfficialTemplates(context.Background(), db)

	go func() {
		if err := haManager.Start(context.Background()); err != nil {
			log.Printf("HA manager exited: %v", err)
		}
	}()

	// Health check endpoint
	router.GET("/live", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":  "ok",
			"service": "containr-api",
		})
	})
	router.HEAD("/live", func(c *gin.Context) {
		c.Status(http.StatusOK)
	})

	healthHandler := func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(c.Request.Context(), 2*time.Second)
		defer cancel()

		databaseStatus := "ok"
		redisStatus := "ok"
		checks := gin.H{
			"database": databaseStatus,
			"redis":    redisStatus,
		}
		overallStatus := "ok"
		statusCode := http.StatusOK

		if err := db.Health(ctx); err != nil {
			databaseStatus = "unhealthy"
			checks["database"] = databaseStatus
			checks["databaseError"] = err.Error()
			overallStatus = "degraded"
			statusCode = http.StatusServiceUnavailable
		}

		if redis == nil {
			redisStatus = "unhealthy"
			checks["redis"] = "unhealthy"
			checks["redisError"] = "redis client not initialized"
			overallStatus = "degraded"
			statusCode = http.StatusServiceUnavailable
		} else if err := redis.Health(ctx); err != nil {
			redisStatus = "unhealthy"
			checks["redis"] = redisStatus
			checks["redisError"] = err.Error()
			overallStatus = "degraded"
			statusCode = http.StatusServiceUnavailable
		}

		c.JSON(statusCode, gin.H{
			"status":  overallStatus,
			"service": "containr-api",
			"checks":  checks,
		})
	}
	router.GET("/health", healthHandler)
	router.HEAD("/health", healthHandler)
	router.GET("/ready", healthHandler)
	router.HEAD("/ready", healthHandler)

	// API v1 routes
	publicAgents := router.Group("/api")
	agentHandler.SetupPublicRoutes(publicAgents)

	// Public push receiver: HMAC signature on git_webhooks.webhook_secret
	// replaces session auth. Providers POST to /api/git/webhooks/:id.
	router.POST("/api/git/webhooks/:id", handleGitWebhookPush)

	v1 := router.Group("/api/v1")
	{
		// Public routes (no authentication required)
		public := v1.Group("/")
		{
			public.GET("/auth/bootstrap", handleAuthBootstrap)
			public.POST("/auth/login", handleLogin)
			public.POST("/auth/register", handleRegister)
			public.GET("/maintenance", handleMaintenancePage)
		}

		// Read routes — public browsing. OptionalAuth resolves a session when
		// present so handlers can widen visibility for owners/admins; anonymous
		// callers see approved resources only.
		read := v1.Group("/")
		read.Use(middleware.OptionalAuth(cfg.JWTSecret))
		{
			read.GET("/projects", handleGetProjects)
			read.GET("/projects/:id", handleGetProject)
			read.GET("/projects/:id/services", handleGetServices)
			read.GET("/projects/:id/preview-environments", handleGetPreviewEnvironments)
			read.GET("/projects/:id/security/history", securityHandler.GetProjectSecurityHistory)
			read.GET("/projects/:id/vulnerabilities", securityHandler.GetVulnerabilities)
			read.GET("/projects/:id/security/metrics", securityHandler.GetSecurityMetrics)

			read.GET("/services/:id", handleGetService)
			read.GET("/services/:id/metrics", handleGetServiceMetrics)
			read.GET("/services/:id/runtime", handleGetServiceRuntime)
			read.GET("/services/:id/deployments", handleGetDeployments)
			read.GET("/services/:id/domains", handleListServiceDomains)
			read.GET("/services/:id/domains/check", handleCheckServiceDomains)
			read.GET("/deployments", handleGetRecentDeployments)
			read.GET("/deployments/:id", handleGetDeployment)

			read.GET("/databases", databaseHandler.GetDatabases)
			read.GET("/databases/:id", databaseHandler.GetDatabase)

			read.GET("/templates", handleGetTemplates)
			read.GET("/templates/:id", handleGetTemplate)

			read.GET("/cron-jobs", handleGetCronJobs)
			read.GET("/cron-jobs/:id", handleGetCronJob)
			read.GET("/cron-jobs/:id/executions", handleGetCronExecutions)

			read.GET("/security/scans/:id", securityHandler.GetSecurityScan)
			read.GET("/security/compliance/reports/:id", securityHandler.GetComplianceReport)
			read.GET("/security/compliance/frameworks", securityHandler.GetComplianceFrameworks)

			read.GET("/preview-environments/:id", handleGetPreviewEnvironment)

			read.GET("/system/upgrade/status", handleGetUpgradeStatus)
			read.GET("/system/host", handleGetHostMonitoring)

			// HA + scaling read endpoints (status, policies, health, alerts)
			haAPIManager.RegisterReadRoutes(read)
			scalingHandler.RegisterReadRoutes(read)
		}

		// Authenticated routes — a valid session is required and handlers
		// enforce ownership; platform admins additionally pass every check.
		authed := v1.Group("/")
		authed.Use(middleware.Auth(cfg.JWTSecret))
		authed.Use(middleware.Idempotency())
		{
			authed.GET("/user/profile", handleGetProfile)
			authed.PUT("/user/profile", handleUpdateProfile)

			// Personal access tokens for CLI/MCP/agent auth.
			authed.GET("/user/tokens", handleListUserTokens)
			authed.POST("/user/tokens", handleCreateUserToken)
			authed.DELETE("/user/tokens/:id", handleDeleteUserToken)

			authed.GET("/notifications", handleListNotifications)
			authed.POST("/notifications/:id/read", handleMarkNotificationRead)
			authed.POST("/notifications/read-all", handleMarkAllNotificationsRead)

			// WebSocket endpoint
			authed.GET("/ws", handleWebSocket)

			// Owned-resource mutations — handlers scope to the caller and
			// admit admins. New projects land unapproved until an admin
			// publishes them.
			authed.POST("/projects", handleCreateProject)
			authed.POST("/projects/:id/services", handleCreateService)
			authed.PUT("/projects/:id", handleUpdateProject)
			authed.DELETE("/projects/:id", handleDeleteProject)

			authed.PUT("/services/:id", handleUpdateService)
			authed.DELETE("/services/:id", handleDeleteService)
			authed.POST("/services/:id/domains", handleAddServiceDomain)
			authed.DELETE("/services/:id/domains/:domain_id", handleDeleteServiceDomain)
			authed.POST("/services/:id/domains/:domain_id/default", handleSetDefaultDomain)
			authed.POST("/services/:id/start", handleServiceStart)
			authed.POST("/services/:id/stop", handleServiceStop)
			authed.POST("/services/:id/restart", handleServiceRestart)
			authed.POST("/services/:id/redeploy", handleServiceRedeploy)
			authed.POST("/services/:id/clone", handleCloneService)
			authed.POST("/services/:id/move", handleMoveService)
			authed.POST("/services/:id/deployments", handleCreateDeployment)
			authed.POST("/deployments/:id/rollback", handleRollbackDeployment)
			authed.POST("/deployments/:id/cancel", handleCancelDeployment)

			// Environment variables — secrets, owner/admin only.
			authed.GET("/services/:id/variables", handleGetVariables)
			authed.PUT("/services/:id/variables", handleUpdateVariables)

			// Runtime logs — container stdout routinely echoes secrets,
			// so these stay behind authentication like build logs.
			authed.GET("/services/:id/logs", handleGetLogs)
			authed.GET("/deployments/:id/logs", handleGetDeploymentLogs)

			// One-off exec console (docker exec, 30s ceiling)
			authed.POST("/services/:id/exec", handleExecInService)

			// S3-compatible backup targets — owner-scoped, keys encrypted at rest.
			authed.GET("/backup-targets", databaseHandler.ListBackupTargets)
			authed.POST("/backup-targets", databaseHandler.CreateBackupTarget)
			authed.PUT("/backup-targets/:id", databaseHandler.UpdateBackupTarget)
			authed.DELETE("/backup-targets/:id", databaseHandler.DeleteBackupTarget)
			authed.POST("/backup-targets/:id/test", databaseHandler.TestBackupTarget)

			// Private-image registries — owner-scoped, credentials encrypted at rest.
			authed.GET("/registries", handleListRegistries)
			authed.POST("/registries", handleCreateRegistry)
			authed.PUT("/registries/:id", handleUpdateRegistry)
			authed.DELETE("/registries/:id", handleDeleteRegistry)

			// Git integration — providers carry per-user credentials.
			authed.GET("/git/github-app/install-url", handleGetGitHubAppInstallURL)
			authed.POST("/git/github-app/connect", handleConnectGitHubApp)
			authed.GET("/git/providers", handleGetGitProviders)
			authed.POST("/git/providers", handleCreateGitProvider)
			authed.DELETE("/git/providers/:providerId", handleDeleteGitProvider)
			authed.GET("/git/providers/:providerId/repositories", handleGetGitRepositories)
			authed.GET("/git/providers/:providerId/repositories/:owner/:repo/branches", handleGetGitRepositoryBranches)
			authed.POST("/git/repositories/connect", handleConnectGitRepository)
			authed.GET("/git/repositories", handleGetConnectedRepositories)
			authed.POST("/git/webhooks", handleCreateWebhook)

			// Builds have no per-user scoping and logs may carry secrets —
			// keep every build endpoint behind authentication.
			authed.POST("/builds", buildHandler.StartBuild)
			authed.GET("/builds", buildHandler.ListBuilds)
			authed.GET("/builds/:id", buildHandler.GetBuildStatus)
			authed.GET("/builds/:id/logs", buildHandler.GetBuildLogs)
			authed.GET("/builds/detect", buildHandler.DetectBuildType)
			authed.POST("/builds/:id/cancel", buildHandler.CancelBuild)
			authed.POST("/builds/plan", buildHandler.GetBuildPlan)

			authed.POST("/databases", databaseHandler.CreateDatabase)
			authed.POST("/databases/register-external", databaseHandler.RegisterExternalDatabase)
			authed.POST("/databases/test-connection", databaseHandler.TestDatabaseConnection)
			authed.POST("/databases/:id/test-connection", databaseHandler.TestDatabaseConnectionByID)
			authed.PUT("/databases/:id", databaseHandler.UpdateDatabase)
			authed.DELETE("/databases/:id", databaseHandler.DeleteDatabase)
			authed.POST("/databases/:id/action", databaseHandler.PerformDatabaseAction)
			authed.POST("/databases/:id/backup", databaseHandler.CreateBackup)
			authed.POST("/databases/:id/restore", databaseHandler.RestoreBackup)
			authed.GET("/databases/:id/backups/:bid/download", databaseHandler.DownloadBackup)

			authed.POST("/projects/:id/preview-environments", handleCreatePreviewEnvironment)
			authed.PUT("/preview-environments/:id", handleUpdatePreviewEnvironment)
			authed.DELETE("/preview-environments/:id", handleDeletePreviewEnvironment)
			authed.POST("/preview-environments/:id/promote", handlePromotePreviewEnvironment)

			authed.POST("/security/scans", securityHandler.StartSecurityScan)
			authed.PUT("/vulnerabilities/:id", securityHandler.UpdateVulnerability)
			authed.POST("/security/compliance/assess", securityHandler.StartComplianceAssessment)
			authed.POST("/security/compliance/gdpr/init", securityHandler.InitializeGDPRFramework)
			authed.GET("/projects/:id/security/audit-logs", securityHandler.GetAuditLogs)

			// User templates — ownership enforced inside the handlers.
			authed.POST("/templates", handleCreateTemplate)
			authed.PUT("/templates/:id", handleUpdateTemplate)
			authed.DELETE("/templates/:id", handleDeleteTemplate)
			authed.POST("/templates/:id/deploy", handleCreateFromTemplate)

			authed.POST("/cron-jobs", handleCreateCronJob)
			authed.PUT("/cron-jobs/:id", handleUpdateCronJob)
			authed.DELETE("/cron-jobs/:id", handleDeleteCronJob)
			authed.POST("/cron-jobs/:id/trigger", handleTriggerCronJob)
		}

		// Admin routes — platform-wide controls and cross-user management.
		admin := v1.Group("/")
		admin.Use(middleware.Auth(cfg.JWTSecret))
		admin.Use(middleware.Idempotency())
		admin.Use(middleware.RequireAdmin())
		{
			admin.GET("/admin/overview", handleAdminOverview)
			admin.GET("/admin/users", handleAdminListUsers)
			admin.PATCH("/admin/users/:id", handleAdminSetUserAdmin)
			admin.PATCH("/admin/projects/:id", handleAdminSetProjectApproval)

			admin.POST("/users", handleCreateUser)

			admin.GET("/settings", handleGetSettings)
			admin.PUT("/settings", handleUpdateSettings)

			admin.POST("/system/upgrade/pull", handlePullUpgradeImage)
			admin.POST("/preview-environments/cleanup-expired", handleCleanupExpiredPreviewEnvironments)

			// HA + scaling + agent mutations — platform-level controls.
			haAPIManager.RegisterAdminRoutes(admin)
			scalingHandler.RegisterAdminRoutes(admin)
			agentHandler.SetupAdminRoutes(admin)

			admin.GET("/admin/volumes", handleAdminListVolumes)
			admin.DELETE("/admin/volumes/:name", handleAdminDeleteVolume)
			admin.GET("/audit-logs", handleGetAuditLogs)
			admin.GET("/audit-logs/:resource/:id", handleGetResourceAuditLogs)

			// API Gateway routes (merged APwhy) - namespaced to avoid
			// colliding with Containr's own /services paths.
			gateway := admin.Group("/gateway")
			{
				gateway.GET("/services", handleAPwhyServicesList)
				gateway.POST("/services", handleAPwhyServicesCreate)
				gateway.PATCH("/services/:id", handleAPwhyServicesPatch)
				gateway.GET("/services/:id", handleAPwhyServiceValidate)

				gateway.GET("/keys", handleAPwhyKeysList)
				gateway.POST("/keys", handleAPwhyKeysCreate)
				gateway.PATCH("/keys/:id", handleAPwhyKeysPatch)

				gateway.GET("/analytics/ops", handleAPwhyAnalyticsOps)
				gateway.GET("/analytics/traffic", handleAPwhyAnalyticsTraffic)
			}
		}
	}
}
