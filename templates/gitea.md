# Gitea Git Hosting Template

## Overview
Gitea is a painless self-hosted Git service. It is similar to GitHub, Bitbucket, and GitLab.

## Quick Start
```bash
# Create docker-compose.yml with the content below
docker-compose up -d
```

## Docker Compose
```yaml
version: '3.8'

services:
  gitea:
    image: gitea/gitea:latest
    container_name: gitea
    restart: unless-stopped
    environment:
      - USER_UID=1000
      - USER_GID=1000
      - GITEA__database__DB_TYPE=postgres
      - GITEA__database__HOST=gitea-db:5432
      - GITEA__database__NAME=gitea
      - GITEA__database__USER=gitea
      - GITEA__database__PASSWD=gitea
      - GITEA__server__DOMAIN=git.yourdomain.com
      - GITEA__server__ROOT_URL=https://git.yourdomain.com/
      - GITEA__server__SSH_DOMAIN=git.yourdomain.com
      - GITEA__server__SSH_PORT=2222
      - GITEA__server__SSH_LISTEN_PORT=22
      - GITEA__webhook__ALLOWED_HOST_LIST=git.yourdomain.com
      - GITEA__service__DISABLE_REGISTRATION=true
      - GITEA__service__REQUIRE_SIGNIN_VIEW=true
      - GITEA__mailer__ENABLED=true
      - GITEA__mailer__FROM=git@yourdomain.com
      - GITEA__mailer__MAILER_TYPE=smtp
      - GITEA__mailer__HOST=smtp.gmail.com:587
      - GITEA__mailer__USER=your-email@gmail.com
      - GITEA__mailer__PASSWD=your-app-password
      - GITEA__security__INSTALL_LOCK=true
      - GITEA__security__SECRET_KEY=your-secret-key
    ports:
      - "2222:22"
      - "3000:3000"
    volumes:
      - gitea-data:/data
      - /etc/timezone:/etc/timezone:ro
      - /etc/localtime:/etc/localtime:ro
    depends_on:
      - gitea-db
    networks:
      - gitea-network

  gitea-db:
    image: postgres:15-alpine
    container_name: gitea-db
    restart: unless-stopped
    environment:
      - POSTGRES_DB=gitea
      - POSTGRES_USER=gitea
      - POSTGRES_PASSWORD=gitea
    volumes:
      - gitea-db:/var/lib/postgresql/data
    networks:
      - gitea-network

volumes:
  gitea-data:
  gitea-db:

networks:
  gitea-network:
    driver: bridge
```

## Environment Variables
- `USER_UID`/`USER_GID`: User ID for file permissions
- `GITEA__database__*`: Database configuration
- `GITEA__server__*`: Server settings
- `GITEA__service__*`: Service configuration
- `GITEA__mailer__*`: Email configuration
- `GITEA__security__*`: Security settings

## Setup Guide
1. **Generate Secret Key**:
   ```bash
   openssl rand -base64 32
   ```

2. **Create Directories**:
   ```bash
   mkdir -p gitea-data
   ```

3. **Deploy**:
   ```bash
   docker-compose up -d
   ```

4. **Access**: Open http://localhost:3000

5. **Initial Setup**:
   - Create admin account
   - Configure repository settings
   - Set up SSH keys

## Configuration

### App.ini Configuration
```ini
# /data/gitea/conf/app.ini
[database]
DB_TYPE  = postgres
HOST     = gitea-db:5432
NAME     = gitea
USER     = gitea
PASSWD   = gitea

[server]
DOMAIN           = git.yourdomain.com
ROOT_URL         = https://git.yourdomain.com/
SSH_DOMAIN       = git.yourdomain.com
SSH_PORT         = 2222
SSH_LISTEN_PORT  = 22
LFS_START_SERVER = true
LFS_JWT_SECRET  = your-lfs-jwt-secret

[service]
DISABLE_REGISTRATION = true
REQUIRE_SIGNIN_VIEW  = true
ENABLE_NOTIFY_MAIL    = true

[mailer]
ENABLED    = true
FROM       = git@yourdomain.com
MAILER_TYPE = smtp
HOST       = smtp.gmail.com:587
USER       = your-email@gmail.com
PASSWD     = your-app-password

[security]
INSTALL_LOCK = true
SECRET_KEY   = your-secret-key
```

