# Cloudreve File Manager Template

## Overview
Cloudreve is a cloud storage system with support for multiple storage backends, including local, remote, and cloud storage providers.

## Quick Start
```bash
# Create docker-compose.yml with the content below
docker-compose up -d
```

## Docker Compose
```yaml
version: '3.8'

services:
  cloudreve:
    image: cloudreve/cloudreve:latest
    container_name: cloudreve
    restart: unless-stopped
    ports:
      - "5212:5212"
      - "6888:6888"
      - "6888:6888/udp"
    environment:
      - TZ=America/New_York
      - CR_CONF_Database_Type=postgres
      - CR_CONF_Database_Host=cloudreve-db
      - CR_CONF_Database_Port=5432
      - CR_CONF_Database_User=cloudreve
      - CR_CONF_Database_Password=cloudreve
      - CR_CONF_Database_Name=cloudreve
      - CR_CONF_Redis_Server=cloudreve-redis
      - CR_CONF_Redis_Port=6379
      - CR_CONF_Site_URL=https://cloudreve.yourdomain.com
      - CR_CONF_OverwriteMode=overwrite
    volumes:
      - cloudreve-data:/cloudreve
      - cloudreve-uploads:/uploads
      - /path/to/local-storage:/storage
    depends_on:
      - cloudreve-db
      - cloudreve-redis
    networks:
      - cloudreve-network

  cloudreve-db:
    image: postgres:17-alpine
    container_name: cloudreve-db
    restart: unless-stopped
    environment:
      - POSTGRES_DB=cloudreve
      - POSTGRES_USER=cloudreve
      - POSTGRES_PASSWORD=cloudreve
      - POSTGRES_HOST_AUTH_METHOD=trust
    volumes:
      - cloudreve-db:/var/lib/postgresql/data
    networks:
      - cloudreve-network

  cloudreve-redis:
    image: redis:7-alpine
    container_name: cloudreve-redis
    restart: unless-stopped
    volumes:
      - cloudreve-redis:/data
    networks:
      - cloudreve-network

volumes:
  cloudreve-data:
  cloudreve-uploads:
  cloudreve-db:
  cloudreve-redis:

networks:
  cloudreve-network:
    driver: bridge
```

## Environment Variables
- `CR_CONF_Database_*`: Database configuration
- `CR_CONF_Redis_*`: Redis configuration
- `CR_CONF_Site_URL`: Your site URL
- `CR_CONF_OverwriteMode`: Configuration overwrite mode
- `TZ`: Timezone

## Setup Guide
1. **Generate Secure Password**:
   ```bash
   openssl rand -base64 16
   ```

2. **Create Directories**:
   ```bash
   mkdir -p cloudreve-uploads local-storage
   ```

3. **Deploy**:
   ```bash
   docker-compose up -d
   ```

4. **Access**: Open http://localhost:5212

5. **Initial Setup**:
   - Register first account (becomes admin)
   - Configure storage backends
   - Set up user accounts

## Storage Backends

### Local Storage
```yaml
# In Cloudreve admin interface
Storage Type: Local
Path: /storage
```

### S3 Compatible Storage
```yaml
# Configure in admin interface
Storage Type: S3 Compatible
Endpoint: https://s3.yourdomain.com
Access Key: your-access-key
Secret Key: your-secret-key
Bucket: cloudreve
Region: us-east-1
```

### OneDrive
```yaml
# Configure in admin interface
Storage Type: OneDrive
Client ID: your-client-id
Client Secret: your-client-secret
Redirect URI: https://cloudreve.yourdomain.com/callback
```

### Google Drive
```yaml
# Configure in admin interface
Storage Type: Google Drive
Client ID: your-client-id
Client Secret: your-client-secret
Redirect URI: https://cloudreve.yourdomain.com/callback
```

### FTP/SFTP
```yaml
# Configure in admin interface
Storage Type: FTP/SFTP
Host: ftp.yourdomain.com
Port: 21
Username: your-username
Password: your-password
Path: /remote/path
```

## Configuration Files

