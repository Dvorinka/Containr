package api

import (
	"strings"

	"github.com/gin-gonic/gin"
)

// firstPathParam returns the first non-empty route param from the provided names.
func firstPathParam(c *gin.Context, names ...string) string {
	for _, name := range names {
		if value := c.Param(name); value != "" {
			return value
		}
	}
	return ""
}

// firstNonEmpty returns the first non-blank string, trimmed.
func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}
