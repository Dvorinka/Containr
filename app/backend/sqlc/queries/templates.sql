-- name: ListServiceTemplates :many
SELECT id, name, description, category, logo, config, variables, is_official, created_at, updated_at
FROM service_templates
ORDER BY is_official DESC, name ASC;

-- name: ListServiceTemplatesByCategory :many
SELECT id, name, description, category, logo, config, variables, is_official, created_at, updated_at
FROM service_templates
WHERE category = $1
ORDER BY is_official DESC, name ASC;

-- name: GetServiceTemplateByID :one
SELECT id, name, description, category, logo, config, variables, is_official, created_at, updated_at
FROM service_templates
WHERE id = $1;

-- name: GetProjectOwnerID :one
SELECT owner_id
FROM projects
WHERE id = $1;

-- name: CountServicesByProjectAndName :one
SELECT COUNT(*)
FROM services
WHERE project_id = $1 AND name = $2;

-- name: CreateServiceFromTemplate :exec
INSERT INTO services (id, project_id, name, type, status, image, command, environment, cpu, memory, created_at, updated_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12);

-- name: UpsertEnvironmentVariable :exec
INSERT INTO environment_variables (id, service_id, key, value, is_secret, created_at, updated_at)
VALUES ($1, $2, $3, $4, $5, $6, $7)
ON CONFLICT (service_id, key) DO UPDATE
SET value = EXCLUDED.value,
    is_secret = EXCLUDED.is_secret,
    updated_at = EXCLUDED.updated_at;
