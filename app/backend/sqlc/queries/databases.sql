-- name: ListDatabaseServicesByUser :many
SELECT id, name, type, status, version, plan, region, connection_url, created_at, updated_at
FROM database_services
WHERE user_id = $1
ORDER BY created_at DESC;

-- name: GetDatabaseServiceByIDAndUser :one
SELECT id, name, type, status, version, plan, region, connection_url, created_at, updated_at
FROM database_services
WHERE id = $1 AND user_id = $2;

-- name: DatabaseServiceExistsByIDAndUser :one
SELECT EXISTS(
  SELECT 1 FROM database_services WHERE id = $1 AND user_id = $2
);

-- name: CountDatabaseServicesByUserAndName :one
SELECT COUNT(*)
FROM database_services
WHERE user_id = sqlc.arg(user_id) AND LOWER(name) = LOWER(sqlc.arg(name));

-- name: CreateDatabaseService :exec
INSERT INTO database_services (id, user_id, name, type, status, version, plan, region, created_at, updated_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10);

-- name: UpdateDatabaseServiceNameAndPlanByIDAndUser :exec
UPDATE database_services
SET name = $1, plan = $2, updated_at = $3
WHERE id = $4 AND user_id = $5;

-- name: UpdateDatabaseServiceNameByIDAndUser :exec
UPDATE database_services
SET name = $1, updated_at = $2
WHERE id = $3 AND user_id = $4;

-- name: UpdateDatabaseServicePlanByIDAndUser :exec
UPDATE database_services
SET plan = $1, updated_at = $2
WHERE id = $3 AND user_id = $4;

-- name: DeleteDatabaseServiceByIDAndUser :exec
DELETE FROM database_services
WHERE id = $1 AND user_id = $2;

-- name: SetDatabaseServiceStatusByIDAndUser :exec
UPDATE database_services
SET status = $1, updated_at = $2
WHERE id = $3 AND user_id = $4;

-- name: SetDatabaseServiceStatusByID :exec
UPDATE database_services
SET status = $1, updated_at = $2
WHERE id = $3;

-- name: SetDatabaseServiceStatusAndConnectionByID :exec
UPDATE database_services
SET status = $1, connection_url = $2, updated_at = $3
WHERE id = $4;

-- name: ListDatabaseBackupsByDatabaseAndUser :many
SELECT b.id, b.database_id, b.size, b.status, b.backup_path, b.created_at, b.completed_at
FROM database_backups b
JOIN database_services s ON s.id = b.database_id
WHERE b.database_id = $1 AND s.user_id = $2
ORDER BY b.created_at DESC
LIMIT $3;

-- name: GetDatabaseBackupByIDAndDatabaseAndUser :one
SELECT b.id, b.database_id, b.size, b.status, b.backup_path, b.created_at, b.completed_at
FROM database_backups b
JOIN database_services s ON s.id = b.database_id
WHERE b.id = $1 AND b.database_id = $2 AND s.user_id = $3;

-- name: CreateDatabaseBackup :exec
INSERT INTO database_backups (id, database_id, size, status, backup_path, created_at)
VALUES ($1, $2, $3, $4, $5, $6);

-- name: SetDatabaseBackupStatusByID :exec
UPDATE database_backups
SET status = $1, size = $2, completed_at = $3
WHERE id = $4;
