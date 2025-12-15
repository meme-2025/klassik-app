#!/bin/bash
# ============================================
# KLASSIK - Quick Fix Script
# ============================================
# Behebt die gefundenen API-Probleme
# Run: chmod +x quick-fix.sh && ./quick-fix.sh

set -e

echo "============================================"
echo "  KLASSIK QUICK FIX SCRIPT"
echo "============================================"
echo ""

# 1. Products-Tabelle Migration
echo "[1/4] Running Products migration..."
cd /var/www/klassik/backend
if [ -f "migrations/001_add_products.js" ]; then
    node migrations/001_add_products.js
    echo "✓ Products migration completed"
else
    echo "⚠ Products migration file not found"
fi

# 2. ADMIN_TOKEN setzen
echo ""
echo "[2/4] Setting up ADMIN_TOKEN..."
if ! grep -q "ADMIN_TOKEN" /etc/klassik/klassik1.env; then
    ADMIN_TOKEN=$(openssl rand -hex 32)
    echo "ADMIN_TOKEN=$ADMIN_TOKEN" >> /etc/klassik/klassik1.env
    echo "✓ ADMIN_TOKEN generated and saved"
    echo "  Token: $ADMIN_TOKEN"
    echo "  (Save this token securely!)"
else
    echo "✓ ADMIN_TOKEN already exists"
fi

# 3. Nginx Health Endpoint hinzufügen
echo ""
echo "[3/4] Adding /health endpoint to nginx..."
NGINX_CONF="/etc/nginx/sites-available/klassik"

if ! grep -q "location = /health" "$NGINX_CONF"; then
    # Backup
    cp "$NGINX_CONF" "$NGINX_CONF.backup.$(date +%s)"
    
    # Füge health endpoint vor der api location hinzu
    sed -i '/# ---- API BEGIN ----/i \    # Health check endpoint\n    location = /health {\n        proxy_pass http://127.0.0.1:8130/health;\n        proxy_set_header Host $host;\n        proxy_set_header X-Real-IP $remote_addr;\n        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n        proxy_set_header X-Forwarded-Proto $scheme;\n    }\n' "$NGINX_CONF"
    
    echo "✓ Health endpoint added to nginx config"
else
    echo "✓ Health endpoint already exists"
fi

# 4. Nginx testen und neu laden
echo ""
echo "[4/4] Testing and reloading nginx..."
if nginx -t; then
    systemctl reload nginx
    echo "✓ Nginx reloaded successfully"
else
    echo "✗ Nginx config test failed!"
    echo "  Restoring backup..."
    mv "$NGINX_CONF.backup."* "$NGINX_CONF"
    exit 1
fi

# 5. Backend neu starten
echo ""
echo "[5/5] Restarting backend..."
cd /var/www/klassik
docker-compose restart backend

echo ""
echo "============================================"
echo "  ✓ ALL FIXES APPLIED"
echo "============================================"
echo ""
echo "Next steps:"
echo "1. Test health endpoint: curl https://klassik.99pace.space/health"
echo "2. Test products API: curl https://klassik.99pace.space/api/products"
echo "3. Test debug API: curl -H \"X-ADMIN-TOKEN: \$ADMIN_TOKEN\" https://klassik.99pace.space/api/debug/users"
echo ""
