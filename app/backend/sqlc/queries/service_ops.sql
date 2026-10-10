-- name: CountServicesByName :one
SELECT COUNT(*) FROM services WHERE project_id = $1 AND name = $2;

-- name: GetServiceEnvironment :one
SELECT COALESCE(environment, '') FROM services WHERE id = $1;

-- name: CloneServiceRow :exec
INSERT INTO services
    (id, project_id, name, environment_id, service_type, source_type, source_url, image_name,
     build_command, start_command, type, status, image, command, environment,
     git_repo, git_branch, build_path, cpu, memory, replicas, port, domain,
     healthcheck_path, restart_policy, volumes, maintenance_mode, basic_auth_users,
     builder, cpu_reserve, memory_reserve, static_build_cmd, static_dir,
     traefik_labels, created_at, updated_at)
SELECT $1, $2, $3, $4, service_type, source_type, source_url, image_name,
     build_command, start_command, type, 'stopped', image, command, $5,
     git_repo, git_branch, build_path, cpu, memory, replicas, port, domain,
     healthcheck_path, restart_policy, volumes, $6, $7,
     builder, cpu_reserve, memory_reserve, static_build_cmd, static_dir,
     traefik_labels, $8, $8
FROM services s WHERE s.id = $9;

-- name: CloneServiceDomains :exec
INSERT INTO service_domains (service_id, domain, is_default, cert_type)
SELECT $1, domain, is_default, cert_type FROM service_domains sd WHERE sd.service_id = $2;

-- name: CloneServiceVariables :exec
INSERT INTO environment_variables (id, service_id, key, value, is_secret)
SELECT gen_random_uuid(), $1, key, value, is_secret FROM environment_variables ev WHERE ev.service_id = $2;

-- name: DeleteServiceByID :exec
DELETE FROM services WHERE id = $1;

-- name: MoveServiceProject :execrows
UPDATE services SET project_id = $1, environment_id = $2, updated_at = $3 WHERE id = $4;

-- name: GetProjectOwner :one
SELECT owner_id FROM projects WHERE id = $1;
