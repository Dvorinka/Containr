-- name: ListProjectsWithStatsByUser :many
SELECT
    p.id,
    p.name,
    p.description,
    p.owner_id,
    p.created_at,
    p.updated_at,
    COUNT(DISTINCT s.id)::bigint AS service_count,
    COUNT(DISTINCT d.id)::bigint AS deployment_count,
    COUNT(DISTINCT CASE WHEN s.status = 'running' THEN s.id END)::bigint AS running_services,
    (
        SELECT d2.created_at
        FROM deployments d2
        JOIN services s2 ON s2.id = d2.service_id
        WHERE s2.project_id = p.id
        ORDER BY d2.created_at DESC
        LIMIT 1
    ) AS last_deployment
FROM projects p
LEFT JOIN services s ON s.project_id = p.id
LEFT JOIN deployments d ON d.service_id = s.id
WHERE
    (p.owner_id = sqlc.arg(user_id) OR EXISTS (
        SELECT 1
        FROM project_members pm
        WHERE pm.project_id = p.id AND pm.user_id = sqlc.arg(user_id)
    ))
    AND (
        sqlc.narg(search)::text IS NULL
        OR p.name ILIKE ('%' || sqlc.narg(search)::text || '%')
        OR COALESCE(p.description, '') ILIKE ('%' || sqlc.narg(search)::text || '%')
    )
GROUP BY p.id, p.name, p.description, p.owner_id, p.created_at, p.updated_at
ORDER BY p.updated_at DESC
LIMIT sqlc.arg(limit_count) OFFSET sqlc.arg(offset_count);

-- name: CountProjectsByUser :one
SELECT COUNT(*)::bigint AS total
FROM projects p
WHERE
    (p.owner_id = sqlc.arg(user_id) OR EXISTS (
        SELECT 1
        FROM project_members pm
        WHERE pm.project_id = p.id AND pm.user_id = sqlc.arg(user_id)
    ))
    AND (
        sqlc.narg(search)::text IS NULL
        OR p.name ILIKE ('%' || sqlc.narg(search)::text || '%')
        OR COALESCE(p.description, '') ILIKE ('%' || sqlc.narg(search)::text || '%')
    );

-- name: GetProjectByIDForUser :one
SELECT p.id, p.name, p.description, p.owner_id, p.created_at, p.updated_at
FROM projects p
WHERE p.id = sqlc.arg(project_id)
  AND (
      p.owner_id = sqlc.arg(user_id)
      OR EXISTS (
          SELECT 1
          FROM project_members pm
          WHERE pm.project_id = p.id AND pm.user_id = sqlc.arg(user_id)
      )
  );

-- name: CreateProject :one
INSERT INTO projects (name, description, owner_id)
VALUES (sqlc.arg(name), sqlc.narg(description), sqlc.arg(owner_id))
RETURNING id, name, description, owner_id, created_at, updated_at;

-- name: InsertProjectEnvironment :exec
INSERT INTO environments (name, project_id)
VALUES (sqlc.arg(name), sqlc.arg(project_id));

-- name: GetProjectRoleForUser :one
SELECT (CASE
    WHEN p.owner_id = sqlc.arg(user_id) THEN 'owner'
    ELSE COALESCE(pm.role, '')
END)::text AS role
FROM projects p
LEFT JOIN project_members pm ON p.id = pm.project_id AND pm.user_id = sqlc.arg(user_id)
WHERE p.id = sqlc.arg(project_id);

-- name: UpdateProjectByID :execrows
UPDATE projects
SET
    name = COALESCE(sqlc.narg(name), name),
    description = COALESCE(sqlc.narg(description), description),
    updated_at = NOW()
WHERE id = sqlc.arg(project_id);

-- name: GetProjectOwnerByID :one
SELECT owner_id
FROM projects
WHERE id = sqlc.arg(project_id);

-- name: DeleteProjectByID :execrows
DELETE FROM projects
WHERE id = sqlc.arg(project_id);
