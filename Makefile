.PHONY: help dev prod test clean build deploy check-prod

# Default target
help:
	@echo "Containr - Container Management Platform"
	@echo ""
	@echo "Available targets:"
	@echo "  make dev          - Start development environment"
	@echo "  make prod         - Start production environment"
	@echo "  make test         - Run all tests"
	@echo "  make test-backend - Run backend tests"
	@echo "  make test-frontend- Run frontend tests"
	@echo "  make build        - Build all containers"
	@echo "  make clean        - Stop and remove all containers"
	@echo "  make check-prod   - Run production readiness checks"
	@echo "  make logs         - Show logs from all services"
	@echo "  make migrate      - Run database migrations"
	@echo "  make help         - Show this help message"

# Development environment
dev:
	@echo "Starting development environment..."
	./start-unified.sh dev

# Production environment
prod: check-prod
	@echo "Starting production environment..."
	./start-unified.sh prod

# Run all tests
test: test-backend test-frontend
	@echo "All tests completed"

# Backend tests
test-backend:
	@echo "Running backend tests..."
	cd app/backend && go test ./... -v

# Frontend tests
test-frontend:
	@echo "Running frontend tests..."
	cd app/frontend && npm test

# Build all containers
build:
	@echo "Building all containers..."
	docker compose -f infra/docker-compose.yml build

# Clean up
clean:
	@echo "Stopping and removing all containers..."
	docker compose -f infra/docker-compose.yml down -v
	docker compose down -v

# Production readiness check
check-prod:
	@echo "Running production readiness checks..."
	@bash scripts/production-check.sh

# Show logs
logs:
	docker compose -f infra/docker-compose.yml logs -f

# Run database migrations
migrate:
	@echo "Running database migrations..."
	cd app/backend && go run cmd/migrate/main.go up

# Database backup
backup:
	@echo "Creating database backup..."
	docker compose -f infra/docker-compose.yml exec postgres pg_dump -U $(POSTGRES_USER) $(POSTGRES_DB) > backup_$(shell date +%Y%m%d_%H%M%S).sql

# Database restore
restore:
	@echo "Restoring database from backup..."
	@read -p "Enter backup file path: " backup_file; \
	docker compose -f infra/docker-compose.yml exec -T postgres psql -U $(POSTGRES_USER) $(POSTGRES_DB) < $$backup_file

# Install dependencies
install:
	@echo "Installing dependencies..."
	cd app/backend && go mod download
	cd app/frontend && npm install

# Format code
format:
	@echo "Formatting code..."
	cd app/backend && go fmt ./...
	cd app/frontend && npm run format || true

# Lint code
lint:
	@echo "Linting code..."
	cd app/backend && go vet ./...
	cd app/frontend && npm run lint

# Generate API types
generate-api:
	@echo "Generating API types..."
	cd app/frontend && npm run generate:api

# Security scan
security-scan:
	@echo "Running security scan..."
	cd app/backend && go list -json -m all | docker run --rm -i sonatypecommunity/nancy:latest sleuth || true
	cd app/frontend && npm audit || true

# Update dependencies
update-deps:
	@echo "Updating dependencies..."
	cd app/backend && go get -u ./...
	cd app/frontend && npm update

# Docker prune
prune:
	@echo "Pruning Docker resources..."
	docker system prune -af --volumes

# Show status
status:
	@echo "Container status:"
	docker compose -f infra/docker-compose.yml ps
