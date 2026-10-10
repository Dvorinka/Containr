package api

import (
	"containr/internal/database"
	"containr/internal/database/sqlcdb"
	"containr/internal/deployment"
	"containr/internal/deployqueue"
	"containr/internal/docker"
	"containr/internal/source"
	"containr/internal/types"
	"context"
	"database/sql"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type DeploymentModel struct {
	ID          uuid.UUID  `json:"id" db:"id"`
	ServiceID   uuid.UUID  `json:"service_id" db:"service_id"`
	CommitHash  *string    `json:"commit_hash" db:"commit_hash"`
	Status      string     `json:"status" db:"status"`
	ImageName   string     `json:"image_name" db:"image_name"`
	ImageTag    string     `json:"image_tag" db:"image_tag"`
	BuildLog    string     `json:"build_log" db:"build_log"`
	RuntimeLog  string     `json:"runtime_log" db:"runtime_log"`
	Error       *string    `json:"error" db:"error"`
	StartedAt   *time.Time `json:"started_at" db:"started_at"`
	CompletedAt *time.Time `json:"completed_at" db:"completed_at"`
	CreatedAt   time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at" db:"updated_at"`
}

// deploymentRowShape carries the deployment columns shared by the
// generated list/detail/rollback row types.
type deploymentRowShape struct {
	ID          uuid.UUID
	ServiceID   uuid.UUID
	CommitHash  sql.NullString
	Status      sql.NullString
	ImageName   sql.NullString
	ImageTag    sql.NullString
	BuildLog    sql.NullString
	RuntimeLog  sql.NullString
	Error       sql.NullString
	StartedAt   sql.NullTime
	CompletedAt sql.NullTime
	CreatedAt   sql.NullTime
	UpdatedAt   sql.NullTime
}

func strPtrNS(v sql.NullString) *string {
	if !v.Valid {
		return nil
	}
	s := v.String
	return &s
}

func ptrStr(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

func timePtrNT(v sql.NullTime) *time.Time {
	if !v.Valid {
		return nil
	}
	t := v.Time
	return &t
}

func ntPtr(t *time.Time) sql.NullTime {
	if t == nil {
		return sql.NullTime{}
	}
	return sql.NullTime{Time: *t, Valid: true}
}

func deploymentModelFrom(r deploymentRowShape) DeploymentModel {
	return DeploymentModel{
		ID:          r.ID,
		ServiceID:   r.ServiceID,
		CommitHash:  strPtrNS(r.CommitHash),
		Status:      r.Status.String,
		ImageName:   r.ImageName.String,
		ImageTag:    r.ImageTag.String,
		BuildLog:    r.BuildLog.String,
		RuntimeLog:  r.RuntimeLog.String,
		Error:       strPtrNS(r.Error),
		StartedAt:   timePtrNT(r.StartedAt),
		CompletedAt: timePtrNT(r.CompletedAt),
		CreatedAt:   r.CreatedAt.Time,
		UpdatedAt:   r.UpdatedAt.Time,
	}
}

type CreateDeploymentRequest struct {
	CommitHash string            `json:"commit_hash"`
	Branch     string            `json:"branch"`
	Trigger    string            `json:"trigger"`
	EnvVars    map[string]string `json:"env_vars"`
	NoCache    bool              `json:"no_cache"`
}

type DeploymentResponse struct {
	ID          uuid.UUID  `json:"id"`
	ServiceID   uuid.UUID  `json:"service_id"`
	CommitHash  *string    `json:"commit_hash"`
	Status      string     `json:"status"`
	ImageName   string     `json:"image_name"`
	ImageTag    string     `json:"image_tag"`
	StartedAt   *time.Time `json:"started_at,omitempty"`
	CompletedAt *time.Time `json:"completed_at,omitempty"`
	CreatedAt   time.Time  `json:"created_at"`
	Error       *string    `json:"error,omitempty"`
}

func handleGetDeployments(c *gin.Context) {
	db, exists := c.Get("db")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database connection not available"})
		return
	}

	serviceIDStr := c.Param("id")
	serviceID, err := uuid.Parse(serviceIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid service ID"})
		return
	}

	projectID, found := serviceProjectID(db.(*database.DB), serviceID)
	if !found {
		c.JSON(http.StatusNotFound, gin.H{"error": "Service not found"})
		return
	}
	if _, allowed := projectReadAccess(c, db.(*database.DB), projectID); !allowed {
		c.JSON(http.StatusNotFound, gin.H{"error": "Service not found"})
		return
	}

	offset, limit := pageWindow(c, 50, 100)

	q := sqlcdb.New(db.(*database.DB).DB)
	total, _ := q.CountDeploymentsForService(c.Request.Context(), serviceID)

	rows, err := q.ListDeploymentsForService(c.Request.Context(), sqlcdb.ListDeploymentsForServiceParams{
		ServiceID: serviceID, Limit: int32(limit), Offset: int32(offset)})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve deployments"})
		return
	}

	deployments := make([]DeploymentModel, 0, len(rows))
	for _, r := range rows {
		deployments = append(deployments, deploymentModelFrom(deploymentRowShape{
			ID: r.ID, ServiceID: r.ServiceID, CommitHash: r.CommitHash, Status: r.Status,
			ImageName: r.ImageName, ImageTag: r.ImageTag, BuildLog: r.BuildLog,
			RuntimeLog: r.RuntimeLog, Error: r.Error, StartedAt: r.StartedAt,
			CompletedAt: r.CompletedAt, CreatedAt: r.CreatedAt, UpdatedAt: r.UpdatedAt,
		}))
	}

	c.JSON(http.StatusOK, gin.H{
		"deployments": deployments,
		"pagination":  paginationMeta(offset, limit, int(total)),
	})
}

