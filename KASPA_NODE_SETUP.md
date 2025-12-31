# 🚀 KASPA-NODE & REST-SERVER SETUP GUIDE

## Vollständige Anleitung zur Installation eines lokalen Kaspa-Nodes mit kaspa-rest-server

---

## 📋 SYSTEM-VORAUSSETZUNGEN

### Hardware
- **CPU:** 4+ Cores empfohlen
- **RAM:** 8 GB minimum, 16 GB empfohlen
- **Disk:** 200 GB freier Speicher (SSD empfohlen)
- **Bandwidth:** Unbegrenzt (Node synchronisiert ~100 GB)

### Software
- **OS:** Ubuntu 20.04/22.04 LTS oder Debian 11+
- **Go:** Version 1.21+ (für kaspa-rest-server)
- **PostgreSQL:** 14+ (für kaspa-rest-server Indexer)
- **Git:** Für Source-Code

---

## 🔧 INSTALLATION

### OPTION 1: Kaspa-Rest-Server (Empfohlen für API)

Der `kaspa-rest-server` bietet eine vollständige REST-API und ist ideal für Web-Anwendungen.

#### Schritt 1: Go installieren

```bash
# Go 1.21+ installieren
sudo apt update
sudo apt install -y wget

wget https://go.dev/dl/go1.21.6.linux-amd64.tar.gz
sudo rm -rf /usr/local/go
sudo tar -C /usr/local -xzf go1.21.6.linux-amd64.tar.gz

# PATH setzen
echo 'export PATH=$PATH:/usr/local/go/bin' >> ~/.bashrc
echo 'export GOPATH=$HOME/go' >> ~/.bashrc
source ~/.bashrc

# Verifizieren
go version
# Output: go version go1.21.6 linux/amd64
```

#### Schritt 2: PostgreSQL installieren

```bash
# PostgreSQL 14+
sudo apt install -y postgresql postgresql-contrib

# Datenbank erstellen
sudo -u postgres psql
```

```sql
CREATE DATABASE kaspa_indexer;
CREATE USER kaspa WITH PASSWORD 'secure_password_here';
GRANT ALL PRIVILEGES ON DATABASE kaspa_indexer TO kaspa;
\q
```

#### Schritt 3: kaspa-rest-server bauen

```bash
# Repository klonen
cd /opt
sudo git clone https://github.com/kaspa-ng/kaspa-rest-server.git
cd kaspa-rest-server

# Dependencies installieren
go mod download

# Binary bauen
go build -o kaspa-rest-server ./cmd/kaspa-rest-server

# Nach /usr/local/bin verschieben
sudo mv kaspa-rest-server /usr/local/bin/
```

#### Schritt 4: Konfiguration

```bash
# Config-Datei erstellen
sudo mkdir -p /etc/kaspa
sudo tee /etc/kaspa/rest-server.conf > /dev/null <<'EOF'
# Kaspa Node
kaspa-node-url = "localhost:16110"
kaspa-node-network = "mainnet"

# PostgreSQL Indexer
db-host = "localhost"
db-port = 5432
db-name = "kaspa_indexer"
db-user = "kaspa"
db-password = "secure_password_here"

# REST API Server
listen-address = "0.0.0.0:8080"
enable-cors = true
log-level = "info"

# Performance
max-connections = 100
query-timeout = 30
cache-enabled = true
cache-ttl = 60
EOF

sudo chmod 600 /etc/kaspa/rest-server.conf
```

#### Schritt 5: Kaspad installieren

```bash
# Kaspad Node Binary herunterladen
cd /opt
wget https://github.com/kaspanet/kaspad/releases/download/v0.13.7/kaspad-v0.13.7-linux-amd64.tar.gz
tar -xzf kaspad-v0.13.7-linux-amd64.tar.gz
sudo mv kaspad /usr/local/bin/
```

#### Schritt 6: Systemd Services einrichten

**Kaspad Service:**

