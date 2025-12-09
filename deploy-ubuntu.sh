#!/bin/bash

# 🚀 Klassik Backend Deployment auf Ubuntu
# Port: 8130
# PostgreSQL: localhost:5432

echo "════════════════════════════════════════════════════════"
echo "🚀 Klassik Backend Deployment"
echo "════════════════════════════════════════════════════════"

# Farben
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Fehlerbehandlung
set -e
trap 'echo -e "${RED}❌ Fehler in Zeile $LINENO${NC}"' ERR

# Projekt-Pfad (anpassen!)
PROJECT_DIR="/home/$(whoami)/klassik"
BACKEND_DIR="$PROJECT_DIR/backend"

echo ""
echo "1️⃣ System aktualisieren..."
sudo apt update

echo ""
echo "2️⃣ Node.js & npm prüfen..."
if ! command -v node &> /dev/null; then
    echo -e "${YELLOW}Node.js nicht gefunden, installiere...${NC}"
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt install -y nodejs
fi

NODE_VERSION=$(node -v)
NPM_VERSION=$(npm -v)
echo -e "${GREEN}✅ Node.js: $NODE_VERSION${NC}"
echo -e "${GREEN}✅ npm: $NPM_VERSION${NC}"

echo ""
echo "3️⃣ PM2 installieren/prüfen..."
if ! command -v pm2 &> /dev/null; then
    echo -e "${YELLOW}PM2 nicht gefunden, installiere...${NC}"
    sudo npm install -g pm2
fi
echo -e "${GREEN}✅ PM2 installiert${NC}"

echo ""
echo "4️⃣ PostgreSQL prüfen..."
if ! command -v psql &> /dev/null; then
    echo -e "${RED}❌ PostgreSQL nicht installiert!${NC}"
    echo "Installiere PostgreSQL mit:"
    echo "sudo apt install -y postgresql postgresql-contrib"
    exit 1
fi

# PostgreSQL Status
if sudo systemctl is-active --quiet postgresql; then
    echo -e "${GREEN}✅ PostgreSQL läuft${NC}"
else
    echo -e "${YELLOW}⚠️ PostgreSQL startet...${NC}"
    sudo systemctl start postgresql
fi

echo ""
echo "5️⃣ Datenbank 'klassik' prüfen..."
DB_EXISTS=$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='klassik'" 2>/dev/null || echo "0")

if [ "$DB_EXISTS" = "1" ]; then
    echo -e "${GREEN}✅ Database 'klassik' existiert${NC}"
else
    echo -e "${YELLOW}⚠️ Database 'klassik' wird erstellt...${NC}"
    sudo -u postgres psql -c "CREATE DATABASE klassik;"
    sudo -u postgres psql -c "CREATE USER klassik WITH PASSWORD 'your-secure-password-here';"
    sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE klassik TO klassik;"
    echo -e "${GREEN}✅ Database 'klassik' erstellt${NC}"
fi

echo ""
echo "6️⃣ Backend Dependencies installieren..."
cd "$BACKEND_DIR"

if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}⚠️ node_modules nicht gefunden, installiere...${NC}"
    npm install
else
    echo -e "${GREEN}✅ node_modules vorhanden${NC}"
fi

echo ""
echo "7️⃣ .env Konfiguration prüfen..."
if [ ! -f ".env" ]; then
    echo -e "${RED}❌ .env nicht gefunden!${NC}"
    echo "Erstelle .env aus Template..."
    cp .env.example .env 2>/dev/null || echo "Bitte .env manuell erstellen!"
    exit 1
fi

# Zeige wichtige Config-Werte
echo -e "${YELLOW}Aktuelle Konfiguration:${NC}"
grep -E "^(PORT|NODE_ENV|DATABASE_URL)" .env || echo "Keine Config gefunden"

echo ""
echo "8️⃣ Firewall konfigurieren..."
if command -v ufw &> /dev/null; then
    sudo ufw allow 8130/tcp
    echo -e "${GREEN}✅ Port 8130 geöffnet${NC}"
else
    echo -e "${YELLOW}⚠️ UFW nicht gefunden, Port manuell öffnen!${NC}"
fi

echo ""
echo "9️⃣ PM2 starten/neu starten..."
pm2 delete klassik-backend 2>/dev/null || true
pm2 start src/index.js --name klassik-backend --time

echo ""
echo "🔟 PM2 Auto-Start einrichten..."
pm2 startup | grep "sudo" | bash || true
pm2 save

echo ""
echo "════════════════════════════════════════════════════════"
echo -e "${GREEN}✅ Deployment abgeschlossen!${NC}"
echo "════════════════════════════════════════════════════════"
echo ""
echo "📊 Status prüfen:"
echo "  pm2 status"
echo "  pm2 logs klassik-backend"
echo ""
echo "🧪 Backend testen:"
echo "  curl http://localhost:8130/health"
echo ""
echo "🌐 Von außen erreichbar unter:"
SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || echo "DEINE_SERVER_IP")
echo "  http://$SERVER_IP:8130/health"
echo "  http://$SERVER_IP:8130/gateway.html"
echo ""
echo "📋 API Endpoints:"
echo "  POST   http://$SERVER_IP:8130/api/auth/register"
echo "  POST   http://$SERVER_IP:8130/api/auth/login"
echo "  GET    http://$SERVER_IP:8130/api/kaspa/stats"
echo "  GET    http://$SERVER_IP:8130/api/products"
echo "  POST   http://$SERVER_IP:8130/api/payments/invoice"
echo "  POST   http://$SERVER_IP:8130/api/orders"
echo ""
echo "🔧 Nützliche Befehle:"
echo "  pm2 restart klassik-backend   # Neustart"
echo "  pm2 stop klassik-backend       # Stoppen"
echo "  pm2 logs klassik-backend       # Logs anzeigen"
echo "  pm2 monit                      # Monitoring"
echo ""
