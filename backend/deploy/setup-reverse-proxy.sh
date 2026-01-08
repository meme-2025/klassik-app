#!/bin/bash

# ============================================
# KLASSIK REVERSE PROXY SETUP SCRIPT
# Safely configure nginx for API routing
# ============================================

echo "🚀 Klassik Backend API - Reverse Proxy Setup"
echo "=============================================="

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo "❌ Please run as root (sudo)"
    exit 1
fi

# Backup existing nginx config
echo "📦 Creating backup of nginx config..."
cp /etc/nginx/sites-available/klassik.99pace.space /etc/nginx/sites-available/klassik.99pace.space.backup-$(date +%Y%m%d-%H%M%S)

# Check if backend is running on port 8130
echo "🔍 Checking if backend is running on port 8130..."
if ! netstat -tuln | grep -q ":8130"; then
    echo "⚠️  WARNING: Backend not running on port 8130"
    echo "   Start backend first: cd /path/to/backend && npm start"
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Add API location block to nginx config
echo "✏️  Adding API reverse proxy configuration..."

# Check if location /api/ already exists
if grep -q "location /api/" /etc/nginx/sites-available/klassik.99pace.space; then
    echo "✅ API location block already exists"
else
    # Find the server block and add location before the closing brace
    sed -i '/location \/ {/a \
    \
    # API Reverse Proxy\
    location /api/ {\
        rewrite ^/api/(.*)$ /$1 break;\
        proxy_pass http://127.0.0.1:8130;\
        proxy_http_version 1.1;\
        proxy_set_header Upgrade $http_upgrade;\
        proxy_set_header Connection '\''upgrade'\'';\
        proxy_set_header Host $host;\
        proxy_set_header X-Real-IP $remote_addr;\
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\
        proxy_set_header X-Forwarded-Proto $scheme;\
        proxy_connect_timeout 60s;\
        proxy_send_timeout 60s;\
        proxy_read_timeout 60s;\
        proxy_cache_bypass $http_upgrade;\
    }' /etc/nginx/sites-available/klassik.99pace.space
    
    echo "✅ Added API location block"
fi

# Test nginx configuration
echo "🧪 Testing nginx configuration..."
if nginx -t; then
    echo "✅ Nginx configuration is valid"
    
    # Reload nginx
    echo "🔄 Reloading nginx..."
    systemctl reload nginx
    
    if [ $? -eq 0 ]; then
        echo "✅ Nginx reloaded successfully"
    else
        echo "❌ Failed to reload nginx"
        exit 1
    fi
else
    echo "❌ Nginx configuration test failed"
    echo "   Restoring backup..."
    cp /etc/nginx/sites-available/klassik.99pace.space.backup-* /etc/nginx/sites-available/klassik.99pace.space
    exit 1
fi

# Test API endpoint
echo "🧪 Testing API endpoint..."
sleep 2
if curl -sf https://klassik.99pace.space/api/health > /dev/null; then
    echo "✅ API endpoint is working!"
else
    echo "⚠️  API endpoint test failed - check backend logs"
fi

echo ""
echo "🎉 SETUP COMPLETE!"
echo "=============================================="
echo "API is now accessible at: https://klassik.99pace.space/api/"
echo "Backend running on: http://127.0.0.1:8130 (internal only)"
echo ""
echo "Test endpoints:"
echo "  curl https://klassik.99pace.space/api/health"
echo "  curl https://klassik.99pace.space/api/auth/nonce?address=0x..."
echo ""
echo "Backup saved to: /etc/nginx/sites-available/klassik.99pace.space.backup-*"