// RecentDeployment is a deployment row joined with its service and project names.
type RecentDeployment struct {
	ID          uuid.UUID  `json:"id"`
	ServiceID   uuid.UUID  `json:"service_id"`
	ServiceName string     `json:"service_name"`
	ProjectName string     `json:"project_name"`
	Status      string     `json:"status"`
	ImageName   string     `json:"image_name"`
	StartedAt   *time.Time `json:"started_at"`
	CompletedAt *time.Time `json:"completed_at"`
	CreatedAt   time.Time  `json:"created_at"`
}

// handleGetRecentDeployments lists the latest deployments across all of the
// caller's services — feeds the dashboard deploy feed.
func handleGetRecentDeployments(c *gin.Context) {
	db, exists := c.Get("db")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database connection not available"})
		return
	}

	userID := optionalUserUUID(c)
	isAdmin := contextIsAdmin(c)

	offset, limit := pageWindow(c, 10, 50)

	q := sqlcdb.New(db.(*database.DB).DB)
	total, err := q.CountAccessibleDeployments(c.Request.Context(), sqlcdb.CountAccessibleDeploymentsParams{
		OwnerID: userID, Column2: isAdmin})
	if err != nil {
		total = 0
	}

	rows, err := q.ListRecentAccessibleDeployments(c.Request.Context(), sqlcdb.ListRecentAccessibleDeploymentsParams{
		OwnerID: userID, Column2: isAdmin, Limit: int32(limit), Offset: int32(offset)})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve deployments"})
		return
	}

	deployments := make([]RecentDeployment, 0, len(rows))
	for _, r := range rows {
		deployments = append(deployments, RecentDeployment{
			ID: r.ID, ServiceID: r.ServiceID, ServiceName: r.ServiceName,
			ProjectName: r.ProjectName, Status: r.Status.String, ImageName: r.ImageName,
			StartedAt: timePtrNT(r.StartedAt), CompletedAt: timePtrNT(r.CompletedAt),
			CreatedAt: r.CreatedAt.Time,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"deployments": deployments,
		"pagination":  paginationMeta(offset, limit, int(total)),
	})
}

