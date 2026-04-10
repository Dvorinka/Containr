# Immich Photo & Video Backup Template

## Overview
Immich is a self-hosted photo and video backup solution directly from your mobile phone.

## Quick Start
```bash
# Create docker-compose.yml with the content below
docker-compose up -d
```

## Docker Compose
```yaml
version: '3.8'

name: immich

services:
  immich-server:
    container_name: immich_server
    image: ghcr.io/immich-app/immich-server:release
    volumes:
      - ./upload:/usr/src/app/upload
      - /etc/localtime:/etc/localtime:ro
    environment:
      REDIS_HOSTNAME: immich-redis
      DB_HOSTNAME: immich-postgres
      DB_USERNAME: immich
      DB_PASSWORD: immich
      DB_DATABASE_NAME: immich
      TYPESENSE_API_KEY: replace-with-typesense-api-key
    ports:
      - "2283:2283"
    depends_on:
      - immich-redis
      - immich-postgres
      - immich-typesense
    restart: always
    networks:
      - immich-network

  immich-machine-learning:
    container_name: immich_machine_learning
    image: ghcr.io/immich-app/immich-machine-learning:release
    volumes:
      - model-cache:/cache
    environment:
      REDIS_HOSTNAME: immich-redis
      DB_HOSTNAME: immich-postgres
      DB_USERNAME: immich
      DB_PASSWORD: immich
      DB_DATABASE_NAME: immich
      TYPESENSE_API_KEY: replace-with-typesense-api-key
    restart: always
    networks:
      - immich-network

  immich-redis:
    image: redis:7-alpine
    container_name: immich-redis
    restart: always
    networks:
      - immich-network

  immich-postgres:
    image: postgres:15-alpine
    container_name: immich-postgres
    restart: always
    environment:
      POSTGRES_DB: immich
      POSTGRES_USER: immich
      POSTGRES_PASSWORD: immich
    volumes:
      - immich-postgres-data:/var/lib/postgresql/data
    networks:
      - immich-network

  immich-typesense:
    image: typesense/typesense:0.24.0
    container_name: immich-typesense
    restart: always
    environment:
      TYPESENSE_API_KEY: replace-with-typesense-api-key
      TYPESENSE_DATA_DIR: /data
    volumes:
      - immich-typesense-data:/data
    networks:
      - immich-network

volumes:
  immich-postgres-data:
  immich-typesense-data:
  model-cache:

networks:
  immich-network:
    driver: bridge
```

## Environment Variables
- `REDIS_HOSTNAME`: Redis service name
- `DB_HOSTNAME`: PostgreSQL service name
- `DB_USERNAME`: Database username
- `DB_PASSWORD`: Database password
- `DB_DATABASE_NAME`: Database name
- `TYPESENSE_API_KEY`: API key for search functionality

## Setup Guide
1. **Generate Typesense API Key**:
   ```bash
   openssl rand -base64 32
   ```

2. **Create Directories**:
   ```bash
   mkdir -p upload
   mkdir -p immich-data
   ```

3. **Deploy**:
   ```bash
   docker-compose up -d
   ```

4. **Access**: Open http://localhost:2283

5. **Initial Setup**:
   - Create admin account
   - Set up library path
   - Configure mobile app

## Mobile App Setup
1. **Download App**: Install Immich mobile app (iOS/Android)
2. **Server URL**: `http://your-server-ip:2283`
3. **Login**: Use admin credentials
4. **Backup Settings**: Enable auto-backup for photos/videos

## Directory Structure
```
immich/
├── upload/
│   ├── library/
│   │   ├── 2024/
│   │   │   ├── 01-January/
│   │   │   └── 02-February/
│   │   └── 2023/
│   ├── encoded-video/
│   ├── thumbs/
│   └── profile/
├── immich-data/
└── docker-compose.yml
```

## Storage Requirements
- **Photos**: ~5MB per photo (varies by quality)
- **Videos**: ~100MB per minute (1080p)
- **Database**: ~100MB for 10k photos
- **Cache**: ~10% of library size

## Performance Optimization
```yaml
# For large libraries (>100k photos)
environment:
  - IMMICH_TELEMETRY_ON=false
  - LOG_LEVEL=verbose

# Resource limits
deploy:
  resources:
    limits:
      memory: 4G
      cpus: '2.0'
    reservations:
      memory: 2G
      cpus: '1.0'
```

## Reverse Proxy (Traefik)
```yaml
labels:
  - "traefik.enable=true"
  - "traefik.http.routers.immich.rule=Host(`photos.yourdomain.com`)"
  - "traefik.http.routers.immich.tls=true"
  - "traefik.http.routers.immich.tls.certresolver=letsencrypt"
  - "traefik.http.services.immich.loadbalancer.server.port=3001"
```

## Backup Strategy
```bash
# Backup entire Immich data
docker run --rm -v immich-postgres-data:/data -v $(pwd):/backup alpine tar czf /backup/immich-db.tar.gz -C /data .
tar czf immich-upload.tar.gz upload/

# Restore database
docker run --rm -v immich-postgres-data:/data -v $(pwd):/backup alpine tar xzf /backup/immich-db.tar.gz -C /data
```

## Maintenance
```bash
# Check logs
docker-compose logs -f immich-server

# Restart services
docker-compose restart

# Update images
docker-compose pull && docker-compose up -d

# Clean up unused images
docker image prune -f
```

## Monitoring
- **Health Check**: Auto-restart on failure
- **Storage**: Monitor disk space usage
- **Performance**: Check CPU/memory during uploads
- **Backup**: Regular database and file backups

## Security
- Change default passwords
- Use HTTPS in production
- Regular updates
- Network access control
- Backup encryption

## Troubleshooting
- **Upload failures**: Check disk space and permissions
- **Slow performance**: Verify system resources
- **Mobile sync**: Check network connectivity
- **Database issues**: Review PostgreSQL logs
