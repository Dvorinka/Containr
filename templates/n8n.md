# n8n Workflow Automation Template

## Overview
n8n is a fair-code licensed tool that helps you automate tasks, workflows, and processes without the need for writing code.

## Quick Start
```bash
# Create docker-compose.yml with the content below
docker-compose up -d
```

## Docker Compose
```yaml
version: '3.8'

volumes:
  db_storage:
  n8n_storage:
  redis_storage:

services:
  postgres:
    image: postgres:16
    container_name: n8n-postgres
    restart: always
    environment:
      - POSTGRES_DB=n8n
      - POSTGRES_USER=n8n
      - POSTGRES_PASSWORD=n8n
      - POSTGRES_NON_ROOT_USER=n8n
      - POSTGRES_NON_ROOT_PASSWORD=n8n
    volumes:
      - db_storage:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -h localhost -U ${POSTGRES_USER} -d ${POSTGRES_DB}']
      interval: 5s
      timeout: 5s
      retries: 10
    networks:
      - n8n-network

  redis:
    image: redis:7-alpine
    container_name: n8n-redis
    restart: always
    volumes:
      - redis_storage:/data
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']
      interval: 5s
      timeout: 5s
      retries: 10
    networks:
      - n8n-network

  n8n:
    image: docker.n8n.io/n8nio/n8n:latest
    container_name: n8n
    restart: always
    ports:
      - "5678:5678"
    environment:
      - DB_TYPE=postgresdb
      - DB_POSTGRESDB_HOST=postgres
      - DB_POSTGRESDB_PORT=5432
      - DB_POSTGRESDB_DATABASE=n8n
      - DB_POSTGRESDB_USER=n8n
      - DB_POSTGRESDB_PASSWORD=n8n
      - EXECUTIONS_MODE=queue
      - QUEUE_BULL_REDIS_HOST=redis
      - QUEUE_HEALTH_CHECK_ACTIVE=true
      - N8N_ENCRYPTION_KEY=your-encryption-key-here
      - N8N_BASIC_AUTH_ACTIVE=true
      - N8N_BASIC_AUTH_USER=admin
      - N8N_BASIC_AUTH_PASSWORD=your-secure-password
      - WEBHOOK_URL=http://your-domain.com:5678/
    volumes:
      - n8n_storage:/home/node/.n8n
    depends_on:
      redis:
        condition: service_healthy
      postgres:
        condition: service_healthy
    networks:
      - n8n-network

  n8n-worker:
    image: docker.n8n.io/n8nio/n8n:latest
    container_name: n8n-worker
    restart: always
    environment:
      - DB_TYPE=postgresdb
      - DB_POSTGRESDB_HOST=postgres
      - DB_POSTGRESDB_PORT=5432
      - DB_POSTGRESDB_DATABASE=n8n
      - DB_POSTGRESDB_USER=n8n
      - DB_POSTGRESDB_PASSWORD=n8n
      - EXECUTIONS_MODE=queue
      - QUEUE_BULL_REDIS_HOST=redis
      - QUEUE_HEALTH_CHECK_ACTIVE=true
      - N8N_ENCRYPTION_KEY=your-encryption-key-here
    volumes:
      - n8n_storage:/home/node/.n8n
    command: worker
    depends_on:
      - n8n
      redis:
        condition: service_healthy
      postgres:
        condition: service_healthy
    networks:
      - n8n-network

networks:
  n8n-network:
    driver: bridge
```

## Environment Variables
- `DB_TYPE=postgresdb`: Use PostgreSQL database
- `DB_POSTGRESDB_*`: PostgreSQL connection settings
- `EXECUTIONS_MODE=queue`: Use queue mode for better performance
- `QUEUE_BULL_REDIS_HOST=redis`: Redis host for queue
- `N8N_ENCRYPTION_KEY`: Encryption key for sensitive data
- `N8N_BASIC_AUTH_*`: Basic authentication settings
- `WEBHOOK_URL`: URL for webhook workflows

## Setup Guide
1. **Generate Encryption Key**:
   ```bash
   openssl rand -base64 32
   ```

2. **Generate Secure Password**:
   ```bash
   openssl rand -base64 16
   ```

3. **Deploy**:
   ```bash
   docker-compose up -d
   ```

4. **Access**: Open http://localhost:5678

5. **Initial Setup**:
   - Login with basic auth credentials
   - Create first workflow
   - Configure integrations

## Workflow Examples
```yaml
# Example: Email Notification Workflow
# Trigger: Webhook
# Action: Send Email
# Schedule: Every hour

# Example: Data Sync
# Trigger: Schedule (daily)
# Action: Google Sheets → Database
# Error Handling: Retry on failure

# Example: Social Media Post
# Trigger: Manual
# Action: Create content → Post to Twitter
# Conditions: Business hours only
```

## Popular Integrations
- **Communication**: Slack, Discord, Telegram
- **Storage**: Google Drive, Dropbox, OneDrive
- **Databases**: PostgreSQL, MySQL, MongoDB
- **CRM**: Salesforce, HubSpot
- **Social**: Twitter, LinkedIn, Facebook
- **Productivity**: Notion, Trello, Asana

## Reverse Proxy (Traefik)
```yaml
labels:
  - "traefik.enable=true"
  - "traefik.http.routers.n8n.rule=Host(`n8n.yourdomain.com`)"
  - "traefik.http.routers.n8n.tls=true"
  - "traefik.http.routers.n8n.tls.certresolver=letsencrypt"
  - "traefik.http.services.n8n.loadbalancer.server.port=5678"
```

## Custom Nodes
```yaml
# Mount custom nodes directory
volumes:
  - ./n8n-custom:/home/node/.n8n/custom

# Install custom nodes
docker exec n8n npm install n8n-nodes-your-custom-node
```

## Backup Strategy
```bash
# Backup n8n data
docker run --rm -v n8n-data:/data -v $(pwd):/backup alpine tar czf /backup/n8n-data.tar.gz -C /data .

# Backup database
docker exec n8n-postgres pg_dump -U n8n n8n > n8n-db-backup.sql

# Restore database
docker exec -i n8n-postgres psql -U n8n n8n < n8n-db-backup.sql
```

## Performance Optimization
```yaml
# For high-volume workflows
environment:
  - N8N_EXECUTIONS_DATA_PRUNE=true
  - N8N_EXECUTIONS_DATA_MAX_AGE=168  # 7 days
  - N8N_QUEUE_BULL_REDIS_HOST=redis
  - N8N_QUEUE_BULL_REDIS_PORT=6379

# Resource limits
deploy:
  resources:
    limits:
      memory: 2G
      cpus: '1.5'
```

## Security
- Use strong passwords
- Enable HTTPS
- Regular updates
- Network access control
- Audit workflow executions

## Monitoring
```bash
# Check execution logs
docker-compose logs -f n8n

# Monitor Redis queue
docker exec n8n-redis redis-cli info

# Database status
docker exec n8n-postgres psql -U n8n -c "SELECT count(*) FROM workflow_entity;"
```

## Scaling
```yaml
# Worker nodes for execution
n8n-worker:
  image: docker.n8n.io/n8nio/n8n:latest
  environment:
    - N8N_QUEUE_BULL_REDIS_HOST=redis
  depends_on:
    - redis
  networks:
    - n8n-network
```

## Troubleshooting
- **Workflow failures**: Check execution logs
- **Memory issues**: Increase memory limits
- **Database errors**: Verify PostgreSQL connection
- **SMTP problems**: Test email configuration
