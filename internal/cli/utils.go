package cli

import (
	"strings"

	"github.com/spf13/viper"
)

// getAPIURL constructs the full API URL for a given endpoint
func getAPIURL(endpoint string) string {
	baseURL := viper.GetString("api-url")
	if baseURL == "" {
		baseURL = "http://localhost:8080/api/v1" // Default for development
	}

	// Ensure baseURL doesn't end with / and endpoint starts with /
	if strings.HasSuffix(baseURL, "/") {
		baseURL = baseURL[:len(baseURL)-1]
	}
	if !strings.HasPrefix(endpoint, "/") {
		endpoint = "/" + endpoint
	}

	return baseURL + endpoint
}
