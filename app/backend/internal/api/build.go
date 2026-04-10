package api

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"containr/internal/build"
	"containr/internal/database"
	"containr/internal/docker"
	"containr/internal/types"

	"github.com/gin-gonic/gin"
)

// BuildHandler handles build-related API endpoints
type BuildHandler struct {
	buildManager *build.BuildManager
	dockerClient *docker.Client
	db           *database.DB

	mu         sync.RWMutex
	builds     map[string]*BuildStatusResponse
	buildOrder []string
	cancels    map[string]context.CancelFunc
	idCounter  atomic.Uint64
}

var errBuildsTableMissing = errors.New("builds table missing")

func (h *BuildHandler) buildUnavailable(c *gin.Context) bool {
	if h.buildManager != nil {
		return false
	}

	c.JSON(http.StatusServiceUnavailable, gin.H{
		"error": "Build service is unavailable: Docker client not initialized",
	})
	return true
}

// NewBuildHandler creates a new build handler
func NewBuildHandler(buildManager *build.BuildManager, dockerClient *docker.Client, db *database.DB) *BuildHandler {
	return &BuildHandler{
		buildManager: buildManager,
		dockerClient: dockerClient,
		db:           db,
		builds:       make(map[string]*BuildStatusResponse),
		cancels:      make(map[string]context.CancelFunc),
	}
}

// BuildRequest represents the request body for starting a build
type BuildRequest struct {
	BuildType     string            `json:"build_type"`
	SourcePath    string            `json:"source_path"`
	PrebuiltImage string            `json:"prebuilt_image"`
	ImageName     string            `json:"image_name" binding:"required"`
	ImageTag      string            `json:"image_tag" binding:"required"`
	RegistryURL   string            `json:"registry_url"`
	BuildCommand  string            `json:"build_command"`
	StartCommand  string            `json:"start_command"`
	Environment   map[string]string `json:"environment"`
	BuildArgs     map[string]string `json:"build_args"`
	Labels        map[string]string `json:"labels"`
	ProjectID     string            `json:"project_id"`
	ServiceID     string            `json:"service_id"`
	Branch        string            `json:"branch"`
	Commit        string            `json:"commit"`
}

// BuildResponse represents the response for a build operation
type BuildResponse struct {
	ID        string    `json:"id"`
	Status    string    `json:"status"`
	ImageName string    `json:"image_name"`
	ImageTag  string    `json:"image_tag"`
	Size      int64     `json:"size"`
	Digest    string    `json:"digest"`
	BuildTime time.Time `json:"build_time"`
	Success   bool      `json:"success"`
	Error     string    `json:"error,omitempty"`
}

// BuildStatusResponse represents the response for build status
type BuildStatusResponse struct {
	ID          string            `json:"id"`
	ProjectID   string            `json:"project_id"`
	ServiceID   string            `json:"service_id"`
	Status      string            `json:"status"`
	Progress    int               `json:"progress"`
	StartedAt   time.Time         `json:"started_at"`
	CompletedAt *time.Time        `json:"completed_at,omitempty"`
	ImageName   string            `json:"image_name"`
	ImageTag    string            `json:"image_tag"`
	Size        int64             `json:"size"`
	Error       string            `json:"error,omitempty"`
	Log         string            `json:"log"`
	Metadata    map[string]string `json:"metadata"`
}

// BuildListResponse represents the response for listing builds
type BuildListResponse struct {
	Builds []BuildStatusResponse `json:"builds"`
	Total  int                   `json:"total"`
	Page   int                   `json:"page"`
	Limit  int                   `json:"limit"`
}

