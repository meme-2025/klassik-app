#!/bin/bash
# Production Setup für Klassik Backend auf Ubuntu
# Verwendung: sudo bash production-setup.sh

set -e  # Bei Fehler abbrechen

# Farben
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  Klassik Backend - Production Setup${NC}"
echo -e "${GREEN}  Nutzt existierende DB: klassikdb${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo ""

# Projekt-Konfiguration
PROJECT_DIR=$(pwd)
BACKEND_DIR="$PROJECT_DIR/backend"
DB_NAME="klassikdb"
DB_USER="klassik"
SERVICE_NAME="klassik"

echo -e "${BLUE}[1/8] Überprüfe Voraussetzungen...${NC}"

# Node.js prüfen
if ! command -v node &> /dev/null; then
    echo -e "${YELLOW}Node.js nicht gefunden. Installiere Node.js 18...${NC}"
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

NODE_VERSION=$(node --version)
echo -e "${GREEN}✓ Node.js: $NODE_VERSION${NC}"

# PostgreSQL prüfen
if ! command -v psql &> /dev/null; then
    echo -e "${RED}✗ PostgreSQL nicht installiert!${NC}"
    exit 1
fi
echo -e "${GREEN}✓ PostgreSQL installiert${NC}"

# Datenbank prüfen
if sudo -u postgres psql -lqt | cut -d \| -f 1 | grep -qw $DB_NAME; then
    echo -e "${GREEN}✓ Datenbank '$DB_NAME' existiert${NC}"
else
    echo -e "${RED}✗ Datenbank '$DB_NAME' nicht gefunden!${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}[2/8] Datenbank-Verbindung konfigurieren...${NC}"

# Frage nach DB-Passwort
echo -e "${YELLOW}Bitte DB-Passwort für User '$DB_USER' eingeben:${NC}"
read -s DB_PASSWORD
echo ""

# Verbindung testen
export PGPASSWORD=$DB_PASSWORD
if psql -U $DB_USER -d $DB_NAME -h localhost -c "SELECT 1;" &> /dev/null; then
    echo -e "${GREEN}✓ Datenbank-Verbindung erfolgreich!${NC}"
else
    echo -e "${RED}✗ Verbindung fehlgeschlagen! Passwort korrekt?${NC}"
    exit 1
fi

# Tabellen prüfen
echo -e "${YELLOW}Prüfe Tabellen in $DB_NAME...${NC}"
TABLES=$(psql -U $DB_USER -d $DB_NAME -h localhost -t -c "SELECT tablename FROM pg_tables WHERE schemaname = 'public';" 2>/dev/null | grep -v '^$' | tr -d ' ')

if echo "$TABLES" | grep -q "users"; then
    echo -e "${GREEN}✓ Tabelle 'users' gefunden${NC}"
else
    echo -e "${YELLOW}⚠ Tabelle 'users' fehlt - wird erstellt${NC}"
fi

if echo "$TABLES" | grep -q "events"; then
    echo -e "${GREEN}✓ Tabelle 'events' gefunden${NC}"
else
    echo -e "${YELLOW}⚠ Tabelle 'events' fehlt - wird erstellt${NC}"
fi

if echo "$TABLES" | grep -q "bookings"; then
    echo -e "${GREEN}✓ Tabelle 'bookings' gefunden${NC}"
else
    echo -e "${YELLOW}⚠ Tabelle 'bookings' fehlt - wird erstellt${NC}"
fi

echo ""
echo -e "${BLUE}[3/8] Backend Dependencies installieren...${NC}"
cd "$BACKEND_DIR"

if [ ! -d "node_modules" ]; then
    npm install --production
    echo -e "${GREEN}✓ Dependencies installiert${NC}"
else
    echo -e "${GREEN}✓ Dependencies bereits vorhanden${NC}"
fi

echo ""
echo -e "${BLUE}[4/8] Production .env erstellen...${NC}"

# JWT Secret generieren
JWT_SECRET=$(openssl rand -base64 32)

# .env erstellen
cat > "$BACKEND_DIR/.env" << EOF
# Production Configuration
# Generiert am $(date)

# ============================================
# Database Configuration
# ============================================
DATABASE_URL=postgresql://$DB_USER:$DB_PASSWORD@localhost:5432/$DB_NAME

# ============================================
# Server Configuration
# ============================================
NODE_ENV=production
PORT=3000
BASE_URL=http://localhost:3000
FRONTEND_URL=http://localhost:3000

# CORS (für Production: Domain anpassen!)
CORS_ORIGIN=*

# ============================================
# JWT Authentication
# ============================================
JWT_SECRET=$JWT_SECRET
JWT_EXPIRY=7d

# ============================================
# Blockchain
# ============================================
ENABLE_WATCHER=false

# ============================================
# Logging
# ============================================
LOG_LEVEL=info
EOF

