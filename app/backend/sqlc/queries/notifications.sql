-- name: CreateNotification :exec
INSERT INTO notifications (id, user_id, kind, title, body, resource_type, resource_id, created_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8);

-- name: ListNotificationsByUser :many
SELECT id, user_id, kind, title, body, resource_type, resource_id, read_at, created_at
FROM notifications
WHERE user_id = $1
ORDER BY created_at DESC
LIMIT $2;

-- name: CountUnreadNotificationsByUser :one
SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND read_at IS NULL;

-- name: MarkNotificationReadByIDAndUser :exec
UPDATE notifications SET read_at = $3 WHERE id = $1 AND user_id = $2 AND read_at IS NULL;

-- name: MarkAllNotificationsReadByUser :exec
UPDATE notifications SET read_at = $2 WHERE user_id = $1 AND read_at IS NULL;

-- name: ListNotificationChannelsByUser :many
SELECT id, user_id, kind, endpoint, token, enabled, created_at, updated_at
FROM notification_channels
WHERE user_id = $1 AND enabled
ORDER BY created_at;

-- name: ListAllNotificationChannelsByUser :many
SELECT id, user_id, kind, endpoint, token, enabled, created_at, updated_at
FROM notification_channels
WHERE user_id = $1
ORDER BY created_at;

-- name: InsertNotificationChannel :one
INSERT INTO notification_channels (user_id, kind, endpoint, token)
VALUES ($1, $2, $3, $4)
RETURNING id, user_id, kind, endpoint, token, enabled, created_at, updated_at;

-- name: DeleteNotificationChannel :execrows
DELETE FROM notification_channels WHERE id = $1 AND user_id = $2;
