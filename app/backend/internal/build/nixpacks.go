package build

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"containr/internal/docker"
	"containr/internal/types"
)

type NixpacksBuilder struct {
	workDir      string
	dockerClient *docker.Client
}

type NixpacksPlan struct {
	Pkgs []struct {
		Name    string `json:"name"`
		Version string `json:"version"`
		Path    string `json:"path"`
	} `json:"pkgs"`
	Build struct {
		Builder string   `json:"builder"`
		Args    []string `json:"args"`
	} `json:"build"`
	Start struct {
		Cmd []string          `json:"cmd"`
		Env map[string]string `json:"env"`
		Dir string            `json:"dir"`
	} `json:"start"`
	Install struct {
		Cmd []string `json:"cmd"`
	} `json:"install"`
}

type NixpacksConfig struct {
	BuildCmd   string            `json:"build_cmd,omitempty"`
	StartCmd   string            `json:"start_cmd,omitempty"`
	Pkgs       []string          `json:"pkgs,omitempty"`
	Env        map[string]string `json:"env,omitempty"`
	InstallCmd string            `json:"install_cmd,omitempty"`
}

func NewNixpacksBuilder(workDir string, dockerClient *docker.Client) *NixpacksBuilder {
	return &NixpacksBuilder{
		workDir:      workDir,
		dockerClient: dockerClient,
	}
}

// DetectRuntime detects the runtime based on project files
func (n *NixpacksBuilder) DetectRuntime(ctx context.Context, repoPath string) (string, error) {
	detections := map[string][]string{
		"go":     {"go.mod", "go.sum", "main.go"},
		"node":   {"package.json", "package-lock.json", "yarn.lock", "pnpm-lock.yaml"},
		"python": {"requirements.txt", "setup.py", "pyproject.toml", "Pipfile"},
		"rust":   {"Cargo.toml", "Cargo.lock"},
		"ruby":   {"Gemfile", "Gemfile.lock"},
		"php":    {"composer.json", "composer.lock"},
		"deno":   {"deno.json", "deno.jsonc"},
		"bun":    {"bun.lockb", "package.json"},
		"static": {"index.html", "dist/", "public/"},
	}

	for runtime, files := range detections {
		for _, file := range files {
			fullPath := filepath.Join(repoPath, file)
			if _, err := os.Stat(fullPath); err == nil {
				return runtime, nil
			}
		}
	}

	return "unknown", nil
}

// GeneratePlan generates a Nixpacks build plan
func (n *NixpacksBuilder) GeneratePlan(ctx context.Context, repoPath string, config *NixpacksConfig) (*NixpacksPlan, error) {
	runtime, err := n.DetectRuntime(ctx, repoPath)
	if err != nil {
		return nil, fmt.Errorf("failed to detect runtime: %w", err)
	}

	plan := &NixpacksPlan{}

	switch runtime {
	case "go":
		plan = n.generateGoPlan(config)
	case "node":
		plan = n.generateNodePlan(config)
	case "python":
		plan = n.generatePythonPlan(config)
	case "rust":
		plan = n.generateRustPlan(config)
	case "ruby":
		plan = n.generateRubyPlan(config)
	case "php":
		plan = n.generatePHPPlan(config)
	case "deno":
		plan = n.generateDenoPlan(config)
	case "bun":
		plan = n.generateBunPlan(config)
	case "static":
		plan = n.generateStaticPlan(config)
	default:
		return nil, fmt.Errorf("unsupported runtime: %s", runtime)
	}

	return plan, nil
}

func (n *NixpacksBuilder) generateGoPlan(config *NixpacksConfig) *NixpacksPlan {
	plan := &NixpacksPlan{}

	// Base packages
	plan.Pkgs = []struct {
		Name    string `json:"name"`
		Version string `json:"version"`
		Path    string `json:"path"`
	}{
		{Name: "go", Version: "1.21", Path: "pkgs.go"},
		{Name: "cacert", Version: "latest", Path: "pkgs.cacert"},
	}

	// Build configuration
	if config.BuildCmd != "" {
		plan.Build.Builder = "custom"
		plan.Build.Args = strings.Fields(config.BuildCmd)
	} else {
		plan.Build.Builder = "go"
		plan.Build.Args = []string{"build", "-o", "app", "."}
	}

	// Start configuration
	if config.StartCmd != "" {
		plan.Start.Cmd = strings.Fields(config.StartCmd)
	} else {
		plan.Start.Cmd = []string{"./app"}
	}
	plan.Start.Dir = "/app"

	// Environment
	plan.Start.Env = map[string]string{
		"GOPATH":        "/go",
		"GOCACHE":       "/tmp/go-cache",
		"GOMODCACHE":    "/tmp/go-mod-cache",
		"SSL_CERT_FILE": "/etc/ssl/certs/ca-certificates.crt",
	}

	// Add custom environment
	for k, v := range config.Env {
		plan.Start.Env[k] = v
	}

	return plan
}