func handleCreateDeployment(c *gin.Context) {
	db, exists := c.Get("db")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database connection not available"})
		return
	}

	serviceIDStr := c.Param("id")
	serviceID, err := uuid.Parse(serviceIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid service ID"})
		return
	}

	var req CreateDeploymentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.Trigger == "" {
		req.Trigger = "manual"
	}

	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	ctx := c.Request.Context()
	q := sqlcdb.New(db.(*database.DB).DB)
	sr, err := q.GetServiceForDeployWithOwner(ctx, serviceID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Service not found"})
		return
	}
	service := serviceForDeployFromRow(sqlcdb.GetServiceForDeployRow{
		ID: sr.ID, ProjectID: sr.ProjectID, Name: sr.Name, Type: sr.Type,
		Status: sr.Status, Image: sr.Image, Command: sr.Command,
		Environment: sr.Environment, GitRepo: sr.GitRepo, GitBranch: sr.GitBranch,
		BuildPath: sr.BuildPath, Cpu: sr.Cpu, Memory: sr.Memory,
		Replicas: sr.Replicas, Port: sr.Port, Domain: sr.Domain,
		HealthcheckPath: sr.HealthcheckPath, RestartPolicy: sr.RestartPolicy,
		Builder: sr.Builder, CpuReserve: sr.CpuReserve, MemoryReserve: sr.MemoryReserve,
		StaticBuildCmd: sr.StaticBuildCmd, StaticDir: sr.StaticDir,
		CreatedAt: sr.CreatedAt, UpdatedAt: sr.UpdatedAt,
	})
	projectOwner := sr.OwnerID

	if projectOwner.String() != userID.(string) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	if req.Branch == "" {
		req.Branch = service.GitBranch
	}

	now := time.Now()
	var commitHash *string
	if trimmed := strings.TrimSpace(req.CommitHash); trimmed != "" {
		commitHash = &trimmed
	}

	d := DeploymentModel{
		ID:         uuid.New(),
		ServiceID:  serviceID,
		CommitHash: commitHash,
		Status:     "pending",
		ImageName:  "",
		ImageTag:   "",
		CreatedAt:  now,
		UpdatedAt:  now,
	}

	err = q.InsertDeployment(ctx, sqlcdb.InsertDeploymentParams{
		ID:         d.ID,
		ServiceID:  d.ServiceID,
		Version:    fmt.Sprintf("v%d", now.Unix()),
		CommitHash: sql.NullString{String: ptrStr(d.CommitHash), Valid: d.CommitHash != nil},
		Status:     sql.NullString{String: d.Status, Valid: true},
		ImageName:  sql.NullString{String: d.ImageName, Valid: true},
		ImageTag:   sql.NullString{String: d.ImageTag, Valid: true},
		CreatedAt:  sql.NullTime{Time: d.CreatedAt, Valid: true},
		UpdatedAt:  sql.NullTime{Time: d.UpdatedAt, Valid: true},
	})

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create deployment"})
		return
	}

	engine, exists := c.Get("deployment_engine")
	if !exists || engine == nil {
		unavailableErr := "Deployment engine unavailable. Docker may not be configured on this server."
		completedAt := time.Now()
		_ = q.FailDeployment(ctx, sqlcdb.FailDeploymentParams{
			Error:       sql.NullString{String: unavailableErr, Valid: true},
			CompletedAt: sql.NullTime{Time: completedAt, Valid: true},
			ID:          d.ID,
		})
		d.Status = "failed"
		d.Error = &unavailableErr
		d.CompletedAt = &completedAt
	} else {
		err = q.SetServiceStatus(ctx, sqlcdb.SetServiceStatusParams{
			Status:    sql.NullString{String: "building", Valid: true},
			UpdatedAt: sql.NullTime{Time: time.Now(), Valid: true},
			ID:        serviceID,
		})
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update service status"})
			return
		}

		engineInstance := engine.(*deployment.DeploymentEngine)
		pos := getDeployQueue(c).Enqueue(serviceID, deployqueue.Job{
			DeploymentID: d.ID,
			Run: func(jctx context.Context) {
				runDeploymentAndSync(jctx, db.(*database.DB), engineInstance, &d, service, req, userID.(string))
			},
		})
		if pos > 0 {
			d.Status = "queued"
			now := time.Now()
			_ = q.SetDeploymentStatus(ctx, sqlcdb.SetDeploymentStatusParams{
				Status:    sql.NullString{String: "queued", Valid: true},
				UpdatedAt: sql.NullTime{Time: now, Valid: true},
				ID:        d.ID,
			})
			_ = q.SetServiceStatus(ctx, sqlcdb.SetServiceStatusParams{
				Status:    sql.NullString{String: "queued", Valid: true},
				UpdatedAt: sql.NullTime{Time: now, Valid: true},
				ID:        serviceID,
			})
		}
	}

	c.JSON(http.StatusCreated, DeploymentResponse{
		ID:          d.ID,
		ServiceID:   d.ServiceID,
		CommitHash:  d.CommitHash,
		Status:      d.Status,
		Error:       d.Error,
		CompletedAt: d.CompletedAt,
		CreatedAt:   d.CreatedAt,
	})
}

func runDeploymentAndSync(
	parentCtx context.Context,
	db *database.DB,
	engine *deployment.DeploymentEngine,
	dbDeployment *DeploymentModel,
	service Service,
	req CreateDeploymentRequest,
	userID string,
) {
	runDeploymentAndSyncWithImage(parentCtx, db, engine, dbDeployment, service, req, userID, "")
}

