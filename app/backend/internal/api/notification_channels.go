package api

// Push notification channels — self-hosted ntfy and Gotify endpoints users
// attach to their account. insertUserNotification fans out best-effort.

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"containr/internal/database"
	"containr/internal/database/sqlcdb"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// jarvis: ceiling — one shared client; no retry/backoff, delivery is
// best-effort and failures are silent by design (notifications must never
// break the producing flow).
var pushHTTPClient = &http.Client{Timeout: 5 * time.Second}

type notificationChannelDTO struct {
	ID        string `json:"id"`
	Kind      string `json:"kind"`
	Endpoint  string `json:"endpoint"`
	Enabled   bool   `json:"enabled"`
	CreatedAt string `json:"created_at"`
}

func mapChannel(row sqlcdb.NotificationChannel) notificationChannelDTO {
	return notificationChannelDTO{
		ID:        row.ID.String(),
		Kind:      row.Kind,
		Endpoint:  row.Endpoint,
		Enabled:   row.Enabled,
		CreatedAt: row.CreatedAt.Time.Format(time.RFC3339),
	}
}

func handleListNotificationChannels(c *gin.Context) {
	userID, ok := requireAuthenticatedUserID(c)
	if !ok {
		return
	}
	db := c.MustGet("db").(*database.DB)
	uid, _ := uuid.Parse(userID)
	rows, err := sqlcdb.New(db.DB).ListAllNotificationChannelsByUser(c.Request.Context(), uid)
	if err != nil {
		respondError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to list channels")
		return
	}
	out := make([]notificationChannelDTO, 0, len(rows))
	for _, r := range rows {
		out = append(out, mapChannel(r))
	}
	c.JSON(http.StatusOK, gin.H{"channels": out})
}

func handleCreateNotificationChannel(c *gin.Context) {
	userID, ok := requireAuthenticatedUserID(c)
	if !ok {
		return
	}
	var req struct {
		Kind     string `json:"kind" binding:"required,oneof=ntfy gotify"`
		Endpoint string `json:"endpoint" binding:"required"`
		Token    string `json:"token"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, http.StatusBadRequest, "VALIDATION", "kind (ntfy|gotify) and endpoint are required")
		return
	}
	endpoint := strings.TrimRight(strings.TrimSpace(req.Endpoint), "/")
	u, err := url.Parse(endpoint)
	if err != nil || u.Scheme == "" || u.Host == "" || (u.Scheme != "http" && u.Scheme != "https") {
		respondError(c, http.StatusBadRequest, "VALIDATION", "endpoint must be a valid http(s) URL")
		return
	}
	db := c.MustGet("db").(*database.DB)
	uid, _ := uuid.Parse(userID)
	row, err := sqlcdb.New(db.DB).InsertNotificationChannel(c.Request.Context(), sqlcdb.InsertNotificationChannelParams{
		UserID:   uid,
		Kind:     req.Kind,
		Endpoint: endpoint,
		Token:    sql.NullString{String: req.Token, Valid: req.Token != ""},
	})
	if err != nil {
		respondError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to create channel")
		return
	}
	c.JSON(http.StatusCreated, gin.H{"channel": mapChannel(row)})
}

func handleDeleteNotificationChannel(c *gin.Context) {
	userID, ok := requireAuthenticatedUserID(c)
	if !ok {
		return
	}
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		respondError(c, http.StatusBadRequest, "VALIDATION", "Invalid channel id")
		return
	}
	db := c.MustGet("db").(*database.DB)
	uid, _ := uuid.Parse(userID)
	n, err := sqlcdb.New(db.DB).DeleteNotificationChannel(c.Request.Context(), sqlcdb.DeleteNotificationChannelParams{
		ID: id, UserID: uid,
	})
	if err != nil {
		respondError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to delete channel")
		return
	}
	if n == 0 {
		respondError(c, http.StatusNotFound, "NOT_FOUND", "Channel not found")
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Channel deleted"})
}

// handleTestNotificationChannel pushes a probe notification through the
// channel — surfaces misconfiguration before real alerts depend on it.
func handleTestNotificationChannel(c *gin.Context) {
	userID, ok := requireAuthenticatedUserID(c)
	if !ok {
		return
	}
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		respondError(c, http.StatusBadRequest, "VALIDATION", "Invalid channel id")
		return
	}
	db := c.MustGet("db").(*database.DB)
	uid, _ := uuid.Parse(userID)
	rows, err := sqlcdb.New(db.DB).ListAllNotificationChannelsByUser(c.Request.Context(), uid)
	if err != nil {
		respondError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to load channel")
		return
	}
	var target *sqlcdb.NotificationChannel
	for i := range rows {
		if rows[i].ID == id {
			target = &rows[i]
			break
		}
	}
	if target == nil {
		respondError(c, http.StatusNotFound, "NOT_FOUND", "Channel not found")
		return
	}
	if err := deliverPush(c.Request.Context(), *target, "test", "Containr test notification", "Your push channel is configured correctly."); err != nil {
		respondError(c, http.StatusBadGateway, "DELIVERY_FAILED", fmt.Sprintf("Push failed: %v", err))
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Test notification sent"})
}

// deliverPush sends one notification through a channel. ntfy expects the
// body at POST {endpoint} with Title/Priority headers; Gotify takes JSON at
// POST {endpoint}/message?token=...
func deliverPush(ctx context.Context, ch sqlcdb.NotificationChannel, kind, title, body string) error {
	var req *http.Request
	var err error
	switch ch.Kind {
	case "ntfy":
		req, err = http.NewRequestWithContext(ctx, http.MethodPost, ch.Endpoint, strings.NewReader(body))
		if err == nil {
			req.Header.Set("Title", title)
			req.Header.Set("Tags", "containr,"+kind)
			if ch.Token.Valid && ch.Token.String != "" {
				req.Header.Set("Authorization", "Bearer "+ch.Token.String)
			}
		}
	case "gotify":
		payload, _ := json.Marshal(map[string]interface{}{
			"title":    title,
			"message":  body,
			"priority": 5,
		})
		endpoint := ch.Endpoint + "/message"
		if ch.Token.Valid && ch.Token.String != "" {
			endpoint += "?token=" + url.QueryEscape(ch.Token.String)
		}
		req, err = http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(payload))
		if err == nil {
			req.Header.Set("Content-Type", "application/json")
		}
	default:
		return fmt.Errorf("unsupported channel kind %q", ch.Kind)
	}
	if err != nil {
		return err
	}
	res, err := pushHTTPClient.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	if res.StatusCode >= 400 {
		return fmt.Errorf("push endpoint returned %d", res.StatusCode)
	}
	return nil
}

// fanoutUserPush delivers a notification to every enabled channel the user
// configured. Errors are swallowed — the in-app row already landed.
func fanoutUserPush(db *database.DB, userID, kind, title, body string) {
	uid, err := uuid.Parse(userID)
	if err != nil {
		return
	}
	rows, err := sqlcdb.New(db.DB).ListNotificationChannelsByUser(context.Background(), uid)
	if err != nil || len(rows) == 0 {
		return
	}
	for _, ch := range rows {
		_ = deliverPush(context.Background(), ch, kind, title, body)
	}
}
