package api

import (
	"containr/internal/database"
	"containr/internal/database/sqlcdb"
	"context"
	"database/sql"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type NotificationItem struct {
	ID           string     `json:"id"`
	Kind         string     `json:"kind"`
	Title        string     `json:"title"`
	Body         string     `json:"body"`
	ResourceType string     `json:"resource_type"`
	ResourceID   string     `json:"resource_id"`
	ReadAt       *time.Time `json:"read_at"`
	CreatedAt    time.Time  `json:"created_at"`
}

// insertUserNotification records a persistent notification for a user.
// Best-effort: notification delivery must never break the caller's flow.
func insertUserNotification(db *database.DB, userID, kind, title, body, resourceType, resourceID string) {
	userUUID, err := uuid.Parse(userID)
	if err != nil || db == nil {
		return
	}
	_ = sqlcdb.New(db.DB).CreateNotification(context.Background(), sqlcdb.CreateNotificationParams{
		ID:           uuid.New(),
		UserID:       userUUID,
		Kind:         kind,
		Title:        title,
		Body:         sql.NullString{String: body, Valid: body != ""},
		ResourceType: sql.NullString{String: resourceType, Valid: resourceType != ""},
		ResourceID:   sql.NullString{String: resourceID, Valid: resourceID != ""},
		CreatedAt:    sql.NullTime{Time: time.Now(), Valid: true},
	})
}

func mapNotification(row sqlcdb.Notification) NotificationItem {
	var readAt *time.Time
	if row.ReadAt.Valid {
		t := row.ReadAt.Time
		readAt = &t
	}
	return NotificationItem{
		ID:           row.ID.String(),
		Kind:         row.Kind,
		Title:        row.Title,
		Body:         databaseNullString(row.Body),
		ResourceType: databaseNullString(row.ResourceType),
		ResourceID:   databaseNullString(row.ResourceID),
		ReadAt:       readAt,
		CreatedAt:    databaseNullTime(row.CreatedAt),
	}
}

func handleListNotifications(c *gin.Context) {
	userID, ok := requireAuthenticatedUserID(c)
	if !ok {
		return
	}
	db, exists := c.Get("db")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database connection not available"})
		return
	}
	q := sqlcdb.New(db.(*database.DB).DB)
	limit := int64(20)
	if raw := c.Query("limit"); raw != "" {
		if parsed, err := strconv.ParseInt(raw, 10, 64); err == nil && parsed > 0 && parsed <= 100 {
			limit = parsed
		}
	}
	userUUID, err := uuid.Parse(userID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user id"})
		return
	}
	rows, err := q.ListNotificationsByUser(c.Request.Context(), sqlcdb.ListNotificationsByUserParams{
		UserID: userUUID,
		Limit:  int32(limit),
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list notifications"})
		return
	}
	unread, err := q.CountUnreadNotificationsByUser(c.Request.Context(), userUUID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to count notifications"})
		return
	}
	items := make([]NotificationItem, 0, len(rows))
	for _, row := range rows {
		items = append(items, mapNotification(row))
	}
	c.JSON(http.StatusOK, gin.H{"notifications": items, "unread": unread})
}

func handleMarkNotificationRead(c *gin.Context) {
	userID, ok := requireAuthenticatedUserID(c)
	if !ok {
		return
	}
	db, exists := c.Get("db")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database connection not available"})
		return
	}
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid notification id"})
		return
	}
	userUUID, err := uuid.Parse(userID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user id"})
		return
	}
	q := sqlcdb.New(db.(*database.DB).DB)
	if err := q.MarkNotificationReadByIDAndUser(c.Request.Context(), sqlcdb.MarkNotificationReadByIDAndUserParams{
		ID:     id,
		UserID: userUUID,
		ReadAt: sql.NullTime{Time: time.Now(), Valid: true},
	}); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to mark notification"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Notification marked read"})
}

func handleMarkAllNotificationsRead(c *gin.Context) {
	userID, ok := requireAuthenticatedUserID(c)
	if !ok {
		return
	}
	db, exists := c.Get("db")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database connection not available"})
		return
	}
	userUUID, err := uuid.Parse(userID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user id"})
		return
	}
	q := sqlcdb.New(db.(*database.DB).DB)
	if err := q.MarkAllNotificationsReadByUser(c.Request.Context(), sqlcdb.MarkAllNotificationsReadByUserParams{
		UserID: userUUID,
		ReadAt: sql.NullTime{Time: time.Now(), Valid: true},
	}); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to mark notifications"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "All notifications marked read"})
}