// runDeploymentAndSyncWithImage deploys imageOverride as a prebuilt image
// (rollback / redeploy of an existing tag) when set; otherwise builds from
// source or pulls the service image.
func runDeploymentAndSyncWithImage(
	parentCtx context.Context,
	db *database.DB,
	engine *deployment.DeploymentEngine,
	dbDeployment *DeploymentModel,
	service Service,
	req CreateDeploymentRequest,
	userID string,
	imageOverride string,
) {
	ctx, cancel := context.WithTimeout(parentCtx, 30*time.Minute)
	defer cancel()
	q := sqlcdb.New(db.DB)

	// The checkout and any shipped artifacts die with this deployment.
	var artifactIDs []string
	checkoutRoot := filepath.Join(containrWorkDir, "repos", dbDeployment.ID.String())
	defer func() {
		_ = os.RemoveAll(checkoutRoot)
		for _, id := range artifactIDs {
			removeArtifact(id)
		}
	}()
	failDeploy := func(msg string) {
		failedAt := time.Now()
		_ = q.FailDeployment(ctx, sqlcdb.FailDeploymentParams{
			Error:       sql.NullString{String: msg, Valid: true},
			CompletedAt: sql.NullTime{Time: failedAt, Valid: true},
			ID:          dbDeployment.ID,
		})
	}

	sourcePath := strings.TrimSpace(service.BuildPath)
	if sourcePath == "" {
		sourcePath = "."
	}

	// Resolve the runtime env: stored service variables (with ${{svc.KEY}}
	// references expanded) plus any per-deployment overrides.
	env, envErr := resolveServiceEnv(db, service)
	if envErr != nil {
		env = map[string]string{}
	}
	for k, v := range req.EnvVars {
		env[k] = v
	}

	var command []string
	if cmd := strings.TrimSpace(service.Command); cmd != "" {
		command = strings.Fields(cmd)
	}

	replicas := service.Replicas
	if replicas < 1 {
		replicas = 1
	}

	// Best effort: reuse the host port from the last live deployment so public
	// URLs survive redeploys. Column exists post-migration; older DBs get
	// ephemeral ports.
	publishedPort, _ := q.GetServicePublishedPort(ctx, service.ID)

	publicPort := int32(service.Port)
	if service.Builder == "static" && publicPort == 0 {
		// The static builder's image is nginx — route to its default port
		// unless the user picked another.
		publicPort = 80
	}

	maintenanceMode, basicAuthUsers := serviceAccess(db, service.ID)
	maintURL := ""
	if maintenanceMode {
		maintURL = maintenanceURL(db)
	}

	// Node-pinned and spread services dispatch to agent command queues.
	nodeID := serviceNodeID(db, service.ID)
	spread := serviceSpread(db, service.ID)
	remote := nodeID != "" || spread

	// Materialize the git checkout — local builds consume it directly;
	// remote builds package it into a context artifact the node builds.
	if service.GitRepo != "" && imageOverride == "" {
		var ownerID string
		if o, err := q.GetProjectOwner(ctx, service.ProjectID); err == nil {
			ownerID = o.String()
		}
		branch := req.Branch
		if branch == "" {
			branch = service.GitBranch
		}
		cloneSpec, err := resolveGitCloneSpec(db, ownerID, service.GitRepo, branch, req.CommitHash, service.BuildPath)
		if err != nil {
			failDeploy("resolve git source: " + err.Error())
			return
		}
		src, err := source.Checkout(ctx, checkoutRoot, cloneSpec)
		if err != nil {
			failDeploy("git checkout: " + err.Error())
			return
		}
		sourcePath = src
	}

	deployReq := &deployment.DeploymentRequest{
		ProjectID:   service.ProjectID.String(),
		ServiceID:   service.ID.String(),
		Environment: service.Environment,
		Config: deployment.ServiceConfig{
			Name:          service.Name,
			Image:         service.Image,
			Command:       command,
			Environment:   env,
			Replicas:      replicas,
			PublicPort:    publicPort,
			PublishedPort: publishedPort,
			Domain:        service.Domain,
			HealthPath:    service.HealthCheckPath,
			RestartPolicy: service.RestartPolicy,
			VolumeMounts:  loadServiceVolumes(db, service.ID),
			Domains:       serviceDomainNames(db, service.ID, service.Domain),
			Resources: deployment.ResourceLimits{
				MemoryBytes:       parseMemoryLimit(service.Memory),
				MemoryReservation: parseMemoryLimit(service.MemoryReserve),
				CPUQuota:          parseCPULimit(service.CPU),
				CPUShares:         parseCPUReserveShares(service.CPUReserve),
			},
			Maintenance:    maintenanceMode,
			MaintenanceURL: maintURL,
			BasicAuthUsers: basicAuthUsers,
			NodeID:         nodeID,
			Spread:         spread,
		},
		Trigger: deployment.TriggerConfig{
			Type:      req.Trigger,
			Source:    "api",
			User:      userID,
			Timestamp: time.Now(),
		},
	}

	if imageOverride != "" || service.GitRepo == "" {
		// Prebuilt image deploy (rollback, redeploy, or image-sourced
		// service): resolve private-registry credentials by image host.
		image := imageOverride
		if image == "" {
			image = service.Image
		}
		if remote && strings.HasPrefix(image, "containr-") {
			// Locally-built tag — no registry serves it. Ship the image
			// itself as a docker-save artifact; the node loads it.
			rc, err := engine.DockerClient().SaveImage(ctx, image)
			if err != nil {
				failDeploy("export rollback image: " + err.Error())
				return
			}
			artifactID, err := putArtifact(rc)
			_ = rc.Close()
			if err != nil {
				failDeploy("store rollback image artifact: " + err.Error())
				return
			}
			artifactIDs = append(artifactIDs, artifactID)
			deployReq.Config.RemoteLoad = &deployment.RemoteLoadSpec{ArtifactID: artifactID}
			deployReq.BuildConfig = &deployment.BuildConfig{
				BuildType:     "remote",
				PrebuiltImage: image,
			}
		} else {
			var ownerID string
			if o, err := q.GetProjectOwner(ctx, service.ProjectID); err == nil {
				ownerID = o.String()
			}
			auth := registryAuthFor(db, ownerID, image)
			deployReq.BuildConfig = &deployment.BuildConfig{
				BuildType:     "prebuilt",
				PrebuiltImage: image,
				PullUsername:  auth.Username,
				PullPassword:  auth.Password,
			}
		}
	} else {
		// "auto" leaves BuildType empty so the manager detects it; the static
		// builder additionally feeds its generated Dockerfile the service's
		// build command and output dir.
		buildType := ""
		if service.Builder != "" && service.Builder != "auto" {
			buildType = service.Builder
		}
		buildArgs := map[string]string{}
		buildCommand := ""
		if buildType == "static" {
			buildCommand = firstNonEmpty(service.StaticBuildCmd, "npm ci && npm run build")
			buildArgs["STATIC_DIR"] = firstNonEmpty(service.StaticDir, "dist")
		}
		if remote {
			// Package the context — the node docker-builds it itself.
			packReq := &types.BuildRequest{
				BuildType:    buildType,
				SourcePath:   sourcePath,
				BuildCommand: buildCommand,
				BuildArgs:    buildArgs,
				Environment:  env,
			}
			rc, err := engine.BuildManager().PackageContext(ctx, packReq)
			if err != nil {
				failDeploy("package build context: " + err.Error())
				return
			}
			artifactID, err := putArtifact(rc)
			_ = rc.Close()
			if err != nil {
				failDeploy("store build context artifact: " + err.Error())
				return
			}
			artifactIDs = append(artifactIDs, artifactID)
			deployReq.Config.RemoteBuild = &deployment.RemoteBuildSpec{
				ArtifactID: artifactID,
				BuildArgs:  buildArgs,
				NoCache:    req.NoCache,
			}
			deployReq.BuildConfig = &deployment.BuildConfig{
				BuildType: "remote",
				Branch:    req.Branch,
				Commit:    req.CommitHash,
				NoCache:   req.NoCache,
			}
		} else {
			deployReq.BuildConfig = &deployment.BuildConfig{
				BuildType:    buildType,
				SourcePath:   sourcePath,
				BuildCommand: buildCommand,
				BuildArgs:    buildArgs,
				Branch:       req.Branch,
				Commit:       req.CommitHash,
				NoCache:      req.NoCache,
			}
		}
	}

	if msg := capacityCheck(parentCtx, db, engine.DockerClient(), service, replicas); msg != "" {
		failedAt := time.Now()
		_ = q.FailDeployment(ctx, sqlcdb.FailDeploymentParams{
			Error:       sql.NullString{String: msg, Valid: true},
			CompletedAt: sql.NullTime{Time: failedAt, Valid: true},
			ID:          dbDeployment.ID,
		})
		return
	}

	engineDeployment, err := engine.Deploy(ctx, deployReq)
	if err != nil {
		failedAt := time.Now()
		failure := "Failed to start deployment engine: " + err.Error()
		_ = q.FailDeployment(ctx, sqlcdb.FailDeploymentParams{
			Error:       sql.NullString{String: failure, Valid: true},
			CompletedAt: sql.NullTime{Time: failedAt, Valid: true},
			ID:          dbDeployment.ID,
		})
		_ = q.SetServiceStatus(ctx, sqlcdb.SetServiceStatusParams{
			Status:    sql.NullString{String: "failed", Valid: true},
			UpdatedAt: sql.NullTime{Time: failedAt, Valid: true},
			ID:        service.ID,
		})
		return
	}

	syncTicker := time.NewTicker(1 * time.Second)
	defer syncTicker.Stop()

	for {
		select {
		case <-ctx.Done():
			failedAt := time.Now()
			finalStatus, finalErr := "failed", "Deployment timed out before completion"
			if errors.Is(ctx.Err(), context.Canceled) {
				finalStatus, finalErr = "cancelled", "Deployment cancelled"
			}
			_ = q.CompleteDeployment(ctx, sqlcdb.CompleteDeploymentParams{
				Status:      sql.NullString{String: finalStatus, Valid: true},
				Error:       sql.NullString{String: finalErr, Valid: true},
				CompletedAt: sql.NullTime{Time: failedAt, Valid: true},
				ID:          dbDeployment.ID,
			})
			_ = q.SetServiceStatus(ctx, sqlcdb.SetServiceStatusParams{
				Status:    sql.NullString{String: finalStatus, Valid: true},
				UpdatedAt: sql.NullTime{Time: failedAt, Valid: true},
				ID:        service.ID,
			})
			return
		case <-syncTicker.C:
			current, getErr := engine.GetDeployment(engineDeployment.ID)
			if getErr != nil {
				continue
			}

			dbStatus := mapEngineStatusToDBStatus(current.Status)
			imageName, imageTag := splitImageReference(current.ImageName, dbDeployment.ImageTag)

			now := time.Now()
			_ = q.SyncDeploymentProgress(ctx, sqlcdb.SyncDeploymentProgressParams{
				Status:      sql.NullString{String: dbStatus, Valid: true},
				ImageName:   sql.NullString{String: imageName, Valid: true},
				ImageTag:    sql.NullString{String: imageTag, Valid: true},
				BuildLog:    sql.NullString{String: current.BuildLog, Valid: true},
				RuntimeLog:  sql.NullString{String: current.DeployLog, Valid: true},
				Error:       sql.NullString{String: current.Error, Valid: current.Error != ""},
				StartedAt:   ntPtr(current.StartedAt),
				CompletedAt: ntPtr(current.CompletedAt),
				UpdatedAt:   sql.NullTime{Time: now, Valid: true},
				ID:          dbDeployment.ID,
			})

			switch dbStatus {
			case "deployed":
				_ = q.SetServiceStatus(ctx, sqlcdb.SetServiceStatusParams{
					Status:    sql.NullString{String: "running", Valid: true},
					UpdatedAt: sql.NullTime{Time: now, Valid: true},
					ID:        service.ID,
				})
				insertUserNotification(db, userID, "deployment", "Deployment succeeded",
					fmt.Sprintf("Service %s is now running.", service.Name), "service", service.ID.String())
				return
			case "failed":
				_ = q.SetServiceStatus(ctx, sqlcdb.SetServiceStatusParams{
					Status:    sql.NullString{String: "failed", Valid: true},
					UpdatedAt: sql.NullTime{Time: now, Valid: true},
					ID:        service.ID,
				})
				body := fmt.Sprintf("Service %s failed to deploy.", service.Name)
				if current.Error != "" {
					body = fmt.Sprintf("Service %s failed to deploy: %s", service.Name, current.Error)
				}
				insertUserNotification(db, userID, "deployment", "Deployment failed", body, "service", service.ID.String())
				return
			}
		}
	}
}

