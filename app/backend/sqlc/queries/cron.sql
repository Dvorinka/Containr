-- name: GetCronJobProjectID :one
SELECT project_id FROM cron_jobs WHERE id = $1;

-- name: GetCronOwnerViaService :one
SELECT p.owner_id FROM projects p
JOIN services s ON s.project_id = p.id
WHERE s.id = $1;

-- name: InsertCronJob :exec
INSERT INTO cron_jobs (id, project_id, service_id, name, schedule, command, timezone, enabled, next_run_at, retention, created_at, updated_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12);

-- name: GetCronJob :one
SELECT id, project_id, service_id, name, schedule, command, timezone,
       enabled, last_run_at, next_run_at, last_status, last_output,
       retention, created_at, updated_at
FROM cron_jobs WHERE id = $1;

-- name: GetCronJobOwner :one
SELECT p.owner_id FROM cron_jobs cj
JOIN projects p ON cj.project_id = p.id
WHERE cj.id = $1;

-- name: DeleteCronJob :exec
DELETE FROM cron_jobs WHERE id = $1;

-- name: ListCronExecutions :many
SELECT id, cron_job_id, started_at, finished_at, status, output, error
FROM cron_executions
WHERE cron_job_id = $1
ORDER BY started_at DESC
LIMIT 100;

-- name: GetCronJobForTrigger :one
SELECT cj.service_id, cj.command, cj.schedule, cj.timezone, cj.retention, p.owner_id
FROM cron_jobs cj
JOIN projects p ON cj.project_id = p.id
WHERE cj.id = $1;

-- name: InsertCronExecution :exec
INSERT INTO cron_executions (id, cron_job_id, started_at, status)
VALUES ($1, $2, $3, $4);

-- name: ListDueCronJobs :many
SELECT id, project_id, service_id, name, schedule, command, timezone, enabled, retention
FROM cron_jobs
WHERE enabled = TRUE AND next_run_at IS NOT NULL AND next_run_at <= NOW();

-- name: FinishCronExecution :exec
UPDATE cron_executions SET finished_at = $1, status = $2, output = $3, error = $4 WHERE id = $5;

-- name: UpdateCronJobRun :exec
UPDATE cron_jobs SET last_run_at = $1, last_status = $2, last_output = $3, next_run_at = $4 WHERE id = $5;

-- name: TrimCronExecutions :exec
DELETE FROM cron_executions WHERE cron_executions.cron_job_id = $1 AND cron_executions.id NOT IN (
    SELECT ce.id FROM cron_executions ce WHERE ce.cron_job_id = $1
    ORDER BY ce.started_at DESC LIMIT $2);
