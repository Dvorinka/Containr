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
	os.Exit(cli.Execute())
}
