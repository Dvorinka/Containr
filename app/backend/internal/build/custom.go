package build

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

// CustomRuntimeManager handles custom runtime and buildpack support
type CustomRuntimeManager struct {
	workDir       string
	buildpacksDir string
	runtimes      map[string]*CustomRuntime
}

// CustomRuntime represents a custom runtime configuration
type CustomRuntime struct {
	Name         string                  `json:"name"`
	Version      string                  `json:"version"`
	Type         string                  `json:"type"` // "buildpack", "dockerfile", "native"
	Description  string                  `json:"description"`
	Buildpack    *BuildpackConfig        `json:"buildpack,omitempty"`
	Dockerfile   *CustomDockerfileConfig `json:"dockerfile,omitempty"`
	Native       *NativeConfig           `json:"native,omitempty"`
	Dependencies []string                `json:"dependencies"`
	Environment  map[string]string       `json:"environment"`
}

// BuildpackConfig represents buildpack configuration
type BuildpackConfig struct {
	ID          string            `json:"id"`
	Version     string            `json:"version"`
	URL         string            `json:"url"`
	Buildpacks  []string          `json:"buildpacks"`
	Groups      []BuildpackGroup  `json:"groups"`
	Order       []BuildpackOrder  `json:"order"`
	Environment map[string]string `json:"environment"`
}

// BuildpackGroup represents a group of buildpacks
type BuildpackGroup struct {
	ID    string   `json:"id"`
	Home  string   `json:"home"`
	Order []string `json:"order"`
}

// BuildpackOrder represents buildpack execution order
type BuildpackOrder struct {
	Group     []string `json:"group"`
	Lifecycle string   `json:"lifecycle"`
}

// CustomDockerfileConfig represents custom Dockerfile configuration (to avoid conflict)
type CustomDockerfileConfig struct {
	Template    string            `json:"template"`
	BaseImage   string            `json:"base_image"`
	BuildArgs   map[string]string `json:"build_args"`
	Labels      map[string]string `json:"labels"`
	StartCmd    string            `json:"start_cmd"`
	HealthCheck *HealthCheck      `json:"health_check,omitempty"`
}

// NativeConfig represents native build configuration
type NativeConfig struct {
	Compiler    string            `json:"compiler"`
	BuildCmd    string            `json:"build_cmd"`
	StartCmd    string            `json:"start_cmd"`
	Extensions  []string          `json:"extensions"`
	Environment map[string]string `json:"environment"`
}

// HealthCheck represents health check configuration
type HealthCheck struct {
	Test        []string `json:"test"`
	Interval    string   `json:"interval"`
	Timeout     string   `json:"timeout"`
	Retries     int      `json:"retries"`
	StartPeriod string   `json:"start_period"`
}

func NewCustomRuntimeManager(workDir string) *CustomRuntimeManager {
	return &CustomRuntimeManager{
		workDir:       workDir,
		buildpacksDir: filepath.Join(workDir, "buildpacks"),
		runtimes:      make(map[string]*CustomRuntime),
	}
}

// LoadCustomRuntime loads a custom runtime from configuration
func (crm *CustomRuntimeManager) LoadCustomRuntime(ctx context.Context, configPath string) (*CustomRuntime, error) {
	data, err := os.ReadFile(configPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read runtime config: %w", err)
	}

	var runtime CustomRuntime
	if err := json.Unmarshal(data, &runtime); err != nil {
		return nil, fmt.Errorf("failed to parse runtime config: %w", err)
	}

	// Validate runtime configuration
	if err := crm.validateRuntime(&runtime); err != nil {
		return nil, fmt.Errorf("invalid runtime configuration: %w", err)
	}

	// Store runtime
	crm.runtimes[runtime.Name] = &runtime

	return &runtime, nil
}

