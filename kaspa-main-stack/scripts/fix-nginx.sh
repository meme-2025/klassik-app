#!/bin/bash
# Nginx Fix Script - Klassik.99pace.space

echo "Fixing Nginx configuration for klassik.99pace.space..."

# Backup current config
sudo cp /etc/nginx/sites-available/klassik.99pace.space /etc/nginx/sites-available/klassik.99pace.space.backup-$(date +%Y%m%d-%H%M%S)

# Create new working config
sudo tee /etc/nginx/sites-available/klassik.99pace.space > /dev/null << 'EOF'
# Klassik Kaspa Explorer - Production Config
# Updated: 2026-01-25

upstream frontend {
    server 127.0.0.1:3000;
    keepalive 32;
}

upstream api {
    server 127.0.0.1:8080;
    keepalive 32;
}

# Rate limiting
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=100r/m;
limit_req_zone $binary_remote_addr zone=ws_limit:10m rate=20r/s;

server {
    listen 80;
    listen [::]:80;
    server_name klassik.99pace.space 99pace.space www.99pace.space;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Logging
    access_log /var/log/nginx/klassik-access.log;
    error_log /var/log/nginx/klassik-error.log warn;

    # Root location - Frontend
    location / {
        proxy_pass http://frontend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # API endpoints
    location /api {
        limit_req zone=api_limit burst=20 nodelay;
        
        proxy_pass http://api;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # CORS
        add_header Access-Control-Allow-Origin "*" always;
        add_header Access-Control-Allow-Methods "GET, POST, OPTIONS" always;
        add_header Access-Control-Allow-Headers "Content-Type, X-API-Key" always;
        
        if ($request_method = OPTIONS) {
            return 204;
        }
    }

    # WebSocket
    location /ws {
        limit_req zone=ws_limit burst=10 nodelay;
        
        proxy_pass http://api;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        
        # WebSocket timeouts
        proxy_connect_timeout 7d;
        proxy_send_timeout 7d;
        proxy_read_timeout 7d;
    }

    # Health check
    location /health {
        proxy_pass http://api/api/health;
        access_log off;
    }

    # Static assets caching
    location ~* \.(jpg|jpeg|png|gif|ico|css|js|svg|woff|woff2|ttf|eot)$ {
        proxy_pass http://frontend;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
EOF

echo "✓ New Nginx config created"

# Test config
echo "Testing Nginx configuration..."
sudo nginx -t

if [ $? -eq 0 ]; then
    echo "✓ Config is valid"
    echo "Reloading Nginx..."
    sudo systemctl reload nginx
    echo "✓ Nginx reloaded"
    
    echo ""
    echo "Nginx Status:"
    sudo systemctl status nginx --no-pager -l
    
    echo ""
    echo "Testing endpoints..."
    sleep 2
    
    echo -n "Frontend (port 3000): "
    curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 || echo "Not responding"
    
    echo -n "API (port 8080): "
    curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/api/health || echo "Not responding"
    
    echo ""
    echo "✓ Done! Check https://klassik.99pace.space"
else
    echo "✗ Config has errors. Check output above."
    exit 1
fi
