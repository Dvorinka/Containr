package api

import (
	"log"

	"containr/internal/build"
	"containr/internal/config"
	"containr/internal/database"
	"containr/internal/deployment"
	"containr/internal/docker"
	"containr/internal/metrics"
	"containr/internal/middleware"
	"containr/internal/proxmox"
	"containr/internal/scaling"

	"github.com/gin-gonic/gin"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func SetupRoutes(router *gin.Engine, db *database.DB, redis *database.Redis, cfg *config.Config) {
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
	}

	// Initialize build handler
	buildHandler := NewBuildHandler(buildManager, dockerClient)

	// Initialize scheduler and metrics systems
	scheduler := deployment.NewScheduler()
	metricsStorage := metrics.NewInMemoryMetricsStorage() // Use in-memory for now
	metricsCollector := metrics.NewMetricsCollector(scheduler, metricsStorage)
	autoScaler := scaling.NewAutoScaler(scheduler, metricsCollector)

	// Initialize scaling handler
	scalingHandler := NewScalingHandler(autoScaler)

	// Initialize GORM for agent system
	gormDB, err := gorm.Open(postgres.Open(cfg.DatabaseURL), &gorm.Config{})
	if err != nil {
		panic("Failed to initialize GORM: " + err.Error())
	}

	// Initialize agent handler
	agentHandler := NewNodeAgentHandler(gormDB)

	// Initialize database handler
	databaseHandler := NewDatabaseHandler(db.DB)

	// Initialize security handler
	securityHandler := NewSecurityHandler(db, cfg.JWTSecret)

	// Initialize Proxmox service if configured
	var proxmoxService *proxmox.Service
	if cfg.Proxmox.BaseURL != "" {
		proxmoxConfig := proxmox.Config{
			BaseURL:  cfg.Proxmox.BaseURL,
			Username: cfg.Proxmox.Username,
			Password: cfg.Proxmox.Password,
			TokenID:  cfg.Proxmox.TokenID,
			Token:    cfg.Proxmox.Token,
		}
		proxmoxService = proxmox.NewService(proxmoxConfig)

		// Register Proxmox routes
		RegisterProxmoxRoutes(router, proxmoxService)
	}

	// Add database and JWT secret to gin context for handlers
	router.Use(func(c *gin.Context) {
		c.Set("db", db)
		c.Set("redis", redis)
		c.Set("jwt_secret", cfg.JWTSecret)
		c.Set("docker_client", dockerClient)
		c.Set("build_manager", buildManager)
		if deploymentEngine != nil {
			c.Set("deployment_engine", deploymentEngine)
		}
		c.Set("scheduler", scheduler)
		c.Set("metrics_collector", metricsCollector)
		c.Set("auto_scaler", autoScaler)
		c.Set("scaling_handler", scalingHandler)
		c.Set("gorm_db", gormDB)
		if proxmoxService != nil {
			c.Set("proxmox", proxmoxService)
		}
		c.Next()
	})

	// Health check endpoint
	router.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"status":  "ok",
			"service": "containr-api",
		})
	})

	// API v1 routes
	v1 := router.Group("/api/v1")
	{
		// Public routes (no authentication required)
		public := v1.Group("/")
		{
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

			// Git integration routes
			protected.GET("/git/providers", handleGetGitProviders)
			protected.POST("/git/providers", handleCreateGitProvider)
			protected.GET("/git/providers/:providerId/repositories", handleGetGitRepositories)
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

			// Scaling routes
			scalingHandler.RegisterRoutes(protected)

			// Database routes
			protected.GET("/databases", databaseHandler.GetDatabases)
			protected.POST("/databases", databaseHandler.CreateDatabase)
			protected.GET("/databases/:id", databaseHandler.GetDatabase)
			protected.PUT("/databases/:id", databaseHandler.UpdateDatabase)
			protected.DELETE("/databases/:id", databaseHandler.DeleteDatabase)
			protected.POST("/databases/:id/action", databaseHandler.PerformDatabaseAction)
			protected.POST("/databases/:id/backup", databaseHandler.CreateBackup)
			protected.POST("/databases/:id/restore", databaseHandler.RestoreBackup)

			// Node Agent routes
			api := router.Group("/api")
			agentHandler.SetupRoutes(api)

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
		}
	}
}