// validateRuntime validates a custom runtime configuration
func (crm *CustomRuntimeManager) validateRuntime(runtime *CustomRuntime) error {
	if runtime.Name == "" {
		return fmt.Errorf("runtime name is required")
	}

	if runtime.Version == "" {
		return fmt.Errorf("runtime version is required")
	}

	switch runtime.Type {
	case "buildpack":
		if runtime.Buildpack == nil {
			return fmt.Errorf("buildpack configuration is required for buildpack type")
		}
		if runtime.Buildpack.ID == "" {
			return fmt.Errorf("buildpack ID is required")
		}
	case "dockerfile":
		if runtime.Dockerfile == nil {
			return fmt.Errorf("dockerfile configuration is required for dockerfile type")
		}
		if runtime.Dockerfile.BaseImage == "" {
			return fmt.Errorf("base image is required for dockerfile type")
		}
	case "native":
		if runtime.Native == nil {
			return fmt.Errorf("native configuration is required for native type")
		}
		if runtime.Native.Compiler == "" {
			return fmt.Errorf("compiler is required for native type")
		}
	default:
		return fmt.Errorf("unsupported runtime type: %s", runtime.Type)
	}

	return nil
}

// DetectCustomRuntime detects if a project uses a custom runtime
func (crm *CustomRuntimeManager) DetectCustomRuntime(ctx context.Context, projectPath string) (*CustomRuntime, error) {
	// Check for runtime configuration file
	runtimeFiles := []string{
		"runtime.json",
		".runtime.json",
		"containr.json",
		".containr.json",
		"buildpack.yml",
		".buildpack.yml",
	}

	for _, file := range runtimeFiles {
		configPath := filepath.Join(projectPath, file)
		if _, err := os.Stat(configPath); err == nil {
			runtime, err := crm.LoadCustomRuntime(ctx, configPath)
			if err != nil {
				continue // Try next file
			}
			return runtime, nil
		}
	}

	// Check for known custom runtime indicators
	if runtime := crm.detectKnownRuntimes(projectPath); runtime != nil {
		return runtime, nil
	}

	return nil, fmt.Errorf("no custom runtime detected")
}

// detectKnownRuntimes detects known custom runtimes from project structure
func (crm *CustomRuntimeManager) detectKnownRuntimes(projectPath string) *CustomRuntime {
	// Detect Elixir/Phoenix
	if crm.fileExists(filepath.Join(projectPath, "mix.exs")) {
		return &CustomRuntime{
			Name:    "elixir",
			Version: "1.15",
			Type:    "dockerfile",
			Dockerfile: &CustomDockerfileConfig{
				BaseImage: "elixir:1.15-alpine",
				BuildArgs: map[string]string{
					"MIX_ENV": "prod",
				},
				StartCmd: "mix phx.server",
			},
		}
	}

	// Detect Dart
	if crm.fileExists(filepath.Join(projectPath, "pubspec.yaml")) {
		return &CustomRuntime{
			Name:    "dart",
			Version: "3.0",
			Type:    "dockerfile",
			Dockerfile: &CustomDockerfileConfig{
				BaseImage: "dart:3.0-sdk",
				BuildArgs: map[string]string{
					"BUILD_ENV": "production",
				},
				StartCmd: "dart run bin/server.dart",
			},
		}
	}

	// Detect Swift
	if crm.fileExists(filepath.Join(projectPath, "Package.swift")) {
		return &CustomRuntime{
			Name:    "swift",
			Version: "5.9",
			Type:    "dockerfile",
			Dockerfile: &CustomDockerfileConfig{
				BaseImage: "swift:5.9",
				BuildArgs: map[string]string{
					"BUILD_CONFIGURATION": "release",
				},
				StartCmd: ".build/release/MyApp",
			},
		}
	}

	// Detect Kotlin
	if crm.fileExists(filepath.Join(projectPath, "build.gradle.kts")) || crm.fileExists(filepath.Join(projectPath, "build.gradle")) {
		return &CustomRuntime{
			Name:    "kotlin",
			Version: "1.9",
			Type:    "dockerfile",
			Dockerfile: &CustomDockerfileConfig{
				BaseImage: "openjdk:17-jdk-slim",
				BuildArgs: map[string]string{
					"KOTLIN_VERSION": "1.9.0",
				},
				StartCmd: "java -jar app.jar",
			},
		}
	}

	return nil
}