// StartBuild starts a new build
// @Summary Start a build
// @Description Starts a new build process for the given configuration
// @Tags builds
// @Accept json
// @Produce json
// @Param request body BuildRequest true "Build request"
// @Success 201 {object} BuildResponse
// @Failure 400 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /api/v1/builds [post]
func (h *BuildHandler) StartBuild(c *gin.Context) {
	if h.buildUnavailable(c) {
		return
	}

	var req BuildRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Convert to internal build request
	buildReq := &types.BuildRequest{
		BuildType:     req.BuildType,
		SourcePath:    req.SourcePath,
		PrebuiltImage: req.PrebuiltImage,
		ImageName:     req.ImageName,
		ImageTag:      req.ImageTag,
		RegistryURL:   req.RegistryURL,
		BuildCommand:  req.BuildCommand,
		StartCommand:  req.StartCommand,
		Environment:   req.Environment,
		BuildArgs:     req.BuildArgs,
		Labels:        req.Labels,
		ProjectID:     req.ProjectID,
		ServiceID:     req.ServiceID,
		TriggeredBy:   "api",
		Branch:        req.Branch,
		Commit:        req.Commit,
	}

	// Validate build request
	if err := h.buildManager.ValidateBuildRequest(c.Request.Context(), buildReq); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	buildID := h.nextBuildID()
	now := time.Now().UTC()
	initial := &BuildStatusResponse{
		ID:        buildID,
		ProjectID: req.ProjectID,
		ServiceID: req.ServiceID,
		Status:    "pending",
		Progress:  0,
		StartedAt: now,
		ImageName: req.ImageName,
		ImageTag:  req.ImageTag,
		Log:       h.formatLogLine("Build queued"),
		Metadata: map[string]string{
			"build_type": req.BuildType,
			"branch":     req.Branch,
			"commit":     req.Commit,
		},
	}
	h.storeBuild(initial)
	if err := h.upsertBuild(initial); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to persist build"})
		return
	}
	BroadcastBuildUpdate(buildID, cloneBuildStatus(*initial))
	h.runBuildAsync(buildID, buildReq)

	c.JSON(http.StatusCreated, BuildResponse{
		ID:        buildID,
		Status:    "pending",
		ImageName: req.ImageName,
		ImageTag:  req.ImageTag,
		BuildTime: now,
		Success:   true,
	})
}

// GetBuildStatus gets the status of a build
// @Summary Get build status
// @Description Gets the current status of a build
// @Tags builds
// @Produce json
// @Param id path string true "Build ID"
// @Success 200 {object} BuildStatusResponse
// @Failure 404 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /api/v1/builds/{id} [get]
func (h *BuildHandler) GetBuildStatus(c *gin.Context) {
	buildID := c.Param("id")
	status, found := h.getBuild(buildID)
	if !found {
		dbStatus, dbFound, err := h.getBuildFromDB(buildID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to retrieve build"})
			return
		}
		if dbFound {
			status = dbStatus
			found = true
		}
	}
	if !found {
		c.JSON(http.StatusNotFound, gin.H{"error": "build not found"})
		return
	}
	c.JSON(http.StatusOK, status)
}

// ListBuilds lists all builds
// @Summary List builds
// @Description Lists all builds with optional filtering
// @Tags builds
// @Produce json
// @Param project_id query string false "Filter by project ID"
// @Param service_id query string false "Filter by service ID"
// @Param status query string false "Filter by status"
// @Param page query int false "Page number" default(1)
// @Param limit query int false "Items per page" default(20)
// @Success 200 {object} BuildListResponse
// @Failure 500 {object} map[string]string
// @Router /api/v1/builds [get]
func (h *BuildHandler) ListBuilds(c *gin.Context) {
	projectID := c.Query("project_id")
	serviceID := c.Query("service_id")
	status := c.Query("status")

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	if page < 1 {
		page = 1
	}
	if limit < 1 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}
	builds, total := h.listBuilds(projectID, serviceID, status, page, limit)
	if h.db != nil {
		dbBuilds, dbTotal, err := h.listBuildsFromDB(projectID, serviceID, status, page, limit)
		if err != nil {
			if !errors.Is(err, errBuildsTableMissing) {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list builds"})
				return
			}
		} else {
			builds = dbBuilds
			total = dbTotal
		}
	}
	c.JSON(http.StatusOK, BuildListResponse{
		Builds: builds,
		Total:  total,
		Page:   page,
		Limit:  limit,
	})
}