### Cloudreve Configuration
```yaml
# cloudreve.yml
app:
  name: Cloudreve
  version: 3.8.1
  debug: false

database:
  type: postgres
  host: cloudreve-db
  port: 5432
  name: cloudreve
  user: cloudreve
  password: cloudreve

redis:
  host: cloudreve-redis
  port: 6379
  password: ""

site:
  url: https://cloudreve.yourdomain.com
  title: Cloudreve
  theme: default

security:
  secret_key: your-secret-key
  jwt_secret: your-jwt-secret

storage:
  default: local
  policies:
    - name: local
      type: local
      path: /storage
      max_size: 10737418240
    - name: s3
      type: s3
      endpoint: https://s3.yourdomain.com
      access_key: your-access-key
      secret_key: your-secret-key
      bucket: cloudreve
      region: us-east-1
      max_size: 10737418240

user:
  default_quota: 10737418240
  default_group: user
  registration_enabled: false
  email_verification: false

upload:
  chunk_size: 10485760
  concurrent_uploads: 3
  temp_dir: /tmp

preview:
  enabled: true
  max_size: 10485760
  formats:
    - image
    - video
    - audio
    - document
```

## User Management

### Create User
```bash
# Create user via admin interface
# Or via API
curl -X POST "http://localhost:5212/api/v3/admin/users" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password","nickname":"John Doe","group":"user"}'
```

### User Groups
```bash
# Create user group
curl -X POST "http://localhost:5212/api/v3/admin/groups" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"poweruser","quota":536870912000,"policies":["local","s3"]}'
```

## File Operations

### Upload Files
```bash
# Upload via API
curl -X POST "http://localhost:5212/api/v3/file/upload" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@/path/to/file.txt" \
  -F "path=/uploads"
```

### Download Files
```bash
# Download via API
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:5212/api/v3/file/download/FILE_ID"
```

### Share Files
```bash
# Create share link
curl -X POST "http://localhost:5212/api/v3/share" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"file_id": "FILE_ID","password":"","expire":3600}'
```

## Reverse Proxy (Traefik)
```yaml
labels:
  - "traefik.enable=true"
  - "traefik.http.routers.cloudreve.rule=Host(`cloudreve.yourdomain.com`)"
  - "traefik.http.routers.cloudreve.tls=true"
  - "traefik.http.routers.cloudreve.tls.certresolver=letsencrypt"
  - "traefik.http.services.cloudreve.loadbalancer.server.port=5212"
```

## Backup Strategy
```bash
# Backup Cloudreve data
docker run --rm -v cloudreve-data:/cloudreve -v $(pwd):/backup alpine tar czf /backup/cloudreve-data-backup.tar.gz -C /cloudreve .

# Backup uploads
docker run --rm -v cloudreve-uploads:/uploads -v $(pwd):/backup alpine tar czf /backup/cloudreve-uploads-backup.tar.gz -C /uploads .

# Backup database
docker exec cloudreve-db pg_dump -U cloudreve cloudreve > cloudreve-db-backup.sql

# Restore database
docker exec -i cloudreve-db psql -U cloudreve cloudreve < cloudreve-db-backup.sql

# Restore Cloudreve data
docker run --rm -v cloudreve-data:/cloudreve -v $(pwd):/backup alpine tar xzf /backup/cloudreve-data-backup.tar.gz -C /cloudreve

# Restart after restore
docker-compose restart cloudreve
```

## Performance Optimization
```yaml
# For better performance
environment:
  - CLOUDREVE_UPLOAD_CHUNK_SIZE=10485760
  - CLOUDREVE_UPLOAD_CONCURRENT=3
  - CLOUDREVE_PREVIEW_MAX_SIZE=10485760

# Resource limits
deploy:
  resources:
    limits:
      memory: 1G
      cpus: '1.0'
    reservations:
      memory: 512M
      cpus: '0.5'
```

## Security
- Change default admin password
- Use HTTPS in production
- Network access control
- Regular backups
- Monitor access logs

## API Usage

### Authentication
```bash
# Login
curl -X POST "http://localhost:5212/api/v3/user/session" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"your-password"}'
```

