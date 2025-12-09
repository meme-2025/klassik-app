#!/bin/bash
# Database Initialization Script for Ubuntu Server
# Run this on your Ubuntu machine where PostgreSQL is running

set -e

echo "🚀 Klassik Database Initialization"
echo "===================================="

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
    echo "✅ Loaded .env file"
else
    echo "❌ .env file not found!"
    exit 1
fi

# Check if PostgreSQL is running
if ! systemctl is-active --quiet postgresql; then
    echo "⚠️  PostgreSQL is not running. Starting..."
    sudo systemctl start postgresql
fi

echo "📊 Initializing database tables..."
node init-db.js

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Database initialized successfully!"
    echo ""
    echo "🔍 Next steps:"
    echo "   1. Start the backend: npm start"
    echo "   2. Test auth endpoints: curl http://localhost:3000/api/auth/test"
    echo ""
else
    echo "❌ Database initialization failed!"
    exit 1
fi