// CancelBuild cancels a running build
// @Summary Cancel build
// @Description Cancels a running build
// @Tags builds
// @Produce json
// @Param id path string true "Build ID"
// @Success 200 {object} map[string]string
// @Failure 404 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /api/v1/builds/{id}/cancel [post]
func (h *BuildHandler) CancelBuild(c *gin.Context) {
	buildID := c.Param("id")
	status, found := h.getBuild(buildID)
	if !found {
		dbStatus, dbFound, err := h.getBuildFromDB(buildID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to retrieve build"})
			return
		}
		if dbFound {
			status = dbStatus
			found = true
		}
	}
	if !found {
		c.JSON(http.StatusNotFound, gin.H{"error": "build not found"})
		return
	}
	if h.isTerminalState(status.Status) {
		c.JSON(http.StatusConflict, gin.H{"error": "build is already finished"})
		return
	}

	cancelled := h.cancelBuild(buildID)
	if !cancelled {
		c.JSON(http.StatusConflict, gin.H{"error": "build is not cancellable"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Build " + buildID + " cancelled",
	})
}

// GetBuildLogs gets the logs for a build
// @Summary Get build logs
// @Description Gets the build logs for a specific build
// @Tags builds
// @Produce text
// @Param id path string true "Build ID"
// @Param follow query bool false "Follow logs" default(false)
// @Success 200 {string} string "Build logs"
// @Failure 404 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /api/v1/builds/{id}/logs [get]
func (h *BuildHandler) GetBuildLogs(c *gin.Context) {
	buildID := c.Param("id")
	follow := c.DefaultQuery("follow", "false") == "true"
	status, found := h.getBuild(buildID)
	if !found {
		dbStatus, dbFound, err := h.getBuildFromDB(buildID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to retrieve build logs"})
			return
		}
		if dbFound {
			status = dbStatus
			found = true
		}
	}
	if !found {
		c.JSON(http.StatusNotFound, gin.H{"error": "build not found"})
		return
	}
	logs := status.Log

	if follow {
		// In production, this would use Server-Sent Events to stream logs
		c.Header("Content-Type", "text/plain")
		c.String(http.StatusOK, logs)
	} else {
		c.Header("Content-Type", "text/plain")
		c.String(http.StatusOK, logs)
	}
}

// GetBuildPlan gets the build plan for a service
// @Summary Get build plan
// @Description Gets the build plan for a service without actually building
// @Tags builds
// @Produce json
// @Param request body BuildRequest true "Build request"
// @Success 200 {object} build.BuildPlan
// @Failure 400 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /api/v1/builds/plan [post]
func (h *BuildHandler) GetBuildPlan(c *gin.Context) {
	if h.buildUnavailable(c) {
		return
	}

	var req BuildRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Convert to internal build request
	buildReq := &types.BuildRequest{
		BuildType:     req.BuildType,
		SourcePath:    req.SourcePath,
		PrebuiltImage: req.PrebuiltImage,
		ImageName:     req.ImageName,
		ImageTag:      req.ImageTag,
		BuildCommand:  req.BuildCommand,
		StartCommand:  req.StartCommand,
		Environment:   req.Environment,
		BuildArgs:     req.BuildArgs,
		Labels:        req.Labels,
	}

	// Get build plan
	plan, err := h.buildManager.GetBuildPlan(c.Request.Context(), buildReq)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, plan)
}

// DetectBuildType detects the build type for a given repository
// @Summary Detect build type
// @Description Detects the build type based on repository contents
// @Tags builds
// @Produce json
// @Param source_path query string true "Source path"
// @Success 200 {object} map[string]string
// @Failure 400 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /api/v1/builds/detect [get]
func (h *BuildHandler) DetectBuildType(c *gin.Context) {
	if h.buildUnavailable(c) {
		return
	}

	sourcePath := c.Query("source_path")
	if sourcePath == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "source_path is required"})
		return
	}

	buildType, err := h.buildManager.DetectBuildType(c.Request.Context(), sourcePath)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"build_type": string(buildType),
	})
}

func (h *BuildHandler) nextBuildID() string {
	sequence := h.idCounter.Add(1)
	return fmt.Sprintf("build-%d-%d", time.Now().UTC().UnixNano(), sequence)
}

