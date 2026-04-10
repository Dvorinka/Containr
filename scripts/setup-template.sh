#!/bin/bash

# Docker Template Auto-Setup Script
# This script provides a guided walkthrough for deploying any template

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Template directory
TEMPLATE_DIR="$(dirname "$0")/../templates"

# Available templates
declare -A TEMPLATES=(
    ["umami"]="Umami Analytics - Privacy-focused web analytics"
    ["plex"]="Plex Media Server - Media streaming and organization"
    ["immich"]="Immich - Photo and video backup solution"
    ["n8n"]="n8n - Workflow automation platform"
    ["supabase"]="Supabase - Open source Firebase alternative"
    ["home-assistant"]="Home Assistant - Smart home automation"
    ["uptime-kuma"]="Uptime Kuma - Monitoring dashboard"
    ["grafana"]="Grafana - Metrics visualization and monitoring"
    ["traefik"]="Traefik - Reverse proxy and load balancer"
    ["memos"]="Memos - Note-taking and knowledge management"
    ["meilisearch"]="MeiliSearch - Fast search engine"
    ["vaultwarden"]="Vaultwarden - Password manager (Bitwarden alternative)"
    ["pihole"]="Pi-hole - DNS ad blocker"
    ["appwrite"]="Appwrite - Backend-as-a-Service platform"
    ["gitea"]="Gitea - Git hosting service"
    ["mastodon"]="Mastodon - Decentralized social network"
    ["jellyfin"]="Jellyfin - Media server (Plex alternative)"
    ["nextcloud"]="Nextcloud - Cloud storage and collaboration"
    ["glance"]="Glance - Personal dashboard"
    ["cloudreve"]="Cloudreve - File manager with multiple backends"
)

