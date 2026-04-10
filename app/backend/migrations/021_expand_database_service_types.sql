-- Expand supported managed database types.

ALTER TABLE database_services
DROP CONSTRAINT IF EXISTS database_services_type_check;

ALTER TABLE database_services
ADD CONSTRAINT database_services_type_check
CHECK (type IN ('postgresql', 'redis', 'mysql', 'mariadb', 'mongodb', 'clickhouse', 'dragonfly'));
