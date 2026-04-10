package api

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

func requireAuthenticatedUserID(c *gin.Context) (string, bool) {
	userIDValue, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return "", false
	}

	userID, ok := userIDValue.(string)
	if !ok || userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user context"})
		return "", false
	}

	return userID, true
}
