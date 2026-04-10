#!/bin/bash

# One-Click Docker Template Auto-Deployment
# Fully automated deployment with no user interaction required

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
TEMPLATE_DIR="$(dirname "$0")/../templates"
DEPLOYMENT_BASE_DIR="$(dirname "$0")/../deployments"
LOG_FILE="/tmp/docker-auto-deploy.log"

# Auto-configuration
AUTO_GENERATE_SECRETS=true
AUTO_CREATE_DIRECTORIES=true
AUTO_PULL_IMAGES=true
AUTO_START_SERVICES=true
AUTO_OPEN_BROWSER=false

# Template configurations with auto-generated defaults
declare -A TEMPLATE_CONFIGS=(
    ["umami"]="port:3000,database:postgres,secrets:APP_SECRET"
    ["plex"]="port:32400,database:none,secrets:none"
    ["immich"]="port:2283,database:postgres,secrets:DATABASE_PASSWORD"
    ["n8n"]="port:5678,database:postgres,secrets:N8N_ENCRYPTION_KEY"
    ["supabase"]="port:8000,database:postgres,secrets:JWT_SECRET"
    ["home-assistant"]="port:8123,database:postgres,secrets:none"
    ["uptime-kuma"]="port:3001,database:none,secrets:none"
    ["grafana"]="port:3000,database:postgres,secrets:GF_SECURITY_ADMIN_PASSWORD"
    ["traefik"]="port:80,database:none,secrets:none"
    ["memos"]="port:5230,database:sqlite,secrets:none"
    ["meilisearch"]="port:7700,database:none,secrets:MEILI_MASTER_KEY"
    ["vaultwarden"]="port:8080,database:postgres,secrets:ADMIN_TOKEN"
    ["pihole"]="port:80,database:none,secrets:FTLCONF_webserver_api_password"
    ["appwrite"]="port:80,database:postgres,secrets:_APP_OPENSSL_KEY_V1"
    ["gitea"]="port:3000,database:postgres,secrets:SECRET_KEY"
    ["mastodon"]="port:3000,database:postgres,secrets:SECRET_KEY_BASE"
    ["jellyfin"]="port:8096,database:none,secrets:none"
    ["nextcloud"]="port:8080,database:postgres,secrets:NEXTCLOUD_ADMIN_PASSWORD"
    ["glance"]="port:8080,database:none,secrets:none"
    ["cloudreve"]="port:5212,database:postgres,secrets:CR_CONF_Database_Password"
)

