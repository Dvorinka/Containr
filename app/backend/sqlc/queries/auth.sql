-- name: GetUserByEmailForAuth :one
SELECT id, email, password_hash, name, COALESCE(avatar_url, '') AS avatar_url, is_admin, created_at
FROM users WHERE email = $1;

-- name: CountUsers :one
SELECT COUNT(*) FROM users;

-- name: CountUsersByEmail :one
SELECT COUNT(*) FROM users WHERE email = $1;

-- name: UpsertLocalUser :one
INSERT INTO users (email, password_hash, name, avatar_url, is_admin)
VALUES ($1, $2, $3, NULLIF($4::varchar, ''), $5)
ON CONFLICT (email) DO UPDATE
SET name = EXCLUDED.name,
    avatar_url = COALESCE(EXCLUDED.avatar_url, users.avatar_url),
    updated_at = NOW()
RETURNING id, email, name, COALESCE(avatar_url, '') AS avatar_url, is_admin, created_at;

-- name: InsertUserAdmin :one
INSERT INTO users (email, password_hash, name, is_admin)
VALUES ($1, $2, $3, $4)
RETURNING id, email, name, COALESCE(avatar_url, '') AS avatar_url, is_admin, created_at;

-- name: InsertUser :one
INSERT INTO users (email, password_hash, name)
VALUES ($1, $2, $3)
RETURNING id, email, name, COALESCE(avatar_url, '') AS avatar_url, is_admin, created_at;

-- name: GetUserByID :one
SELECT id, email, name, COALESCE(avatar_url, '') AS avatar_url, is_admin, created_at
FROM users WHERE id = $1;

-- name: UpdateUserProfile :exec
UPDATE users
SET name = COALESCE($1::varchar, name), avatar_url = COALESCE($2::varchar, avatar_url)
WHERE id = $3;

-- name: UpsertAdminUser :one
INSERT INTO users (email, password_hash, name, is_admin)
VALUES ($1, $2, $3, true)
ON CONFLICT (email) DO UPDATE
SET is_admin = true, updated_at = NOW()
RETURNING id;

-- name: ListAdminUsers :many
SELECT id, email, name, COALESCE(avatar_url, '') AS avatar_url, is_admin,
       COALESCE(to_char(created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"'), '')::text AS created_at
FROM users
ORDER BY created_at ASC;

-- name: SetUserAdmin :execrows
UPDATE users SET is_admin = $1, updated_at = NOW() WHERE id = $2;

-- name: GetAdminUserInfo :one
SELECT email, COALESCE(name, '') AS name, is_admin
FROM users WHERE id = $1;
