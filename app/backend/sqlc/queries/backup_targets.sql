-- name: ListBackupTargetsByUser :many
SELECT backup_targets.*
FROM backup_targets
WHERE user_id = sqlc.arg(user_id)
ORDER BY created_at DESC;

-- name: GetBackupTargetByIDAndUser :one
SELECT backup_targets.*
FROM backup_targets
WHERE id = sqlc.arg(id) AND user_id = sqlc.arg(user_id);

-- name: GetBackupTargetByID :one
SELECT backup_targets.*
FROM backup_targets
WHERE id = sqlc.arg(id);

-- name: CreateBackupTarget :exec
INSERT INTO backup_targets (id, user_id, name, endpoint, bucket, region, prefix, access_key, secret_key, use_tls, created_at, updated_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12);

-- name: UpdateBackupTargetByIDAndUser :exec
UPDATE backup_targets
SET name = $1, endpoint = $2, bucket = $3, region = $4, prefix = $5, access_key = $6, secret_key = $7, use_tls = $8, updated_at = $9
WHERE id = $10 AND user_id = $11;

-- name: DeleteBackupTargetByIDAndUser :exec
DELETE FROM backup_targets
WHERE id = $1 AND user_id = $2;

-- name: SetDatabaseBackupTargetByIDAndUser :exec
UPDATE database_services
SET backup_target_id = $1, updated_at = $2
WHERE id = $3 AND user_id = $4;

-- name: SetDatabaseBackupRemoteKeyByID :exec
UPDATE database_backups
SET remote_key = $1
WHERE id = $2;

-- name: CountDatabasesUsingBackupTarget :one
SELECT COUNT(*)
FROM database_services
WHERE backup_target_id = sqlc.arg(target_id);
