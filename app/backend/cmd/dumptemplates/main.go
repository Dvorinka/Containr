// dumptemplates prints the seeded official template catalog as JSON in the same
// shape as GET /api/v1/templates. The landing site (site/templates.json) uses it
// as the offline fallback catalog: `go run ./cmd/dumptemplates > ../../site/templates.json`.
package main

import (
	"containr/internal/api"
	"encoding/json"
	"fmt"
	"os"
)

func main() {
	out := struct {
		Templates []api.ServiceTemplate `json:"templates"`
	}{Templates: api.SeedTemplates()}

	enc := json.NewEncoder(os.Stdout)
	enc.SetIndent("", "  ")
	if err := enc.Encode(out); err != nil {
		fmt.Fprintln(os.Stderr, "encode:", err)
		os.Exit(1)
	}
}
