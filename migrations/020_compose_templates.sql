-- Store pure Docker Compose templates and CasaOS-style catalog metadata.
ALTER TABLE service_templates
    ADD COLUMN IF NOT EXISTS compose_yaml TEXT,
    ADD COLUMN IF NOT EXISTS screenshots JSONB DEFAULT '[]'::jsonb;

UPDATE service_templates
SET screenshots = '[]'::jsonb
WHERE screenshots IS NULL;

CREATE INDEX IF NOT EXISTS idx_service_templates_screenshots_gin ON service_templates USING gin(screenshots);

-- Convert older built-in JSON templates into Compose-backed templates so the catalog has one format.
UPDATE service_templates
SET
    compose_yaml = CONCAT(
        'name: ', lower(regexp_replace(name, '[^a-zA-Z0-9]+', '-', 'g')), E'\n\n',
        'x-containr:', E'\n',
        '  name: ', name, E'\n',
        '  description: ', COALESCE(NULLIF(description, ''), 'Self-hosted app template.'), E'\n',
        '  category: ', category, E'\n\n',
        'services:', E'\n',
        '  app:', E'\n',
        '    image: ${IMAGE:-', COALESCE(NULLIF(config->>'runtime', ''), 'alpine'), '}', E'\n',
        CASE
            WHEN NULLIF(config->>'start_command', '') IS NOT NULL
            THEN CONCAT('    command: "', replace(config->>'start_command', '"', '\"'), '"', E'\n')
            ELSE ''
        END,
        CASE
            WHEN config ? 'port'
            THEN CONCAT('    ports:', E'\n', '      - "${PORT:-', config->>'port', '}:', config->>'port', '"', E'\n')
            ELSE ''
        END
    ),
    config = jsonb_build_object(
        'type', 'compose',
        'format', 'docker-compose',
        'service_count', 1,
        'services', jsonb_build_array(jsonb_build_object(
            'name', 'app',
            'type', COALESCE(NULLIF(config->>'type', ''), 'web'),
            'image', COALESCE(NULLIF(config->>'runtime', ''), 'alpine'),
            'ports', CASE
                WHEN config ? 'port' THEN jsonb_build_array(CONCAT('${PORT:-', config->>'port', '}:', config->>'port'))
                ELSE '[]'::jsonb
            END
        ))
    )
WHERE compose_yaml IS NULL OR compose_yaml = '';
