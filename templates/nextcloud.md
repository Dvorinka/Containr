# Nextcloud Cloud Storage Template

## Overview
Nextcloud is a suite of client-server software for creating and using file hosting services.

## Quick Start
```bash
# Create docker-compose.yml with the content below
docker-compose up -d
```

## Docker Compose
```yaml
version: '3.8'

services:
  nextcloud-db:
    image: postgres:15-alpine
    container_name: nextcloud-db
    restart: unless-stopped
    environment:
      - POSTGRES_DB=nextcloud
      - POSTGRES_USER=nextcloud
      - POSTGRES_PASSWORD=nextcloud
    volumes:
      - nextcloud-db:/var/lib/postgresql/data
    networks:
      - nextcloud-network

  nextcloud-redis:
    image: redis:7-alpine
    container_name: nextcloud-redis
    restart: unless-stopped
    volumes:
      - nextcloud-redis:/data
    networks:
      - nextcloud-network

  nextcloud-app:
    image: nextcloud:latest
    container_name: nextcloud
    restart: unless-stopped
    ports:
      - "8080:80"
    environment:
      - POSTGRES_HOST=nextcloud-db
      - POSTGRES_DB=nextcloud
      - POSTGRES_USER=nextcloud
      - POSTGRES_PASSWORD=nextcloud
      - REDIS_HOST=nextcloud-redis
      - NEXTCLOUD_ADMIN_USER=admin
      - NEXTCLOUD_ADMIN_PASSWORD=your-secure-password
      - NEXTCLOUD_TRUSTED_DOMAINS=localhost
      - OVERWRITEPROTOCOL=http
      - OVERWRITEHOST=localhost:8080
    volumes:
      - nextcloud-data:/var/www/html
      - nextcloud-config:/var/www/html/config
      - nextcloud-apps:/var/www/html/apps
      - /path/to/nextcloud-data:/var/www/html/data
    depends_on:
      - nextcloud-db
      - nextcloud-redis
    networks:
      - nextcloud-network

  nextcloud-cron:
    image: nextcloud:latest
    container_name: nextcloud-cron
    restart: unless-stopped
    environment:
      - POSTGRES_HOST=nextcloud-db
      - POSTGRES_DB=nextcloud
      - POSTGRES_USER=nextcloud
      - POSTGRES_PASSWORD=nextcloud
      - REDIS_HOST=nextcloud-redis
    volumes:
      - nextcloud-data:/var/www/html
      - nextcloud-config:/var/www/html/config
      - nextcloud-apps:/var/www/html/apps
    depends_on:
      - nextcloud-db
      - nextcloud-redis
    entrypoint: /cron.sh
    networks:
      - nextcloud-network

volumes:
  nextcloud-data:
  nextcloud-config:
  nextcloud-apps:
  nextcloud-db:
  nextcloud-redis:

networks:
  nextcloud-network:
    driver: bridge
```

## Environment Variables
- `POSTGRES_*`: Database configuration
- `REDIS_HOST`: Redis server host
- `NEXTCLOUD_ADMIN_*`: Admin user credentials
- `NEXTCLOUD_TRUSTED_DOMAINS`: Trusted domains
- `OVERWRITEPROTOCOL`: Protocol override
- `OVERWRITEHOST`: Host override

## Setup Guide
1. **Generate Secure Password**:
   ```bash
   openssl rand -base64 16
   ```

2. **Create Directories**:
   ```bash
   mkdir -p nextcloud-data
   ```

3. **Deploy**:
   ```bash
   docker-compose up -d
   ```

4. **Access**: Open http://localhost:8080

5. **Initial Setup**:
   - Admin account should be auto-created
   - Configure apps and settings
   - Set up user accounts

## Configuration Files

