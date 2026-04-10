package middleware

import (
	"bytes"
	"io"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

// ValidateContentType ensures the request has the correct content type
func ValidateContentType(allowedTypes ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Skip validation for GET, DELETE, HEAD requests
		if c.Request.Method == http.MethodGet ||
			c.Request.Method == http.MethodDelete ||
			c.Request.Method == http.MethodHead {
			c.Next()
			return
		}

		contentType := c.GetHeader("Content-Type")
		if contentType == "" {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   "invalid_content_type",
				"message": "Content-Type header is required",
			})
			c.Abort()
			return
		}

		// Check if content type matches any allowed type
		valid := false
		for _, allowed := range allowedTypes {
			if strings.HasPrefix(contentType, allowed) {
				valid = true
				break
			}
		}

		if !valid {
			c.JSON(http.StatusUnsupportedMediaType, gin.H{
				"error":   "unsupported_media_type",
				"message": "Content-Type must be one of: " + strings.Join(allowedTypes, ", "),
			})
			c.Abort()
			return
		}

		c.Next()
	}
}

// ValidateJSONBody ensures the request body is valid JSON
func ValidateJSONBody() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Skip validation for GET, DELETE, HEAD requests
		if c.Request.Method == http.MethodGet ||
			c.Request.Method == http.MethodDelete ||
			c.Request.Method == http.MethodHead {
			c.Next()
			return
		}

		// Read body
		body, err := io.ReadAll(c.Request.Body)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   "invalid_request_body",
				"message": "Failed to read request body",
			})
			c.Abort()
			return
		}

		// Restore body for handlers
		c.Request.Body = io.NopCloser(bytes.NewBuffer(body))

		// Empty body is allowed for some requests
		if len(body) == 0 {
			c.Next()
			return
		}

		// Validate JSON structure (basic check)
		trimmed := bytes.TrimSpace(body)
		if len(trimmed) > 0 {
			if trimmed[0] != '{' && trimmed[0] != '[' {
				c.JSON(http.StatusBadRequest, gin.H{
					"error":   "invalid_json",
					"message": "Request body must be valid JSON",
				})
				c.Abort()
				return
			}
		}

		c.Next()
	}
}

// RequireFields validates that required fields are present in the request
func RequireFields(fields ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		var body map[string]interface{}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   "invalid_request_body",
				"message": "Failed to parse request body",
			})
			c.Abort()
			return
		}

		missing := []string{}
		for _, field := range fields {
			if _, exists := body[field]; !exists {
				missing = append(missing, field)
			}
		}

		if len(missing) > 0 {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   "missing_required_fields",
				"message": "Missing required fields: " + strings.Join(missing, ", "),
				"fields":  missing,
			})
			c.Abort()
			return
		}

		// Store parsed body for handlers
		c.Set("parsed_body", body)
		c.Next()
	}
}

// ValidateQueryParams validates required query parameters
func ValidateQueryParams(params ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		missing := []string{}
		for _, param := range params {
			if c.Query(param) == "" {
				missing = append(missing, param)
			}
		}

		if len(missing) > 0 {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   "missing_query_parameters",
				"message": "Missing required query parameters: " + strings.Join(missing, ", "),
				"params":  missing,
			})
			c.Abort()
			return
		}

		c.Next()
	}
}
