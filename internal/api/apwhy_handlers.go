package api

import (
	"containr/internal/database"
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/go-playground/validator/v10"
	"golang.org/x/crypto/bcrypt"
)

// Constants for validation and limits
const (
	MaxServiceNameLength = 100
	MaxRoutePrefixLength = 200
	MaxUpstreamURLLength = 500
	MaxAPIKeyNameLength  = 100
	MinAPIKeyLength      = 20
	MaxAPIKeyLength      = 100
	DefaultRPMLimit      = 60
	DefaultMonthlyQuota  = 1000
	MaxRPMLimit          = 10000
	MaxMonthlyQuota      = 10000000
)

// Validator instance for request validation
var validate = validator.New()

// APIError represents a structured API error response
type APIError struct {
	Code    string      `json:"code"`
	Message string      `json:"message"`
	Details interface{} `json:"details,omitempty"`
}

// APIResponse represents a standardized API response
type APIResponse struct {
	Success bool        `json:"success"`
	Data    interface{} `json:"data,omitempty"`
	Error   *APIError   `json:"error,omitempty"`
	Meta    *Meta       `json:"meta,omitempty"`
}

// Meta contains pagination and metadata
type Meta struct {
	Page       int `json:"page,omitempty"`
	PerPage    int `json:"per_page,omitempty"`
	Total      int `json:"total,omitempty"`
	TotalPages int `json:"total_pages,omitempty"`
}

// ServiceRequest represents the request payload for creating/updating services
type ServiceRequest struct {
	Name         string `json:"name" binding:"required,max=100" validate:"required,min=1,max=100"`
	UpstreamURL  string `json:"upstreamUrl" binding:"required,max=500" validate:"required,url,max=500"`
	RoutePrefix  string `json:"routePrefix" binding:"required,max=200" validate:"required,min=1,max=200"`
	Enabled      *bool  `json:"enabled,omitempty"`
	RPMLimit     *int   `json:"rpmLimit,omitempty" validate:"omitempty,min=1,max=10000"`
	MonthlyQuota *int   `json:"monthlyQuota,omitempty" validate:"omitempty,min=1,max=10000000"`
}

// APIKeyRequest represents the request payload for creating/updating API keys
type APIKeyRequest struct {
	Name         string `json:"name" binding:"required,max=100" validate:"required,min=1,max=100"`
	Plan         string `json:"plan" validate:"omitempty,oneof=free pro business enterprise"`
	Enabled      *bool  `json:"enabled,omitempty"`
	RPMLimit     *int   `json:"rpmLimit,omitempty" validate:"omitempty,min=1,max=10000"`
	MonthlyQuota *int   `json:"monthlyQuota,omitempty" validate:"omitempty,min=1,max=10000000"`
}

// generateServiceID generates a cryptographically secure service ID
func generateServiceID() (string, error) {
	bytes := make([]byte, 16)
	if _, err := rand.Read(bytes); err != nil {
		return "", fmt.Errorf("failed to generate random bytes: %w", err)
	}
	return "svc_" + hex.EncodeToString(bytes), nil
}

// generateAPIKey generates a cryptographically secure API key
func generateAPIKey() (string, error) {
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return "", fmt.Errorf("failed to generate random bytes: %w", err)
	}
	return "ap_" + hex.EncodeToString(bytes), nil
}

// hashAPIKey creates a bcrypt hash for the API key
func hashAPIKey(key string) (string, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(key), bcrypt.DefaultCost)
	if err != nil {
		return "", fmt.Errorf("failed to hash API key: %w", err)
	}
	return string(hash), nil
}

// validateAPIKeyPlan validates and returns default values for API key plans
func validateAPIKeyPlan(plan string) (string, int, int, error) {
	if plan == "" {
		plan = "free"
	}

	switch plan {
	case "free":
		return plan, 60, 1000, nil
	case "pro":
		return plan, 600, 50000, nil
	case "business":
		return plan, 3000, 300000, nil
	case "enterprise":
		return plan, 10000, 10000000, nil
	default:
		return "", 0, 0, fmt.Errorf("invalid plan: %s", plan)
	}
}

