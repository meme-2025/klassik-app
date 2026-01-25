#!/bin/bash
# Complete Klassik Stack Setup & Nginx Fix

echo "================================="
echo "Klassik Stack - Complete Setup"
echo "================================="
echo ""

cd /opt/klassik

# Check if Docker containers are running
echo "[1/5] Checking Docker containers..."
sudo docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
echo ""

# Check if services are responding
echo "[2/5] Checking service endpoints..."
echo -n "Frontend (3000): "
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000 || echo "DOWN"

echo -n "API (8080): "
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8080/api/health || echo "DOWN"

echo -n "Grafana (3001): "
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3001 || echo "DOWN"

echo ""
echo "[3/5] Checking if services need to be started..."
if ! sudo docker ps | grep -q "kaspa-frontend"; then
    echo "Services are not running. Starting now..."
    echo "This will take 10-15 minutes..."
    
    # Use production docker-compose
    if [ -f docker-compose.production.yml ]; then
        sudo cp docker-compose.production.yml docker-compose.yml
    fi
    
    # Start all services
    sudo docker-compose up -d
    
    echo "Waiting for services to start (60 seconds)..."
    sleep 60
    
    echo "Services started. Checking status..."
    sudo docker ps --format 'table {{.Names}}\t{{.Status}}'
else
    echo "✓ Services are already running"
fi

echo ""
echo "[4/5] Fixing Nginx configuration..."

# Create proper Nginx config
sudo tee /etc/nginx/sites-available/klassik.99pace.space > /dev/null << 'NGINXCONF'
upstream frontend {
    server 127.0.0.1:3000;
}

upstream api {
    server 127.0.0.1:8080;
}

server {
    listen 80;
    listen [::]:80;
    server_name klassik.99pace.space 99pace.space www.99pace.space;

    access_log /var/log/nginx/klassik-access.log;
    error_log /var/log/nginx/klassik-error.log;

    # Frontend
    location / {
        proxy_pass http://frontend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }

    # API
    location /api {
        proxy_pass http://api;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # WebSocket
    location /ws {
        proxy_pass http://api;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
    }

    # Health
    location /health {
        proxy_pass http://api/api/health;
        access_log off;
    }
}
NGINXCONF

# Enable site if not already
if [ ! -L /etc/nginx/sites-enabled/klassik.99pace.space ]; then
    sudo ln -sf /etc/nginx/sites-available/klassik.99pace.space /etc/nginx/sites-enabled/
fi

# Test and reload Nginx
echo ""
echo "[5/5] Testing and reloading Nginx..."
sudo nginx -t

if [ $? -eq 0 ]; then
    sudo systemctl reload nginx
    echo "✓ Nginx reloaded successfully"
else
    echo "✗ Nginx config has errors"
    exit 1
fi

echo ""
echo "================================="
echo "Final Status Check"
echo "================================="
echo ""

sleep 3

echo "Service Status:"
echo "---------------"
curl -s http://localhost:3000 > /dev/null && echo "✓ Frontend: Running" || echo "✗ Frontend: Not responding"
curl -s http://localhost:8080/api/health > /dev/null && echo "✓ API: Running" || echo "✗ API: Not responding"
curl -s http://localhost:3001 > /dev/null && echo "✓ Grafana: Running" || echo "✗ Grafana: Not responding"

echo ""
echo "Nginx Status:"
echo "-------------"
sudo systemctl status nginx --no-pager | grep Active

echo ""
echo "Test URL:"
echo "---------"
echo "https://klassik.99pace.space"
echo ""

echo "Logs:"
echo "-----"
echo "sudo docker-compose logs -f middleware"
echo "sudo tail -f /var/log/nginx/klassik-error.log"
echo ""
