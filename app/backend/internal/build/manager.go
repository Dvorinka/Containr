package build

import (
	"context"
	"fmt"
	"path/filepath"
	"time"

	"containr/internal/docker"
	"containr/internal/types"

	"github.com/docker/docker/api/types/registry"
)

type BuildManager struct {
	railpackBuilder   *RailpackBuilder
	nixpacksBuilder   *NixpacksBuilder
	dockerfileBuilder *DockerfileBuilder
	dockerClient      *docker.Client
	cacheManager      *CacheManager
	parallelBuilder   *ParallelBuilder
	workDir           string
}

type BuildType string

const (
	BuildTypeRailpack   BuildType = "railpack"
	BuildTypeNixpacks   BuildType = "nixpacks"
	BuildTypeDockerfile BuildType = "dockerfile"
	BuildTypePrebuilt   BuildType = "prebuilt"
)

func NewBuildManager(workDir string, dockerClient *docker.Client) *BuildManager {
	cacheManager := NewCacheManager(filepath.Join(workDir, "cache"), dockerClient)
	parallelBuilder := NewParallelBuilder(nil, cacheManager, 4) // Default 4 workers

	return &BuildManager{
		railpackBuilder:   NewRailpackBuilder(workDir, dockerClient),
		nixpacksBuilder:   NewNixpacksBuilder(workDir, dockerClient),
		dockerfileBuilder: NewDockerfileBuilder(workDir, dockerClient),
		dockerClient:      dockerClient,
		cacheManager:      cacheManager,
		parallelBuilder:   parallelBuilder,
		workDir:           workDir,
	}
}

// DetectBuildType automatically detects the build type based on repository contents
func (bm *BuildManager) DetectBuildType(ctx context.Context, repoPath string) (BuildType, error) {
	// Check for Dockerfile first
	if _, err := bm.dockerfileBuilder.DetectDockerfile(ctx, repoPath); err == nil {
		return BuildTypeDockerfile, nil
	}

	// Check if Railpack can build this project (primary choice)
	if err := bm.railpackBuilder.DetectRailpack(ctx, repoPath); err == nil {
		return BuildTypeRailpack, nil
	}

	// Default to Nixpacks as fallback
	return BuildTypeNixpacks, nil
}

// Build executes the build process using the appropriate builder
func (bm *BuildManager) Build(ctx context.Context, req *types.BuildRequest) (*types.BuildResponse, error) {
	// Detect build type if not specified
	if req.BuildType == "" {
		detectedType, err := bm.DetectBuildType(ctx, req.SourcePath)
		if err != nil {
			return nil, fmt.Errorf("failed to detect build type: %w", err)
		}
		req.BuildType = string(detectedType)
	}

	switch BuildType(req.BuildType) {
	case BuildTypeRailpack:
		return bm.railpackBuilder.Build(ctx, req)
	case BuildTypeNixpacks:
		return bm.nixpacksBuilder.Build(ctx, req)
	case BuildTypeDockerfile:
		return bm.dockerfileBuilder.Build(ctx, req)
	case BuildTypePrebuilt:
		return bm.buildPrebuilt(ctx, req)
	default:
		return nil, fmt.Errorf("unsupported build type: %s", req.BuildType)
	}
}

// buildPrebuilt handles prebuilt image deployments
func (bm *BuildManager) buildPrebuilt(ctx context.Context, req *types.BuildRequest) (*types.BuildResponse, error) {
	if req.PrebuiltImage == "" {
		return nil, fmt.Errorf("prebuilt image not specified")
	}

	// Pull the prebuilt image
	auth := registry.AuthConfig{}
	_, err := bm.dockerClient.PullImage(ctx, req.PrebuiltImage, auth)
	if err != nil {
		return nil, fmt.Errorf("failed to pull prebuilt image: %w", err)
	}

	// Tag with our desired name and tag if different
	if req.ImageName != "" && req.ImageTag != "" {
		targetImage := fmt.Sprintf("%s:%s", req.ImageName, req.ImageTag)
		if targetImage != req.PrebuiltImage {
			err = bm.dockerClient.TagImage(ctx, req.PrebuiltImage, targetImage)
			if err != nil {
				return nil, fmt.Errorf("failed to tag image: %w", err)
			}
			req.PrebuiltImage = targetImage
		}
	}

	// Push to registry if specified
	if req.RegistryURL != "" {
		err = bm.dockerClient.PushImage(ctx, req.PrebuiltImage, req.RegistryURL)
		if err != nil {
			return nil, fmt.Errorf("failed to push image: %w", err)
		}
		req.PrebuiltImage = fmt.Sprintf("%s/%s", req.RegistryURL, req.PrebuiltImage)
	}

	// Get image info
	imageInfo, err := bm.dockerClient.GetImageInfo(ctx, req.PrebuiltImage)
	if err != nil {
		// Continue even if we can't get image info
		imageInfo = &docker.ImageInfo{Size: 0}
	}

	return &types.BuildResponse{
		ImageName: req.PrebuiltImage,
		ImageTag:  req.ImageTag,
		Size:      imageInfo.Size,
		Digest:    imageInfo.Digest,
	}, nil
}

