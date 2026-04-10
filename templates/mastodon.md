# Mastodon Social Network Template

## Overview
Mastodon is a free, open-source social network server based on ActivityPub where users can follow friends and discover new ones.

## Quick Start
```bash
# Create docker-compose.yml with the content below
docker-compose up -d
```

## Docker Compose
```yaml
version: '3.8'

services:
  db:
    restart: always
    image: postgres:15-alpine
    shm_size: 256mb
    networks:
      - internal_network
    healthcheck:
      test: ['CMD', 'pg_isready', '-U', 'postgres']
    volumes:
      - postgres-data:/var/lib/postgresql/data
    environment:
      - POSTGRES_DB=mastodon
      - POSTGRES_USER=mastodon
      - POSTGRES_PASSWORD=mastodon
    container_name: mastodon-db

  redis:
    restart: always
    image: redis:7-alpine
    networks:
      - internal_network
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']
    volumes:
      - redis-data:/data
    container_name: mastodon-redis

  web:
    image: ghcr.io/mastodon/mastodon:v4.5.7
    restart: always
    env_file: .env.production
    command: bundle exec puma -C config/puma.rb
    networks:
      - external_network
      - internal_network
    healthcheck:
      test: ['CMD-SHELL', "curl -s --noproxy localhost localhost:3000/health | grep -q 'OK' || exit 1"]
    ports:
      - '3000:3000'
    depends_on:
      - db
      - redis
    volumes:
      - mastodon-data:/mastodon/public/system
    container_name: mastodon-web

  streaming:
    image: ghcr.io/mastodon/mastodon-streaming:v4.5.7
    restart: always
    env_file: .env.production
    command: node ./streaming/index.js
    networks:
      - external_network
      - internal_network
    healthcheck:
      test: ['CMD-SHELL', "curl -s --noproxy localhost localhost:4000/api/v1/streaming/health | grep -q 'OK' || exit 1"]
    ports:
      - '4000:4000'
    depends_on:
      - db
      - redis
    container_name: mastodon-streaming

  sidekiq:
    image: ghcr.io/mastodon/mastodon:v4.5.7
    restart: always
    env_file: .env.production
    command: bundle exec sidekiq
    depends_on:
      - db
      - redis
    networks:
      - external_network
      - internal_network
    volumes:
      - mastodon-data:/mastodon/public/system
    healthcheck:
      test: ['CMD-SHELL', "ps aux | grep '[s]idekiq' || false"]
    container_name: mastodon-sidekiq

volumes:
  postgres-data:
  redis-data:
  mastodon-data:

networks:
  external_network:
  internal_network:
    internal: true
```

## Environment Variables (.env.production)
```bash
# Federation
LOCAL_DOMAIN=mastodon.yourdomain.com
WEB_DOMAIN=mastodon.yourdomain.com

# Redis
REDIS_HOST=redis
REDIS_PORT=6379

# Database
DB_HOST=db
DB_USER=mastodon
DB_NAME=mastodon
DB_PASS=mastodon
DB_PORT=5432

# Secrets
SECRET_KEY_BASE=your-secret-key-base
OTP_SECRET=your-otp-secret

# Web Push
VAPID_PRIVATE_KEY=your-vapid-private-key
VAPID_PUBLIC_KEY=your-vapid-public-key
VAPID_SUBJECT=mailto:your-email@yourdomain.com

# Email
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
SMTP_LOGIN=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM_ADDRESS=Mastodon <notifications@mastodon.yourdomain.com>

# File storage
S3_ENABLED=true
S3_BUCKET=mastodon
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
S3_ENDPOINT=https://s3.yourdomain.com
S3_PROTOCOL=https
S3_HOSTNAME=s3.yourdomain.com
S3_ALIAS_HOST=files.mastodon.yourdomain.com

# Locale
DEFAULT_LOCALE=en

# Other
SINGLE_USER_MODE=false
RAILS_ENV=production
RAILS_SERVE_STATIC_FILES=true
```

