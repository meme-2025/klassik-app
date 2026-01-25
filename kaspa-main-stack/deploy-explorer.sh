#!/bin/bash

# =============================================================================
# KlassikScan Explorer - Professionelles Deployment Script
# =============================================================================

set -e

echo "🚀 KlassikScan Explorer Deployment"
echo "=================================="

# Farben für Output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Server Details
SERVER_IP="192.168.2.148"
DOMAIN="klassik.99pace.space"
PROJECT_DIR="/opt/klassik"

echo -e "${BLUE}Server IP: ${SERVER_IP}${NC}"
echo -e "${BLUE}Domain: ${DOMAIN}${NC}"
echo -e "${BLUE}Projekt: ${PROJECT_DIR}${NC}"
echo ""

# 1. Frontend-Dateien kopieren
echo -e "${YELLOW}[1/6] Frontend-Dateien kopieren...${NC}"
scp -i "C:\Users\TUF-s\.ssh\id_ed25519_new" \
    "frontend/kaspa-explorer-pro.html" \
    "admxn@${SERVER_IP}:${PROJECT_DIR}/frontend/"

echo -e "${GREEN}✓ Frontend hochgeladen${NC}"

# 2. Nginx Konfiguration kopieren
echo -e "${YELLOW}[2/6] Nginx-Konfiguration kopieren...${NC}"
scp -i "C:\Users\TUF-s\.ssh\id_ed25519_new" \
    "nginx/klassik-explorer.conf" \
    "admxn@${SERVER_IP}:/tmp/"

echo -e "${GREEN}✓ Nginx-Config übertragen${NC}"

# 3. Docker Compose aktualisieren
echo -e "${YELLOW}[3/6] Docker Compose aktualisieren...${NC}"
scp -i "C:\Users\TUF-s\.ssh\id_ed25519_new" \
    "docker-compose-official-correct.yml" \
    "admxn@${SERVER_IP}:${PROJECT_DIR}/docker-compose.yml"

echo -e "${GREEN}✓ Docker Compose aktualisiert${NC}"

# 4. Server-Setup via SSH
echo -e "${YELLOW}[4/6] Server konfigurieren...${NC}"
ssh -i "C:\Users\TUF-s\.ssh\id_ed25519_new" admxn@${SERVER_IP} << 'EOF'
    
    # Zu Projekt-Verzeichnis wechseln
    cd /opt/klassik
    
    # Nginx-Config installieren
    sudo cp /tmp/klassik-explorer.conf /etc/nginx/sites-available/
    sudo ln -sf /etc/nginx/sites-available/klassik-explorer.conf /etc/nginx/sites-enabled/
    
    # Alte Default-Config entfernen falls vorhanden
    sudo rm -f /etc/nginx/sites-enabled/default
    
    # Nginx-Config testen
    sudo nginx -t
    
    # Docker Services stoppen
    echo "Stoppe alte Services..."
    docker-compose down || true
    
    # Frontend-Verzeichnis vorbereiten
    mkdir -p frontend
    sudo chown -R $USER:$USER frontend/
    
    # Images pullen
    echo "Lade neue Images..."
    docker-compose pull
    
    # Services starten
    echo "Starte Services..."
    docker-compose up -d
    
    # Nginx neuladen
    sudo nginx -s reload || sudo systemctl reload nginx
    
    echo "✓ Server-Setup abgeschlossen"

EOF

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Server erfolgreich konfiguriert${NC}"
else
    echo -e "${RED}✗ Fehler beim Server-Setup${NC}"
    exit 1
fi

# 5. Services testen
echo -e "${YELLOW}[5/6] Services testen...${NC}"

# REST API Test
echo "📡 Teste REST API (Port 8000)..."
if curl -s "http://${SERVER_IP}:8000/info/blockdag" > /dev/null; then
    echo -e "${GREEN}✓ REST API erreichbar${NC}"
else
    echo -e "${RED}✗ REST API nicht erreichbar${NC}"
fi

# WebSocket Test
echo "🔌 Teste WebSocket (Port 8001)..."
# WebSocket Test ist komplizierter, wir prüfen nur den Port
if nc -z ${SERVER_IP} 8001 2>/dev/null; then
    echo -e "${GREEN}✓ WebSocket Port offen${NC}"
else
    echo -e "${RED}✗ WebSocket Port nicht erreichbar${NC}"
fi

# Frontend Test
echo "🌐 Teste Frontend (Port 3001)..."
if curl -s "http://${SERVER_IP}:3001/health" > /dev/null; then
    echo -e "${GREEN}✓ Frontend erreichbar${NC}"
else
    echo -e "${RED}✗ Frontend nicht erreichbar${NC}"
fi

# Monitoring Test
echo "📊 Teste Monitoring (Port 9090)..."
if curl -s "http://${SERVER_IP}:9090/api/v1/status/config" > /dev/null; then
    echo -e "${GREEN}✓ Prometheus erreichbar${NC}"
else
    echo -e "${RED}✗ Prometheus nicht erreichbar${NC}"
fi

# 6. Deployment-Status
echo ""
echo -e "${YELLOW}[6/6] Deployment-Status${NC}"
echo "=============================="

echo ""
echo -e "${GREEN}🎉 KlassikScan Explorer erfolgreich deployed!${NC}"
echo ""
echo -e "${BLUE}📱 Zugriff auf den Explorer:${NC}"
echo "   • Direkt:       http://${SERVER_IP}:3001"
echo "   • Domain:       http://${DOMAIN} (nach DNS-Setup)"
echo ""
echo -e "${BLUE}🔧 Service-Endpunkte:${NC}"
echo "   • REST API:     http://${SERVER_IP}:8000/docs"
echo "   • WebSocket:    ws://${SERVER_IP}:8001"
echo "   • Prometheus:   http://${SERVER_IP}:9090"
echo "   • Database:     Port 5433 (intern)"
echo ""
echo -e "${BLUE}📊 Monitoring:${NC}"
echo "   • Grafana:      http://${SERVER_IP}:3000 (admin/admin123)"
echo "   • Prometheus:   http://${SERVER_IP}:9090"
echo ""
echo -e "${YELLOW}⚠️  Nächste Schritte:${NC}"
echo "   1. DNS-Eintrag für klassik.99pace.space erstellen"
echo "   2. Optional: SSL-Zertifikat installieren"
echo "   3. Firewall-Regeln prüfen"
echo ""
echo -e "${GREEN}✅ Deployment abgeschlossen!${NC}"