// sendJSONResponse sends a standardized JSON response
func sendJSONResponse(c *gin.Context, statusCode int, response APIResponse) {
	c.JSON(statusCode, response)
}

// sendErrorResponse sends a standardized error response
func sendErrorResponse(c *gin.Context, statusCode int, code, message string, details interface{}) {
	response := APIResponse{
		Success: false,
		Error: &APIError{
			Code:    code,
			Message: message,
			Details: details,
		},
	}
	sendJSONResponse(c, statusCode, response)
}

// sendSuccessResponse sends a standardized success response
func sendSuccessResponse(c *gin.Context, statusCode int, data interface{}) {
	response := APIResponse{
		Success: true,
		Data:    data,
	}
	sendJSONResponse(c, statusCode, response)
}

// validateRequest validates the request payload using the validator
func validateRequest(c *gin.Context, req interface{}) error {
	if err := c.ShouldBindJSON(req); err != nil {
		return fmt.Errorf("invalid request body: %w", err)
	}

	if err := validate.Struct(req); err != nil {
		return fmt.Errorf("validation failed: %w", err)
	}

	return nil
}

// handleAPwhyServicesList returns a list of API services
func handleAPwhyServicesList(c *gin.Context) {
	db := c.MustGet("db").(*database.DB)
	ctx := context.Background()

	// Query services from database
	rows, err := db.QueryContext(ctx, `
		SELECT id, name, slug, upstream_url, route_prefix, enabled, created_at, updated_at
		FROM api_services 
		ORDER BY created_at DESC
	`)
	if err != nil {
		sendErrorResponse(c, http.StatusInternalServerError, "DATABASE_ERROR",
			"Failed to query services", err.Error())
		return
	}
	defer rows.Close()

	var services []map[string]interface{}
	for rows.Next() {
		var id, name, slug, upstreamURL, routePrefix, createdAt, updatedAt string
		var enabled bool
		err := rows.Scan(&id, &name, &slug, &upstreamURL, &routePrefix, &enabled, &createdAt, &updatedAt)
		if err != nil {
			continue // Skip malformed rows
		}

		services = append(services, map[string]interface{}{
			"id":          id,
			"name":        name,
			"slug":        slug,
			"upstreamUrl": upstreamURL,
			"routePrefix": routePrefix,
			"enabled":     enabled,
			"createdAt":   createdAt,
			"updatedAt":   updatedAt,
		})
	}

	sendSuccessResponse(c, http.StatusOK, map[string]interface{}{
		"services": services,
		"count":    len(services),
	})
}

// handleAPwhyServicesCreate creates a new API service
func handleAPwhyServicesCreate(c *gin.Context) {
	var req ServiceRequest

	if err := validateRequest(c, &req); err != nil {
		sendErrorResponse(c, http.StatusBadRequest, "VALIDATION_ERROR",
			"Invalid request parameters", err.Error())
		return
	}

	db := c.MustGet("db").(*database.DB)
	ctx := context.Background()

	// Generate slug and ID
	id, err := generateServiceID()
	if err != nil {
		sendErrorResponse(c, http.StatusInternalServerError, "GENERATION_ERROR",
			"Failed to generate service ID", err.Error())
		return
	}

	slug := strings.ToLower(strings.ReplaceAll(req.Name, " ", "-"))

	// Insert service into database
	query := `
		INSERT INTO api_services (
			id, name, slug, upstream_url, route_prefix, health_path,
			enabled, rpm_limit, monthly_quota, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, '/health', true, $6, $7, NOW(), NOW())
	`

	var rpmLimit, monthlyQuota int
	if req.RPMLimit != nil {
		rpmLimit = *req.RPMLimit
	} else {
		rpmLimit = DefaultRPMLimit
	}

	if req.MonthlyQuota != nil {
		monthlyQuota = *req.MonthlyQuota
	} else {
		monthlyQuota = DefaultMonthlyQuota
	}

	_, err = db.ExecContext(ctx, query, id, req.Name, slug, req.UpstreamURL,
		req.RoutePrefix, rpmLimit, monthlyQuota)

	if err != nil {
		sendErrorResponse(c, http.StatusInternalServerError, "DATABASE_ERROR",
			"Failed to create service", err.Error())
		return
	}

	serviceData := map[string]interface{}{
		"id":           id,
		"name":         req.Name,
		"slug":         slug,
		"upstreamUrl":  req.UpstreamURL,
		"routePrefix":  req.RoutePrefix,
		"enabled":      true,
		"rpmLimit":     rpmLimit,
		"monthlyQuota": monthlyQuota,
		"createdAt":    time.Now().UTC().Format(time.RFC3339),
	}

	sendSuccessResponse(c, http.StatusCreated, map[string]interface{}{
		"service": serviceData,
		"message": "Service created successfully",
	})
}

