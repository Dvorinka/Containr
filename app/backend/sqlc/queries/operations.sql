-- name: ListActiveOperationDeployments :many
SELECT d.id, d.service_id, s.name AS service_name, p.name AS project_name, d.status,
       COALESCE(d.image_name, '') AS image, d.error, d.started_at, d.completed_at, d.created_at
FROM deployments d
JOIN services s ON s.id = d.service_id
JOIN projects p ON p.id = s.project_id
WHERE d.status IN ('queued','pending','building','deploying','rolling_back')
  AND (p.is_approved OR p.owner_id = $1 OR $2::bool
    OR EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = $1))
ORDER BY d.created_at ASC;

-- name: ListRecentFailedDeployments :many
SELECT d.id, d.service_id, s.name AS service_name, p.name AS project_name, d.status,
       COALESCE(d.image_name, '') AS image, d.error, d.started_at, d.completed_at, d.created_at
FROM deployments d
JOIN services s ON s.id = d.service_id
JOIN projects p ON p.id = s.project_id
WHERE d.status IN ('failed','cancelled','rolled_back')
  AND d.updated_at > NOW() - INTERVAL '24 hours'
  AND (p.is_approved OR p.owner_id = $1 OR $2::bool
    OR EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = $1))
ORDER BY d.updated_at DESC
LIMIT 20;

-- name: ListRecentCronRuns :many
SELECT e.id, j.name AS job_name, j.schedule, e.status, e.started_at, e.finished_at, e.error
FROM cron_executions e
JOIN cron_jobs j ON j.id = e.cron_job_id
JOIN projects p ON p.id = j.project_id
WHERE e.started_at > NOW() - INTERVAL '24 hours'
  AND (p.is_approved OR p.owner_id = $1 OR $2::bool
    OR EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = $1))
ORDER BY e.started_at DESC
LIMIT 30;

-- name: ListRecentOperationBackups :many
SELECT b.id, b.database_id, ds.name AS db_name, b.status, b.size, b.created_at, b.completed_at
FROM database_backups b
JOIN database_services ds ON ds.id = b.database_id
WHERE b.created_at > NOW() - INTERVAL '24 hours'
  AND (ds.user_id = $1 OR $2::bool)
ORDER BY b.created_at DESC
LIMIT 20;
