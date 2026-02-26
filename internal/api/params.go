package api

import "github.com/gin-gonic/gin"

// firstPathParam returns the first non-empty route param from the provided names.
func firstPathParam(c *gin.Context, names ...string) string {
	for _, name := range names {
		if value := c.Param(name); value != "" {
			return value
		}
	}
	return ""
}
