package middleware

import (
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

// RateLimiter implements a token bucket rate limiter
type RateLimiter struct {
	mu       sync.RWMutex
	buckets  map[string]*bucket
	rate     int           // requests per window
	window   time.Duration // time window
	cleanupInterval time.Duration
}

type bucket struct {
	tokens    int
	lastReset time.Time
	mu        sync.Mutex
}

// NewRateLimiter creates a new rate limiter
func NewRateLimiter(rate int, window time.Duration) *RateLimiter {
	rl := &RateLimiter{
		buckets:  make(map[string]*bucket),
		rate:     rate,
		window:   window,
		cleanupInterval: window * 2,
	}
	
	// Start cleanup goroutine
	go rl.cleanup()
	
	return rl
}

// Allow checks if a request should be allowed
func (rl *RateLimiter) Allow(key string) bool {
	rl.mu.RLock()
	b, exists := rl.buckets[key]
	rl.mu.RUnlock()

	if !exists {
		rl.mu.Lock()
		b = &bucket{
			tokens:    rl.rate,
			lastReset: time.Now(),
		}
		rl.buckets[key] = b
		rl.mu.Unlock()
	}

	b.mu.Lock()
	defer b.mu.Unlock()

	// Reset bucket if window has passed
	if time.Since(b.lastReset) > rl.window {
		b.tokens = rl.rate
		b.lastReset = time.Now()
	}

	if b.tokens > 0 {
		b.tokens--
		return true
	}

	return false
}

// cleanup removes old buckets
func (rl *RateLimiter) cleanup() {
	ticker := time.NewTicker(rl.cleanupInterval)
	defer ticker.Stop()

	for range ticker.C {
		rl.mu.Lock()
		now := time.Now()
		for key, b := range rl.buckets {
			b.mu.Lock()
			if now.Sub(b.lastReset) > rl.cleanupInterval {
				delete(rl.buckets, key)
			}
			b.mu.Unlock()
		}
		rl.mu.Unlock()
	}
}

// RateLimit returns a middleware that limits requests
func RateLimit(rate int, window time.Duration) gin.HandlerFunc {
	limiter := NewRateLimiter(rate, window)

	return func(c *gin.Context) {
		// Use IP address as key
		key := c.ClientIP()

		// For authenticated requests, use user ID if available
		if userID, exists := c.Get("user_id"); exists {
			if uid, ok := userID.(string); ok && uid != "" {
				key = "user:" + uid
			}
		}

		if !limiter.Allow(key) {
			c.JSON(http.StatusTooManyRequests, gin.H{
				"error": "rate_limit_exceeded",
				"message": "Too many requests. Please try again later.",
			})
			c.Abort()
			return
		}

		c.Next()
	}
}

// RateLimitByIP limits requests by IP address
func RateLimitByIP(rate int, window time.Duration) gin.HandlerFunc {
	limiter := NewRateLimiter(rate, window)

	return func(c *gin.Context) {
		if !limiter.Allow(c.ClientIP()) {
			c.JSON(http.StatusTooManyRequests, gin.H{
				"error": "rate_limit_exceeded",
				"message": "Too many requests from your IP. Please try again later.",
			})
			c.Abort()
			return
		}

		c.Next()
	}
}

// RateLimitByUser limits requests by authenticated user
func RateLimitByUser(rate int, window time.Duration) gin.HandlerFunc {
	limiter := NewRateLimiter(rate, window)

	return func(c *gin.Context) {
		userID, exists := c.Get("user_id")
		if !exists {
			c.Next()
			return
		}

		uid, ok := userID.(string)
		if !ok || uid == "" {
			c.Next()
			return
		}

		if !limiter.Allow("user:" + uid) {
			c.JSON(http.StatusTooManyRequests, gin.H{
				"error": "rate_limit_exceeded",
				"message": "Too many requests. Please slow down.",
			})
			c.Abort()
			return
		}

		c.Next()
	}
}