### SSH Configuration
```bash
# Add SSH key to Gitea
ssh-keygen -t ed25519 -C "your-email@example.com"

# Add public key to Gitea web interface
# Test SSH connection
ssh -T git@git.yourdomain.com -p 2222
```

## Repository Management

### Create Repository
```bash
# Create new repository via API
curl -X POST http://localhost:3000/api/v1/user/repos \
  -H "Authorization: token YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"my-repo","description":"My first repository","private":false}'
```

### Clone Repository
```bash
# HTTPS clone
git clone https://git.yourdomain.com/username/my-repo.git

# SSH clone
git clone ssh://git@git.yourdomain.com:2222/username/my-repo.git
```

### Push to Repository
```bash
cd my-repo
git init
git add .
git commit -m "Initial commit"
git remote add origin https://git.yourdomain.com/username/my-repo.git
git push -u origin main
```

## User Management

### Create User
```bash
# Create user via API
curl -X POST http://localhost:3000/api/v1/admin/users \
  -H "Authorization: token YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"username":"newuser","email":"user@example.com","password":"password","must_change_password":false}'
```

### Organizations
```bash
# Create organization
curl -X POST http://localhost:3000/api/v1/orgs \
  -H "Authorization: token YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"username":"myorg","description":"My organization"}'
```

## Actions (CI/CD)

### Enable Actions
```yaml
# In app.ini
[actions]
ENABLED = true

# Create .gitea/workflows/build.yml
name: Build and Test
on: [push, pull_request]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      - name: Install dependencies
        run: npm install
      - name: Run tests
        run: npm test
      - name: Build
        run: npm run build
```

### Package Registry
```bash
# Publish npm package
npm publish --registry https://git.yourdomain.com/api/packages/npm

# Publish Docker image
docker push git.yourdomain.com/username/my-image:latest
```

## Reverse Proxy (Traefik)
```yaml
labels:
  - "traefik.enable=true"
  - "traefik.http.routers.gitea.rule=Host(`git.yourdomain.com`)"
  - "traefik.http.routers.gitea.tls=true"
  - "traefik.http.routers.gitea.tls.certresolver=letsencrypt"
  - "traefik.http.services.gitea.loadbalancer.server.port=3000"
```

## Backup Strategy
```bash
# Backup Gitea data
docker run --rm -v gitea-data:/data -v $(pwd):/backup alpine tar czf /backup/gitea-backup.tar.gz -C /data .

# Backup PostgreSQL database
docker exec gitea-db pg_dump -U gitea gitea > gitea-db-backup.sql

# Restore database
docker exec -i gitea-db psql -U gitea gitea < gitea-db-backup.sql

# Restore Gitea data
docker run --rm -v gitea-data:/data -v $(pwd):/backup alpine tar xzf /backup/gitea-backup.tar.gz -C /data

# Restart after restore
docker-compose restart gitea
```

## Performance Optimization
```yaml
# For better performance
environment:
  - GITEA__cache__ENABLED=true
  - GITEA__cache__ADAPTER=redis
  - GITEA__cache__HOST=redis://redis:6379/0
  - GITEA__queue__TYPE=redis
  - GITEA__queue__CONN_STR=redis://redis:6379/1

# Add Redis service
  redis:
    image: redis:7-alpine
    container_name: gitea-redis
    restart: unless-stopped
    volumes:
      - gitea-redis:/data
    networks:
      - gitea-network
```

## Security

