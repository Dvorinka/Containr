package api

import (
	"bytes"
	"containr/internal/database"
	"containr/internal/database/sqlcdb"
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

type LoginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=6"`
}

type RegisterRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=8,max=128"`
	Name     string `json:"name" binding:"required,min=2"`
}

type ManualUserCreateRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=8,max=128"`
	Name     string `json:"name" binding:"required,min=2,max=255"`
}

type AuthResponse struct {
	Token string      `json:"token"`
	User  interface{} `json:"user"`
}

type User struct {
	ID        string `json:"id"`
	Email     string `json:"email"`
	Name      string `json:"name"`
	AvatarURL string `json:"avatar_url,omitempty"`
	IsAdmin   bool   `json:"is_admin"`
	CreatedAt string `json:"created_at"`
}

func handleLogin(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	db := c.MustGet("db").(*database.DB)
	jwtSecret := c.MustGet("jwt_secret").(string)

	// Find user by email
	var user User
	var hashedPassword string
	urow, err := sqlcdb.New(db.DB).GetUserByEmailForAuth(context.Background(), req.Email)
	user = User{
		ID:        urow.ID.String(),
		Email:     urow.Email,
		Name:      urow.Name,
		AvatarURL: urow.AvatarUrl,
		IsAdmin:   urow.IsAdmin,
		CreatedAt: urow.CreatedAt.Time.String(),
	}
	hashedPassword = urow.PasswordHash

	if err == sql.ErrNoRows {
		authUser, ok := verifyBetterAuthCredentials(c, req.Email, req.Password)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid credentials"})
			return
		}

		user, err = createLocalUserFromBetterAuth(db, authUser)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create local user"})
			return
		}
	} else if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	} else {
		// Check password
		if err := bcrypt.CompareHashAndPassword([]byte(hashedPassword), []byte(req.Password)); err != nil {
			if _, ok := verifyBetterAuthCredentials(c, req.Email, req.Password); !ok {
				c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid credentials"})
				return
			}
		}
	}

	// Generate JWT token
	token, err := generateJWT(user.ID, user.Email, jwtSecret)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token"})
		return
	}

	c.JSON(http.StatusOK, AuthResponse{
		Token: token,
		User:  user,
	})
}

func handleAuthBootstrap(c *gin.Context) {
	db := c.MustGet("db").(*database.DB)

	count, err := countLocalUsers(db)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to inspect auth bootstrap state"})
		return
	}

	mode := "login"
	if count == 0 {
		mode = "register"
	}

	providers := []string{}
	for _, provider := range []string{"GITHUB", "GOOGLE"} {
		if oauthProviderConfigured(provider) {
			providers = append(providers, strings.ToLower(provider))
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"has_users":      count > 0,
		"user_count":     count,
		"mode":           mode,
		"providers":      providers,
		"signup_enabled": signupEnabled(db),
	})
}

// oauthProviderConfigured reports whether an OAuth provider has real
// credentials. Placeholder values from .env.example do not count, so
// self-hosted installs default to email/password only.
func oauthProviderConfigured(provider string) bool {
	id := strings.TrimSpace(os.Getenv(provider + "_CLIENT_ID"))
	secret := strings.TrimSpace(os.Getenv(provider + "_CLIENT_SECRET"))
	return id != "" && secret != "" &&
		!strings.HasPrefix(id, "PLACEHOLDER_") && !strings.HasPrefix(secret, "PLACEHOLDER_")
}

type betterAuthLoginUser struct {
	ID    string `json:"id"`
	Email string `json:"email"`
	Name  string `json:"name"`
	Image string `json:"image"`
}

type betterAuthLoginResponse struct {
	User betterAuthLoginUser `json:"user"`
}

func verifyBetterAuthCredentials(c *gin.Context, email string, password string) (betterAuthLoginUser, bool) {
	endpoint, err := betterAuthSignInURL()
	if err != nil {
		log.Printf("Better Auth fallback disabled: %v", err)
		return betterAuthLoginUser{}, false
	}

	body, err := json.Marshal(gin.H{
		"email":    strings.TrimSpace(email),
		"password": password,
	})
	if err != nil {
		return betterAuthLoginUser{}, false
	}

	ctx := c.Request.Context()
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return betterAuthLoginUser{}, false
	}
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Accept", "application/json")

	client := &http.Client{Timeout: 5 * time.Second}
	response, err := client.Do(request)
	if err != nil {
		log.Printf("Better Auth fallback failed: %v", err)
		return betterAuthLoginUser{}, false
	}
	defer response.Body.Close()

	if response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices {
		return betterAuthLoginUser{}, false
	}

	var payload betterAuthLoginResponse
	if err := json.NewDecoder(response.Body).Decode(&payload); err != nil {
		log.Printf("Better Auth fallback response decode failed: %v", err)
		return betterAuthLoginUser{}, false
	}

	payload.User.Email = strings.ToLower(strings.TrimSpace(firstNonEmpty(payload.User.Email, email)))
	payload.User.Name = strings.TrimSpace(payload.User.Name)
	if payload.User.Name == "" {
		payload.User.Name = "Containr User"
	}

	if payload.User.Email == "" {
		return betterAuthLoginUser{}, false
	}

	return payload.User, true
}

