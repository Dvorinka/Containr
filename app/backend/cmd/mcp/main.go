package main

import (
	"context"
	"fmt"
	"os"
	"os/signal"
	"strings"
	"syscall"

	"containr/internal/mcpserver"
)

// Injected at build time via -ldflags.
var Version = "dev"

// containr-mcp exposes the whole Containr API as MCP tools over stdio.
// Configure it in an MCP client with:
//
//	command: containr-mcp
//	env: CONTAINR_API_URL, CONTAINR_TOKEN (a cnp_ personal access token)
func main() {
	apiURL := os.Getenv("CONTAINR_API_URL")
	if apiURL == "" {
		apiURL = "http://localhost:8080/api/v1"
	}
	apiURL = strings.TrimSuffix(apiURL, "/")
	if !strings.HasSuffix(apiURL, "/api/v1") {
		apiURL += "/api/v1"
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	if err := mcpserver.Run(ctx, apiURL, os.Getenv("CONTAINR_TOKEN"), Version); err != nil {
		fmt.Fprintf(os.Stderr, "containr-mcp: %v\n", err)
		os.Exit(1)
	}
}
