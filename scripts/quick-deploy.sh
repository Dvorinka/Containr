#!/bin/bash

# One-Click Docker Deployment - Quick Start Script
# This script provides the simplest possible deployment experience

set -e

echo "🚀 One-Click Docker Deployment"
echo "============================"
echo ""

# Check if we're in the right directory
if [[ ! -f "scripts/auto-deploy.sh" ]]; then
    echo "❌ Error: Please run this script from the project root directory"
    exit 1
fi

# Make script executable
chmod +x scripts/auto-deploy.sh

echo "🎯 Choose your deployment:"
echo ""
echo "1. 🌐 Deploy Glance Dashboard (Recommended - Simple & Fast)"
echo "2. 📊 Deploy Umami Analytics (Web Analytics)"
echo "3. 📝 Deploy Memos (Note-taking)"
echo "4. 🔍 Deploy MeiliSearch (Search Engine)"
echo "5. 📈 Deploy Uptime Kuma (Monitoring)"
echo "6. 🚀 Deploy ALL Templates (Advanced)"
echo ""
read -p "Enter your choice (1-6): " choice

case $choice in
    1)
        echo ""
        echo "🌐 Deploying Glance Dashboard..."
        ./scripts/auto-deploy.sh glance
        ;;
    2)
        echo ""
        echo "📊 Deploying Umami Analytics..."
        ./scripts/auto-deploy.sh umami
        ;;
    3)
        echo ""
        echo "📝 Deploying Memos..."
        ./scripts/auto-deploy.sh memos
        ;;
    4)
        echo ""
        echo "🔍 Deploying MeiliSearch..."
        ./scripts/auto-deploy.sh meilisearch
        ;;
    5)
        echo ""
        echo "📈 Deploying Uptime Kuma..."
        ./scripts/auto-deploy.sh uptime-kuma
        ;;
    6)
        echo ""
        echo "🚀 Deploying ALL Templates (this will take a while)..."
        ./scripts/auto-deploy.sh --all
        ;;
    *)
        echo "❌ Invalid choice. Defaulting to Glance Dashboard..."
        ./scripts/auto-deploy.sh glance
        ;;
esac

echo ""
echo "✅ Deployment process started!"
echo ""
echo "📋 What's happening automatically:"
echo "  🔍 Checking dependencies (Docker, Docker Compose)"
echo "  📁 Creating deployment directories"
echo "  🔧 Extracting docker-compose.yml"
echo "  🔐 Generating secrets and passwords"
echo "  🐳 Pulling Docker images"
echo "  🚀 Starting all services"
echo "  🌐 Showing access URLs"
echo ""
echo "📊 Watch the progress above. When complete, you'll see access URLs!"
echo ""
echo "🛑 To stop services: cd deployments/template-name && docker-compose down"
