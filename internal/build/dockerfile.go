package build

import (
	"archive/tar"
	"bytes"
	"context"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"

	"containr/internal/docker"
	"containr/internal/types"
)

type DockerfileBuilder struct {
	workDir      string
	dockerClient *docker.Client
}

type DockerfileConfig struct {
	DockerfilePath string            `json:"dockerfile_path"`
	ContextPath    string            `json:"context_path"`
	BuildArgs      map[string]string `json:"build_args"`
	Target         string            `json:"target,omitempty"`
	Labels         map[string]string `json:"labels,omitempty"`
}

func NewDockerfileBuilder(workDir string, dockerClient *docker.Client) *DockerfileBuilder {
	return &DockerfileBuilder{
		workDir:      workDir,
		dockerClient: dockerClient,
	}
}

// DetectDockerfile checks if a Dockerfile exists in the repository
func (d *DockerfileBuilder) DetectDockerfile(ctx context.Context, repoPath string) (string, error) {
	dockerfiles := []string{
		"Dockerfile",
		"Dockerfile.prod",
		"Dockerfile.production",
		"Dockerfile.build",
		"dockerfile",
		"dockerfile.prod",
	}

	for _, dockerfile := range dockerfiles {
		fullPath := filepath.Join(repoPath, dockerfile)
		if _, err := os.Stat(fullPath); err == nil {
			return dockerfile, nil
		}
	}

	return "", fmt.Errorf("no Dockerfile found")
}

// ValidateDockerfile validates the Dockerfile syntax and structure
func (d *DockerfileBuilder) ValidateDockerfile(ctx context.Context, dockerfilePath string) error {
	// Check if file exists
	if _, err := os.Stat(dockerfilePath); os.IsNotExist(err) {
		return fmt.Errorf("Dockerfile does not exist: %s", dockerfilePath)
	}

	// Read and validate basic structure
	content, err := os.ReadFile(dockerfilePath)
	if err != nil {
		return fmt.Errorf("failed to read Dockerfile: %w", err)
	}

	dockerfileContent := string(content)
	lines := strings.Split(dockerfileContent, "\n")

	hasFrom := false
	hasExposeOrCmd := false

	for _, line := range lines {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, "FROM") {
			hasFrom = true
		}
		if strings.HasPrefix(line, "EXPOSE") || strings.HasPrefix(line, "CMD") || strings.HasPrefix(line, "ENTRYPOINT") {
			hasExposeOrCmd = true
		}
	}

	if !hasFrom {
		return fmt.Errorf("Dockerfile must have a FROM instruction")
	}

	if !hasExposeOrCmd {
		return fmt.Errorf("Dockerfile should have EXPOSE, CMD, or ENTRYPOINT instruction")
	}

	return nil
}

// OptimizeDockerfile applies common optimizations to the Dockerfile
func (d *DockerfileBuilder) OptimizeDockerfile(ctx context.Context, dockerfilePath string) (string, error) {
	content, err := os.ReadFile(dockerfilePath)
	if err != nil {
		return "", fmt.Errorf("failed to read Dockerfile: %w", err)
	}

	optimized := d.optimizeDockerfileContent(string(content))

	optimizedPath := filepath.Join(d.workDir, "Dockerfile.optimized")
	err = os.WriteFile(optimizedPath, []byte(optimized), 0644)
	if err != nil {
		return "", fmt.Errorf("failed to write optimized Dockerfile: %w", err)
	}

	return optimizedPath, nil
}

func (d *DockerfileBuilder) optimizeDockerfileContent(content string) string {
	lines := strings.Split(content, "\n")
	var optimized []string

	// Track if we've already added common optimizations
	hasMultiStage := false
	hasSecurityOptimizations := false

	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		
		// Skip empty lines and comments
		if trimmed == "" || strings.HasPrefix(trimmed, "#") {
			optimized = append(optimized, line)
			continue
		}

		// Check for multi-stage builds
		if strings.HasPrefix(trimmed, "FROM") && strings.Contains(trimmed, " AS ") {
			hasMultiStage = true
		}

		// Check for build cache optimizations
		if strings.Contains(trimmed, "RUN") && strings.Contains(trimmed, "npm") {
			hasMultiStage = true
		}

		optimized = append(optimized, line)
	}

	// Add optimizations if not present
	if !hasMultiStage {
		// Insert multi-stage build suggestion at the beginning
		optimized = append([]string{
			"# Multi-stage build for smaller production image",
			"FROM node:20-alpine AS builder",
			"WORKDIR /app",
			"COPY package*.json ./",
			"RUN npm ci --only=production",
			"COPY . .",
			"RUN npm run build",
			"",
			"# Production stage",
			"FROM node:20-alpine AS production",
			"WORKDIR /app",
			"COPY --from=builder /app/dist ./dist",
			"COPY --from=builder /app/node_modules ./node_modules",
			"EXPOSE 8080",
			"CMD [\"npm\", \"start\"]",
		}, optimized...)
	}

	if !hasSecurityOptimizations {
		optimized = append(optimized, "", "# Security optimizations")
		optimized = append(optimized, "RUN addgroup -g 1001 -S nodejs")
		optimized = append(optimized, "RUN adduser -S nodejs -u 1001")
		optimized = append(optimized, "USER nodejs")
	}

	return strings.Join(optimized, "\n")
}

