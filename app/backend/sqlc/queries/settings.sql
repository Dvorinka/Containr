-- name: GetAppSetting :one
SELECT value FROM app_settings WHERE key = $1;

-- name: UpsertAppSetting :exec
INSERT INTO app_settings (key, value, is_secret, updated_at)
VALUES ($1, $2, $3, NOW())
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value, is_secret = EXCLUDED.is_secret, updated_at = NOW();

-- name: UpsertAppSettingValue :exec
INSERT INTO app_settings (key, value, updated_at) VALUES ($1, $2, NOW())
ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW();

-- name: DeleteAppSetting :exec
DELETE FROM app_settings WHERE key = $1;

-- name: GetUserIsAdmin :one
SELECT is_admin FROM users WHERE id = $1;

-- name: ListAdminUserIDs :many
SELECT id FROM users WHERE is_admin;
