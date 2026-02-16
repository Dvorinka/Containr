# Docker Setup with Traefik

This guide will help you set up Containr with Docker, Traefik reverse proxy, and automatic SSL certificates.

## Prerequisites

- Docker and Docker Compose installed
- A domain name pointing to your server's IP address
- Port 80 and 443 open on your firewall

## Quick Start

1. **Clone and prepare the environment:**
   ```bash
   git clone <your-repo>
   cd containr
   cp .env.example .env
   ```

2. **Configure your environment:**
   Edit `.env` file with your settings:
   ```bash
   nano .env
   ```
   
   Required changes:
   - `DOMAIN=yourdomain.com` - Your actual domain
   - `ACME_EMAIL=admin@yourdomain.com` - Email for SSL certificates
   - `POSTGRES_PASSWORD` - Set a secure password
   - `REDIS_PASSWORD` - Set a secure password
   - `JWT_SECRET` - Generate a secure random string
   - `TRAEFIK_AUTH` - Generate basic auth for dashboard

3. **Generate Traefik authentication:**
   ```bash
   # Install apache2-utils if needed
   sudo apt-get install apache2-utils
   
   # Generate username:password hash
   htpasswd -nb admin yourpassword
   
   # Update TRAEFIK_AUTH in .env with the output
   ```

4. **Create necessary directories:**
   ```bash
   mkdir -p data/letsencrypt
   chmod 600 data/letsencrypt/acme.json
   ```

5. **Start the services:**
   ```bash
   docker-compose up -d
   ```

## Services and URLs

After deployment, your services will be available at:

- **Frontend**: `https://yourdomain.com`
- **Backend API**: `https://api.yourdomain.com`
- **Traefik Dashboard**: `https://traefik.yourdomain.com`

## Architecture

```
Internet → Traefik (Port 80/443)
    ├── Frontend (React/Nginx)
    ├── Backend (Go API)
    ├── PostgreSQL (Database)
    └── Redis (Cache)
```

## Configuration Files

### Docker Compose
- `docker-compose.yml` - Main orchestration file
- Defines all services, networks, and volumes
- Configures Traefik with automatic SSL

### Traefik Configuration
- `traefik.yml` - Static configuration
- `traefik-dynamic.yml` - Dynamic routing rules
- Automatic HTTP to HTTPS redirection
- Security headers and rate limiting

### Dockerfiles
- `Dockerfile.backend` - Go backend with multi-stage build
- `Dockerfile.frontend` - React frontend with Nginx
- Both use non-root users for security

## Security Features

- **Automatic SSL** via Let's Encrypt
- **HTTP to HTTPS** redirection
- **Security headers** (HSTS, XSS protection, etc.)
- **Rate limiting** on API endpoints
- **Basic authentication** on Traefik dashboard
- **Non-root containers** for all services
- **Health checks** for all services

## Monitoring and Logs

### Traefik Dashboard
Access at `https://traefik.yourdomain.com` with your configured credentials.

### Logs
```bash
# View all logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f traefik
docker-compose logs -f backend
docker-compose logs -f frontend
```

### Health Checks
All services include health checks:
```bash
# Check service status
docker-compose ps
```

## Maintenance

### Updates
```bash
# Pull latest images
docker-compose pull

# Recreate services with new images
docker-compose up -d --force-recreate
```

### Backups
```bash
# Backup PostgreSQL
docker-compose exec postgres pg_dump -U containr_user containr > backup.sql

# Backup Redis
docker-compose exec redis redis-cli --rdb /data/dump.rdb
```

### SSL Certificates
Let's Encrypt certificates are automatically renewed. Manual renewal:
```bash
docker-compose exec traefik traefik api check-letsencrypt
```

## Development Mode

For local development without SSL:
```bash
# Create development override
cat > docker-compose.override.yml << EOF
version: '3.8'
services:
  traefik:
    command:
      - "--api.dashboard=true"
      - "--providers.docker=true"
      - "--entrypoints.web.address=:80"
      - "--log.level=DEBUG"
    ports:
      - "80:80"
      - "8080:8080"
    labels:
      - "traefik.http.routers.traefik.rule=Host(`localhost`)"
      - "traefik.http.routers.traefik.entrypoints=web"
      - "traefik.http.routers.traefik.service=api@internal"
EOF

# Start with override
docker-compose up -d
```

## Troubleshooting

### Common Issues

1. **SSL Certificate Issues**
   ```bash
   # Check acme.json permissions
   ls -la data/letsencrypt/acme.json
   
   # Reset certificates
   rm data/letsencrypt/acme.json
   docker-compose restart traefik
   ```

2. **Port Conflicts**
   ```bash
   # Check what's using ports
   sudo netstat -tlnp | grep :80
   sudo netstat -tlnp | grep :443
   ```

3. **Database Connection**
   ```bash
   # Test database connection
   docker-compose exec backend ping postgres
   ```

4. **Permission Issues**
   ```bash
   # Fix volume permissions
   sudo chown -R 1001:1001 data/
   ```

### Performance Tuning

1. **Nginx Caching** - Already configured in `nginx.conf`
2. **Redis Caching** - Configure in your application
3. **Database Pooling** - Adjust connection limits in Go app

## Production Tips

1. **Monitoring** - Set up Prometheus/Grafana
2. **Alerting** - Configure alerts for service failures
3. **Backup Strategy** - Automated database backups
4. **Load Testing** - Test before production deployment
5. **Security Audit** - Regular security scans

## Support

For issues:
1. Check logs: `docker-compose logs`
2. Verify configuration: `docker-compose config`
3. Check service status: `docker-compose ps`
4. Review Traefik dashboard for routing issues
