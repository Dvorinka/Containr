-- name: CreateAgentAuthToken :one
INSERT INTO agent_auth_tokens (token_hash, label)
VALUES ($1, $2)
RETURNING *;

-- name: ListAgentAuthTokens :many
SELECT * FROM agent_auth_tokens
ORDER BY created_at DESC;

-- name: GetActiveAgentAuthTokenByHash :one
SELECT * FROM agent_auth_tokens
WHERE token_hash = $1 AND revoked_at IS NULL
LIMIT 1;

-- name: TouchAgentAuthToken :exec
UPDATE agent_auth_tokens SET last_used_at = NOW()
WHERE token_hash = $1 AND revoked_at IS NULL;

-- name: RevokeAgentAuthToken :one
UPDATE agent_auth_tokens SET revoked_at = NOW()
WHERE id = $1 AND revoked_at IS NULL
RETURNING *;