```bash
sudo tee /etc/systemd/system/kaspad.service > /dev/null <<'EOF'
[Unit]
Description=Kaspa Node (kaspad)
After=network.target

[Service]
Type=simple
User=kaspa
Group=kaspa
WorkingDirectory=/var/lib/kaspad
ExecStart=/usr/local/bin/kaspad \
  --appdir=/var/lib/kaspad \
  --rpclisten=0.0.0.0:16110 \
  --utxoindex \
  --loglevel=info
Restart=always
RestartSec=10
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
EOF
```

**kaspa-rest-server Service:**

```bash
sudo tee /etc/systemd/system/kaspa-rest-server.service > /dev/null <<'EOF'
[Unit]
Description=Kaspa REST API Server
After=network.target postgresql.service kaspad.service
Requires=postgresql.service kaspad.service

[Service]
Type=simple
User=kaspa
Group=kaspa
Environment="CONFIG_FILE=/etc/kaspa/rest-server.conf"
ExecStart=/usr/local/bin/kaspa-rest-server --config=$CONFIG_FILE
Restart=always
RestartSec=10
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
EOF
```

#### Schritt 7: User und Verzeichnisse erstellen

```bash
# Kaspa User erstellen
sudo useradd -r -s /bin/false kaspa

# Verzeichnisse
sudo mkdir -p /var/lib/kaspad
sudo chown -R kaspa:kaspa /var/lib/kaspad
```

#### Schritt 8: Services starten

```bash
# Systemd reload
sudo systemctl daemon-reload

# Services enablen & starten
sudo systemctl enable kaspad
sudo systemctl enable kaspa-rest-server

sudo systemctl start kaspad
sudo systemctl start kaspa-rest-server

# Status prüfen
sudo systemctl status kaspad
sudo systemctl status kaspa-rest-server
```

#### Schritt 9: Logs überwachen

```bash
# Kaspad Logs
sudo journalctl -u kaspad -f

# REST-Server Logs
sudo journalctl -u kaspa-rest-server -f
```

---

## ⏱️ SYNCHRONISATION

### Kaspad Initial Sync

Die initiale Synchronisation kann **24-48 Stunden** dauern.

**Sync-Status prüfen:**

```bash
# Via kaspad CLI
kaspad-cli getinfo

# Via REST-API
curl http://localhost:8080/info/blockdag
```

**Erwartete Output:**
```json
{
  "blockCount": 45123456,
  "headerCount": 45123456,
  "tipHashes": ["..."],
  "difficulty": 123456789,
  "virtualDaaScore": 45123456
}
```

Wenn `blockCount` == `headerCount` → **Sync complete** ✅

---

## 🔗 BACKEND INTEGRATION

### Klassik Backend konfigurieren

```bash
# /etc/klassik/klassik1.env
echo "KASPA_REST_SERVER=http://localhost:8080" >> /etc/klassik/klassik1.env

# Backend neu starten
sudo systemctl restart klassik-backend
```

### Backend-Code nutzt automatisch localhost-first:

```javascript
// backend/src/routes/kaspa-enhanced.js
const KASPA_REST_CONFIG = {
  local: 'http://localhost:8080',  // ✅ Lokaler kaspa-rest-server
  public: [
    'https://api.kaspa.org',        // Fallback
    'https://api.kas.pa'
  ]
};
```

---

## 📊 API-ENDPOINTS TESTEN

### Health Check

```bash
curl http://localhost:8080/info/health
```

```json
{
  "status": "healthy",
  "kaspadConnected": true,
  "databaseConnected": true
}
```

### Network Stats

```bash
curl http://localhost:8080/info/network
```

### Latest Blocks

```bash
curl http://localhost:8080/blocks?limit=10
```

### Address Lookup

```bash
curl http://localhost:8080/addresses/kaspa:qq.../balance
```

### Vollständige API-Dokumentation:

👉 https://api.kaspa.org/docs

---

## 🛠️ TROUBLESHOOTING

### Problem: Kaspad sync bleibt stehen

```bash
# Kaspad neu starten
sudo systemctl restart kaspad

# Logs prüfen
sudo journalctl -u kaspad -n 100

# Ggf. mit --reset flag neu syncen
sudo systemctl stop kaspad
sudo rm -rf /var/lib/kaspad/*
sudo systemctl start kaspad
```

### Problem: REST-Server verbindet nicht zu kaspad

