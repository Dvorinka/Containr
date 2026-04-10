package utils

import "time"

// FormatTime formats a time string for display
func FormatTime(timeStr string) string {
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
