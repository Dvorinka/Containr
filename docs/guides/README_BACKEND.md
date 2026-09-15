# Containr Backend Setup

## Quick Start

### Prerequisites
- Go 1.21+
- PostgreSQL 12+
- Redis (optional)

### Environment Variables

Create a `.env` file or set these environment variables:

```bash
# Database
DATABASE_URL=postgres://containr:password@localhost:5432/containr?sslmode=disable
REDIS_URL=redis://localhost:6379

# Server
PORT=8080
ENVIRONMENT=development

# Security
JWT_SECRET=your-secret-key-change-in-production

# Frontend (for CORS)
FRONTEND_URL=http://localhost:3000
```

### Database Setup

1. Create PostgreSQL database:
```sql
CREATE DATABASE containr;
CREATE USER containr WITH PASSWORD 'password';
GRANT ALL PRIVILEGES ON DATABASE containr TO containr;
```

2. Run migrations (handled automatically on server start)

### Running the Server

```bash
# Build
go build -o bin/server cmd/server/main.go

# Run
./bin/server
```

The server will start on `http://localhost:8080`

### API Endpoints

#### Health Check
- `GET /health` - Server health status

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
```

### Adding New Endpoints

1. Create handler functions in `internal/api/`
2. Add routes in `internal/api/routes.go`
3. Update database schema if needed in `migrations/`