func (n *NixpacksBuilder) generateNodePlan(config *NixpacksConfig) *NixpacksPlan {
	plan := &NixpacksPlan{}

	plan.Pkgs = []struct {
		Name    string `json:"name"`
		Version string `json:"version"`
		Path    string `json:"path"`
	}{
		{Name: "nodejs", Version: "20", Path: "pkgs.nodejs"},
		{Name: "cacert", Version: "latest", Path: "pkgs.cacert"},
	}

	if config.BuildCmd != "" {
		plan.Build.Builder = "custom"
		plan.Build.Args = strings.Fields(config.BuildCmd)
	} else {
		plan.Build.Builder = "npm"
		plan.Build.Args = []string{"run", "build"}
	}

	if config.StartCmd != "" {
		plan.Start.Cmd = strings.Fields(config.StartCmd)
	} else {
		plan.Start.Cmd = []string{"npm", "start"}
	}
	plan.Start.Dir = "/app"

	plan.Start.Env = map[string]string{
		"NODE_ENV":      "production",
		"SSL_CERT_FILE": "/etc/ssl/certs/ca-certificates.crt",
	}

	for k, v := range config.Env {
		plan.Start.Env[k] = v
	}

	return plan
}

func (n *NixpacksBuilder) generatePythonPlan(config *NixpacksConfig) *NixpacksPlan {
	plan := &NixpacksPlan{}

	plan.Pkgs = []struct {
		Name    string `json:"name"`
		Version string `json:"version"`
		Path    string `json:"path"`
	}{
		{Name: "python3", Version: "3.11", Path: "pkgs.python3"},
		{Name: "cacert", Version: "latest", Path: "pkgs.cacert"},
	}

	if config.BuildCmd != "" {
		plan.Build.Builder = "custom"
		plan.Build.Args = strings.Fields(config.BuildCmd)
	} else {
		plan.Build.Builder = "pip"
		plan.Build.Args = []string{"install", "-r", "requirements.txt"}
	}

	if config.StartCmd != "" {
		plan.Start.Cmd = strings.Fields(config.StartCmd)
	} else {
		plan.Start.Cmd = []string{"python", "app.py"}
	}
	plan.Start.Dir = "/app"

	plan.Start.Env = map[string]string{
		"PYTHONPATH":    "/app",
		"SSL_CERT_FILE": "/etc/ssl/certs/ca-certificates.crt",
	}

	for k, v := range config.Env {
		plan.Start.Env[k] = v
	}

	return plan
}

func (n *NixpacksBuilder) generateRustPlan(config *NixpacksConfig) *NixpacksPlan {
	plan := &NixpacksPlan{}

	plan.Pkgs = []struct {
		Name    string `json:"name"`
		Version string `json:"version"`
		Path    string `json:"path"`
	}{
		{Name: "rustc", Version: "latest", Path: "pkgs.rustc"},
		{Name: "cargo", Version: "latest", Path: "pkgs.cargo"},
		{Name: "cacert", Version: "latest", Path: "pkgs.cacert"},
	}

	if config.BuildCmd != "" {
		plan.Build.Builder = "custom"
		plan.Build.Args = strings.Fields(config.BuildCmd)
	} else {
		plan.Build.Builder = "cargo"
		plan.Build.Args = []string{"build", "--release"}
	}

	if config.StartCmd != "" {
		plan.Start.Cmd = strings.Fields(config.StartCmd)
	} else {
		plan.Start.Cmd = []string{"./target/release/app"}
	}
	plan.Start.Dir = "/app"

	plan.Start.Env = map[string]string{
		"SSL_CERT_FILE": "/etc/ssl/certs/ca-certificates.crt",
	}

	for k, v := range config.Env {
		plan.Start.Env[k] = v
	}

	return plan
}

