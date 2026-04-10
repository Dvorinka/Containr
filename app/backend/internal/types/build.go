package types

import "time"

// BuildRequest represents a request to build a container image
type BuildRequest struct {
	// Build configuration
	BuildType      string            `json:"build_type"`      // nixpacks, dockerfile, prebuilt
	SourcePath     string            `json:"source_path"`     // Path to source code
	PrebuiltImage  string            `json:"prebuilt_image"`  // Prebuilt image name
	ImageName      string            `json:"image_name"`      // Output image name
	ImageTag       string            `json:"image_tag"`       // Output image tag
	RegistryURL    string            `json:"registry_url"`    // Registry URL for pushing
	
	// Build commands
	BuildCommand   string            `json:"build_command"`   // Custom build command
	StartCommand   string            `json:"start_command"`   // Custom start command
	
	// Environment and configuration
	Environment    map[string]string `json:"environment"`     // Build environment variables
	BuildArgs      map[string]string `json:"build_args"`      // Docker build args
	Labels         map[string]string `json:"labels"`          // Image labels
	
	// Context
	ProjectID      string            `json:"project_id"`      // Project ID
	ServiceID      string            `json:"service_id"`      // Service ID
	DeploymentID   string            `json:"deployment_id"`   // Deployment ID
	TriggeredBy    string            `json:"triggered_by"`    // Who triggered the build
	Branch         string            `json:"branch"`          // Git branch
	Commit         string            `json:"commit"`          // Git commit SHA
}

// BuildResponse represents the response from a build operation
type BuildResponse struct {
	ImageName   string    `json:"image_name"`   // Built image name
	ImageTag    string    `json:"image_tag"`    // Image tag
	Size        int64     `json:"size"`         // Image size in bytes
	Digest      string    `json:"digest"`       // Image digest
	BuildTime   time.Time `json:"build_time"`   // When build completed
	BuildLog    string    `json:"build_log"`    // Build logs
	Success     bool      `json:"success"`      // Whether build succeeded
	Error       string    `json:"error"`        // Error message if failed
}

// BuildStatus represents the status of a build
type BuildStatus struct {
	ID           string            `json:"id"`           // Build ID
	ProjectID    string            `json:"project_id"`   // Project ID
	ServiceID    string            `json:"service_id"`   // Service ID
	DeploymentID string            `json:"deployment_id"` // Deployment ID
	Status       string            `json:"status"`       // pending, building, success, failed
	Progress     int               `json:"progress"`     // Build progress 0-100
	StartedAt    time.Time         `json:"started_at"`   // When build started
	CompletedAt  *time.Time        `json:"completed_at"` // When build completed
	ImageName    string            `json:"image_name"`   // Built image name
	ImageTag     string            `json:"image_tag"`    // Image tag
	Size         int64             `json:"size"`         // Image size in bytes
	Error        string            `json:"error"`        // Error message if failed
	Log          string            `json:"log"`          // Build logs
	Metadata     map[string]string `json:"metadata"`     // Additional metadata
}

// BuildPlan represents a build plan for inspection
type BuildPlan struct {
	BuildType    string            `json:"build_type"`    // Type of build
	Runtime      string            `json:"runtime"`       // Detected runtime
	Builder      string            `json:"builder"`       // Builder to use
	Steps        []BuildStep       `json:"steps"`         // Build steps
	Environment  map[string]string `json:"environment"`   // Environment variables
	Dependencies []string          `json:"dependencies"`  // Dependencies
	Estimate     BuildEstimate     `json:"estimate"`      // Build time/size estimate
}

// BuildStep represents a single step in the build process
type BuildStep struct {
	Name        string            `json:"name"`        // Step name
	Command     string            `json:"command"`     // Command to run
	Args        []string          `json:"args"`        // Command arguments
	Environment map[string]string `json:"environment"` // Step-specific environment
	Timeout     time.Duration     `json:"timeout"`     // Step timeout
	Critical    bool              `json:"critical"`    // Whether step is critical
}

// BuildEstimate provides estimates for build time and size
type BuildEstimate struct {
	Duration   time.Duration `json:"duration"`    // Estimated build duration
	ImageSize  int64         `json:"image_size"`  // Estimated image size
	Confidence float64       `json:"confidence"`  // Confidence in estimate (0-1)
}

// BuildCache represents build cache information
type BuildCache struct {
	Key        string            `json:"key"`        // Cache key
	Path       string            `json:"path"`       // Cache path
	Size       int64             `json:"size"`       // Cache size in bytes
	CreatedAt  time.Time         `json:"created_at"` // When cache was created
	AccessedAt time.Time         `json:"accessed_at"` // When cache was last accessed
	Metadata   map[string]string `json:"metadata"`   // Cache metadata
}

// BuildTrigger represents what triggered a build
type BuildTrigger struct {
	Type      string            `json:"type"`       // webhook, manual, api, scheduled
	Source    string            `json:"source"`     // Source of trigger
	User      string            `json:"user"`       // User who triggered (if applicable)
	Data      map[string]string `json:"data"`       // Trigger-specific data
	Timestamp time.Time         `json:"timestamp"`  // When trigger occurred
}

// BuildConfig represents global build configuration
type BuildConfig struct {
	DefaultBuilder    string            `json:"default_builder"`     // Default builder type
	CacheEnabled      bool              `json:"cache_enabled"`       // Whether build caching is enabled
	CacheSizeLimit    int64             `json:"cache_size_limit"`    // Cache size limit in bytes
	ParallelBuilds    int               `json:"parallel_builds"`     // Max parallel builds
	Timeout           time.Duration     `json:"timeout"`             // Default build timeout
	Registry          string            `json:"registry"`            // Default registry
	Environment       map[string]string `json:"environment"`         // Default environment variables
	AllowedRegistries []string          `json:"allowed_registries"`  // Allowed container registries
}

// BuildMetric represents build metrics for monitoring
type BuildMetric struct {
	Timestamp    time.Time `json:"timestamp"`     // When metric was recorded
	BuildCount   int       `json:"build_count"`   // Number of builds
	SuccessCount int       `json:"success_count"` // Number of successful builds
	FailureCount int       `json:"failure_count"` // Number of failed builds
	AvgDuration  time.Duration `json:"avg_duration"`  // Average build duration
	AvgSize      int64     `json:"avg_size"`      // Average image size
}

// BuildQueue represents the build queue status
type BuildQueue struct {
	Running   int         `json:"running"`    // Currently running builds
	Pending   int         `json:"pending"`    // Pending builds in queue
	Completed int         `json:"completed"`  // Completed builds
	Failed    int         `json:"failed"`     // Failed builds
	Capacity  int         `json:"capacity"`   // Queue capacity
	WaitTime  time.Duration `json:"wait_time"` // Average wait time
}