print_header() {
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

check_dependencies() {
    print_header "Checking Dependencies"
    
    # Check Docker
    if command -v docker &> /dev/null; then
        print_success "Docker is installed"
        docker_version=$(docker --version | cut -d' ' -f3 | cut -d',' -f1)
        print_info "Docker version: $docker_version"
    else
        print_error "Docker is not installed"
        print_info "Please install Docker: https://docs.docker.com/get-docker/"
        exit 1
    fi
    
    # Check Docker Compose
    if command -v docker-compose &> /dev/null; then
        print_success "Docker Compose is installed"
        compose_version=$(docker-compose --version | cut -d' ' -f3 | cut -d',' -f1)
        print_info "Docker Compose version: $compose_version"
    elif docker compose version &> /dev/null; then
        print_success "Docker Compose (plugin) is installed"
        compose_version=$(docker compose version | cut -d' ' -f3 | cut -d',' -f1)
        print_info "Docker Compose version: $compose_version"
        DOCKER_COMPOSE_CMD="docker compose"
    else
        print_error "Docker Compose is not installed"
        print_info "Please install Docker Compose: https://docs.docker.com/compose/install/"
        exit 1
    fi
    
    # Check if template directory exists
    if [[ ! -d "$TEMPLATE_DIR" ]]; then
        print_error "Template directory not found: $TEMPLATE_DIR"
        exit 1
    fi
    
    print_success "All dependencies are met"
}

list_templates() {
    print_header "Available Templates"
    
    echo "Available templates:"
    for template in "${!TEMPLATES[@]}"; do
        echo "  • $template - ${TEMPLATES[$template]}"
    done
    echo ""
}

select_template() {
    if [[ -n "$SELECTED_TEMPLATE" ]]; then
        if [[ -z "${TEMPLATES[$SELECTED_TEMPLATE]}" ]]; then
            print_error "Unknown template: $SELECTED_TEMPLATE"
            list_templates
            exit 1
        fi
        return
    fi
    
    print_header "Select Template"
    
    local i=1
    local template_array=()
    
    for template in "${!TEMPLATES[@]}"; do
        echo "  $i) $template - ${TEMPLATES[$template]}"
        template_array+=("$template")
        ((i++))
    done
    
    echo ""
    read -p "Select a template (1-${#template_array[@]}): " choice
    
    if [[ $choice =~ ^[0-9]+$ ]] && [ $choice -ge 1 ] && [ $choice -le ${#template_array[@]} ]; then
        SELECTED_TEMPLATE="${template_array[$((choice-1))]}"
    else
        print_error "Invalid selection"
        exit 1
    fi
    
    print_success "Selected template: $SELECTED_TEMPLATE"
}

setup_template() {
    local template="$1"
    local template_file="$TEMPLATE_DIR/$template.md"
    
    if [[ ! -f "$template_file" ]]; then
        print_error "Template file not found: $template_file"
        exit 1
    fi
    
    print_header "Setting up $template"
    
    # Create project directory
    local project_dir="$PWD/$template-deployment"
    if [[ -d "$project_dir" ]]; then
        print_warning "Directory $project_dir already exists"
        read -p "Do you want to remove it and continue? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            rm -rf "$project_dir"
        else
            print_info "Please choose a different location or remove the existing directory"
            exit 1
        fi
    fi
    
    mkdir -p "$project_dir"
    print_success "Created project directory: $project_dir"
    
    # Extract docker-compose.yml from template
    extract_docker_compose "$template_file" "$project_dir"
    
    # Check for environment variables
    check_environment_variables "$template_file" "$project_dir"
    
    # Check for additional setup steps
    check_setup_requirements "$template_file" "$project_dir"
    
    print_success "Template setup completed"
    print_info "Project directory: $project_dir"
    print_info "Next steps:"
    echo "  1. cd $project_dir"
    echo "  2. Review and modify configuration if needed"
    echo "  3. Run: ${DOCKER_COMPOSE_CMD:-docker-compose} up -d"
}

extract_docker_compose() {
    local template_file="$1"
    local project_dir="$2"
    
    print_info "Extracting docker-compose.yml..."
    
    # Extract docker-compose.yml from markdown file
    sed -n '/```yaml/,/```/p' "$template_file" | sed '1d;$d' > "$project_dir/docker-compose.yml"
    
    if [[ ! -s "$project_dir/docker-compose.yml" ]]; then
        print_error "Failed to extract docker-compose.yml"
        exit 1
    fi
    
    print_success "docker-compose.yml extracted"
}

check_environment_variables() {
    local template_file="$1"
    local project_dir="$2"
    
    print_info "Checking for required environment variables..."
    
    # Extract environment variables section
    local env_vars=$(sed -n '/## Environment Variables/,/##/p' "$template_file" | grep -E '^- `[^`]+`')
    
    if [[ -n "$env_vars" ]]; then
        print_warning "This template requires environment variables:"
        echo "$env_vars"
        echo ""
        
        # Create .env file template
        local env_file="$project_dir/.env"
        echo "# Environment variables for $template" > "$env_file"
        echo "# Please update these values before starting the services" >> "$env_file"
        echo "" >> "$env_file"
        
        # Add common environment variables
        echo "$env_vars" | while read -r line; do
            if [[ $line =~ -\s*\`([^`]+)\`.* ]]; then
                local var_name="${BASH_REMATCH[1]}"
                echo "$var_name=change_me" >> "$env_file"
            fi
        done
        
        print_success "Created .env template file"
        print_warning "Please edit $env_file with your values before starting"
    fi
}

check_setup_requirements() {
    local template_file="$1"
    local project_dir="$2"
    
    print_info "Checking setup requirements..."
    
    # Extract setup guide section
    local setup_guide=$(sed -n '/## Setup Guide/,/##/p' "$template_file")
    
    if [[ -n "$setup_guide" ]]; then
        print_warning "This template has specific setup requirements:"
        echo "$setup_guide" | head -20
        echo ""
        print_info "Please review the full setup guide in $template_file"
    fi
    
    # Check for volume requirements
    local volumes=$(grep -E "^\s*-\s+.*:/" "$project_dir/docker-compose.yml" | grep -v "./")
    if [[ -n "$volumes" ]]; then
        print_warning "This template requires host directories:"
        echo "$volumes"
        echo ""
        print_info "Please create these directories or update the paths in docker-compose.yml"
    fi
}

deploy_template() {
    local project_dir="$PWD/$SELECTED_TEMPLATE-deployment"
    
    print_header "Deploying $SELECTED_TEMPLATE"
    
    if [[ ! -d "$project_dir" ]]; then
        print_error "Project directory not found: $project_dir"
        print_info "Please run setup first"
        exit 1
    fi
    
    cd "$project_dir"
    
    # Check if .env exists and has default values
    if [[ -f ".env" ]]; then
        if grep -q "change_me" .env; then
            print_warning "Please update the environment variables in .env file"
            print_info "Current values that need updating:"
            grep "change_me" .env
            echo ""
            read -p "Continue anyway? (y/N): " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                exit 1
            fi
        fi
    fi
    
    print_info "Starting deployment..."
    
    # Pull images
    print_info "Pulling Docker images..."
    ${DOCKER_COMPOSE_CMD:-docker-compose} pull
    
    # Start services
    print_info "Starting services..."
    ${DOCKER_COMPOSE_CMD:-docker-compose} up -d
    
    # Show status
    print_success "Deployment completed!"
    ${DOCKER_COMPOSE_CMD:-docker-compose} ps
    
    # Show access information
    show_access_info "$project_dir"
}

show_access_info() {
    local project_dir="$1"
    
    print_header "Access Information"
    
    # Extract ports from docker-compose.yml
    local ports=$(grep -E "^\s*-\s*\"[0-9]+:[0-9]+\"" "$project_dir/docker-compose.yml")
    
    if [[ -n "$ports" ]]; then
        print_info "Service access URLs:"
        echo "$ports" | while read -r line; do
            if [[ $line =~ -\s*\"([0-9]+):([0-9]+)\" ]]; then
                local host_port="${BASH_REMATCH[1]}"
                local container_port="${BASH_REMATCH[2]}"
                echo "  • http://localhost:$host_port (container port: $container_port)"
            fi
        done
    fi
    
    print_info "Useful commands:"
    echo "  • View logs: ${DOCKER_COMPOSE_CMD:-docker-compose} logs -f"
    echo "  • Stop services: ${DOCKER_COMPOSE_CMD:-docker-compose} down"
    echo "  • Restart services: ${DOCKER_COMPOSE_CMD:-docker-compose} restart"
    echo "  • Update services: ${DOCKER_COMPOSE_CMD:-docker-compose} pull && ${DOCKER_COMPOSE_CMD:-docker-compose} up -d"
}

show_help() {
    echo "Docker Template Setup Script"
    echo ""
    echo "Usage: $0 [OPTIONS] [TEMPLATE]"
    echo ""
    echo "Options:"
    echo "  -h, --help     Show this help message"
    echo "  -l, --list     List available templates"
    echo "  -s, --setup    Setup template only (don't deploy)"
    echo "  -d, --deploy   Deploy template (requires setup first)"
    echo ""
    echo "Templates:"
    list_templates
    echo ""
    echo "Examples:"
    echo "  $0                           # Interactive mode"
    echo "  $0 umami                     # Setup umami template"
    echo "  $0 --list                    # List all templates"
    echo "  $0 --setup umami             # Setup umami only"
    echo "  $0 --deploy umami            # Deploy umami (must be setup first)"
}

# Main script logic
main() {
    local action="interactive"
    local setup_only=false
    local deploy_only=false
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                show_help
                exit 0
                ;;
            -l|--list)
                list_templates
                exit 0
                ;;
            -s|--setup)
                setup_only=true
                shift
                ;;
            -d|--deploy)
                deploy_only=true
                shift
                ;;
            -*)
                print_error "Unknown option: $1"
                show_help
                exit 1
                ;;
            *)
                SELECTED_TEMPLATE="$1"
                shift
                ;;
        esac
    done
    
    # Check dependencies
    check_dependencies
    
    # Execute based on action
    if [[ "$deploy_only" == true ]]; then
        if [[ -z "$SELECTED_TEMPLATE" ]]; then
            print_error "Template name required for deployment"
            exit 1
        fi
        deploy_template
    elif [[ "$setup_only" == true ]]; then
        select_template
        setup_template "$SELECTED_TEMPLATE"
    else
        # Interactive mode
        select_template
        setup_template "$SELECTED_TEMPLATE"
        
        echo ""
        read -p "Do you want to deploy the template now? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            deploy_template
        else
            print_info "Setup completed. You can deploy later by running:"
            echo "  $0 --deploy $SELECTED_TEMPLATE"
        fi
    fi
}

# Run main function
main "$@"