func (h *BuildHandler) runBuildAsync(buildID string, req *types.BuildRequest) {
	ctx, cancel := context.WithCancel(context.Background())
	h.mu.Lock()
	h.cancels[buildID] = cancel
	h.mu.Unlock()

	go func() {
		defer h.removeCancel(buildID)

		h.updateBuild(buildID, func(status *BuildStatusResponse) {
			if status.Status == "cancelled" {
				return
			}
			status.Status = "running"
			status.Progress = 10
			status.Log = h.appendLog(status.Log, h.formatLogLine("Build started"))
		})

		buildCtx, timeoutCancel := context.WithTimeout(ctx, 30*time.Minute)
		defer timeoutCancel()

		response, err := h.buildManager.Build(buildCtx, req)
		completedAt := time.Now().UTC()

		h.updateBuild(buildID, func(status *BuildStatusResponse) {
			// Cancellation is authoritative even if a build eventually returns.
			if status.Status == "cancelled" {
				status.CompletedAt = &completedAt
				status.Progress = 100
				if err == nil {
					status.Log = h.appendLog(status.Log, h.formatLogLine("Build completed after cancellation request; result ignored"))
				}
				return
			}

			status.CompletedAt = &completedAt
			status.Progress = 100

			if err != nil {
				if errors.Is(err, context.Canceled) || errors.Is(buildCtx.Err(), context.Canceled) {
					status.Status = "cancelled"
					status.Log = h.appendLog(status.Log, h.formatLogLine("Build cancelled"))
					return
				}

				status.Status = "failed"
				status.Error = err.Error()
				status.Log = h.appendLog(status.Log, h.formatLogLine("Build failed: "+err.Error()))
				return
			}

			status.Status = "success"
			status.ImageName = response.ImageName
			status.ImageTag = response.ImageTag
			status.Size = response.Size
			if response.Error != "" {
				status.Error = response.Error
			}
			if response.BuildLog != "" {
				status.Log = h.appendLog(status.Log, strings.TrimSpace(response.BuildLog))
			}
			status.Log = h.appendLog(status.Log, h.formatLogLine("Build completed successfully"))
		})
	}()
}

func (h *BuildHandler) storeBuild(status *BuildStatusResponse) {
	h.mu.Lock()
	defer h.mu.Unlock()

	cloned := cloneBuildStatus(*status)
	h.builds[status.ID] = &cloned
	h.buildOrder = append(h.buildOrder, status.ID)
}

func (h *BuildHandler) updateBuild(buildID string, update func(status *BuildStatusResponse)) bool {
	var snapshot BuildStatusResponse

	h.mu.Lock()
	status, exists := h.builds[buildID]
	if !exists {
		h.mu.Unlock()
		return false
	}
	update(status)
	snapshot = cloneBuildStatus(*status)
	h.mu.Unlock()

	if err := h.upsertBuild(&snapshot); err != nil {
		log.Printf("failed to persist build %s: %v", buildID, err)
	}
	BroadcastBuildUpdate(buildID, snapshot)
	return true
}

func (h *BuildHandler) getBuild(buildID string) (BuildStatusResponse, bool) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	status, exists := h.builds[buildID]
	if !exists {
		return BuildStatusResponse{}, false
	}
	cloned := cloneBuildStatus(*status)
	return cloned, true
}

func (h *BuildHandler) listBuilds(projectID, serviceID, statusFilter string, page, limit int) ([]BuildStatusResponse, int) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	filtered := make([]BuildStatusResponse, 0, len(h.buildOrder))
	for i := len(h.buildOrder) - 1; i >= 0; i-- {
		id := h.buildOrder[i]
		status := h.builds[id]
		if status == nil {
			continue
		}
		if projectID != "" && status.ProjectID != projectID {
			continue
		}
		if serviceID != "" && status.ServiceID != serviceID {
			continue
		}
		if statusFilter != "" && status.Status != statusFilter {
			continue
		}
		filtered = append(filtered, cloneBuildStatus(*status))
	}

	total := len(filtered)
	start := (page - 1) * limit
	if start >= total {
		return []BuildStatusResponse{}, total
	}
	end := start + limit
	if end > total {
		end = total
	}
	return filtered[start:end], total
}

func (h *BuildHandler) cancelBuild(buildID string) bool {
	var cancel context.CancelFunc
	var snapshot BuildStatusResponse

	h.mu.Lock()
	status, exists := h.builds[buildID]
	if !exists {
		h.mu.Unlock()
		return h.cancelBuildInDB(buildID)
	}
	if h.isTerminalState(status.Status) {
		h.mu.Unlock()
		return false
	}
	cancel = h.cancels[buildID]
	status.Status = "cancelled"
	status.Progress = 100
	now := time.Now().UTC()
	status.CompletedAt = &now
	status.Log = h.appendLog(status.Log, h.formatLogLine("Cancellation requested"))
	snapshot = cloneBuildStatus(*status)
	h.mu.Unlock()

	if cancel != nil {
		cancel()
	}
	if err := h.upsertBuild(&snapshot); err != nil {
		log.Printf("failed to persist cancelled build %s: %v", buildID, err)
	}
	BroadcastBuildUpdate(buildID, snapshot)
	return true
}

