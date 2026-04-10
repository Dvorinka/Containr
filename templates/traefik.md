# Traefik Reverse Proxy Template

## Overview
Traefik is a modern HTTP reverse proxy and load balancer that makes deploying microservices easy.

## Quick Start
```bash
# Create docker-compose.yml with the content below
docker-compose up -d
```

## Docker Compose
```yaml
version: '3.8'

services:
  traefik:
    image: traefik:v3.0
    container_name: traefik
    restart: unless-stopped
    command:
      - "--api=true"
      - "--api.insecure=true"
      - "--providers.docker=true"
      - "--providers.docker.exposedbydefault=false"
      - "--entrypoints.web.address=:80"
      - "--entrypoints.websecure.address=:443"
      - "--certificatesresolvers.letsencrypt.acme.httpchallenge=true"
      - "--certificatesresolvers.letsencrypt.acme.httpchallenge.entrypoint=web"
      - "--certificatesresolvers.letsencrypt.acme.email=your-email@example.com"
      - "--certificatesresolvers.letsencrypt.acme.storage=/letsencrypt/acme.json"
      - "--global.checknewversion=false"
      - "--global.sendanonymoususage=false"
      - "--entrypoints.web.http.redirections.entrypoint.to=websecure"
      - "--entrypoints.web.http.redirections.entrypoint.scheme=https"
    ports:
      - "80:80"
      - "443:443"
      - "8080:8080"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - ./letsencrypt:/letsencrypt
      - ./traefik.yml:/traefik.yml:ro
    networks:
      - traefik-network
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.traefik.rule=Host(`traefik.yourdomain.com`)"
      - "traefik.http.routers.traefik.entrypoints=websecure"
      - "traefik.http.routers.traefik.tls.certresolver=letsencrypt"
      - "traefik.http.services.traefik.loadbalancer.server.port=8080"

volumes:
  letsencrypt:

networks:
  traefik-network:
    driver: bridge
```

## Configuration File (`traefik.yml`)
```yaml
api:
  dashboard: true
  insecure: true

entryPoints:
  web:
    address: ":80"
    http:
      redirections:
        entryPoint:
          to: websecure
          scheme: https
  websecure:
    address: ":443"

providers:
  docker:
    exposedByDefault: false
    network: traefik-network

certificatesResolvers:
  letsencrypt:
    acme:
      email: your-email@example.com
      storage: /letsencrypt/acme.json
      httpChallenge:
        entryPoint: web
```

## Environment Variables
- `TRAEFIK_API_DASHBOARD`: Enable dashboard (true/false)
- `TRAEFIK_API_INSECURE`: Enable insecure dashboard (true/false)
- `TRAEFIK_CERTIFICATESRESOLVERS_LETSENCRYPT_ACME_EMAIL`: Let's Encrypt email

## Setup Guide
1. **Generate Let's Encrypt Email**:
   ```bash
   # Use your actual email for certificate notifications
   EMAIL="your-email@example.com"
   ```

2. **Create Directories**:
   ```bash
   mkdir -p letsencrypt
   ```

3. **Configure DNS**:
   - Point `yourdomain.com` and `*.yourdomain.com` to your server IP
   - Ensure ports 80 and 443 are accessible

4. **Deploy**:
   ```bash
   docker-compose up -d
   ```

5. **Access**:
   - **Dashboard**: http://traefik.yourdomain.com:8080
   - **API**: http://traefik.yourdomain.com:8080/api/

## Service Integration Examples

### Basic Web Service
```yaml
services:
  whoami:
    image: traefik/whoami
    container_name: whoami
    restart: unless-stopped
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.whoami.rule=Host(`whoami.yourdomain.com`)"
      - "traefik.http.routers.whoami.entrypoints=websecure"
      - "traefik.http.routers.whoami.tls.certresolver=letsencrypt"
      - "traefik.http.services.whoami.loadbalancer.server.port=80"
    networks:
      - traefik-network
```

### WordPress with HTTPS
```yaml
services:
  wordpress:
    image: wordpress:latest
    container_name: wordpress
    restart: unless-stopped
    environment:
      WORDPRESS_DB_HOST: db:3306
      WORDPRESS_DB_USER: wordpress
      WORDPRESS_DB_PASSWORD: wordpress
      WORDPRESS_DB_NAME: wordpress
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.wordpress.rule=Host(`blog.yourdomain.com`)"
      - "traefik.http.routers.wordpress.entrypoints=websecure"
      - "traefik.http.routers.wordpress.tls.certresolver=letsencrypt"
      - "traefik.http.services.wordpress.loadbalancer.server.port=80"
    networks:
      - traefik-network
      - default
```

### Nextcloud with HTTPS
```yaml
services:
  nextcloud:
    image: nextcloud:latest
    container_name: nextcloud
    restart: unless-stopped
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.nextcloud.rule=Host(`cloud.yourdomain.com`)"
      - "traefik.http.routers.nextcloud.entrypoints=websecure"
      - "traefik.http.routers.nextcloud.tls.certresolver=letsencrypt"
      - "traefik.http.services.nextcloud.loadbalancer.server.port=80"
      - "traefik.http.middlewares.nextcloud-headers.headers.customRequestHeaders.X-Forwarded-Proto=https"
      - "traefik.http.routers.nextcloud.middlewares=nextcloud-headers"
    networks:
      - traefik-network
```

## Advanced Configuration

