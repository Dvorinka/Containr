# Umami Analytics Template

## Overview
Umami is a simple, fast, privacy-focused alternative to Google Analytics.

## Quick Start
```bash
# Create docker-compose.yml with the content below
docker-compose up -d
```

## Docker Compose
```yaml
version: '3.8'

services:
  umami:
    image: ghcr.io/umami-software/umami:postgresql-latest
    container_name: umami
    restart: always
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgresql://umami:umami@db:5432/umami
      APP_SECRET: replace-with-random-string
    depends_on:
      db:
        condition: service_healthy
    healthcheck:
      test: ["CMD-SHELL", "curl http://localhost:3000/api/heartbeat"]
      interval: 5s
      timeout: 5s
      retries: 5
    networks:
      - umami-network

  db:
    image: postgres:15-alpine
    container_name: umami-db
    restart: always
    environment:
      POSTGRES_DB: umami
      POSTGRES_USER: umami
      POSTGRES_PASSWORD: umami
    volumes:
      - umami-db-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
      interval: 5s
      timeout: 5s
      retries: 5
    networks:
      - umami-network

volumes:
  umami-db-data:

networks:
  umami-network:
    driver: bridge
```

## Environment Variables
- `DATABASE_URL`: PostgreSQL connection string
- `APP_SECRET`: Random string for application secrets (generate with: `openssl rand -base64 32`)

## Setup Guide
1. **Generate APP_SECRET**:
   ```bash
   openssl rand -base64 32
   ```

2. **Deploy**:
   ```bash
   docker-compose up -d
   ```

3. **Access**: Open http://localhost:3000

4. **Default Login**:
   - Username: `admin`
   - Password: `umami`

5. **Change Password**: Update admin password immediately

## Configuration
- **Tracking Code**: Get from dashboard after adding website
- **Data Retention**: Configure in admin settings
- **Geolocation**: Enable IP-based location tracking

## Volumes
- `umami-db-data`: PostgreSQL data persistence

## Ports
- `3000`: Umami web interface

## Reverse Proxy (Traefik)
```yaml
labels:
  - "traefik.enable=true"
  - "traefik.http.routers.umami.rule=Host(`analytics.yourdomain.com`)"
  - "traefik.http.routers.umami.tls=true"
  - "traefik.http.routers.umami.tls.certresolver=letsencrypt"
  - "traefik.http.services.umami.loadbalancer.server.port=3000"
```

## Backup
```bash
# Backup database
docker exec umami-db pg_dump -U umami umami > umami-backup.sql

# Restore database
docker exec -i umami-db psql -U umami umami < umami-backup.sql
```

## Monitoring
- **Health Check**: Container auto-restarts on failure
- **Logs**: `docker-compose logs -f umami`
- **Metrics**: Built-in analytics dashboard

## Security
- Change default credentials
- Use strong hash salt
- Enable HTTPS in production
- Regular database backups
