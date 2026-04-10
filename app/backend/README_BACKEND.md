# Containr Backend Setup

## Quick Start

### Prerequisites
- Go 1.21+
- PostgreSQL 12+
- Redis (optional)

### Environment Variables

Create a `.env` file for local backend work, and use the repository root `.env.prod` for production deployments:

```bash
# Database
DATABASE_URL=postgres://containr:password@localhost:5432/containr?sslmode=disable
MAX_CONNECTIONS=25
MAX_IDLE_CONNECTIONS=5
CONN_MAX_LIFETIME=5m
CONN_MAX_IDLE_TIME=5m
AUTO_MIGRATE=true
MIGRATION_LOCK_TIMEOUT=2m
SEED_DATA_ON_START=false
REDIS_URL=redis://:password@localhost:6379/0

# Server
PORT=8080
ENVIRONMENT=development
HOST=0.0.0.0
MAX_REQUEST_BODY_BYTES=10485760

# Security
# In production this must be at least 32 characters.
JWT_SECRET=your-production-jwt-secret-at-least-32-characters
# In production this must be true.
COOKIE_SECURE=false

# Frontend (for CORS)
CORS_ORIGINS=http://localhost:3000,http://localhost:8080

# Optional: trust reverse proxy CIDR (recommended behind Traefik)
TRUSTED_PROXY_CIDR=172.20.0.0/16
```

### Database Setup

1. Create PostgreSQL database:
```sql
CREATE DATABASE containr;
CREATE USER containr WITH PASSWORD 'password';
GRANT ALL PRIVILEGES ON DATABASE containr TO containr;
```

2. Run migrations (handled automatically on server start)
   ```bash
   # Optional: run all migrations without starting the API server
   go run cmd/migrate/main.go up

   # Legacy chain only
   go run cmd/migrate/main.go legacy-up

   # Goose chain only
   go run cmd/migrate/main.go goose-up
   go run cmd/migrate/main.go goose-status
   go run cmd/migrate/main.go goose-create add_new_table
   ```

3. Managed database runtime notes
   - The `/api/v1/databases` endpoints provision real database containers when the backend has access to Docker.
   - Database status is reconciled against real container state on read operations.
   - Metrics are collected from Docker container stats when available, with fallback values when unavailable.
   - Backups are persisted in `database_backups` and executed as Docker volume snapshots into the `containr-db-backups` volume.
   - Restores rehydrate the managed DB volume from the selected completed backup archive.
   - If Docker is unavailable, runtime lifecycle operations fail safely and backup jobs are marked failed.
   - Supported managed types: `postgresql`, `redis`, `dragonfly`, `mysql`, `mariadb`, `mongodb`, `clickhouse`.
   - Deploying a `database` service template via `/api/v1/templates/:id/deploy` now creates a managed database entry and starts provisioning.

### Running the Server

```bash
# Build
go build -o bin/server cmd/server/main.go

# Run
./bin/server
```

The server will start on `http://localhost:8080`

### Embedded Better Auth

The backend now starts the Better Auth runtime as a child process during boot. In Docker this is fully bundled into the backend image. For non-Docker local runs, install the auth runtime dependencies first:

```bash
cd auth
npm ci
cd ..
```

### API Endpoints

#### Health Check
- `GET /live` - Liveness probe (process is running)
- `GET /health` - Dependency-aware health status (DB + Redis)
- `GET /ready` - Readiness probe (same checks as `/health`)

#### Authentication
- `POST /api/v1/auth/login` - User login
- `POST /api/v1/auth/register` - User registration

#### User Profile
- `GET /api/v1/user/profile` - Get user profile (requires auth)
- `PUT /api/v1/user/profile` - Update user profile (requires auth)

#### Projects
- `GET /api/v1/projects` - List user projects (requires auth)
- `POST /api/v1/projects` - Create project (requires auth)
- `GET /api/v1/projects/:id` - Get project details (requires auth)
- `PUT /api/v1/projects/:id` - Update project (requires auth)
- `DELETE /api/v1/projects/:id` - Delete project (requires auth)

### Authentication

Include JWT token in Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

### Example Usage

1. Register a user:
```bash
curl -X POST http://localhost:8080/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "name": "Test User"
  }'
```

2. Login:
```bash
curl -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

3. Create a project (using token from login):
```bash
curl -X POST http://localhost:8080/api/v1/projects \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "name": "My Project",
    "description": "A test project"
  }'
```

## Development

### Project Structure
```
cmd/server/          - Main application entry point
internal/
├── api/             - HTTP handlers and routes
├── config/          - Configuration management
├── database/        - Database connections and migrations
└── middleware/      - HTTP middleware
migrations/          - SQL migration files
migrations_goose/    - Goose-managed migrations for new schema changes
```

### Adding New Endpoints

1. Create handler functions in `internal/api/`
2. Add routes in `internal/api/routes.go`
3. Update database schema:
   - Legacy chain lives in `migrations/` and is executed first.
   - New migrations must be added to `migrations_goose/` using goose format (`-- +goose Up/Down`).
   - Keep legacy files immutable after they are shipped.

### SQLC (Type-Safe Queries)

Generate Go query code from SQL definitions:

```bash
go run github.com/sqlc-dev/sqlc/cmd/sqlc@v1.27.0 generate
```

Files:
- Config: `sqlc.yaml`
- Schema for parsing: `sqlc/schema.sql`
- Query definitions: `sqlc/queries/*.sql`
- Generated output: `internal/database/sqlcdb/`
