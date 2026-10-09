-- name: ListBanners :many
SELECT banners.*
FROM banners
ORDER BY created_at DESC;

-- name: ListActiveBanners :many
SELECT banners.*
FROM banners
WHERE active
  AND (starts_at IS NULL OR starts_at <= now())
  AND (ends_at IS NULL OR ends_at > now())
ORDER BY created_at DESC;

-- name: GetBannerByID :one
SELECT banners.*
FROM banners
WHERE id = $1;

-- name: CreateBanner :one
INSERT INTO banners (title, body, level, active, dismissible, created_by, starts_at, ends_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
RETURNING banners.*;

-- name: UpdateBanner :one
UPDATE banners
SET title = $2,
    body = $3,
    level = $4,
    active = $5,
    dismissible = $6,
    starts_at = $7,
    ends_at = $8,
    updated_at = now()
WHERE id = $1
RETURNING banners.*;

-- name: DeleteBanner :exec
DELETE FROM banners
WHERE id = $1;
