-- name: InsertAuditLog :exec
INSERT INTO audit_logs (id, user_id, resource, resource_id, action, details, severity, category, label, created_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10);

-- name: InsertAuditLogWithRequest :exec
INSERT INTO audit_logs (id, user_id, resource, resource_id, action, details, ip_address, user_agent, severity, category, label, created_at)
VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::inet, $8, $9, $10, $11, $12);

-- name: PruneAuditLogs :execrows
DELETE FROM audit_logs WHERE created_at < NOW() - ($1::int * INTERVAL '1 day');

-- name: ListAuditBackfillBatch :many
SELECT id::text, resource, action FROM audit_logs
WHERE label = '' AND id > $1::uuid ORDER BY id LIMIT 500;

-- name: SetAuditLogMetadata :exec
UPDATE audit_logs SET severity = $1, category = $2, label = $3 WHERE id = $4::uuid;

-- name: ListResourceAuditLogs :many
SELECT id, COALESCE(user_id::text, '')::text AS user_id, resource,
       COALESCE(resource_id::text, '')::text AS resource_id, action,
       COALESCE(details::text, '{}')::text AS details,
       COALESCE(ip_address::text, '')::text AS ip_address,
       COALESCE(user_agent, '') AS user_agent, created_at
FROM audit_logs
WHERE user_id::text = $1 AND resource = $2 AND resource_id::text = $3
ORDER BY created_at DESC
LIMIT 100;