print_header() {
    echo -e "${PURPLE}========================================${NC}"
    echo -e "${PURPLE}$1${NC}"
    echo -e "${PURPLE}========================================${NC}"
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

print_step() {
    echo -e "${CYAN}🔄 $1${NC}"
}

log_message() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

check_dependencies() {
    print_step "Checking dependencies..."
    log_message "Starting dependency check"
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed"
        print_info "Installing Docker automatically..."
        curl -fsSL https://get.docker.com -o get-docker.sh
        sudo sh get-docker.sh
        sudo usermod -aG docker $USER
        print_success "Docker installed"
    else
        print_success "Docker is installed"
    fi
    
    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        print_error "Docker Compose is not installed"
        print_info "Installing Docker Compose automatically..."
        sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
        sudo chmod +x /usr/local/bin/docker-compose
        print_success "Docker Compose installed"
    else
        print_success "Docker Compose is installed"
    fi
    
    log_message "Dependency check completed"
}

generate_secret() {
    local length=${1:-32}
    openssl rand -base64 $length | tr -d "=+/" | cut -c1-$length
}

generate_password() {
    local length=${1:-16}
    openssl rand -base64 $length | tr -d "=+/" | cut -c1-$length
}

auto_generate_secrets() {
    local template="$1"
    local env_file="$2"
    
    print_step "Auto-generating secrets for $template..."
    
    local config="${TEMPLATE_CONFIGS[$template]}"
    local secrets=$(echo "$config" | cut -d',' -f3 | cut -d':' -f2)
    
    if [[ "$secrets" == "none" ]]; then
        return
    fi
    
    # Read existing .env file
    local temp_env=$(mktemp)
    cp "$env_file" "$temp_env"
    
    # Generate secrets for each required variable
    case "$template" in
        "umami")
            sed -i "s/APP_SECRET=change_me/APP_SECRET=$(generate_secret)/g" "$temp_env"
            ;;
        "immich")
            sed -i "s/DATABASE_PASSWORD=change_me/DATABASE_PASSWORD=$(generate_password)/g" "$temp_env"
            ;;
        "n8n")
            sed -i "s/N8N_ENCRYPTION_KEY=change_me/N8N_ENCRYPTION_KEY=$(generate_secret)/g" "$temp_env"
            ;;
        "supabase")
            sed -i "s/JWT_SECRET=change_me/JWT_SECRET=$(generate_secret)/g" "$temp_env"
            ;;
        "grafana")
            sed -i "s/GF_SECURITY_ADMIN_PASSWORD=change_me/GF_SECURITY_ADMIN_PASSWORD=$(generate_password)/g" "$temp_env"
            ;;
        "vaultwarden")
            sed -i "s/ADMIN_TOKEN=change_me/ADMIN_TOKEN=$(generate_secret)/g" "$temp_env"
            ;;
        "pihole")
            sed -i "s/FTLCONF_webserver_api_password=change_me/FTLCONF_webserver_api_password=$(generate_password)/g" "$temp_env"
            ;;
        "appwrite")
            sed -i "s/_APP_OPENSSL_KEY_V1=change_me/_APP_OPENSSL_KEY_V1=$(generate_secret)/g" "$temp_env"
            ;;
        "gitea")
            sed -i "s/SECRET_KEY=change_me/SECRET_KEY=$(generate_secret)/g" "$temp_env"
            ;;
        "mastodon")
            sed -i "s/SECRET_KEY_BASE=change_me/SECRET_KEY_BASE=$(generate_secret)/g" "$temp_env"
            sed -i "s/OTP_SECRET=change_me/OTP_SECRET=$(generate_secret)/g" "$temp_env"
            sed -i "s/VAPID_PRIVATE_KEY=change_me/VAPID_PRIVATE_KEY=$(openssl ecparam -name prime256v1 -genkey -noout | openssl ec -outform DER | tail -c +8 | head -c 32 | base64)/g" "$temp_env"
            sed -i "s/VAPID_PUBLIC_KEY=change_me/VAPID_PUBLIC_KEY=$(openssl ecparam -name prime256v1 -genkey -noout | openssl ec -outform DER -pubout -outform DER | tail -c +8 | head -c 32 | base64)/g" "$temp_env"
            ;;
        "nextcloud")
            sed -i "s/NEXTCLOUD_ADMIN_PASSWORD=change_me/NEXTCLOUD_ADMIN_PASSWORD=$(generate_password)/g" "$temp_env"
            ;;
        "cloudreve")
            sed -i "s/CR_CONF_Database_Password=change_me/CR_CONF_Database_Password=$(generate_password)/g" "$temp_env"
            ;;
    esac
    
    mv "$temp_env" "$env_file"
    print_success "Secrets auto-generated"
    log_message "Secrets generated for $template"
}

auto_create_directories() {
    local template="$1"
    local project_dir="$2"
    
    print_step "Auto-creating directories for $template..."
    
    # Create common directories
    local dirs=("data" "logs" "config" "uploads")
    
    case "$template" in
        "plex")
            dirs+=("movies" "tvshows" "music" "photos")
            ;;
        "immich")
            dirs+=("uploads" "library")
            ;;
        "jellyfin")
            dirs+=("media" "movies" "tvshows" "music" "photos")
            ;;
        "nextcloud")
            dirs+=("nextcloud-data" "nextcloud-config")
            ;;
        "pihole")
            dirs+=("pihole-config" "pihole-dnsmasq" "pihole-logs")
            ;;
        "vaultwarden")
            dirs+=("vaultwarden-data")
            ;;
        "gitea")
            dirs+=("gitea-data" "gitea-db")
            ;;
        "mastodon")
            dirs+=("mastodon-data" "postgres-data" "redis-data")
            ;;
    esac
    
    for dir in "${dirs[@]}"; do
        mkdir -p "$project_dir/$dir"
        print_success "Created directory: $dir"
    done
    
    log_message "Directories created for $template"
}

