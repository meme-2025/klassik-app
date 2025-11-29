#!/bin/bash
#
# Klassik Backend - Ubuntu Server Setup Script
# Automatisches Deployment für https://github.com/meme-2025/klassik-app
#
# Voraussetzungen:
# - Ubuntu 20.04+ Server mit sudo-Rechten
# - Ausführung als normaler User (nicht root)
#
# Verwendung:
#   chmod +x setup-ubuntu.sh
#   ./setup-ubuntu.sh
#

set -e  # Bei Fehler abbrechen

echo "═══════════════════════════════════════════════════════════"
echo "  Klassik Backend - Ubuntu Server Setup"
echo "═══════════════════════════════════════════════════════════"
echo ""

# Farben für Output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Konfiguration (anpassen falls nötig)
APP_USER="klassik"
APP_DIR="/opt/klassik/backend"
REPO_URL="https://github.com/meme-2025/klassik-app.git"
DB_NAME="klassik"
DB_USER="klassik"
DB_PASSWORD=""  # Wird generiert oder manuell eingegeben
JWT_SECRET=""   # Wird generiert

# Funktion: Frage nach DB-Passwort
ask_db_password() {
    echo -e "${YELLOW}Erstelle starkes Datenbank-Passwort...${NC}"
    DB_PASSWORD=$(openssl rand -base64 24 | tr -d "=+/" | cut -c1-20)
    echo -e "${GREEN}✓ DB-Passwort generiert${NC}"
}

# Funktion: JWT Secret generieren
generate_jwt_secret() {
    echo -e "${YELLOW}Erstelle JWT Secret...${NC}"
    JWT_SECRET=$(openssl rand -base64 32)
    echo -e "${GREEN}✓ JWT Secret generiert${NC}"
}

# 1) System aktualisieren
echo -e "${YELLOW}[1/10] System wird aktualisiert...${NC}"
sudo apt-get update -qq
sudo apt-get upgrade -y -qq

# 2) Notwendige Pakete installieren
echo -e "${YELLOW}[2/10] Installiere Basis-Pakete...${NC}"
sudo apt-get install -y curl git nginx postgresql postgresql-contrib ufw build-essential

# 3) Node.js 18 LTS installieren
echo -e "${YELLOW}[3/10] Installiere Node.js 18...${NC}"
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi
echo -e "${GREEN}✓ Node $(node --version) installiert${NC}"

# 4) App-User erstellen
echo -e "${YELLOW}[4/10] Erstelle System-User '$APP_USER'...${NC}"
if ! id "$APP_USER" &>/dev/null; then
    sudo adduser --system --group --no-create-home $APP_USER
    echo -e "${GREEN}✓ User erstellt${NC}"
else
    echo -e "${GREEN}✓ User existiert bereits${NC}"
fi

# 5) PostgreSQL einrichten
echo -e "${YELLOW}[5/10] Richte PostgreSQL ein...${NC}"
ask_db_password

# Prüfe ob DB bereits existiert
if sudo -u postgres psql -lqt | cut -d \| -f 1 | grep -qw $DB_NAME; then
    echo -e "${YELLOW}⚠ Datenbank '$DB_NAME' existiert bereits. Überspringe DB-Erstellung.${NC}"
else
    sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';" 2>/dev/null || true
    sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;"
    echo -e "${GREEN}✓ PostgreSQL Datenbank erstellt${NC}"
fi

# 6) Repository klonen
echo -e "${YELLOW}[6/10] Klone Repository...${NC}"
sudo mkdir -p /opt/klassik
sudo chown $USER:$USER /opt/klassik

if [ -d "$APP_DIR" ]; then
    echo -e "${YELLOW}⚠ Verzeichnis existiert bereits. Führe git pull aus...${NC}"
    cd $APP_DIR
    git pull origin main
else
    git clone $REPO_URL $APP_DIR
fi
cd $APP_DIR

# 7) Environment-Datei erstellen
echo -e "${YELLOW}[7/10] Erstelle Environment-Datei...${NC}"
generate_jwt_secret

sudo mkdir -p /etc/klassik
sudo bash -c "cat > /etc/klassik/klassik.env" <<EOF
# Klassik Backend Environment
DATABASE_URL=postgresql://$DB_USER:$DB_PASSWORD@localhost:5432/$DB_NAME
JWT_SECRET=$JWT_SECRET
JWT_EXPIRY=24h
NODE_ENV=production
PORT=3000
CORS_ORIGIN=*
EOF

