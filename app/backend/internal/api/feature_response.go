package api

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

func respondFeatureUnavailable(c *gin.Context, feature string, details string) {
	c.JSON(http.StatusNotImplemented, gin.H{
		"error":   "Feature not implemented",
		"code":    "FEATURE_NOT_IMPLEMENTED",
		"feature": feature,
		"details": details,
	})
}

func respondDependencyUnavailable(c *gin.Context, dependency string, details string) {
	c.JSON(http.StatusServiceUnavailable, gin.H{
		"error":      "Dependency unavailable",
		"code":       "DEPENDENCY_UNAVAILABLE",
		"dependency": dependency,
		"details":    details,
	})
}