func betterAuthSignInURL() (string, error) {
	rawTarget := strings.TrimSpace(os.Getenv("BETTER_AUTH_PROXY_URL"))
	if rawTarget == "" {
		rawTarget = "http://127.0.0.1:3001"
	}

	target, err := parseAuthProxyTarget(rawTarget)
	if err != nil {
		return "", err
	}

	return target.ResolveReference(&url.URL{Path: "/api/auth/sign-in/email"}).String(), nil
}

func betterAuthSignUpURL() (string, error) {
	rawTarget := strings.TrimSpace(os.Getenv("BETTER_AUTH_PROXY_URL"))
	if rawTarget == "" {
		rawTarget = "http://127.0.0.1:3001"
	}

	target, err := parseAuthProxyTarget(rawTarget)
	if err != nil {
		return "", err
	}

	return target.ResolveReference(&url.URL{Path: "/api/auth/sign-up/email"}).String(), nil
}

func createLocalUserFromBetterAuth(db *database.DB, authUser betterAuthLoginUser) (User, error) {
	email := strings.ToLower(strings.TrimSpace(authUser.Email))
	if email == "" {
		return User{}, errors.New("email is required")
	}

	name := strings.TrimSpace(authUser.Name)
	if name == "" {
		name = "Containr User"
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(uuid.NewString()), bcrypt.DefaultCost)
	if err != nil {
		return User{}, err
	}

	// A mirrored first account owns the platform, same as handleRegister.
	q := sqlcdb.New(db.DB)
	total64, err := q.CountUsers(context.Background())
	if err != nil {
		return User{}, err
	}

	urow, err := q.UpsertLocalUser(context.Background(), sqlcdb.UpsertLocalUserParams{
		Email:        email,
		PasswordHash: string(hashedPassword),
		Name:         name,
		Column4:      strings.TrimSpace(authUser.Image),
		IsAdmin:      total64 == 0,
	})
	if err != nil {
		return User{}, err
	}
	user := User{
		ID:        urow.ID.String(),
		Email:     urow.Email,
		Name:      urow.Name,
		AvatarURL: urow.AvatarUrl,
		IsAdmin:   urow.IsAdmin,
		CreatedAt: urow.CreatedAt.Time.String(),
	}

	return user, nil
}

func handleRegister(c *gin.Context) {
	var req RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	db := c.MustGet("db").(*database.DB)
	jwtSecret := c.MustGet("jwt_secret").(string)

	total, err := countLocalUsers(db)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}

	// Closed once the first account exists unless the owner reopens registration.
	if total > 0 && !signupEnabled(db) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Public registration is disabled after bootstrap"})
		return
	}

	q := sqlcdb.New(db.DB)
	existing, err := q.CountUsersByEmail(context.Background(), strings.ToLower(strings.TrimSpace(req.Email)))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}

	if existing > 0 {
		c.JSON(http.StatusConflict, gin.H{"error": "User already exists"})
		return
	}

	// Hash password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to hash password"})
		return
	}

	// First account owns the platform.
	urow, err := q.InsertUserAdmin(context.Background(), sqlcdb.InsertUserAdminParams{
		Email:        req.Email,
		PasswordHash: string(hashedPassword),
		Name:         req.Name,
		IsAdmin:      total == 0,
	})
	user := User{
		ID:        urow.ID.String(),
		Email:     urow.Email,
		Name:      urow.Name,
		AvatarURL: urow.AvatarUrl,
		IsAdmin:   urow.IsAdmin,
		CreatedAt: urow.CreatedAt.Time.String(),
	}

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create user"})
		return
	}

	// Generate JWT token
	token, err := generateJWT(user.ID, user.Email, jwtSecret)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token"})
		return
	}

	c.JSON(http.StatusCreated, AuthResponse{
		Token: token,
		User:  user,
	})
}

func handleCreateUser(c *gin.Context) {
	db, ok := requireAdmin(c)
	if !ok {
		return
	}

	var req ManualUserCreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	req.Email = strings.ToLower(strings.TrimSpace(req.Email))
	req.Name = strings.TrimSpace(req.Name)
	if req.Email == "" || req.Name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Email and name are required"})
		return
	}

	existing, err := sqlcdb.New(db.DB).CountUsersByEmail(context.Background(), req.Email)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}
	if existing > 0 {
		c.JSON(http.StatusConflict, gin.H{"error": "User already exists"})
		return
	}

	if err := createBetterAuthUser(c, req.Name, req.Email, req.Password); err != nil {
		status := http.StatusInternalServerError
		if errors.Is(err, errBetterAuthUserExists) {
			status = http.StatusConflict
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to hash password"})
		return
	}

	urow, err := sqlcdb.New(db.DB).InsertUser(context.Background(), sqlcdb.InsertUserParams{
		Email:        req.Email,
		PasswordHash: string(hashedPassword),
		Name:         req.Name,
	})
	user := User{
		ID:        urow.ID.String(),
		Email:     urow.Email,
		Name:      urow.Name,
		AvatarURL: urow.AvatarUrl,
		IsAdmin:   urow.IsAdmin,
		CreatedAt: urow.CreatedAt.Time.String(),
	}
	if err != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "User already exists"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"user": user})
}

