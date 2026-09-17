package build

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"time"

	"containr/internal/docker"
	"containr/internal/types"

	"github.com/docker/docker/api/types/registry"
)

// CacheManager handles build caching operations
type CacheManager struct {
	cacheDir     string
	dockerClient *docker.Client
	remoteCache  *RemoteCacheConfig
}

// CacheEntry represents a cached layer entry
type CacheEntry struct {
	Key       string            `json:"key"`
	ImageName string            `json:"image_name"`
	Size      int64             `json:"size"`
	Created   time.Time         `json:"created"`
	Hash      string            `json:"hash"`
	Metadata  map[string]string `json:"metadata"`
}

// RemoteCacheConfig defines remote cache configuration
type RemoteCacheConfig struct {
	Enabled   bool   `json:"enabled"`
	Registry  string `json:"registry"`
	Namespace string `json:"namespace"`
	Username  string `json:"username"`
	Password  string `json:"password"`
	Insecure  bool   `json:"insecure"`
}

// CacheKey represents a build cache key
type CacheKey struct {
	Runtime   string            `json:"runtime"`
	Files     map[string]string `json:"files"`    // file path -> hash
	EnvVars   map[string]string `json:"env_vars"` // env var name -> hash
	BuildCmd  string            `json:"build_cmd"`
	Packages  []string          `json:"packages"`
	BuildArgs map[string]string `json:"build_args"`
}

func NewCacheManager(cacheDir string, dockerClient *docker.Client) *CacheManager {
	return &CacheManager{
		cacheDir:     cacheDir,
		dockerClient: dockerClient,
	}
}

// SetRemoteCache configures remote cache settings
func (cm *CacheManager) SetRemoteCache(config *RemoteCacheConfig) {
	cm.remoteCache = config
}

// GenerateCacheKey creates a unique cache key for the build context
func (cm *CacheManager) GenerateCacheKey(ctx context.Context, req *types.BuildRequest) (*CacheKey, error) {
	cacheKey := &CacheKey{
		Runtime:   req.BuildType,
		Files:     make(map[string]string),
		EnvVars:   make(map[string]string),
		BuildCmd:  req.BuildCommand,
		Packages:  []string{},
		BuildArgs: req.Environment,
	}

	// Hash important files
	importantFiles := []string{
		"go.mod", "go.sum",
		"package.json", "package-lock.json", "yarn.lock", "pnpm-lock.yaml",
		"requirements.txt", "setup.py", "pyproject.toml", "Pipfile",
		"Cargo.toml", "Cargo.lock",
		"Gemfile", "Gemfile.lock",
		"composer.json", "composer.lock",
		"deno.json", "deno.jsonc",
		"bun.lockb",
		"Dockerfile",
		".dockerignore",
	}

	for _, file := range importantFiles {
		filePath := filepath.Join(req.SourcePath, file)
		if hash, err := cm.hashFile(filePath); err == nil {
			cacheKey.Files[file] = hash
		}
	}

	// Hash environment variables (only non-sensitive ones)
	for key, value := range req.Environment {
		if !cm.isSensitiveEnv(key) {
			hash := sha256.Sum256([]byte(value))
			cacheKey.EnvVars[key] = hex.EncodeToString(hash[:])
		}
	}

	// Extract package dependencies for different runtimes
	if packages, err := cm.extractPackages(ctx, req); err == nil {
		cacheKey.Packages = packages
	}

	return cacheKey, nil
}

// hashFile calculates SHA256 hash of a file
func (cm *CacheManager) hashFile(filePath string) (string, error) {
	file, err := os.Open(filePath)
	if err != nil {
		return "", err
	}
	defer file.Close()

	hash := sha256.New()
	if _, err := io.Copy(hash, file); err != nil {
		return "", err
	}

	return hex.EncodeToString(hash.Sum(nil)), nil
}

// isSensitiveEnv checks if an environment variable is sensitive
func (cm *CacheManager) isSensitiveEnv(key string) bool {
	sensitiveKeys := []string{
		"PASSWORD", "SECRET", "KEY", "TOKEN", "API", "AUTH",
		"DATABASE_URL", "REDIS_URL", "PRIVATE",
	}

	keyUpper := strings.ToUpper(key)
	for _, sensitive := range sensitiveKeys {
		if strings.Contains(keyUpper, sensitive) {
			return true
		}
	}
	return false
}

// extractPackages extracts package dependencies from lock files
func (cm *CacheManager) extractPackages(ctx context.Context, req *types.BuildRequest) ([]string, error) {
	var packages []string

	// Go modules
	if goMod := filepath.Join(req.SourcePath, "go.mod"); cm.fileExists(goMod) {
		if content, err := os.ReadFile(goMod); err == nil {
			packages = cm.extractGoPackages(string(content))
		}
	}

	// Node.js packages
	if packageJson := filepath.Join(req.SourcePath, "package.json"); cm.fileExists(packageJson) {
		if content, err := os.ReadFile(packageJson); err == nil {
			packages = append(packages, cm.extractNodePackages(string(content))...)
		}
	}

	// Python requirements
	if reqTxt := filepath.Join(req.SourcePath, "requirements.txt"); cm.fileExists(reqTxt) {
		if content, err := os.ReadFile(reqTxt); err == nil {
			packages = append(packages, cm.extractPythonPackages(string(content))...)
		}
	}

	return packages, nil
}

