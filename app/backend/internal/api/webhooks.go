package api

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"containr/internal/database"
	"containr/internal/database/sqlcdb"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/sqlc-dev/pqtype"
)

// Outbound webhooks: every audited action (LogAudit) emits an event named
// "resource.action" (e.g. "service.deploy"). Webhooks subscribe with an
// event list supporting "service.*" and "*" wildcards. Deliveries are
// HMAC-signed and retried up to 3 times with backoff; each attempt lands
// in webhook_deliveries.

var (
	webhookQueue   = make(chan webhookJob, 512)
	webhookWorkers sync.Once
)

type webhookJob struct {
	Webhook sqlcdb.OutboundWebhook
	Event   string
	Payload []byte
}

type webhookEventPayload struct {
	Event      string                 `json:"event"`
	Resource   string                 `json:"resource"`
	ResourceID string                 `json:"resource_id"`
	Action     string                 `json:"action"`
	UserID     string                 `json:"user_id,omitempty"`
	Details    map[string]interface{} `json:"details,omitempty"`
	Timestamp  time.Time              `json:"timestamp"`
}

// emitWebhookEvent fans an audited action out to all enabled webhooks whose
// event list matches. Called from LogAudit — fire-and-forget.
func emitWebhookEvent(userID, resource, resourceID, action string, details map[string]interface{}) {
	db := GetAuditDB()
	if db == nil {
		return
	}
	// Actions that already carry a resource prefix ("service.clone") pass
	// through unchanged; bare actions ("create") get resource-qualified.
	event := action
	if !strings.Contains(action, ".") {
		event = resource + "." + action
	}

	queries := sqlcdb.New(db.DB)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	hooks, err := queries.ListEnabledOutboundWebhooks(ctx)
	if err != nil || len(hooks) == 0 {
		return
	}

	payload, err := json.Marshal(webhookEventPayload{
		Event: event, Resource: resource, ResourceID: resourceID,
		Action: action, UserID: userID, Details: details, Timestamp: time.Now().UTC(),
	})
	if err != nil {
		return
	}

	uid, uidErr := uuid.Parse(strings.TrimSpace(userID))
	for _, hook := range hooks {
		if !webhookEventMatches(hook.Events, event) {
			continue
		}
		// Webhooks only receive events for their owner — unless subscribed to "*"
		// is deliberate admin reach; owner scoping keeps per-user isolation.
		if uidErr != nil || hook.UserID != uid {
			continue
		}
		select {
		case webhookQueue <- webhookJob{Webhook: hook, Event: event, Payload: payload}:
		default:
			// Queue full: drop rather than block the request path.
		}
	}
}

func webhookEventMatches(events json.RawMessage, event string) bool {
	var subs []string
	if err := json.Unmarshal(events, &subs); err != nil || len(subs) == 0 {
		return false
	}
	for _, sub := range subs {
		sub = strings.TrimSpace(sub)
		if sub == "*" || sub == event {
			return true
		}
		if strings.HasSuffix(sub, ".*") && strings.HasPrefix(event, strings.TrimSuffix(sub, "*")) {
			return true
		}
	}
	return false
}

// StartWebhookDispatcher launches delivery workers; call once at boot.
func StartWebhookDispatcher() {
	webhookWorkers.Do(func() {
		for i := 0; i < 4; i++ {
			go webhookDeliveryWorker()
		}
	})
}

func webhookDeliveryWorker() {
	for job := range webhookQueue {
		deliverWebhook(job)
	}
}

var webhookHTTPClient = &http.Client{Timeout: 10 * time.Second}

