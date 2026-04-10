# Vaultwarden Bitwarden Alternative Template

## Overview
Vaultwarden is an alternative implementation of the Bitwarden server API written in Rust, compatible with Bitwarden clients.

## Quick Start
```bash
# Create docker-compose.yml with the content below
docker-compose up -d
```

## Docker Compose
```yaml
version: '3.8'

services:
  vaultwarden:
    image: vaultwarden/server:latest
    container_name: vaultwarden
    restart: unless-stopped
    ports:
      - "8080:8080"
    environment:
      - SIGNUPS_ALLOWED=true
      - ADMIN_TOKEN=your-secure-admin-token
      - DOMAIN=https://vault.yourdomain.com
      - DATABASE_URL=postgresql://vaultwarden:vaultwarden@postgres:5432/vaultwarden
      - SMTP_HOST=smtp.gmail.com
      - SMTP_PORT=587
      - SMTP_SECURITY=tls
      - SMTP_FROM=your-email@gmail.com
      - SMTP_USERNAME=your-email@gmail.com
      - SMTP_PASSWORD=your-app-password
      - WEBSOCKET_ENABLED=true
      - WEBSOCKET_ADDRESS=0.0.0.0:3012
    volumes:
      - vaultwarden-data:/data
    depends_on:
      - postgres
    networks:
      - vaultwarden-network

  postgres:
    image: postgres:15-alpine
    container_name: vaultwarden-postgres
    restart: unless-stopped
    environment:
      - POSTGRES_DB=vaultwarden
      - POSTGRES_USER=vaultwarden
      - POSTGRES_PASSWORD=vaultwarden
    volumes:
      - vaultwarden-db:/var/lib/postgresql/data
    networks:
      - vaultwarden-network

volumes:
  vaultwarden-data:
  vaultwarden-db:

networks:
  vaultwarden-network:
    driver: bridge
```

## Environment Variables
- `SIGNUPS_ALLOWED`: Allow new user registrations
- `ADMIN_TOKEN`: Admin panel access token
- `DOMAIN`: Your domain for proper links
- `DATABASE_URL`: PostgreSQL connection string
- `SMTP_*`: Email configuration for invitations
- `WEBSOCKET_ENABLED`: Enable real-time sync
- `WEBSOCKET_ADDRESS`: WebSocket bind address

## Setup Guide
1. **Generate Admin Token**:
   ```bash
   openssl rand -base64 48
   ```

2. **Configure SMTP** (Optional but recommended):
   - Get app password from email provider
   - Configure SMTP settings

3. **Deploy**:
   ```bash
   docker-compose up -d
   ```

4. **Access**: Open http://localhost:8080

5. **Admin Panel**: Open http://localhost:8080/admin
   - Use your admin token to access
   - Configure settings and manage users

6. **Create Account**:
   - Register first user account
   - Disable signups after creating admin account

## Client Setup

### Web Vault
- Access: http://localhost:8080
- Login with your created account
- Import passwords from other managers

### Browser Extensions
- **Chrome**: Install Bitwarden extension
- **Firefox**: Install Bitwarden extension
- **Edge**: Install Bitwarden extension
- **Safari**: Install Bitwarden extension

### Mobile Apps
- **iOS**: Download from App Store
- **Android**: Download from Google Play
- **F-Droid**: Available on F-Droid

### Desktop Apps
- **Windows**: Download from Bitwarden website
- **macOS**: Download from Bitwarden website
- **Linux**: Download from Bitwarden website

## Configuration

### Advanced Environment Variables
```yaml
environment:
  # Basic settings
  - SIGNUPS_ALLOWED=false
  - ADMIN_TOKEN=your-secure-admin-token
  - DOMAIN=https://vault.yourdomain.com
  
  # Database
  - DATABASE_URL=postgresql://vaultwarden:vaultwarden@postgres:5432/vaultwarden
  
  # Email
  - SMTP_HOST=smtp.gmail.com
  - SMTP_PORT=587
  - SMTP_SECURITY=tls
  - SMTP_FROM=your-email@gmail.com
  - SMTP_USERNAME=your-email@gmail.com
  - SMTP_PASSWORD=your-app-password
  
  # Security
  - PASSWORD_ITERATIONS=100000
  - PBKDF2_MEMORY=64
  - PBKDF2_PARALLELISM=4
  
  # Features
  - WEBSOCKET_ENABLED=true
  - WEBSOCKET_ADDRESS=0.0.0.0:3012
  - SENDS_ALLOWED=true
  - EMERGENCY_ACCESS_ALLOWED=true
  
  # Limits
  - ORG_EVENTS_DAYS=90
  - ORG_ATTACHMENT_LIMIT=104857600
  - USER_ATTACHMENT_LIMIT=10485760
```

### YubiKey Support
```yaml
environment:
  - YUBICO_CLIENT_ID=your-yubico-client-id
  - YUBICO_SECRET_KEY=your-yubico-secret-key
```