// Build builds the container image using Dockerfile
func (d *DockerfileBuilder) Build(ctx context.Context, req *types.BuildRequest) (*types.BuildResponse, error) {
	// Detect Dockerfile
	dockerfileName, err := d.DetectDockerfile(ctx, req.SourcePath)
	if err != nil {
		return nil, fmt.Errorf("failed to detect Dockerfile: %w", err)
	}

	dockerfilePath := filepath.Join(req.SourcePath, dockerfileName)

	// Validate Dockerfile
	err = d.ValidateDockerfile(ctx, dockerfilePath)
	if err != nil {
		return nil, fmt.Errorf("invalid Dockerfile: %w", err)
	}

	// Optimize Dockerfile (optional)
	optimizedDockerfile, err := d.OptimizeDockerfile(ctx, dockerfilePath)
	if err != nil {
		// If optimization fails, use original
		optimizedDockerfile = dockerfilePath
	}

	// Prepare build args
	buildArgs := make(map[string]*string)
	for k, v := range req.Environment {
		buildArgs[k] = &v
	}

	// Add default build args
	buildArgs["BUILDKIT_INLINE_CACHE"] = strPtr("1")
	buildArgs["TARGETPLATFORM"] = strPtr("linux/amd64")

	// Build Docker image
	imageName := fmt.Sprintf("%s:%s", req.ImageName, req.ImageTag)
	
	// Create build context tar
	buildCtx, err := createBuildContext(req.SourcePath, optimizedDockerfile)
	if err != nil {
		return nil, fmt.Errorf("failed to create build context: %w", err)
	}
	defer buildCtx.Close()
	
	buildOptions := docker.BuildOptions{
		Dockerfile: "Dockerfile",
		Tags:       []string{imageName},
		BuildArgs:  buildArgs,
		Remove:     true,
	}
	
	_, err = d.dockerClient.BuildImage(ctx, buildCtx, buildOptions)
	if err != nil {
		return nil, fmt.Errorf("failed to build Docker image: %w", err)
	}

	// Get image info
	imageInfo, err := d.dockerClient.GetImageInfo(ctx, imageName)
	if err != nil {
		// Continue even if we can't get image info
		imageInfo = &docker.ImageInfo{Size: 0}
	}

	// Push to registry if specified
	if req.RegistryURL != "" {
		fullImageName := fmt.Sprintf("%s/%s:%s", req.RegistryURL, req.ImageName, req.ImageTag)
		err = d.dockerClient.PushImage(ctx, imageName, req.RegistryURL)
		if err != nil {
			return nil, fmt.Errorf("failed to push image: %w", err)
		}
		imageName = fullImageName
	}

	return &types.BuildResponse{
		ImageName: imageName,
		ImageTag:  req.ImageTag,
		Size:      imageInfo.Size,
		Digest:    imageInfo.Digest,
	}, nil
}

// GenerateDockerfile generates a basic Dockerfile for common runtimes
func (d *DockerfileBuilder) GenerateDockerfile(ctx context.Context, runtime, appPath string) (string, error) {
	switch runtime {
	case "go":
		return d.generateGoDockerfile(appPath), nil
	case "node":
		return d.generateNodeDockerfile(appPath), nil
	case "python":
		return d.generatePythonDockerfile(appPath), nil
	case "rust":
		return d.generateRustDockerfile(appPath), nil
	case "static":
		return d.generateStaticDockerfile(appPath), nil
	default:
		return d.generateGenericDockerfile(appPath), nil
	}
}

func (d *DockerfileBuilder) generateGoDockerfile(appPath string) string {
	return `# Go Dockerfile
FROM golang:1.21-alpine AS builder

WORKDIR /app

# Install git (required for some go modules)
RUN apk add --no-cache git

# Copy go mod files
COPY go.mod go.sum ./

# Download dependencies
RUN go mod download

# Copy source code
COPY . .

# Build the application
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o main .

# Production stage
FROM alpine:latest

RUN apk --no-cache add ca-certificates

WORKDIR /root/

# Copy the binary from builder stage
COPY --from=builder /app/main .

# Expose port
EXPOSE 8080

# Run the binary
CMD ["./main"]
`
}

