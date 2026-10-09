-- name: ListOutboundWebhooksByUser :many
SELECT outbound_webhooks.*
FROM outbound_webhooks
WHERE user_id = $1
ORDER BY created_at DESC;

-- name: GetOutboundWebhookByIDAndUser :one
SELECT outbound_webhooks.*
FROM outbound_webhooks
WHERE id = $1 AND user_id = $2;

-- name: ListEnabledOutboundWebhooks :many
SELECT outbound_webhooks.*
FROM outbound_webhooks
WHERE enabled;

-- name: CreateOutboundWebhook :exec
INSERT INTO outbound_webhooks (id, user_id, name, url, secret, events, headers, enabled, created_at, updated_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10);

-- name: UpdateOutboundWebhook :exec
UPDATE outbound_webhooks
SET name = $1, url = $2, secret = $3, events = $4, headers = $5, enabled = $6, updated_at = $7
WHERE id = $8 AND user_id = $9;

-- name: DeleteOutboundWebhookByIDAndUser :exec
DELETE FROM outbound_webhooks
WHERE id = $1 AND user_id = $2;

-- name: CreateWebhookDelivery :exec
INSERT INTO webhook_deliveries (id, webhook_id, event, payload, status, created_at)
VALUES ($1, $2, $3, $4, $5, $6);

-- name: UpdateWebhookDeliveryResult :exec
UPDATE webhook_deliveries
SET status = $1, response_status = $2, response_body = $3, attempts = $4, duration_ms = $5, delivered_at = $6
WHERE id = $7;

-- name: ListWebhookDeliveriesByWebhook :many
SELECT webhook_deliveries.*
FROM webhook_deliveries
WHERE webhook_id = $1
ORDER BY created_at DESC
LIMIT 100;

-- name: GetOutboundWebhookByID :one
SELECT outbound_webhooks.*
FROM outbound_webhooks
WHERE id = $1;
