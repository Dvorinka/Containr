package api

// Data plane for the public API gateway: /g/:slug/* proxies to the
// upstream_url of the matching api_services row. Callers authenticate with
// api_keys (X-API-Key or Authorization: Bearer), pass the rpm + monthly
// quota gates, and every request lands in usage_counters /
// metrics_timeseries / incident_events for the /admin/gateway analytics
// surfaces.

import (
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"strings"
	"sync"
	"time"

	"containr/internal/database"
	"containr/internal/database/sqlcdb"
	"containr/internal/gateway"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

// jarvis: ceiling — a single shared transport; per-request timeouts come
// from api_services.request_timeout_ms on the request context.
var gatewayHTTPClient = &http.Client{
	Transport: &http.Transport{
		MaxIdleConns:        100,
		MaxIdleConnsPerHost: 10,
		IdleConnTimeout:     90 * time.Second,
	},
}

// gatewayRPM is a process-local per-minute counter map. Containr runs a
// single API process, so an in-memory bucket is sufficient — a multi-node
// control plane would need a Redis-backed limiter instead.
var gatewayRPM = struct {
	sync.Mutex
	buckets map[string]*rpmBucket
}{buckets: map[string]*rpmBucket{}}

type rpmBucket struct {
	window time.Time
	count  int
}

// gatewayRateAllow returns false when the bucket for the current minute has
// already reached limit. A limit <= 0 disables the check. `now` is injected
// so tests can freeze the window.
func gatewayRateAllow(bucketKey string, limit int, now time.Time) bool {
	if limit <= 0 {
		return true
	}
	window := now.Truncate(time.Minute)
	gatewayRPM.Lock()
	defer gatewayRPM.Unlock()
	b := gatewayRPM.buckets[bucketKey]
	if b == nil || !b.window.Equal(window) {
		b = &rpmBucket{window: window}
		gatewayRPM.buckets[bucketKey] = b
		// Best-effort sweep so the map cannot grow without bound.
		for k, old := range gatewayRPM.buckets {
			if old.window.Before(window.Add(-time.Minute)) {
				delete(gatewayRPM.buckets, k)
			}
		}
	}
	b.count++
	return b.count <= limit
}

type gatewayService struct {
	ID                 string
	UpstreamURL        string
	RoutePrefix        string
	UpstreamAuthHeader sql.NullString
	UpstreamAuthValue  sql.NullString
	Enabled            bool
	RPMLimit           sql.NullInt64
	MonthlyQuota       sql.NullInt64
	RequestTimeoutMS   int
}

type gatewayKey struct {
	ID                string
	Hash              string
	Enabled           bool
	RPMLimit          sql.NullInt64
	MonthlyQuota      sql.NullInt64
	AllowedServiceIDs string
}

// extractGatewayKey reads the caller's API key from X-API-Key first, then
// Authorization: Bearer.
func extractGatewayKey(c *gin.Context) string {
	if k := strings.TrimSpace(c.GetHeader("X-API-Key")); k != "" {
		return k
	}
	auth := strings.TrimSpace(c.GetHeader("Authorization"))
	if len(auth) > 7 && strings.EqualFold(auth[:7], "Bearer ") {
		return strings.TrimSpace(auth[7:])
	}
	return ""
}

// lookupGatewayService resolves the slug to an enabled service row.
func lookupGatewayService(ctx context.Context, db *database.DB, slug string) (*gatewayService, error) {
	r, err := sqlcdb.New(db.DB).GetAPServiceBySlug(ctx, slug)
	if err != nil {
		return nil, err
	}
	s := gatewayService{
		ID:                 r.ID.String(),
		UpstreamURL:        r.UpstreamUrl,
		RoutePrefix:        r.RoutePrefix,
		UpstreamAuthHeader: r.UpstreamAuthHeader,
		UpstreamAuthValue:  r.UpstreamAuthValue,
		Enabled:            r.Enabled != 0,
		RPMLimit:           nullInt32To64(r.RpmLimit),
		MonthlyQuota:       nullInt32To64(r.MonthlyQuota),
		RequestTimeoutMS:   int(r.RequestTimeoutMs.Int32),
	}
	return &s, nil
}

func nullInt32To64(v sql.NullInt32) sql.NullInt64 {
	return sql.NullInt64{Int64: int64(v.Int32), Valid: v.Valid}
}

// authenticateGatewayKey resolves a presented key by its indexed prefix and
// bcrypt-verifies candidates. Returns nil when nothing matches.
func authenticateGatewayKey(ctx context.Context, db *database.DB, presented string) (*gatewayKey, error) {
	prefix := presented
	if len(prefix) > 8 {
		prefix = prefix[:8]
	}
	rows, err := sqlcdb.New(db.DB).ListAPKeysByPrefix(ctx, prefix)
	if err != nil {
		return nil, err
	}
	for _, r := range rows {
		k := gatewayKey{
			ID:                r.ID.String(),
			Hash:              r.KeyHash,
			Enabled:           r.Enabled != 0,
			RPMLimit:          nullInt32To64(r.RpmLimit),
			MonthlyQuota:      nullInt32To64(r.MonthlyQuota),
			AllowedServiceIDs: r.AllowedServiceIds,
		}
		if bcrypt.CompareHashAndPassword([]byte(k.Hash), []byte(presented)) == nil {
			return &k, nil
		}
	}
	return nil, nil
}

// keyAllowsService applies the allowed_service_ids JSON allowlist. An empty
// list means the key may call every service.
func keyAllowsService(k *gatewayKey, serviceID string) bool {
	var allowed []string
	if err := json.Unmarshal([]byte(k.AllowedServiceIDs), &allowed); err != nil || len(allowed) == 0 {
		return true
	}
	for _, id := range allowed {
		if id == serviceID {
			return true
		}
	}
	return false
}

// monthlyKeyUsage / monthlyServiceUsage sum a counter dimension for the
// current calendar month.
func monthlyKeyUsage(ctx context.Context, db *database.DB, id, period string) (int64, error) {
	keyUUID, _ := uuid.Parse(id)
	return sqlcdb.New(db.DB).SumUsageByKey(ctx, sqlcdb.SumUsageByKeyParams{
		ApiKeyID: keyUUID, PeriodMonth: period,
	})
}

func monthlyServiceUsage(ctx context.Context, db *database.DB, id, period string) (int64, error) {
	svcUUID, _ := uuid.Parse(id)
	return sqlcdb.New(db.DB).SumUsageByService(ctx, sqlcdb.SumUsageByServiceParams{
		ServiceID: svcUUID, PeriodMonth: period,
	})
}

// recordGatewayRequest persists usage, metrics, and failure incidents for a
// proxied call. Runs in the request path but is three small writes.
func recordGatewayRequest(ctx context.Context, db *database.DB, svc *gatewayService, k *gatewayKey, status int, period string) {
	q := sqlcdb.New(db.DB)
	keyUUID, _ := uuid.Parse(k.ID)
	svcUUID, _ := uuid.Parse(svc.ID)
	_ = q.UpsertUsageCounter(ctx, sqlcdb.UpsertUsageCounterParams{
		ApiKeyID: keyUUID, ServiceID: svcUUID, PeriodMonth: period,
	})
	_ = q.TouchAPKeyLastUsed(ctx, keyUUID)
	labels, _ := json.Marshal(map[string]interface{}{
		"service_id": svc.ID,
		"key_id":     k.ID,
		"status":     status,
	})
	_ = q.InsertMetricPoint(ctx, sql.NullString{String: string(labels), Valid: true})
}

func recordGatewayIncident(ctx context.Context, db *database.DB, svcID string, keyID *string, code, msg, severity string, status int) {
	var kid uuid.NullUUID
	if keyID != nil {
		if u, err := uuid.Parse(*keyID); err == nil {
			kid = uuid.NullUUID{UUID: u, Valid: true}
		}
	}
	svcUUID, _ := uuid.Parse(svcID)
	_ = sqlcdb.New(db.DB).InsertGatewayIncident(ctx, sqlcdb.InsertGatewayIncidentParams{
		ServiceID:  uuid.NullUUID{UUID: svcUUID, Valid: svcUUID != uuid.Nil},
		ApiKeyID:   kid,
		Code:       code,
		Message:    msg,
		Severity:   severity,
		HttpStatus: sql.NullInt32{Int32: int32(status), Valid: true},
	})
}

// handleGatewayProxy is mounted at /g/:slug and /g/:slug/*path on the root
// router — outside /api/v1 so route_prefix stays clean.
func handleGatewayProxy(c *gin.Context) {
	db := c.MustGet("db").(*database.DB)
	ctx := c.Request.Context()
	slug := c.Param("slug")

	svc, err := lookupGatewayService(ctx, db, slug)
	if err == sql.ErrNoRows {
		respondError(c, http.StatusNotFound, "SERVICE_NOT_FOUND", "Gateway service not found")
		return
	}
	if err != nil {
		respondError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to resolve gateway service")
		return
	}
	if !svc.Enabled {
		respondError(c, http.StatusServiceUnavailable, "SERVICE_DISABLED", "Gateway service is disabled")
		return
	}

	presented := extractGatewayKey(c)
	if presented == "" {
		recordGatewayIncident(ctx, db, svc.ID, nil, "MISSING_API_KEY", "Request without API key", "low", http.StatusUnauthorized)
		respondError(c, http.StatusUnauthorized, "API_KEY_REQUIRED", "An API key is required for this service")
		return
	}
	key, err := authenticateGatewayKey(ctx, db, presented)
	if err != nil {
		respondError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to authenticate API key")
		return
	}
	// Disabled and unknown keys collapse to the same 401 — a disabled key
	// must not leak its existence.
	if key == nil || !key.Enabled {
		recordGatewayIncident(ctx, db, svc.ID, nil, "INVALID_API_KEY", "Request with invalid or disabled API key", "low", http.StatusUnauthorized)
		respondError(c, http.StatusUnauthorized, "INVALID_API_KEY", "Invalid API key")
		return
	}
	if !keyAllowsService(key, svc.ID) {
		recordGatewayIncident(ctx, db, svc.ID, &key.ID, "KEY_SCOPE_DENIED", "API key not allowed on this service", "medium", http.StatusForbidden)
		respondError(c, http.StatusForbidden, "KEY_SCOPE_DENIED", "API key is not permitted for this service")
		return
	}

	now := time.Now()
	if !gatewayRateAllow("key:"+key.ID, int(key.RPMLimit.Int64), now) ||
		!gatewayRateAllow("svc:"+svc.ID, int(svc.RPMLimit.Int64), now) {
		recordGatewayIncident(ctx, db, svc.ID, &key.ID, "RATE_LIMITED", "Per-minute rate limit exceeded", "medium", http.StatusTooManyRequests)
		respondError(c, http.StatusTooManyRequests, "RATE_LIMITED", "Rate limit exceeded")
		return
	}

	period := now.Format("2006-01")
	if key.MonthlyQuota.Valid && key.MonthlyQuota.Int64 > 0 {
		if used, err := monthlyKeyUsage(ctx, db, key.ID, period); err == nil && used >= key.MonthlyQuota.Int64 {
			respondError(c, http.StatusTooManyRequests, "QUOTA_EXCEEDED", "Monthly request quota exceeded")
			return
		}
	}
	if svc.MonthlyQuota.Valid && svc.MonthlyQuota.Int64 > 0 {
		if used, err := monthlyServiceUsage(ctx, db, svc.ID, period); err == nil && used >= svc.MonthlyQuota.Int64 {
			respondError(c, http.StatusTooManyRequests, "QUOTA_EXCEEDED", "Service monthly quota exceeded")
			return
		}
	}

	target, err := gateway.BuildTargetURL(svc.UpstreamURL, svc.RoutePrefix, c.Request.URL.Path, c.Request.URL.RawQuery)
	if err != nil {
		respondError(c, http.StatusBadGateway, "UPSTREAM_URL_INVALID", "Gateway upstream is misconfigured")
		return
	}
	headers := map[string]string{}
	if svc.UpstreamAuthHeader.Valid && svc.UpstreamAuthHeader.String != "" {
		headers[svc.UpstreamAuthHeader.String] = svc.UpstreamAuthValue.String
	}

	timeout := time.Duration(svc.RequestTimeoutMS) * time.Millisecond
	if timeout <= 0 {
		timeout = 8 * time.Second
	}
	reqCtx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	status, _, err := gateway.ProxyRequest(gatewayHTTPClient, c.Writer, c.Request.WithContext(reqCtx), target, headers)
	if err != nil {
		recordGatewayIncident(reqCtx, db, svc.ID, &key.ID, "UPSTREAM_ERROR", err.Error(), "high", http.StatusBadGateway)
		recordGatewayRequest(ctx, db, svc, key, http.StatusBadGateway, period)
		respondError(c, http.StatusBadGateway, "UPSTREAM_ERROR", "Upstream request failed")
		return
	}

	recordGatewayRequest(ctx, db, svc, key, status, period)
	if status >= 500 {
		recordGatewayIncident(ctx, db, svc.ID, &key.ID, "UPSTREAM_5XX", "Upstream returned "+http.StatusText(status), "high", status)
	}
}