func (cm *CacheManager) fileExists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}

func (cm *CacheManager) extractGoPackages(content string) []string {
	var packages []string
	lines := strings.Split(content, "\n")
	for _, line := range lines {
		if strings.HasPrefix(line, "\t") && strings.Contains(line, " ") {
			parts := strings.Fields(line)
			if len(parts) > 0 {
				packages = append(packages, parts[0])
			}
		}
	}
	return packages
}

func (cm *CacheManager) extractNodePackages(content string) []string {
	var packages []string
	var packageJson struct {
		Dependencies    map[string]string `json:"dependencies"`
		DevDependencies map[string]string `json:"devDependencies"`
	}

	if err := json.Unmarshal([]byte(content), &packageJson); err == nil {
		for name := range packageJson.Dependencies {
			packages = append(packages, name)
		}
		for name := range packageJson.DevDependencies {
			packages = append(packages, name)
		}
	}
	return packages
}

func (cm *CacheManager) extractPythonPackages(content string) []string {
	var packages []string
	lines := strings.Split(content, "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line != "" && !strings.HasPrefix(line, "#") && !strings.HasPrefix(line, "-") {
			parts := strings.Fields(line)
			if len(parts) > 0 {
				// Remove version specifiers
				pkgName := parts[0]
				if idx := strings.IndexAny(pkgName, "=<>!"); idx != -1 {
					pkgName = pkgName[:idx]
				}
				packages = append(packages, pkgName)
			}
		}
	}
	return packages
}

// GetCacheKeyHash generates a hash from the cache key
func (cm *CacheManager) GetCacheKeyHash(cacheKey *CacheKey) string {
	data, _ := json.Marshal(cacheKey)
	hash := sha256.Sum256(data)
	return hex.EncodeToString(hash[:])
}

// LookupCache checks if a cached image exists for the given cache key
func (cm *CacheManager) LookupCache(ctx context.Context, cacheKey *CacheKey) (*CacheEntry, error) {
	keyHash := cm.GetCacheKeyHash(cacheKey)

	// Check local cache first
	if entry, err := cm.lookupLocalCache(ctx, keyHash); err == nil {
		return entry, nil
	}

	// Check remote cache if enabled
	if cm.remoteCache != nil && cm.remoteCache.Enabled {
		if entry, err := cm.lookupRemoteCache(ctx, keyHash); err == nil {
			return entry, nil
		}
	}

	return nil, fmt.Errorf("cache entry not found")
}

// lookupLocalCache checks local cache storage
func (cm *CacheManager) lookupLocalCache(ctx context.Context, keyHash string) (*CacheEntry, error) {
	cacheFile := filepath.Join(cm.cacheDir, keyHash+".json")

	data, err := os.ReadFile(cacheFile)
	if err != nil {
		return nil, err
	}

	var entry CacheEntry
	if err := json.Unmarshal(data, &entry); err != nil {
		return nil, err
	}

	// Verify the image still exists in Docker
	if _, err := cm.dockerClient.GetImageInfo(ctx, entry.ImageName); err != nil {
		// Remove stale cache entry
		os.Remove(cacheFile)
		return nil, fmt.Errorf("cached image not found")
	}

	return &entry, nil
}

// lookupRemoteCache checks remote cache registry
func (cm *CacheManager) lookupRemoteCache(ctx context.Context, keyHash string) (*CacheEntry, error) {
	if cm.remoteCache == nil {
		return nil, fmt.Errorf("remote cache not configured")
	}

	remoteImage := fmt.Sprintf("%s/%s/cache:%s", cm.remoteCache.Registry, cm.remoteCache.Namespace, keyHash)

	// Try to pull the cached image
	auth := registry.AuthConfig{}
	_, err := cm.dockerClient.PullImage(ctx, remoteImage, auth)
	if err != nil {
		return nil, fmt.Errorf("remote cache entry not found")
	}

	// Get image info
	imageInfo, err := cm.dockerClient.GetImageInfo(ctx, remoteImage)
	if err != nil {
		return nil, err
	}

	// Create local cache entry
	entry := &CacheEntry{
		Key:       keyHash,
		ImageName: remoteImage,
		Size:      imageInfo.Size,
		Created:   time.Now(),
		Hash:      keyHash,
		Metadata: map[string]string{
			"source": "remote",
		},
	}

	// Save to local cache for faster future access
	cm.saveLocalCache(ctx, entry)

	return entry, nil
}

