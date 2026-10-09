-- name: CreateUserInvite :one
INSERT INTO user_invites (token_hash, email, created_by, expires_at)
VALUES ($1, $2, $3, $4)
RETURNING user_invites.*;

-- name: GetUserInviteByTokenHash :one
SELECT user_invites.*
FROM user_invites
WHERE token_hash = $1;

-- name: ListUserInvites :many
SELECT user_invites.*
FROM user_invites
ORDER BY created_at DESC;

-- name: MarkUserInviteUsed :exec
UPDATE user_invites
SET used_by = $2, used_at = now()
WHERE id = $1 AND used_at IS NULL;

-- name: DeleteUserInvite :exec
DELETE FROM user_invites
WHERE id = $1;