## Reverse Proxy (Traefik)
```yaml
labels:
  - "traefik.enable=true"
  - "traefik.http.routers.vaultwarden.rule=Host(`vault.yourdomain.com`)"
  - "traefik.http.routers.vaultwarden.tls=true"
  - "traefik.http.routers.vaultwarden.tls.certresolver=letsencrypt"
  - "traefik.http.services.vaultwarden.loadbalancer.server.port=8080"
  
  # WebSocket support
  - "traefik.http.routers.vaultwarden-websockets.rule=Host(`vault.yourdomain.com`) && PathPrefix(`/notifications/hub`)"
  - "traefik.http.routers.vaultwarden-websockets.entrypoints=websecure"
  - "traefik.http.services.vaultwarden-websockets.loadbalancer.server.port=3012"
```

## Backup Strategy
```bash
# Backup Vaultwarden data
docker run --rm -v vaultwarden-data:/data -v $(pwd):/backup alpine tar czf /backup/vaultwarden-backup.tar.gz -C /data .

# Backup PostgreSQL database
docker exec vaultwarden-postgres pg_dump -U vaultwarden vaultwarden > vaultwarden-db-backup.sql

# Restore database
docker exec -i vaultwarden-postgres psql -U vaultwarden vaultwarden < vaultwarden-db-backup.sql

# Restore Vaultwarden data
docker run --rm -v vaultwarden-data:/data -v $(pwd):/backup alpine tar xzf /backup/vaultwarden-backup.tar.gz -C /data

# Restart after restore
docker-compose restart vaultwarden
```

## Security Best Practices

### Production Setup
```yaml
environment:
  - SIGNUPS_ALLOWED=false
  - ADMIN_TOKEN=your-secure-admin-token
  - DOMAIN=https://vault.yourdomain.com
  - PASSWORD_ITERATIONS=100000
  - PBKDF2_MEMORY=64
  - PBKDF2_PARALLELISM=4
```

### SSL/TLS Configuration
```yaml
# Use HTTPS in production
environment:
  - DOMAIN=https://vault.yourdomain.com
  
# Configure proper certificates
# Traefik will handle Let's Encrypt automatically
```

### Access Control
```yaml
# Restrict admin access
environment:
  - ADMIN_TOKEN=your-secure-admin-token

# Network isolation
networks:
  vaultwarden-internal:
    driver: bridge
    internal: true
  vaultwarden-external:
    driver: bridge
```

## User Management

### Admin Panel Features
- **User management**: View and manage all users
- **Organization management**: Manage organizations
- **System diagnostics**: Check system health
- **Configuration**: Adjust settings
- **Audit logs**: View user activity

### Organization Setup
1. Create organization in admin panel
2. Invite users via email
3. Set up collections and groups
4. Configure access policies

### Emergency Access
```yaml
environment:
  - EMERGENCY_ACCESS_ALLOWED=true
```

## Performance Optimization
```yaml
# For better performance
environment:
  - DATABASE_MAX_CONNS=10
  - WEBSOCKET_ENABLED=true
  - WEBSOCKET_HEARTBEAT_INTERVAL=30

# Resource limits
deploy:
  resources:
    limits:
      memory: 512M
      cpus: '1.0'
    reservations:
      memory: 256M
      cpus: '0.5'
```

## Monitoring

### Health Checks
```bash
# Check if service is running
curl http://localhost:8080/alive

# Check admin panel
curl http://localhost:8080/admin/diagnostics
```

### Logs
```bash
# View logs
docker-compose logs -f vaultwarden

# Check for errors
docker-compose logs vaultwarden | grep ERROR
```

## Troubleshooting
- **Login issues**: Check domain configuration
- **Email problems**: Verify SMTP settings
- **Performance issues**: Monitor resource usage
- **Database errors**: Check PostgreSQL connection
- **WebSocket issues**: Verify reverse proxy configuration

## Migration from Bitwarden
1. **Export from Bitwarden**: Use Bitwarden export feature
2. **Import to Vaultwarden**: Use web vault import
3. **Update clients**: Point clients to new server URL
4. **Disable old account**: Cancel Bitwarden subscription

## API Usage
```bash
# Get user info
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:8080/api/accounts/profile

# Get organizations
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:8080/api/organizations

# Admin API
curl -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  http://localhost:8080/api/users
```

## Maintenance
```bash
# Restart service
docker-compose restart vaultwarden

# Update image
docker-compose pull && docker-compose up -d

# Clean up old data
docker exec vaultwarden vaultwarden db cleanup

# Check database size
docker exec vaultwarden-postgres psql -U vaultwarden -c "SELECT pg_size_pretty(pg_database_size('vaultwarden'));"
```

## Advanced Features

### SSO Integration
```yaml
environment:
  - SSO_ENABLED=true
  - SSO_SECRET_KEY=your-sso-secret
  - SSO_REDIRECT_URI=https://vault.yourdomain.com/sso
```

### Duo 2FA
```yaml
environment:
  - DUO_IKEY=your-duo-ikey
  - DUO_SKEY=your-duo-skey
  - DUO_HOST=your-duo-host
```

### Custom Icon Service
```yaml
environment:
  - ICON_SERVICE=https://icons.bitwarden.net
  - ICON_BLACKLISTED_NONPROXY_IPS=127.0.0.1,::1
```

## Compliance
- **GDPR**: Data protection and privacy
- **SOC2**: Security controls
- **HIPAA**: Healthcare data protection (with proper configuration)
- **AES-256**: Encryption for all data
- **PBKDF2**: Key derivation for passwords
