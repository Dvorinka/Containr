# Uptime Kuma Monitoring Template

## Overview
Uptime Kuma is a fancy self-hosted monitoring tool that helps you track your websites, APIs, and services.

## Quick Start
```bash
# Create docker-compose.yml with the content below
docker-compose up -d
```

## Docker Compose
```yaml
version: '3.8'

services:
  uptime-kuma:
    image: louislam/uptime-kuma:1
    container_name: uptime-kuma
    restart: always
    ports:
      - "3001:3001"
    volumes:
      - uptime-kuma-data:/app/data
    environment:
      - NODE_ENV=production
    networks:
      - uptime-kuma-network

volumes:
  uptime-kuma-data:

networks:
  uptime-kuma-network:
    driver: bridge
```

## Environment Variables
- `NODE_ENV=production`: Run in production mode

## Setup Guide
1. **Deploy**:
   ```bash
   docker-compose up -d
   ```

2. **Access**: Open http://localhost:3001

3. **Initial Setup**:
   - Create admin account
   - Set administrator password
   - Choose language preference

4. **Add First Monitor**:
   - Click "Add New Monitor"
   - Enter URL/IP to monitor
   - Set check interval
   - Configure notifications

## Monitor Types

### HTTP(s) Monitor
```yaml
# Example configuration
Monitor Type: HTTP(s)
Friendly Name: My Website
URL: https://example.com
Interval: 60 seconds
Timeout: 30 seconds
Retries: 3
```

### TCP Port Monitor
```yaml
# Example configuration
Monitor Type: TCP
Friendly Name: SSH Server
Hostname: server.example.com
Port: 22
Interval: 60 seconds
Timeout: 10 seconds
```

### Ping Monitor
```yaml
# Example configuration
Monitor Type: Ping
Friendly Name: Router
Hostname: 192.168.1.1
Interval: 30 seconds
Packet Size: 56
```

### DNS Monitor
```yaml
# Example configuration
Monitor Type: DNS
Friendly Name: Domain Resolution
Hostname: example.com
DNS Server: 8.8.8.8
Resolve Type: A
Interval: 300 seconds
```

## Notification Channels

### Email Notifications
```yaml
# Setup in Uptime Kuma UI
Notification Type: Email
SMTP Host: smtp.gmail.com
SMTP Port: 587
Username: your-email@gmail.com
Password: your-app-password
From Email: monitor@example.com
To Emails: admin@example.com
```

### Discord Notifications
```yaml
# Setup in Uptime Kuma UI
Notification Type: Discord
Webhook URL: https://discord.com/api/webhooks/YOUR_WEBHOOK_URL
```

### Telegram Notifications
```yaml
# Setup in Uptime Kuma UI
Notification Type: Telegram
Bot Token: YOUR_BOT_TOKEN
Chat ID: YOUR_CHAT_ID
```

### Slack Notifications
```yaml
# Setup in Uptime Kuma UI
Notification Type: Slack
Webhook URL: https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK
```

## Reverse Proxy (Traefik)
```yaml
labels:
  - "traefik.enable=true"
  - "traefik.http.routers.uptime-kuma.rule=Host(`status.yourdomain.com`)"
  - "traefik.http.routers.uptime-kuma.tls=true"
  - "traefik.http.routers.uptime-kuma.tls.certresolver=letsencrypt"
  - "traefik.http.services.uptime-kuma.loadbalancer.server.port=3001"
```

## Backup Strategy
```bash
# Backup Uptime Kuma data
docker run --rm -v uptime-kuma-data:/data -v $(pwd):/backup alpine tar czf /backup/uptime-kuma-backup.tar.gz -C /data .

# Restore Uptime Kuma data
docker run --rm -v uptime-kuma-data:/data -v $(pwd):/backup alpine tar xzf /backup/uptime-kuma-backup.tar.gz -C /data

# Restart after restore
docker-compose restart uptime-kuma
```

## Performance Optimization
```yaml
# For high-volume monitoring
environment:
  - UPTIME_KUMA_MAX_MONITORS_PER_PAGE=100
  - UPTIME_KUMA_HEARTBEAT_INTERVAL=20

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

## Advanced Configuration

### Custom HTTP Headers
```yaml
# In monitor configuration
HTTP Headers:
  User-Agent: Uptime-Kuma/1.0.0
  Authorization: Bearer YOUR_TOKEN
```

### HTTP POST Body
```yaml
# For API monitoring
Method: POST
Body: '{"key": "value"}'
Headers:
  Content-Type: application/json
```

### Expected Status Codes
```yaml
# Custom status codes
Accepted Status Codes: 200,201,202,204
```

## Security
- Change default admin password
- Use HTTPS in production
- Network access control
- Regular backups
- Monitor access logs

## API Usage
```bash
# Get all monitors
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3001/api/monitors

# Get monitor status
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3001/api/monitors/1/status

# Add monitor via API
curl -X POST -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"type":"http","name":"Test","url":"https://example.com"}' \
  http://localhost:3001/api/monitors
```

## Monitoring Best Practices
1. **Set appropriate intervals**: Don't check too frequently
2. **Use retries**: Handle temporary network issues
3. **Configure timeouts**: Prevent hanging checks
4. **Set up notifications**: Get alerts for issues
5. **Group monitors**: Organize by service/environment
6. **Use tags**: Filter and categorize monitors

## Troubleshooting
- **Monitor failures**: Check network connectivity
- **Notification issues**: Verify webhook/API keys
- **Performance problems**: Reduce check frequency
- **Database errors**: Check disk space and permissions
- **Access problems**: Verify firewall settings

## Integration Examples

### Docker Container Monitoring
```yaml
Monitor Type: HTTP
URL: http://container-ip:port/health
Interval: 30 seconds
Expected Status Code: 200
```

### Database Monitoring
```yaml
Monitor Type: TCP
Hostname: postgres-server
Port: 5432
Interval: 60 seconds
```

### SSL Certificate Monitoring
```yaml
Monitor Type: HTTP(s)
URL: https://example.com
Check Certificate: true
Days Before Expiry: 30
```

## Maintenance
```bash
# Check logs
docker-compose logs -f uptime-kuma

# Restart service
docker-compose restart uptime-kuma

# Update image
docker-compose pull && docker-compose up -d

# Clean up old data
docker exec uptime-kuma npm run prune
```
