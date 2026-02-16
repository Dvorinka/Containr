# Advanced Configuration Guide

This guide covers advanced configuration options for optimizing your Containr deployments.

## Table of Contents

- [Build Configuration](#build-configuration)
- [Environment Management](#environment-management)
- [Resource Allocation](#resource-allocation)
- [Networking](#networking)
- [Security](#security)
- [Scaling Policies](#scaling-policies)
- [Custom Domains and SSL](#custom-domains-and-ssl)
- [Health Checks](#health-checks)

## Build Configuration

### Nixpacks Configuration

Nixpacks is the default build system. You can customize it using a `nixpacks.toml` file:

```toml
# nixpacks.toml
[phases.setup]
nixPkgs = ["...", "nodejs", "npm"]

[phases.build]
cmds = ["npm run build"]

[start]
cmd = "npm start"

[variables]
NODE_ENV = "production"
PORT = "8080"
```

### Custom Dockerfile

For complex applications, use a custom Dockerfile:

```dockerfile
# Dockerfile
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

FROM node:18-alpine AS runtime

WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./

EXPOSE 8080
USER node
CMD ["npm", "start"]
```

### Build Caching

Enable build caching for faster deployments:

1. Go to service settings
2. Enable "Build Caching"
3. Configure cache settings:
   - **Cache TTL**: Time to keep cached layers (default: 7 days)
   - **Max Cache Size**: Maximum cache size per service

### Multi-Stage Builds

Optimize image size with multi-stage builds:

```dockerfile
# Build stage
FROM golang:1.21 AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o app

# Runtime stage
FROM alpine:latest
RUN apk --no-cache add ca-certificates
WORKDIR /root/
COPY --from=builder /app/app .
EXPOSE 8080
CMD ["./app"]
```

## Environment Management

### Environment Scopes

Variables can be scoped at different levels:

```bash
# Project-level (shared across all services)
DATABASE_URL=postgresql://...

# Service-level (specific to one service)
API_KEY=service-specific-key

# Environment-specific (production only)
NODE_ENV=production
DEBUG=false
```

### Variable Types

#### Plain Text Variables
```bash
API_KEY=your-api-key-here
```

#### Secret Variables
```bash
# Marked as secret in UI - masked in logs
DATABASE_PASSWORD=super-secret-password
```

#### File Variables
For configuration files:
```bash
# Upload .env file as variable
ENV_FILE_CONTENT=KEY1=value1\nKEY2=value2
```

### Dynamic Variables

Use Containr's built-in variables:

```bash
# Auto-populated by Containr
PORT=8080                    # Assigned port
CONTAINR_SERVICE_NAME=my-app  # Service name
CONTAINR_PROJECT_NAME=my-proj # Project name
CONTAINR_DEPLOYMENT_ID=abc123 # Deployment ID
```

## Resource Allocation

### CPU Allocation

Configure CPU limits and requests:

```yaml
# Service resource configuration
resources:
  cpu:
    request: "100m"    # Minimum CPU (0.1 core)
    limit: "1000m"     # Maximum CPU (1 core)
  memory:
    request: "128Mi"    # Minimum memory
    limit: "512Mi"     # Maximum memory
```

### Memory Allocation

Memory configuration examples:

```yaml
# Small service (API, worker)
resources:
  memory: "256Mi"

# Medium service (web app)
resources:
  memory: "512Mi"

# Large service (database, analytics)
resources:
  memory: "2Gi"
```

### Storage Allocation

Persistent storage for databases:

```yaml
# Database service
resources:
  storage:
    size: "10Gi"
    type: "ssd"
    backup: true
```

## Networking

### Service-to-Service Communication

Services can communicate internally:

```bash
# Environment variables for internal URLs
DATABASE_URL=postgresql://my-db:5432/myapp
REDIS_URL=redis://my-redis:6379
API_URL=http://my-api:8080
```

### Port Configuration

Configure service ports:

```yaml
# Service configuration
networking:
  port: 8080              # Internal port
  public: true            # Expose publicly
  health_check: "/health"  # Health check endpoint
```

### Custom Domains

Set up custom domains:

1. Go to service settings → "Domains"
2. Add your domain: `app.yourdomain.com`
3. Configure DNS:
   ```
   CNAME app.yourdomain.com -> your-service.containr.app
   ```
4. Wait for SSL certificate provisioning

### Load Balancing

Configure load balancing strategies:

```yaml
# Load balancer configuration
load_balancer:
  strategy: "round_robin"  # round_robin, least_connections, ip_hash
  health_check:
    path: "/health"
    interval: "30s"
    timeout: "5s"
    retries: 3
```

## Security

### Security Scans

Enable automated security scanning:

1. Go to project settings → "Security"
2. Enable "Security Scanning"
3. Configure scan frequency:
   - **On every deployment**
   - **Daily**
   - **Weekly**

### Vulnerability Management

Review and manage vulnerabilities:

```bash
# Security scan results
Critical: 2 vulnerabilities
High: 5 vulnerabilities
Medium: 12 vulnerabilities
Low: 8 vulnerabilities
```

### Network Policies

Restrict network access:

```yaml
# Network policy example
network_policy:
  egress:
    - allow:
        - dns: true
        - http: ["api.example.com"]
        - https: ["github.com", "registry.npmjs.org"]
  ingress:
    - allow:
        - port: 8080
          from: ["load-balancer"]
```

### Secrets Management

Best practices for secrets:

1. **Never commit secrets** to version control
2. **Use Containr secrets** for sensitive data
3. **Rotate secrets regularly**
4. **Use least privilege** principle

```bash
# Good: Use environment variables
DATABASE_URL=${DATABASE_URL}

# Bad: Hardcoded secrets
DATABASE_URL=postgresql://user:password@host:5432/db
```

## Scaling Policies

### Manual Scaling

Set replica count manually:

```yaml
# Manual scaling configuration
scaling:
  replicas: 3  # Run 3 instances
```

### Auto-Scaling

Configure automatic scaling:

```yaml
# Auto-scaling configuration
scaling:
  min_replicas: 1
  max_replicas: 10
  metrics:
    - type: "cpu"
      target: "70%"      # Scale when CPU > 70%
    - type: "memory"
      target: "80%"      # Scale when memory > 80%
    - type: "requests_per_second"
      target: 100        # Scale when RPS > 100
  policies:
    scale_up_cooldown: "60s"    # Wait 60s between scale-ups
    scale_down_cooldown: "300s"  # Wait 5m between scale-downs
```

### Scaling Strategies

Different scaling strategies for different needs:

#### CPU-Based Scaling
```yaml
scaling:
  metrics:
    - type: "cpu"
      target: "70%"
```

#### Memory-Based Scaling
```yaml
scaling:
  metrics:
    - type: "memory"
      target: "80%"
```

#### Request-Based Scaling
```yaml
scaling:
  metrics:
    - type: "requests_per_second"
      target: 100
```

#### Custom Metrics
```yaml
scaling:
  metrics:
    - type: "custom"
      name: "queue_length"
      target: 50
```

## Custom Domains and SSL

### Domain Configuration

Set up custom domains with advanced options:

```yaml
# Domain configuration
domains:
  - name: "app.yourdomain.com"
    type: "primary"
    ssl: true
    redirect_www: true
  - name: "api.yourdomain.com"
    type: "api"
    ssl: true
  - name: "cdn.yourdomain.com"
    type: "cdn"
    ssl: true
    cache_ttl: "1h"
```

### SSL Certificates

SSL is automatically configured:

1. **Automatic provisioning**: Let's Encrypt certificates
2. **Auto-renewal**: Certificates renewed 30 days before expiry
3. **Wildcard support**: For `*.yourdomain.com`
4. **Custom certificates**: Upload your own certificates

### CDN Integration

Configure CDN for static assets:

```yaml
# CDN configuration
cdn:
  enabled: true
  provider: "cloudflare"  # cloudflare, fastly, custom
  cache_ttl: "1d"
  compression: true
  minify: true
```

## Health Checks

### HTTP Health Checks

Configure HTTP health checks:

```yaml
# HTTP health check
health_check:
  type: "http"
  path: "/health"
  method: "GET"
  expected_status: 200
  headers:
    User-Agent: "Containr-Health-Check"
  timeout: "10s"
  interval: "30s"
  retries: 3
  start_period: "60s"
```

### TCP Health Checks

For services that don't have HTTP endpoints:

```yaml
# TCP health check
health_check:
  type: "tcp"
  port: 8080
  timeout: "5s"
  interval: "30s"
  retries: 3
```

### Custom Health Checks

Implement custom health check logic:

```javascript
// Express.js example
app.get('/health', (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    checks: {
      database: checkDatabase(),
      redis: checkRedis(),
      memory: checkMemory()
    }
  };
  
  const isHealthy = Object.values(health.checks).every(check => check.status === 'ok');
  res.status(isHealthy ? 200 : 503).json(health);
});

function checkDatabase() {
  // Check database connection
  return { status: 'ok', latency: '5ms' };
}

function checkRedis() {
  // Check Redis connection
  return { status: 'ok', latency: '2ms' };
}

function checkMemory() {
  const usage = process.memoryUsage();
  const isHealthy = usage.heapUsed < 512 * 1024 * 1024; // 512MB
  return { 
    status: isHealthy ? 'ok' : 'error',
    usage: `${Math.round(usage.heapUsed / 1024 / 1024)}MB`
  };
}
```

## Advanced Examples

### Microservices Architecture

Example of a microservices setup:

```yaml
# API Gateway
services:
  - name: "api-gateway"
    type: "web"
    resources:
      cpu: "500m"
      memory: "256Mi"
    scaling:
      min_replicas: 2
      max_replicas: 5
    domains:
      - name: "api.yourdomain.com"

# User Service
  - name: "user-service"
    type: "web"
    resources:
      cpu: "200m"
      memory: "128Mi"
    scaling:
      min_replicas: 1
      max_replicas: 3

# Database
  - name: "user-db"
    type: "database"
    database_type: "postgresql"
    resources:
      storage: "20Gi"
```

### Full-Stack Application

Example with frontend, backend, and database:

```yaml
# Frontend (React/Vue)
services:
  - name: "frontend"
    type: "web"
    build:
      builder: "nixpacks"
      build_command: "npm run build"
      start_command: "npm run start"
    domains:
      - name: "app.yourdomain.com"

# Backend (Node.js)
  - name: "backend"
    type: "web"
    build:
      builder: "nixpacks"
      start_command: "npm start"
    environment:
      DATABASE_URL: "postgresql://user-db:5432/myapp"
      REDIS_URL: "redis://redis:6379"
    scaling:
      min_replicas: 1
      max_replicas: 5

# Database
  - name: "user-db"
    type: "database"
    database_type: "postgresql"
    resources:
      storage: "10Gi"

# Cache
  - name: "redis"
    type: "database"
    database_type: "redis"
    resources:
      memory: "256Mi"
```

## Troubleshooting

### Common Issues

#### Build Failures
- Check build logs for specific errors
- Verify `nixpacks.toml` or `Dockerfile` syntax
- Ensure all dependencies are declared

#### Runtime Errors
- Check environment variables
- Verify health check endpoints
- Review resource limits

#### Scaling Issues
- Monitor metrics during scaling events
- Check scaling policies and thresholds
- Review resource allocation

### Debug Mode

Enable debug mode for troubleshooting:

```yaml
# Debug configuration
debug:
  enabled: true
  log_level: "debug"
  verbose_logs: true
  profile_requests: true
```

## Best Practices

1. **Start small** and scale based on metrics
2. **Monitor resource usage** regularly
3. **Use health checks** for all services
4. **Implement proper logging** and monitoring
5. **Secure your applications** with proper secrets management
6. **Test scaling policies** in staging environment
7. **Regular security scans** and updates

## Next Steps

- Learn about [Monitoring and Alerts](./monitoring.md)
- Explore [CI/CD Integration](./cicd.md)
- Understand [Backup and Recovery](./backup.md)
- Review [Performance Optimization](./performance.md)