### config.php (`nextcloud-config/config.php`)
```php
<?php
$CONFIG = array (
  'instanceid' => 'your-instance-id',
  'passwordsalt' => 'your-password-salt',
  'secret' => 'your-secret',
  'trusted_domains' => 
  array (
    0 => 'localhost',
    1 => 'nextcloud.yourdomain.com',
  ),
  'datadirectory' => '/var/www/html/data',
  'dbtype' => 'pgsql',
  'version' => '27.0.0',
  'dbname' => 'nextcloud',
  'dbhost' => 'nextcloud-db',
  'dbport' => '',
  'dbtableprefix' => 'oc_',
  'dbuser' => 'nextcloud',
  'dbpassword' => 'nextcloud',
  'installed' => true,
  'filelocking.enabled' => true,
  'memcache.locking' => '\\OC\\Memcache\\Redis',
  'memcache.local' => '\\OC\\Memcache\\Redis',
  'redis' => 
  array (
    'host' => 'nextcloud-redis',
    'port' => 6379,
  ),
  'mail_smtpmode' => 'smtp',
  'mail_sendmailmode' => 'smtp',
  'mail_from_address' => 'nextcloud',
  'mail_domain' => 'yourdomain.com',
  'mail_smtpserver' => 'smtp.gmail.com',
  'mail_smtpport' => '587',
  'mail_smtpsecure' => 'tls',
  'mail_smtpauth' => 1,
  'mail_smtpauthtype' => 'LOGIN',
  'mail_smtpname' => 'your-email@gmail.com',
  'mail_smtppassword' => 'your-app-password',
  'overwrite.cli.url' => 'http://localhost:8080',
  'default_phone_region' => 'US',
  'enabledPreviewProviders' => 
  array (
    0 => 'OC\\Preview\\Image',
    1 => 'OC\\Preview\\Movie',
    2 => 'OC\\Preview\\TXT',
    3 => 'OC\\Preview\\MarkDown',
    4 => 'OC\\Preview\\PDF',
    5 => 'OC\\Preview\\Office',
    6 => 'OC\\Preview\\SVG',
    7 => 'OC\\Preview\\EPUB',
    8 => 'OC\\Preview\\Font',
    9 => 'OC\\Preview\\MP3',
    10 => 'OC\\Preview\\HEIC',
  ),
  'enable_previews' => true,
  'preview_max_x' => 2048,
  'preview_max_y' => 2048,
  'preview_max_scale_factor' => 1,
  'enabledPreviewProviders' => 
  array (
    0 => 'OC\\Preview\\Image',
    1 => 'OC\\Preview\\Movie',
    2 => 'OC\\Preview\\TXT',
    3 => 'OC\\Preview\\MarkDown',
    4 => 'OC\\Preview\\PDF',
    5 => 'OC\\Preview\\Office',
    6 => 'OC\\Preview\\SVG',
    7 => 'OC\\Preview\\EPUB',
    8 => 'OC\\Preview\\Font',
    9 => 'OC\\Preview\\MP3',
    10 => 'OC\\Preview\\HEIC',
  ),
);
```

## Apps Installation

### Popular Apps
```bash
# Install apps via web interface or CLI
docker exec nextcloud-app occ app:install files_external
docker exec nextcloud-app occ app:install calendar
docker exec nextcloud-app occ app:install contacts
docker exec nextcloud-app occ app:install mail
docker exec nextcloud-app occ app:install deck
docker exec nextcloud-app occ app:install notes
docker exec nextcloud-app occ app:install tasks
docker exec nextcloud-app occ app:install talk
```

### External Storage
```bash
# Add external storage
docker exec nextcloud-app occ files_external:create admin local /path/to/external/storage
```

## Reverse Proxy (Traefik)
```yaml
labels:
  - "traefik.enable=true"
  - "traefik.http.routers.nextcloud.rule=Host(`nextcloud.yourdomain.com`)"
  - "traefik.http.routers.nextcloud.tls=true"
  - "traefik.http.routers.nextcloud.tls.certresolver=letsencrypt"
  - "traefik.http.services.nextcloud.loadbalancer.server.port=80"
```

## Backup Strategy
```bash
# Backup Nextcloud data
docker run --rm -v nextcloud-data:/var/www/html -v $(pwd):/backup alpine tar czf /backup/nextcloud-data-backup.tar.gz -C /var/www/html .

# Backup database
docker exec nextcloud-db pg_dump -U nextcloud nextcloud > nextcloud-db-backup.sql

# Backup Redis
docker exec nextcloud-redis redis-cli BGSAVE
docker cp nextcloud-redis:/data/dump.rdb ./redis-backup.rdb

# Restore database
docker exec -i nextcloud-db psql -U nextcloud nextcloud < nextcloud-db-backup.sql

# Restore Nextcloud data
docker run --rm -v nextcloud-data:/var/www/html -v $(pwd):/backup alpine tar xzf /backup/nextcloud-data-backup.tar.gz -C /var/www/html

# Restart after restore
docker-compose restart nextcloud-app
```

## Performance Optimization
```yaml
# For better performance
environment:
  - PHP_MEMORY_LIMIT=512M
  - PHP_UPLOAD_LIMIT=512M
  - PHP_MAX_EXECUTION_TIME=300

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
- Change default admin password
- Use HTTPS in production
- Network access control
- Regular backups
- Monitor access logs

## User Management

### Create User
```bash
# Create user via CLI
docker exec nextcloud-app occ user:add --display-name="John Doe" --group="users" john
```

### Groups
```bash
# Create group
docker exec nextcloud-app occ group:add team

