# Containr - Container Management Platform

A modern container management platform with built-in Cloudflare tunnel support for easy deployment without domain configuration.

## Quick Start

### Prerequisites
- Docker and Docker Compose
- Node.js (for development)
- Go (for backend development)

### Installation

1. **Clone and setup:**
   ```bash
   git clone <repository-url>
   cd Containr
   ```

2. **Configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

### Running the Application

**Single Docker Compose File - Multiple Environments**

```bash
# Development mode with hot reload
./start-unified.sh dev

# Production mode (requires DOMAIN env var)
export DOMAIN=yourdomain.com
./start-unified.sh prod

# Production with Cloudflare tunnel (requires CLOUDFLARED_TOKEN)
export CLOUDFLARED_TOKEN=your_token_here
./start-unified.sh cloudflare

# Stop all services
./start-unified.sh stop

# View logs
./start-unified.sh logs

# Check status
./start-unified.sh status

# Clean everything
./start-unified.sh clean
```

### Access Points

**Development:**
- Frontend: http://localhost
- API: http://api.localhost  
- Traefik Dashboard: http://localhost:8080

**Production:**
- Frontend: https://your-domain.com
- API: https://api.your-domain.com
- Traefik Dashboard: https://traefik.your-domain.com

**Cloudflare Tunnel:**
- Check your Cloudflare dashboard for tunnel URLs

### Management Commands

```bash
./start.sh logs        # View logs
./start.sh status      # Check service status
./start.sh stop        # Stop all services
./start.sh clean       # Clean up containers and volumes
./start.sh help        # Show all commands
```

## Features

- 🐳 **Container Management** - Deploy and manage containers
- ☁️ **Cloudflare Tunnel** - Zero-config deployment with automatic SSL
- 🌐 **Web Interface** - Modern React-based UI
- 🔧 **Settings Panel** - Visual configuration management
- 📊 **Infrastructure Monitoring** - Real-time resource monitoring
- 🔐 **Security** - Built-in authentication and authorization

## Cloudflare Setup

1. **Create a tunnel** in your [Cloudflare Dashboard](https://dash.cloudflare.com/argotunnel)
2. **Copy the tunnel token**
3. **Add to .env:**
   ```env
   CLOUDFLARED_TOKEN=your_tunnel_token_here
   ```
4. **Start with tunnel:**
   ```bash
   ./start.sh cloudflare
   ```

## Development

### Frontend Development
```bash
cd frontend
npm install
npm run dev
```

### Backend Development
```bash
cd backend
go mod download
go run main.go
```

## Configuration

### Environment Variables

Key configuration options in `.env`:

```env
# Domain Configuration (optional if using Cloudflare)
DOMAIN=yourdomain.com
ACME_EMAIL=admin@yourdomain.com

# Database
POSTGRES_DB=containr
POSTGRES_USER=containr_user
POSTGRES_PASSWORD=secure_password

# Cloudflare Tunnel (alternative to domain)
CLOUDFLARED_TOKEN=your_tunnel_token_here

# Application
JWT_SECRET=your_jwt_secret
CORS_ALLOWED_ORIGINS=https://yourdomain.com
```

## Architecture

- **Frontend**: React + TypeScript + Vite + TailwindCSS
- **Backend**: Go + Gin + PostgreSQL + Redis
- **Proxy**: Traefik with automatic SSL
- **Tunnel**: Cloudflare Argo Tunnel (optional)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License - see LICENSE file for details
