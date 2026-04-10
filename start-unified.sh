#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOCAL_COMPOSE_FILE="$ROOT_DIR/docker-compose.yml"
SELFHOSTED_COMPOSE_FILE="$ROOT_DIR/infra/docker-compose.yml"
LOCAL_ENV_FILE="$ROOT_DIR/.env"
PROD_ENV_FILE="$ROOT_DIR/.env.prod"

info() {
    printf '[INFO] %s\n' "$1"
}

success() {
    printf '[OK] %s\n' "$1"
}

error() {
    printf '[ERROR] %s\n' "$1" >&2
}

docker_compose() {
    docker compose "$@"
}

ensure_file() {
    local file_path="$1"
    local message="$2"
    if [[ ! -f "$file_path" ]]; then
        error "$message"
        exit 1
    fi
}

load_env() {
    local env_file="$1"
    ensure_file "$env_file" "Environment file not found: $env_file"
    set -a
    # shellcheck disable=SC1090
    source "$env_file"
    set +a
}

require_prod_prerequisites() {
    load_env "$PROD_ENV_FILE"

    if [[ -z "${DOMAIN:-}" || "${DOMAIN:-}" == "localhost" ]]; then
        error "DOMAIN must be set to a real domain for production."
        exit 1
    fi

    if [[ -z "${JWT_SECRET:-}" || "${JWT_SECRET:-}" == "dev_jwt_secret_key_change_in_production" || "${JWT_SECRET:-}" == "your-secret-key-change-in-production" ]]; then
        error "JWT_SECRET must be set to a strong non-default value in production."
        exit 1
    fi

    if (( ${#JWT_SECRET} < 32 )); then
        error "JWT_SECRET must be at least 32 characters in production."
        exit 1
    fi

    if [[ -z "${BETTER_AUTH_SECRET:-}" || "${BETTER_AUTH_SECRET:-}" == "PLACEHOLDER_BETTER_AUTH_SECRET_CHANGE_ME_32CHARS_MIN" || ${#BETTER_AUTH_SECRET} -lt 32 ]]; then
        error "BETTER_AUTH_SECRET must be set to a strong non-placeholder value in production."
        exit 1
    fi

    if [[ -z "${BETTER_AUTH_INTERNAL_TOKEN:-}" || "${BETTER_AUTH_INTERNAL_TOKEN:-}" == "PLACEHOLDER_INTERNAL_AUTH_TOKEN" ]]; then
        error "BETTER_AUTH_INTERNAL_TOKEN must be set in production."
        exit 1
    fi

    if [[ "${COOKIE_SECURE:-false}" != "true" ]]; then
        error "COOKIE_SECURE must be true in production."
        exit 1
    fi

    if [[ -z "${TRAEFIK_AUTH:-}" ]]; then
        error "TRAEFIK_AUTH must be set (basic auth hash) for dashboard protection in production."
        exit 1
    fi

    if [[ -z "${CONTAINR_AGENT_AUTH_TOKEN:-}" && -z "${CONTAINR_AGENT_AUTH_TOKENS:-}" ]]; then
        error "CONTAINR_AGENT_AUTH_TOKEN or CONTAINR_AGENT_AUTH_TOKENS must be set in production."
        exit 1
    fi
}

show_help() {
    cat <<'EOF'
Usage: ./start-unified.sh <command>

Commands:
  dev         Start the full local stack from docker-compose.yml
  prod        Start the self-hosted production stack from infra/docker-compose.yml
  cloudflare  Start the self-hosted production stack with the cloudflared profile
  stop        Stop both local and self-hosted compose stacks
  logs        Show logs for the local stack
  status      Show compose status for both stacks
  config      Validate both compose files
  clean       Stop both stacks and remove volumes
  help        Show this help message
EOF
}

start_dev() {
    ensure_file "$LOCAL_ENV_FILE" "Missing $LOCAL_ENV_FILE. Copy .env.example to .env first."
    info "Starting local full stack with $LOCAL_COMPOSE_FILE"
    docker_compose --env-file "$LOCAL_ENV_FILE" -f "$LOCAL_COMPOSE_FILE" up -d --build
    success "Local stack is starting."
}

start_prod() {
    require_prod_prerequisites
    info "Starting self-hosted production stack with $SELFHOSTED_COMPOSE_FILE"
    docker_compose --env-file "$PROD_ENV_FILE" -f "$SELFHOSTED_COMPOSE_FILE" up -d --build
    success "Self-hosted production stack is starting."
}

start_cloudflare() {
    require_prod_prerequisites
    if [[ -z "${CLOUDFLARED_TOKEN:-}" ]]; then
        error "CLOUDFLARED_TOKEN must be set."
        exit 1
    fi

    info "Starting self-hosted production stack with Cloudflare tunnel"
    docker_compose --env-file "$PROD_ENV_FILE" -f "$SELFHOSTED_COMPOSE_FILE" --profile cloudflared up -d --build
    success "Cloudflare-enabled production stack is starting."
}

stop_all() {
    info "Stopping compose stacks"
    docker_compose --env-file "$LOCAL_ENV_FILE" -f "$LOCAL_COMPOSE_FILE" down --remove-orphans 2>/dev/null || true
    docker_compose --env-file "$PROD_ENV_FILE" -f "$SELFHOSTED_COMPOSE_FILE" --profile cloudflared down --remove-orphans 2>/dev/null || true
    success "Compose stacks stopped."
}

show_logs() {
    ensure_file "$LOCAL_ENV_FILE" "Missing $LOCAL_ENV_FILE. Copy .env.example to .env first."
    docker_compose --env-file "$LOCAL_ENV_FILE" -f "$LOCAL_COMPOSE_FILE" logs -f
}

show_status() {
    info "Local stack"
    docker_compose --env-file "$LOCAL_ENV_FILE" -f "$LOCAL_COMPOSE_FILE" ps 2>/dev/null || true
    info "Self-hosted production stack"
    docker_compose --env-file "$PROD_ENV_FILE" -f "$SELFHOSTED_COMPOSE_FILE" ps 2>/dev/null || true
}

show_config() {
    ensure_file "$LOCAL_ENV_FILE" "Missing $LOCAL_ENV_FILE. Copy .env.example to .env first."
    ensure_file "$PROD_ENV_FILE" "Missing $PROD_ENV_FILE. Copy .env.production.example to .env.prod first."
    info "Validating local compose file"
    docker_compose --env-file "$LOCAL_ENV_FILE" -f "$LOCAL_COMPOSE_FILE" config -q
    info "Validating self-hosted production compose file"
    docker_compose --env-file "$PROD_ENV_FILE" -f "$SELFHOSTED_COMPOSE_FILE" config -q
    success "Compose configuration is valid."
}

clean_all() {
    info "Removing local and self-hosted compose stacks with volumes"
    docker_compose --env-file "$LOCAL_ENV_FILE" -f "$LOCAL_COMPOSE_FILE" down -v --remove-orphans 2>/dev/null || true
    docker_compose --env-file "$PROD_ENV_FILE" -f "$SELFHOSTED_COMPOSE_FILE" --profile cloudflared down -v --remove-orphans 2>/dev/null || true
    success "Compose cleanup finished."
}

case "${1:-help}" in
    dev)
        start_dev
        ;;
    prod)
        start_prod
        ;;
    cloudflare)
        start_cloudflare
        ;;
    stop)
        stop_all
        ;;
    logs)
        show_logs
        ;;
    status)
        show_status
        ;;
    config)
        show_config
        ;;
    clean)
        clean_all
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        error "Unknown command: ${1}"
        show_help
        exit 1
        ;;
esac
