-- Expand official database templates and normalize variable metadata.

UPDATE service_templates
SET
    config = '{"type":"database","runtime":"postgres","port":5432}',
    variables = '[{"key":"POSTGRES_USER","label":"Username","default":"postgres","required":true,"secret":false,"description":"Database username"},{"key":"POSTGRES_PASSWORD","label":"Password","default":"","required":true,"secret":true,"description":"Database password"},{"key":"POSTGRES_DB","label":"Database Name","default":"app","required":true,"secret":false,"description":"Database name"}]'
WHERE id = 'tpl-postgres';

UPDATE service_templates
SET
    config = '{"type":"database","runtime":"redis","port":6379}',
    variables = '[{"key":"REDIS_PASSWORD","label":"Password","default":"","required":false,"secret":true,"description":"Optional Redis password"}]'
WHERE id = 'tpl-redis';

UPDATE service_templates
SET
    config = '{"type":"database","runtime":"mongodb","port":27017}',
    variables = '[{"key":"MONGO_INITDB_ROOT_USERNAME","label":"Root Username","default":"admin","required":true,"secret":false,"description":"MongoDB root username"},{"key":"MONGO_INITDB_ROOT_PASSWORD","label":"Root Password","default":"","required":true,"secret":true,"description":"MongoDB root password"}]'
WHERE id = 'tpl-mongodb';

INSERT INTO service_templates (id, name, description, category, logo, config, variables, is_official)
VALUES
    ('tpl-mysql', 'MySQL Database', 'Managed MySQL database service', 'database', 'https://cdn.simpleicons.org/mysql', '{"type":"database","runtime":"mysql","port":3306}', '[{"key":"MYSQL_DATABASE","label":"Database Name","default":"app","required":true,"secret":false,"description":"Database name"},{"key":"MYSQL_USER","label":"Username","default":"app","required":true,"secret":false,"description":"Application database user"},{"key":"MYSQL_PASSWORD","label":"User Password","default":"","required":true,"secret":true,"description":"Application user password"},{"key":"MYSQL_ROOT_PASSWORD","label":"Root Password","default":"","required":true,"secret":true,"description":"Root password"}]', true),
    ('tpl-mariadb', 'MariaDB Database', 'Managed MariaDB database service', 'database', 'https://cdn.simpleicons.org/mariadb', '{"type":"database","runtime":"mariadb","port":3306}', '[{"key":"MARIADB_DATABASE","label":"Database Name","default":"app","required":true,"secret":false,"description":"Database name"},{"key":"MARIADB_USER","label":"Username","default":"app","required":true,"secret":false,"description":"Application database user"},{"key":"MARIADB_PASSWORD","label":"User Password","default":"","required":true,"secret":true,"description":"Application user password"},{"key":"MARIADB_ROOT_PASSWORD","label":"Root Password","default":"","required":true,"secret":true,"description":"Root password"}]', true),
    ('tpl-clickhouse', 'ClickHouse Database', 'Column-oriented analytics database', 'database', 'https://cdn.simpleicons.org/clickhouse', '{"type":"database","runtime":"clickhouse","port":8123}', '[{"key":"CLICKHOUSE_DB","label":"Database Name","default":"app","required":false,"secret":false,"description":"Default database name"},{"key":"CLICKHOUSE_USER","label":"Username","default":"default","required":false,"secret":false,"description":"ClickHouse username"},{"key":"CLICKHOUSE_PASSWORD","label":"Password","default":"","required":false,"secret":true,"description":"ClickHouse password"}]', true),
    ('tpl-dragonfly', 'Dragonfly Database', 'Redis-compatible in-memory data store powered by Dragonfly', 'database', 'https://cdn.simpleicons.org/redis', '{"type":"database","runtime":"dragonfly","port":6379}', '[{"key":"DRAGONFLY_PASSWORD","label":"Password","default":"","required":false,"secret":true,"description":"Optional Dragonfly password"}]', true)
ON CONFLICT (id) DO NOTHING;
