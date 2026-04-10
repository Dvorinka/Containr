# Memos Open Source Notion Alternative Template

## Overview
Memos is a lightweight, self-hosted memo hub for your personal notes and thoughts.

## Quick Start
```bash
# Create docker-compose.yml with the content below
docker-compose up -d
```

## Docker Compose
```yaml
version: '3.8'

services:
  memos:
    image: usememos/memos:latest
    container_name: memos
    restart: unless-stopped
    ports:
      - "5230:5230"
    environment:
      - MEMOS_MODE=prod
      - MEMOS_DRIVER=postgres
      - MEMOS_POSTGRES_DSN=postgres://memos:memos@postgres:5432/memos
      - MEMOS_PORT=5230
      - MEMOS_ADDR=0.0.0.0
    volumes:
      - memos-data:/var/opt/memos
    depends_on:
      - postgres
    networks:
      - memos-network

  postgres:
    image: postgres:15-alpine
    container_name: memos-postgres
    restart: unless-stopped
    environment:
      - POSTGRES_DB=memos
      - POSTGRES_USER=memos
      - POSTGRES_PASSWORD=memos
    volumes:
      - memos-db:/var/lib/postgresql/data
    networks:
      - memos-network

volumes:
  memos-data:
  memos-db:

networks:
  memos-network:
    driver: bridge
```

## Environment Variables
- `MEMOS_MODE`: Running mode (prod/dev)
- `MEMOS_DRIVER`: Database driver (postgres/sqlite)
- `MEMOS_POSTGRES_DSN`: PostgreSQL connection string
- `MEMOS_PORT`: Application port
- `MEMOS_ADDR`: Bind address

## Setup Guide
1. **Deploy**:
   ```bash
   docker-compose up -d
   ```

2. **Access**: Open http://localhost:5230

3. **Initial Setup**:
   - Create admin account
   - Set username and password
   - Configure workspace settings

4. **Create First Memo**:
   - Click "+" button
   - Write your first note
   - Add tags for organization

## SQLite Alternative
```yaml
# For smaller deployments, use SQLite instead of PostgreSQL
services:
  memos:
    image: usememos/memos:latest
    container_name: memos
    restart: unless-stopped
    ports:
      - "5230:5230"
    environment:
      - MEMOS_MODE=prod
      - MEMOS_DRIVER=sqlite
    volumes:
      - memos-data:/var/opt/memos
      - ./memos.db:/var/opt/memos/memos.db
    networks:
      - memos-network

volumes:
  memos-data:
```

## Configuration Options

### Environment Variables
```yaml
environment:
  - MEMOS_MODE=prod
  - MEMOS_DRIVER=postgres
  - MEMOS_POSTGRES_DSN=postgres://user:pass@host:5432/db
  - MEMOS_PORT=5230
  - MEMOS_ADDR=0.0.0.0
  - MEMOS_SECRET_KEY=your-secret-key
  - MEMOS_DATA=/var/opt/memos
  - MEMOS_DSN=file:/var/opt/memos/memos.db
```

### Advanced Configuration
```yaml
# Custom configuration file
volumes:
  - ./config.yaml:/var/opt/memos/config.yaml

# Example config.yaml
# server:
#   port: 5230
#   mode: prod
#   addr: 0.0.0.0
# database:
#   driver: postgres
#   dsn: postgres://memos:memos@postgres:5432/memos
```

## Features

### Note Organization
- **Tags**: Categorize notes with hashtags
- **Archives**: Archive old notes
- **Favorites**: Mark important notes
- **Search**: Full-text search across all notes

### Markdown Support
```markdown
# Headers
## Subheaders

**Bold text**
*Italic text*

- Lists
- With items

`Code snippets`

[Links](https://example.com)

> Blockquotes
```

### Daily Memo
- **Daily notes**: Create daily journal entries
- **Templates**: Use templates for consistent formatting
- **Reminders**: Set reminders for important notes

### Sharing
- **Public links**: Share individual notes
- **RSS feeds**: Export notes as RSS
- **Export**: Export notes as markdown files

## Reverse Proxy (Traefik)
```yaml
labels:
  - "traefik.enable=true"
  - "traefik.http.routers.memos.rule=Host(`memos.yourdomain.com`)"
  - "traefik.http.routers.memos.tls=true"
  - "traefik.http.routers.memos.tls.certresolver=letsencrypt"
  - "traefik.http.services.memos.loadbalancer.server.port=5230"
```

## Backup Strategy
```bash
# Backup Memos data
docker run --rm -v memos-data:/var/opt/memos -v $(pwd):/backup alpine tar czf /backup/memos-backup.tar.gz -C /var/opt/memos .

# Backup PostgreSQL database
docker exec memos-postgres pg_dump -U memos memos > memos-db-backup.sql

# Restore database
docker exec -i memos-postgres psql -U memos memos < memos-db-backup.sql

# Restore Memos data
docker run --rm -v memos-data:/var/opt/memos -v $(pwd):/backup alpine tar xzf /backup/memos-backup.tar.gz -C /var/opt/memos
```

## Performance Optimization
```yaml
# For better performance
environment:
  - MEMOS_MODE=prod
  - MEMOS_WORKER=4
  - MEMOS_MAX_UPLOAD_SIZE=32MB

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

## Security
- Change default credentials
- Use HTTPS in production
- Network access control
- Regular backups
- Monitor access logs

## API Usage
```bash
# Get all memos
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:5230/api/v1/memos

# Create memo
curl -X POST -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"content":"Hello World"}' \
  http://localhost:5230/api/v1/memos

# Search memos
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:5230/api/v1/memos?filter=tag:important"
```

## Mobile Apps
- **iOS**: Available on App Store
- **Android**: Available on Google Play
- **Web**: Progressive Web App (PWA)

## Integration Examples

### Daily Journal Template
```markdown
# Daily Journal - {{date}}

## Mood: 😊

## Today's Highlights
- 

## Gratitude
- 

## Tomorrow's Goals
- 

## Notes
-
```

### Meeting Notes Template
```markdown
# Meeting - {{title}}

**Date**: {{date}}
**Attendees**: 
**Duration**: 

## Agenda
- 

## Notes
- 

## Action Items
- [ ] 

## Follow-up
-
```

## Migration from Other Tools

### From Notion
1. Export pages as markdown
2. Import via API or manual copy
3. Reorganize with tags

### From Obsidian
1. Copy markdown files
2. Maintain folder structure with tags
3. Adjust image links

### From Google Keep
1. Export notes (if available)
2. Manual copy for most notes
3. Use tags for organization

## Troubleshooting
- **Database connection**: Check PostgreSQL configuration
- **Performance issues**: Monitor resource usage
- **Access problems**: Verify port and firewall settings
- **Data loss**: Restore from backup

## Maintenance
```bash
# Check logs
docker-compose logs -f memos

# Restart service
docker-compose restart memos

# Update image
docker-compose pull && docker-compose up -d

# Clean up old data
docker exec memos rm -rf /var/opt/memos/tmp/*
```

## Customization

### CSS Customization
```css
/* Add custom CSS in settings */
.memo-content {
  font-family: 'Inter', sans-serif;
  line-height: 1.6;
}

.tag {
  background: #e3f2fd;
  color: #1976d2;
}
```

### Custom Themes
- **Dark mode**: Built-in dark theme
- **Custom colors**: Configure in settings
- **Font sizes**: Adjustable in settings

## Best Practices
1. **Use tags consistently**: Create a tag system
2. **Daily reviews**: Review and organize notes daily
3. **Archive old notes**: Keep workspace clean
4. **Use templates**: Standardize common note types
5. **Regular backups**: Protect your data