func deliverWebhook(job webhookJob) {
	db := GetAuditDB()
	if db == nil {
		return
	}
	queries := sqlcdb.New(db.DB)
	ctx := context.Background()

	deliveryID := uuid.New()
	_ = queries.CreateWebhookDelivery(ctx, sqlcdb.CreateWebhookDeliveryParams{
		ID:        deliveryID,
		WebhookID: job.Webhook.ID,
		Event:     job.Event,
		Payload:   pqtype.NullRawMessage{RawMessage: job.Payload, Valid: true},
		Status:    "pending",
	})

	var lastStatus string = "failed"
	var respStatus sql.NullInt32
	var respBody sql.NullString
	var durationMs sql.NullInt32
	var deliveredAt sql.NullTime

	for attempt := int32(1); attempt <= 3; attempt++ {
		start := time.Now()
		status, code, body := postWebhook(job, deliveryID, attempt)
		durationMs = sql.NullInt32{Int32: int32(time.Since(start).Milliseconds()), Valid: true}
		respStatus = code
		respBody = body
		if status == "success" {
			lastStatus = "success"
			deliveredAt = sql.NullTime{Time: time.Now().UTC(), Valid: true}
			_ = queries.UpdateWebhookDeliveryResult(ctx, sqlcdb.UpdateWebhookDeliveryResultParams{
				ID:             deliveryID,
				Status:         lastStatus,
				ResponseStatus: respStatus,
				ResponseBody:   respBody,
				Attempts:       attempt,
				DurationMs:     durationMs,
				DeliveredAt:    deliveredAt,
			})
			return
		}
		if attempt < 3 {
			time.Sleep(time.Duration(attempt*attempt) * 2 * time.Second)
		}
	}
	_ = queries.UpdateWebhookDeliveryResult(ctx, sqlcdb.UpdateWebhookDeliveryResultParams{
		ID:             deliveryID,
		Status:         lastStatus,
		ResponseStatus: respStatus,
		ResponseBody:   respBody,
		Attempts:       3,
		DurationMs:     durationMs,
		DeliveredAt:    deliveredAt,
	})
}

func postWebhook(job webhookJob, deliveryID uuid.UUID, attempt int32) (string, sql.NullInt32, sql.NullString) {
	req, err := http.NewRequest(http.MethodPost, job.Webhook.Url, bytes.NewReader(job.Payload))
	if err != nil {
		return "failed", sql.NullInt32{}, sql.NullString{String: err.Error(), Valid: true}
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "Containr-Webhook/1.0")
	req.Header.Set("X-Containr-Event", job.Event)
	req.Header.Set("X-Containr-Delivery", deliveryID.String())
	if job.Webhook.Secret != "" {
		mac := hmac.New(sha256.New, []byte(job.Webhook.Secret))
		mac.Write(job.Payload)
		req.Header.Set("X-Containr-Signature", "sha256="+hex.EncodeToString(mac.Sum(nil)))
	}
	if job.Webhook.Headers.Valid {
		var custom map[string]string
		if err := json.Unmarshal(job.Webhook.Headers.RawMessage, &custom); err == nil {
			for k, v := range custom {
				req.Header.Set(k, v)
			}
		}
	}

	resp, err := webhookHTTPClient.Do(req)
	if err != nil {
		return "failed", sql.NullInt32{}, sql.NullString{String: err.Error(), Valid: true}
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
	code := sql.NullInt32{Int32: int32(resp.StatusCode), Valid: true}
	bodyStr := sql.NullString{String: string(body), Valid: len(body) > 0}
	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		return "success", code, bodyStr
	}
	return "failed", code, bodyStr
}

// ---------- HTTP API ----------

type outboundWebhookResponse struct {
	ID        string            `json:"id"`
	Name      string            `json:"name"`
	URL       string            `json:"url"`
	Secret    string            `json:"secret,omitempty"`
	Events    []string          `json:"events"`
	Headers   map[string]string `json:"headers,omitempty"`
	Enabled   bool              `json:"enabled"`
	CreatedAt time.Time         `json:"created_at"`
	UpdatedAt time.Time         `json:"updated_at"`
}

func outboundWebhookJSON(row sqlcdb.OutboundWebhook, revealSecret bool) outboundWebhookResponse {
	var events []string
	_ = json.Unmarshal(row.Events, &events)
	if events == nil {
		events = []string{}
	}
	var headers map[string]string
	if row.Headers.Valid {
		_ = json.Unmarshal(row.Headers.RawMessage, &headers)
	}
	resp := outboundWebhookResponse{
		ID:      row.ID.String(),
		Name:    row.Name,
		URL:     row.Url,
		Events:  events,
		Headers: headers,
		Enabled: row.Enabled,
	}
	if revealSecret {
		resp.Secret = row.Secret
	}
	if row.CreatedAt.Valid {
		resp.CreatedAt = row.CreatedAt.Time
	}
	if row.UpdatedAt.Valid {
		resp.UpdatedAt = row.UpdatedAt.Time
	}
	return resp
}

func validWebhookURL(raw string) error {
	u, err := url.Parse(strings.TrimSpace(raw))
	if err != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Host == "" {
		return errors.New("url must be a valid http(s) URL")
	}
	return nil
}