// ValidateBuildRequest validates the build request parameters
func (bm *BuildManager) ValidateBuildRequest(ctx context.Context, req *types.BuildRequest) error {
	if req.SourcePath == "" && req.PrebuiltImage == "" {
		return fmt.Errorf("either source path or prebuilt image must be specified")
	}

	if req.ImageName == "" {
		return fmt.Errorf("image name is required")
	}

	if req.ImageTag == "" {
		return fmt.Errorf("image tag is required")
	}

	// Validate source path exists if specified
	if req.SourcePath != "" {
		if _, err := filepath.Abs(req.SourcePath); err != nil {
			return fmt.Errorf("invalid source path: %w", err)
		}
	}

	return nil
}

// GetBuildPlan returns the build plan for inspection without building
func (bm *BuildManager) GetBuildPlan(ctx context.Context, req *types.BuildRequest) (interface{}, error) {
	switch BuildType(req.BuildType) {
	case BuildTypeRailpack:
		config := &RailpackConfig{
			BuildCmd: req.BuildCommand,
			StartCmd: req.StartCommand,
			Env:      req.Environment,
		}
		return bm.railpackBuilder.GeneratePlan(ctx, req.SourcePath, config)
	case BuildTypeNixpacks:
		config := &NixpacksConfig{
			BuildCmd: req.BuildCommand,
			StartCmd: req.StartCommand,
			Env:      req.Environment,
		}
		return bm.nixpacksBuilder.GeneratePlan(ctx, req.SourcePath, config)
	case BuildTypeDockerfile:
		dockerfile, err := bm.dockerfileBuilder.DetectDockerfile(ctx, req.SourcePath)
		if err != nil {
			return nil, err
		}
		return map[string]string{
			"dockerfile": dockerfile,
			"context":    req.SourcePath,
		}, nil
	case BuildTypePrebuilt:
		return map[string]string{
			"image": req.PrebuiltImage,
		}, nil
	default:
		return nil, fmt.Errorf("unsupported build type: %s", req.BuildType)
	}
}

// BuildWithCache attempts to build using cache first
func (bm *BuildManager) BuildWithCache(ctx context.Context, req *types.BuildRequest) (*types.BuildResponse, error) {
	bm.parallelBuilder.buildManager = bm
	result, err := bm.parallelBuilder.BuildWithCache(ctx, req)
	if err != nil {
		return nil, err
	}
	return result.Response, nil
}

// BuildParallel executes multiple builds in parallel
func (bm *BuildManager) BuildParallel(ctx context.Context, requests []*types.BuildRequest) ([]*types.BuildResponse, error) {
	bm.parallelBuilder.buildManager = bm
	results, err := bm.parallelBuilder.BuildParallel(ctx, requests)
	if err != nil {
		return nil, err
	}

	responses := make([]*types.BuildResponse, len(results))
	for i, result := range results {
		if result.Success {
			responses[i] = result.Response
		} else {
			return nil, result.Error
		}
	}
	return responses, nil
}

// SetRemoteCache configures remote cache settings
func (bm *BuildManager) SetRemoteCache(config *RemoteCacheConfig) {
	bm.cacheManager.SetRemoteCache(config)
}

// GetCacheStats returns cache statistics
func (bm *BuildManager) GetCacheStats(ctx context.Context) (map[string]interface{}, error) {
	return bm.cacheManager.GetCacheStats(ctx)
}

// CleanupCache removes old cache entries
func (bm *BuildManager) CleanupCache(ctx context.Context, maxAge time.Duration) error {
	return bm.cacheManager.CleanupCache(ctx, maxAge)
}