// BuildWithCustomRuntime builds a project using custom runtime
func (crm *CustomRuntimeManager) BuildWithCustomRuntime(ctx context.Context, runtime *CustomRuntime, projectPath string, imageName string) error {
	switch runtime.Type {
	case "buildpack":
		return crm.buildWithBuildpack(ctx, runtime, projectPath, imageName)
	case "dockerfile":
		return crm.buildWithDockerfile(ctx, runtime, projectPath, imageName)
	case "native":
		return crm.buildWithNative(ctx, runtime, projectPath, imageName)
	default:
		return fmt.Errorf("unsupported runtime type: %s", runtime.Type)
	}
}

// buildWithBuildpack builds using buildpacks
func (crm *CustomRuntimeManager) buildWithBuildpack(ctx context.Context, runtime *CustomRuntime, projectPath string, imageName string) error {
	// This would integrate with buildpack tools like pack or cnb
	// For now, generate a Dockerfile based on buildpack configuration

	dockerfile := crm.generateBuildpackDockerfile(runtime)
	dockerfilePath := filepath.Join(crm.workDir, "Dockerfile.buildpack")

	if err := os.WriteFile(dockerfilePath, []byte(dockerfile), 0644); err != nil {
		return fmt.Errorf("failed to write buildpack Dockerfile: %w", err)
	}

	// Build using the generated Dockerfile
	// This would use the docker client to build the image
	fmt.Printf("Building with buildpack runtime: %s\n", runtime.Name)
	return nil
}

// buildWithDockerfile builds using custom Dockerfile template
func (crm *CustomRuntimeManager) buildWithDockerfile(ctx context.Context, runtime *CustomRuntime, projectPath string, imageName string) error {
	dockerfile := crm.generateCustomDockerfile(runtime)
	dockerfilePath := filepath.Join(crm.workDir, "Dockerfile.custom")

	if err := os.WriteFile(dockerfilePath, []byte(dockerfile), 0644); err != nil {
		return fmt.Errorf("failed to write custom Dockerfile: %w", err)
	}

	// Build using the generated Dockerfile
	fmt.Printf("Building with custom Dockerfile runtime: %s\n", runtime.Name)
	return nil
}

// buildWithNative builds using native compilation
func (crm *CustomRuntimeManager) buildWithNative(ctx context.Context, runtime *CustomRuntime, projectPath string, imageName string) error {
	// Generate a Dockerfile for native compilation
	dockerfile := crm.generateNativeDockerfile(runtime)
	dockerfilePath := filepath.Join(crm.workDir, "Dockerfile.native")

	if err := os.WriteFile(dockerfilePath, []byte(dockerfile), 0644); err != nil {
		return fmt.Errorf("failed to write native Dockerfile: %w", err)
	}

	// Build using the generated Dockerfile
	fmt.Printf("Building with native runtime: %s\n", runtime.Name)
	return nil
}

