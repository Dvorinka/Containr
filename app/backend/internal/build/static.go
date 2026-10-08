package build

import (
	"context"
	"fmt"

	"containr/internal/docker"
	"containr/internal/types"
)

// StaticBuilder produces an nginx-served image from a repo's built assets.
// STATIC_BUILD_CMD runs inside a node build stage; STATIC_DIR names the
// output directory copied into the nginx image. Both are overridable via
// build args so repos with non-node toolchains can swap the build image too.
type StaticBuilder struct {
	dockerClient *docker.Client
}

func NewStaticBuilder(dockerClient *docker.Client) *StaticBuilder {
	return &StaticBuilder{dockerClient: dockerClient}
}

const staticDockerfile = `ARG BUILD_IMAGE=node:20-alpine
FROM ${BUILD_IMAGE} AS assets
WORKDIR /app
COPY . .
ARG STATIC_BUILD_CMD
RUN sh -c "${STATIC_BUILD_CMD}"

FROM nginx:alpine
ARG STATIC_DIR=dist
COPY --from=assets /app/${STATIC_DIR} /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
`

func (s *StaticBuilder) Build(ctx context.Context, req *types.BuildRequest) (*types.BuildResponse, error) {
	buildCmd := req.BuildCommand
	if buildCmd == "" {
		buildCmd = "npm ci && npm run build"
	}
	staticDir := req.BuildArgs["STATIC_DIR"]
	if staticDir == "" {
		staticDir = "dist"
	}

	buildArgs := map[string]*string{}
	for k, v := range req.BuildArgs {
		v := v
		buildArgs[k] = &v
	}
	for k, v := range req.Environment {
		v := v
		buildArgs[k] = &v
	}
	buildArgs["STATIC_BUILD_CMD"] = &buildCmd
	buildArgs["STATIC_DIR"] = &staticDir

	imageName := fmt.Sprintf("%s:%s", req.ImageName, req.ImageTag)
	buildCtx, err := createBuildContext(req.SourcePath, staticDockerfile)
	if err != nil {
		return nil, fmt.Errorf("failed to create build context: %w", err)
	}
	defer buildCtx.Close()

	if _, err := s.dockerClient.BuildImage(ctx, buildCtx, docker.BuildOptions{
		Dockerfile: "Dockerfile",
		Tags:       []string{imageName},
		BuildArgs:  buildArgs,
		NoCache:    req.NoCache,
		Remove:     true,
	}); err != nil {
		return nil, fmt.Errorf("failed to build static image: %w", err)
	}

	if req.RegistryURL != "" {
		full := fmt.Sprintf("%s/%s", req.RegistryURL, imageName)
		if err := s.dockerClient.PushImage(ctx, imageName, req.RegistryURL); err != nil {
			return nil, fmt.Errorf("failed to push image: %w", err)
		}
		imageName = full
	}

	imageInfo, err := s.dockerClient.GetImageInfo(ctx, imageName)
	if err != nil {
		imageInfo = &docker.ImageInfo{Size: 0}
	}

	return &types.BuildResponse{
		ImageName: imageName,
		ImageTag:  req.ImageTag,
		Size:      imageInfo.Size,
		Digest:    imageInfo.Digest,
	}, nil
}