extract_docker_compose() {
    local template_file="$1"
    local project_dir="$2"
    
    print_step "Extracting docker-compose.yml..."
    
    # Extract docker-compose.yml from markdown file
    sed -n '/```yaml/,/```/p' "$template_file" | sed '1d;$d' > "$project_dir/docker-compose.yml"
    
    if [[ ! -s "$project_dir/docker-compose.yml" ]]; then
        print_error "Failed to extract docker-compose.yml"
        exit 1
    fi
    
    # Auto-fix common issues
    fix_docker_compose "$project_dir/docker-compose.yml" "$template"
    
    print_success "docker-compose.yml extracted and optimized"
    log_message "docker-compose.yml extracted for $template"
}

fix_docker_compose() {
    local compose_file="$1"
    local template="$2"
    
    # Fix volume paths to use auto-created directories
    case "$template" in
        "plex")
            sed -i 's|/path/to/media|./media|g' "$compose_file"
            sed -i 's|/path/to/tvseries|./tvshows|g' "$compose_file"
            sed -i 's|/path/to/movies|./movies|g' "$compose_file"
            ;;
        "immich")
            sed -i 's|/path/to/local-storage|./uploads|g' "$compose_file"
            ;;
        "jellyfin")
            sed -i 's|/path/to/media|./media|g' "$compose_file"
            ;;
        "nextcloud")
            sed -i 's|/path/to/nextcloud-data|./nextcloud-data|g' "$compose_file"
            ;;
        "vaultwarden")
            sed -i 's|vaultwarden-data|./data|g' "$compose_file"
            ;;
    esac
    
    # Fix port conflicts by auto-assigning available ports
    auto_assign_ports "$compose_file" "$template"
}

auto_assign_ports() {
    local compose_file="$1"
    local template="$2"
    
    local config="${TEMPLATE_CONFIGS[$template]}"
    local default_port=$(echo "$config" | cut -d',' -f1 | cut -d':' -f2)
    
    # Check if default port is available
    if ! netstat -tuln 2>/dev/null | grep -q ":$default_port "; then
        print_info "Port $default_port is available"
        return
    fi
    
    # Find next available port
    local new_port=$default_port
    while netstat -tuln 2>/dev/null | grep -q ":$new_port "; do
        new_port=$((new_port + 1))
    done
    
    if [[ $new_port -ne $default_port ]]; then
        print_warning "Port $default_port is busy, using $new_port"
        sed -i "s/- \"$default_port:/- \"$new_port:/g" "$compose_file"
        sed -i "s/- $default_port:/- $new_port:/g" "$compose_file"
        log_message "Port changed from $default_port to $new_port for $template"
    fi
}