```bash
# Prüfe ob kaspad läuft
sudo systemctl status kaspad

# Teste RPC-Verbindung
telnet localhost 16110

# Prüfe Firewall
sudo ufw allow 16110/tcp
```

### Problem: PostgreSQL Connection failed

```bash
# PostgreSQL Status
sudo systemctl status postgresql

# Test Connection
psql -U kaspa -d kaspa_indexer -h localhost

# Passwort in /etc/kaspa/rest-server.conf prüfen
```

---

## 🔧 PERFORMANCE-TUNING

### Kaspad Optimierungen

```bash
# /etc/systemd/system/kaspad.service
ExecStart=/usr/local/bin/kaspad \
  --appdir=/var/lib/kaspad \
  --rpclisten=0.0.0.0:16110 \
  --utxoindex \
  --maxorphantx=10000 \       # Mehr orphan TXs
  --dbcachedsize=4096 \        # 4 GB DB Cache
  --maxpeers=125 \             # Mehr Peers
  --loglevel=info
```

### PostgreSQL Tuning

```bash
sudo nano /etc/postgresql/14/main/postgresql.conf
```

```ini
# Memory
shared_buffers = 4GB
effective_cache_size = 12GB
work_mem = 256MB
maintenance_work_mem = 1GB

# Connections
max_connections = 200

# Performance
random_page_cost = 1.1  # Für SSD
effective_io_concurrency = 200

# Logging
log_min_duration_statement = 1000  # Log slow queries
```

```bash
sudo systemctl restart postgresql
```

---

## 📦 OPTION 2: Nur Kaspad (ohne REST-Server)

Wenn du nur einen Node ohne API brauchst:

```bash
# Kaspad starten (simpel)
kaspad --appdir=/var/lib/kaspad --utxoindex

# Oder via Systemd Service (siehe oben)
```

**Verwendung im Backend:**

Das Backend nutzt dann nur die Public APIs als Fallback:

```javascript
// Kein localhost:8080 → automatisch Fallback zu api.kaspa.org
```

---

## 🔒 SICHERHEIT

### Firewall-Regeln

```bash
# Nur Backend darf auf REST-API zugreifen
sudo ufw allow from 127.0.0.1 to any port 8080

# P2P Port für Kaspad öffnen
sudo ufw allow 16111/tcp

# SSH
sudo ufw allow 22/tcp

sudo ufw enable
```

### Nginx Reverse Proxy (optional)

```bash
sudo tee /etc/nginx/sites-available/kaspa-api > /dev/null <<'EOF'
server {
    listen 80;
    server_name kaspa-api.yourdomain.com;

    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
EOF

sudo ln -s /etc/nginx/sites-available/kaspa-api /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## 📈 MONITORING

### Node Health Check Script

```bash
#!/bin/bash
# /opt/kaspa/health-check.sh

KASPAD_RPC="http://localhost:16110"
REST_API="http://localhost:8080"

# Check Kaspad
if curl -s "${REST_API}/info/health" | grep -q "healthy"; then
    echo "✅ Kaspa Node: Healthy"
else
    echo "❌ Kaspa Node: Unhealthy"
    sudo systemctl restart kaspad kaspa-rest-server
fi
```

### Cron-Job (alle 5 Minuten)

```bash
crontab -e
```

```cron
*/5 * * * * /opt/kaspa/health-check.sh >> /var/log/kaspa-health.log 2>&1
```

---

## 📚 RESSOURCEN

- **Kaspad Repo:** https://github.com/kaspanet/kaspad
- **Kaspa-Rest-Server:** https://github.com/kaspa-ng/kaspa-rest-server
- **API Docs:** https://api.kaspa.org/docs
- **Discord:** https://discord.gg/kaspa
- **Explorer:** https://explorer.kaspa.org

---

## ✅ FERTIG!

Dein lokaler Kaspa-Node + REST-Server läuft jetzt und dein Klassik-Backend nutzt ihn automatisch!

**Test im Browser:**
```
http://your-server-ip:8080/info/blockdag
```

**Im Klassik-Backend:**
```
http://localhost:3000/api/kaspa-enhanced/stats
```

🎉 **Happy Coding!**
