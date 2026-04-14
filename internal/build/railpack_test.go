package build

import (
	"context"
	"os"
	"path/filepath"
	"testing"
)

func TestRailpackBuilder_DetectRailpack(t *testing.T) {
	// Create a temporary directory for testing
	tempDir, err := os.MkdirTemp("", "railpack-test-*")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	// Test Node.js detection
	nodeDir := filepath.Join(tempDir, "node-app")
	if err := os.MkdirAll(nodeDir, 0755); err != nil {
		t.Fatalf("Failed to create node dir: %v", err)
	}

	// Create package.json
	packageJson := `{
		"name": "test-app",
		"version": "1.0.0",
		"scripts": {
			"start": "node index.js"
		}
	}`
	if err := os.WriteFile(filepath.Join(nodeDir, "package.json"), []byte(packageJson), 0644); err != nil {
		t.Fatalf("Failed to create package.json: %v", err)
	}

	// Create RailpackBuilder (we'll mock docker client for now)
	builder := &RailpackBuilder{
		workDir: tempDir,
	}

	// Test detection
	err = builder.DetectRailpack(context.Background(), nodeDir)
	if err != nil {
		t.Errorf("Expected Railpack to detect Node.js app, got error: %v", err)
	}

	// Test non-supported directory
	emptyDir := filepath.Join(tempDir, "empty")
	if err := os.MkdirAll(emptyDir, 0755); err != nil {
		t.Fatalf("Failed to create empty dir: %v", err)
	}

	err = builder.DetectRailpack(context.Background(), emptyDir)
	if err == nil {
		t.Error("Expected Railpack to fail detection on empty directory")
	}
}

func TestBuildManager_DetectBuildType(t *testing.T) {
	// Create a temporary directory for testing
	tempDir, err := os.MkdirTemp("", "build-manager-test-*")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	// Test Node.js app detection (should prefer Railpack)
	nodeDir := filepath.Join(tempDir, "node-app")
	if err := os.MkdirAll(nodeDir, 0755); err != nil {
		t.Fatalf("Failed to create node dir: %v", err)
	}

	packageJson := `{"name": "test-app", "version": "1.0.0"}`
	if err := os.WriteFile(filepath.Join(nodeDir, "package.json"), []byte(packageJson), 0644); err != nil {
		t.Fatalf("Failed to create package.json: %v", err)
	}

	// Create build manager (we'll skip docker client for this test)
	// Note: This would need a mock docker client in a real test
	t.Skip("BuildManager test requires docker client mock")
}

func TestRailpackBuilder_GetSupportedFrameworks(t *testing.T) {
	builder := &RailpackBuilder{}
	frameworks := builder.GetSupportedFrameworks()

	expected := []string{
		"node.js",
		"python", 
		"go",
		"rust",
		"java",
		"ruby",
		"php",
		"static",
	}

	if len(frameworks) != len(expected) {
		t.Errorf("Expected %d frameworks, got %d", len(expected), len(frameworks))
	}

	for i, framework := range expected {
		if i >= len(frameworks) || frameworks[i] != framework {
			t.Errorf("Expected framework %s at index %d, got %s", framework, i, frameworks[i])
		}
	}
}