# Add user to group
docker exec nextcloud-app occ group:adduser john team
```

### Quotas
```bash
# Set user quota
docker exec nextcloud-app occ user:setting john quota 5GB
```

## File Sharing

### Share Files
```bash
# Create share link
docker exec nextcloud-app occ share:create /path/to/file --type=link --permissions=1
```

### External Storage
```bash
# Add SMB share
docker exec nextcloud-app occ files_external:create admin smb://server/share --mount=external
```

## Calendar & Contacts

### Calendar Setup
```bash
# Install calendar app
docker exec nextcloud-app occ app:install calendar

# Create calendar
docker exec nextcloud-app occ calendar:create --name="Work" --color="#ff0000"
```

### Contacts Setup
```bash
# Install contacts app
docker exec nextcloud-app occ app:install contacts

# Import contacts
docker exec nextcloud-app occ contacts:import /path/to/contacts.vcf
```

## Talk (Chat & Video)

### Enable Talk
```bash
# Install talk app
docker exec nextcloud-app occ app:install talk

# Enable signaling server
docker exec nextcloud-app occ talk:signaling:install
```

### Talk Configuration
```php
// In config.php
'allow_local_remote_servers' => true,
'signaling' => [
  'servers' => [
    [
      'server' => 'https://nextcloud.yourdomain.com',
      'verify' => true
    ]
  ]
],
```

## Monitoring

### Health Checks
```bash
# Check if Nextcloud is running
curl http://localhost:8080/status.php

# Get system info
docker exec nextcloud-app occ status
```

### Logs
```bash
# View logs
docker-compose logs -f nextcloud-app

# Check Nextcloud logs
docker exec nextcloud-app occ log:tail
```

## Troubleshooting
- **Database connection**: Check PostgreSQL configuration
- **File permissions**: Verify volume permissions
- **Performance issues**: Monitor resource usage
- **App installation**: Check app compatibility
- **Sharing problems**: Verify external storage configuration

## Maintenance
```bash
# Update Nextcloud
docker-compose pull && docker-compose up -d
docker exec nextcloud-app occ upgrade

# Run maintenance tasks
docker exec nextcloud-app occ maintenance:repair
docker exec nextcloud-app occ files:scan --all

# Clean up old files
docker exec nextcloud-app occ trashbin:cleanup
docker exec nextcloud-app occ versions:cleanup
```

## Advanced Features

### Collabora Online
```yaml
collabora:
  image: collabora/code:latest
  container_name: collabora
  restart: unless-stopped
  environment:
    - aliasgroup1=https://nextcloud.yourdomain.com
    - dictionaries=en_US
    - extra_params=--o:ssl.enable=false --o:ssl.termination=true
  ports:
    - "9980:9980"
  networks:
    - nextcloud-network
```

### OnlyOffice
```yaml
onlyoffice:
  image: onlyoffice/documentserver:latest
  container_name: onlyoffice
  restart: unless-stopped
  environment:
    - JWT_ENABLED=true
    - JWT_SECRET=your-jwt-secret
  ports:
    - "8081:80"
  networks:
    - nextcloud-network
```

### Full Text Search
```yaml
elasticsearch:
  image: elasticsearch:8.11.1
  container_name: nextcloud-elasticsearch
  restart: unless-stopped
  environment:
    - discovery.type=single-node
    - xpack.security.enabled=false
    - "ES_JAVA_OPTS=-Xms512m -Xmx512m"
  volumes:
    - elasticsearch-data:/usr/share/elasticsearch/data
  networks:
    - nextcloud-network
```

## Client Apps

### Desktop Apps
- **Windows**: Nextcloud Desktop Client
- **macOS**: Nextcloud Desktop Client
- **Linux**: Nextcloud Desktop Client

### Mobile Apps
- **iOS**: Nextcloud iOS App
- **Android**: Nextcloud Android App

### WebDAV
```bash
# Mount via WebDAV
davfs2 https://nextcloud.yourdomain.com/remote.php/dav/files/username/ /mnt/nextcloud
```

## Integration Examples

### Home Assistant
```yaml
# In Home Assistant configuration.yaml
nextcloud:
  url: https://nextcloud.yourdomain.com
  username: your-username
  password: your-password
```

### LDAP Integration
```php
// In config.php
'ldapProviderFactory' => 'OCA\\User_LDAP\\LDAPProviderFactory',
```

## Best Practices
1. **Regular backups**: Backup data and database regularly
2. **Monitor resources**: Keep an eye on disk space and memory
3. **Update regularly**: Keep Nextcloud and apps updated
4. **Use HTTPS**: Always use HTTPS in production
5. **Configure quotas**: Set appropriate user quotas
6. **Enable caching**: Use Redis for better performance
7. **Monitor logs**: Keep an eye on error logs
8. **Test backups**: Regularly test backup restoration