create_env_file() {
    local template="$1"
    local project_dir="$2"
    local env_file="$project_dir/.env"
    
    print_step "Creating .env file..."
    
    # Extract environment variables from template
    local env_vars=$(sed -n '/## Environment Variables/,/##/p' "$TEMPLATE_DIR/$template.md" | grep -E '^- `[^`]+`')
    
    if [[ -n "$env_vars" ]]; then
        echo "# Auto-generated environment variables for $template" > "$env_file"
        echo "# Generated on $(date)" >> "$env_file"
        echo "" >> "$env_file"
        
        echo "$env_vars" | while read -r line; do
            if [[ $line =~ -\s*\`([^`]+)\`.* ]]; then
                local var_name="${BASH_REMATCH[1]}"
                echo "$var_name=change_me" >> "$env_file"
            fi
        done
        
        # Auto-generate secrets
        if [[ "$AUTO_GENERATE_SECRETS" == "true" ]]; then
            auto_generate_secrets "$template" "$env_file"
        fi
        
        print_success ".env file created with $(wc -l < "$env_file") variables"
    else
        # Create minimal .env file
        echo "# Auto-generated environment variables for $template" > "$env_file"
        echo "# Generated on $(date)" >> "$env_file"
        echo "" >> "$env_file"
        echo "# No environment variables required" >> "$env_file"
        print_success ".env file created (no variables required)"
    fi
    
    log_message ".env file created for $template"
}

auto_deploy() {
    local template="$1"
    local project_dir="$2"
    
    print_step "Auto-deploying $template..."
    
    cd "$project_dir"
    
    # Pull images
    if [[ "$AUTO_PULL_IMAGES" == "true" ]]; then
        print_info "Pulling Docker images..."
        docker-compose pull > /dev/null 2>&1
        print_success "Images pulled"
    fi
    
    # Start services
    if [[ "$AUTO_START_SERVICES" == "true" ]]; then
        print_info "Starting services..."
        docker-compose up -d > /dev/null 2>&1
        
        # Wait for services to be ready
        print_info "Waiting for services to start..."
        sleep 10
        
        # Check service status
        if docker-compose ps | grep -q "Up"; then
            print_success "Services started successfully"
        else
            print_error "Some services failed to start"
            docker-compose ps
            return 1
        fi
    fi
    
    log_message "$template deployed successfully"
}

show_access_info() {
    local template="$1"
    local project_dir="$2"
    
    print_header "🎉 Deployment Complete!"
    
    cd "$project_dir"
    
    # Extract ports from docker-compose.yml
    local ports=$(grep -E "^\s*-\s*\"[0-9]+:[0-9]+\"" "$project_dir/docker-compose.yml")
    
    if [[ -n "$ports" ]]; then
        print_success "Access URLs:"
        echo "$ports" | while read -r line; do
            if [[ $line =~ -\s*\"([0-9]+):([0-9]+)\" ]]; then
                local host_port="${BASH_REMATCH[1]}"
                local container_port="${BASH_REMATCH[2]}"
                echo "  🌐 http://localhost:$host_port (port: $container_port)"
            fi
        done
        echo ""
    fi
    
    print_success "Management Commands:"
    echo "  📋 View logs:     docker-compose logs -f"
    echo "  🛑 Stop services: docker-compose down"
    echo "  🔄 Restart:      docker-compose restart"
    echo "  📊 Status:       docker-compose ps"
    echo "  🗑️  Cleanup:      docker-compose down -v"
    echo ""
    
    print_info "Deployment directory: $project_dir"
    print_info "Log file: $LOG_FILE"
    
    # Auto-open browser if enabled
    if [[ "$AUTO_OPEN_BROWSER" == "true" ]]; then
        local first_port=$(echo "$ports" | head -1 | grep -o -E '[0-9]+' | head -1)
        if [[ -n "$first_port" ]]; then
            print_info "Opening browser..."
            xdg-open "http://localhost:$first_port" 2>/dev/null || open "http://localhost:$first_port" 2>/dev/null || echo "Could not open browser automatically"
        fi
    fi
}

auto_deploy_template() {
    local template="$1"
    local template_file="$TEMPLATE_DIR/$template.md"
    local project_dir="$DEPLOYMENT_BASE_DIR/$template"
    
    print_header "🚀 Auto-Deploying $template"
    
    # Validate template
    if [[ ! -f "$template_file" ]]; then
        print_error "Template not found: $template"
        print_info "Available templates:"
        ls -1 "$TEMPLATE_DIR" | sed 's/.md$//' | head -10
        exit 1
    fi
    
    # Create deployment directory
    mkdir -p "$DEPLOYMENT_BASE_DIR"
    if [[ -d "$project_dir" ]]; then
        print_warning "Deployment directory exists: $project_dir"
        print_info "Cleaning up previous deployment..."
        cd "$project_dir"
        docker-compose down -v 2>/dev/null || true
        cd ..
        rm -rf "$project_dir"
    fi
    
    mkdir -p "$project_dir"
    print_success "Created deployment directory: $project_dir"
    
    # Setup deployment
    extract_docker_compose "$template_file" "$project_dir"
    create_env_file "$template" "$project_dir"
    
    if [[ "$AUTO_CREATE_DIRECTORIES" == "true" ]]; then
        auto_create_directories "$template" "$project_dir"
    fi
    
    # Deploy
    if auto_deploy "$template" "$project_dir"; then
        show_access_info "$template" "$project_dir"
        print_success "🎉 $template deployed successfully!"
    else
        print_error "❌ $template deployment failed"
        exit 1
    fi
}

deploy_all_templates() {
    print_header "🚀 Auto-Deploying All Templates"
    
    local failed=()
    local success=0
    
    for template in "${!TEMPLATE_CONFIGS[@]}"; do
        echo ""
        print_step "Deploying $template..."
        if auto_deploy_template "$template"; then
            ((success++))
        else
            failed+=("$template")
        fi
    done
    
    echo ""
    print_header "📊 Deployment Summary"
    print_success "Successfully deployed: $success templates"
    
    if [[ ${#failed[@]} -gt 0 ]]; then
        print_error "Failed deployments: ${#failed[@]} templates"
        print_info "Failed templates: ${failed[*]}"
    fi
}

show_help() {
    echo "🚀 Docker Template Auto-Deployment"
    echo ""
    echo "Usage: $0 [OPTIONS] [TEMPLATE]"
    echo ""
    echo "Options:"
    echo "  -h, --help          Show this help message"
    echo "  -l, --list          List available templates"
    echo "  -a, --all           Deploy all templates"
    echo "  --no-secrets        Don't auto-generate secrets"
    echo "  --no-dirs          Don't auto-create directories"
    echo "  --no-pull          Don't auto-pull images"
    echo "  --no-start         Don't auto-start services"
    echo "  --open-browser     Auto-open browser after deployment"
    echo ""
    echo "Templates:"
    for template in "${!TEMPLATE_CONFIGS[@]}"; do
        echo "  • $template"
    done
    echo ""
    echo "Examples:"
    echo "  $0                           # Interactive mode"
    echo "  $0 umami                     # Auto-deploy umami"
    echo "  $0 --all                     # Auto-deploy all templates"
    echo "  $0 --open-browser umami      # Deploy and open browser"
}

# Main execution
main() {
    # Create deployment directory
    mkdir -p "$DEPLOYMENT_BASE_DIR"
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                show_help
                exit 0
                ;;
            -l|--list)
                print_header "Available Templates"
                for template in "${!TEMPLATE_CONFIGS[@]}"; do
                    echo "  • $template - ${TEMPLATE_CONFIGS[$template]}"
                done
                exit 0
                ;;
            -a|--all)
                check_dependencies
                deploy_all_templates
                exit 0
                ;;
            --no-secrets)
                AUTO_GENERATE_SECRETS=false
                shift
                ;;
            --no-dirs)
                AUTO_CREATE_DIRECTORIES=false
                shift
                ;;
            --no-pull)
                AUTO_PULL_IMAGES=false
                shift
                ;;
            --no-start)
                AUTO_START_SERVICES=false
                shift
                ;;
            --open-browser)
                AUTO_OPEN_BROWSER=true
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
    
    # Execute deployment
    if [[ -n "$SELECTED_TEMPLATE" ]]; then
        auto_deploy_template "$SELECTED_TEMPLATE"
    else
        # Interactive mode - deploy a simple template by default
        print_info "No template specified, deploying Glance (simple dashboard)..."
        auto_deploy_template "glance"
    fi
}

# Run main function
main "$@"
