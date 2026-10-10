-- name: GetAPServiceForValidate :one
SELECT upstream_url, health_path, upstream_auth_header, upstream_auth_value, request_timeout_ms
FROM api_services WHERE id = $1;

-- name: SetAPServiceValidation :exec
UPDATE api_services
SET last_validation_at = NOW(), last_validation_status = $1, last_validation_message = $2, updated_at = NOW()
WHERE id = $3;

-- name: InsertServiceIncident :exec
INSERT INTO incident_events (service_id, code, message, severity, http_status, occurred_at)
VALUES ($1, 'SERVICE_VALIDATION_FAILED', $2, 'medium', $3, NOW());

-- name: InsertGatewayIncident :exec
INSERT INTO incident_events (service_id, api_key_id, code, message, severity, http_status, occurred_at)
VALUES ($1, $2, $3, $4, $5, $6, NOW());

-- name: ListAPServices :many
SELECT id, name, slug, upstream_url, route_prefix, enabled,
       to_char(created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at,
       to_char(updated_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS updated_at
FROM api_services
ORDER BY created_at DESC;

-- name: InsertAPService :one
INSERT INTO api_services (
    name, slug, upstream_url, route_prefix, health_path,
    rpm_limit, monthly_quota, created_at, updated_at
) VALUES ($1, $2, $3, $4, '/health', $5, $6, NOW(), NOW())
RETURNING id;

-- name: SetAPServiceEnabled :exec
UPDATE api_services SET enabled = $1, updated_at = NOW() WHERE id = $2;

-- name: ListAPKeys :many
SELECT id, name, key_prefix, plan, enabled, rpm_limit, monthly_quota,
       to_char(created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at,
       to_char(updated_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS updated_at
FROM api_keys
ORDER BY created_at DESC;

-- name: InsertAPKey :one
INSERT INTO api_keys (
    name, key_hash, key_prefix, plan, allowed_service_ids,
    rpm_limit, monthly_quota, created_at, updated_at
) VALUES ($1, $2, $3, $4, '[]', $5, $6, NOW(), NOW())
RETURNING id;

-- name: SetAPKeyEnabled :exec
UPDATE api_keys SET enabled = $1, updated_at = NOW() WHERE id = $2;

-- name: CountAPServices :one
SELECT COUNT(*) FROM api_services;

-- name: CountAPKeys :one
SELECT COUNT(*) FROM api_keys;

-- name: SumUsageCounters :one
SELECT COALESCE(SUM(request_count), 0) FROM usage_counters;

-- name: SumRequestMetricSince :one
SELECT COALESCE(SUM(value), 0)::int
FROM metrics_timeseries
WHERE metric = 'request_total' AND occurred_at >= DATE_TRUNC($1::text, NOW());

-- name: ListTopAPServices :many
SELECT s.id, s.name, COALESCE(SUM(u.request_count), 0) AS total_requests
FROM api_services s
LEFT JOIN usage_counters u ON u.service_id = s.id
GROUP BY s.id, s.name
ORDER BY total_requests DESC, s.name ASC
LIMIT 10;

-- name: ListRequestsByDay :many
SELECT TO_CHAR(DATE_TRUNC('day', occurred_at), 'YYYY-MM-DD') AS day_bucket, COUNT(*) AS total
FROM metrics_timeseries
WHERE metric = 'request_total' AND occurred_at >= NOW() - INTERVAL '7 days'
GROUP BY DATE_TRUNC('day', occurred_at)
ORDER BY DATE_TRUNC('day', occurred_at) ASC;

-- name: ListIncidentStatusCodes :many
SELECT COALESCE(http_status, 0) AS status_code, COALESCE(SUM(count), 0) AS total
FROM incident_events
WHERE occurred_at >= NOW() - INTERVAL '7 days'
GROUP BY COALESCE(http_status, 0)
ORDER BY total DESC, status_code ASC;

-- name: ListClientEventPaths :many
SELECT COALESCE((labels_json::jsonb ->> 'path'), 'unknown') AS path, COUNT(*) AS total
FROM metrics_timeseries
WHERE metric = 'client_event' AND occurred_at >= NOW() - INTERVAL '7 days'
GROUP BY COALESCE((labels_json::jsonb ->> 'path'), 'unknown')
ORDER BY total DESC, path ASC
LIMIT 20;

-- name: GetAPServiceBySlug :one
SELECT id, upstream_url, route_prefix, upstream_auth_header,
       upstream_auth_value, enabled, rpm_limit, monthly_quota,
       request_timeout_ms
FROM api_services WHERE slug = $1;

-- name: ListAPKeysByPrefix :many
SELECT id, key_hash, enabled, rpm_limit, monthly_quota, allowed_service_ids
FROM api_keys WHERE key_prefix = $1;

-- name: SumUsageByKey :one
SELECT COALESCE(SUM(request_count), 0)::bigint FROM usage_counters
WHERE api_key_id = $1 AND period_month = $2;

-- name: SumUsageByService :one
SELECT COALESCE(SUM(request_count), 0)::bigint FROM usage_counters
WHERE service_id = $1 AND period_month = $2;

-- name: UpsertUsageCounter :exec
INSERT INTO usage_counters (api_key_id, service_id, period_month, request_count, updated_at)
VALUES ($1, $2, $3, 1, NOW())
ON CONFLICT (api_key_id, service_id, period_month)
DO UPDATE SET request_count = usage_counters.request_count + 1, updated_at = NOW();

-- name: TouchAPKeyLastUsed :exec
UPDATE api_keys SET last_used_at = NOW() WHERE id = $1;

-- name: InsertMetricPoint :exec
INSERT INTO metrics_timeseries (metric, value, labels_json, occurred_at)
VALUES ('gateway_request', 1, $1, NOW());
