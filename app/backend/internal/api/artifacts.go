package api

import (
	"crypto/rand"
	"encoding/hex"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

// containrWorkDir is the build workspace root — same dir the BuildManager
// was constructed with; checkouts and agent artifacts live beneath it.
const containrWorkDir = "/tmp/containr-builds"

// artifacts is a one-shot blob store for node agents: build contexts and
// docker-save tarballs the server produced on behalf of a deployment. Files
// live under workdir/artifacts/<id> and are removed when the deployment
// finishes or after maxArtifactAge.
var artifacts = &artifactStore{files: map[string]string{}}

type artifactStore struct {
	mu    sync.Mutex
	dir   string
	files map[string]string
}

const maxArtifactAge = 2 // hours — a deployment can never outlive this

// initArtifacts points the store at dir (created on demand).
func initArtifacts(dir string) {
	artifacts.mu.Lock()
	defer artifacts.mu.Unlock()
	artifacts.dir = dir
	_ = os.MkdirAll(dir, 0o755)
}

// artifactDir returns the store root, defaulting under the build workdir.
func artifactDir() string {
	artifacts.mu.Lock()
	defer artifacts.mu.Unlock()
	if artifacts.dir != "" {
		return artifacts.dir
	}
	return filepath.Join(containrWorkDir, "artifacts")
}

// putArtifact streams rc into the store and returns the artifact id.
func putArtifact(rc io.Reader) (string, error) {
	buf := make([]byte, 16)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	id := hex.EncodeToString(buf)
	dir := artifactDir()
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return "", err
	}
	path := filepath.Join(dir, id+".tar")
	f, err := os.Create(path)
	if err != nil {
		return "", err
	}
	if _, err := io.Copy(f, rc); err != nil {
		f.Close()
		os.Remove(path)
		return "", err
	}
	f.Close()

	artifacts.mu.Lock()
	artifacts.files[id] = path
	artifacts.mu.Unlock()
	return id, nil
}

// removeArtifact deletes the file and forgets the id. Safe on missing ids.
func removeArtifact(id string) {
	artifacts.mu.Lock()
	path, ok := artifacts.files[id]
	delete(artifacts.files, id)
	artifacts.mu.Unlock()
	if ok {
		_ = os.Remove(path)
		return
	}
	// Registered before a restart — remove best-effort by name.
	if id != "" {
		_ = os.Remove(filepath.Join(artifactDir(), id+".tar"))
	}
}

// ServeArtifact streams a stored blob to a token-authenticated agent. Files
// persist across downloads — spread builds share one context — and are
// deleted by the deployment that created them.
func (h *NodeAgentHandler) ServeArtifact(c *gin.Context) {
	if !h.isValidAgentAuthToken(c.Request.Context(), agentAuthTokenFromRequest(c)) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid auth token"})
		return
	}
	id := c.Param("id")
	raw, err := hex.DecodeString(id)
	if len(id) != 32 || err != nil || len(raw) != 16 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Artifact not found"})
		return
	}
	path := filepath.Join(artifactDir(), id+".tar")
	info, err := os.Stat(path)
	if err != nil || info.IsDir() {
		c.JSON(http.StatusNotFound, gin.H{"error": "Artifact not found"})
		return
	}
	c.Header("Content-Type", "application/x-tar")
	c.File(path)
}

// purgeStaleArtifacts drops files older than maxArtifactAge. Called on boot.
func purgeStaleArtifacts() {
	entries, err := os.ReadDir(artifactDir())
	if err != nil {
		return
	}
	for _, e := range entries {
		info, err := e.Info()
		if err != nil {
			continue
		}
		if info.ModTime().Before(time.Now().Add(-maxArtifactAge * time.Hour)) {
			_ = os.Remove(filepath.Join(artifactDir(), e.Name()))
		}
	}
}
