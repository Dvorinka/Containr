package api

import (
	"context"
	"log"
	"net/http"
	"time"

	"containr/internal/build"
	"containr/internal/config"
	"containr/internal/database"
	"containr/internal/deployment"
	"containr/internal/docker"
	"containr/internal/ha"
	"containr/internal/metrics"
	"containr/internal/middleware"
	"containr/internal/scaling"

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
	haAPIManager := NewHAManager(haManager)

	// Initialize scaling handler
	scalingHandler := NewScalingHandler(autoScaler)

	// Initialize agent handler (sqlc-backed)
	agentHandler := NewNodeAgentHandler(db)

	// Start the cron scheduler — executes due cron_jobs via docker exec.
	StartCronScheduler(context.Background(), db, dockerClient)

	// Initialize database handler
	databaseHandler := NewDatabaseHandler(db.DB, dockerClient)

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
		c.Set("scheduler", scheduler)
		c.Set("metrics_collector", metricsCollector)
		c.Set("auto_scaler", autoScaler)
		c.Set("ha_manager", haManager)
		c.Set("scaling_handler", scalingHandler)
		c.Next()
	})

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
			checks["redis"] = redisStatus
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
		}

		// Protected routes (authentication required)
		protected := v1.Group("/")
		protected.Use(middleware.Auth(cfg.JWTSecret))
		{
			// User routes
			protected.GET("/user/profile", handleGetProfile)
			protected.PUT("/user/profile", handleUpdateProfile)
			protected.POST("/users", handleCreateUser)

			// Platform settings (admin-gated inside handlers)
			protected.GET("/settings", handleGetSettings)
			protected.PUT("/settings", handleUpdateSettings)

			// Project routes
			protected.GET("/projects", handleGetProjects)
			protected.POST("/projects", handleCreateProject)

			// Service routes (nested under projects)
			protected.GET("/projects/:id/services", handleGetServices)
			protected.POST("/projects/:id/services", handleCreateService)

			// Generic project routes
			protected.GET("/projects/:id", handleGetProject)
			protected.PUT("/projects/:id", handleUpdateProject)
			protected.DELETE("/projects/:id", handleDeleteProject)

			// Service routes
			protected.GET("/services/:id", handleGetService)
			protected.PUT("/services/:id", handleUpdateService)
			protected.DELETE("/services/:id", handleDeleteService)
			protected.GET("/services/:id/metrics", handleGetServiceMetrics)

			// Runtime lifecycle (Railway-style)
			protected.GET("/services/:id/runtime", handleGetServiceRuntime)
			protected.POST("/services/:id/start", handleServiceStart)
			protected.POST("/services/:id/stop", handleServiceStop)
			protected.POST("/services/:id/restart", handleServiceRestart)
			protected.POST("/services/:id/redeploy", handleServiceRedeploy)

			// Deployment routes
			protected.GET("/services/:id/deployments", handleGetDeployments)
			protected.POST("/services/:id/deployments", handleCreateDeployment)
			protected.GET("/deployments/:id", handleGetDeployment)
			protected.POST("/deployments/:id/rollback", handleRollbackDeployment)

			// Environment variables routes
			protected.GET("/services/:id/variables", handleGetVariables)
			protected.PUT("/services/:id/variables", handleUpdateVariables)

			// Logs routes
			protected.GET("/services/:id/logs", handleGetLogs)
			protected.GET("/deployments/:id/logs", handleGetDeploymentLogs)

			// One-off exec console (docker exec, 30s ceiling)
			protected.POST("/services/:id/exec", handleExecInService)

			// Git integration routes
			protected.GET("/git/github-app/install-url", handleGetGitHubAppInstallURL)
			protected.POST("/git/github-app/connect", handleConnectGitHubApp)
			protected.GET("/git/providers", handleGetGitProviders)
			protected.POST("/git/providers", handleCreateGitProvider)
			protected.DELETE("/git/providers/:providerId", handleDeleteGitProvider)
			protected.GET("/git/providers/:providerId/repositories", handleGetGitRepositories)
			protected.GET("/git/providers/:providerId/repositories/:owner/:repo/branches", handleGetGitRepositoryBranches)
			protected.POST("/git/repositories/connect", handleConnectGitRepository)
			protected.GET("/git/repositories", handleGetConnectedRepositories)
			protected.POST("/git/webhooks", handleCreateWebhook)

			// Build routes
			protected.POST("/builds", buildHandler.StartBuild)
			protected.GET("/builds", buildHandler.ListBuilds)
			protected.GET("/builds/:id", buildHandler.GetBuildStatus)
			protected.POST("/builds/:id/cancel", buildHandler.CancelBuild)
			protected.GET("/builds/:id/logs", buildHandler.GetBuildLogs)
			protected.POST("/builds/plan", buildHandler.GetBuildPlan)
			protected.GET("/builds/detect", buildHandler.DetectBuildType)

			// System routes
			protected.GET("/system/upgrade/status", handleGetUpgradeStatus)
			protected.POST("/system/upgrade/pull", handlePullUpgradeImage)
			protected.GET("/system/host", handleGetHostMonitoring)

			// Scaling routes
			scalingHandler.RegisterRoutes(protected)
			haAPIManager.RegisterRoutes(protected)

			// Database routes
			protected.GET("/databases", databaseHandler.GetDatabases)
			protected.POST("/databases", databaseHandler.CreateDatabase)
			protected.GET("/databases/:id", databaseHandler.GetDatabase)
			protected.PUT("/databases/:id", databaseHandler.UpdateDatabase)
			protected.DELETE("/databases/:id", databaseHandler.DeleteDatabase)
			protected.POST("/databases/:id/action", databaseHandler.PerformDatabaseAction)
			protected.POST("/databases/:id/backup", databaseHandler.CreateBackup)
			protected.POST("/databases/:id/restore", databaseHandler.RestoreBackup)
			protected.GET("/databases/:id/backups/:bid/download", databaseHandler.DownloadBackup)

			// Notification routes
			protected.GET("/notifications", handleListNotifications)
			protected.POST("/notifications/:id/read", handleMarkNotificationRead)
			protected.POST("/notifications/read-all", handleMarkAllNotificationsRead)

			// Node Agent routes
			agentHandler.SetupRoutes(protected)

			// Preview Environments routes
			protected.GET("/projects/:id/preview-environments", handleGetPreviewEnvironments)
			protected.POST("/projects/:id/preview-environments", handleCreatePreviewEnvironment)
			protected.GET("/preview-environments/:id", handleGetPreviewEnvironment)
			protected.PUT("/preview-environments/:id", handleUpdatePreviewEnvironment)
			protected.DELETE("/preview-environments/:id", handleDeletePreviewEnvironment)
			protected.POST("/preview-environments/:id/promote", handlePromotePreviewEnvironment)
			protected.POST("/preview-environments/cleanup-expired", handleCleanupExpiredPreviewEnvironments)

			// Security routes
			protected.POST("/security/scans", securityHandler.StartSecurityScan)
			protected.GET("/security/scans/:id", securityHandler.GetSecurityScan)
			protected.GET("/projects/:id/security/history", securityHandler.GetProjectSecurityHistory)
			protected.GET("/projects/:id/vulnerabilities", securityHandler.GetVulnerabilities)
			protected.PUT("/vulnerabilities/:id", securityHandler.UpdateVulnerability)
			protected.POST("/security/compliance/assess", securityHandler.StartComplianceAssessment)
			protected.GET("/security/compliance/reports/:id", securityHandler.GetComplianceReport)
			protected.GET("/security/compliance/frameworks", securityHandler.GetComplianceFrameworks)
			protected.POST("/security/compliance/gdpr/init", securityHandler.InitializeGDPRFramework)
			protected.GET("/projects/:id/security/metrics", securityHandler.GetSecurityMetrics)
			protected.GET("/projects/:id/security/audit-logs", securityHandler.GetAuditLogs)

			// WebSocket endpoint
			protected.GET("/ws", handleWebSocket)

			// Templates routes
			protected.GET("/templates", handleGetTemplates)
			protected.GET("/templates/:id", handleGetTemplate)
			protected.POST("/templates/:id/deploy", handleCreateFromTemplate)

			// Cron Jobs routes
			protected.GET("/cron-jobs", handleGetCronJobs)
			protected.POST("/cron-jobs", handleCreateCronJob)
			protected.GET("/cron-jobs/:id", handleGetCronJob)
			protected.PUT("/cron-jobs/:id", handleUpdateCronJob)
			protected.DELETE("/cron-jobs/:id", handleDeleteCronJob)
			protected.GET("/cron-jobs/:id/executions", handleGetCronExecutions)
			protected.POST("/cron-jobs/:id/trigger", handleTriggerCronJob)

			// Audit Logs routes
			protected.GET("/audit-logs", handleGetAuditLogs)
			protected.GET("/audit-logs/:resource/:id", handleGetResourceAuditLogs)

			// API Gateway routes (merged APwhy) - namespaced to avoid
			// colliding with Containr's own /services paths.
			gateway := protected.Group("/gateway")
			{
				gateway.GET("/services", handleAPwhyServicesList)
				gateway.POST("/services", handleAPwhyServicesCreate)
				gateway.PATCH("/services/:id", handleAPwhyServicesPatch)
				gateway.GET("/services/:id/validate", handleAPwhyServiceValidate)

				gateway.GET("/keys", handleAPwhyKeysList)
				gateway.POST("/keys", handleAPwhyKeysCreate)
				gateway.PATCH("/keys/:id", handleAPwhyKeysPatch)

				gateway.GET("/analytics/ops", handleAPwhyAnalyticsOps)
				gateway.GET("/analytics/traffic", handleAPwhyAnalyticsTraffic)
			}
		}
	}
}
