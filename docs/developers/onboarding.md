# Developer Onboarding Guide

Welcome to the Containr development team! This guide will help you get set up and contribute effectively to the project.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
- [Testing](#testing)
- [Code Style](#code-style)
- [Debugging](#debugging)
- [Contributing](#contributing)
- [Resources](#resources)

## Prerequisites

Before you begin, ensure you have the following installed:

### Required Tools
- **Go 1.24+** - Backend development
- **Node.js 18+** - Frontend development
- **Docker & Docker Compose** - Container development
- **Git** - Version control
- **Make** - Build automation

### Recommended Tools
- **VS Code** - Code editor with extensions
- **Postman** - API testing
- **Docker Desktop** - Container management
- **PostgreSQL Client** - Database management

### VS Code Extensions
```json
{
  "recommendations": [
    "golang.go",
    "bradlc.vscode-tailwindcss",
    "esbenp.prettier-vscode",
    "ms-vscode.vscode-typescript-next",
    "ms-vscode-remote.remote-containers",
    "ms-kubernetes-tools.vscode-kubernetes-tools"
  ]
}
```

## Development Setup

### 1. Clone the Repository

```bash
git clone https://github.com/your-org/containr.git
cd containr
```

### 2. Environment Setup

```bash
# Copy environment template
cp .env.example .env

# Edit environment variables
nano .env
```

Key environment variables:
```bash
# Development settings
DOMAIN=localhost
ENVIRONMENT=development

# Database
POSTGRES_USER=containr
POSTGRES_PASSWORD=containr
POSTGRES_DB=containr

# Redis
REDIS_PASSWORD=containr

# JWT
JWT_SECRET=your-super-secret-jwt-key-here

# Proxmox (optional)
PROXMOX_BASE_URL=https://your-proxmox:8006
PROXMOX_USERNAME=root@pam
PROXMOX_PASSWORD=your-proxmox-password
```

### 3. Initialize Development Environment

```bash
# Initialize all services
make init

# Start development mode
make dev
```

This will start:
- **Frontend**: http://localhost (React/Vite)
- **API**: http://api.localhost (Go backend)
- **Traefik Dashboard**: http://localhost:8080
- **Database**: PostgreSQL on port 5432
- **Redis**: Cache on port 6379

### 4. Verify Setup

```bash
# Check service status
make status

# View logs
make logs

# Test API
curl http://api.localhost/health
```

## Project Structure

```
containr/
├── cmd/                    # Application entry points
│   ├── server/             # Main server application
│   └── cli/               # CLI tool
├── internal/              # Private application code
│   ├── api/              # HTTP handlers and routes
│   ├── build/            # Build system (Nixpacks, Docker)
│   ├── cli/              # CLI commands and utilities
│   ├── config/           # Configuration management
│   ├── database/         # Database operations
│   ├── deployment/       # Deployment engine
│   ├── docker/           # Docker client wrapper
│   ├── metrics/          # Metrics collection
│   ├── middleware/       # HTTP middleware
│   ├── proxmox/         # Proxmox integration
│   ├── scaling/          # Auto-scaling engine
│   └── security/        # Security scanning
├── migrations/           # Database migrations
├── pkg/                 # Public library code
├── scripts/             # Build and utility scripts
├── src/                 # Frontend source code
│   ├── components/       # React components
│   ├── hooks/           # Custom React hooks
│   ├── contexts/        # React contexts
│   └── utils/           # Frontend utilities
├── docs/                # Documentation
├── tests/               # Test files
└── docker-compose.yml   # Development environment
```

## Development Workflow

### 1. Create a Feature Branch

```bash
git checkout -b feature/your-feature-name
```

### 2. Make Your Changes

#### Backend Changes
- Add new API endpoints in `internal/api/`
- Update database schema in `migrations/`
- Add tests in `tests/`
- Update documentation

#### Frontend Changes
- Create components in `src/components/`
- Add hooks in `src/hooks/`
- Update routing in `src/App.tsx`
- Follow existing patterns

### 3. Test Your Changes

```bash
# Run backend tests
go test ./...

# Run frontend tests
cd src && npm test

# Test full integration
make up
```

### 4. Commit Your Changes

```bash
# Stage changes
git add .

# Commit with conventional message
git commit -m "feat: add user authentication"

# Push to your fork
git push origin feature/your-feature-name
```

### 5. Create a Pull Request

1. Go to GitHub repository
2. Click "New Pull Request"
3. Select your branch
4. Fill out PR template
5. Request review from team members

## Testing

### Backend Testing

#### Unit Tests
```bash
# Run all tests
go test ./...

# Run specific package tests
go test ./internal/api

# Run with coverage
go test -cover ./...

# Generate coverage report
go test -coverprofile=coverage.out ./...
go tool cover -html=coverage.out
```

#### Integration Tests
```bash
# Run integration tests
go test -tags=integration ./tests/integration/...

# Test with real database
TEST_DB_URL=postgres://... go test ./tests/integration/...
```

#### API Testing
```bash
# Start API server
make dev

# Test endpoints
curl http://api.localhost/health
curl -X POST http://api.localhost/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}'
```

### Frontend Testing

#### Unit Tests
```bash
cd src
npm test
npm run test:coverage
```

#### E2E Tests
```bash
cd src
npm run test:e2e
```

#### Manual Testing
1. Open http://localhost
2. Test all user flows
3. Check responsive design
4. Verify accessibility

## Code Style

### Go Backend

#### Formatting
```bash
# Format code
go fmt ./...

# Import organization
goimports -w .

# Lint code
golangci-lint run
```

#### Naming Conventions
- **Packages**: `lowercase`, `snake_case`
- **Variables**: `camelCase` for local, `PascalCase` for exported
- **Functions**: `PascalCase` for exported, `camelCase` for private
- **Constants**: `UPPER_SNAKE_CASE`
- **Files**: `snake_case.go`

#### Example
```go
package api

import (
    "context"
    "net/http"
)

type UserService struct {
    repo UserRepository
}

func NewUserService(repo UserRepository) *UserService {
    return &UserService{repo: repo}
}

func (s *UserService) CreateUser(ctx context.Context, req CreateUserRequest) (*User, error) {
    user := &User{
        Name:  req.Name,
        Email: req.Email,
    }
    
    return s.repo.Create(ctx, user)
}
```

### TypeScript Frontend

#### Formatting
```bash
cd src
npm run format
npm run lint
npm run type-check
```

#### Naming Conventions
- **Components**: `PascalCase`
- **Hooks**: `camelCase` starting with `use`
- **Variables**: `camelCase`
- **Constants**: `UPPER_SNAKE_CASE`
- **Files**: `PascalCase.tsx` for components, `camelCase.ts` for utilities

#### Example
```tsx
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';

interface User {
  id: string;
  name: string;
  email: string;
}

export const UserProfile: React.FC<{ userId: string }> = ({ userId }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUser(userId).then(setUser).finally(() => setLoading(false));
  }, [userId]);

  if (loading) return <div>Loading...</div>;
  if (!user) return <div>User not found</div>;

  return (
    <div>
      <h1>{user.name}</h1>
      <p>{user.email}</p>
      <Button onClick={() => console.log('Edit user')}>
        Edit Profile
      </Button>
    </div>
  );
};
```

## Debugging

### Backend Debugging

#### VS Code Debugging
Create `.vscode/launch.json`:
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Launch Backend",
      "type": "go",
      "request": "launch",
      "mode": "auto",
      "program": "${workspaceFolder}/cmd/server",
      "env": {
        "ENVIRONMENT": "development"
      },
      "console": "integratedTerminal"
    }
  ]
}
```

#### Logging
```go
import "log"

// Standard logging
log.Printf("Processing user: %s", userID)

// Structured logging (if using logrus/zap)
logger.WithFields(logrus.Fields{
  "user_id": userID,
  "action": "create",
}).Info("User created successfully")
```

#### Database Debugging
```bash
# Connect to database
make shell-postgres

# View tables
\dt

# Query users
SELECT * FROM users LIMIT 10;
```

### Frontend Debugging

#### React DevTools
1. Install React DevTools browser extension
2. Open developer tools
3. Inspect component state and props

#### Network Debugging
```tsx
// Add request interceptor for debugging
axios.interceptors.request.use(request => {
  console.log('API Request:', request);
  return request;
});

axios.interceptors.response.use(response => {
  console.log('API Response:', response);
  return response;
});
```

## Contributing

### Types of Contributions

#### Bug Fixes
1. Create issue describing the bug
2. Create branch with fix
3. Add tests to prevent regression
4. Submit pull request

#### Features
1. Create issue for discussion
2. Get approval from maintainers
3. Implement feature with tests
4. Update documentation
5. Submit pull request

#### Documentation
1. Fix typos and improve clarity
2. Add examples and tutorials
3. Update API documentation
4. Submit pull request

### Pull Request Process

#### PR Template
```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing completed

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] Tests added/updated
```

#### Review Guidelines
1. **Code Quality**: Is the code clean and maintainable?
2. **Testing**: Are there adequate tests?
3. **Documentation**: Is the documentation updated?
4. **Performance**: Will this impact performance?
5. **Security**: Are there security implications?

## Resources

### Documentation
- [API Documentation](../api/openapi.yaml)
- [User Guides](../guides/)
- [Architecture Overview](../../README.md)

### Tools and Links
- [Go Documentation](https://golang.org/doc/)
- [React Documentation](https://react.dev/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Docker Documentation](https://docs.docker.com/)

### Team Communication
- **Slack**: #containr-dev
- **Discord**: Development channel
- **Email**: dev-team@containr.dev

### Getting Help

1. **Check Documentation**: Look for existing solutions
2. **Search Issues**: Check if problem is already reported
3. **Ask in Slack**: Get help from team members
4. **Create Issue**: Report bugs or request features

## Development Tips

### Productivity Tips
1. **Use Make Commands**: Leverage `make help` for available commands
2. **Hot Reload**: Frontend auto-reloads on file changes
3. **Database Migrations**: Run `make migrate` for schema changes
4. **Environment Variables**: Use `.env` for local development

### Common Issues
1. **Port Conflicts**: Change ports in `.env` if needed
2. **Permission Issues**: Use `sudo` for Docker commands
3. **Dependency Issues**: Run `go mod tidy` and `npm install`
4. **Cache Issues**: Clear Docker cache with `make clean`

### Best Practices
1. **Small Commits**: Keep changes focused and atomic
2. **Test Coverage**: Aim for >80% coverage
3. **Documentation**: Document public APIs and complex logic
4. **Security**: Never commit secrets or sensitive data

## Next Steps

Once you're comfortable with the basics:

1. **Explore Advanced Features**: Learn about scaling, monitoring, and security
2. **Contribute to Core**: Work on core platform features
3. **Mentor Others**: Help new developers get started
4. **Share Knowledge**: Write blog posts or give talks

Welcome aboard! 🚀 We're excited to have you on the team.
