# Compose Template Catalog Design

## Context

Containr templates must work like a CasaOS-style app catalog for a self-hosted platform. Templates are pure Docker Compose files. Users can import public or connected GitHub repositories, paste Compose YAML manually, review app metadata/screenshots, fill setup variables, and install into a project with a short path from catalog to running services.

## Decisions

- Docker Compose YAML is the template source of truth. No `containr.template.json` manifest is required.
- Valid Compose extension fields under `x-containr` may provide catalog metadata:
  - `name`
  - `description`
  - `category`
  - `icon`
  - `screenshots`
  - `developer`
  - `tagline`
- If metadata is absent, Containr derives sensible defaults from the Compose file path, repository name, and Compose `services` map.
- Variables are discovered from Compose placeholders such as `${BASE_URL}` and `${PORT:-8080}`.
- GitHub import supports connected GitHub providers and public GitHub URLs/repositories. Manual import supports pasting raw Docker Compose YAML.
- The catalog shows app cards with description, screenshots, service count, source metadata, and an install action.
- Install opens a quick setup flow: select/create project, review Compose services, fill variables, then create one Containr service per Compose service.

## Data Model

`service_templates` stores:

- existing catalog fields: name, description, category, logo, variables, source fields
- raw Compose YAML in `compose_yaml`
- screenshots as JSON in `screenshots`
- parsed Compose summary in `config`, including service names, images, build contexts, ports, commands, and environment keys

The raw Compose YAML stays available for future full-stack redeploys even when the current service model only maps a subset of Compose fields.

## Backend Flow

GitHub import:

1. Resolve repository and branch from `repo_full_name`, GitHub URL, or provider repository selection.
2. Find Compose file path from user input or defaults: `docker-compose.yml`, `docker-compose.yaml`, `compose.yml`, `compose.yaml`.
3. Fetch raw YAML using the connected provider token when provided, or public GitHub API access otherwise.
4. Parse metadata, services, screenshots, and variables.
5. Store a community template with `source_type = github`.

Manual import:

1. Accept raw Compose YAML and optional source URL/name override.
2. Parse and validate at least one Compose service.
3. Store a community template with `source_type = manual`.

Install:

1. Validate project ownership.
2. Substitute user-provided variables into supported service fields.
3. Create services for every Compose service.
4. Audit the install with template ID, source, and created service IDs.

## Frontend Flow

The Templates page becomes a catalog:

- Browse/search/filter templates.
- Cards show icon, description, screenshots preview, source, and service count.
- `Import from GitHub` supports connected provider selection plus manual GitHub URL/repo/path entry.
- `Paste Compose` accepts raw YAML in a large text area, CasaOS-style.
- `Install` opens a quick setup panel with project selection, service review, variable form, screenshots, and source link.

## Testing

- TypeScript build must pass.
- Focused backend packages must pass.
- Browser smoke checks Projects, Templates catalog, paste/import entry points, monitoring-only Usage, and project canvas rendering.

