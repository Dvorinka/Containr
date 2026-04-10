#!/bin/bash

# Production Readiness Check Script
# This script validates that all production requirements are met

set -e

echo "🔍 Containr Production Readiness Check"
echo "========================================"
echo ""

ERRORS=0
WARNINGS=0

# Color codes
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

error() {
    echo -e "${RED}❌ ERROR: $1${NC}"
    ((ERRORS++))
}

warning() {
    echo -e "${YELLOW}⚠️  WARNING: $1${NC}"
    ((WARNINGS++))
}

success() {
    echo -e "${GREEN}✅ $1${NC}"
}

info() {
    echo "ℹ️  $1"
}

# Check if production env file exists
ENV_FILE=".env.prod"
if [ ! -f "$ENV_FILE" ] && [ -f ".env" ]; then
    ENV_FILE=".env"
fi

if [ ! -f "$ENV_FILE" ]; then
    error "No production env file found. Copy .env.production.example to .env.prod"
else
    success "$ENV_FILE exists"
fi

# Load environment variables
if [ -f "$ENV_FILE" ]; then
    set -a
    # shellcheck disable=SC1090
    source "$ENV_FILE"
    set +a
fi

echo ""
echo "1. Environment Configuration"
echo "----------------------------"

# Check ENVIRONMENT
if [ "$ENVIRONMENT" != "production" ]; then
    warning "ENVIRONMENT is not set to 'production' (current: ${ENVIRONMENT:-not set})"
else
    success "ENVIRONMENT is set to production"
fi

# Check JWT_SECRET
if [ -z "$JWT_SECRET" ] || [ "$JWT_SECRET" = "your-secret-key-change-in-production" ]; then
    error "JWT_SECRET is not set or using default value"
