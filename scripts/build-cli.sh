#!/bin/bash

# Build CLI script for Containr
set -e

echo "🔨 Building Containr CLI..."

# Get version from git tag or use default
VERSION=${VERSION:-$(git describe --tags --always --dirty 2>/dev/null || echo "dev")}
BUILD_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")

# Build flags
LDFLAGS="-X main.Version=${VERSION} -X main.BuildTime=${BUILD_TIME} -X main.GitCommit=${COMMIT}"

# Build for multiple platforms
PLATFORMS="linux/amd64 linux/arm64 darwin/amd64 darwin/arm64 windows/amd64"

for platform in $PLATFORMS; do
    GOOS=${platform%/*}
    GOARCH=${platform#*/}
    
    OUTPUT_NAME="containr-${GOOS}-${GOARCH}"
    if [ "$GOOS" = "windows" ]; then
        OUTPUT_NAME="${OUTPUT_NAME}.exe"
    fi
    
    echo "📦 Building for ${platform}..."
    
    GOOS=$GOOS GOARCH=$GOARCH go build \
        -ldflags "$LDFLAGS" \
        -o "bin/${OUTPUT_NAME}" \
        ./cmd/cli
    
    echo "✅ Built bin/${OUTPUT_NAME}"
done

echo "🎉 CLI build complete!"
echo ""
echo "Available binaries:"
ls -la bin/containr-*

# Create a symlink for the current platform
CURRENT_OS=$(uname -s | tr '[:upper:]' '[:lower:]')
CURRENT_ARCH=$(uname -m | sed 's/x86_64/amd64/' | sed 's/arm64/arm64/')

if [ -f "bin/containr-${CURRENT_OS}-${CURRENT_ARCH}" ]; then
    ln -sf "containr-${CURRENT_OS}-${CURRENT_ARCH}" bin/containr
    echo "🔗 Created symlink: bin/containr -> containr-${CURRENT_OS}-${CURRENT_ARCH}"
fi

echo ""
echo "To install CLI:"
echo "  sudo cp bin/containr /usr/local/bin/"
echo "  # or"
echo "  export PATH=\$PWD/bin:\$PATH"
