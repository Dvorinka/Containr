package main

import (
	"context"
	"fmt"

	"containr/internal/build"
)

func main() {
	fmt.Println("🧪 Testing Build Manager Detection...")
	
	// Test build type detection on the current project
	fmt.Println("\n📁 Testing on current project (has package.json)...")
	
	// Note: We can't fully test BuildManager without a docker client,
	// but we can test the detection logic
	
	// Create mock scenarios
	testCases := []struct {
		name     string
		expected string
	}{
		{"Node.js project (package.json)", "railpack"},
		{"Python project (requirements.txt)", "railpack"}, 
		{"Go project (go.mod)", "railpack"},
		{"Dockerfile project", "dockerfile"},
		{"Unknown project", "nixpacks"},
	}
	
	fmt.Println("\n🎯 Expected detection priorities:")
	for _, tc := range testCases {
		fmt.Printf("  • %s → %s\n", tc.name, tc.expected)
	}
	
	// Test Railpack builder directly
	builder := build.NewRailpackBuilder("/tmp/test", nil)
	
	fmt.Println("\n🔍 Testing Railpack detection on current project:")
	err := builder.DetectRailpack(context.Background(), "/home/tdvorak/Desktop/PROG+HTML/Containr")
	if err != nil {
		fmt.Printf("❌ Detection failed: %v\n", err)
	} else {
		fmt.Println("✅ Railpack can build this project!")
	}
	
	fmt.Println("\n📋 Build Priority Order:")
	fmt.Println("  1. Dockerfile (if present)")
	fmt.Println("  2. Railpack (primary choice)")
	fmt.Println("  3. Nixpacks (fallback)")
	fmt.Println("  4. Prebuilt (manual)")
	
	fmt.Println("\n🚀 Build Manager Integration Test Complete!")
}
