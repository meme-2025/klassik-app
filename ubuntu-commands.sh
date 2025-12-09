#!/bin/bash

# ═══════════════════════════════════════════════════════════
# 🚀 UBUNTU SERVER - DEPLOYMENT BEFEHLE
# ═══════════════════════════════════════════════════════════

echo "Kopiere diese Befehle auf deinen Ubuntu Server:"
echo ""

cat << 'UBUNTU_COMMANDS'

# ═══════════════════════════════════════════════════════════
# 1️⃣ PROJEKT VON GITHUB HOLEN
# ═══════════════════════════════════════════════════════════

cd ~
git clone https://github.com/meme-2025/klassik-app.git klassik

# Oder falls schon existiert:
cd ~/klassik
git pull origin klassik1

# ═══════════════════════════════════════════════════════════
# 2️⃣ DEPLOYMENT SCRIPT AUSFÜHREN
# ═══════════════════════════════════════════════════════════

cd ~/klassik
chmod +x deploy-ubuntu.sh
./deploy-ubuntu.sh

# Das Script installiert automatisch:
# - Node.js & npm
# - PM2
# - Prüft PostgreSQL
# - Erstellt Database falls nötig
# - npm install
# - Öffnet Firewall Port 8130
# - Startet Backend mit PM2

# ═══════════════════════════════════════════════════════════
# 3️⃣ MANUELLE INSTALLATION (falls Script nicht läuft)
# ═══════════════════════════════════════════════════════════

# Node.js installieren
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# PM2 installieren
sudo npm install -g pm2

# PostgreSQL prüfen
sudo systemctl status postgresql
sudo systemctl start postgresql

# Database erstellen (falls nötig)
sudo -u postgres psql << EOF
CREATE DATABASE klassik;
CREATE USER klassik WITH PASSWORD 'your-secure-password';
GRANT ALL PRIVILEGES ON DATABASE klassik TO klassik;
\q
EOF

# Backend Dependencies
cd ~/klassik/backend
npm install

# .env konfigurieren
nano .env
# Prüfe:
# PORT=8130
# DATABASE_URL=postgresql://klassik:password@localhost:5432/klassik
# JWT_SECRET=<generiere mit: openssl rand -base64 32>

# Firewall
sudo ufw allow 8130/tcp
sudo ufw status

# Backend starten
pm2 start src/index.js --name klassik-backend

# Auto-Start bei Reboot
pm2 startup
# Kopiere den ausgegebenen Befehl und führe ihn aus
pm2 save

# ═══════════════════════════════════════════════════════════
# 4️⃣ TESTEN
# ═══════════════════════════════════════════════════════════

# Status prüfen
pm2 status
pm2 logs klassik-backend

# Health Check lokal
curl http://localhost:8130/health

# Server IP herausfinden
curl ifconfig.me
# Beispiel Output: 203.0.113.45

# Health Check von außen (von Windows)
# curl http://203.0.113.45:8130/health

# ═══════════════════════════════════════════════════════════
# 5️⃣ DATENBANK TABELLEN ERSTELLEN
# ═══════════════════════════════════════════════════════════

# Migrationen ausführen
cd ~/klassik/backend
npm run migrate

# Oder manuell:
sudo -u postgres psql -d klassik << 'EOF'
-- Users Tabelle (email = wallet address, password = username)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Nonces für Wallet-Signatur
CREATE TABLE IF NOT EXISTS nonces (
    id SERIAL PRIMARY KEY,
    address VARCHAR(42) UNIQUE NOT NULL,
    nonce VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Products
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10,2),
    category VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Orders
CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    product_id INTEGER REFERENCES products(id),
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_nonces_address ON nonces(address);
EOF

# Tabellen prüfen
sudo -u postgres psql -d klassik -c "\dt"

# ═══════════════════════════════════════════════════════════
# 6️⃣ NÜTZLICHE BEFEHLE
# ═══════════════════════════════════════════════════════════

# PM2 Management
pm2 status                    # Status anzeigen
pm2 logs klassik-backend      # Logs
pm2 restart klassik-backend   # Neustart
pm2 stop klassik-backend      # Stoppen
pm2 monit                     # Monitoring

# Database abfragen
sudo -u postgres psql -d klassik -c "SELECT * FROM users;"

# Code-Updates
cd ~/klassik
git pull origin klassik1
cd backend
npm install
pm2 restart klassik-backend

# Firewall prüfen
sudo ufw status
sudo netstat -tuln | grep 8130

UBUNTU_COMMANDS

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "✅ Befehle bereit zum Kopieren!"
echo "═══════════════════════════════════════════════════════════"