elif [ ${#JWT_SECRET} -lt 32 ]; then
    error "JWT_SECRET must be at least 32 characters (current: ${#JWT_SECRET})"
else
    success "JWT_SECRET is properly configured"
fi

# Check BETTER_AUTH_SECRET
if [ -z "$BETTER_AUTH_SECRET" ] || [ "$BETTER_AUTH_SECRET" = "PLACEHOLDER_BETTER_AUTH_SECRET_CHANGE_ME_32CHARS_MIN" ]; then
    error "BETTER_AUTH_SECRET is not set or using placeholder"
elif [ ${#BETTER_AUTH_SECRET} -lt 32 ]; then
    error "BETTER_AUTH_SECRET must be at least 32 characters"
else
    success "BETTER_AUTH_SECRET is properly configured"
fi

# Check COOKIE_SECURE
if [ "$COOKIE_SECURE" != "true" ]; then
    error "COOKIE_SECURE must be 'true' in production (current: ${COOKIE_SECURE:-not set})"
else
    success "COOKIE_SECURE is enabled"
fi

# Check CORS_ORIGINS
if [ -z "$CORS_ORIGINS" ] || [ "$CORS_ORIGINS" = "*" ]; then
    error "CORS_ORIGINS must be set to specific domains in production"
elif [[ "$CORS_ORIGINS" == *"*"* ]]; then
    error "CORS_ORIGINS cannot contain wildcards in production"
else
    success "CORS_ORIGINS is properly configured"
fi

echo ""
echo "2. Database Configuration"
echo "-------------------------"

# Check database password
if [ -z "$POSTGRES_PASSWORD" ] || [ "$POSTGRES_PASSWORD" = "dev_password_123" ]; then
    error "POSTGRES_PASSWORD is not set or using default value"
else
    success "POSTGRES_PASSWORD is configured"
fi

# Check Redis password
if [ -z "$REDIS_PASSWORD" ] || [ "$REDIS_PASSWORD" = "dev_redis_123" ]; then
    error "REDIS_PASSWORD is not set or using default value"
else
    success "REDIS_PASSWORD is configured"
fi

# Check AUTO_MIGRATE
if [ "$AUTO_MIGRATE" = "true" ]; then
    success "AUTO_MIGRATE is enabled"
else
    warning "AUTO_MIGRATE is disabled - ensure migrations are run manually"
fi

# Check SEED_DATA_ON_START
if [ "$SEED_DATA_ON_START" = "true" ]; then
    error "SEED_DATA_ON_START must be false in production"
else
    success "SEED_DATA_ON_START is disabled"
fi

echo ""
echo "3. Security Configuration"
echo "-------------------------"

# Check CONTAINR_AGENT_AUTH_TOKEN
if [ -z "$CONTAINR_AGENT_AUTH_TOKEN" ] || [ "$CONTAINR_AGENT_AUTH_TOKEN" = "replace_with_strong_agent_secret" ]; then
    error "CONTAINR_AGENT_AUTH_TOKEN is not set or using placeholder"
else
    success "CONTAINR_AGENT_AUTH_TOKEN is configured"
fi

# Check BCRYPT_COST
if [ -z "$BCRYPT_COST" ]; then
    warning "BCRYPT_COST not set, using default"
elif [ "$BCRYPT_COST" -lt 12 ]; then
    warning "BCRYPT_COST should be at least 12 for production (current: $BCRYPT_COST)"
else
    success "BCRYPT_COST is properly configured"
fi

echo ""
echo "4. Domain Configuration"
echo "-----------------------"

# Check DOMAIN
if [ -z "$DOMAIN" ] || [ "$DOMAIN" = "localhost" ]; then
    error "DOMAIN must be set to your actual domain"
else
    success "DOMAIN is configured: $DOMAIN"
fi

# Check ACME_EMAIL
if [ -z "$ACME_EMAIL" ] || [ "$ACME_EMAIL" = "admin@localhost" ]; then
    warning "ACME_EMAIL should be set to a valid email for SSL certificates"
else
    success "ACME_EMAIL is configured"
fi

echo ""
echo "5. File Structure"
echo "-----------------"

# Check critical files
CRITICAL_FILES=(
    "docker-compose.yml"
    "infra/docker-compose.yml"
    "app/backend/Dockerfile"
    "app/frontend/Dockerfile"
    "app/backend/go.mod"
    "app/frontend/package.json"
)

for file in "${CRITICAL_FILES[@]}"; do
    if [ -f "$file" ]; then
        success "$file exists"
    else
        error "$file is missing"
    fi
done

echo ""
echo "6. Docker Configuration"
echo "-----------------------"

# Check if Docker is installed
if command -v docker &> /dev/null; then
    success "Docker is installed"
    docker --version
else
    error "Docker is not installed"
fi

# Check if Docker Compose is available
if docker compose version &> /dev/null; then
    success "Docker Compose is available"
    docker compose version
else
    error "Docker Compose is not available"
fi

# Validate docker-compose.yml
if [ -f "infra/docker-compose.yml" ]; then
    if docker compose -f infra/docker-compose.yml config -q 2>/dev/null; then
        success "docker-compose.yml is valid"
    else
        error "docker-compose.yml has syntax errors"
    fi
fi

echo ""
echo "7. Build Checks"
echo "---------------"

# Check backend build
if [ -f "app/backend/go.mod" ]; then
    cd app/backend
    if go mod verify &> /dev/null; then
        success "Backend Go modules are valid"
    else
        warning "Backend Go modules verification failed"
    fi
    cd ../..
fi

# Check frontend build
if [ -f "app/frontend/package.json" ]; then
    if [ -d "app/frontend/node_modules" ]; then
        success "Frontend dependencies are installed"
    else
        warning "Frontend dependencies not installed - run 'npm install'"
    fi
fi

echo ""
echo "========================================"
echo "Summary"
echo "========================================"

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}✅ All checks passed! Ready for production deployment.${NC}"
    exit 0
elif [ $ERRORS -eq 0 ]; then
    echo -e "${YELLOW}⚠️  $WARNINGS warning(s) found. Review before deploying.${NC}"
    exit 0
else
    echo -e "${RED}❌ $ERRORS error(s) and $WARNINGS warning(s) found.${NC}"
    echo -e "${RED}Please fix all errors before deploying to production.${NC}"
    exit 1
fi