// handleAPwhyServicesPatch updates an existing API service
func handleAPwhyServicesPatch(c *gin.Context) {
	serviceID := c.Param("id")

	var input struct {
		Enabled *bool `json:"enabled"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"ok":    false,
			"error": "Invalid input: " + err.Error(),
		})
		return
	}

	db := c.MustGet("db").(*database.DB)

	if input.Enabled != nil {
		_, err := db.ExecContext(context.Background(),
			"UPDATE api_services SET enabled = $1, updated_at = NOW() WHERE id = $2",
			*input.Enabled, serviceID)

		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"ok":    false,
				"error": "Failed to update service: " + err.Error(),
			})
			return
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"ok":   true,
		"data": gin.H{"id": serviceID, "updated": true},
	})
}

// handleAPwhyKeysList returns a list of API keys
func handleAPwhyKeysList(c *gin.Context) {
	db := c.MustGet("db").(*database.DB)

	rows, err := db.QueryContext(context.Background(), `
		SELECT id, name, key_prefix, plan, enabled, rpm_limit, monthly_quota, created_at, updated_at
		FROM api_keys 
		ORDER BY created_at DESC
	`)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"ok":   true,
			"data": []interface{}{},
		})
		return
	}
	defer rows.Close()

	var keys []map[string]interface{}
	for rows.Next() {
		var id, name, keyPrefix, plan, createdAt, updatedAt string
		var enabled bool
		var rpmLimit, monthlyQuota sql.NullInt64

		err := rows.Scan(&id, &name, &keyPrefix, &plan, &enabled, &rpmLimit, &monthlyQuota, &createdAt, &updatedAt)
		if err != nil {
			continue
		}

		key := map[string]interface{}{
			"id":        id,
			"name":      name,
			"keyPrefix": keyPrefix,
			"plan":      plan,
			"enabled":   enabled,
			"createdAt": createdAt,
			"updatedAt": updatedAt,
		}

		if rpmLimit.Valid {
			key["rpmLimit"] = rpmLimit.Int64
		}
		if monthlyQuota.Valid {
			key["monthlyQuota"] = monthlyQuota.Int64
		}

		keys = append(keys, key)
	}

	c.JSON(http.StatusOK, gin.H{
		"ok":   true,
		"data": keys,
	})
}

// handleAPwhyKeysCreate creates a new API key
func handleAPwhyKeysCreate(c *gin.Context) {
	var input struct {
		Name string `json:"name" binding:"required"`
		Plan string `json:"plan"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"ok":    false,
			"error": "Invalid input: " + err.Error(),
		})
		return
	}

	if input.Plan == "" {
		input.Plan = "free"
	}

	db := c.MustGet("db").(*database.DB)

	// Generate API key and hash
	apiKey, err := generateAPIKey()
	if err != nil {
		sendErrorResponse(c, http.StatusInternalServerError, "GENERATION_ERROR",
			"Failed to generate API key", err.Error())
		return
	}

	keyHash, err := hashAPIKey(apiKey)
	if err != nil {
		sendErrorResponse(c, http.StatusInternalServerError, "HASH_ERROR",
			"Failed to hash API key", err.Error())
		return
	}

	// Generate ID and prefix
	id, err := generateServiceID()
	if err != nil {
		sendErrorResponse(c, http.StatusInternalServerError, "GENERATION_ERROR",
			"Failed to generate key ID", err.Error())
		return
	}

	keyPrefix := apiKey[:8]

	// Set default limits based on plan
	var rpmLimit, monthlyQuota int
	switch input.Plan {
	case "free":
		rpmLimit, monthlyQuota = 60, 1000
	case "pro":
		rpmLimit, monthlyQuota = 600, 50000
	case "business":
		rpmLimit, monthlyQuota = 3000, 300000
	default:
		rpmLimit, monthlyQuota = 60, 1000
	}

	// Insert key into database
	_, err = db.ExecContext(context.Background(), `
		INSERT INTO api_keys (
			id, name, key_hash, key_prefix, plan, allowed_service_ids,
			enabled, rpm_limit, monthly_quota, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, '[]', true, $6, $7, NOW(), NOW())
	`, id, input.Name, keyHash, keyPrefix, input.Plan, rpmLimit, monthlyQuota)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"ok":    false,
			"error": "Failed to create key: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"ok": true,
		"data": gin.H{
			"id":           id,
			"name":         input.Name,
			"plan":         input.Plan,
			"key":          apiKey, // Only return the actual key once
			"keyPrefix":    keyPrefix,
			"enabled":      true,
			"rpmLimit":     rpmLimit,
			"monthlyQuota": monthlyQuota,
		},
	})
}

