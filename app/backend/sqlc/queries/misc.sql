-- name: CountProjects :one
SELECT COUNT(*) FROM projects;

-- name: GetRegistryAuth :one
SELECT username, password FROM registries
WHERE owner_id::text = $1 AND host = $2;

-- name: UpdateServiceRuntimeMeta :exec
UPDATE services SET port = $1, healthcheck_path = $2 WHERE id = $3;

-- name: UpdateServiceDeployMeta :exec
UPDATE services SET port = $1, healthcheck_path = $2,
       volumes = COALESCE($3::jsonb, '[]'::jsonb),
       git_repo = NULLIF($4::text, ''), git_branch = NULLIF($5::text, ''), builder = $6
WHERE id = $7;

-- name: InsertEnvVar :exec
INSERT INTO environment_variables (id, service_id, key, value, is_secret, created_at, updated_at)
VALUES ($1, $2, $3, $4, $5, $6, $7);

-- name: DeleteProjectVariables :exec
DELETE FROM project_variables WHERE project_id = $1;

-- name: InsertProjectVariable :exec
INSERT INTO project_variables (id, project_id, key, value, is_secret, created_at, updated_at)
VALUES ($1, $2, $3, $4, $5, $6, $7);

-- name: GetProjectVariableValue :one
SELECT value FROM project_variables WHERE project_id = $1 AND key = $2;