// generateBuildpackDockerfile generates a Dockerfile for buildpack-based builds
func (crm *CustomRuntimeManager) generateBuildpackDockerfile(runtime *CustomRuntime) string {
	var builder strings.Builder

	builder.WriteString(fmt.Sprintf("# Buildpack-based runtime: %s\n", runtime.Name))
	builder.WriteString(fmt.Sprintf("FROM %s as builder\n", runtime.Dockerfile.BaseImage))
	builder.WriteString("WORKDIR /app\n")
	builder.WriteString("COPY . .\n")

	// Add buildpack-specific instructions
	if runtime.Buildpack != nil {
		for _, buildpack := range runtime.Buildpack.Buildpacks {
			builder.WriteString(fmt.Sprintf("RUN echo 'Installing buildpack: %s'\n", buildpack))
		}
	}

	// Environment variables
	if len(runtime.Environment) > 0 {
		builder.WriteString("\n# Environment variables\n")
		for k, v := range runtime.Environment {
			builder.WriteString(fmt.Sprintf("ENV %s=%s\n", k, v))
		}
	}

	builder.WriteString("\n# Production stage\n")
	builder.WriteString("FROM scratch\n")
	builder.WriteString("COPY --from=builder /app /app\n")
	builder.WriteString("WORKDIR /app\n")

	if runtime.Native != nil && runtime.Native.StartCmd != "" {
		builder.WriteString(fmt.Sprintf("CMD [\"%s\"]\n", runtime.Native.StartCmd))
	}

	return builder.String()
}

// generateCustomDockerfile generates a custom Dockerfile from template
func (crm *CustomRuntimeManager) generateCustomDockerfile(runtime *CustomRuntime) string {
	var builder strings.Builder

	builder.WriteString(fmt.Sprintf("# Custom runtime: %s\n", runtime.Name))
	builder.WriteString(fmt.Sprintf("FROM %s\n", runtime.Dockerfile.BaseImage))
	builder.WriteString("WORKDIR /app\n")

	// Environment variables
	if len(runtime.Environment) > 0 {
		builder.WriteString("\n# Environment variables\n")
		for k, v := range runtime.Environment {
			builder.WriteString(fmt.Sprintf("ENV %s=%s\n", k, v))
		}
	}

	// Build arguments
	if len(runtime.Dockerfile.BuildArgs) > 0 {
		builder.WriteString("\n# Build arguments\n")
		for k, v := range runtime.Dockerfile.BuildArgs {
			builder.WriteString(fmt.Sprintf("ARG %s=%s\n", k, v))
		}
	}

	// Labels
	if len(runtime.Dockerfile.Labels) > 0 {
		builder.WriteString("\n# Labels\n")
		for k, v := range runtime.Dockerfile.Labels {
			builder.WriteString(fmt.Sprintf("LABEL %s=%s\n", k, v))
		}
	}

	builder.WriteString("\n# Copy source code\n")
	builder.WriteString("COPY . .\n")

	// Health check
	if runtime.Dockerfile.HealthCheck != nil {
		builder.WriteString("\n# Health check\n")
		healthCheck := runtime.Dockerfile.HealthCheck
		builder.WriteString(fmt.Sprintf("HEALTHCHECK --interval=%s --timeout=%s --retries=%d --start-period=%s \\\n",
			healthCheck.Interval, healthCheck.Timeout, healthCheck.Retries, healthCheck.StartPeriod))
		builder.WriteString("    CMD ")
		for i, test := range healthCheck.Test {
			if i > 0 {
				builder.WriteString(" ")
			}
			builder.WriteString(fmt.Sprintf("\"%s\"", test))
		}
		builder.WriteString("\n")
	}

	// Default command
	if runtime.Native != nil && runtime.Native.StartCmd != "" {
		builder.WriteString(fmt.Sprintf("\nCMD [\"%s\"]\n", runtime.Native.StartCmd))
	}

	return builder.String()
}

