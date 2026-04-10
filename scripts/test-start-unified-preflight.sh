#!/bin/bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCRIPT="$ROOT_DIR/start-unified.sh"
ENV_FILE="$ROOT_DIR/.env.prod"

if ! command -v docker >/dev/null 2>&1; then
    echo "SKIP: docker command not found, skipping preflight tests"
    exit 0
fi

backup_file=""
if [ -f "$ENV_FILE" ]; then
    backup_file="$(mktemp)"
    cp "$ENV_FILE" "$backup_file"
fi

cleanup() {
    if [ -n "$backup_file" ] && [ -f "$backup_file" ]; then
        mv "$backup_file" "$ENV_FILE"
    else
        rm -f "$ENV_FILE"
    fi
}
trap cleanup EXIT

write_env() {
    cat > "$ENV_FILE" <<EOT
$1
EOT
}

expect_fail() {
    local name="$1"
    local expected="$2"
    shift 2

    set +e
    local output
    output="$($SCRIPT "$@" 2>&1)"
    local code=$?
    set -e

    if [ "$code" -eq 0 ]; then
        echo "FAIL [$name]: command unexpectedly succeeded"
        echo "$output"
        exit 1
    fi

    if ! grep -Fq "$expected" <<<"$output"; then
        echo "FAIL [$name]: expected error message not found"
        echo "Expected: $expected"
        echo "Output:"
        echo "$output"
        exit 1
    fi

    echo "PASS [$name]"
}

write_env "DOMAIN=localhost
JWT_SECRET=this-is-a-very-strong-production-secret-123
BETTER_AUTH_SECRET=this-is-a-very-strong-better-auth-secret-123
BETTER_AUTH_INTERNAL_TOKEN=internal-auth-token
COOKIE_SECURE=true
TRAEFIK_AUTH=admin:\$\$apr1\$\$hash\$\$hashvalue"
expect_fail "prod-domain" "DOMAIN must be set to a real domain for production." prod

write_env "DOMAIN=example.com
JWT_SECRET=dev_jwt_secret_key_change_in_production
BETTER_AUTH_SECRET=this-is-a-very-strong-better-auth-secret-123
BETTER_AUTH_INTERNAL_TOKEN=internal-auth-token
COOKIE_SECURE=true
TRAEFIK_AUTH=admin:\$\$apr1\$\$hash\$\$hashvalue"
expect_fail "prod-jwt" "JWT_SECRET must be set to a strong non-default value in production." prod

write_env "DOMAIN=example.com
JWT_SECRET=strong-secret
BETTER_AUTH_SECRET=this-is-a-very-strong-better-auth-secret-123
BETTER_AUTH_INTERNAL_TOKEN=internal-auth-token
COOKIE_SECURE=true
TRAEFIK_AUTH=admin:\$\$apr1\$\$hash\$\$hashvalue"
expect_fail "prod-jwt-length" "JWT_SECRET must be at least 32 characters in production." prod

write_env "DOMAIN=example.com
JWT_SECRET=this-is-a-very-strong-production-secret-123
BETTER_AUTH_SECRET=this-is-a-very-strong-better-auth-secret-123
BETTER_AUTH_INTERNAL_TOKEN=internal-auth-token
COOKIE_SECURE=true"
expect_fail "prod-traefik-auth" "TRAEFIK_AUTH must be set (basic auth hash) for dashboard protection in production." prod

write_env "DOMAIN=example.com
JWT_SECRET=this-is-a-very-strong-production-secret-123
BETTER_AUTH_SECRET=this-is-a-very-strong-better-auth-secret-123
BETTER_AUTH_INTERNAL_TOKEN=internal-auth-token
COOKIE_SECURE=true
TRAEFIK_AUTH=admin:\$\$apr1\$\$hash\$\$hashvalue"
expect_fail "prod-agent-auth" "CONTAINR_AGENT_AUTH_TOKEN or CONTAINR_AGENT_AUTH_TOKENS must be set in production." prod

write_env "DOMAIN=example.com
JWT_SECRET=this-is-a-very-strong-production-secret-123
BETTER_AUTH_SECRET=this-is-a-very-strong-better-auth-secret-123
BETTER_AUTH_INTERNAL_TOKEN=internal-auth-token
COOKIE_SECURE=true
TRAEFIK_AUTH=admin:\$\$apr1\$\$hash\$\$hashvalue
CONTAINR_AGENT_AUTH_TOKEN=agent-secret"
expect_fail "cloudflare-token" "CLOUDFLARED_TOKEN must be set." cloudflare

echo "All start-unified preflight tests passed"
