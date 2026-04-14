package build

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"containr/internal/docker"
	"containr/internal/types"
)

type RailpackBuilder struct {
	workDir      string
	dockerClient *docker.Client
	httpClient   *http.Client
}

type RailpackConfig struct {
	BuildCmd  string            `json:"buildCmd,omitempty"`
	StartCmd  string            `json:"startCmd,omitempty"`
	Env       map[string]string `json:"env,omitempty"`
	Root      string            `json:"root,omitempty"`
	Planner   string            `json:"planner,omitempty"`
	Variables map[string]string `json:"variables,omitempty"`
}

type RailpackBuildRequest struct {
	Config    RailpackConfig `json:"config"`
	SourceDir string         `json:"sourceDir"`
}

type RailpackBuildResponse struct {
	Success    bool   `json:"success"`
	Dockerfile string `json:"dockerfile"`
	Error      string `json:"error,omitempty"`
}

type RailpackPlan struct {
	Planner  string                 `json:"planner"`
	BuildCmd string                 `json:"buildCmd"`
	StartCmd string                 `json:"startCmd"`
	Env      map[string]string      `json:"env"`
	Assets   map[string]interface{} `json:"assets"`
	Metadata map[string]interface{} `json:"metadata"`
}

func NewRailpackBuilder(workDir string, dockerClient *docker.Client) *RailpackBuilder {
	return &RailpackBuilder{
		workDir:      workDir,
		dockerClient: dockerClient,
		httpClient: &http.Client{
			Timeout: 30 * time.Minute,
		},
	}
}

// DetectRailpack checks if the project can be built with Railpack
func (rb *RailpackBuilder) DetectRailpack(ctx context.Context, sourcePath string) error {
	// Check for common web framework files that Railpack supports
	detectionFiles := []string{
		"package.json",     // Node.js
		"requirements.txt", // Python
		"go.mod",           // Go
		"Cargo.toml",       // Rust
		"pom.xml",          // Java/Maven
		"build.gradle",     // Java/Gradle
		"Gemfile",          // Ruby
		"composer.json",    // PHP
	}

	for _, file := range detectionFiles {
		if _, err := os.Stat(filepath.Join(sourcePath, file)); err == nil {
			return nil
		}
	}

	return fmt.Errorf("no supported framework detected")
}

// GeneratePlan creates a build plan using Railpack
func (rb *RailpackBuilder) GeneratePlan(ctx context.Context, sourcePath string, config *RailpackConfig) (*RailpackPlan, error) {
	// Call Railpack API to generate build plan
	planURL := "https://api.railpack.app/v1/plan"

	req := RailpackBuildRequest{
		Config:    *config,
		SourceDir: sourcePath,
	}

	planResp, err := rb.makeRailpackRequest(ctx, "POST", planURL, req)
	if err != nil {
		return nil, fmt.Errorf("failed to generate Railpack plan: %w", err)
	}

	var plan RailpackPlan
	if err := json.Unmarshal(planResp, &plan); err != nil {
		return nil, fmt.Errorf("failed to parse Railpack plan: %w", err)
	}

	return &plan, nil
}

// Build generates a Dockerfile using Railpack and builds the image
func (rb *RailpackBuilder) Build(ctx context.Context, req *types.BuildRequest) (*types.BuildResponse, error) {
	// Detect if Railpack can build this project
	if err := rb.DetectRailpack(ctx, req.SourcePath); err != nil {
		return nil, fmt.Errorf("Railpack cannot build this project: %w", err)
	}

	// Create Railpack config
	config := RailpackConfig{
		BuildCmd: req.BuildCommand,
		StartCmd: req.StartCommand,
		Env:      req.Environment,
	}

	// Generate Dockerfile using Railpack
	dockerfile, err := rb.generateDockerfile(ctx, req.SourcePath, &config)
	if err != nil {
		return nil, fmt.Errorf("failed to generate Dockerfile with Railpack: %w", err)
	}

	// Write Dockerfile to temporary location
	dockerfilePath := filepath.Join(rb.workDir, "Dockerfile")
	if err := os.WriteFile(dockerfilePath, []byte(dockerfile), 0644); err != nil {
		return nil, fmt.Errorf("failed to write Dockerfile: %w", err)
	}

	// Build the Docker image
	imageName := fmt.Sprintf("%s:%s", req.ImageName, req.ImageTag)

	buildCtx := req.SourcePath

	buildArgs := make(map[string]*string)
	for k, v := range req.Environment {
		val := v
		buildArgs[k] = &val
	}

	// Create build context from directory
	buildContext, err := rb.createBuildContext(buildCtx)
	if err != nil {
		return nil, fmt.Errorf("failed to create build context: %w", err)
	}
	defer os.Remove(buildContext.Name())

	buildOptions := docker.BuildOptions{
		Dockerfile: "Dockerfile",
		Tags:       []string{imageName},
		BuildArgs:  buildArgs,
		Labels:     req.Labels,
		Remove:     true,
	}

	_, err = rb.dockerClient.BuildImage(ctx, buildContext, buildOptions)
	if err != nil {
		return nil, fmt.Errorf("failed to build image: %w", err)
	}

	// Get image info
	imageInfo, err := rb.dockerClient.GetImageInfo(ctx, imageName)
	if err != nil {
		return nil, fmt.Errorf("failed to get image info: %w", err)
	}

	// Push to registry if specified
	if req.RegistryURL != "" {
		err = rb.dockerClient.PushImage(ctx, imageName, req.RegistryURL)
		if err != nil {
			return nil, fmt.Errorf("failed to push image: %w", err)
		}
		imageName = fmt.Sprintf("%s/%s", req.RegistryURL, imageName)
	}

	return &types.BuildResponse{
		ImageName: imageName,
		ImageTag:  req.ImageTag,
		Size:      imageInfo.Size,
		Digest:    imageInfo.Digest,
	}, nil
}