func mapEngineStatusToDBStatus(status string) string {
	if status == "running" {
		return "deployed"
	}
	return status
}

// getDeployQueue returns the per-service deploy queue. SetupRoutes always
// sets it; the fallback keeps handler tests that skip SetupRoutes working.
func getDeployQueue(c *gin.Context) *deployqueue.Queue {
	if v, exists := c.Get("deploy_queue"); exists {
		if q, ok := v.(*deployqueue.Queue); ok && q != nil {
			return q
		}
	}
	return deployqueue.New()
}

// handleCancelDeployment cancels a queued or in-flight deployment. Queued
// jobs are dropped and marked cancelled immediately; active jobs get their
// context cancelled so the build/reconcile aborts and the sync loop writes
// the terminal 'cancelled' status.
func handleCancelDeployment(c *gin.Context) {
	db, exists := c.Get("db")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database connection not available", "code": "DEPENDENCY_UNAVAILABLE"})
		return
	}

	deploymentID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid deployment ID", "code": "VALIDATION"})
		return
	}
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated", "code": "UNAUTHENTICATED"})
		return
	}

	ctx := c.Request.Context()
	q := sqlcdb.New(db.(*database.DB).DB)
	access, err := q.GetDeploymentAccess(ctx, deploymentID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Deployment not found", "code": "NOT_FOUND"})
		return
	}
	serviceID := access.ServiceID
	status := access.Status.String
	if access.OwnerID.String() != userID.(string) && !contextIsAdmin(c) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied", "code": "FORBIDDEN"})
		return
	}

	switch status {
	case "deployed", "failed", "cancelled":
		c.JSON(http.StatusConflict, gin.H{"error": "Deployment already finished", "code": "NOT_CANCELLABLE"})
		return
	}

	switch getDeployQueue(c).Cancel(serviceID, deploymentID) {
	case deployqueue.WasQueued:
		now := time.Now()
		_ = q.CompleteDeployment(ctx, sqlcdb.CompleteDeploymentParams{
			Status:      sql.NullString{String: "cancelled", Valid: true},
			Error:       sql.NullString{String: "Deployment cancelled", Valid: true},
			CompletedAt: sql.NullTime{Time: now, Valid: true},
			ID:          deploymentID,
		})
		_ = q.SetServiceStatus(ctx, sqlcdb.SetServiceStatusParams{
			Status:    sql.NullString{String: "cancelled", Valid: true},
			UpdatedAt: sql.NullTime{Time: now, Valid: true},
			ID:        serviceID,
		})
		c.JSON(http.StatusOK, gin.H{"status": "cancelled"})
	case deployqueue.WasActive:
		c.JSON(http.StatusAccepted, gin.H{"status": "cancelling"})
	default:
		c.JSON(http.StatusConflict, gin.H{"error": "Deployment is not running on this node", "code": "NOT_CANCELLABLE"})
	}
}

