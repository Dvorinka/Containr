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

// resolveRequestUser authenticates the request via Bearer JWT or the Better
// Auth session cookie. On success it returns the local user id and email.
// tokenErr/hasToken mirror the legacy error contract for Auth.
func resolveRequestUser(c *gin.Context, jwtSecret string, sessionVerifier *betterAuthSessionVerifier) (userID, email, tokenErr string, hasToken, ok bool) {
	tokenString, tokenErr, hasToken := extractJWTToken(c)
	if tokenString != "" {
		if claims, valid := validateJWTClaims(tokenString, jwtSecret); valid {
			userIDClaim, exists := claims["user_id"]
			if exists {
				id := strings.TrimSpace(fmt.Sprint(userIDClaim))
				if _, err := uuid.Parse(id); err == nil {
					if emailClaim, exists := claims["email"]; exists && emailClaim != nil {
						email = strings.TrimSpace(fmt.Sprint(emailClaim))
					}
					return id, email, "", hasToken, true
				}
			}
			tokenErr = "Invalid token claims"
		} else if tokenErr == "" {
			tokenErr = "Invalid token"
		}
	}

	if sessionVerifier != nil {
		if id, mail, verified := sessionVerifier.resolveUser(c); verified {
			return id, mail, "", hasToken, true
		}
	}

	return "", "", tokenErr, hasToken, false
}

// setAuthenticatedContext stores the resolved identity plus the admin flag on
// the gin context so handlers and RequireAdmin can rely on it.
func setAuthenticatedContext(c *gin.Context, userID, email string) {
	c.Set("user_id", userID)
	c.Set("email", email)
	c.Set("is_admin", loadIsAdmin(c, userID))
}

func loadIsAdmin(c *gin.Context, userID string) bool {
	dbValue, exists := c.Get("db")
	if !exists {
		return false
	}
	db, ok := dbValue.(*database.DB)
	if !ok || db == nil || db.DB == nil {
		return false
	}
	var isAdmin bool
	if err := db.QueryRow(`SELECT is_admin FROM users WHERE id = $1`, userID).Scan(&isAdmin); err != nil {
		return false
	}
	return isAdmin
}

// Auth middleware for JWT authentication
func Auth(jwtSecret string) gin.HandlerFunc {
	sessionVerifier := newBetterAuthSessionVerifier()

	return func(c *gin.Context) {
		userID, email, tokenErr, hasToken, ok := resolveRequestUser(c, jwtSecret, sessionVerifier)
		if ok {
			setAuthenticatedContext(c, userID, email)
			c.Next()
			return
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

// OptionalAuth resolves identity when a valid credential is present but never
// rejects the request — anonymous callers simply get no user context. Read
// endpoints hang off this so the public site can browse approved resources.
func OptionalAuth(jwtSecret string) gin.HandlerFunc {
	sessionVerifier := newBetterAuthSessionVerifier()

	return func(c *gin.Context) {
		if userID, email, _, _, ok := resolveRequestUser(c, jwtSecret, sessionVerifier); ok {
			setAuthenticatedContext(c, userID, email)
		}
		c.Next()
	}
}

// RequireAdmin rejects requests whose resolved user is not a platform admin.
// Must run after Auth (or OptionalAuth) so user_id/is_admin are populated.
func RequireAdmin() gin.HandlerFunc {
	return func(c *gin.Context) {
		if _, exists := c.Get("user_id"); !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
			c.Abort()
			return
		}
		if !c.GetBool("is_admin") {
			c.JSON(http.StatusForbidden, gin.H{"error": "Admin access required"})
			c.Abort()
			return
		}
		c.Next()
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

	// The first mirrored account owns the platform.
	var userCount int
	if err := db.QueryRow(`SELECT COUNT(*) FROM users`).Scan(&userCount); err != nil {
		return "", err
	}
	isFirstUser := userCount == 0

	if err := db.QueryRow(`
		INSERT INTO users (email, password_hash, name, avatar_url, is_admin)
		VALUES ($1, $2, $3, NULLIF($4, ''), $5)
		RETURNING id
	`, email, string(hashedPassword), name, avatarURL, isFirstUser).Scan(&localUserID); err != nil {
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