### Middleware Examples
```yaml
# Rate limiting
labels:
  - "traefik.http.middlewares.ratelimit.ratelimit.average=100"
  - "traefik.http.middlewares.ratelimit.ratelimit.burst=50"
  - "traefik.http.routers.api.middlewares=ratelimit"

# Basic auth
labels:
  - "traefik.http.middlewares.auth.basicauth.users=user:$$apr1$$hash"

# Compression
labels:
  - "traefik.http.middlewares.compress.compress=true"
  - "traefik.http.routers.api.middlewares=compress"

# Security headers
labels:
  - "traefik.http.middlewares.secure.headers.stsSeconds=31536000"
  - "traefik.http.middlewares.secure.headers.stsIncludeSubdomains=true"
  - "traefik.http.middlewares.secure.headers.stsPreload=true"
  - "traefik.http.middlewares.secure.headers.forceSTSHeader=true"
  - "traefik.http.middlewares.secure.headers.frameDeny=true"
  - "traefik.http.middlewares.secure.headers.contentTypeNosniff=true"
  - "traefik.http.middlewares.secure.headers.browserXSSFilter=true"
  - "traefik.http.middlewares.secure.headers.referrerPolicy=strict-origin-when-cross-origin"
```

### Load Balancing
```yaml
services:
  app1:
    image: myapp:latest
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.app.rule=Host(`app.yourdomain.com`)"
      - "traefik.http.routers.app.entrypoints=websecure"
      - "traefik.http.routers.app.tls.certresolver=letsencrypt"
      - "traefik.http.services.app.loadbalancer.server.port=8080"
      - "traefik.http.services.app.loadbalancer.passHostHeader=true"

  app2:
    image: myapp:latest
    labels:
      - "traefik.enable=true"
      - "traefik.http.services.app.loadbalancer.server.port=8080"
```

## Monitoring and Metrics

### Prometheus Metrics
```yaml
# Add to traefik command
- "--metrics.prometheus=true"
- "--metrics.prometheus.addEntryPointsLabels=true"
- "--metrics.prometheus.addServicesLabels=true"
- "--entrypoints.metrics.address=:8082"
```

### Grafana Dashboard
```yaml
# Add to Prometheus scrape config
- job_name: 'traefik'
  static_configs:
    - targets: ['traefik:8082']
```

## Security Best Practices

### Secure Dashboard
```yaml
# Remove insecure dashboard
command:
  - "--api.dashboard=true"
  - "--api.insecure=false"
  - "--entrypoints.traefik.address=:8443"

labels:
  - "traefik.http.routers.traefik.rule=Host(`traefik.yourdomain.com`)"
  - "traefik.http.routers.traefik.entrypoints=websecure"
  - "traefik.http.routers.traefik.tls.certresolver=letsencrypt"
  - "traefik.http.routers.traefik.middlewares=auth"
  - "traefik.http.middlewares.auth.basicauth.users=admin:$$apr1$$hash"
```

### Network Security
```yaml
# Create internal network for services
networks:
  traefik-public:
    driver: bridge
  traefik-internal:
    driver: bridge
    internal: true

services:
  traefik:
    networks:
      - traefik-public
      - traefik-internal

  database:
    networks:
      - traefik-internal
```

## Backup Strategy
```bash
# Backup Let's Encrypt certificates
tar czf letsencrypt-backup.tar.gz letsencrypt/

# Backup Traefik configuration
cp traefik.yml traefik-backup.yml

# Restore certificates
tar xzf letsencrypt-backup.tar.gz
docker-compose restart traefik
```

## Performance Optimization
```yaml
# Enable connection reuse
command:
  - "--serversTransport.maxIdleConnsPerHost=100"
  - "--entrypoints.web.forwardingTimeouts.dialTimeout=30s"
  - "--entrypoints.web.forwardingTimeouts.responseHeaderTimeout=30s"
  - "--entrypoints.web.forwardingTimeouts.idleTimeout=180s"

# Resource limits
deploy:
  resources:
    limits:
      memory: 512M
      cpus: '0.5'
    reservations:
      memory: 256M
      cpus: '0.2'
```

## Troubleshooting
- **Certificate issues**: Check DNS and port 80 accessibility
- **Service not reachable**: Verify labels and network configuration
- **Performance problems**: Check resource usage and connection limits
- **Dashboard access**: Verify authentication configuration

## Maintenance
```bash
# Check logs
docker-compose logs -f traefik

# Check certificates
docker exec traefik ls -la /letsencrypt/

# Renew certificates (automatic)
# Traefik automatically renews certificates 30 days before expiry

# Update Traefik
docker-compose pull && docker-compose up -d
```

## Common Use Cases

### Multi-tenant Setup
```yaml
# Different domains for different services
services:
  service1:
    labels:
      - "traefik.http.routers.service1.rule=Host(`service1.yourdomain.com`)"

  service2:
    labels:
      - "traefik.http.routers.service2.rule=Host(`service2.yourdomain.com`)"
```

### Path-based Routing
```yaml
services:
  api:
    labels:
      - "traefik.http.routers.api.rule=Host(`yourdomain.com`) && PathPrefix(`/api`)"

  web:
    labels:
      - "traefik.http.routers.web.rule=Host(`yourdomain.com`)"
```

### WebSocket Support
```yaml
services:
  websocket-app:
    labels:
      - "traefik.http.routers.ws.rule=Host(`ws.yourdomain.com`)"
      - "traefik.http.routers.ws.entrypoints=websecure"
      - "traefik.http.services.ws.loadbalancer.server.port=8080"
```
