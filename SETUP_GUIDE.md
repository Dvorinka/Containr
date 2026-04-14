# Docker Template Auto-Setup Guide

## 🚀 How It Works

The templates are **configuration files** that define how to run each service with Docker Compose. They don't auto-execute - you need to use the setup script to deploy them.

## 📋 Quick Start

### 1. Interactive Mode (Recommended)
```bash
# Run the setup script interactively
./scripts/setup-template.sh
```

### 2. Direct Template Selection
```bash
# Setup a specific template
./scripts/setup-template.sh umami

# List all available templates
./scripts/setup-template.sh --list

# Setup only (don't deploy)
./scripts/setup-template.sh --setup umami

# Deploy existing setup
./scripts/setup-template.sh --deploy umami
```

## 🔄 What the Script Does

### Step 1: Dependency Check
- ✅ Verifies Docker is installed
- ✅ Verifies Docker Compose is installed
- ✅ Checks template directory exists

### Step 2: Template Selection
- 📋 Shows available templates with descriptions
- 🎯 Lets you choose interactively or via command line

### Step 3: Project Setup
- 📁 Creates deployment directory (`template-name-deployment/`)
- 📄 Extracts `docker-compose.yml` from template
- 🔧 Creates `.env` file template with required variables
- ⚠️ Shows setup requirements and warnings

### Step 4: Deployment (Optional)
- 🐳 Pulls Docker images
- 🚀 Starts services with `docker-compose up -d`
- 📊 Shows service status and access URLs
- 📝 Provides useful commands

## 📁 Directory Structure After Setup

```
your-project/
├── scripts/
│   └── setup-template.sh          # Auto-setup script
├── templates/
│   ├── umami.md                   # Template documentation
│   ├── plex.md
│   ├── immich.md
│   └── ...
└── umami-deployment/              # Created by setup script
    ├── docker-compose.yml         # Extracted from template
    ├── .env                       # Environment variables
    └── README.md                  # Setup instructions
```

## 🎯 Interactive Walkthrough Example

### Running Umami Setup:
```bash
$ ./scripts/setup-template.sh

========================================
Checking Dependencies
========================================
✅ Docker is installed
Docker version: 24.0.6
✅ Docker Compose is installed
Docker Compose version: 2.21.0
✅ All dependencies are met

========================================
Select Template
========================================
  1) umami - Umami Analytics - Privacy-focused web analytics
  2) plex - Plex Media Server - Media streaming and organization
  3) immich - Immich - Photo and video backup solution
  ...
Select a template (1-20): 1
✅ Selected template: umami

========================================
Setting up umami
========================================
✅ Created project directory: /path/to/umami-deployment
✅ docker-compose.yml extracted
⚠️ This template requires environment variables:
- `DATABASE_URL`: PostgreSQL connection string
- `APP_SECRET`: Random string for application secrets
✅ Created .env template file
⚠️ Please edit umami-deployment/.env with your values before starting

Do you want to deploy the template now? (y/N): y

========================================
Deploying umami
========================================
✅ Pulling Docker images...
✅ Starting services...
✅ Deployment completed!

========================================
Access Information
========================================
✅ Service access URLs:
  • http://localhost:3000 (container port: 3000)

Useful commands:
  • View logs: docker-compose logs -f
  • Stop services: docker-compose down
  • Restart services: docker-compose restart
  • Update services: docker-compose pull && docker-compose up -d
```

## 🔧 Manual Setup (Without Script)

If you prefer manual setup:

1. **Choose a template** from `/templates/`
2. **Copy the docker-compose.yml** section
3. **Create a project directory**
4. **Set up environment variables**
5. **Run `docker-compose up -d`**

Example for Umami:
```bash
mkdir umami-deployment
cd umami-deployment

# Copy docker-compose.yml from templates/umami.md
# Create .env file with required variables
docker-compose up -d
```

## 🎛️ Available Templates

| Template | Description | Difficulty |
|----------|-------------|------------|
| **umami** | Web Analytics | Easy |
| **plex** | Media Server | Medium |
| **immich** | Photo Backup | Medium |
| **n8n** | Workflow Automation | Medium |
| **supabase** | Backend Service | Hard |
| **home-assistant** | Smart Home | Medium |
| **uptime-kuma** | Monitoring | Easy |
| **grafana** | Metrics Dashboard | Medium |
| **traefik** | Reverse Proxy | Medium |
| **memos** | Note-taking | Easy |
| **meilisearch** | Search Engine | Easy |
| **vaultwarden** | Password Manager | Medium |
| **pihole** | DNS Blocker | Medium |
| **appwrite** | Backend Platform | Hard |
| **gitea** | Git Hosting | Medium |
| **mastodon** | Social Network | Hard |
| **jellyfin** | Media Server | Medium |
| **nextcloud** | Cloud Storage | Hard |
| **glance** | Dashboard | Easy |
| **cloudreve** | File Manager | Medium |

## 🛠️ Advanced Usage

### Custom Deployment Directory
```bash
# Set custom deployment directory
export DEPLOY_DIR="/opt/my-services"
./scripts/setup-template.sh umami
```

### Batch Setup
```bash
# Setup multiple templates
for template in umami plex nextcloud; do
    ./scripts/setup-template.sh --setup "$template"
done
```

### Production Deployment
```bash
# Setup with production considerations
./scripts/setup-template.sh --setup umami
cd umami-deployment

# Edit .env with production values
# Configure reverse proxy
# Set up SSL certificates
# Run deployment
./scripts/setup-template.sh --deploy umami
```

## 🔍 Troubleshooting

### Common Issues

1. **Docker not installed**
   ```bash
   # Install Docker
   curl -fsSL https://get.docker.com -o get-docker.sh
   sudo sh get-docker.sh
   ```

2. **Permission denied**
   ```bash
   # Add user to docker group
   sudo usermod -aG docker $USER
   # Log out and back in
   ```

3. **Port conflicts**
   ```bash
   # Check what's using ports
   netstat -tulpn | grep :3000
   # Modify docker-compose.yml to use different ports
   ```

4. **Environment variables not set**
   ```bash
   # Edit .env file
   nano umami-deployment/.env
   # Replace change_me values
   ```

### Getting Help

Each template includes:
- ✅ **Complete setup instructions**
- ✅ **Environment variable explanations**
- ✅ **Troubleshooting section**
- ✅ **Backup strategies**
- ✅ **Performance optimization**

## 🎯 Next Steps

1. **Try the interactive setup**:
   ```bash
   ./scripts/setup-template.sh
   ```

2. **Start with an easy template** (umami, glance, memos)

3. **Read the template documentation** before deployment

4. **Check the troubleshooting section** if you encounter issues

5. **Join the community** for each service for additional support

## 📞 Support

For issues with:
- **Setup script**: Create an issue in this repository
- **Specific service**: Check the service's official documentation
- **Docker issues**: Refer to Docker documentation

Each template includes links to official documentation and community support channels.