### File Operations
```bash
# List files
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:5212/api/v3/directory/PATH"

# Create directory
curl -X POST "http://localhost:5212/api/v3/directory" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"path":"/new-folder"}'

# Delete file
curl -X DELETE "http://localhost:5212/api/v3/file/FILE_ID" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Client Integration

### WebDAV
```bash
# Mount via WebDAV
davfs2 https://cloudreve.yourdomain.com/dav/ /mnt/cloudreve
```

### rclone
```bash
# Configure rclone
rclone config create cloudreve webdav
rclone config set cloudreve url https://cloudreve.yourdomain.com/dav/
rclone config set cloudreve vendor other
rclone config set cloudreve user your-username
rclone config set cloudreve pass your-password

# Sync files
rclone sync /local/path cloudreve:/remote/path
```

### Cyberduck
- Connection type: WebDAV
- Server: https://cloudreve.yourdomain.com/dav/
- Username: your-username
- Password: your-password

## Monitoring

### Health Checks
```bash
# Check if Cloudreve is running
curl http://localhost:5212/api/v3/site/ping

# Get system info
curl -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  "http://localhost:5212/api/v3/admin/summary"
```

### Logs
```bash
# View logs
docker-compose logs -f cloudreve

# Check specific logs
docker exec cloudreve tail -f /cloudreve/logs/cloudreve.log
```

## Troubleshooting
- **Database connection**: Check PostgreSQL configuration
- **Storage issues**: Verify storage backend configuration
- **Upload problems**: Check permissions and disk space
- **Performance issues**: Monitor resource usage
- **Authentication errors**: Verify user credentials

## Maintenance
```bash
# Restart service
docker-compose restart cloudreve

# Update image
docker-compose pull && docker-compose up -d

# Clean up old files
docker exec cloudreve find /cloudreve/uploads -name "*.tmp" -mtime +7 -delete

# Optimize database
docker exec cloudreve-db psql -U cloudreve -c "VACUUM ANALYZE;"
```

## Advanced Features

### Custom Themes
```yaml
# In admin interface
Theme: Custom
CSS: |
  .custom-theme {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  }
```

### File Preview
```yaml
# Enable preview for different file types
preview:
  enabled: true
  max_size: 10485760
  formats:
    - image: jpg,jpeg,png,gif,bmp,webp
    - video: mp4,avi,mkv,mov,wmv
    - audio: mp3,wav,flac,aac
    - document: pdf,doc,docx,xls,xlsx,ppt,pptx
```

### Webhook Integration
```yaml
# Configure webhooks for file events
webhooks:
  - name: file_upload
    url: https://yourdomain.com/webhook
    events: ["file.upload", "file.delete"]
    secret: your-webhook-secret
```

## Integration Examples

### Nextcloud Migration
```bash
# Export from Nextcloud
# Import to Cloudreve using same directory structure
```

### Home Assistant Integration
```yaml
# In Home Assistant configuration.yaml
sensor:
  - platform: rest
    resource: http://cloudreve.yourdomain.com/api/v3/admin/summary
    headers:
      Authorization: Bearer YOUR_TOKEN
    value_template: "{{ value_json.storage_used }}"
```

### Discord Bot Integration
```python
# Python Discord bot for file sharing
import requests

class CloudreveBot:
    def __init__(self, api_url, token):
        self.api_url = api_url
        self.token = token
        self.headers = {"Authorization": f"Bearer {token}"}
    
    def upload_file(self, file_path):
        with open(file_path, 'rb') as f:
            files = {'file': f}
            response = requests.post(
                f"{self.api_url}/api/v3/file/upload",
                headers=self.headers,
                files=files
            )
        return response.json()
    
    def create_share(self, file_id):
        data = {"file_id": file_id, "expire": 3600}
        response = requests.post(
            f"{self.api_url}/api/v3/share",
            headers=self.headers,
            json=data
        )
        return response.json()
```

## Best Practices
1. **Regular backups**: Backup data and database regularly
2. **Monitor storage**: Keep an eye on disk usage
3. **Use HTTPS**: Always use HTTPS in production
4. **Secure passwords**: Use strong passwords for admin accounts
5. **Update regularly**: Keep Cloudreve updated
6. **Monitor logs**: Keep an eye on error logs
7. **Test backups**: Regularly test backup restoration
8. **Configure quotas**: Set appropriate user quotas
9. **Use multiple backends**: Distribute storage across multiple providers
10. **Monitor performance**: Keep an eye on resource usage
