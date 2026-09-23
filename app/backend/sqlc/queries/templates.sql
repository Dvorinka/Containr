-- name: ListServiceTemplatesForUser :many
SELECT id, name, description, category, logo, config, variables, is_official, owner_id, is_public, created_at, updated_at
FROM service_templates
WHERE is_official = true OR is_public = true OR owner_id = sqlc.narg(owner_id)
ORDER BY is_official DESC, name ASC;

-- name: ListServiceTemplatesByCategoryForUser :many
SELECT id, name, description, category, logo, config, variables, is_official, owner_id, is_public, created_at, updated_at
FROM service_templates
WHERE category = sqlc.arg(category)
  AND (is_official = true OR is_public = true OR owner_id = sqlc.narg(owner_id))
ORDER BY is_official DESC, name ASC;

-- name: GetServiceTemplateByID :one
SELECT id, name, description, category, logo, config, variables, is_official, owner_id, is_public, created_at, updated_at
FROM service_templates
WHERE id = $1;

-- name: UpsertServiceTemplate :exec
INSERT INTO service_templates (id, name, description, category, logo, config, variables, is_official)
VALUES (
    sqlc.arg(id),
    sqlc.arg(name),
    sqlc.narg(description),
    sqlc.arg(category),
    sqlc.narg(logo),
    sqlc.arg(config),
    sqlc.narg(variables),
    sqlc.arg(is_official)
)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    description = EXCLUDED.description,
    category = EXCLUDED.category,
    logo = EXCLUDED.logo,
    config = EXCLUDED.config,
    variables = EXCLUDED.variables,
    is_official = EXCLUDED.is_official,
    updated_at = NOW();

-- name: CreateUserTemplate :exec
INSERT INTO service_templates (id, name, description, category, logo, config, variables, is_official, owner_id, is_public)
VALUES (
    sqlc.arg(id),
    sqlc.arg(name),
    sqlc.narg(description),
    sqlc.arg(category),
    sqlc.narg(logo),
    sqlc.arg(config),
    sqlc.narg(variables),
    false,
    sqlc.arg(owner_id),
    sqlc.arg(is_public)
);

-- name: UpdateUserTemplate :execrows
UPDATE service_templates
SET name = sqlc.arg(name),
    description = sqlc.narg(description),
    category = sqlc.arg(category),
    logo = sqlc.narg(logo),
    config = sqlc.arg(config),
    variables = sqlc.narg(variables),
    is_public = sqlc.arg(is_public),
    updated_at = NOW()
WHERE id = sqlc.arg(id)
  AND owner_id = sqlc.arg(owner_id)
  AND is_official = false;

-- name: DeleteUserTemplate :execrows
DELETE FROM service_templates
WHERE id = sqlc.arg(id)
  AND owner_id = sqlc.arg(owner_id)
  AND is_official = false;

-- name: GetProjectOwnerID :one
SELECT owner_id
FROM projects
WHERE id = $1;

-- name: CountServicesByProjectAndName :one
SELECT COUNT(*)
FROM services
WHERE project_id = $1 AND name = $2;

-- name: CreateServiceFromTemplate :exec
INSERT INTO services (
    id,
    project_id,
    name,
    environment_id,
    service_type,
    source_type,
    source_url,
    image_name,
    build_command,
    start_command,
    type,
    status,
    image,
    command,
    environment,
    cpu,
    memory,
    created_at,
    updated_at
)
VALUES (
    $1,
    $2,
    $3,
    $4,
    $5,
    $6,
    $7,
    $8,
    $9,
    $10,
    $11,
    $12,
    $13,
    $14,
    $15,
    $16,
    $17,
    $18,
    $19
);

-- name: UpsertEnvironmentVariable :exec
INSERT INTO environment_variables (id, service_id, key, value, is_secret, created_at, updated_at)
VALUES ($1, $2, $3, $4, $5, $6, $7)
ON CONFLICT (service_id, key) DO UPDATE
SET value = EXCLUDED.value,
    is_secret = EXCLUDED.is_secret,
    updated_at = EXCLUDED.updated_at;
