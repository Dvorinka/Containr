package cli

import (
	"strings"
	"time"

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

// formatTime formats a time string for display
func formatTime(timeStr string) string {
	if timeStr == "" {
		return "Unknown"
	}
	
	// Parse the time and format it nicely
	t, err := time.Parse(time.RFC3339, timeStr)
	if err != nil {
		return timeStr // Return original if parsing fails
	}
	
	return t.Format("2006-01-02 15:04:05")
}
