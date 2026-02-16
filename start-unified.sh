#!/bin/bash

# Unified Docker Compose Management Script
# Usage: ./start-unified.sh [dev|prod|cloudflare|stop|logs|status|clean]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if docker-compose.yml exists
if [ ! -f "docker-compose.yml" ]; then
    print_error "docker-compose.yml not found!"
    exit 1
fi

# Function to show help
show_help() {
    echo "Usage: $0 [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  dev       - Start development environment with hot reload"
    echo "  prod      - Start production environment"
    echo "  cloudflare- Start production with Cloudflare tunnel"
    echo "  stop      - Stop all services"
    echo "  logs      - Show logs for all services"
    echo "  status    - Show status of all services"
    echo "  clean     - Remove all containers, volumes, and images"
    echo "  help      - Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 dev           # Start development mode"
    echo "  $0 prod          # Start production mode"
    echo "  $0 cloudflare    # Start with Cloudflare tunnel"
    echo "  $0 logs          # View logs"
}

# Function to start development environment
start_dev() {
    print_status "Starting development environment..."
    
    # Set development environment variables
    export ENVIRONMENT=development
    export LOG_LEVEL=DEBUG
    export DOMAIN=localhost
    export ACME_EMAIL=admin@localhost
    export DEV_MODE=./internal  # Enable development volumes
    export VITE_API_URL=http://api.localhost
    export CORS_ALLOWED_ORIGINS=http://localhost,http://localhost:3000
    
    # Stop existing containers
    docker compose down 2>/dev/null || true
    
    # Start services
    docker compose up -d --build
    
    print_success "Development environment started!"
    print_status "Frontend: http://localhost"
    print_status "API: http://api.localhost"
    print_status "Traefik Dashboard: http://localhost:8080"
    print_status "Traefik Auth: admin/admin"
}

# Function to start production environment
start_prod() {
    print_status "Starting production environment..."
    
    # Check if required environment variables are set
    if [ -z "$DOMAIN" ] || [ "$DOMAIN" = "localhost" ]; then
        print_error "Please set DOMAIN environment variable for production!"
        print_status "Example: export DOMAIN=yourdomain.com"
        exit 1
    fi
    
    # Unset development mode
    unset DEV_MODE
    
    # Stop existing containers
    docker compose down 2>/dev/null || true
    
    # Start services
    docker compose up -d --build
    
    print_success "Production environment started!"
    print_status "Frontend: https://$DOMAIN"
    print_status "API: https://api.$DOMAIN"
    print_status "Traefik Dashboard: https://traefik.$DOMAIN"
}

# Function to start with Cloudflare tunnel
start_cloudflare() {
    print_status "Starting production environment with Cloudflare tunnel..."
    
    # Check if Cloudflare token is set
    if [ -z "$CLOUDFLARED_TOKEN" ]; then
        print_error "Please set CLOUDFLARED_TOKEN environment variable!"
        print_status "Get token from: https://dash.cloudflare.com/argotunnel"
        exit 1
    fi
    
    # Unset development mode
    unset DEV_MODE
    
    # Stop existing containers
    docker compose down 2>/dev/null || true
    
    # Start services with cloudflared profile
    docker compose --profile cloudflared up -d --build
    
    print_success "Production with Cloudflare tunnel started!"
    print_warning "Note: Cloudflare tunnel will expose your services publicly"
    print_status "Check Cloudflare dashboard for your tunnel URL"
}

# Function to stop services
stop_services() {
    print_status "Stopping all services..."
    docker compose down
    print_success "All services stopped!"
}

# Function to show logs
show_logs() {
    docker compose logs -f
}

# Function to show status
show_status() {
    print_status "Service status:"
    docker compose ps
}

# Function to clean everything
clean_all() {
    print_warning "This will remove ALL containers, volumes, and images!"
    read -p "Are you sure? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_status "Removing containers, volumes, and images..."
        docker compose down -v --rmi all
        docker system prune -f
        print_success "Cleanup complete!"
    else
        print_status "Cleanup cancelled."
    fi
}

# Main script logic
case "${1:-help}" in
    dev)
        start_dev
        ;;
    prod)
        start_prod
        ;;
    cloudflare)
        start_cloudflare
        ;;
    stop)
        stop_services
        ;;
    logs)
        show_logs
        ;;
    status)
        show_status
        ;;
    clean)
        clean_all
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        print_error "Unknown command: $1"
        show_help
        exit 1
        ;;
esac
