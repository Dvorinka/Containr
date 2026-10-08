-- name: CreateUserToken :one
INSERT INTO user_tokens (user_id, name, key_prefix, token_hash, scope, expires_at)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *;

-- name: ListUserTokens :many
SELECT * FROM user_tokens
WHERE user_id = $1 AND revoked_at IS NULL
ORDER BY created_at DESC;

-- name: GetUserTokenByHash :one
SELECT * FROM user_tokens
WHERE token_hash = $1
  AND revoked_at IS NULL
  AND (expires_at IS NULL OR expires_at > NOW())
LIMIT 1;

-- name: TouchUserToken :exec
UPDATE user_tokens SET last_used_at = NOW()
WHERE id = $1 AND revoked_at IS NULL;

-- name: RevokeUserToken :execrows
UPDATE user_tokens SET revoked_at = NOW()
WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL;