func (n *NixpacksBuilder) generateRubyPlan(config *NixpacksConfig) *NixpacksPlan {
	plan := &NixpacksPlan{}

	plan.Pkgs = []struct {
		Name    string `json:"name"`
		Version string `json:"version"`
		Path    string `json:"path"`
	}{
		{Name: "ruby", Version: "3.2", Path: "pkgs.ruby"},
		{Name: "bundler", Version: "latest", Path: "pkgs.bundler"},
		{Name: "cacert", Version: "latest", Path: "pkgs.cacert"},
	}

	if config.BuildCmd != "" {
		plan.Build.Builder = "custom"
		plan.Build.Args = strings.Fields(config.BuildCmd)
	} else {
		plan.Build.Builder = "bundler"
		plan.Build.Args = []string{"install"}
	}

	if config.StartCmd != "" {
		plan.Start.Cmd = strings.Fields(config.StartCmd)
	} else {
		plan.Start.Cmd = []string{"bundle", "exec", "ruby", "app.rb"}
	}
	plan.Start.Dir = "/app"

	plan.Start.Env = map[string]string{
		"GEM_HOME":      "/app/vendor/bundle/ruby/3.2.0",
		"SSL_CERT_FILE": "/etc/ssl/certs/ca-certificates.crt",
	}

	for k, v := range config.Env {
		plan.Start.Env[k] = v
	}

	return plan
}

func (n *NixpacksBuilder) generatePHPPlan(config *NixpacksConfig) *NixpacksPlan {
	plan := &NixpacksPlan{}

	plan.Pkgs = []struct {
		Name    string `json:"name"`
		Version string `json:"version"`
		Path    string `json:"path"`
	}{
		{Name: "php", Version: "8.2", Path: "pkgs.php"},
		{Name: "composer", Version: "latest", Path: "pkgs.composer"},
		{Name: "cacert", Version: "latest", Path: "pkgs.cacert"},
	}

	if config.BuildCmd != "" {
		plan.Build.Builder = "custom"
		plan.Build.Args = strings.Fields(config.BuildCmd)
	} else {
		plan.Build.Builder = "composer"
		plan.Build.Args = []string{"install"}
	}

	if config.StartCmd != "" {
		plan.Start.Cmd = strings.Fields(config.StartCmd)
	} else {
		plan.Start.Cmd = []string{"php", "-S", "0.0.0.0:8080", "-t", "public"}
	}
	plan.Start.Dir = "/app"

	plan.Start.Env = map[string]string{
		"SSL_CERT_FILE": "/etc/ssl/certs/ca-certificates.crt",
	}

	for k, v := range config.Env {
		plan.Start.Env[k] = v
	}

	return plan
}

func (n *NixpacksBuilder) generateDenoPlan(config *NixpacksConfig) *NixpacksPlan {
	plan := &NixpacksPlan{}

	plan.Pkgs = []struct {
		Name    string `json:"name"`
		Version string `json:"version"`
		Path    string `json:"path"`
	}{
		{Name: "deno", Version: "latest", Path: "pkgs.deno"},
		{Name: "cacert", Version: "latest", Path: "pkgs.cacert"},
	}

	if config.BuildCmd != "" {
		plan.Build.Builder = "custom"
		plan.Build.Args = strings.Fields(config.BuildCmd)
	} else {
		plan.Build.Builder = "deno"
		plan.Build.Args = []string{"cache"}
	}

	if config.StartCmd != "" {
		plan.Start.Cmd = strings.Fields(config.StartCmd)
	} else {
		plan.Start.Cmd = []string{"deno", "task", "start"}
	}
	plan.Start.Dir = "/app"

	plan.Start.Env = map[string]string{
		"DENO_DIR":      "/deno-dir",
		"SSL_CERT_FILE": "/etc/ssl/certs/ca-certificates.crt",
	}

	for k, v := range config.Env {
		plan.Start.Env[k] = v
	}

	return plan
}

func (n *NixpacksBuilder) generateBunPlan(config *NixpacksConfig) *NixpacksPlan {
	plan := &NixpacksPlan{}

	plan.Pkgs = []struct {
		Name    string `json:"name"`
		Version string `json:"version"`
		Path    string `json:"path"`
	}{
		{Name: "bun", Version: "latest", Path: "pkgs.bun"},
		{Name: "cacert", Version: "latest", Path: "pkgs.cacert"},
	}

	if config.BuildCmd != "" {
		plan.Build.Builder = "custom"
		plan.Build.Args = strings.Fields(config.BuildCmd)
	} else {
		plan.Build.Builder = "bun"
		plan.Build.Args = []string{"install"}
	}

	if config.StartCmd != "" {
		plan.Start.Cmd = strings.Fields(config.StartCmd)
	} else {
		plan.Start.Cmd = []string{"bun", "start"}
	}
	plan.Start.Dir = "/app"

	plan.Start.Env = map[string]string{
		"SSL_CERT_FILE": "/etc/ssl/certs/ca-certificates.crt",
	}

	for k, v := range config.Env {
		plan.Start.Env[k] = v
	}

	return plan
}