func (d *DockerfileBuilder) generateNodeDockerfile(appPath string) string {
	return `# Node.js Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Build the application (if needed)
RUN npm run build || true

# Production stage
FROM node:20-alpine

WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Copy built application and dependencies
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/package*.json ./

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 8080

# Start the application
CMD ["npm", "start"]
`
}

func (d *DockerfileBuilder) generatePythonDockerfile(appPath string) string {
	return `# Python Dockerfile
FROM python:3.11-slim AS builder

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Production stage
FROM python:3.11-slim

WORKDIR /app

# Create non-root user
RUN useradd --create-home --shell /bin/bash app

# Copy installed packages
COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

# Copy application code
COPY --chown=app:app . .

# Switch to non-root user
USER app

# Expose port
EXPOSE 8080

# Start the application
CMD ["python", "app.py"]
`
}

func (d *DockerfileBuilder) generateRustDockerfile(appPath string) string {
	return `# Rust Dockerfile
FROM rust:1.75-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache musl-dev

# Copy Cargo files
COPY Cargo.toml Cargo.lock ./

# Create dummy main.rs to cache dependencies
RUN mkdir src && echo "fn main() {}" > src/main.rs
RUN cargo build --release
RUN rm -rf src

# Copy source code
COPY src ./src

# Build the application
RUN cargo build --release

# Production stage
FROM alpine:latest

WORKDIR /app

# Install runtime dependencies
RUN apk add --no-cache ca-certificates

# Copy the binary from builder stage
COPY --from=builder /app/target/release/app .

# Create non-root user
RUN addgroup -g 1001 -S appgroup
RUN adduser -S appuser -u 1001 -G appgroup

# Change ownership and switch to non-root user
RUN chown appuser:appgroup /app/app
USER appuser

# Expose port
EXPOSE 8080

# Run the binary
CMD ["./app"]
`
}

func (d *DockerfileBuilder) generateStaticDockerfile(appPath string) string {
	return `# Static files Dockerfile
FROM nginx:alpine

# Copy static files
COPY . /usr/share/nginx/html

# Copy custom nginx config if exists
COPY nginx.conf /etc/nginx/nginx.conf || true

# Expose port
EXPOSE 8080

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
`
}

func (d *DockerfileBuilder) generateGenericDockerfile(appPath string) string {
	return `# Generic Dockerfile
FROM alpine:latest

WORKDIR /app

# Install basic runtime
RUN apk add --no-cache ca-certificates

# Copy application
COPY . .

# Create non-root user
RUN addgroup -g 1001 -S appgroup
RUN adduser -S appuser -u 1001 -G appgroup

# Change ownership
RUN chown -R appuser:appgroup /app
USER appuser

# Expose port
EXPOSE 8080

# Default command - override in your application
CMD ["./app"]
`
}

func strPtr(s string) *string {
	return &s
}

func createBuildContext(sourcePath, dockerfileContent string) (io.ReadCloser, error) {
	// Create a temporary directory for the build context
	tmpDir, err := os.MkdirTemp("", "docker-build-")
	if err != nil {
		return nil, err
	}
	defer os.RemoveAll(tmpDir)
	
	// Write Dockerfile to temp directory
	dockerfilePath := filepath.Join(tmpDir, "Dockerfile")
	if err := os.WriteFile(dockerfilePath, []byte(dockerfileContent), 0644); err != nil {
		return nil, err
	}
	
	// Create tar archive of the build context
	var buf bytes.Buffer
	tw := tar.NewWriter(&buf)
	defer tw.Close()
	
	// Add Dockerfile to tar
	dockerfileData, err := os.ReadFile(dockerfilePath)
	if err != nil {
		return nil, err
	}
	hdr := &tar.Header{
		Name: "Dockerfile",
		Mode: 0644,
		Size: int64(len(dockerfileData)),
	}
	if err := tw.WriteHeader(hdr); err != nil {
		return nil, err
	}
	if _, err := tw.Write(dockerfileData); err != nil {
		return nil, err
	}
	
	// Add source files to tar
	err = filepath.Walk(sourcePath, func(file string, fi os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if fi.IsDir() {
			return nil
		}
		
		relPath, err := filepath.Rel(sourcePath, file)
		if err != nil {
			return err
		}
		if relPath == "Dockerfile" {
			return nil
		}
		
		data, err := os.ReadFile(file)
		if err != nil {
			return err
		}
		
		hdr := &tar.Header{
			Name: relPath,
			Mode: int64(fi.Mode()),
			Size: int64(len(data)),
		}
		if err := tw.WriteHeader(hdr); err != nil {
			return err
		}
		if _, err := tw.Write(data); err != nil {
			return err
		}
		return nil
	})
	
	if err != nil {
		return nil, err
	}
	
	return io.NopCloser(&buf), nil
}
