#!/bin/bash

# Test the auto-deployment system with a simple template
echo "🧪 Testing Auto-Deployment System"
echo "================================"
echo ""

# Check if we're in the right directory
if [[ ! -f "scripts/auto-deploy.sh" ]]; then
    echo "❌ Error: Please run this script from the project root directory"
    exit 1
fi

echo "🔍 Checking dependencies..."
if command -v docker &> /dev/null; then
    echo "✅ Docker is available"
else
    echo "❌ Docker is not available - this test requires Docker"
    exit 1
fi

echo ""
echo "🎯 Testing auto-deployment with Glance (simplest template)..."
echo ""

# Make scripts executable
chmod +x scripts/auto-deploy.sh
chmod +x scripts/quick-deploy.sh

echo "📋 Available deployment options:"
echo "1. Quick Deploy: ./scripts/quick-deploy.sh"
echo "2. Direct Deploy: ./scripts/auto-deploy.sh glance"
echo "3. List Templates: ./scripts/auto-deploy.sh --list"
echo "4. Deploy All: ./scripts/auto-deploy.sh --all"
echo ""

echo "🚀 Let's test the system by listing available templates:"
./scripts/auto-deploy.sh --list

echo ""
echo "✅ Auto-deployment system is ready!"
echo ""
echo "🎯 To use it:"
echo "   ./scripts/quick-deploy.sh        # Interactive menu"
echo "   ./scripts/auto-deploy.sh glance  # Direct deployment"
echo ""
echo "📖 Full guide: AUTO_DEPLOY_GUIDE.md"