// handleAPwhyKeysPatch updates an existing API key
func handleAPwhyKeysPatch(c *gin.Context) {
	keyID := c.Param("id")

	var input struct {
		Enabled *bool `json:"enabled"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"ok":    false,
			"error": "Invalid input: " + err.Error(),
		})
		return
	}

	db := c.MustGet("db").(*database.DB)

	if input.Enabled != nil {
		_, err := db.ExecContext(context.Background(),
			"UPDATE api_keys SET enabled = $1, updated_at = NOW() WHERE id = $2",
			*input.Enabled, keyID)

		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"ok":    false,
				"error": "Failed to update key: " + err.Error(),
			})
			return
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"ok":   true,
		"data": gin.H{"id": keyID, "updated": true},
	})
}

// handleAPwhyAnalyticsOps returns operational analytics
func handleAPwhyAnalyticsOps(c *gin.Context) {
	db := c.MustGet("db").(*database.DB)

	// Get counts from database
	var totalServices, totalKeys, totalUsers int

	db.QueryRowContext(context.Background(), "SELECT COUNT(*) FROM api_services").Scan(&totalServices)
	db.QueryRowContext(context.Background(), "SELECT COUNT(*) FROM api_keys").Scan(&totalKeys)
	db.QueryRowContext(context.Background(), "SELECT COUNT(*) FROM users").Scan(&totalUsers)

	// For requests, we'll return 0 for now (would need to implement usage tracking)
	requestsToday := 0
	requestsThisMonth := 0

	c.JSON(http.StatusOK, gin.H{
		"ok": true,
		"data": gin.H{
			"total_requests":      0,
			"total_services":      totalServices,
			"total_keys":          totalKeys,
			"total_users":         totalUsers,
			"requests_today":      requestsToday,
			"requests_this_month": requestsThisMonth,
		},
	})
}

// handleAPwhyAnalyticsTraffic returns traffic analytics
func handleAPwhyAnalyticsTraffic(c *gin.Context) {
	// TODO: Implement traffic analytics from database
	c.JSON(http.StatusOK, gin.H{
		"ok": true,
		"data": gin.H{
			"top_services":    []interface{}{},
			"requests_by_day": []interface{}{},
			"status_codes":    []interface{}{},
		},
	})
}
