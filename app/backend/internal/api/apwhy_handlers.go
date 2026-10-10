package api

import (
	"containr/internal/database"
	"containr/internal/database/sqlcdb"
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/go-playground/validator/v10"
	"github.com/google/uuid"
	"github.com/lib/pq"
	"golang.org/x/crypto/bcrypt"
)

// Default quota limits applied when the request omits them.
const (
	DefaultRPMLimit     = 60
	DefaultMonthlyQuota = 1000
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

// isUniqueViolation reports whether err is a Postgres unique-constraint violation.
func isUniqueViolation(err error) bool {
	var pqErr *pq.Error
	return errors.As(err, &pqErr) && pqErr.Code == "23505"
}

// handleAPwhyServiceValidate probes the upstream health path and records the
// result on the service row. Ported from the standalone APwhy server.
func handleAPwhyServiceValidate(c *gin.Context) {
	serviceID := c.Param("id")
	db := c.MustGet("db").(*database.DB)
	ctx := c.Request.Context()

	svcUUID, parseErr := uuid.Parse(serviceID)
	var svc sqlcdb.GetAPServiceForValidateRow
	var err error
	if parseErr == nil {
		svc, err = sqlcdb.New(db.DB).GetAPServiceForValidate(ctx, svcUUID)
	}
	if parseErr != nil || err != nil {
		sendErrorResponse(c, http.StatusNotFound, "SERVICE_NOT_FOUND", "Service not found", nil)
		return
	}
	upstreamURL, healthPath := svc.UpstreamUrl, svc.HealthPath
	authHeader, authValue := svc.UpstreamAuthHeader, svc.UpstreamAuthValue

	timeout := 8000
	if svc.RequestTimeoutMs.Valid && svc.RequestTimeoutMs.Int32 > 0 {
		timeout = int(svc.RequestTimeoutMs.Int32)
	}
	target := strings.TrimRight(upstreamURL, "/") + "/" + strings.TrimLeft(healthPath, "/")

	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, target, nil)
	if authHeader.Valid && authHeader.String != "" {
		req.Header.Set(authHeader.String, authValue.String)
	}

	client := &http.Client{Timeout: time.Duration(timeout) * time.Millisecond}
	res, probeErr := client.Do(req)

	status := http.StatusBadGateway
	message := ""
	ok := false
	if probeErr != nil {
		message = probeErr.Error()
	} else {
		defer res.Body.Close()
		status = res.StatusCode
		message = fmt.Sprintf("HTTP %d", res.StatusCode)
		ok = res.StatusCode >= 200 && res.StatusCode < 300
	}

	validationStatus := "failed"
	if ok {
		validationStatus = "healthy"
	}

	q := sqlcdb.New(db.DB)
	_ = q.SetAPServiceValidation(ctx, sqlcdb.SetAPServiceValidationParams{
		LastValidationStatus:  sql.NullString{String: validationStatus, Valid: true},
		LastValidationMessage: sql.NullString{String: message, Valid: true},
		ID:                    svcUUID,
	})

	if !ok {
		_ = q.InsertServiceIncident(ctx, sqlcdb.InsertServiceIncidentParams{
			ServiceID:  uuid.NullUUID{UUID: svcUUID, Valid: true},
			Message:    message,
			HttpStatus: sql.NullInt32{Int32: int32(status), Valid: true},
		})
	}

	sendSuccessResponse(c, http.StatusOK, map[string]interface{}{
		"validation": map[string]interface{}{
			"ok":      ok,
			"status":  status,
			"message": message,
		},
	})
}

