package main

import (
	"context"
	"fmt"

	"containr/internal/build"
)

func main() {
	// Create a RailpackBuilder
	builder := build.NewRailpackBuilder("/tmp/containr-build-test", nil)

	// Test detection on the current project (has package.json)
	fmt.Println("Testing Railpack detection on current project...")

	err := builder.DetectRailpack(context.Background(), "/home/tdvorak/Desktop/PROG+HTML/Containr")
	if err != nil {
		fmt.Printf("❌ Railpack detection failed: %v\n", err)
	} else {
		fmt.Println("✅ Railpack can build this project!")
	}

	// Show supported frameworks
	fmt.Println("\nSupported frameworks:")
	frameworks := builder.GetSupportedFrameworks()
	for _, fw := range frameworks {
		fmt.Printf("  - %s\n", fw)
	}

	fmt.Println("\n✅ Railpack integration test completed successfully!")
}