echo -e "${GREEN}✓ .env Datei erstellt: $BACKEND_DIR/.env${NC}"
echo -e "${YELLOW}  DATABASE_URL: postgresql://$DB_USER:***@localhost:5432/$DB_NAME${NC}"
echo -e "${YELLOW}  JWT_SECRET: ${JWT_SECRET:0:10}...${NC}"

# Sichere Berechtigungen
chmod 600 "$BACKEND_DIR/.env"
echo -e "${GREEN}✓ Berechtigungen gesetzt (600)${NC}"

echo ""
echo -e "${BLUE}[5/8] Datenbank-Migrationen ausführen...${NC}"

# Migrationen ausführen
cd "$BACKEND_DIR"
if npm run migrate:up; then
    echo -e "${GREEN}✓ Migrationen erfolgreich${NC}"
else
    echo -e "${YELLOW}⚠ Migrationen teilweise fehlgeschlagen (evtl. bereits ausgeführt)${NC}"
fi

# Tabellen prüfen (nach Migration)
echo ""
echo -e "${YELLOW}Finale Tabellenstruktur:${NC}"
psql -U $DB_USER -d $DB_NAME -h localhost -c "\dt" 2>/dev/null || true

echo ""
echo -e "${BLUE}[6/8] systemd Service einrichten...${NC}"

# Service-Datei erstellen
sudo tee /etc/systemd/system/$SERVICE_NAME.service > /dev/null << EOF
[Unit]
Description=Klassik Backend Server
After=network.target postgresql.service

[Service]
Type=simple
User=$USER
WorkingDirectory=$BACKEND_DIR
EnvironmentFile=$BACKEND_DIR/.env
ExecStart=$(which node) src/index.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=klassik

[Install]
WantedBy=multi-user.target
EOF

echo -e "${GREEN}✓ Service-Datei erstellt: /etc/systemd/system/$SERVICE_NAME.service${NC}"

# systemd neu laden
sudo systemctl daemon-reload
echo -e "${GREEN}✓ systemd neu geladen${NC}"

# Service aktivieren
sudo systemctl enable $SERVICE_NAME
echo -e "${GREEN}✓ Service aktiviert (Auto-Start)${NC}"

echo ""
echo -e "${BLUE}[7/8] Backend starten...${NC}"

# Service starten
if sudo systemctl start $SERVICE_NAME; then
    echo -e "${GREEN}✓ Service gestartet${NC}"
    sleep 2
    
    # Status prüfen
    if sudo systemctl is-active --quiet $SERVICE_NAME; then
        echo -e "${GREEN}✓ Service läuft!${NC}"
    else
        echo -e "${RED}✗ Service konnte nicht gestartet werden!${NC}"
        echo -e "${YELLOW}Logs anzeigen:${NC}"
        sudo journalctl -u $SERVICE_NAME -n 20 --no-pager
        exit 1
    fi
else
    echo -e "${RED}✗ Service-Start fehlgeschlagen!${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}[8/8] Tests ausführen...${NC}"

# Health Check
sleep 2
if curl -s http://localhost:3000/health | grep -q "ok"; then
    echo -e "${GREEN}✓ Health Check erfolgreich${NC}"
else
    echo -e "${RED}✗ Health Check fehlgeschlagen${NC}"
fi

# Users abrufen
if curl -s http://localhost:3000/api/products &> /dev/null; then
    echo -e "${GREEN}✓ API antwortet${NC}"
else
    echo -e "${YELLOW}⚠ API noch nicht bereit (normal bei erstem Start)${NC}"
fi

echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  ✅ Setup abgeschlossen!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${BLUE}📊 Status:${NC}"
echo "  Backend läuft auf: http://localhost:3000"
echo "  Datenbank: $DB_NAME"
echo "  Service: $SERVICE_NAME"
echo ""
echo -e "${BLUE}🔧 Wichtige Befehle:${NC}"
echo "  sudo systemctl status $SERVICE_NAME    # Status anzeigen"
echo "  sudo systemctl restart $SERVICE_NAME   # Neu starten"
echo "  sudo systemctl stop $SERVICE_NAME      # Stoppen"
echo "  sudo journalctl -u $SERVICE_NAME -f    # Logs live anzeigen"
echo ""
echo -e "${BLUE}🧪 Testen:${NC}"
echo "  curl http://localhost:3000/health"
echo "  curl http://localhost:3000/api/products"
echo ""
echo -e "${BLUE}📊 Datenbank:${NC}"
echo "  psql -U $DB_USER -d $DB_NAME -h localhost"
echo "  SELECT * FROM users;"
echo ""
echo -e "${BLUE}🌐 Browser:${NC}"
echo "  http://localhost:3000"
echo "  http://$(hostname -I | awk '{print $1}'):3000"
echo ""
echo -e "${YELLOW}💡 Nächste Schritte:${NC}"
echo "  1. nginx für Reverse Proxy einrichten (optional)"
echo "  2. SSL/TLS mit Let's Encrypt (für Production)"
echo "  3. Firewall konfigurieren"
echo ""