type webhookMutationRequest struct {
	Name    string            `json:"name"`
	URL     string            `json:"url"`
	Secret  *string           `json:"secret"`
	Events  []string          `json:"events"`
	Headers map[string]string `json:"headers"`
	Enabled *bool             `json:"enabled"`
}

func handleListOutboundWebhooks(c *gin.Context) {
	userID, ok := requireAuthenticatedUserUUID(c)
	if !ok {
		return
	}
	db := c.MustGet("db").(*database.DB)
	rows, err := sqlcdb.New(db.DB).ListOutboundWebhooksByUser(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list webhooks"})
		return
	}
	out := make([]outboundWebhookResponse, 0, len(rows))
	for _, row := range rows {
		out = append(out, outboundWebhookJSON(row, false))
	}
	c.JSON(http.StatusOK, gin.H{"webhooks": out})
}

func handleCreateOutboundWebhook(c *gin.Context) {
	userID, ok := requireAuthenticatedUserUUID(c)
	if !ok {
		return
	}
	var req webhookMutationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		respondError(c, http.StatusBadRequest, "VALIDATION", "name is required")
		return
	}
	if err := validWebhookURL(req.URL); err != nil {
		respondError(c, http.StatusBadRequest, "VALIDATION", err.Error())
		return
	}
	if len(req.Events) == 0 {
		respondError(c, http.StatusBadRequest, "VALIDATION", "at least one event subscription is required (e.g. \"service.*\" or \"*\")")
		return
	}

	secret := ""
	if req.Secret != nil {
		secret = strings.TrimSpace(*req.Secret)
	}
	if secret == "" {
		buf := make([]byte, 24)
		_, _ = rand.Read(buf)
		secret = hex.EncodeToString(buf)
	}
	eventsJSON, _ := json.Marshal(req.Events)
	var headersJSON pqtype.NullRawMessage
	if len(req.Headers) > 0 {
		if raw, err := json.Marshal(req.Headers); err == nil {
			headersJSON = pqtype.NullRawMessage{RawMessage: raw, Valid: true}
		}
	}
	enabled := true
	if req.Enabled != nil {
		enabled = *req.Enabled
	}

	db := c.MustGet("db").(*database.DB)
	id := uuid.New()
	err := sqlcdb.New(db.DB).CreateOutboundWebhook(c.Request.Context(), sqlcdb.CreateOutboundWebhookParams{
		ID:      id,
		UserID:  userID,
		Name:    req.Name,
		Url:     strings.TrimSpace(req.URL),
		Secret:  secret,
		Events:  eventsJSON,
		Headers: headersJSON,
		Enabled: enabled,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create webhook"})
		return
	}
	LogAuditWithRequest(c, "webhook", id.String(), "create", map[string]interface{}{"name": req.Name})
	c.JSON(http.StatusCreated, outboundWebhookJSON(sqlcdb.OutboundWebhook{
		ID: id, Name: req.Name, Url: strings.TrimSpace(req.URL), Secret: secret,
		Events: eventsJSON, Headers: headersJSON, Enabled: enabled,
		CreatedAt: sql.NullTime{Time: time.Now(), Valid: true},
		UpdatedAt: sql.NullTime{Time: time.Now(), Valid: true},
	}, true))
}

func handleUpdateOutboundWebhook(c *gin.Context) {
	userID, ok := requireAuthenticatedUserUUID(c)
	if !ok {
		return
	}
	webhookID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		respondError(c, http.StatusBadRequest, "VALIDATION", "Invalid webhook id")
		return
	}
	db := c.MustGet("db").(*database.DB)
	queries := sqlcdb.New(db.DB)
	row, err := queries.GetOutboundWebhookByIDAndUser(c.Request.Context(), sqlcdb.GetOutboundWebhookByIDAndUserParams{
		ID: webhookID, UserID: userID,
	})
	if errors.Is(err, sql.ErrNoRows) {
		respondError(c, http.StatusNotFound, "NOT_FOUND", "Webhook not found")
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load webhook"})
		return
	}

	var req webhookMutationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	name := row.Name
	if req.Name != "" {
		name = strings.TrimSpace(req.Name)
	}
	targetURL := row.Url
	if req.URL != "" {
		if err := validWebhookURL(req.URL); err != nil {
			respondError(c, http.StatusBadRequest, "VALIDATION", err.Error())
			return
		}
		targetURL = strings.TrimSpace(req.URL)
	}
	secret := row.Secret
	if req.Secret != nil {
		secret = strings.TrimSpace(*req.Secret)
	}
	eventsJSON := row.Events
	if req.Events != nil {
		if len(req.Events) == 0 {
			respondError(c, http.StatusBadRequest, "VALIDATION", "at least one event subscription is required")
			return
		}
		eventsJSON, _ = json.Marshal(req.Events)
	}
	headersJSON := row.Headers
	if req.Headers != nil {
		if raw, err := json.Marshal(req.Headers); err == nil {
			headersJSON = pqtype.NullRawMessage{RawMessage: raw, Valid: true}
		}
	}
	enabled := row.Enabled
	if req.Enabled != nil {
		enabled = *req.Enabled
	}

	err = queries.UpdateOutboundWebhook(c.Request.Context(), sqlcdb.UpdateOutboundWebhookParams{
		ID: webhookID, UserID: userID,
		Name: name, Url: targetURL, Secret: secret,
		Events: eventsJSON, Headers: headersJSON, Enabled: enabled,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update webhook"})
		return
	}
	LogAuditWithRequest(c, "webhook", webhookID.String(), "update", map[string]interface{}{"name": name})
	row.Name, row.Url, row.Secret, row.Events, row.Headers, row.Enabled = name, targetURL, secret, eventsJSON, headersJSON, enabled
	c.JSON(http.StatusOK, outboundWebhookJSON(row, true))
}