sudo chown root:$APP_USER /etc/klassik/klassik.env
sudo chmod 640 /etc/klassik/klassik.env
echo -e "${GREEN}✓ Environment-Datei erstellt: /etc/klassik/klassik.env${NC}"

# 8) Dependencies installieren und Migrationen ausführen
echo -e "${YELLOW}[8/10] Installiere Dependencies...${NC}"
cd $APP_DIR
npm ci --production --silent

echo -e "${YELLOW}Führe Datenbank-Migrationen aus...${NC}"
sudo -u $APP_USER bash -c "set -a; source /etc/klassik/klassik.env; set +a; npm run migrate:up"
echo -e "${GREEN}✓ Migrationen abgeschlossen${NC}"

# Optional: Seed data
# sudo -u $APP_USER bash -c "set -a; source /etc/klassik/klassik.env; set +a; npm run seed"

# 9) systemd Service einrichten
echo -e "${YELLOW}[9/10] Richte systemd Service ein...${NC}"
sudo cp $APP_DIR/deploy/klassik.service /etc/systemd/system/klassik.service
sudo systemctl daemon-reload
sudo systemctl enable klassik
sudo systemctl restart klassik

# Kurz warten und Status prüfen
sleep 2
if sudo systemctl is-active --quiet klassik; then
    echo -e "${GREEN}✓ Service läuft${NC}"
else
    echo -e "${RED}✗ Service-Start fehlgeschlagen. Prüfe Logs mit: sudo journalctl -u klassik -n 50${NC}"
fi

# 10) nginx konfigurieren
echo -e "${YELLOW}[10/10] Konfiguriere nginx...${NC}"
sudo cp $APP_DIR/deploy/nginx.conf /etc/nginx/sites-available/klassik

# Ersetze Platzhalter mit tatsächlicher Server-IP oder Domain
SERVER_IP=$(hostname -I | awk '{print $1}')
sudo sed -i "s/your.domain.tld/$SERVER_IP/g" /etc/nginx/sites-available/klassik

sudo ln -sf /etc/nginx/sites-available/klassik /etc/nginx/sites-enabled/klassik
sudo rm -f /etc/nginx/sites-enabled/default  # Standard-Site deaktivieren

if sudo nginx -t 2>/dev/null; then
    sudo systemctl reload nginx
    echo -e "${GREEN}✓ nginx konfiguriert${NC}"
else
    echo -e "${RED}✗ nginx Konfiguration fehlerhaft${NC}"
fi

# Firewall konfigurieren
echo -e "${YELLOW}Konfiguriere Firewall...${NC}"
sudo ufw --force enable
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
echo -e "${GREEN}✓ Firewall konfiguriert${NC}"

echo ""
echo "═══════════════════════════════════════════════════════════"
echo -e "${GREEN}✓ Installation abgeschlossen!${NC}"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "Server läuft auf:"
echo "  HTTP:  http://$SERVER_IP"
echo "  API:   http://$SERVER_IP/api/auth/login"
echo ""
echo "Credentials gespeichert in: /etc/klassik/klassik.env"
echo ""
echo "Nützliche Befehle:"
echo "  Service-Status:  sudo systemctl status klassik"
echo "  Logs ansehen:    sudo journalctl -u klassik -f"
echo "  Service neu starten: sudo systemctl restart klassik"
echo "  nginx Logs:      sudo tail -f /var/log/nginx/error.log"
echo ""
echo "Schnelltest:"
echo "  curl http://localhost:3000/health"
echo "  curl -X POST -H 'Content-Type: application/json' \\"
echo "    -d '{\"email\":\"test@example.com\",\"password\":\"test1234\"}' \\"
echo "    http://localhost:3000/api/auth/register"
echo ""
echo -e "${YELLOW}Optional: SSL-Zertifikat einrichten (wenn Domain vorhanden):${NC}"
echo "  sudo apt install -y certbot python3-certbot-nginx"
echo "  sudo certbot --nginx -d ihre-domain.de"
echo ""
echo "═══════════════════════════════════════════════════════════"