// generateDockerfile calls Railpack API to generate optimized Dockerfile
func (rb *RailpackBuilder) generateDockerfile(ctx context.Context, sourcePath string, config *RailpackConfig) (string, error) {
	// Use Railpack API to generate Dockerfile
	generateURL := "https://api.railpack.app/v1/generate"

	req := RailpackBuildRequest{
		Config:    *config,
		SourceDir: sourcePath,
	}

	resp, err := rb.makeRailpackRequest(ctx, "POST", generateURL, req)
	if err != nil {
		return "", fmt.Errorf("failed to generate Dockerfile: %w", err)
	}

	var buildResp RailpackBuildResponse
	if err := json.Unmarshal(resp, &buildResp); err != nil {
		return "", fmt.Errorf("failed to parse Railpack response: %w", err)
	}

	if !buildResp.Success {
		return "", fmt.Errorf("Railpack generation failed: %s", buildResp.Error)
	}

	return buildResp.Dockerfile, nil
}

// makeRailpackRequest makes HTTP requests to Railpack API
func (rb *RailpackBuilder) makeRailpackRequest(ctx context.Context, method, url string, body interface{}) ([]byte, error) {
	var bodyReader io.Reader

	if body != nil {
		bodyBytes, err := json.Marshal(body)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal request body: %w", err)
		}
		bodyReader = strings.NewReader(string(bodyBytes))
	}

	req, err := http.NewRequestWithContext(ctx, method, url, bodyReader)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "containr/1.0")

	resp, err := rb.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to make request: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("Railpack API error: %d - %s", resp.StatusCode, string(respBody))
	}

	return respBody, nil
}

// GetSupportedFrameworks returns a list of frameworks supported by Railpack
func (rb *RailpackBuilder) GetSupportedFrameworks() []string {
	return []string{
		"node.js",
		"python",
		"go",
		"rust",
		"java",
		"ruby",
		"php",
		"static",
	}
}

// createBuildContext creates a tar archive from the build context directory
func (rb *RailpackBuilder) createBuildContext(sourcePath string) (*os.File, error) {
	// Create a temporary file for the tar archive
	tmpFile, err := os.CreateTemp("", "build-context-*.tar")
	if err != nil {
		return nil, fmt.Errorf("failed to create temp file: %w", err)
	}

	// Create tar archive from source directory
	cmd := fmt.Sprintf("cd %s && tar -cf %s .", sourcePath, tmpFile.Name())

	// Use tar command to create the build context
	if err := rb.runCommand(cmd); err != nil {
		tmpFile.Close()
		os.Remove(tmpFile.Name())
		return nil, fmt.Errorf("failed to create build context: %w", err)
	}

	// Seek back to beginning of file
	if _, err := tmpFile.Seek(0, 0); err != nil {
		tmpFile.Close()
		os.Remove(tmpFile.Name())
		return nil, fmt.Errorf("failed to seek in temp file: %w", err)
	}

	return tmpFile, nil
}

// runCommand executes a shell command
func (rb *RailpackBuilder) runCommand(cmd string) error {
	parts := strings.Fields(cmd)
	if len(parts) == 0 {
		return fmt.Errorf("empty command")
	}

	execCmd := exec.Command(parts[0], parts[1:]...)
	execCmd.Stdin = os.Stdin
	execCmd.Stdout = os.Stdout
	execCmd.Stderr = os.Stderr
	return execCmd.Run()
}
