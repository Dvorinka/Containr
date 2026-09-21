#!/usr/bin/env bash
# Containr installer. Works from a source checkout, or standalone:
#   curl -fsSL https://raw.githubusercontent.com/Dvorinka/Containr/main/install.sh | bash
#
# Creates .env with generated secrets, pulls the published images (or builds
# from source), boots the stack, and waits for the API to report healthy.
#
# Env overrides (all optional):
#   CONTAINR_DIR      install dir when not run from a clone (default ./containr)
#   CONTAINR_VERSION  image tag to pull (default latest, e.g. 0.1.1)
#   CONTAINR_REF      git ref for downloaded files (default main)
#   CONTAINR_BUILD=1  force building images from source
#   HTTP_PORT API_PORT POSTGRES_PORT REDIS_PORT  host port remaps
set -euo pipefail

cd "$(dirname "$0")" 2>/dev/null || true

info() { printf '\033[1;34m==>\033[0m %s\n' "$*"; }
err()  { printf '\033[1;31mError:\033[0m %s\n' "$*" >&2; }

CONTAINR_REF="${CONTAINR_REF:-main}"
RAW_BASE="https://raw.githubusercontent.com/Dvorinka/Containr/${CONTAINR_REF}"

# Dependencies
command -v docker >/dev/null 2>&1 || { err "docker not found. Install Docker: https://docs.docker.com/get-docker/"; exit 1; }
docker compose version >/dev/null 2>&1 || { err "docker compose (v2) not found. Update Docker or install the compose plugin."; exit 1; }
docker info >/dev/null 2>&1 || { err "docker daemon is not running or not reachable."; exit 1; }
command -v openssl >/dev/null 2>&1 || { err "openssl not found (needed to generate secrets)."; exit 1; }
command -v curl >/dev/null 2>&1 || { err "curl not found (needed for downloads and the health check)."; exit 1; }

# Install location: explicit CONTAINR_DIR wins; otherwise reuse the current
# dir when it already looks like a checkout/install, else ./containr.
if [[ -n "${CONTAINR_DIR:-}" ]]; then
    mkdir -p "$CONTAINR_DIR"
    cd "$CONTAINR_DIR"
elif [[ ! -f docker-compose.yml || ! -f .env.example ]]; then
    CONTAINR_DIR="./containr"
    mkdir -p "$CONTAINR_DIR"
    cd "$CONTAINR_DIR"
fi

# Fetch compose file and env template when running standalone. Existing
# files are kept so re-runs stay idempotent.
if [[ ! -f docker-compose.yml ]]; then
    info "Downloading docker-compose.yml (${CONTAINR_REF})..."
    curl -fsSL "$RAW_BASE/docker-compose.yml" -o docker-compose.yml
fi
if [[ ! -f .env.example ]]; then
    info "Downloading .env.example (${CONTAINR_REF})..."
    curl -fsSL "$RAW_BASE/.env.example" -o .env.example
fi

# Source tarball, only needed when building images locally.
ensure_source() {
    [[ -d app/backend ]] && return 0
    command -v tar >/dev/null 2>&1 || { err "tar not found (needed to unpack the source)."; exit 1; }
    info "Downloading source (${CONTAINR_REF})..."
    curl -fsSL "https://codeload.github.com/Dvorinka/Containr/tar.gz/${CONTAINR_REF}" | tar xz --strip-components=1
}

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
    setvar ENVIRONMENT "production"
    setvar JWT_SECRET "$(gen)"
    setvar BETTER_AUTH_SECRET "$(gen)"
    setvar BETTER_AUTH_INTERNAL_TOKEN "$(gen)"
    setvar CONTAINR_AGENT_AUTH_TOKEN "$(gen)"

    # Password placeholders appear in several keys; replace them all so
    # POSTGRES_PASSWORD, DATABASE_URL and DB_PASSWORD stay in sync.
    sed -i.bak "s|your_secure_postgres_password|$PG_PASS|g" .env
    sed -i.bak "s|your_secure_redis_password|$REDIS_PASS|g" .env

    # Persist any overrides passed via the environment.
    for v in HTTP_PORT API_PORT POSTGRES_PORT REDIS_PORT CONTAINR_VERSION; do
        [[ -n "${!v:-}" ]] && setvar "$v" "${!v}"
    done

    rm -f .env.bak
    info ".env created with random secrets."
fi

# Ports for the health wait: environment first, then .env, then defaults.
HTTP_PORT="${HTTP_PORT:-$(grep -E '^HTTP_PORT=' .env | cut -d= -f2)}"
API_PORT="${API_PORT:-$(grep -E '^API_PORT=' .env | cut -d= -f2)}"
HTTP_PORT="${HTTP_PORT:-3000}"
API_PORT="${API_PORT:-8082}"

# Boot: pull published images by default (CONTAINR_VERSION pins a release).
# Build from source with CONTAINR_BUILD=1, or as fallback when the registry
# is unreachable.
if [[ "${CONTAINR_BUILD:-}" == "1" ]]; then
    info "CONTAINR_BUILD=1 - building images from source..."
    ensure_source
    docker compose build
elif ! docker compose pull; then
    info "Image pull failed - building from source instead..."
    ensure_source
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
echo "Manage with: (cd ${CONTAINR_DIR:-.} && docker compose logs -f | docker compose down)"