### SSH Keys
```bash
# Generate SSH key pair
ssh-keygen -t ed25519 -C "gitea@yourdomain.com"

# Add to Gitea admin settings
# Configure in app.ini
[ssh]
MINIMUM_KEY_SIZE = 2048
AUTHORIZED_KEYS_ALLOW = true
```

### Access Control
```yaml
environment:
  - GITEA__service__DISABLE_REGISTRATION=true
  - GITEA__service__REQUIRE_SIGNIN_VIEW=true
  - GITEA__security__LOGIN_REMEMBER_DAYS=30
  - GITEA__security__COOKIE_USERNAME=git
  - GITEA__security__COOKIE_REMEMBER_NAME=gitea_incredible
```

### Two-Factor Authentication
```yaml
environment:
  - GITEA__security__TWO_FACTOR_ENABLED=true
  - GITEA__security__TWO_FACTOR_REQUIRE_SIGN_IN=true
```

## Monitoring

### Health Checks
```bash
# Check Gitea health
curl http://localhost:3000/api/v1/version

# Check database connection
docker exec gitea-db pg_isready -U gitea
```

### Logs
```bash
# View logs
docker-compose logs -f gitea

# Check specific logs
docker exec gitea tail -f /data/gitea/log/gitea.log
```

## Troubleshooting
- **SSH connection issues**: Check SSH key configuration
- **Database connection**: Verify PostgreSQL settings
- **Performance problems**: Monitor resource usage
- **Email issues**: Check SMTP configuration
- **Repository access**: Verify permissions

## Maintenance
```bash
# Restart services
docker-compose restart

# Update images
docker-compose pull && docker-compose up -d

# Clean up old data
docker exec gitea gitea admin cleanup

# Check repository integrity
docker exec gitea gitea admin repo check
```

## Advanced Features

### LFS (Large File Storage)
```yaml
environment:
  - GITEA__server__LFS_START_SERVER=true
  - GITEA__server__LFS_JWT_SECRET=your-lfs-jwt-secret

# Install LFS client
git lfs install

# Track large files
git lfs track "*.zip"
git add .gitattributes
git commit -m "Add LFS tracking"
```

### Mirror Repositories
```bash
# Create mirror
curl -X POST http://localhost:3000/api/v1/repos/migrate \
  -H "Authorization: token YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"clone_addr":"https://github.com/user/repo.git","repo_name":"my-mirror","mirror":true}'
```

### Webhooks
```bash
# Create webhook
curl -X POST http://localhost:3000/api/v1/repos/username/repo/hooks \
  -H "Authorization: token YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"type":"gitea","config":{"content_type":"json","url":"https://your-domain.com/webhook","events":["push"]}}'
```

## Integration Examples

### GitHub Migration
```bash
# Migrate from GitHub
curl -X POST http://localhost:3000/api/v1/repos/migrate \
  -H "Authorization: token YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"clone_addr":"https://github.com/user/repo.git","repo_name":"repo","service_type":"github","auth_token":"GITHUB_TOKEN"}'
```

### CI/CD Integration
```yaml
# GitHub Actions compatible workflows
name: CI/CD Pipeline
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run tests
        run: npm test
```

### Package Registry
```bash
# Setup npm registry
npm config set registry https://git.yourdomain.com/api/packages/npm

# Login to registry
npm login --registry https://git.yourdomain.com/api/packages/npm

# Publish package
npm publish
```

## Customization

### Custom Themes
```yaml
# In app.ini
[ui]
DEFAULT_THEME = gitea-auto
THEMES = gitea,gitea-auto,gitea-dark

# Custom CSS
[ui.meta]
AUTHOR = Your Name
DESCRIPTION = Your Git Service
KEYWORDS = git,forge,development
```

### Custom Pages
```yaml
# Custom home page
[ui]
CUSTOM_EMOJIS = :gitea:,:git:
SHOW_MILESTONES_DASHBOARD_PAGE = true
SHOW_ISSUES_SUMMARY_PAGE = true
```
