package middleware

import (
	"containr/internal/database"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

// Logger middleware
func Logger() gin.HandlerFunc {
	return gin.LoggerWithFormatter(func(param gin.LogFormatterParams) string {
		return fmt.Sprintf("%s - [%s] \"%s %s %s %d %s \"%s\" %s\"\n",
			param.ClientIP,
			param.TimeStamp.Format(time.RFC1123),
			param.Method,
			param.Path,
			param.Request.Proto,
			param.StatusCode,
			param.Latency,
			param.Request.UserAgent(),
			param.ErrorMessage,
		)
	})
}

// Recovery middleware
func Recovery() gin.HandlerFunc {
	return gin.Recovery()
}

// SecurityHeaders adds secure default HTTP response headers.
func SecurityHeaders() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("X-Content-Type-Options", "nosniff")
		c.Header("X-Frame-Options", "DENY")
		c.Header("Referrer-Policy", "strict-origin-when-cross-origin")
		c.Header("X-XSS-Protection", "1; mode=block")

		if strings.EqualFold(c.Request.Header.Get("X-Forwarded-Proto"), "https") || c.Request.TLS != nil {
			c.Header("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
		}

		c.Next()
	}
}

// RequestID middleware adds a unique request ID to each request
func RequestID() gin.HandlerFunc {
	return func(c *gin.Context) {
		requestID := c.GetHeader("X-Request-ID")
		if requestID == "" {
			requestID = uuid.New().String()
		}
		c.Set("request_id", requestID)
		c.Header("X-Request-ID", requestID)
		c.Next()
	}
}

// Auth middleware for JWT authentication
func Auth(jwtSecret string) gin.HandlerFunc {
	sessionVerifier := newBetterAuthSessionVerifier()

	return func(c *gin.Context) {
		tokenString, tokenErr, hasToken := extractJWTToken(c)
		if tokenString != "" {
			if claims, valid := validateJWTClaims(tokenString, jwtSecret); valid {
				userIDClaim, exists := claims["user_id"]
				if exists {
					userID := strings.TrimSpace(fmt.Sprint(userIDClaim))
					if _, err := uuid.Parse(userID); err == nil {
						email := ""
						if emailClaim, ok := claims["email"]; ok && emailClaim != nil {
							email = strings.TrimSpace(fmt.Sprint(emailClaim))
						}
						c.Set("user_id", userID)
						c.Set("email", email)
						c.Next()
						return
					}
				}
				tokenErr = "Invalid token claims"
			} else if tokenErr == "" {
				tokenErr = "Invalid token"
			}
		}

		if sessionVerifier != nil {
			if userID, email, ok := sessionVerifier.resolveUser(c); ok {
				c.Set("user_id", userID)
				c.Set("email", email)
				c.Next()
				return
			}
		}

		if tokenErr != "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": tokenErr})
			c.Abort()
			return
		}

		if hasToken {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token"})
		} else {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		}
		c.Abort()
	}
}

type betterAuthSessionVerifier struct {
	internalURL   string
	internalToken string
	client        *http.Client
}

type betterAuthSessionUser struct {
	ID    string `json:"id"`
	Email string `json:"email"`
	Name  string `json:"name"`
	Image string `json:"image"`
}

type betterAuthSessionResponse struct {
	Authenticated bool                  `json:"authenticated"`
	User          betterAuthSessionUser `json:"user"`
}

func newBetterAuthSessionVerifier() *betterAuthSessionVerifier {
	internalURL := strings.TrimSpace(os.Getenv("BETTER_AUTH_INTERNAL_URL"))
	if internalURL == "" {
		internalURL = "http://127.0.0.1:3001/internal/session"
	}
	internalToken := strings.TrimSpace(os.Getenv("BETTER_AUTH_INTERNAL_TOKEN"))

	if internalToken == "" {
		return nil
	}

	return &betterAuthSessionVerifier{
		internalURL:   internalURL,
		internalToken: internalToken,
		client: &http.Client{
			Timeout: 3 * time.Second,
		},
	}
}