func (h *BuildHandler) removeCancel(buildID string) {
	h.mu.Lock()
	defer h.mu.Unlock()
	delete(h.cancels, buildID)
}

func (h *BuildHandler) isTerminalState(state string) bool {
	switch state {
	case "success", "failed", "cancelled":
		return true
	default:
		return false
	}
}

func (h *BuildHandler) appendLog(log, message string) string {
	msg := strings.TrimSpace(message)
	if msg == "" {
		return log
	}
	if log == "" {
		return msg + "\n"
	}
	return log + msg + "\n"
}

func (h *BuildHandler) formatLogLine(message string) string {
	return fmt.Sprintf("[%s] %s", time.Now().UTC().Format(time.RFC3339), message)
}

func (h *BuildHandler) upsertBuild(status *BuildStatusResponse) error {
	if h.db == nil {
		return nil
	}

	var metadataRaw []byte
	if status.Metadata != nil {
		encoded, err := json.Marshal(status.Metadata)
		if err != nil {
			return fmt.Errorf("marshal metadata: %w", err)
		}
		metadataRaw = encoded
	}

	now := time.Now().UTC()
	_, err := h.db.Exec(
		`INSERT INTO builds
		 (id, project_id, service_id, status, progress, started_at, completed_at, image_name, image_tag, size, error, log, metadata, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb, $14, $14)
		 ON CONFLICT (id) DO UPDATE SET
		   project_id = EXCLUDED.project_id,
		   service_id = EXCLUDED.service_id,
		   status = EXCLUDED.status,
		   progress = EXCLUDED.progress,
		   started_at = EXCLUDED.started_at,
		   completed_at = EXCLUDED.completed_at,
		   image_name = EXCLUDED.image_name,
		   image_tag = EXCLUDED.image_tag,
		   size = EXCLUDED.size,
		   error = EXCLUDED.error,
		   log = EXCLUDED.log,
		   metadata = EXCLUDED.metadata,
		   updated_at = EXCLUDED.updated_at`,
		status.ID,
		nullIfEmptyString(status.ProjectID),
		nullIfEmptyString(status.ServiceID),
		status.Status,
		status.Progress,
		status.StartedAt,
		status.CompletedAt,
		status.ImageName,
		status.ImageTag,
		status.Size,
		nullIfEmptyString(status.Error),
		status.Log,
		jsonOrEmptyObject(metadataRaw),
		now,
	)
	if err != nil && h.isMissingBuildsTable(err) {
		return nil
	}
	return err
}

func (h *BuildHandler) getBuildFromDB(buildID string) (BuildStatusResponse, bool, error) {
	if h.db == nil {
		return BuildStatusResponse{}, false, nil
	}

	row := h.db.QueryRow(
		`SELECT id, project_id, service_id, status, progress, started_at, completed_at, image_name, image_tag, size, error, log, metadata
		 FROM builds
		 WHERE id = $1`,
		buildID,
	)

	build, found, err := scanBuildRow(row.Scan)
	if err != nil && h.isMissingBuildsTable(err) {
		return BuildStatusResponse{}, false, nil
	}
	return build, found, err
}

func (h *BuildHandler) listBuildsFromDB(projectID, serviceID, status string, page, limit int) ([]BuildStatusResponse, int, error) {
	if h.db == nil {
		return nil, 0, nil
	}

	args := []interface{}{}
	filters := []string{}
	nextArg := 1
	if projectID != "" {
		filters = append(filters, fmt.Sprintf("project_id = $%d", nextArg))
		args = append(args, projectID)
		nextArg++
	}
	if serviceID != "" {
		filters = append(filters, fmt.Sprintf("service_id = $%d", nextArg))
		args = append(args, serviceID)
		nextArg++
	}
	if status != "" {
		filters = append(filters, fmt.Sprintf("status = $%d", nextArg))
		args = append(args, status)
		nextArg++
	}

	whereClause := ""
	if len(filters) > 0 {
		whereClause = " WHERE " + strings.Join(filters, " AND ")
	}

	var total int
	countQuery := "SELECT COUNT(*) FROM builds" + whereClause
	if err := h.db.QueryRow(countQuery, args...).Scan(&total); err != nil {
		if h.isMissingBuildsTable(err) {
			return nil, 0, errBuildsTableMissing
		}
		return nil, 0, err
	}

	offset := (page - 1) * limit
	args = append(args, limit, offset)
	query := fmt.Sprintf(
		`SELECT id, project_id, service_id, status, progress, started_at, completed_at, image_name, image_tag, size, error, log, metadata
		 FROM builds%s
		 ORDER BY created_at DESC
		 LIMIT $%d OFFSET $%d`,
		whereClause,
		nextArg,
		nextArg+1,
	)

	rows, err := h.db.Query(query, args...)
	if err != nil {
		if h.isMissingBuildsTable(err) {
			return nil, 0, errBuildsTableMissing
		}
		return nil, 0, err
	}
	defer rows.Close()

	builds := make([]BuildStatusResponse, 0, limit)
	for rows.Next() {
		build, found, err := scanBuildRow(rows.Scan)
		if err != nil {
			return nil, 0, err
		}
		if found {
			builds = append(builds, build)
		}
	}
	if err := rows.Err(); err != nil {
		return nil, 0, err
	}

	return builds, total, nil
}