func splitImageReference(image, fallbackTag string) (string, string) {
	if image == "" {
		return "", fallbackTag
	}

	// Digest-pinned refs (name[:tag]@sha256:…) carry no usable tag — the
	// colon lives inside the digest and must not be split.
	if strings.Contains(image, "@") {
		return image, fallbackTag
	}

	lastSlash := strings.LastIndex(image, "/")
	lastColon := strings.LastIndex(image, ":")
	if lastColon > lastSlash {
		return image[:lastColon], image[lastColon+1:]
	}

	return image, fallbackTag
}

func handleGetDeployment(c *gin.Context) {
	db, exists := c.Get("db")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database connection not available"})
		return
	}

	deploymentIDStr := c.Param("id")
	deploymentID, err := uuid.Parse(deploymentIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid deployment ID"})
		return
	}

	r, err := sqlcdb.New(db.(*database.DB).DB).GetDeploymentWithProject(c.Request.Context(), deploymentID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Deployment not found"})
		return
	}
	projectID := r.ProjectID
	d := deploymentModelFrom(deploymentRowShape{
		ID: r.ID, ServiceID: r.ServiceID, CommitHash: r.CommitHash, Status: r.Status,
		ImageName: r.ImageName, ImageTag: r.ImageTag, BuildLog: r.BuildLog,
		RuntimeLog: r.RuntimeLog, Error: r.Error, StartedAt: r.StartedAt,
		CompletedAt: r.CompletedAt, CreatedAt: r.CreatedAt, UpdatedAt: r.UpdatedAt,
	})

	if _, allowed := projectReadAccess(c, db.(*database.DB), projectID); !allowed {
		c.JSON(http.StatusNotFound, gin.H{"error": "Deployment not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"deployment": d})
}

func handleRollbackDeployment(c *gin.Context) {
	db, exists := c.Get("db")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database connection not available"})
		return
	}

	deploymentIDStr := c.Param("id")
	deploymentID, err := uuid.Parse(deploymentIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid deployment ID"})
		return
	}

	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	ctx := c.Request.Context()
	q := sqlcdb.New(db.(*database.DB).DB)
	r, err := q.GetDeploymentForRollback(ctx, deploymentID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Deployment not found"})
		return
	}
	serviceID := r.ServiceID
	targetDeployment := deploymentModelFrom(deploymentRowShape{
		ID: r.ID, ServiceID: r.ServiceID, CommitHash: r.CommitHash, Status: r.Status,
		ImageName: r.ImageName, ImageTag: r.ImageTag, BuildLog: r.BuildLog,
		RuntimeLog: r.RuntimeLog, Error: r.Error, StartedAt: r.StartedAt,
		CompletedAt: r.CompletedAt, CreatedAt: r.CreatedAt, UpdatedAt: r.UpdatedAt,
	})
	ownerCheck := r.OwnerID

	if ownerCheck.String() != userID.(string) && !contextIsAdmin(c) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	if targetDeployment.Status != "deployed" && targetDeployment.Status != "failed" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Can only rollback completed or failed deployments"})
		return
	}

	now := time.Now()
	rollbackID := uuid.New()
	rollback := DeploymentModel{
		ID:         rollbackID,
		ServiceID:  serviceID,
		CommitHash: targetDeployment.CommitHash,
		Status:     "rolling_back",
		ImageName:  targetDeployment.ImageName,
		ImageTag:   targetDeployment.ImageTag,
		CreatedAt:  now,
		UpdatedAt:  now,
	}

	err = q.InsertDeployment(ctx, sqlcdb.InsertDeploymentParams{
		ID:         rollback.ID,
		ServiceID:  rollback.ServiceID,
		Version:    fmt.Sprintf("rollback-%d", now.Unix()),
		CommitHash: sql.NullString{String: ptrStr(rollback.CommitHash), Valid: rollback.CommitHash != nil},
		Status:     sql.NullString{String: rollback.Status, Valid: true},
		ImageName:  sql.NullString{String: rollback.ImageName, Valid: true},
		ImageTag:   sql.NullString{String: rollback.ImageTag, Valid: true},
		CreatedAt:  sql.NullTime{Time: rollback.CreatedAt, Valid: true},
		UpdatedAt:  sql.NullTime{Time: rollback.UpdatedAt, Valid: true},
	})

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create rollback deployment"})
		return
	}

	err = q.SetServiceStatus(ctx, sqlcdb.SetServiceStatusParams{
		Status:    sql.NullString{String: "building", Valid: true},
		UpdatedAt: sql.NullTime{Time: time.Now(), Valid: true},
		ID:        serviceID,
	})

	// Real rollback: redeploy the target deployment's image.
	engineValue, _ := c.Get("deployment_engine")
	engine, _ := engineValue.(*deployment.DeploymentEngine)
	targetImage := targetDeployment.ImageName
	if targetDeployment.ImageTag != "" {
		targetImage += ":" + targetDeployment.ImageTag
	}

	if engine == nil || targetImage == "" {
		completedAt := time.Now()
		reason := "Rollback image unavailable"
		if engine == nil {
			reason = "Deployment engine unavailable. Docker may not be configured on this server."
		}
		_ = q.FailDeployment(ctx, sqlcdb.FailDeploymentParams{
			Error:       sql.NullString{String: reason, Valid: true},
			CompletedAt: sql.NullTime{Time: completedAt, Valid: true},
			ID:          rollbackID,
		})
		_ = q.SetServiceStatus(ctx, sqlcdb.SetServiceStatusParams{
			Status:    sql.NullString{String: "failed", Valid: true},
			UpdatedAt: sql.NullTime{Time: completedAt, Valid: true},
			ID:        serviceID,
		})
	} else {
		service, _ := loadServiceForDeploy(db.(*database.DB), serviceID)

		rollbackReq := CreateDeploymentRequest{
			CommitHash: func() string {
				if targetDeployment.CommitHash != nil {
					return *targetDeployment.CommitHash
				}
				return ""
			}(),
			Trigger: "rollback",
		}
		// Reuse the stored image directly — no rebuild.
		getDeployQueue(c).Enqueue(serviceID, deployqueue.Job{
			DeploymentID: rollback.ID,
			Run: func(jctx context.Context) {
				runDeploymentAndSyncWithImage(jctx, db.(*database.DB), engine, &rollback, service, rollbackReq, userID.(string), targetImage)
			},
		})
	}

	c.JSON(http.StatusCreated, gin.H{
		"deployment": DeploymentResponse{
			ID:         rollback.ID,
			ServiceID:  rollback.ServiceID,
			CommitHash: rollback.CommitHash,
			Status:     rollback.Status,
			ImageName:  rollback.ImageName,
			ImageTag:   rollback.ImageTag,
			CreatedAt:  rollback.CreatedAt,
		},
		"message": "Rollback initiated",
	})
}

// capacityCheck compares the requested per-replica memory (limit, falling
// back to reservation) against node capacity. app_settings.capacity_policy
// = "block" fails the deployment; the default "warn" only logs. CPU is not
// gated — shares are a weight, not a reservation.
func capacityCheck(ctx context.Context, db *database.DB, client *docker.Client, service Service, replicas int) string {
	if client == nil {
		return ""
	}
	requested := parseMemoryLimit(service.Memory)
	if requested == 0 {
		requested = parseMemoryLimit(service.MemoryReserve)
	}
	if requested == 0 {
		return ""
	}
	info, err := client.GetSystemInfo(ctx)
	if err != nil || info.MemTotal <= 0 {
		return ""
	}
	need := requested * int64(replicas)
	if need <= info.MemTotal {
		return ""
	}
	msg := fmt.Sprintf("requested %d bytes x %d replicas exceeds node memory (%d bytes)",
		requested, replicas, info.MemTotal)
	if strings.ToLower(settingValue(db, "capacity_policy", "", "warn")) == "block" {
		return msg
	}
	slog.Warn("capacity check exceeded", "service_id", service.ID, "detail", msg)
	return ""
}