func (v *betterAuthSessionVerifier) resolveUser(c *gin.Context) (string, string, bool) {
	request, err := http.NewRequestWithContext(c.Request.Context(), http.MethodGet, v.internalURL, nil)
	if err != nil {
		return "", "", false
	}

	request.Header.Set("X-Containr-Auth-Internal", v.internalToken)
	copyHeaderIfPresent(c.Request, request, "Cookie")
	copyHeaderIfPresent(c.Request, request, "User-Agent")
	copyHeaderIfPresent(c.Request, request, "X-Forwarded-For")
	copyHeaderIfPresent(c.Request, request, "X-Forwarded-Proto")

	response, err := v.client.Do(request)
	if err != nil {
		return "", "", false
	}
	defer response.Body.Close()

	if response.StatusCode != http.StatusOK {
		return "", "", false
	}

	var payload betterAuthSessionResponse
	if err := json.NewDecoder(response.Body).Decode(&payload); err != nil {
		return "", "", false
	}

	if !payload.Authenticated {
		return "", "", false
	}

	email := strings.ToLower(strings.TrimSpace(payload.User.Email))
	if email == "" {
		return "", "", false
	}

	localUserID, err := ensureLocalUserRecord(c, payload.User)
	if err != nil {
		log.Printf("Failed to map Better Auth user to local user: %v", err)
		return "", "", false
	}

	return localUserID, email, true
}

func ensureLocalUserRecord(c *gin.Context, user betterAuthSessionUser) (string, error) {
	dbValue, ok := c.Get("db")
	if !ok || dbValue == nil {
		return "", fmt.Errorf("database context missing")
	}

	db, ok := dbValue.(*database.DB)
	if !ok || db == nil {
		return "", fmt.Errorf("invalid database context")
	}

	email := strings.ToLower(strings.TrimSpace(user.Email))
	if email == "" {
		return "", fmt.Errorf("email is required")
	}

	name := strings.TrimSpace(user.Name)
	if name == "" {
		name = "Containr User"
	}

	avatarURL := strings.TrimSpace(user.Image)

	var localUserID string
	err := db.QueryRow(`SELECT id FROM users WHERE email = $1`, email).Scan(&localUserID)
	switch {
	case err == nil:
		_, _ = db.Exec(`
			UPDATE users
			SET name = $1,
			    avatar_url = CASE WHEN $2 = '' THEN avatar_url ELSE $2 END,
			    updated_at = NOW()
			WHERE id = $3
		`, name, avatarURL, localUserID)
		return localUserID, nil
	case !errors.Is(err, sql.ErrNoRows):
		return "", err
	}

	hashedPassword, hashErr := bcrypt.GenerateFromPassword([]byte(uuid.NewString()), bcrypt.DefaultCost)
	if hashErr != nil {
		return "", hashErr
	}

	if err := db.QueryRow(`
		INSERT INTO users (email, password_hash, name, avatar_url)
		VALUES ($1, $2, $3, NULLIF($4, ''))
		RETURNING id
	`, email, string(hashedPassword), name, avatarURL).Scan(&localUserID); err != nil {
		return "", err
	}

	return localUserID, nil
}

func validateJWTClaims(tokenString, jwtSecret string) (jwt.MapClaims, bool) {
	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return []byte(jwtSecret), nil
	})

	if err != nil {
		return nil, false
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok || !token.Valid {
		return nil, false
	}

	return claims, true
}

func extractJWTToken(c *gin.Context) (string, string, bool) {
	authHeader := strings.TrimSpace(c.GetHeader("Authorization"))
	if authHeader != "" {
		parts := strings.Fields(authHeader)
		if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
			return "", "Invalid authorization header format", true
		}
		return strings.TrimSpace(parts[1]), "", true
	}

	if strings.EqualFold(c.GetHeader("Upgrade"), "websocket") {
		token := strings.TrimSpace(c.Query("token"))
		if token == "" {
			return "", "", false
		}
		return token, "", true
	}

	return "", "", false
}

func copyHeaderIfPresent(src *http.Request, dst *http.Request, key string) {
	value := strings.TrimSpace(src.Header.Get(key))
	if value != "" {
		dst.Header.Set(key, value)
	}
}

// ErrorHandler middleware for consistent error handling
func ErrorHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Next()

		// Check if there are any errors
		if len(c.Errors) > 0 {
			err := c.Errors.Last()
			log.Printf("Request error: %v", err)

			// Return JSON error response
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "Internal server error",
				"code":  "INTERNAL_ERROR",
			})
		}
	}
}

// CORSMiddleware for CORS handling
func CORSMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", "*")
		c.Header("Access-Control-Allow-Credentials", "true")
		c.Header("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With")
		c.Header("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT, DELETE")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	}
}

// RequestBodyLimit enforces a maximum HTTP request body size.
func RequestBodyLimit(maxBytes int64) gin.HandlerFunc {
	return func(c *gin.Context) {
		if maxBytes <= 0 {
			c.Next()
			return
		}

		if c.Request.ContentLength > maxBytes {
			c.AbortWithStatusJSON(http.StatusRequestEntityTooLarge, gin.H{
				"error": "Request body too large",
			})
			return
		}

		if c.Request.Body != nil {
			c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxBytes)
		}

		c.Next()
	}
}