func (h *BuildHandler) cancelBuildInDB(buildID string) bool {
	if h.db == nil {
		return false
	}
	now := time.Now().UTC()
	result, err := h.db.Exec(
		`UPDATE builds
		 SET status = 'cancelled',
		     progress = 100,
		     completed_at = $1,
		     log = COALESCE(log, '') || $2,
		     updated_at = $1
		 WHERE id = $3
		   AND status NOT IN ('success', 'failed', 'cancelled')`,
		now,
		h.formatLogLine("Cancellation requested")+"\n",
		buildID,
	)
	if err != nil {
		if h.isMissingBuildsTable(err) {
			return false
		}
		log.Printf("failed to cancel build %s in database: %v", buildID, err)
		return false
	}

	affected, err := result.RowsAffected()
	if err != nil || affected == 0 {
		return false
	}

	dbBuild, found, err := h.getBuildFromDB(buildID)
	if err == nil && found {
		BroadcastBuildUpdate(buildID, dbBuild)
	}
	return true
}

func scanBuildRow(scan func(dest ...interface{}) error) (BuildStatusResponse, bool, error) {
	var (
		id          string
		projectID   sql.NullString
		serviceID   sql.NullString
		status      string
		progress    int
		startedAt   sql.NullTime
		completedAt sql.NullTime
		imageName   string
		imageTag    string
		size        int64
		errText     sql.NullString
		logText     string
		metadataRaw []byte
	)

	err := scan(
		&id,
		&projectID,
		&serviceID,
		&status,
		&progress,
		&startedAt,
		&completedAt,
		&imageName,
		&imageTag,
		&size,
		&errText,
		&logText,
		&metadataRaw,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return BuildStatusResponse{}, false, nil
		}
		return BuildStatusResponse{}, false, err
	}

	parsed := BuildStatusResponse{
		ID:        id,
		ProjectID: projectID.String,
		ServiceID: serviceID.String,
		Status:    status,
		Progress:  progress,
		StartedAt: startedAt.Time.UTC(),
		ImageName: imageName,
		ImageTag:  imageTag,
		Size:      size,
		Error:     errText.String,
		Log:       logText,
	}
	if completedAt.Valid {
		t := completedAt.Time.UTC()
		parsed.CompletedAt = &t
	}
	if !startedAt.Valid {
		parsed.StartedAt = time.Time{}
	}
	if len(metadataRaw) > 0 {
		metadata := map[string]string{}
		if err := json.Unmarshal(metadataRaw, &metadata); err == nil {
			parsed.Metadata = metadata
		}
	}
	return parsed, true, nil
}

func nullIfEmptyString(value string) interface{} {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return nil
	}
	return trimmed
}

func jsonOrEmptyObject(raw []byte) string {
	if len(raw) == 0 {
		return "{}"
	}
	return string(raw)
}

func (h *BuildHandler) isMissingBuildsTable(err error) bool {
	if err == nil {
		return false
	}
	return strings.Contains(strings.ToLower(err.Error()), `relation "builds" does not exist`)
}

func cloneBuildStatus(status BuildStatusResponse) BuildStatusResponse {
	cloned := status
	if status.Metadata != nil {
		cloned.Metadata = make(map[string]string, len(status.Metadata))
		for k, v := range status.Metadata {
			cloned.Metadata[k] = v
		}
	}
	return cloned
}
