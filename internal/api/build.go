package api

import (
	"context"
	"net/http"
	"strconv"
	"time"

	"containr/internal/build"
	"containr/internal/docker"
	"containr/internal/types"

	"github.com/gin-gonic/gin"
)

// BuildHandler handles build-related API endpoints
type BuildHandler struct {
	buildManager *build.BuildManager
	dockerClient *docker.Client
}

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
func NewBuildHandler(buildManager *build.BuildManager, dockerClient *docker.Client) *BuildHandler {
	return &BuildHandler{
		buildManager: buildManager,
		dockerClient: dockerClient,
	}
}

// BuildRequest represents the request body for starting a build
type BuildRequest struct {
	BuildType     string            `json:"build_type" binding:"required"`
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
// @Success 200 {object} BuildResponse
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

	// Start build (this would be async in production)
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Minute)
		defer cancel()

		_, err := h.buildManager.Build(ctx, buildReq)
		if err != nil {
			// Log error or update build status in database
			return
		}
	}()

	// For now, return a mock response
	// In production, this would return the actual build ID and status
	c.JSON(http.StatusOK, BuildResponse{
		ID:        "build-" + strconv.FormatInt(time.Now().Unix(), 10),
		Status:    "pending",
		ImageName: req.ImageName,
		ImageTag:  req.ImageTag,
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

	// For now, return a mock response
	// In production, this would query the database for the actual build status
	c.JSON(http.StatusOK, BuildStatusResponse{
		ID:        buildID,
		Status:    "completed",
		Progress:  100,
		StartedAt: time.Now().Add(-10 * time.Minute),
		ImageName: "example-app",
		ImageTag:  "latest",
		Size:      1024 * 1024 * 100, // 100MB
	})
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

	// For now, return mock data
	// In production, this would query the database with filters
	builds := []BuildStatusResponse{
		{
			ID:        "build-1",
			ProjectID: projectID,
			ServiceID: serviceID,
			Status:    status,
			Progress:  100,
			StartedAt: time.Now().Add(-1 * time.Hour),
			ImageName: "example-app",
			ImageTag:  "latest",
			Size:      1024 * 1024 * 100,
		},
	}

	c.JSON(http.StatusOK, BuildListResponse{
		Builds: builds,
		Total:  len(builds),
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

	// For now, just return success
	// In production, this would actually cancel the build process
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

	// For now, return mock logs
	// In production, this would stream actual build logs
	logs := "Build " + buildID + " started\n"
	logs += "Detecting runtime...\n"
	logs += "Runtime detected: node\n"
	logs += "Building image...\n"
	logs += "Build completed successfully\n"

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
