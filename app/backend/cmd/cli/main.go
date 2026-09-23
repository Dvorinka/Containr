package main

import (
	"containr/internal/cli"
	"fmt"
	"os"
)

// Injected at build time via -ldflags (see scripts/build-cli.sh).
var (
	Version   = "dev"
	BuildTime = "unknown"
	GitCommit = "unknown"
)

func main() {
	cli.SetVersion(fmt.Sprintf("%s (%s, %s)", Version, GitCommit, BuildTime))
	if err := cli.Run(); err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}
}