## Setup Guide
1. **Generate Secrets**:
   ```bash
   # Generate secret keys
   SECRET_KEY_BASE=$(openssl rand -hex 64)
   OTP_SECRET=$(openssl rand -hex 64)
   
   # Generate VAPID keys
   VAPID_PRIVATE_KEY=$(openssl ecparam -name prime256v1 -genkey -noout | openssl ec -outform DER | tail -c +8 | head -c 32 | base64)
   VAPID_PUBLIC_KEY=$(openssl ec -in <(openssl ecparam -name prime256v1 -genkey -noout) -pubout -outform DER | tail -c +8 | head -c 32 | base64)
   ```

2. **Create .env.production**:
   ```bash
   cp .env.production.example .env.production
   # Edit with your values
   ```

3. **Create Directories**:
   ```bash
   mkdir -p public/system
   ```

4. **Deploy**:
   ```bash
   docker-compose up -d
   ```

5. **Run Setup Commands**:
   ```bash
   # Create database
   docker-compose exec web bundle exec rails db:migrate
   docker-compose exec web bundle exec rails assets:precompile
   
   # Create admin user
   docker-compose exec web bundle exec rails mastodon:admin:create USERNAME=admin EMAIL=admin@yourdomain.com
   ```

6. **Access**: Open https://mastodon.yourdomain.com

## Configuration

### Single User Mode
```bash
# In .env.production
SINGLE_USER_MODE=true
LOCAL_DOMAIN=yourdomain.com
```

### Object Storage (S3)
```bash
# MinIO setup for local S3
minio:
  image: minio/minio:latest
  command: server /data --console-address ":9001"
  ports:
    - "9000:9000"
    - "9001:9001"
  volumes:
    - minio-data:/data
  environment:
    - MINIO_ROOT_USER=minioadmin
    - MINIO_ROOT_PASSWORD=minioadmin
  networks:
    - mastodon-network
```

### Elasticsearch (Optional)
```yaml
elasticsearch:
  image: elasticsearch:8.11.1
  restart: always
  environment:
    - discovery.type=single-node
    - xpack.security.enabled=false
    - "ES_JAVA_OPTS=-Xms512m -Xmx512m"
  volumes:
    - elasticsearch-data:/usr/share/elasticsearch/data
  networks:
    - mastodon-network
```

## Reverse Proxy (Traefik)
```yaml
labels:
  - "traefik.enable=true"
  - "traefik.http.routers.mastodon.rule=Host(`mastodon.yourdomain.com`)"
  - "traefik.http.routers.mastodon.tls=true"
  - "traefik.http.routers.mastodon.tls.certresolver=letsencrypt"
  - "traefik.http.services.mastodon.loadbalancer.server.port=3000"
  
  - "traefik.http.routers.mastodon-streaming.rule=Host(`mastodon.yourdomain.com`) && PathPrefix(`/api/v1/streaming`)"
  - "traefik.http.routers.mastodon-streaming.tls=true"
  - "traefik.http.routers.mastodon-streaming.tls.certresolver=letsencrypt"
  - "traefik.http.services.mastodon-streaming.loadbalancer.server.port=4000"
```

## Backup Strategy
```bash
# Backup database
docker exec mastodon-db pg_dump -U mastodon mastodon > mastodon-db-backup.sql

# Backup Redis
docker exec mastodon-redis redis-cli BGSAVE
docker cp mastodon-redis:/data/dump.rdb ./redis-backup.rdb

# Backup files
docker run --rm -v ./public/system:/data -v $(pwd):/backup alpine tar czf /backup/mastodon-files.tar.gz -C /data .

# Restore database
docker exec -i mastodon-db psql -U mastodon mastodon < mastodon-db-backup.sql

# Restore Redis
docker cp ./redis-backup.rdb mastodon-redis:/data/dump.rdb
docker-compose restart redis
```

## Performance Optimization
```yaml
# For better performance
environment:
  - RAILS_MAX_THREADS=5
  - RAILS_MIN_THREADS=5
  - WEB_CONCURRENCY=2
  - MAX_THREADS=25
  - PREPARED_STATEMENTS=true

# Resource limits
deploy:
  resources:
    limits:
      memory: 2G
      cpus: '2.0'
    reservations:
      memory: 1G
      cpus: '1.0'
```