func (n *NixpacksBuilder) generateStaticPlan(config *NixpacksConfig) *NixpacksPlan {
	plan := &NixpacksPlan{}

	plan.Pkgs = []struct {
		Name    string `json:"name"`
		Version string `json:"version"`
		Path    string `json:"path"`
	}{
		{Name: "nginx", Version: "latest", Path: "pkgs.nginx"},
	}

	plan.Build.Builder = "static"
	plan.Build.Args = []string{}

	if config.StartCmd != "" {
		plan.Start.Cmd = strings.Fields(config.StartCmd)
	} else {
		plan.Start.Cmd = []string{"nginx", "-g", "daemon off;"}
	}
	plan.Start.Dir = "/usr/share/nginx/html"

	plan.Start.Env = map[string]string{}

	for k, v := range config.Env {
		plan.Start.Env[k] = v
	}

	return plan
}

// Build builds the container image using Nixpacks
func (n *NixpacksBuilder) Build(ctx context.Context, req *types.BuildRequest) (*types.BuildResponse, error) {
	// Generate build plan
	config := &NixpacksConfig{
		BuildCmd: req.BuildCommand,
		StartCmd: req.StartCommand,
		Env:      req.Environment,
	}

	plan, err := n.GeneratePlan(ctx, req.SourcePath, config)
	if err != nil {
		return nil, fmt.Errorf("failed to generate build plan: %w", err)
	}

	// Create temporary Dockerfile
	dockerfile, err := n.generateDockerfile(plan)
	if err != nil {
		return nil, fmt.Errorf("failed to generate Dockerfile: %w", err)
	}
	defer os.Remove(dockerfile)

	// Build Docker image
	imageName := fmt.Sprintf("%s:%s", req.ImageName, req.ImageTag)

	// Create build context tar
	buildCtx, err := createBuildContext(req.SourcePath, dockerfile)
	if err != nil {
		return nil, fmt.Errorf("failed to create build context: %w", err)
	}
	defer buildCtx.Close()

	buildOptions := docker.BuildOptions{
		Dockerfile: "Dockerfile",
		Tags:       []string{imageName},
		BuildArgs: map[string]*string{
			"BUILDKIT_INLINE_CACHE": strPtr("1"),
		},
		Remove: true,
	}

	_, err = n.dockerClient.BuildImage(ctx, buildCtx, buildOptions)
	if err != nil {
		return nil, fmt.Errorf("failed to build Docker image: %w", err)
	}

	// Push to registry if specified
	if req.RegistryURL != "" {
		err = n.dockerClient.PushImage(ctx, imageName, req.RegistryURL)
		if err != nil {
			return nil, fmt.Errorf("failed to push image: %w", err)
		}
		imageName = fmt.Sprintf("%s/%s:%s", req.RegistryURL, req.ImageName, req.ImageTag)
	}

	return &types.BuildResponse{
		ImageName: imageName,
		ImageTag:  req.ImageTag,
		Size:      0,  // TODO: Get actual image size
		Digest:    "", // TODO: Get image digest
	}, nil
}

func (n *NixpacksBuilder) generateDockerfile(plan *NixpacksPlan) (string, error) {
	dockerfile := filepath.Join(n.workDir, "Dockerfile")

	var content strings.Builder

	// Base image
	content.WriteString("FROM nixpkgs/nix:latest\n\n")

	// Install packages
	content.WriteString("# Install packages\n")
	for _, pkg := range plan.Pkgs {
		content.WriteString(fmt.Sprintf("RUN nix-env -iA nixpkgs.%s\n", pkg.Name))
	}
	content.WriteString("\n")

	// Set working directory
	content.WriteString("WORKDIR /app\n\n")

	// Copy source code
	content.WriteString("# Copy source code\n")
	content.WriteString("COPY . .\n\n")

	// Build step
	if len(plan.Build.Args) > 0 {
		content.WriteString("# Build application\n")
		content.WriteString("RUN " + strings.Join(plan.Build.Args, " ") + "\n\n")
	}

	// Environment variables
	if len(plan.Start.Env) > 0 {
		content.WriteString("# Set environment variables\n")
		for k, v := range plan.Start.Env {
			content.WriteString(fmt.Sprintf("ENV %s=%s\n", k, v))
		}
		content.WriteString("\n")
	}

	// Start command
	if len(plan.Start.Cmd) > 0 {
		content.WriteString("# Start application\n")
		content.WriteString("CMD [" + strings.Join(plan.Start.Cmd, ", ") + "]\n")
	}

	err := os.WriteFile(dockerfile, []byte(content.String()), 0644)
	if err != nil {
		return "", err
	}

	return dockerfile, nil
}
