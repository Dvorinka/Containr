package middleware

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"time"

	"containr/internal/database"

	"github.com/gin-gonic/gin"
	"github.com/go-redis/redis/v8"
)

// Idempotency replays POST responses for a repeated Idempotency-Key header
// so agents can safely retry mutations. The first request wins; concurrent
// duplicates get 409 IDEMPOTENCY_IN_PROGRESS; completed responses replay
// verbatim for 24h. Keys are scoped to the authenticated identity.
func Idempotency() gin.HandlerFunc {
	return func(c *gin.Context) {
		if c.Request.Method != http.MethodPost {
			c.Next()
			return
		}
		key := c.GetHeader("Idempotency-Key")
		if key == "" || len(key) > 128 {
			c.Next()
			return
		}
		dbValue, exists := c.Get("redis")
		if !exists {
			c.Next()
			return
		}
		rdb, ok := dbValue.(*database.Redis)
		if !ok || rdb == nil || rdb.Client == nil {
			c.Next()
			return
		}

		// Scope by caller identity so a stolen key can't replay across users.
		actor := c.GetString("user_id")
		if actor == "" {
			actor = c.GetHeader("Authorization")
		}
		sum := sha256.Sum256([]byte(actor + ":" + c.Request.URL.Path + ":" + key))
		redisKey := "idem:" + hex.EncodeToString(sum[:16])

		ctx, cancel := context.WithTimeout(c.Request.Context(), 3*time.Second)
		defer cancel()

		stored, err := rdb.Client.Get(ctx, redisKey).Result()
		switch {
		case err == nil:
			if stored == "processing" {
				c.JSON(http.StatusConflict, gin.H{
					"error": "a request with this idempotency key is still in progress",
					"code":  "IDEMPOTENCY_IN_PROGRESS",
				})
				c.Abort()
				return
			}
			var rec idemRecord
			if json.Unmarshal([]byte(stored), &rec) == nil {
				c.Header("X-Idempotent-Replay", "true")
				c.Data(rec.Status, rec.ContentType, rec.Body)
				c.Abort()
				return
			}
		case err != redis.Nil:
			// Redis hiccup — degrade to pass-through rather than failing the request.
			c.Next()
			return
		}

		// Claim the key for the duration of the request.
		if set, serr := rdb.Client.SetNX(ctx, redisKey, "processing", 2*time.Minute).Result(); serr != nil || !set {
			c.JSON(http.StatusConflict, gin.H{
				"error": "a request with this idempotency key is still in progress",
				"code":  "IDEMPOTENCY_IN_PROGRESS",
			})
			c.Abort()
			return
		}

		recorder := &responseRecorder{ResponseWriter: c.Writer, status: http.StatusOK, body: &bytes.Buffer{}}
		c.Writer = recorder
		c.Next()

		// Cache terminal responses only — 5xx is retryable and must not be replayed.
		if recorder.status < 500 && recorder.body.Len() <= 1<<20 {
			rec := idemRecord{
				Status:      recorder.status,
				ContentType: recorder.Header().Get("Content-Type"),
				Body:        recorder.body.Bytes(),
			}
			if rec.ContentType == "" {
				rec.ContentType = "application/json; charset=utf-8"
			}
			if raw, merr := json.Marshal(rec); merr == nil {
				_ = rdb.Client.Set(context.Background(), redisKey, raw, 24*time.Hour).Err()
			}
		} else {
			_ = rdb.Client.Del(context.Background(), redisKey).Err()
		}
	}
}

type idemRecord struct {
	Status      int    `json:"s"`
	ContentType string `json:"ct"`
	Body        []byte `json:"b"`
}

type responseRecorder struct {
	gin.ResponseWriter
	status int
	body   *bytes.Buffer
}

func (r *responseRecorder) WriteHeader(code int) {
	r.status = code
	r.ResponseWriter.WriteHeader(code)
}

func (r *responseRecorder) Write(b []byte) (int, error) {
	r.body.Write(b)
	return r.ResponseWriter.Write(b)
}
