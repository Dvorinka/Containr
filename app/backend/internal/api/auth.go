package api

import (
	"bytes"
	"containr/internal/database"
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
	err := db.QueryRow(`
		SELECT id, email, password_hash, name, COALESCE(avatar_url, ''), created_at 
		FROM users 
		WHERE email = $1
	`, req.Email).Scan(&user.ID, &user.Email, &hashedPassword, &user.Name, &user.AvatarURL, &user.CreatedAt)

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

	c.JSON(http.StatusOK, gin.H{
		"has_users":  count > 0,
		"user_count": count,
		"mode":       mode,
	})
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

	var user User
	err = db.QueryRow(`
		INSERT INTO users (email, password_hash, name, avatar_url)
		VALUES ($1, $2, $3, NULLIF($4, ''))
		ON CONFLICT (email) DO UPDATE
		SET name = EXCLUDED.name,
		    avatar_url = COALESCE(EXCLUDED.avatar_url, users.avatar_url),
		    updated_at = NOW()
		RETURNING id, email, name, COALESCE(avatar_url, ''), created_at
	`, email, string(hashedPassword), name, strings.TrimSpace(authUser.Image)).
		Scan(&user.ID, &user.Email, &user.Name, &user.AvatarURL, &user.CreatedAt)
	if err != nil {
		return User{}, err
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

	var count int
	err := db.QueryRow("SELECT COUNT(*) FROM users").Scan(&count)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}

	if count > 0 {
		c.JSON(http.StatusForbidden, gin.H{"error": "Public registration is disabled after bootstrap"})
		return
	}

	err = db.QueryRow("SELECT COUNT(*) FROM users WHERE email = $1", strings.ToLower(strings.TrimSpace(req.Email))).Scan(&count)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}

	if count > 0 {
		c.JSON(http.StatusConflict, gin.H{"error": "User already exists"})
		return
	}

	// Hash password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to hash password"})
		return
	}

	// Create user
	var user User
	err = db.QueryRow(`
		INSERT INTO users (email, password_hash, name) 
		VALUES ($1, $2, $3) 
		RETURNING id, email, name, COALESCE(avatar_url, ''), created_at
	`, req.Email, string(hashedPassword), req.Name).Scan(&user.ID, &user.Email, &user.Name, &user.AvatarURL, &user.CreatedAt)

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
	var req ManualUserCreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	db := c.MustGet("db").(*database.DB)
	req.Email = strings.ToLower(strings.TrimSpace(req.Email))
	req.Name = strings.TrimSpace(req.Name)
	if req.Email == "" || req.Name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Email and name are required"})
		return
	}

	var existing int
	if err := db.QueryRow("SELECT COUNT(*) FROM users WHERE email = $1", req.Email).Scan(&existing); err != nil {
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

	var user User
	err = db.QueryRow(`
		INSERT INTO users (email, password_hash, name)
		VALUES ($1, $2, $3)
		RETURNING id, email, name, COALESCE(avatar_url, ''), created_at
	`, req.Email, string(hashedPassword), req.Name).Scan(&user.ID, &user.Email, &user.Name, &user.AvatarURL, &user.CreatedAt)
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
	var count int
	if err := db.QueryRow("SELECT COUNT(*) FROM users").Scan(&count); err != nil {
		return 0, err
	}
	return count, nil
}

func handleGetProfile(c *gin.Context) {
	userID := c.MustGet("user_id").(string)
	db := c.MustGet("db").(*database.DB)

	var user User
	err := db.QueryRow(`
		SELECT id, email, name, COALESCE(avatar_url, ''), created_at 
		FROM users 
		WHERE id = $1
	`, userID).Scan(&user.ID, &user.Email, &user.Name, &user.AvatarURL, &user.CreatedAt)

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
	_, err := db.Exec(`
		UPDATE users 
		SET name = COALESCE($1, name), avatar_url = COALESCE($2, avatar_url)
		WHERE id = $3
	`, req.Name, req.AvatarURL, userID)

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
