-- name: UpsertBuild :exec
INSERT INTO builds
 (id, project_id, service_id, status, progress, started_at, completed_at, image_name, image_tag, size, error, log, metadata, created_at, updated_at)
 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb, $14, $14)
 ON CONFLICT (id) DO UPDATE SET
   project_id = EXCLUDED.project_id,
   service_id = EXCLUDED.service_id,
   status = EXCLUDED.status,
   progress = EXCLUDED.progress,
   started_at = EXCLUDED.started_at,
   completed_at = EXCLUDED.completed_at,
   image_name = EXCLUDED.image_name,
   image_tag = EXCLUDED.image_tag,
   size = EXCLUDED.size,
   error = EXCLUDED.error,
   log = EXCLUDED.log,
   metadata = EXCLUDED.metadata,
   updated_at = EXCLUDED.updated_at;

-- name: GetBuild :one
SELECT id, project_id, service_id, status, progress, started_at, completed_at, image_name, image_tag, size, error, log, metadata
FROM builds
WHERE id = $1;

-- name: CancelBuild :execrows
UPDATE builds
SET status = 'cancelled',
    progress = 100,
    completed_at = $1,
    log = COALESCE(log, '') || $2,
    updated_at = $1
WHERE id = $3
  AND status NOT IN ('success', 'failed', 'cancelled');
