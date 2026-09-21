#!/usr/bin/env bash
# Containr one-shot installer: creates .env with generated secrets, pulls the
# published images (or builds from source), boots the stack, and waits for
# the API to report healthy.
set -euo pipefail

cd "$(dirname "$0")"

info() { printf '\033[1;34m==>\033[0m %s\n' "$*"; }
err()  { printf '\033[1;31mError:\033[0m %s\n' "$*" >&2; }

# Dependencies
command -v docker >/dev/null 2>&1 || { err "docker not found. Install Docker: https://docs.docker.com/get-docker/"; exit 1; }
docker compose version >/dev/null 2>&1 || { err "docker compose (v2) not found. Update Docker or install the compose plugin."; exit 1; }
docker info >/dev/null 2>&1 || { err "docker daemon is not running or not reachable."; exit 1; }
command -v openssl >/dev/null 2>&1 || { err "openssl not found (needed to generate secrets)."; exit 1; }
command -v curl >/dev/null 2>&1 || { err "curl not found (needed for the health check)."; exit 1; }

# Env file
if [[ -f .env ]]; then
    info "Existing .env found - keeping it."
else
    info "Creating .env from .env.example with generated secrets..."
    cp .env.example .env

    gen() { openssl rand -hex 32; }
    setvar() { # setvar KEY VALUE  (| is safe: generated values are hex)
        sed -i.bak "s|^$1=.*|$1=$2|" .env
    }

    PG_PASS="$(gen)"; REDIS_PASS="$(gen)"
    setvar JWT_SECRET "$(gen)"
    setvar BETTER_AUTH_SECRET "$(gen)"
    setvar BETTER_AUTH_INTERNAL_TOKEN "$(gen)"
    setvar CONTAINR_AGENT_AUTH_TOKEN "$(gen)"

    # Password placeholders appear in several keys; replace them all so
    # POSTGRES_PASSWORD, DATABASE_URL and DB_PASSWORD stay in sync.
    sed -i.bak "s|your_secure_postgres_password|$PG_PASS|g" .env
    sed -i.bak "s|your_secure_redis_password|$REDIS_PASS|g" .env
    rm -f .env.bak
    info ".env created with random secrets."
fi

# Ports (overridable via environment, matching docker-compose.yml vars)
HTTP_PORT="${HTTP_PORT:-3000}"
API_PORT="${API_PORT:-8082}"

# Boot: pull published :latest images by default (CONTAINR_VERSION pins a
# release). Build from source instead with CONTAINR_BUILD=1, or as fallback
# when the registry is unreachable.
if [[ "${CONTAINR_BUILD:-}" == "1" ]]; then
    info "CONTAINR_BUILD=1 - building images from source..."
    docker compose build
elif ! docker compose pull; then
    info "Image pull failed - building from source instead..."
    docker compose build
fi
info "Starting the stack..."
docker compose up -d

# Wait for the API
info "Waiting for the API on http://localhost:${API_PORT}/health ..."
healthy=""
for _ in $(seq 1 90); do
    if curl -sf "http://localhost:${API_PORT}/health" >/dev/null 2>&1; then
        healthy=1
        break
    fi
    sleep 2
done

if [[ -z "$healthy" ]]; then
    err "API did not become healthy. Inspect with: docker compose logs backend"
    exit 1
fi

info "Containr is running."
echo "  UI:  http://localhost:${HTTP_PORT}"
echo "  API: http://localhost:${API_PORT}"
echo ""
echo "Manage with: docker compose logs -f | docker compose down"