var errBetterAuthUserExists = errors.New("User already exists")

func createBetterAuthUser(c *gin.Context, name string, email string, password string) error {
	endpoint, err := betterAuthSignUpURL()
	if err != nil {
		return err
	}

	body, err := json.Marshal(gin.H{
		"name":     name,
		"email":    email,
		"password": password,
	})
	if err != nil {
		return err
	}

	request, err := http.NewRequestWithContext(c.Request.Context(), http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return err
	}
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Accept", "application/json")
	if token := strings.TrimSpace(os.Getenv("BETTER_AUTH_INTERNAL_TOKEN")); token != "" {
		request.Header.Set("X-Containr-Auth-Internal", token)
	}

	response, err := (&http.Client{Timeout: 5 * time.Second}).Do(request)
	if err != nil {
		return err
	}
	defer response.Body.Close()

	if response.StatusCode >= http.StatusOK && response.StatusCode < http.StatusMultipleChoices {
		return nil
	}

	var payload map[string]interface{}
	_ = json.NewDecoder(response.Body).Decode(&payload)
	message := "Failed to create auth user"
	if rawMessage, ok := payload["message"].(string); ok && strings.TrimSpace(rawMessage) != "" {
		message = rawMessage
	} else if rawError, ok := payload["error"].(string); ok && strings.TrimSpace(rawError) != "" {
		message = rawError
	}

	if response.StatusCode == http.StatusConflict || strings.Contains(strings.ToLower(message), "already") {
		return errBetterAuthUserExists
	}

	return errors.New(message)
}

func countLocalUsers(db *database.DB) (int, error) {
	count64, err := sqlcdb.New(db.DB).CountUsers(context.Background())
	if err != nil {
		return 0, err
	}
	count := int(count64)
	// Better Auth writes to auth_users; a row there only mirrors into users on
	// the first authenticated call. Count it too or a second public sign-up
	// slips through the bootstrap window. UNION by email avoids double-counting
	// mirrored users.
	var authTable *string
	if err := db.QueryRow("SELECT to_regclass('auth_users')").Scan(&authTable); err != nil {
		return 0, err
	}
	if authTable != nil && *authTable != "" {
		if err := db.QueryRow(`
			SELECT COUNT(*) FROM (
				SELECT email FROM users
				UNION
				SELECT email FROM auth_users
			) u
		`).Scan(&count); err != nil {
			return 0, err
		}
	}
	return count, nil
}

func handleGetProfile(c *gin.Context) {
	userID := c.MustGet("user_id").(string)
	db := c.MustGet("db").(*database.DB)

	var user User
	urow, err := sqlcdb.New(db.DB).GetUserByID(context.Background(), uuid.MustParse(userID))
	user = User{
		ID:        urow.ID.String(),
		Email:     urow.Email,
		Name:      urow.Name,
		AvatarURL: urow.AvatarUrl,
		IsAdmin:   urow.IsAdmin,
		CreatedAt: urow.CreatedAt.Time.String(),
	}

	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	} else if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}

	c.JSON(http.StatusOK, user)
}

func handleUpdateProfile(c *gin.Context) {
	userID := c.MustGet("user_id").(string)
	db := c.MustGet("db").(*database.DB)

	var req struct {
		Name      string `json:"name,omitempty"`
		AvatarURL string `json:"avatar_url,omitempty"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Update user profile
	err := sqlcdb.New(db.DB).UpdateUserProfile(context.Background(), sqlcdb.UpdateUserProfileParams{
		Column1: req.Name,
		Column2: req.AvatarURL,
		ID:      uuid.MustParse(userID),
	})

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update profile"})
		return
	}

	// Return updated user
	handleGetProfile(c)
}

func generateJWT(userID, email, secret string) (string, error) {
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"user_id": userID,
		"email":   email,
		"exp":     time.Now().Add(time.Hour * 24 * 7).Unix(), // 7 days
	})

	return token.SignedString([]byte(secret))
}

// generateImpersonationJWT mints a short-lived token acting as `userID`,
// tagged with the admin who minted it so downstream callers can attribute
// actions taken while impersonating.
func generateImpersonationJWT(userID, email, actorID, secret string, expiresAt time.Time) (string, error) {
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"user_id":         userID,
		"email":           email,
		"impersonated_by": actorID,
		"exp":             expiresAt.Unix(),
	})
	return token.SignedString([]byte(secret))
}

// ValidateJWT validates a JWT token and returns the claims
func ValidateJWT(tokenString, secret string) (jwt.MapClaims, error) {
	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, jwt.ErrSignatureInvalid
		}
		return []byte(secret), nil
	})

	if err != nil {
		return nil, err
	}

	if claims, ok := token.Claims.(jwt.MapClaims); ok && token.Valid {
		return claims, nil
	}

	return nil, jwt.ErrInvalidKey
}