// handleAPwhyServicesList returns a list of API services
func handleAPwhyServicesList(c *gin.Context) {
	db := c.MustGet("db").(*database.DB)
	ctx := context.Background()

	// Query services from database
	rows, err := sqlcdb.New(db.DB).ListAPServices(ctx)
	if err != nil {
		sendErrorResponse(c, http.StatusInternalServerError, "DATABASE_ERROR",
			"Failed to query services", err.Error())
		return
	}

	services := make([]map[string]interface{}, 0, len(rows))
	for _, r := range rows {
		services = append(services, map[string]interface{}{
			"id":          r.ID.String(),
			"name":        r.Name,
			"slug":        r.Slug,
			"upstreamUrl": r.UpstreamUrl,
			"routePrefix": r.RoutePrefix,
			"enabled":     r.Enabled != 0,
			"createdAt":   r.CreatedAt,
			"updatedAt":   r.UpdatedAt,
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

	slug := strings.ToLower(strings.ReplaceAll(req.Name, " ", "-"))

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

	// id defaults to gen_random_uuid(); enabled defaults to 1.
	svcID, err := sqlcdb.New(db.DB).InsertAPService(ctx, sqlcdb.InsertAPServiceParams{
		Name:         req.Name,
		Slug:         slug,
		UpstreamUrl:  req.UpstreamURL,
		RoutePrefix:  req.RoutePrefix,
		RpmLimit:     sql.NullInt32{Int32: int32(rpmLimit), Valid: true},
		MonthlyQuota: sql.NullInt32{Int32: int32(monthlyQuota), Valid: true},
	})

	if err != nil {
		if isUniqueViolation(err) {
			sendErrorResponse(c, http.StatusConflict, "CONFLICT",
				"A service with this slug or route prefix already exists", err.Error())
			return
		}
		sendErrorResponse(c, http.StatusInternalServerError, "DATABASE_ERROR",
			"Failed to create service", err.Error())
		return
	}

	serviceData := map[string]interface{}{
		"id":           svcID.String(),
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
		enabled := int32(0)
		if *input.Enabled {
			enabled = 1
		}
		svcUUID, _ := uuid.Parse(serviceID)
		err := sqlcdb.New(db.DB).SetAPServiceEnabled(context.Background(), sqlcdb.SetAPServiceEnabledParams{
			Enabled: enabled,
			ID:      svcUUID,
		})

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

	rows, err := sqlcdb.New(db.DB).ListAPKeys(context.Background())
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"ok":   true,
			"data": []interface{}{},
		})
		return
	}

	keys := make([]map[string]interface{}, 0, len(rows))
	for _, r := range rows {
		key := map[string]interface{}{
			"id":        r.ID.String(),
			"name":      r.Name,
			"keyPrefix": r.KeyPrefix,
			"plan":      r.Plan,
			"enabled":   r.Enabled != 0,
			"createdAt": r.CreatedAt,
			"updatedAt": r.UpdatedAt,
		}

		if r.RpmLimit.Valid {
			key["rpmLimit"] = int64(r.RpmLimit.Int32)
		}
		if r.MonthlyQuota.Valid {
			key["monthlyQuota"] = int64(r.MonthlyQuota.Int32)
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

	keyPrefix := apiKey[:8]

	// Set default limits based on plan
	plan, rpmLimit, monthlyQuota, err := validateAPIKeyPlan(input.Plan)
	if err != nil {
		sendErrorResponse(c, http.StatusBadRequest, "VALIDATION_ERROR",
			"Invalid plan", err.Error())
		return
	}

	// id defaults to gen_random_uuid(); enabled defaults to 1.
	keyID, err := sqlcdb.New(db.DB).InsertAPKey(context.Background(), sqlcdb.InsertAPKeyParams{
		Name:         input.Name,
		KeyHash:      keyHash,
		KeyPrefix:    keyPrefix,
		Plan:         plan,
		RpmLimit:     sql.NullInt32{Int32: int32(rpmLimit), Valid: true},
		MonthlyQuota: sql.NullInt32{Int32: int32(monthlyQuota), Valid: true},
	})

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
			"id":           keyID.String(),
			"name":         input.Name,
			"plan":         plan,
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
		enabled := int32(0)
		if *input.Enabled {
			enabled = 1
		}
		keyUUID, _ := uuid.Parse(keyID)
		err := sqlcdb.New(db.DB).SetAPKeyEnabled(context.Background(), sqlcdb.SetAPKeyEnabledParams{
			Enabled: enabled,
			ID:      keyUUID,
		})

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
	q := sqlcdb.New(db.DB)
	ctx := context.Background()

	totalServices, err := q.CountAPServices(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"ok":    false,
			"error": "Failed to count services: " + err.Error(),
		})
		return
	}
	totalKeys, err := q.CountAPKeys(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"ok":    false,
			"error": "Failed to count api keys: " + err.Error(),
		})
		return
	}
	totalUsers, err := q.CountUsers(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"ok":    false,
			"error": "Failed to count users: " + err.Error(),
		})
		return
	}

	totalRequests, err := q.SumUsageCounters(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"ok":    false,
			"error": "Failed to aggregate request counters: " + err.Error(),
		})
		return
	}

	requestsToday, err := q.SumRequestMetricSince(ctx, "day")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"ok":    false,
			"error": "Failed to aggregate today's requests: " + err.Error(),
		})
		return
	}

	requestsThisMonth, err := q.SumRequestMetricSince(ctx, "month")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"ok":    false,
			"error": "Failed to aggregate monthly requests: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"ok": true,
		"data": gin.H{
			"total_requests":      totalRequests,
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
	db := c.MustGet("db").(*database.DB)

	q := sqlcdb.New(db.DB)
	ctx := context.Background()

	topServices := make([]map[string]interface{}, 0)
	if serviceRows, err := q.ListTopAPServices(ctx); err == nil {
		for _, r := range serviceRows {
			topServices = append(topServices, map[string]interface{}{
				"service_id": r.ID.String(),
				"name":       r.Name,
				"requests":   r.TotalRequests,
			})
		}
	}

	requestsByDay := make([]map[string]interface{}, 0)
	if trafficRows, err := q.ListRequestsByDay(ctx); err == nil {
		for _, r := range trafficRows {
			requestsByDay = append(requestsByDay, map[string]interface{}{
				"day":      r.DayBucket,
				"requests": r.Total,
			})
		}
	}

	statusCodes := make([]map[string]interface{}, 0)
	if statusRows, err := q.ListIncidentStatusCodes(ctx); err == nil {
		for _, r := range statusRows {
			statusCodes = append(statusCodes, map[string]interface{}{
				"status_code": r.StatusCode,
				"count":       r.Total,
			})
		}
	}

	clientEvents := make([]map[string]interface{}, 0)
	if eventRows, err := q.ListClientEventPaths(ctx); err == nil {
		for _, r := range eventRows {
			clientEvents = append(clientEvents, map[string]interface{}{
				"path":  r.Path,
				"count": r.Total,
			})
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"ok": true,
		"data": gin.H{
			"top_services":    topServices,
			"requests_by_day": requestsByDay,
			"status_codes":    statusCodes,
			"client_events":   clientEvents,
		},
	})
}