// generateNativeDockerfile generates a Dockerfile for native compilation
func (crm *CustomRuntimeManager) generateNativeDockerfile(runtime *CustomRuntime) string {
	var builder strings.Builder

	builder.WriteString(fmt.Sprintf("# Native runtime: %s\n", runtime.Name))
	builder.WriteString(fmt.Sprintf("FROM %s as builder\n", runtime.Dockerfile.BaseImage))
	builder.WriteString("WORKDIR /app\n")

	// Install compiler and dependencies
	if runtime.Native != nil {
		builder.WriteString(fmt.Sprintf("RUN echo 'Installing %s compiler'\n", runtime.Native.Compiler))

		for _, dep := range runtime.Dependencies {
			builder.WriteString(fmt.Sprintf("RUN echo 'Installing dependency: %s'\n", dep))
		}
	}

	builder.WriteString("\n# Copy source code\n")
	builder.WriteString("COPY . .\n")

	// Build command
	if runtime.Native != nil && runtime.Native.BuildCmd != "" {
		builder.WriteString(fmt.Sprintf("\nRUN %s\n", runtime.Native.BuildCmd))
	}

	builder.WriteString("\n# Production stage\n")
	builder.WriteString("FROM alpine:latest\n")
	builder.WriteString("WORKDIR /app\n")

	// Copy compiled binary
	if runtime.Native != nil {
		builder.WriteString("COPY --from=builder /app/app .\n")
	}

	// Start command
	if runtime.Native != nil && runtime.Native.StartCmd != "" {
		builder.WriteString(fmt.Sprintf("CMD [\"%s\"]\n", runtime.Native.StartCmd))
	}

	return builder.String()
}

// fileExists checks if a file exists
func (crm *CustomRuntimeManager) fileExists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}

// GetInstalledRuntimes returns all installed custom runtimes
func (crm *CustomRuntimeManager) GetInstalledRuntimes() map[string]*CustomRuntime {
	return crm.runtimes
}

// InstallRuntime installs a custom runtime from a URL or local path
func (crm *CustomRuntimeManager) InstallRuntime(ctx context.Context, source string) error {
	// This would download and install a runtime from a URL
	// For now, just load from local path
	runtime, err := crm.LoadCustomRuntime(ctx, source)
	if err != nil {
		return fmt.Errorf("failed to install runtime: %w", err)
	}

	fmt.Printf("Installed custom runtime: %s %s\n", runtime.Name, runtime.Version)
	return nil
}

// OptimizeDependencies optimizes and caches dependencies for faster builds
func (crm *CustomRuntimeManager) OptimizeDependencies(ctx context.Context, runtime *CustomRuntime, projectPath string) error {
	switch runtime.Type {
	case "buildpack":
		return crm.optimizeBuildpackDeps(ctx, runtime, projectPath)
	case "dockerfile":
		return crm.optimizeDockerfileDeps(ctx, runtime, projectPath)
	case "native":
		return crm.optimizeNativeDeps(ctx, runtime, projectPath)
	default:
		return fmt.Errorf("unsupported runtime type: %s", runtime.Type)
	}
}

// optimizeBuildpackDeps optimizes buildpack dependencies
func (crm *CustomRuntimeManager) optimizeBuildpackDeps(ctx context.Context, runtime *CustomRuntime, projectPath string) error {
	// Create dependency cache layers
	fmt.Printf("Optimizing buildpack dependencies for %s\n", runtime.Name)

	// This would create cached layers for common dependencies
	// Implementation depends on the specific buildpack system being used

	return nil
}

// optimizeDockerfileDeps optimizes Dockerfile dependencies
func (crm *CustomRuntimeManager) optimizeDockerfileDeps(ctx context.Context, runtime *CustomRuntime, projectPath string) error {
	// Create optimized Dockerfile with dependency caching
	fmt.Printf("Optimizing Dockerfile dependencies for %s\n", runtime.Name)

	// This would reorganize the Dockerfile to optimize layer caching
	// Common pattern: copy dependency files first, install deps, then copy source

	return nil
}

// optimizeNativeDeps optimizes native compilation dependencies
func (crm *CustomRuntimeManager) optimizeNativeDeps(ctx context.Context, runtime *CustomRuntime, projectPath string) error {
	// Create dependency cache for native builds
	fmt.Printf("Optimizing native dependencies for %s\n", runtime.Name)

	// This would cache compiled dependencies and object files

	return nil
}
