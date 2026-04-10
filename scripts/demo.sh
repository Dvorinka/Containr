#!/bin/bash

# Quick Test Script - Try out the setup system
# This script demonstrates the auto-setup with a simple template

set -e

echo "🚀 Docker Template Auto-Setup Demo"
echo "=================================="
echo ""

# Check if we're in the right directory
if [[ ! -f "scripts/setup-template.sh" ]]; then
    echo "❌ Error: Please run this script from the project root directory"
    echo "   Current directory: $(pwd)"
    echo "   Expected: scripts/setup-template.sh"
    exit 1
fi

echo "✅ Found setup script"
echo ""

# Make script executable
chmod +x scripts/setup-template.sh

echo "📋 Available Templates:"
./scripts/setup-template.sh --list
echo ""

echo "🎯 Let's try setting up a simple template (Glance Dashboard)..."
echo ""

# Create a test deployment
echo "Setting up Glance template..."
./scripts/setup-template.sh --setup glance

echo ""
echo "📁 Created files:"
ls -la glance-deployment/
echo ""

echo "📄 Generated docker-compose.yml:"
echo "---"
head -20 glance-deployment/docker-compose.yml
echo "---"
echo ""

echo "🔧 Generated .env file:"
if [[ -f "glance-deployment/.env" ]]; then
    echo "---"
    cat glance-deployment/.env
    echo "---"
else
    echo "No .env file generated (Glance doesn't require environment variables)"
fi
echo ""

echo "✅ Setup completed successfully!"
echo ""
echo "🎯 Next steps:"
echo "1. cd glance-deployment"
echo "2. Review the configuration"
echo "3. Run: docker-compose up -d"
echo "4. Access: http://localhost:8080"
echo ""
echo "🧹 Cleanup (when done):"
echo "   cd glance-deployment && docker-compose down"
echo "   cd .. && rm -rf glance-deployment"
echo ""

echo "🚀 Try other templates:"
echo "   ./scripts/setup-template.sh umami      # Analytics"
echo "   ./scripts/setup-template.sh memos      # Notes"
echo "   ./scripts/setup-template.sh uptime-kuma # Monitoring"
echo ""
echo "📖 Full guide: SETUP_GUIDE.md"
