-- name: ListGitProviders :many
SELECT id, name, display_name, api_url, webhook_url, user_id, created_at, updated_at
FROM git_providers
WHERE user_id = $1
ORDER BY created_at DESC;

-- name: UpsertGitHubAppProvider :one
INSERT INTO git_providers (id, name, display_name, api_url, webhook_url, access_token, user_id, created_at, updated_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
ON CONFLICT (name, user_id)
DO UPDATE SET
    display_name = EXCLUDED.display_name,
    api_url = EXCLUDED.api_url,
    webhook_url = EXCLUDED.webhook_url,
    access_token = EXCLUDED.access_token,
    updated_at = NOW()
RETURNING id, created_at, updated_at;

-- name: InsertGitProvider :exec
INSERT INTO git_providers (id, name, display_name, api_url, webhook_url, access_token, user_id, created_at, updated_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW());

-- name: GetGitProviderTimestamps :one
SELECT created_at, updated_at FROM git_providers WHERE id = $1;

-- name: GetGitProviderForRepos :one
SELECT name, display_name, access_token, api_url
FROM git_providers
WHERE id = $1 AND user_id = $2;

-- name: GetGitProviderName :one
SELECT name FROM git_providers WHERE id = $1 AND user_id = $2;

-- name: GetGitProviderForFetch :one
SELECT name, api_url, access_token
FROM git_providers
WHERE id = $1 AND user_id = $2;

-- name: DeleteGitProvider :execrows
DELETE FROM git_providers WHERE id = $1 AND user_id = $2;

-- name: ListGitRepositories :many
SELECT id, provider_id, name, full_name, COALESCE(description, '') AS description,
       clone_url, COALESCE(webhook_url, '') AS webhook_url,
       default_branch, is_private, user_id, created_at, updated_at
FROM git_repositories
WHERE provider_id = $1 AND user_id = $2
  AND ($3::text IS NULL OR full_name ILIKE ('%' || $3::text || '%') OR name ILIKE ('%' || $3::text || '%'))
ORDER BY updated_at DESC
LIMIT $4 OFFSET $5;

-- name: CountGitRepositories :one
SELECT COUNT(*)
FROM git_repositories
WHERE provider_id = $1 AND user_id = $2
  AND ($3::text IS NULL OR full_name ILIKE ('%' || $3::text || '%') OR name ILIKE ('%' || $3::text || '%'));

-- name: GetGitRepositoryByFullName :one
SELECT id, provider_id, name, full_name, COALESCE(description, '') AS description,
       clone_url, COALESCE(webhook_url, '') AS webhook_url,
       default_branch, is_private, user_id, created_at, updated_at
FROM git_repositories
WHERE provider_id = $1 AND full_name = $2 AND user_id = $3;

-- name: InsertGitRepository :one
INSERT INTO git_repositories (id, provider_id, name, full_name, description, clone_url, default_branch, is_private, user_id, created_at, updated_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
RETURNING created_at, updated_at;

-- name: UpsertGitRepository :exec
INSERT INTO git_repositories (id, provider_id, name, full_name, description, clone_url, default_branch, is_private, user_id, created_at, updated_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
ON CONFLICT (provider_id, full_name)
DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    clone_url = EXCLUDED.clone_url,
    default_branch = EXCLUDED.default_branch,
    is_private = EXCLUDED.is_private,
    updated_at = NOW();

-- name: GetGitRepositoryProviderID :one
SELECT provider_id FROM git_repositories WHERE id = $1 AND user_id = $2;

-- name: UpsertGitWebhook :one
INSERT INTO git_webhooks (id, repo_id, provider_id, events, webhook_secret, active, branch_filter, created_at, updated_at)
VALUES ($1, $2, $3, $4, $5, TRUE, $6, NOW(), NOW())
ON CONFLICT (repo_id, provider_id)
DO UPDATE SET
    events = EXCLUDED.events,
    webhook_secret = EXCLUDED.webhook_secret,
    active = TRUE,
    branch_filter = EXCLUDED.branch_filter,
    updated_at = NOW()
RETURNING id, active, created_at, updated_at;

-- name: ListConnectedRepositories :many
SELECT r.id, r.provider_id, r.name, r.full_name, COALESCE(r.description, '') AS description, r.clone_url,
       r.default_branch, r.is_private, r.user_id, r.created_at, r.updated_at,
       p.name AS provider_name, p.display_name
FROM git_repositories r
JOIN git_providers p ON r.provider_id = p.id
WHERE r.user_id = $1
ORDER BY r.updated_at DESC
LIMIT $2 OFFSET $3;

-- name: CountUserRepositories :one
SELECT COUNT(*) FROM git_repositories WHERE user_id = $1;

-- name: GetGitWebhookForPush :one
SELECT webhook_secret, repo_id, provider_id, COALESCE(branch_filter, '') AS branch_filter, active
FROM git_webhooks WHERE id = $1;

-- name: GetGitProviderNameByID :one
SELECT name FROM git_providers WHERE id = $1;

-- name: GetGitRepoForPush :one
SELECT clone_url, full_name, user_id FROM git_repositories WHERE id = $1;

-- name: ListServicesForPush :many
SELECT s.id, s.project_id, s.name,
       COALESCE(s.type, s.service_type, '') AS type, COALESCE(s.status, '') AS status,
       COALESCE(s.image, s.image_name, '') AS image, COALESCE(s.command, s.start_command, '') AS command,
       COALESCE(s.environment, '') AS environment, COALESCE(s.git_repo, s.source_url, '') AS git_repo,
       COALESCE(s.git_branch, '') AS git_branch, COALESCE(s.build_path, '') AS build_path,
       COALESCE(s.cpu, '') AS cpu, COALESCE(s.memory, '') AS memory,
       s.created_at, s.updated_at
FROM services s
WHERE (s.git_branch = $1 OR $1 = '') AND (s.git_repo = $2 OR s.git_repo = $3);