## Security
- Change default passwords
- Use HTTPS in production
- Network access control
- Regular backups
- Monitor access logs

## Administration

### Admin Commands
```bash
# Create admin user
docker-compose exec web bundle exec rails mastodon:admin:create USERNAME=admin EMAIL=admin@yourdomain.com

# Remove user
docker-compose exec web bundle exec rails mastodon:accounts:remove USERNAME=username

# Clear media cache
docker-compose exec web bundle exec rails mastodon:media:remove

# Clear cache
docker-compose exec web bundle exec rails cache:clear
```

### Maintenance
```bash
# Check logs
docker-compose logs -f web
docker-compose logs -f sidekiq
docker-compose logs -f streaming

# Restart services
docker-compose restart

# Update Mastodon
docker-compose pull && docker-compose up -d
docker-compose exec web bundle exec rails db:migrate
docker-compose exec web bundle exec rails assets:precompile
```

## Federation

### Add to Federation List
```bash
# Add your instance to joinmastodon.org
curl -X POST https://instances.social/api/submit \
  -d "name=mastodon.yourdomain.com" \
  -d "url=https://mastodon.yourdomain.com" \
  -d "email=admin@yourdomain.com"
```

### Block Other Instances
```bash
# Block instance via admin interface
# Or via command line
docker-compose exec web bundle exec rails mastodon:domains:block DOMAIN=bad-instance.social
```

## API Usage

### REST API
```bash
# Get instance info
curl https://mastodon.yourdomain.com/api/v1/instance

# Get timeline
curl -H "Authorization: Bearer ACCESS_TOKEN" \
  https://mastodon.yourdomain.com/api/v1/timelines/home

# Post status
curl -X POST -H "Authorization: Bearer ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"Hello from Mastodon!"}' \
  https://mastodon.yourdomain.com/api/v1/statuses
```

### WebSocket API
```javascript
// Connect to streaming API
const ws = new WebSocket('wss://mastodon.yourdomain.com/api/v1/streaming?access_token=TOKEN&stream=user');

ws.onmessage = function(event) {
  const data = JSON.parse(event.data);
  console.log('New event:', data);
};
```

## Mobile Apps

### Official Apps
- **iOS**: Mastodon for iOS
- **Android**: Mastodon for Android

### Third-party Apps
- **iOS**: Ivory, Ice Cubes
- **Android**: Tusky, Megalodon
- **Web**: Elk, Pinafore

## Troubleshooting
- **Database connection**: Check PostgreSQL configuration
- **Redis connection**: Verify Redis settings
- **Federation issues**: Check DNS and SSL certificates
- **Media uploads**: Verify S3 configuration
- **Performance problems**: Monitor resource usage

## Monitoring

### Health Checks
```bash
# Web service health
curl https://mastodon.yourdomain.com/health

# Streaming health
curl https://mastodon.yourdomain.com/api/v1/streaming/health

# Database health
docker exec mastodon-db pg_isready -U mastodon
```

### Metrics
```bash
# Sidekiq stats
docker-compose exec web bundle exec rails mastodon:sidekiq:stats

# Instance stats
docker-compose exec web bundle exec rails mastodon:instance:stats
```

## Advanced Features

### Custom CSS
```bash
# Add custom CSS to public/custom.css
# Enable in admin interface
```

### Custom Emojis
```bash
# Upload custom emojis via admin interface
# Or import from file
docker-compose exec web bundle exec rails mastodon:emoji:import PATH=/path/to/emojis
```

### Rate Limiting
```bash
# Configure rate limits in admin interface
# Or via environment variables
RATE_LIMITS_USERS=300
RATE_LIMITS_SESSIONS=300
```

## Migration from Other Platforms

### From Twitter
```bash
# Import Twitter archive
docker-compose exec web bundle exec rails mastodon:import:twitter PATH=/path/to/twitter.zip
```

### From Other Mastodon Instance
```bash
# Export account data from old instance
# Import via admin interface
```

## Compliance
- **GDPR**: Data export and deletion tools
- **Accessibility**: WCAG 2.1 compliance
- **Privacy**: Granular privacy controls
- **Content moderation**: Advanced moderation tools
- **Federation**: ActivityPub protocol compliance