func handleDeleteOutboundWebhook(c *gin.Context) {
	userID, ok := requireAuthenticatedUserUUID(c)
	if !ok {
		return
	}
	webhookID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		respondError(c, http.StatusBadRequest, "VALIDATION", "Invalid webhook id")
		return
	}
	db := c.MustGet("db").(*database.DB)
	err = sqlcdb.New(db.DB).DeleteOutboundWebhookByIDAndUser(c.Request.Context(), sqlcdb.DeleteOutboundWebhookByIDAndUserParams{
		ID: webhookID, UserID: userID,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete webhook"})
		return
	}
	LogAuditWithRequest(c, "webhook", webhookID.String(), "delete", map[string]interface{}{})
	c.JSON(http.StatusOK, gin.H{"message": "Webhook deleted"})
}

func handleListOutboundWebhookDeliveries(c *gin.Context) {
	userID, ok := requireAuthenticatedUserUUID(c)
	if !ok {
		return
	}
	webhookID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		respondError(c, http.StatusBadRequest, "VALIDATION", "Invalid webhook id")
		return
	}
	db := c.MustGet("db").(*database.DB)
	queries := sqlcdb.New(db.DB)
	if _, err := queries.GetOutboundWebhookByIDAndUser(c.Request.Context(), sqlcdb.GetOutboundWebhookByIDAndUserParams{
		ID: webhookID, UserID: userID,
	}); errors.Is(err, sql.ErrNoRows) {
		respondError(c, http.StatusNotFound, "NOT_FOUND", "Webhook not found")
		return
	}
	rows, err := queries.ListWebhookDeliveriesByWebhook(c.Request.Context(), webhookID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list deliveries"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"deliveries": rows})
}

func handleTestOutboundWebhook(c *gin.Context) {
	userID, ok := requireAuthenticatedUserUUID(c)
	if !ok {
		return
	}
	webhookID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		respondError(c, http.StatusBadRequest, "VALIDATION", "Invalid webhook id")
		return
	}
	db := c.MustGet("db").(*database.DB)
	row, err := sqlcdb.New(db.DB).GetOutboundWebhookByIDAndUser(c.Request.Context(), sqlcdb.GetOutboundWebhookByIDAndUserParams{
		ID: webhookID, UserID: userID,
	})
	if errors.Is(err, sql.ErrNoRows) {
		respondError(c, http.StatusNotFound, "NOT_FOUND", "Webhook not found")
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load webhook"})
		return
	}
	if !row.Enabled {
		respondError(c, http.StatusBadRequest, "VALIDATION", "Webhook is disabled")
		return
	}
	payload, _ := json.Marshal(webhookEventPayload{
		Event: "ping", Resource: "webhook", ResourceID: webhookID.String(),
		Action: "ping", UserID: userID.String(), Timestamp: time.Now().UTC(),
	})
	select {
	case webhookQueue <- webhookJob{Webhook: row, Event: "ping", Payload: payload}:
		c.JSON(http.StatusAccepted, gin.H{"message": "Test delivery queued"})
	default:
		respondError(c, http.StatusServiceUnavailable, "UNAVAILABLE", "Delivery queue is full")
	}
}
