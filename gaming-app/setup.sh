#!/bin/bash

# Kaspa Rush - Quick Start Script
# This script sets up the development environment

set -e

echo "🚀 Kaspa Rush - Quick Start Setup"
echo "=================================="
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 20+"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
    echo "❌ Node.js version must be 20 or higher (current: $(node -v))"
    exit 1
fi
echo "✅ Node.js $(node -v) detected"

# Check pnpm
if ! command -v pnpm &> /dev/null; then
    echo "📦 Installing pnpm..."
    npm install -g pnpm@8.15.4
fi
echo "✅ pnpm $(pnpm -v) detected"

# Check Docker
if ! command -v docker &> /dev/null; then
    echo "⚠️  Docker not found. Some features may not work."
    echo "   Install Docker: https://docs.docker.com/get-docker/"
else
    echo "✅ Docker detected"
fi

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
pnpm install

# Setup environment
if [ ! -f .env ]; then
    echo ""
    echo "⚙️  Creating .env file..."
    cp .env.example .env
    echo "✅ .env created - please review and update values"
else
    echo "✅ .env already exists"
fi

# Start Docker services
echo ""
read -p "🐳 Start Docker services (PostgreSQL, Redis)? [Y/n] " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]] || [[ -z $REPLY ]]; then
    echo "🐳 Starting Docker services..."
    docker-compose up -d postgres redis
    echo "✅ Database and Redis started"
    
    echo "⏳ Waiting for database to be ready..."
    sleep 5
fi

# Build packages
echo ""
echo "🔨 Building packages..."
pnpm build

echo ""
echo "✨ Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Review .env file and update configuration"
echo "  2. Start development servers:"
echo ""
echo "     Terminal 1 - Backend:"
echo "     $ cd apps/backend && pnpm dev"
echo ""
echo "     Terminal 2 - Frontend:"
echo "     $ cd apps/web && pnpm dev"
echo ""
echo "  3. Open http://localhost:3000 in your browser"
echo ""
echo "📚 Read DEVELOPMENT.md for detailed documentation"
echo ""
echo "Happy coding! 🎮"