// StoreCache stores a build result in cache
func (cm *CacheManager) StoreCache(ctx context.Context, cacheKey *CacheKey, imageName string, metadata map[string]string) error {
	keyHash := cm.GetCacheKeyHash(cacheKey)

	// Get image info
	imageInfo, err := cm.dockerClient.GetImageInfo(ctx, imageName)
	if err != nil {
		return fmt.Errorf("failed to get image info: %w", err)
	}

	entry := &CacheEntry{
		Key:       keyHash,
		ImageName: imageName,
		Size:      imageInfo.Size,
		Created:   time.Now(),
		Hash:      keyHash,
		Metadata:  metadata,
	}

	// Store in local cache
	if err := cm.saveLocalCache(ctx, entry); err != nil {
		return fmt.Errorf("failed to save local cache: %w", err)
	}

	// Store in remote cache if enabled
	if cm.remoteCache != nil && cm.remoteCache.Enabled {
		if err := cm.saveRemoteCache(ctx, entry); err != nil {
			// Log error but don't fail the build
			fmt.Printf("Warning: failed to save to remote cache: %v\n", err)
		}
	}

	return nil
}

// saveLocalCache saves cache entry to local storage
func (cm *CacheManager) saveLocalCache(ctx context.Context, entry *CacheEntry) error {
	if err := os.MkdirAll(cm.cacheDir, 0755); err != nil {
		return err
	}

	cacheFile := filepath.Join(cm.cacheDir, entry.Key+".json")
	data, err := json.MarshalIndent(entry, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(cacheFile, data, 0644)
}

// saveRemoteCache pushes cache entry to remote registry
func (cm *CacheManager) saveRemoteCache(ctx context.Context, entry *CacheEntry) error {
	if cm.remoteCache == nil {
		return fmt.Errorf("remote cache not configured")
	}

	remoteImage := fmt.Sprintf("%s/%s/cache:%s", cm.remoteCache.Registry, cm.remoteCache.Namespace, entry.Key)

	// Tag and push to remote registry
	if err := cm.dockerClient.TagImage(ctx, entry.ImageName, remoteImage); err != nil {
		return fmt.Errorf("failed to tag image for remote cache: %w", err)
	}

	if err := cm.dockerClient.PushImage(ctx, remoteImage, cm.remoteCache.Registry); err != nil {
		return fmt.Errorf("failed to push to remote cache: %w", err)
	}

	return nil
}

// CleanupCache removes old cache entries
func (cm *CacheManager) CleanupCache(ctx context.Context, maxAge time.Duration) error {
	entries, err := os.ReadDir(cm.cacheDir)
	if err != nil {
		return err
	}

	cutoff := time.Now().Add(-maxAge)
	removed := 0

	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".json") {
			continue
		}

		cacheFile := filepath.Join(cm.cacheDir, entry.Name())
		info, err := entry.Info()
		if err != nil {
			continue
		}

		if info.ModTime().Before(cutoff) {
			// Read cache entry to remove associated image if needed
			if data, err := os.ReadFile(cacheFile); err == nil {
				var cacheEntry CacheEntry
				if json.Unmarshal(data, &cacheEntry) == nil {
					// Optionally remove Docker image (commented out for safety)
					// cm.dockerClient.RemoveImage(ctx, cacheEntry.ImageName)
				}
			}

			os.Remove(cacheFile)
			removed++
		}
	}

	fmt.Printf("Cleaned up %d cache entries\n", removed)
	return nil
}

// GetCacheStats returns cache statistics
func (cm *CacheManager) GetCacheStats(ctx context.Context) (map[string]interface{}, error) {
	entries, err := os.ReadDir(cm.cacheDir)
	if err != nil {
		return nil, err
	}

	stats := map[string]interface{}{
		"total_entries": 0,
		"total_size":    int64(0),
		"oldest_entry":  nil,
		"newest_entry":  nil,
	}

	var oldest, newest time.Time
	count := 0
	totalSize := int64(0)

	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".json") {
			continue
		}

		cacheFile := filepath.Join(cm.cacheDir, entry.Name())
		data, err := os.ReadFile(cacheFile)
		if err != nil {
			continue
		}

		var cacheEntry CacheEntry
		if json.Unmarshal(data, &cacheEntry) != nil {
			continue
		}

		count++
		totalSize += cacheEntry.Size

		if oldest.IsZero() || cacheEntry.Created.Before(oldest) {
			oldest = cacheEntry.Created
		}
		if newest.IsZero() || cacheEntry.Created.After(newest) {
			newest = cacheEntry.Created
		}
	}

	stats["total_entries"] = count
	stats["total_size"] = totalSize
	if !oldest.IsZero() {
		stats["oldest_entry"] = oldest
	}
	if !newest.IsZero() {
		stats["newest_entry"] = newest
	}

	return stats, nil
}
