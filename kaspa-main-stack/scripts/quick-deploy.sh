#!/bin/bash

################################################################################
# Quick Production Deployment (mit sudo)
################################################################################

set -e

cd /opt/klassik

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║      Kaspa Stack - Quick Deployment                           ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# 1. Environment
echo "[1/6] Environment..."
if [ ! -f .env ]; then
    cp .env.example .env
    POSTGRES_PASS=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)
    API_KEY=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-32)
    GRAFANA_PASS=$(openssl rand -base64 16 | tr -d "=+/" | cut -c1-12)
    
    sed -i "s/POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=${POSTGRES_PASS}/" .env
    sed -i "s/API_KEY=.*/API_KEY=${API_KEY}/" .env
    sed -i "s/GRAFANA_PASSWORD=.*/GRAFANA_PASSWORD=${GRAFANA_PASS}/" .env
    sed -i "s/KASPAD_HOST=.*/KASPAD_HOST=127.0.0.1/" .env
    
    echo "✓ API Key: ${API_KEY}"
    echo "✓ Grafana Pass: ${GRAFANA_PASS}"
fi

mkdir -p backend/rest-server/logs middleware/logs
chmod -R 755 backend middleware frontend

# 2. Stop old
echo ""
echo "[2/6] Stoppe alte Container..."
sudo docker-compose down 2>/dev/null || true

# 3. Build
echo ""
echo "[3/6] Baue Images (kann 5-10 Min dauern)..."
sudo docker-compose build middleware frontend

# 4. Start
echo ""
echo "[4/6] Starte Services..."
sudo docker-compose up -d postgres redis
sleep 10
sudo docker-compose up -d middleware
sleep 10
sudo docker-compose up -d frontend
sudo docker-compose up -d prometheus grafana node-exporter

# 5. Status
echo ""
echo "[5/6] Container Status:"
sudo docker-compose ps

# 6. Frontend in /var/www kopieren
echo ""
echo "[6/6] Frontend-Dateien nach /var/www/klassik kopieren..."

# Warte bis Frontend-Container läuft
sleep 5

# Erstelle Zielverzeichnis
sudo mkdir -p /var/www/klassik/frontend

# Kopiere Static Files aus Frontend-Container
echo "Extrahiere Frontend-Build..."
CONTAINER_ID=$(sudo docker-compose ps -q frontend)
if [ -n "$CONTAINER_ID" ]; then
    # Next.js Build-Output kopieren
    sudo docker cp ${CONTAINER_ID}:/app/.next/static /var/www/klassik/frontend/ 2>/dev/null || true
    sudo docker cp ${CONTAINER_ID}:/app/public /var/www/klassik/frontend/ 2>/dev/null || true
    
    # Einfache index.html als Fallback
    sudo tee /var/www/klassik/frontend/index.html > /dev/null << 'EOF'
<!DOCTYPE html>
<html>
<head>
    <title>Kaspa Explorer - klassik.99pace.space</title>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        body { font-family: system-ui; margin: 0; padding: 20px; background: #1a1a1a; color: #fff; }
        .container { max-width: 1200px; margin: 0 auto; }
        h1 { color: #00d4aa; }
        .status { background: #2a2a2a; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .api-test { margin: 10px 0; }
        button { background: #00d4aa; color: #000; border: none; padding: 10px 20px; cursor: pointer; border-radius: 4px; }
        pre { background: #000; padding: 15px; border-radius: 4px; overflow-x: auto; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚀 Kaspa Explorer</h1>
        <div class="status">
            <h2>System Status</h2>
            <div class="api-test">
                <button onclick="testAPI()">Test API Connection</button>
                <pre id="result">Click to test API...</pre>
            </div>
        </div>
        
        <div class="status">
            <h3>Available Services:</h3>
            <ul>
                <li>API: <code>https://klassik.99pace.space/api</code></li>
                <li>WebSocket: <code>wss://klassik.99pace.space/ws</code></li>
                <li>Grafana: <a href="/grafana" target="_blank">Monitoring Dashboard</a></li>
            </ul>
        </div>
        
        <div class="status">
            <h3>Quick Links:</h3>
            <ul>
                <li><a href="/api/info">Network Info</a></li>
                <li><a href="/api/blocks">Latest Blocks</a></li>
                <li><a href="/api/stats">Network Stats</a></li>
            </ul>
        </div>
    </div>
    
    <script>
        async function testAPI() {
            const result = document.getElementById('result');
            result.textContent = 'Testing...';
            
            try {
                const response = await fetch('/api/health');
                const data = await response.json();
                result.textContent = JSON.stringify(data, null, 2);
            } catch (error) {
                result.textContent = 'Error: ' + error.message;
            }
        }
    </script>
</body>
</html>
EOF
    
    sudo chown -R www-data:www-data /var/www/klassik
    echo "✓ Frontend-Dateien kopiert"
else
    echo "⚠ Frontend-Container nicht gefunden"
fi

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                    Installation Fertig!                        ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "Services laufen:"
echo "  • Middleware API: http://localhost:8080"
echo "  • Frontend: http://localhost:3000"
echo "  • Grafana: http://localhost:3001"
echo ""
echo "WICHTIG: Nginx-Konfiguration aktualisieren:"
echo "  1. sudo nano /etc/nginx/sites-available/klassik.99pace.space"
echo "  2. Ändere Port 8130 → 8080 in der API-Location"
echo "  3. sudo nginx -t && sudo systemctl reload nginx"
echo ""
echo "Dann testen: https://klassik.99pace.space"
echo ""
