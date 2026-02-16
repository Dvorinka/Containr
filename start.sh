#!/bin/bash

# Containr Startup Script
set -e

echo "🚀 Starting Containr..."

# Function to show help
show_help() {
    echo "Usage: $0 [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  dev       Start development environment"
    echo "  prod      Start production environment"
    echo "  cloudflare Start with Cloudflare tunnel"
    echo "  stop      Stop all services"
    echo "  logs      Show logs"
    echo "  status    Show service status"
    echo "  clean     Clean up containers and volumes"
    echo ""
    echo "Examples:"
    echo "  $0 dev                    # Start development environment"
    echo "  $0 prod                   # Start production environment"
    echo "  $0 cloudflare             # Start with Cloudflare tunnel"
    echo "  $0 stop                   # Stop all services"
}

# Function to start development
start_dev() {
    echo "🔧 Starting development environment..."
    docker-compose -f docker-compose.dev.yml up -d
    echo ""
    echo "✅ Development environment started!"
    echo "🌐 Frontend: http://localhost"
    echo "🔌 API: http://api.localhost"
    echo "📊 Traefik Dashboard: http://localhost:8080"
    echo ""
    echo "💡 Run '$0 logs' to see logs"
}

# Function to start production
start_prod() {
    echo "🚀 Starting production environment..."
    if [ ! -f .env ]; then
        echo "❌ .env file not found. Please create it from .env.example"
        exit 1
    fi
    docker-compose up -d
    echo ""
    echo "✅ Production environment started!"
    echo "🌐 Check your domain configuration in .env"
    echo ""
    echo "💡 Run '$0 logs' to see logs"
}

# Function to start with Cloudflare
start_cloudflare() {
    echo "☁️ Starting with Cloudflare tunnel..."
    if [ ! -f .env ]; then
        echo "❌ .env file not found. Please create it from .env.example"
        exit 1
    fi
    
    # Check if CLOUDFLARED_TOKEN is set
    if ! grep -q "CLOUDFLARED_TOKEN=" .env || grep -q "CLOUDFLARED_TOKEN=$" .env; then
        echo "❌ CLOUDFLARED_TOKEN not set in .env file"
        echo "Please set your Cloudflare tunnel token in .env"
        exit 1
    fi
    
    docker-compose --profile cloudflared up -d
    echo ""
    echo "✅ Started with Cloudflare tunnel!"
    echo "🌐 Check your Cloudflare dashboard for tunnel URLs"
    echo ""
    echo "💡 Run '$0 logs' to see logs"
}

# Function to stop services
stop_services() {
    echo "🛑 Stopping all services..."
    docker-compose --profile cloudflared down 2>/dev/null || true
    docker-compose -f docker-compose.dev.yml down 2>/dev/null || true
    docker-compose down 2>/dev/null || true
    echo "✅ All services stopped"
}

# Function to show logs
show_logs() {
    echo "📋 Showing logs (Ctrl+C to exit)..."
    if docker-compose -f docker-compose.dev.yml ps -q | grep -q .; then
        docker-compose -f docker-compose.dev.yml logs -f
    elif docker-compose --profile cloudflared ps -q | grep -q .; then
        docker-compose --profile cloudflared logs -f
    else
        docker-compose logs -f
    fi
}

# Function to show status
show_status() {
    echo "📊 Service Status:"
    echo ""
    
    if docker-compose -f docker-compose.dev.yml ps -q | grep -q .; then
        echo "Development Environment:"
        docker-compose -f docker-compose.dev.yml ps
        echo ""
    fi
    
    if docker-compose --profile cloudflared ps -q | grep -q .; then
        echo "Cloudflare Environment:"
        docker-compose --profile cloudflared ps
        echo ""
    fi
    
    if docker-compose ps -q | grep -q .; then
        echo "Production Environment:"
        docker-compose ps
    else
        echo "No services are currently running"
    fi
}

# Function to clean up
clean_up() {
    echo "🧹 Cleaning up..."
    docker-compose --profile cloudflared down -v --remove-orphans 2>/dev/null || true
    docker-compose -f docker-compose.dev.yml down -v --remove-orphans 2>/dev/null || true
    docker-compose down -v --remove-orphans 2>/dev/null || true
    docker system prune -f
    docker volume prune -f
    echo "✅ Cleanup completed"
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
        clean_up
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        echo "❌ Unknown command: $1"
        echo ""
        show_help
        exit 1
        ;;
esac
