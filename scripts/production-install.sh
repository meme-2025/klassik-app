#!/bin/bash

################################################################################
# Kaspa Stack - Production Deployment Script
# Für Server: 192.168.2.148
# Domain: klassik.99pace.space
################################################################################

set -e

# Farben
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║      Kaspa Stack - Production Installation                     ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Verzeichnis
cd /opt/klassik

# 1. Environment Setup
echo -e "${GREEN}[1/7]${NC} Environment konfigurieren..."
if [ ! -f .env ]; then
    cp .env.example .env
    
    # Passwörter generieren
    POSTGRES_PASS=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)
    API_KEY=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-32)
    GRAFANA_PASS=$(openssl rand -base64 16 | tr -d "=+/" | cut -c1-12)
    
    sed -i "s/POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=${POSTGRES_PASS}/" .env
    sed -i "s/API_KEY=.*/API_KEY=${API_KEY}/" .env
    sed -i "s/GRAFANA_PASSWORD=.*/GRAFANA_PASSWORD=${GRAFANA_PASS}/" .env
    sed -i "s/KASPAD_HOST=.*/KASPAD_HOST=127.0.0.1/" .env
    
    echo -e "  ${YELLOW}API Key: ${API_KEY}${NC}"
    echo -e "  ${YELLOW}Grafana Password: ${GRAFANA_PASS}${NC}"
    echo "  Gespeichert in .env"
else
    echo "  ✓ .env existiert bereits"
fi

# Log-Verzeichnisse
mkdir -p backend/rest-server/logs middleware/logs
chmod -R 755 backend/rest-server/logs middleware/logs

# 2. Docker prüfen
echo -e "${GREEN}[2/7]${NC} Docker-Berechtigung prüfen..."
if groups | grep -q docker; then
    echo "  ✓ User ist in docker-Gruppe"
else
    echo -e "  ${RED}FEHLER: User ist nicht in docker-Gruppe!${NC}"
    echo "  Führe aus: sudo usermod -aG docker \$USER"
    echo "  Dann neu einloggen und Skript erneut starten"
    echo ""
    echo "  Alternaiv: Verwende 'sudo docker-compose' in allen Befehlen"
    echo ""
    read -p "Mit sudo docker-compose fortfahren? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
    DOCKER_CMD="sudo docker-compose"
fi

# Docker-Befehl setzen
DOCKER_CMD="${DOCKER_CMD:-docker-compose}"

# 3. Alte Container stoppen
echo -e "${GREEN}[3/7]${NC} Alte Container stoppen..."
$DOCKER_CMD down 2>/dev/null || true

# 4. Docker Images bauen
echo -e "${GREEN}[4/7]${NC} Docker Images bauen (5-10 Minuten)..."
$DOCKER_CMD build --parallel

# 5. Services starten
echo -e "${GREEN}[5/7]${NC} Services starten..."

# Datenbank zuerst
echo "  Starte PostgreSQL & Redis..."
$DOCKER_CMD up -d postgres redis

# Warte auf PostgreSQL
echo "  Warte auf PostgreSQL..."
for i in {1..30}; do
    if $DOCKER_CMD exec -T postgres pg_isready -U kaspa_admin &>/dev/null; then
        echo "  ✓ PostgreSQL bereit"
        break
    fi
    sleep 2
done

# REST Server (falls vorhanden)
echo "  Starte REST Server (optional)..."
$DOCKER_CMD up -d kaspa-rest-server 2>/dev/null || echo "  → REST Server übersprungen"
sleep 5

# Middleware
echo "  Starte Middleware..."
$DOCKER_CMD up -d middleware
sleep 10

# Frontend
echo "  Starte Frontend..."
$DOCKER_CMD up -d frontend

# Monitoring
echo "  Starte Monitoring..."
$DOCKER_CMD up -d prometheus grafana node-exporter

echo ""
echo -e "${GREEN}[6/7]${NC} Container-Status:"
$DOCKER_CMD ps

# 6. Nginx-Konfiguration aktualisieren
echo ""
echo -e "${GREEN}[7/7]${NC} Nginx-Konfiguration..."

# Prüfe ob Nginx läuft
if systemctl is-active --quiet nginx; then
    echo "  ✓ Nginx läuft bereits"
    
    # Erstelle neue Nginx-Config für API-Proxy
    cat > /tmp/klassik-api-update.conf << 'NGINX_EOF'
    # ---- API BEGIN ----
    # Middleware läuft auf Port 8080
    location /api/ {
        proxy_pass http://127.0.0.1:8080/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    # WebSocket für Echtzeit-Updates
    location /ws {
        proxy_pass http://127.0.0.1:8080/ws;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        
        # WebSocket-Timeouts
        proxy_connect_timeout 7d;
        proxy_send_timeout 7d;
        proxy_read_timeout 7d;
    }
    # ---- API END ----
NGINX_EOF
    
    echo ""
    echo -e "${YELLOW}  Manuelle Nginx-Anpassung erforderlich:${NC}"
    echo "  1. Bearbeite: sudo nano /etc/nginx/sites-available/klassik.99pace.space"
    echo "  2. Ändere die API-Location von Port 8130 auf 8080"
    echo "  3. Füge WebSocket-Location hinzu (siehe /tmp/klassik-api-update.conf)"
    echo "  4. Teste: sudo nginx -t"
    echo "  5. Reload: sudo systemctl reload nginx"
    echo ""
    echo "  Beispiel-Config gespeichert in: /tmp/klassik-api-update.conf"
else
    echo "  ${RED}Nginx läuft nicht${NC}"
fi

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                Installation Abgeschlossen                      ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo "Services:"
echo "  • Middleware API:  http://localhost:8080/api"
echo "  • Frontend:        http://localhost:3000"
echo "  • Grafana:         http://localhost:3001 (admin / siehe .env)"
echo "  • Prometheus:      http://localhost:9090"
echo ""
echo "Produktions-URLs (nach Nginx-Update):"
echo "  • https://klassik.99pace.space"
echo "  • https://klassik.99pace.space/api"
echo ""
echo "Nächste Schritte:"
echo "  1. Nginx-Config aktualisieren (Port 8130 → 8080)"
echo "  2. Tests ausführen: ./scripts/production-test.sh"
echo "  3. Logs prüfen: docker-compose logs -f middleware"
echo ""
echo -e "${YELLOW}WICHTIG: Falls docker-Berechtigung fehlt, bitte neu einloggen!${NC}"
echo ""
