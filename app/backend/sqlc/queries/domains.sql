-- name: ListServiceDomains :many
SELECT id, service_id, domain, is_default, cert_type, cert_status, last_checked_at, created_at
FROM service_domains
WHERE service_id = $1
ORDER BY is_default DESC, created_at ASC;

-- name: CountServiceDomains :one
SELECT COUNT(*) FROM service_domains WHERE service_id = $1;

-- name: ClearServiceDomainDefault :exec
UPDATE service_domains SET is_default = false WHERE service_id = $1;

-- name: CreateServiceDomain :one
INSERT INTO service_domains (service_id, domain, is_default)
VALUES ($1, $2, $3)
RETURNING id, service_id, domain, is_default, cert_type, cert_status, created_at;

-- name: DeleteServiceDomain :execrows
DELETE FROM service_domains WHERE id = $1 AND service_id = $2;

-- name: SetServiceDomainDefault :execrows
UPDATE service_domains SET is_default = (id = $1) WHERE service_id = $2;

-- name: TouchServiceDomainChecked :exec
UPDATE service_domains SET last_checked_at = NOW() WHERE id = $1;

-- name: GetServiceDomainDefault :one
SELECT domain FROM service_domains WHERE service_id = $1 AND is_default;

-- name: GetServiceDomainFirst :one
SELECT domain FROM service_domains WHERE service_id = $1 ORDER BY created_at ASC LIMIT 1;

-- name: SetServiceLegacyDomain :exec
UPDATE services SET domain = $1 WHERE id = $2;

-- name: GetServicePlacementBrief :one
SELECT name, node_id, COALESCE(spread, false) AS spread FROM services WHERE id = $1;

-- name: GetServiceAccess :one
SELECT maintenance_mode, basic_auth_users FROM services WHERE id = $1;

-- name: ServiceWriteAccess :one
SELECT EXISTS(
    SELECT 1 FROM services s JOIN projects p ON s.project_id = p.id
    WHERE s.id = $1 AND (p.owner_id = $2 OR $3::bool)
) AS allowed;
