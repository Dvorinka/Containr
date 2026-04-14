# Railpack Integration

This directory contains the build system for Containr, with Railpack as the primary build method.

## Build Types

### Railpack (Primary)
- **Detection**: Automatically detects supported frameworks (Node.js, Python, Go, Rust, Java, Ruby, PHP, Static)
- **API**: Uses https://api.railpack.app/v1/ for Dockerfile generation
- **Fallback**: Falls back to Nixpacks if Railpack cannot build the project

### Nixpacks (Secondary)
- **Detection**: Used as fallback when Railpack detection fails
- **Local**: Runs locally without external API calls

### Dockerfile
- **Detection**: Checks for existing Dockerfile in repository
- **Priority**: Highest priority if Dockerfile exists

### Prebuilt
- **Usage**: For pre-built container images
- **Configuration**: Specified in service configuration

## Supported Frameworks

Railpack supports the following frameworks:
- **Node.js** - package.json detection
- **Python** - requirements.txt detection  
- **Go** - go.mod detection
- **Rust** - Cargo.toml detection
- **Java** - pom.xml or build.gradle detection
- **Ruby** - Gemfile detection
- **PHP** - composer.json detection
- **Static** - Static site detection

## Usage

```go
// Create build manager
buildManager := build.NewBuildManager("/tmp/builds", dockerClient)

// Build a project
response, err := buildManager.Build(ctx, &types.BuildRequest{
    SourcePath: "/path/to/project",
    ImageName:  "my-app",
    ImageTag:   "latest",
})
```

## API Endpoints

- **Generate Dockerfile**: POST https://api.railpack.app/v1/generate
- **Build Plan**: POST https://api.railpack.app/v1/plan

## Configuration

Railpack can be configured with:
- Custom build commands
- Custom start commands  
- Environment variables
- Build root directory

## References

- https://railpack.com/
- https://railpack.com/getting-started
- https://github.com/railwayapp/railpack
